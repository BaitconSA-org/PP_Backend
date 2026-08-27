const { getS4Service } = require("./utils/s4-connector");
const sapCfAxios = require('sap-cf-axios').default;
const FormData = require('form-data');
const cds = require('@sap/cds');
const { generateProtectedExcel } = require('./utils/excel-generator');
const { PROTECTED_BP_FIELDS } = require('./utils/modification');
const dmsClient = require('./dms/dms-client-tickets');
const { mailHeader } = require('./utils/email-templates');
const REPO_ID = process.env.DMS_REPOSITORY_ID;

// Mapeo de área aprobadora → Role Collection de BTP. Los aprobadores reales de
// cada área se resuelven consultando esa RC (mismos nombres que xs-security.json).
const AREA_ROLE_COLLECTION = {
  LEGAL: process.env.BTP_RC_APROBADOR_LEGAL || 'PP_AprobadorLegales',
  TAX: process.env.BTP_RC_APROBADOR_IMPUESTOS || 'PP_AprobadorImpuestos',
  TREASURY: process.env.BTP_RC_APROBADOR_TESORERIA || 'PP_AprobadorTesoreria'
};

// Resuelve los emails de los usuarios asignados a una Role Collection de BTP.
// OJO: el filtro server-side de /Groups (?filter=displayName eq "...") NO se aplica
// en esta API (devuelve TODOS los grupos), por eso buscamos el grupo por displayName
// exacto en la lista. Tomar allGroups[0] hacía que las 3 áreas resolvieran siempre
// el mismo grupo equivocado ("Build Code - Lobby Admin").
async function _btpEmailsByRoleCollection(roleCollection) {
  const axios = sapCfAxios('CAP_XSUAA_APIACCESS');

  const groupRes = await axios({ method: 'GET', url: '/Groups', params: { count: 500 } });
  const allGroups = groupRes.data?.resources || groupRes.data?.Resources || [];
  const group = allGroups.find(g => g.displayName === roleCollection);
  if (!group) {
    console.warn(`[_btpEmailsByRoleCollection] RC "${roleCollection}" no encontrada entre ${allGroups.length} grupos.`);
    return [];
  }

  const memberIds = new Set((group.members || []).map(m => m.value).filter(Boolean));
  if (!memberIds.size) return [];

  const emails = [];
  let startIndex = 1;
  const pageSize = 500;
  while (true) {
    const res = await axios({ method: 'GET', url: '/Users', params: { count: pageSize, startIndex } });
    const list = res.data?.resources || res.data?.Resources || [];
    const total = res.data?.totalResults || 0;

    for (const u of list) {
      if (!memberIds.has(u.id)) continue;
      if (u.active === false) continue;
      const email = (u.emails?.find(e => e.primary) || u.emails?.[0] || {}).value || u.userName || '';
      if (email) emails.push(email);
    }

    if ((startIndex + list.length - 1) >= total || list.length < pageSize) break;
    startIndex += pageSize;
  }

  return emails;
}

// Devuelve los emails de los aprobadores activos de un área. Si BTP falla o no
// devuelve usuarios, cae a los TEST_APPROVER_*_EMAIL de entorno (útil en dev).
async function getApproverEmailsByArea(area, fallbackEmails = []) {
  const rc = AREA_ROLE_COLLECTION[area];
  if (rc) {
    try {
      const emails = await _btpEmailsByRoleCollection(rc);
      if (emails.length) return emails;
      console.warn(`[getApproverEmailsByArea] RC "${rc}" (${area}) sin aprobadores activos; uso fallback:`, JSON.stringify(fallbackEmails));
    } catch (err) {
      console.error(`[getApproverEmailsByArea] Error consultando RC "${rc}" (${area}): ${err.message}; uso fallback:`, JSON.stringify(fallbackEmails));
    }
  }
  return fallbackEmails;
}

// Upsert de WorkflowStatus por (business_partner_ID, application_type): reutiliza la
// fila existente en vez de acumular una nueva por cada modificación/reintento.
// Devuelve el ID de la fila (nueva o existente) para actualizarla después.
async function upsertWorkflowStatus(WorkflowStatus, bp_id, application_type, fields) {
  const existing = await SELECT.one
    .from(WorkflowStatus)
    .columns("ID")
    .where({ business_partner_ID: bp_id, application_type });

  const wfId = existing?.ID || cds.utils.uuid();

  if (existing) {
    await UPDATE(WorkflowStatus)
      .set({ ...fields, workflow_instance_id: null })
      .where({ ID: wfId });
  } else {
    await INSERT.into(WorkflowStatus).entries({
      ID: wfId,
      business_partner_ID: bp_id,
      application_type,
      ...fields
    });
  }

  return wfId;
}

// Áreas que admiten un pedido de modificación iniciado por el proveedor. Son las
// únicas dos que tienen WF de modificación: el resto de los datos (dirección,
// contactos, legales) sigue cambiándose por el alta o a mano.
const PROVIDER_MODIF_AREAS = {
  TESO: { application_type: 'MODIF_TESORERIA', label: 'tesorería', logPrefix: 'TREASURY' },
  TAX: { application_type: 'MODIF_IMPUESTOS', label: 'impuestos', logPrefix: 'TAX' }
};

const PROVIDER_ROLES = ['ProveedorActivo', 'ProveedorProvisorio', 'ProveedorPrecertificacion'];
const INTERNAL_MODIF_ROLES = ['CoordinadorProveedores', 'AprobadorTesoreria', 'AprobadorImpuestos', 'AprobadorLegales', 'Admin'];

// El atributo bp_id del token XSUAA llega como string o como array de un elemento
// (mismo criterio que usa la función `me`).
function _bpIdFromToken(user) {
  const raw = user?.attr?.bp_id;
  return String(Array.isArray(raw) ? (raw[0] || '') : (raw || '')).trim();
}

// Compara identificadores ignorando separadores y mayúsculas: el mismo CUIT viaja como
// "30-64616777-5" o "30646167775" según de dónde venga.
function _normalizarId(v) {
  return String(v || '').replace(/[^0-9A-Za-z]/g, '').toLowerCase();
}

// ¿El bp_id del token identifica a ESTE BP? OJO: el atributo NO es el GUID de la entidad.
//   - ProveedorActivo     → NÚMERO de BP (business_partner_number)
//   - ProveedorProvisorio → número de identificación fiscal (CUIT/NIF) hasta que S/4 crea
//                           el BP, y el número de BP después
// Es el mismo criterio que aplica el front (accessControl.isOwnBp / isOwnProvisional), por
// eso se valida contra el BP ya cargado y no contra el bp_id de la request.
async function _tokenBpIdMatches(sTokenBpId, bp) {
  const sBuscado = _normalizarId(sTokenBpId);
  if (!sBuscado) return false;

  const aCandidatos = [bp.ID, bp.business_partner_number, bp.lifnr];
  if (aCandidatos.some(v => v && _normalizarId(v) === sBuscado)) return true;

  const { TaxNumbers } = cds.entities("ABMContratistaService");
  const aTax = await SELECT.from(TaxNumbers)
    .columns('identification_number')
    .where({ business_partner_ID: bp.ID });

  return aTax.some(t => _normalizarId(t.identification_number) === sBuscado);
}

// ¿Puede este usuario pedir/reenviar una modificación sobre este BP? El proveedor sólo
// puede operar sobre SU propio BP (bp_id del token) y un usuario interno puede hacerlo
// en su nombre. Devuelve el mensaje de error o null si está autorizado.
//
// strict = true (pedido nuevo del proveedor): fail-closed — un rol de proveedor sin
// bp_id en el token no puede pedir nada, y quien no es proveedor necesita un rol interno.
// strict = false (reenvío desde el mail, flujo que ya existía): sólo corta el caso claro
// de un proveedor operando sobre OTRO BP; si el token no trae bp_id se deja pasar con un
// warning para no romper a los usuarios que hoy no tienen el atributo seteado.
async function _checkModificationRequestAuth(req, bp, { strict = true } = {}) {
  const u = req.user;
  if (u?._is_privileged) return null;

  if (PROVIDER_ROLES.some(r => u.is(r))) {
    const sToken = _bpIdFromToken(u);
    if (!sToken) {
      if (strict) return 'El usuario no tiene un proveedor asociado (bp_id ausente en el token)';
      console.warn(`[_checkModificationRequestAuth] ⚠ Proveedor "${u.id}" sin bp_id en el token operando sobre BP ${bp.ID}: no se puede validar la titularidad`);
      return null;
    }
    if (!(await _tokenBpIdMatches(sToken, bp)))
      return 'No autorizado a operar sobre otro proveedor';
    return null;
  }

  if (!strict) return null;

  return INTERNAL_MODIF_ROLES.some(r => u.is(r))
    ? null
    : 'El usuario no posee permisos para solicitar modificaciones';
}

// Ventana durante la cual un WF de modificación en APROBADO se considera "impactando S/4
// ahora mismo". Pasada, se asume que el callback de cierre se perdió (p. ej. la destination
// del callback caída) y se deja pasar al área contraria: sin esta válvula, un endWorkflowABM
// que nunca llega dejaría el BP bloqueado para siempre.
const MODIF_IMPACTO_S4_VENTANA_MS = 15 * 60 * 1000;

// Las modificaciones de tesorería e impuestos SÍ pueden convivir: mientras están en
// PENDIENTE/INFO el WF sólo manda mails y no toca S/4 (el split de bancos y las lecturas a
// S/4 sólo corren con wfState === "APROBADO"). Lo que no puede solaparse es el IMPACTO: dos
// flujos de BPA escribiendo el mismo BP a la vez dan el lock R1/084. Un WF en APROBADO es
// justamente eso —ya disparado, todavía sin cierre—, así que si el área contraria está en ese
// estado se corta la aprobación para que se reintente en unos minutos.
// Devuelve el mensaje de error, o null si se puede impactar.
async function _checkOtraAreaImpactandoS4(WorkflowStatus, bp_id, application_type) {
  const sOtra = application_type === 'MODIF_TESORERIA' ? 'MODIF_IMPUESTOS' : 'MODIF_TESORERIA';

  const oOtra = await SELECT.one.from(WorkflowStatus)
    .columns('status', 'modifiedAt')
    .where({ business_partner_ID: bp_id, application_type: sOtra, status: 'APROBADO' });

  if (!oOtra) return null;

  const sLabel = sOtra === 'MODIF_TESORERIA' ? 'tesorería' : 'impuestos';
  const iEdadMs = Date.now() - new Date(oOtra.modifiedAt || 0).getTime();

  if (iEdadMs > MODIF_IMPACTO_S4_VENTANA_MS) {
    console.warn(`[_checkOtraAreaImpactandoS4] ⚠ BP ${bp_id}: la modificación de ${sLabel} sigue en APROBADO hace ${Math.round(iEdadMs / 60000)} min sin cerrar (callback perdido) → se deja impactar igual`);
    return null;
  }

  return `La modificación de ${sLabel} se está impactando en S/4 en este momento. Reintentá en unos minutos.`;
}

// Recorta el borrador del proveedor al árbol del área que lo va a revisar. Sin esto un
// pedido de tesorería puede colar cambios impositivos que el aprobador de tesorería no
// ve en pantalla y termina aprobando sin querer (y al revés). TESO ve sólo los bancos;
// IMPUESTOS ve todo el resto menos los bancos. Los campos de control (PROTECTED_BP_FIELDS)
// se descartan siempre, igual que en applyModificationPayload.
function _filterPayloadByArea(payload, area) {
  let data = payload;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); }
    catch (e) { throw new Error(`El payload no es JSON válido: ${e.message}`); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('El payload debe ser un objeto con el árbol parcial del BP');

  const clean = {};
  const dropped = [];
  for (const [k, v] of Object.entries(data)) {
    const bDelArea = area === 'TESO' ? (k === 'to_bank_details') : (k !== 'to_bank_details');
    if (!bDelArea || PROTECTED_BP_FIELDS.has(k)) { dropped.push(k); continue; }
    clean[k] = v;
  }
  return { clean, dropped };
}

const BP_ROOT_NAME = 'contratistas';

global._bpUploadTokens = global._bpUploadTokens ?? new Map();
const _bpUploadTokens = global._bpUploadTokens;
const BP_TOKEN_TTL_MS = 5 * 60 * 1000;

module.exports = cds.service.impl(async function () {
  const { attachReadOnlyGuard } = require('./utils/read-only-guard');
  attachReadOnlyGuard(this, ['getUserInfo', 'getBPByDoc', 'me', 'downloadDMScontratistas']);

  // Grupo de autorización: ARG para proveedores nacionales (país AR) y GLOB
  // para exterior. Mantiene consistente la columna con el payload a S4.
  this.before('CREATE', 'BusinessPartners', (req) => {
    const country = req.data.to_addresses?.[0]?.provider_country || "AR";
    req.data.authorization_group = "GLOB";
  });

  this.after('CREATE', 'BusinessPartners', async (data, req) => {
    const { BusinessPartnerDocuments } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    await INSERT.into(ApplicationLogs).entries({
      app: 'BPs CRUD',
      modification: 'INSERT',
      description: `Business Partner created: ${data.provider_name}`,
      ticket_display: data.business_partner_number || 'S/N',
      result: 'SUCCESS'
    });

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'WF_START',
      description: `Approval Workflow triggered automatically for BP: ${data.provider_name}`,
      ticket_display: data.business_partner_number || 'N/A',
      result: 'SUCCESS'
    });

    // === IAS: customAttribute1 = CUIL (proveedor provisorio) ===
    // Matcheamos por el email de contacto del propio formulario (mismo email con el
    // que se invitó a Pedro a IAS vía inviteProviderUser), no por req.user.id: quien
    // hace el POST no siempre es el usuario autenticado que representa al proveedor.
    const providerEmail = (req.data.to_contacts?.[0]?.contact_email || '').toLowerCase();
    // Sólo se quitan separadores de formato (guiones, puntos, espacios): el CUIL de AR
    // queda igual (30-66136987-2 → 30661369872) pero se preservan los identificadores
    // alfanuméricos del exterior (NIF, RUT con dígito K, VAT), que con /\D/g quedaban
    // como string vacío y hacían que se salteara el seteo en IAS.
    const cuil = (req.data.to_tax_numbers?.[0]?.identification_number || '').replace(/[^0-9A-Za-z]/g, '');

    if (providerEmail && cuil) {
      try {
        const { syncProvisionalCuil } = require('./utils/ias-provider-lifecycle');
        const r = await syncProvisionalCuil({ email: providerEmail, cuil });
        await INSERT.into(ApplicationLogs).entries({
          app: 'ABM Contratistas',
          modification: 'IAS_ATTR_CUIL',
          description: `customAttribute1=${cuil} en IAS para "${providerEmail}". ${r.message}`,
          ticket_display: cuil,
          business_partner_ID: data.ID,
          result: r.success ? 'SUCCESS' : 'WARNING'
        });
      } catch (err) {
        console.error('[IAS] Error seteando customAttribute1 (CUIL):', err.message);
      }
    }

    // === SUBIDA DE DOCUMENTOS A DMS ===
    const originalDocs = req.data.documents || [];
    const docsConArchivo = originalDocs.filter(d => d.file && d.file_name);

    if (docsConArchivo.length > 0) {
      const folder_key = data.ID;
      await dmsClient.createFolder(folder_key).catch(() => { });

      for (const doc of docsConArchivo) {
        try {
          const docType = doc.document_type || 'general';
          const docDesc = doc.description || 'sin-descripcion';
          await dmsClient.createFolder(docType, folder_key).catch(() => { });
          await dmsClient.createFolder(docDesc, `${folder_key}/${docType}`).catch(() => { });
          const relativePath = `${folder_key}/${docType}/${docDesc}`;
          await dmsClient.uploadDocument(relativePath, doc.file_name, doc.file);

          await UPDATE(BusinessPartnerDocuments)
            .set({ file_url: `${relativePath}/${doc.file_name}` })
            .where({ business_partner_ID: folder_key, file_name: doc.file_name });

        } catch (err) {
          console.error(`[DMS] Error subiendo '${doc.file_name}':`, err.message);
        }
      }
    }
  });
  this.on('saveDocument', async (req) => {
    const { bp_id, file_name, document_type, description, file_url } = req.data;

    if (!bp_id) return req.error(400, 'bp_id es obligatorio.');
    if (!file_name) return req.error(400, 'file_name es obligatorio.');

    const { BusinessPartners, BusinessPartnerDocuments } = cds.entities("ABMContratistaService");
    const tx = cds.tx(req);

    const bp = await tx.run(SELECT.one.from(BusinessPartners).where({ ID: bp_id }));
    if (!bp) return req.error(404, `Business Partner ${bp_id} no encontrado.`);

    const inserted = await INSERT.into(BusinessPartnerDocuments).entries({
      business_partner_ID: bp_id,
      file_name,
      document_type: document_type ?? null,
      description: description ?? null,
      file_url: file_url ?? null
    });

    return { document_id: inserted.ID ?? null };
  });

  this.on('uploadDMScontratistas', async (req) => {
    const { bp_id, file_name, document_type, description, file_content } = req.data;

    if (!bp_id) return req.error(400, 'bp_id es obligatorio.');
    if (!file_name) return req.error(400, 'file_name es obligatorio.');
    if (!file_content) return req.error(400, 'file_content es obligatorio.');

    if (!REPO_ID)
      return req.error(500, 'DMS_REPOSITORY_ID no está configurado en el entorno.');

    const { BusinessPartners, BusinessPartnerDocuments } = cds.entities("ABMContratistaService");
    const tx = cds.tx(req);

    const bp = await tx.run(SELECT.one.from(BusinessPartners).where({ ID: bp_id }));
    if (!bp) return req.error(404, `Business Partner ${bp_id} no encontrado.`);

    const dmsAxios = sapCfAxios('DMSDest');
    const bpFolder = String(bp_id);

    // description trae acentos ("Personería") y va en el path de la URL. Sin
    // encodear, Node manda el byte en latin1 y DMS no resuelve la carpeta.
    // El nombre crudo sigue viajando en el body CMIS, que es el que define
    // el cmis:name real de la carpeta.
    const segments = [BP_ROOT_NAME, bpFolder];
    const urlPath = (segs) => segs.map(encodeURIComponent).map((s) => `/${s}`).join('');

    const LOG = '[uploadDMScontratistas]';

    try {
      await _ensureDMSFolder(dmsAxios, '', BP_ROOT_NAME);
      await _ensureDMSFolder(dmsAxios, urlPath([BP_ROOT_NAME]), bpFolder);

      if (document_type) {
        await _ensureDMSFolder(dmsAxios, urlPath(segments), document_type);
        segments.push(document_type);

        if (description) {
          await _ensureDMSFolder(dmsAxios, urlPath(segments), description);
          segments.push(description);
        }
      }
    } catch (e) {
      console.error(`${LOG} ✖ FALLÓ creando carpetas`, JSON.stringify({
        status: e.response?.status,
        data: e.response?.data,
        url: e.config?.url,
        segments_ok: segments
      }));
      return req.error(500, `Error al crear las carpetas en DMS: ${e.response?.data?.message || e.message}`);
    }

    const folderPath = urlPath(segments);

    const fileBuffer = Buffer.from(file_content, 'base64');
    const fd = _dmsForm();
    fd.appendText('cmisaction', 'createDocument');
    fd.appendText('propertyId[0]', 'cmis:name');
    fd.appendText('propertyValue[0]', file_name);
    fd.appendText('propertyId[1]', 'cmis:objectTypeId');
    fd.appendText('propertyValue[1]', 'cmis:document');
    fd.appendText('succinct', 'true');
    // El nombre real del documento lo fija cmis:name (arriba). En el filename del
    // Content-Disposition mandamos una versión ASCII: ese header no admite UTF-8
    // sin RFC 5987 y sería otra vía de mojibake.
    fd.append('content', fileBuffer, { filename: _asciiFilename(file_name) });

    const uploadUrl = `/browser/${REPO_ID}/root${folderPath}`;

    // URL del documento por path (para resolver/sobrescribir si ya existe).
    const docObjectUrl = `/browser/${REPO_ID}/root${folderPath}/${encodeURIComponent(file_name)}`;

    let uploadRes;
    try {
      uploadRes = await dmsAxios.post(uploadUrl, fd, { headers: fd.getHeaders() });
    } catch (e) {
      const dmsMsg = e.response?.data?.message || e.message || '';
      // Si el documento ya existe (reintento del envío, o el usuario resubió el
      // archivo), no es un error: sobrescribimos el contenido del documento
      // existente vía CMIS setContent en lugar de fallar por nombre duplicado.
      const alreadyExists = e.response?.status === 409 || /already exists/i.test(dmsMsg);
      if (alreadyExists) {
        try {
          const objRes = await dmsAxios.get(docObjectUrl, {
            params: { cmisselector: 'object', succinct: true }
          });
          const existingId = objRes.data?.succinctProperties?.['cmis:objectId'];
          if (!existingId) throw new Error('No se pudo resolver el objectId del documento existente.');

          const upFd = _dmsForm();
          upFd.appendText('cmisaction', 'setContent');
          upFd.appendText('objectId', existingId);
          upFd.appendText('overwriteFlag', 'true');
          upFd.appendText('succinct', 'true');
          upFd.append('content', fileBuffer, { filename: _asciiFilename(file_name) });

          uploadRes = await dmsAxios.post(docObjectUrl, upFd, { headers: upFd.getHeaders() });
          console.warn(`${LOG} ⚠ '${file_name}' ya existía en DMS → contenido actualizado (setContent)`);
        } catch (e2) {
          console.error(`${LOG} ✖ FALLÓ actualizando documento existente`, JSON.stringify({
            status: e2.response?.status,
            data: e2.response?.data,
            url: e2.config?.url,
            folderPath,
            file_name
          }));
          return req.error(500, `Error al actualizar '${file_name}' en el DMS: ${e2.response?.data?.message || e2.message}`);
        }
      } else {
        console.error(`${LOG} ✖ FALLÓ createDocument`, JSON.stringify({
          status: e.response?.status,
          data: e.response?.data,
          url: e.config?.url,
          folderPath,
          file_name
        }));
        return req.error(500, `Error al subir '${file_name}' al DMS: ${dmsMsg}`);
      }
    }

    const dmsObjectId = uploadRes?.data?.succinctProperties?.['cmis:objectId'] ?? null;
    const fileUrl = [...segments, file_name].join('/');

    // Upsert: si ya hay fila para este BP + archivo + tipo (reintento del envío),
    // actualizamos en lugar de insertar un duplicado.
    const existingRow = await SELECT.one.from(BusinessPartnerDocuments)
      .columns('ID')
      .where({ business_partner_ID: bp_id, file_name, document_type: document_type ?? null });

    if (existingRow) {
      await UPDATE(BusinessPartnerDocuments)
        .set({ description: description ?? null, file_url: fileUrl })
        .where({ ID: existingRow.ID });
      return { document_id: existingRow.ID, dms_object_id: dmsObjectId };
    }

    const inserted = await INSERT.into(BusinessPartnerDocuments).entries({
      business_partner_ID: bp_id,
      file_name,
      document_type: document_type ?? null,
      description: description ?? null,
      file_url: fileUrl
    });

    return { document_id: inserted.ID, dms_object_id: dmsObjectId };
  });

  this.on('downloadDMScontratistas', async (req) => {
    const { bp_id, file_name, document_type, description } = req.data;

    if (!bp_id) return req.error(400, 'bp_id es obligatorio.');
    if (!file_name) return req.error(400, 'file_name es obligatorio.');

    if (!REPO_ID)
      return req.error(500, 'DMS_REPOSITORY_ID no está configurado en el entorno.');

    const { BusinessPartners } = cds.entities("ABMContratistaService");
    const tx = cds.tx(req);

    const bp = await tx.run(SELECT.one.from(BusinessPartners).where({ ID: bp_id }));
    if (!bp) return req.error(404, `Business Partner ${bp_id} no encontrado.`);

    const dmsAxios = sapCfAxios('DMSDest');

    let filePath = `${BP_ROOT_NAME}/${encodeURIComponent(String(bp_id))}`;
    if (document_type) {
      filePath += `/${encodeURIComponent(document_type)}`;
      if (description) filePath += `/${encodeURIComponent(description)}`;
    }
    filePath += `/${encodeURIComponent(file_name)}`;

    try {
      const response = await dmsAxios.get(
        `/browser/${REPO_ID}/root/${filePath}`,
        { params: { cmisselector: 'content' }, responseType: 'arraybuffer' }
      );

      const value = Buffer.from(response.data).toString('base64');
      return { value };

    } catch (e) {
      const status = e.response?.status;
      if (status === 404) return req.error(404, `Archivo '${file_name}' no encontrado en DMS.`);
      return req.error(500, `Error al descargar el archivo: ${e.message}`);
    }
  });

  this.on('deleteDMScontratistas', async (req) => {
    const { bp_id, file_name, document_type, description } = req.data;

    if (!bp_id) return req.error(400, 'bp_id es obligatorio.');
    if (!file_name) return req.error(400, 'file_name es obligatorio.');

    if (!REPO_ID)
      return req.error(500, 'DMS_REPOSITORY_ID no está configurado en el entorno.');

    const { BusinessPartners, BusinessPartnerDocuments } = cds.entities("ABMContratistaService");
    const tx = cds.tx(req);

    const bp = await tx.run(SELECT.one.from(BusinessPartners).where({ ID: bp_id }));
    if (!bp) return req.error(404, `Business Partner ${bp_id} no encontrado.`);

    const dmsAxios = sapCfAxios('DMSDest');
    const LOG = '[deleteDMScontratistas]';

    let filePath = `${BP_ROOT_NAME}/${encodeURIComponent(String(bp_id))}`;
    if (document_type) {
      filePath += `/${encodeURIComponent(document_type)}`;
      if (description) filePath += `/${encodeURIComponent(description)}`;
    }
    filePath += `/${encodeURIComponent(file_name)}`;

    const objectUrl = `/browser/${REPO_ID}/root/${filePath}`;

    try {
      const objectRes = await dmsAxios.get(objectUrl, {
        params: { cmisselector: 'object', succinct: true }
      });
      const objectId = objectRes.data?.succinctProperties?.['cmis:objectId'];
      if (!objectId) return req.error(500, `No se pudo resolver el objeto '${file_name}' en DMS.`);

      const fd = _dmsForm();
      fd.appendText('cmisaction', 'delete');
      fd.appendText('objectId', objectId);
      await dmsAxios.post(objectUrl, fd, { headers: fd.getHeaders() });

    } catch (e) {
      // Si el archivo ya no está en DMS igual borramos la fila: dejarla haría que la UI
      // siga mostrando un documento que no se puede descargar.
      const status = e.response?.status;
      if (status !== 404) {
        console.error(`${LOG} ✖ FALLÓ el borrado en DMS`, JSON.stringify({
          status, data: e.response?.data, url: e.config?.url, filePath
        }));
        return req.error(500, `Error al eliminar '${file_name}' del DMS: ${e.response?.data?.message || e.message}`);
      }
      console.warn(`${LOG} '${file_name}' no está en DMS (404). Se borra igual la fila de BusinessPartnerDocuments.`);
    }

    await tx.run(
      DELETE.from(BusinessPartnerDocuments).where({
        business_partner_ID: bp_id,
        file_name,
        document_type: document_type || null
      })
    );

    return { deleted: true };
  });

  this.on('generateBPUploadToken', async (req) => {
    const { bp_id } = req.data;
    if (!bp_id) return req.error(400, 'bp_id es obligatorio.');

    const { BusinessPartners } = cds.entities("ABMContratistaService");
    const tx = cds.tx(req);
    const bp = await tx.run(SELECT.one.from(BusinessPartners).where({ ID: bp_id }));
    if (!bp) return req.error(404, `Business Partner ${bp_id} no encontrado.`);

    const sToken = require('crypto').randomBytes(32).toString('hex');
    _bpUploadTokens.set(sToken, {
      bp_id,
      user_id: req.user?.id ?? 'system',
      expires: Date.now() + BP_TOKEN_TTL_MS
    });

    for (const [k, v] of _bpUploadTokens.entries()) {
      if (v.expires < Date.now()) _bpUploadTokens.delete(k);
    }

    return { token: sToken, expires_in: BP_TOKEN_TTL_MS / 1000 };
  });

  this.before("READ", "ErrorLogs", async (req) => {
    // Supongamos que en BTP mapeaste el atributo como "bp_id"
    const jwt = req.headers.authorization?.split(' ')[1];
    let payload = {
      "BusinessPartnerCategory": "",
      "OrganizationBPName1": "",
      "BusinessPartnerGrouping": "",
      "CorrespondenceLanguage": "",
      "to_BusinessPartnerAddress": {
        "results": [
          {
            "Country": "",
            "CityName": "",
            "StreetName": "",
            "HouseNumber": "",
            "Language": ""
          }
        ]
      },
      "to_BusinessPartnerRole": {
        "results": [
          {
            "BusinessPartnerRole": [
              ""
            ]
          }
        ]
      }
    }

    await startWorkflow("10001", payload)

  });
  // Helper compartido para no repetir código
  const scimHeaders = {
    "Accept": "application/scim+json",
    "Content-Type": "application/scim+json"
  };

  const handleIASError = (error, req) => {
    if (error.config) {
      const base = error.config.baseURL || '';
      const url = error.config.url || '';
      console.error(`[IAS ERROR]: ${error.config.method?.toUpperCase()} -> ${base}${url}`);
    }
    if (error.response) {
      console.error(`[IAS RESPONSE]:`, JSON.stringify(error.response.data));
    }
    const detail = error.response?.data?.detail || error.message;
    return req.error(500, `Error al contactar con IAS: ${detail}`);
  };

  // ─── addCustomAttribute ───────────────────────────────────────────────────────
  this.on('addCustomAttribute', async (req) => {
    const { email, attributeName, attributeValue } = req.data;

    if (!email || !attributeName || !attributeValue) {
      return req.error(400, '"email", "attributeName" y "attributeValue" son obligatorios.');
    }

    try {
      const axios = sapCfAxios('CAP_IAS_SCIM');

      // 1. Buscar usuario
      const userResponse = await axios({
        method: 'GET',
        url: '/scim/Users',
        params: { filter: `emails.value eq "${email}"` },
        headers: scimHeaders
      });

      const users = userResponse.data?.Resources;
      if (!users?.length) {
        return req.error(404, `Usuario "${email}" no encontrado en IAS.`);
      }
      const userId = users[0].id;

      const patchPayload = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [
          {
            op: "add",                                                              // ✅ "add" según doc oficial
            path: "urn:sap:cloud:scim:schemas:extension:custom:2.0:User:attributes", // ✅ sin el nombre al final
            value: [
              { name: attributeName, value: attributeValue }                       // ✅ array de objetos {name, value}
            ]
          }
        ]
      };

      await axios({
        method: 'PATCH',
        url: `/scim/Users/${userId}`,
        data: patchPayload,
        headers: scimHeaders
      });

      return `Atributo "${attributeName}" actualizado correctamente para "${email}".`;

    } catch (error) {
      return handleIASError(error, req);
    }
  });

  // ─── assignRole ───────────────────────────────────────────────────────────────
  this.on('assignRole', async (req) => {
    const { email, roleName } = req.data;

    if (!email || !roleName) {
      return req.error(400, '"email" y "roleName" son obligatorios.');
    }

    try {
      const axios = sapCfAxios('CAP_IAS_SCIM');

      // 1. Buscar usuario
      const userResponse = await axios({
        method: 'GET',
        url: '/scim/Users',
        params: { filter: `emails.value eq "${email}"` },
        headers: scimHeaders
      });

      const users = userResponse.data?.Resources;
      if (!users?.length) return req.error(404, `Usuario "${email}" no encontrado en IAS.`);
      const userId = users[0].id;

      // 2. Buscar grupo/rol
      const groupResponse = await axios({
        method: 'GET',
        url: '/scim/Groups',
        params: { filter: `displayName eq "${roleName}"` },
        headers: scimHeaders
      });

      const groups = groupResponse.data?.Resources;
      if (!groups?.length) return req.error(404, `Rol "${roleName}" no encontrado en IAS.`);

      const group = groups[0];
      const groupId = group.id;

      // ✅ Verificar si el usuario ya es miembro antes de hacer el PATCH
      const alreadyMember = group.members?.some(m => m.value === userId);
      if (alreadyMember) {
        return `El usuario "${email}" ya tenía asignado el rol "${roleName}".`;
      }

      // 3. Asignar al grupo
      await axios({
        method: 'PATCH',
        url: `/scim/Groups/${groupId}`,
        data: {
          schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
          Operations: [{ op: "add", path: "members", value: [{ value: userId }] }]
        },
        headers: scimHeaders
      });

      return `Rol "${roleName}" asignado correctamente al usuario "${email}".`;

    } catch (error) {
      return handleIASError(error, req);
    }
  });

  this.on("me", async (req) => {
    const u = req.user;

    const KNOWN_ROLES = [
      "Admin",
      "Auditor",
      "Visualizador",
      "Comprador",
      "CoordinadorProveedores",
      "ACAP",
      "CoordinadorACAPPrecertificacion",
      "FiscalizadorPrecertificacion",
      "AprobadorImpuestos",
      "AprobadorLegales",
      "AprobadorTesoreria",
      "ProveedorActivo",
      "ProveedorProvisorio",
      "ProveedorPrecertificacion"
    ];
    const roles = KNOWN_ROLES.filter(r => u.is(r));   // no depende de serializar u.roles

    const sBpId = Array.isArray(u.attr?.bp_id)
      ? (u.attr.bp_id[0] || "")
      : (u.attr?.bp_id || "");

    // TODO TEMP: log de diagnóstico para el issue de ProveedorProvisorio no detectado.
    // Sacar una vez confirmado el origen del problema (attr de token vs role collection).
    console.log("[me() DEBUG] user:", u.id);
    console.log("[me() DEBUG] attr:", JSON.stringify(u.attr));
    console.log("[me() DEBUG] roleCheck:", JSON.stringify(
      Object.fromEntries(KNOWN_ROLES.map(r => [r, u.is(r)]))
    ));
    console.log("[me() DEBUG] raw token scopes:", JSON.stringify(u.tokenInfo?.getPayload?.()?.scope || u.tokenInfo?.payload?.scope || "n/a"));

    return {
      email: (u.id || "").toLowerCase(),
      roles,
      bp_ID: sBpId
    };
  });

  this.on("getBPByDoc", async (req) => {
    try {
      const s4BP = await getS4Service("OP_API_BUSINESS_PARTNER_SRV");

      const { tipoDoc, nroDoc, nombre } = req.data;

      const sTipo = (tipoDoc || "").toLowerCase();
      const esNacional = sTipo === "nacional";
      const esExtranjero = sTipo === "extranjero" || sTipo === "exterior";

      let resultsByDoc = [];
      let resultsByName = [];
      // Proveedores cuyo documento matcheó EXACTO (filtro server-side). Se usa para
      // marcar coincidePorDocumento, incluso cuando el NIF no está en A_Supplier
      // (ej. US01, que solo vive en A_BusinessPartnerTaxNumber).
      const docMatchSuppliers = new Set();

      const _asArray = (raw) => Array.isArray(raw) ? raw : [raw].filter(Boolean);

      // Solo se consulta por documento si el tipo es reconocido (nacional/exterior).
      // Sin esta guarda, un tipoDoc desconocido dejaba la query SIN filtro y S4
      // devolvía TODOS los proveedores.
      if (nroDoc && esNacional) {
        // Nacional → el CUIT vive en A_Supplier.TaxNumber1.
        const rawByDoc = await s4BP.run(
          SELECT.from("OP_API_BUSINESS_PARTNER_SRV.A_Supplier").where({ TaxNumber1: nroDoc })
        );
        resultsByDoc = _asArray(rawByDoc);
        for (const s of resultsByDoc) docMatchSuppliers.add(s.Supplier);
      } else if (nroDoc && esExtranjero) {
        // Exterior → el NIF puede estar en dos lugares:
        //  1) VATRegistration (IVA comunitario, ej. ES0)
        //  2) A_BusinessPartnerTaxNumber (resto de tipos, ej. US01) — los TaxNumberX
        //     de A_Supplier vienen vacíos para el exterior.
        const [byVat, taxRows] = await Promise.all([
          s4BP.run(SELECT.from("OP_API_BUSINESS_PARTNER_SRV.A_Supplier").where({ VATRegistration: nroDoc })),
          s4BP.run(SELECT.from("OP_API_BUSINESS_PARTNER_SRV.A_BusinessPartnerTaxNumber").where({ BPTaxNumber: nroDoc }))
        ]);

        const byVatArr = _asArray(byVat);
        const taxIds = [...new Set(_asArray(taxRows).map(t => t.BusinessPartner).filter(Boolean))];

        let byTaxArr = [];
        if (taxIds.length) {
          const supByTax = await s4BP.run(
            SELECT.from("OP_API_BUSINESS_PARTNER_SRV.A_Supplier").where({ Supplier: { in: taxIds } })
          );
          byTaxArr = _asArray(supByTax);
        }

        resultsByDoc = [...byVatArr, ...byTaxArr];
        for (const s of resultsByDoc) docMatchSuppliers.add(s.Supplier);
      }

      // Proveedor local: se valida sólo por documento.
      // Proveedor exterior: además se busca por nombre (no siempre tiene doc fiable).
      if (esExtranjero && nombre) {
        const queryByName = SELECT
          .from("OP_API_BUSINESS_PARTNER_SRV.A_Supplier")
          .where({ SupplierName: nombre })
          .limit(20);

        const rawByName = await s4BP.run(queryByName);

        resultsByName = _asArray(rawByName);
      }

      const merged = [...resultsByDoc, ...resultsByName];

      const uniqueBySupplier = Array.from(
        new Map(merged.map((bp) => [bp.Supplier, bp])).values()
      );

      const response = uniqueBySupplier.map((bp) => {
        // Coincidencia EXACTA de documento: el proveedor fue encontrado por el filtro
        // server-side (TaxNumber1 para nacional; VATRegistration + BPTaxNumber para exterior).
        const coincidePorDocumento = !!nroDoc && docMatchSuppliers.has(bp.Supplier);

        // Nombre EXACTO (idéntico, respetando mayúsculas y acentos).
        const coincidePorNombre =
          esExtranjero && !!nombre && bp.SupplierName === nombre;

        return {
          ...bp,
          coincidePorDocumento,
          coincidePorNombre,
          pasaValidacion: coincidePorDocumento || coincidePorNombre
        };
      });

      return req.query?.SELECT?.one ? response[0] : response;

    } catch (err) {
      console.error("Error filtrando BP completo:", err);
      console.error("Mensaje:", err.message);
      console.error("Stack:", err.stack);
      console.error("Details:", err.details);

      return req.reject(
        500,
        err.message || "Error al buscar el Business Partner por documento o nombre"
      );
    }
  });

  this.on("submitBPApproval", async (req) => {


    const bp_id = String(req.data?.bp_id || "").trim();
    const s4_payload = req.data?.s4_payload || null;
    const wfState = "PENDIENTE";

    if (!bp_id) {
      return req.reject(400, "bp_id es obligatorio");
    }

    const { BusinessPartners, WorkflowStatus, BPApprovals, Addresses } = cds.entities("ABMContratistaService");

    // Buscar BP
    const bp = await SELECT.one
      .from(BusinessPartners)
      .where({ ID: bp_id });


    if (!bp) {
      return req.reject(
        404,
        `Business Partner ${bp_id} no encontrado`
      );
    }

    // Upsert del workflow status ABM: si ya existe uno para este BP lo reutilizamos
    // (evita duplicados en reintentos / re-altas); si no, lo creamos.
    const existingWf = await SELECT.one
      .from(WorkflowStatus)
      .columns("ID")
      .where({ business_partner_ID: bp_id, application_type: "ABM" });

    const wfId = existingWf?.ID || cds.utils.uuid();

    if (existingWf) {
      await UPDATE(WorkflowStatus)
        .set({
          description: "Pendiente aprobación ABM",
          asigned_user: "",
          status: "PENDIENTE",
          approved_by: null,
          workflow_instance_id: null
        })
        .where({ ID: wfId });
    } else {
      await INSERT.into(WorkflowStatus).entries({
        ID: wfId,
        business_partner_ID: bp_id,
        description: "Pendiente aprobación ABM",
        asigned_user: "",
        status: "PENDIENTE",
        approved_by: null,
        application_type: "ABM"
      });
    }

    // Proveedor exterior: solo legales aprueba. Impuestos y tesorería quedan
    // predeterminadas en aprobado. Se persisten en BPApprovals para que el gate de
    // approveBPTask (que lee esta tabla, no el context_info del workflow) cuente solo
    // con la aprobación legal.
    const bpAddresses = await SELECT.from(Addresses).where({ business_partner_ID: bp_id });
    const isForeign = ((bpAddresses || [])[0]?.provider_country || "AR") !== "AR";
    if (isForeign) {
      await INSERT.into(BPApprovals).entries(
        ["TAX", "TREASURY"].map(area => ({
          business_partner_ID: bp_id,
          area,
          approved: true,
          user_id: "SYSTEM",
          approved_at: new Date(),
          additional_info: "Aprobación predeterminada por proveedor exterior"
        }))
      );
    }

    try {

      const wfData = await startWorkflow(
        bp_id,
        s4_payload,
        wfState
      );

      const instanceId = wfData?.id;

      await UPDATE(WorkflowStatus)
        .set({
          workflow_instance_id: instanceId
        })
        .where({ ID: wfId });


    } catch (err) {


      await UPDATE(WorkflowStatus)
        .set({
          status: "ERROR_WF",
          description: `Error WF: ${err.message}`
        })
        .where({ ID: wfId });

      return req.reject(
        500,
        `Error iniciando workflow: ${err.message}`
      );
    }

    return {
      bp_id,
      workflow_id: wfId,
      status: wfState
    };

  });

  this.on("resubmitBPAfterEdits", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    const sEditSection = String(req.data?.editSection || "").trim(); // banking, tax, legal

    if (!bp_id) {
      return req.reject(400, "bp_id es obligatorio");
    }

    if (!sEditSection) {
      return req.reject(400, "editSection es obligatorio (banking|tax|legal)");
    }

    const { BusinessPartners, WorkflowStatus } = cds.entities("ABMContratistaService");

    const bp = await SELECT.one
      .from(BusinessPartners)
      .where({ ID: bp_id });

    if (!bp) {
      return req.reject(404, `Business Partner ${bp_id} no encontrado`);
    }

    // como info solicitada aunque el proveedor ya respondió.
    const SECTION_FIELDS = {
      banking: { status: "teso_status", info: "teso_additional_info", decision: "teso_decision" },
      tax: { status: "tax_status", info: "tax_additional_info", decision: "tax_decision" },
      legal: { status: "legal_status", info: "legal_additional_info", decision: "legal_decision" }
    };
    const oResetFields = SECTION_FIELDS[sEditSection];
    if (oResetFields) {
      await UPDATE(BusinessPartners)
        .set({ [oResetFields.status]: null, [oResetFields.info]: null, [oResetFields.decision]: null })
        .where({ ID: bp_id });
    }

    try {
      // Construir payload S4 con datos actuales
      const s4Payload = await _buildS4BPPayload(bp_id);

      // Determinar estado inicial según la sección editada
      const wfState = "PENDIENTE";

      // Reenviamos SOLO al aprobador del área que había pedido la información
      // (banking→Tesorería, tax→Impuestos, legal→Legales), no a los 3.
      const SECTION_AREA = { banking: "TREASURY", tax: "TAX", legal: "LEGAL" };
      const targetArea = SECTION_AREA[sEditSection] || null;
      const wfData = await startWorkflow(bp_id, s4Payload, wfState, {}, null, "", targetArea);
      const instanceId = wfData?.id;


      // Actualizar el WorkflowStatus existente (no crear uno nuevo)
      const wfStatus = await SELECT.one
        .from(WorkflowStatus)
        .where({ business_partner_ID: bp_id, application_type: "ABM" });

      if (wfStatus) {
        await UPDATE(WorkflowStatus)
          .set({
            workflow_instance_id: instanceId,
            status: "PENDIENTE",
            description: `Reenviado por proveedor desde edición de ${sEditSection}`
          })
          .where({ ID: wfStatus.ID });

      }

      return {
        bp_id,
        workflow_id: instanceId,
        status: wfState,
        section: sEditSection
      };

    } catch (err) {
      console.error(`[resubmitBPAfterEdits] Error:`, err.message);

      return req.reject(500, `Error reenviando solicitud: ${err.message}`);
    }
  });

  this.on("submitBlockWorkflow", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    const block = req.data?.block ?? true;
    const comments = req.data?.comments || "";
    const action = block ? "BLOQUEO" : "DESBLOQUEO";

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");

    const { BusinessPartners, WorkflowStatus } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    const bp = await SELECT.one.from(BusinessPartners).where({ ID: bp_id });

    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);
    if (!bp.business_partner_number && !bp.lifnr)
      return req.reject(400, `BP ${bp_id} no tiene número S4 asignado`);


    const wfId = cds.utils.uuid();

    await INSERT.into(WorkflowStatus).entries({
      ID: wfId,
      business_partner_ID: bp_id,
      description: `Pendiente ${action} Central Block${comments ? ': ' + comments : ''}`,
      asigned_user: req.user?.id || "",
      status: "PENDIENTE",
      approved_by: null,
      application_type: "BLOCK"
    });

    try {
      const axios = sapCfAxios('SBPA');

      const response = await axios({
        method: 'POST',
        url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
        headers: {
          'irpa-api-key': process.env.IRPA_API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          definitionId: process.env.BLOCK_WORKFLOW_DEFINITION_ID,
          businessKey: bp_id,
          context: {
            // Nombres deben coincidir con los Process Inputs declarados en el WF (context_bp / context_log)
            context_bp: {
              BusinessPartner: bp.business_partner_number || "",
              BusinessPartnerIsBlocked: block
            },
            context_log: {
              business_partner_number: bp.business_partner_number || "",
              comments,
              status: action
            }
          }
        }
      });

      const instanceId = response.data?.id;

      await UPDATE(WorkflowStatus)
        .set({ workflow_instance_id: instanceId })
        .where({ ID: wfId });

    } catch (err) {
      console.error(`[submitBlockWorkflow] Error WF:`, err.message);

      await UPDATE(WorkflowStatus)
        .set({ status: "ERROR_WF", description: `Error WF ${action}: ${err.message}` })
        .where({ ID: wfId });

      return req.reject(500, `Error iniciando workflow ${action}: ${err.message}`);
    }

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: block ? 'BLOCK_START' : 'UNBLOCK_START',
      description: `Workflow Central Block (${action}) iniciado para BP: ${bp.provider_name || bp_id}. ${comments || ''}`,
      ticket_display: bp.business_partner_number || bp_id,
      business_partner_ID: bp_id,
      result: 'SUCCESS'
    });

    return { bp_id, workflow_id: wfId, status: "PENDIENTE" };
  });

  this.on("confirmS4Creation", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    const s4_business_partner = String(req.data?.s4_business_partner || "").trim();
    const lifnr = String(req.data?.lifnr || "").trim();

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");
    if (!s4_business_partner) return req.reject(400, "s4_business_partner es obligatorio");

    const { BusinessPartners, WorkflowStatus, Contacts } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");
    const tx = cds.tx(req);

    const bp = await tx.run(SELECT.one.from(BusinessPartners).where({ ID: bp_id }));
    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);

    await tx.run(
      UPDATE(BusinessPartners)
        .set({
          business_partner_number: s4_business_partner,
          lifnr: lifnr || s4_business_partner
        })
        .where({ ID: bp_id })
    );

    // El BP ya se creó en S4 → siempre finalizamos, incluso si quedó un ERROR_WF
    // de un intento previo (antes ese guard dejaba el status sin setear pese a la creación).
    const _wfPrevFin = await tx.run(SELECT.one.from(WorkflowStatus).columns("status").where({ business_partner_ID: bp_id, application_type: "ABM" }));
    await tx.run(
      UPDATE(WorkflowStatus)
        .set({ status: "FINALIZADO" })
        .where({ business_partner_ID: bp_id, application_type: "ABM" })
    );

    await tx.run(
      INSERT.into(ApplicationLogs).entries({
        app: "ABM Contratistas",
        modification: "S4_CREATED",
        description: `BP creado en S4. BusinessPartner: ${s4_business_partner} | LIFNR: ${lifnr || s4_business_partner}`,
        ticket_display: s4_business_partner,
        business_partner_ID: bp_id,
        result: "SUCCESS"
      })
    );

    // === IAS: customAttribute1 = bp_number + ProveedorProvisorio → ProveedorActivo ===
    // El BP ya impactó en S4: el proveedor pasa de provisorio (customAttribute1=CUIL)
    // a activo (customAttribute1=bp_number real). Se resuelve el email por Contacts,
    // no por req.user, porque quien confirma la creación en S4 no es el proveedor.
    const contact = await tx.run(SELECT.one.from(Contacts).columns('contact_email').where({ business_partner_ID: bp_id }));
    const providerEmail = (contact?.contact_email || '').toLowerCase();
    const bpNumber = s4_business_partner || lifnr;

    if (providerEmail) {
      try {
        const { promoteToActiveProvider } = require('./utils/ias-provider-lifecycle');
        const r = await promoteToActiveProvider({ email: providerEmail, bpNumber });
        await tx.run(
          INSERT.into(ApplicationLogs).entries({
            app: 'ABM Contratistas',
            modification: 'IAS_PROVIDER_ACTIVATED',
            description: `"${providerEmail}" → ProveedorActivo, customAttribute1=${bpNumber}. ${r.message}`,
            ticket_display: bpNumber,
            business_partner_ID: bp_id,
            result: r.success ? 'SUCCESS' : 'WARNING'
          })
        );
      } catch (err) {
        console.error('[IAS] Error promoviendo a ProveedorActivo:', err.message);
      }
    }

    return {
      bp_id,
      s4_business_partner,
      status: "FINALIZADO"
    };
  });

  this.on("approveBPTask", async (req) => {
    try {
      const bp_id = String(req.data?.bp_id || "").trim();
      const decision = String(req.data?.decision || "APROBAR").trim();
      const additionalInfo = String(req.data?.additional_info || "").trim();

      if (!bp_id) return req.reject(400, "bp_id es obligatorio");

      const { BusinessPartners, BPApprovals, WorkflowStatus } = cds.entities("ABMContratistaService");

      // SELECT directo
      const bp = await SELECT.one
        .from(BusinessPartners)
        .where({ ID: bp_id });

      if (!bp) {
        return req.reject(404, `Business Partner ${bp_id} no encontrado`);
      }

      // Determinar área según rol
      let area = null;

      if (req.user.is("AprobadorImpuestos")) {
        area = "TAX";
      } else if (req.user.is("AprobadorLegales")) {
        area = "LEGAL";
      } else if (req.user.is("AprobadorTesoreria")) {
        area = "TREASURY";
      } else {
        return req.reject(403, "El usuario no posee roles válidos de aprobación");
      }

      const isApproved = decision !== "INFO";
      const wfState = "APROBADO";

      // frontend, que en el flujo "solicitar info → re-aprobar" podía no setearlo.
      const AREA_STATUS_FIELD = { TAX: "tax_status", LEGAL: "legal_status", TREASURY: "teso_status" };
      const AREA_STATUS_APPROVED = { TAX: "TAX_APPROVED", LEGAL: "LEGAL_APPROVED", TREASURY: "TESO_APROBADO" };
      const AREA_STATUS_INFO = { TAX: "TAX_INFO_REQUESTED", LEGAL: "LEGAL_INFO_REQUESTED", TREASURY: "TESO_INFO_REQUESTED" };
      const AREA_DECISION_FIELD = { TAX: "tax_decision", LEGAL: "legal_decision", TREASURY: "teso_decision" };
      const AREA_INFO_FIELD = { TAX: "tax_additional_info", LEGAL: "legal_additional_info", TREASURY: "teso_additional_info" };

      // 1. Guardar aprobación (upsert: limpiar filas previas del área para no acumular
      // registros stale tras un ciclo de "solicitar info" (approved=false) → re-aprobar)
      await DELETE.from(BPApprovals).where({ business_partner_ID: bp_id, area });
      await INSERT.into(BPApprovals).entries({
        business_partner_ID: bp_id,
        area,
        approved: isApproved,
        user_id: req.user.id,
        approved_at: new Date(),
        additional_info: additionalInfo || null
      });

      // 1.b Setear el status por área en el BP (fuente de verdad en backend)
      const sAreaStatus = isApproved ? AREA_STATUS_APPROVED[area] : AREA_STATUS_INFO[area];
      await UPDATE(BusinessPartners)
        .set({
          [AREA_STATUS_FIELD[area]]: sAreaStatus,
          [AREA_DECISION_FIELD[area]]: decision,
          [AREA_INFO_FIELD[area]]: isApproved ? null : (additionalInfo || null)
        })
        .where({ ID: bp_id });

      // 2. Actualizar WorkflowStatus
      const areaAbr = area === "TREASURY" ? "TREAS" : area.slice(0, 3);
      const newStatus = isApproved ? `${area}_APPROVED` : `${areaAbr}_INFO`;
      // Una acción de aprobación/solicitud-de-info exitosa supera cualquier ERROR_WF
      // previo (de lo contrario el status quedaba "pegado" en ERROR_WF y nunca finalizaba).
      const _wfPrev = await SELECT.one.from(WorkflowStatus).columns("status").where({ business_partner_ID: bp_id, application_type: "ABM" });
      await UPDATE(WorkflowStatus)
        .set({
          status: newStatus,
          approved_by: req.user.id,
          description: additionalInfo || `Aprobación ${area}`
        })
        .where({
          business_partner_ID: bp_id,
          application_type: "ABM"
        });

      const allApprovals = await SELECT.from(BPApprovals)
        .where({ business_partner_ID: bp_id });

      const taxOk = allApprovals.some(
        a => a.area === "TAX" && !!a.approved
      );

      const legalOk = allApprovals.some(
        a => a.area === "LEGAL" && !!a.approved
      );

      const treasuryOk = allApprovals.some(
        a => a.area === "TREASURY" && !!a.approved
      );

      // 4. Las tres áreas aprobaron
      if (taxOk && legalOk && treasuryOk) {

        try {
          const s4Payload = await _buildS4BPPayload(bp_id);

          const taxApproval = allApprovals.find(a => a.area === "TAX" && a.approved);
          const legalApproval = allApprovals.find(a => a.area === "LEGAL" && a.approved);
          const treasuryApproval = allApprovals.find(a => a.area === "TREASURY" && a.approved);

          await startWorkflow(bp_id, s4Payload, wfState, {
            tax: { approved: true, user: taxApproval.user_id, date: taxApproval.approved_at ?? "" },
            legal: { approved: true, user: legalApproval.user_id, date: legalApproval.approved_at ?? "" },
            treasury: { approved: true, user: treasuryApproval.user_id, date: treasuryApproval.approved_at ?? "" }
          });

          const _wfPrevAprob = await SELECT.one.from(WorkflowStatus).columns("status").where({ business_partner_ID: bp_id, application_type: "ABM" });
          await UPDATE(WorkflowStatus)
            .set({ status: "APROBADO", description: "Las tres áreas aprobaron" })
            .where({ business_partner_ID: bp_id, application_type: "ABM" });

        } catch (wfErr) {
          console.error(`[approveBPTask] Error iniciando workflow final:`, wfErr.message);

          await UPDATE(WorkflowStatus)
            .set({
              status: "ERROR_WF",
              description: `Error WF: ${wfErr.message}`
            })
            .where({
              business_partner_ID: bp_id,
              application_type: "ABM"
            });

          return {
            message: "Aprobación guardada pero error al iniciar workflow"
          };
        }
      } else if (!isApproved) {
        const findApproval = (areaName) => allApprovals.find(x => x.area === areaName && x.approved);
        const currentApprovals = {
          tax: findApproval("TAX")
            ? { approved: true, user: findApproval("TAX").user_id, date: findApproval("TAX").approved_at ?? "" }
            : { approved: false, user: "", date: "" },
          legal: findApproval("LEGAL")
            ? { approved: true, user: findApproval("LEGAL").user_id, date: findApproval("LEGAL").approved_at ?? "" }
            : { approved: false, user: "", date: "" },
          treasury: findApproval("TREASURY")
            ? { approved: true, user: findApproval("TREASURY").user_id, date: findApproval("TREASURY").approved_at ?? "" }
            : { approved: false, user: "", date: "" }
        };
        try {
          await startWorkflow(bp_id, null, "INFO", currentApprovals, area, additionalInfo);
        } catch (wfErr) {
          console.error(`[approveBPTask] Error iniciando workflow INFO:`, wfErr.message);

          await UPDATE(WorkflowStatus)
            .set({
              status: "ERROR_WF",
              description: `Error WF INFO: ${wfErr.message}`
            })
            .where({
              business_partner_ID: bp_id,
              application_type: "ABM"
            });
        }
      }

      return {
        message: isApproved
          ? `${area} aprobado correctamente`
          : `${area} solicitó información adicional`
      };
    } catch (err) {
      console.error(`[approveBPTask] ERROR:`, err.message);
      console.error(`[approveBPTask] Stack:`, err.stack);
      return req.reject(500, `Error en aprobación: ${err.message}`);
    }
  });

  this.on("importBPFromS4", async (req) => {
    const lifnr = String(req.data?.lifnr || "").trim();
    if (!lifnr) return req.reject(400, "lifnr es obligatorio");

    try {
      return await _importBPFromS4(lifnr, cds.tx(req));
    } catch (err) {
      console.error(`[importBPFromS4] ERROR para lifnr=${lifnr}:`, err.message);
      console.error(`[importBPFromS4] Stack:`, err.stack);
      return req.reject(err.statusCode || 500, err.message || "Error al importar Business Partner desde S4");
    }
  });



  this.on("readBPFromS4AsPayload", async (req) => {
    const lifnr = String(req.data?.lifnr || "").trim();
    if (!lifnr) return req.reject(400, "lifnr es obligatorio");

    try {
      return JSON.stringify(await _readBPFromS4AsPayload(lifnr));
    } catch (err) {
      console.error(`[readBPFromS4AsPayload] ERROR para lifnr=${lifnr}:`, err.message);
      return req.reject(err.statusCode || 500, err.message || "Error al leer Business Partner desde S4");
    }
  });

  this.on("importBPsFromS4", async (req) => {
    const lifnrs = Array.isArray(req.data?.lifnrs) ? req.data.lifnrs : [];
    if (!lifnrs.length) return req.reject(400, "lifnrs es obligatorio");

    const imported = [];
    const failed = [];

    for (const raw of lifnrs) {
      const lifnr = String(raw || "").trim();
      if (!lifnr) continue;
      try {
        imported.push(await _importBPFromS4(lifnr, cds.tx(req)));
      } catch (err) {
        console.error(`[importBPsFromS4] ERROR para lifnr=${lifnr}:`, err.message);
        failed.push({ lifnr, error: err.message || "Error desconocido" });
      }
    }

    return { imported, failed };
  });

  this.on("submitTreasuryModification", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    const comments = String(req.data?.comments || "").trim();

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");
    if (!comments) return req.reject(400, "El comentario es obligatorio");

    const { BusinessPartners, WorkflowStatus } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    const bp = await SELECT.one.from(BusinessPartners).where({ ID: bp_id });

    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);
    if (!bp.business_partner_number && !bp.lifnr)
      return req.reject(400, `BP ${bp_id} no tiene número S4 asignado`);


    const wfId = await upsertWorkflowStatus(WorkflowStatus, bp_id, "MODIF_TESORERIA", {
      description: `Pendiente modificación de tesorería${comments ? ': ' + comments : ''}`,
      asigned_user: req.user?.id || "",
      status: "PENDIENTE",
      approved_by: null
    });

    try {
      const wfData = await startTreasuryModificationWorkflow(bp_id, comments, "PENDIENTE");
      const instanceId = wfData?.id;


      await UPDATE(WorkflowStatus)
        .set({ workflow_instance_id: instanceId })
        .where({ ID: wfId });

    } catch (err) {
      console.error(`[submitTreasuryModification] Error WF:`, err.message);

      await UPDATE(WorkflowStatus)
        .set({ status: "ERROR_WF", description: `Error WF modificación tesorería: ${err.message}` })
        .where({ ID: wfId });

      return req.reject(500, `Error iniciando workflow de modificación de tesorería: ${err.message}`);
    }

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TREASURY_MODIF_START',
      description: `Workflow de modificación de tesorería iniciado para BP: ${bp.provider_name || bp_id}. ${comments || ''}`,
      ticket_display: bp.business_partner_number || bp_id,
      business_partner_ID: bp_id,
      result: 'SUCCESS'
    });

    return { bp_id, workflow_id: wfId, status: "PENDIENTE" };
  });

  // Reenvío de la modificación de tesorería desde la edición del proveedor (link
  // modificacion=true del ABM). El proveedor ya actualizó sus datos bancarios (PATCH
  // previo); acá sólo se vuelve a disparar el WF para que vuelva a la cola del aprobador
  // de tesorería. NO lleva comentario ni reenvía mail al proveedor (se actualiza el
  // WorkflowStatus existente, no se crea uno nuevo).
  this.on("resubmitTreasuryModification", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    // enviar_teso = true dispara el correo a Tesorería. Default: true.
    const enviar_teso = req.data?.enviar_teso ?? true;
    const payload = req.data?.payload;

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");

    const { BusinessPartners, WorkflowStatus, BusinessPartnerModifications } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    const bp = await SELECT.one.from(BusinessPartners).where({ ID: bp_id });

    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);
    if (!bp.business_partner_number && !bp.lifnr)
      return req.reject(400, `BP ${bp_id} no tiene número S4 asignado`);

    // Un proveedor no puede reenviar el borrador de otro BP (ver _checkModificationRequestAuth).
    const sAuthError = await _checkModificationRequestAuth(req, bp, { strict: false });
    if (sAuthError) return req.reject(403, sAuthError);

    // Guardar el borrador del proveedor como PENDIENTE (NO se patchea el BP todavía;
    // el patch ocurre en approveTreasuryModification al APROBAR). Upsert: se reemplaza
    // cualquier borrador PENDIENTE previo del área para no acumular filas stale.
    if (payload) {
      await DELETE.from(BusinessPartnerModifications)
        .where({ businessPartner_ID: bp_id, area: "TESO", status: "PENDIENTE" });
      await INSERT.into(BusinessPartnerModifications).entries({
        businessPartner_ID: bp_id,
        area: "TESO",
        status: "PENDIENTE",
        payload: typeof payload === "string" ? payload : JSON.stringify(payload)
      });
    }

    try {
      // Sin comentario → no se arma infoCommentBox; el WF vuelve al aprobador de tesorería.
      // wfState "INFO" → enviar_teso = true → dispara el correo a Tesorería.
      // Si enviar_teso es false, "" deja todas las banderas en false (no manda mail).
      const wfData = await startTreasuryModificationWorkflow(bp_id, "", enviar_teso ? "INFO" : "");
      const instanceId = wfData?.id;


      // Actualizar el WorkflowStatus existente (no crear uno nuevo).
      const wfStatus = await SELECT.one
        .from(WorkflowStatus)
        .where({ business_partner_ID: bp_id, application_type: "MODIF_TESORERIA" });


      if (wfStatus) {
        await UPDATE(WorkflowStatus)
          .set({
            workflow_instance_id: instanceId,
            status: "PENDIENTE",
            description: "Reenviado por el proveedor tras actualizar datos bancarios"
          })
          .where({ ID: wfStatus.ID });

      }

    } catch (err) {
      console.error(`[resubmitTreasuryModification] Error WF:`, err.message);

      await UPDATE(WorkflowStatus)
        .set({ status: "ERROR_WF", description: `Error WF reenvío modificación tesorería: ${err.message}` })
        .where({ business_partner_ID: bp_id, application_type: "MODIF_TESORERIA" });

      return req.reject(500, `Error reenviando workflow de modificación de tesorería: ${err.message}`);
    }

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TREASURY_MODIF_RESUBMIT',
      description: `Modificación de tesorería reenviada por el proveedor para BP: ${bp.provider_name || bp_id}`,
      ticket_display: bp.business_partner_number || bp_id,
      business_partner_ID: bp_id,
      result: 'SUCCESS'
    });

    return { bp_id, workflow_id: bp_id, status: "PENDIENTE" };
  });

  // Aprobación (o pedido de info) de Tesorería sobre una modificación de datos bancarios.
  // Replica el patrón de approveBPTask para el WF de modificación:
  //   APROBAR → WF en estado "APROBADO" (tesoreria_approval.approved = true) → BPA impacta el CBU en S/4 y cierra el WF.
  //   INFO    → WF en estado "PENDIENTE" → vuelve a emailar al proveedor para que corrija los datos.
  this.on("approveTreasuryModification", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    const decision = String(req.data?.decision || "APROBAR").trim();
    const additionalInfo = String(req.data?.additional_info || "").trim();

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");
    if (!req.user.is("AprobadorTesoreria"))
      return req.reject(403, "El usuario no posee rol de aprobador de Tesorería");

    const isApproved = decision !== "INFO";
    if (!isApproved && !additionalInfo)
      return req.reject(400, "Debe indicar la información solicitada al proveedor");

    const { BusinessPartners, WorkflowStatus, BusinessPartnerModifications } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    const bp = await SELECT.one.from(BusinessPartners).where({ ID: bp_id });
    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);
    if (!bp.business_partner_number && !bp.lifnr)
      return req.reject(400, `BP ${bp_id} no tiene número S4 asignado`);

    // Sólo al APROBAR: es la única rama que escribe en S/4, y dos áreas impactando el mismo
    // BP a la vez dan R1/084. Un pedido de info (INFO) sólo manda un mail y no compite.
    if (isApproved) {
      const sLockError = await _checkOtraAreaImpactandoS4(WorkflowStatus, bp_id, "MODIF_TESORERIA");
      if (sLockError) return req.reject(409, sLockError);
    }

    try {
      // STAGING (apply-on-success): NO se aplica el borrador al BP acá. Se lee el PENDIENTE y se
      // pasa al WF para que los context_* empujen a S/4 los datos propuestos. El apply real al BP
      // ocurre en endWorkflowABM (success), único callback que llama el WF; el borrador queda
      // PENDIENTE hasta entonces (y si el WF falla, no se aplica nada → BP nunca queda inconsistente con S/4).
      let pendingPayload = null;
      if (isApproved) {
        const pending = await SELECT.one.from(BusinessPartnerModifications)
          .where({ businessPartner_ID: bp_id, area: "TESO", status: "PENDIENTE" });
        pendingPayload = pending?.payload || null;
      }

      // APROBAR → estado APROBADO (BPA escribe a S4). INFO → PENDIENTE (mail al proveedor).
      const wfState = isApproved ? "APROBADO" : "PENDIENTE";
      const wfData = await startTreasuryModificationWorkflow(bp_id, additionalInfo, wfState, req.user.id, pendingPayload);


      await UPDATE(WorkflowStatus)
        .set({
          workflow_instance_id: wfData?.id,
          status: isApproved ? "APROBADO" : "PENDIENTE",
          approved_by: isApproved ? req.user.id : null,
          description: isApproved
            ? "Modificación de tesorería aprobada"
            : `Información solicitada al proveedor: ${additionalInfo}`
        })
        .where({ business_partner_ID: bp_id, application_type: "MODIF_TESORERIA" });

    } catch (err) {
      console.error(`[approveTreasuryModification] Error WF:`, err.message);

      await UPDATE(WorkflowStatus)
        .set({ status: "ERROR_WF", description: `Error WF aprobación modificación tesorería: ${err.message}` })
        .where({ business_partner_ID: bp_id, application_type: "MODIF_TESORERIA" });

      return req.reject(500, `Error procesando la aprobación de modificación de tesorería: ${err.message}`);
    }

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: isApproved ? 'TREASURY_MODIF_APPROVE' : 'TREASURY_MODIF_INFO',
      description: isApproved
        ? `Modificación de tesorería aprobada para BP: ${bp.provider_name || bp_id}`
        : `Información adicional solicitada al proveedor para BP: ${bp.provider_name || bp_id}`,
      ticket_display: bp.business_partner_number || bp_id,
      business_partner_ID: bp_id,
      result: 'SUCCESS'
    });

    return { message: isApproved ? "Modificación de tesorería aprobada correctamente" : "Información solicitada al proveedor correctamente" };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Modificación de IMPUESTOS (ABM). Mismo patrón que la modificación de
  // tesorería pero para datos impositivos: aprueba el rol AprobadorImpuestos y
  // el WF es abmmodificaciontax, que recibe los datos de S/4 en arrays planos
  // por entidad (context_address, context_supplier, context_witholdingtax, …).
  // ─────────────────────────────────────────────────────────────────────────
  this.on("submitTaxModification", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    const comments = String(req.data?.comments || "").trim();

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");
    if (!comments) return req.reject(400, "El comentario es obligatorio");

    const { BusinessPartners, WorkflowStatus } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    const bp = await SELECT.one.from(BusinessPartners).where({ ID: bp_id });

    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);
    if (!bp.business_partner_number && !bp.lifnr)
      return req.reject(400, `BP ${bp_id} no tiene número S4 asignado`);


    const wfId = await upsertWorkflowStatus(WorkflowStatus, bp_id, "MODIF_IMPUESTOS", {
      description: `Pendiente modificación de impuestos${comments ? ': ' + comments : ''}`,
      asigned_user: req.user?.id || "",
      status: "PENDIENTE",
      approved_by: null
    });

    try {
      const wfData = await startTaxModificationWorkflow(bp_id, comments, "PENDIENTE");
      const instanceId = wfData?.id;


      await UPDATE(WorkflowStatus)
        .set({ workflow_instance_id: instanceId })
        .where({ ID: wfId });

    } catch (err) {
      console.error(`[submitTaxModification] Error WF:`, err.message);

      await UPDATE(WorkflowStatus)
        .set({ status: "ERROR_WF", description: `Error WF modificación impuestos: ${err.message}` })
        .where({ ID: wfId });

      // El INSERT de éxito está fuera del try, así que sin esta fila un fallo sólo
      // quedaba en el description del WorkflowStatus (que además se pisa al reintentar).
      await INSERT.into(ApplicationLogs).entries({
        app: 'ABM Contratistas',
        modification: 'TAX_MODIF_START',
        description: `Error iniciando workflow de modificación de impuestos para BP: ${bp.provider_name || bp_id}: ${err.message}`.slice(0, 500),
        ticket_display: bp.business_partner_number || bp_id,
        business_partner_ID: bp_id,
        result: 'ERROR'
      });

      return req.reject(500, `Error iniciando workflow de modificación de impuestos: ${err.message}`);
    }

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TAX_MODIF_START',
      description: `Workflow de modificación de impuestos iniciado para BP: ${bp.provider_name || bp_id}. ${comments || ''}`,
      ticket_display: bp.business_partner_number || bp_id,
      business_partner_ID: bp_id,
      result: 'SUCCESS'
    });

    return { bp_id, workflow_id: wfId, status: "PENDIENTE" };
  });

  // Reenvío de la modificación de impuestos desde la edición del proveedor (link
  // modificacion=true del ABM). El proveedor ya actualizó sus datos impositivos
  // (PATCH previo); acá sólo se vuelve a disparar el WF para que vuelva a la cola
  // del aprobador de impuestos. NO lleva comentario ni reenvía mail al proveedor
  // (se actualiza el WorkflowStatus existente, no se crea uno nuevo).
  this.on("resubmitTaxModification", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    // enviar_tax = true dispara el correo a Impuestos. Default: true.
    const enviar_tax = req.data?.enviar_tax ?? true;
    const payload = req.data?.payload;

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");

    const { BusinessPartners, WorkflowStatus, BusinessPartnerModifications } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    const bp = await SELECT.one.from(BusinessPartners).where({ ID: bp_id });

    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);
    if (!bp.business_partner_number && !bp.lifnr)
      return req.reject(400, `BP ${bp_id} no tiene número S4 asignado`);

    // Un proveedor no puede reenviar el borrador de otro BP (ver _checkModificationRequestAuth).
    const sAuthError = await _checkModificationRequestAuth(req, bp, { strict: false });
    if (sAuthError) return req.reject(403, sAuthError);

    // Guardar el borrador del proveedor como PENDIENTE (NO se patchea el BP todavía;
    // el patch ocurre en approveTaxModification al APROBAR). Upsert: se reemplaza
    // cualquier borrador PENDIENTE previo del área para no acumular filas stale.
    if (payload) {
      await DELETE.from(BusinessPartnerModifications)
        .where({ businessPartner_ID: bp_id, area: "TAX", status: "PENDIENTE" });
      await INSERT.into(BusinessPartnerModifications).entries({
        businessPartner_ID: bp_id,
        area: "TAX",
        status: "PENDIENTE",
        payload: typeof payload === "string" ? payload : JSON.stringify(payload)
      });
    }

    try {
      // Sin comentario → no se arma infoCommentBox; el WF vuelve al aprobador de impuestos.
      // wfState "INFO" → enviar_tax = true → dispara el correo a Impuestos.
      // Si enviar_tax es false, "" deja todas las banderas en false (no manda mail).
      const wfData = await startTaxModificationWorkflow(bp_id, "", enviar_tax ? "INFO" : "");
      const instanceId = wfData?.id;


      // Actualizar el WorkflowStatus existente (no crear uno nuevo).
      const wfStatus = await SELECT.one
        .from(WorkflowStatus)
        .where({ business_partner_ID: bp_id, application_type: "MODIF_IMPUESTOS" });


      if (wfStatus) {
        await UPDATE(WorkflowStatus)
          .set({
            workflow_instance_id: instanceId,
            status: "PENDIENTE",
            description: "Reenviado por el proveedor tras actualizar datos impositivos"
          })
          .where({ ID: wfStatus.ID });
      }

    } catch (err) {
      console.error(`[resubmitTaxModification] Error WF:`, err.message);

      await UPDATE(WorkflowStatus)
        .set({ status: "ERROR_WF", description: `Error WF reenvío modificación impuestos: ${err.message}` })
        .where({ business_partner_ID: bp_id, application_type: "MODIF_IMPUESTOS" });

      await INSERT.into(ApplicationLogs).entries({
        app: 'ABM Contratistas',
        modification: 'TAX_MODIF_RESUBMIT',
        description: `Error reenviando la modificación de impuestos para BP: ${bp.provider_name || bp_id}: ${err.message}`.slice(0, 500),
        ticket_display: bp.business_partner_number || bp_id,
        business_partner_ID: bp_id,
        result: 'ERROR'
      });

      return req.reject(500, `Error reenviando workflow de modificación de impuestos: ${err.message}`);
    }

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TAX_MODIF_RESUBMIT',
      description: `Modificación de impuestos reenviada por el proveedor para BP: ${bp.provider_name || bp_id}`,
      ticket_display: bp.business_partner_number || bp_id,
      business_partner_ID: bp_id,
      result: 'SUCCESS'
    });

    return { bp_id, workflow_id: bp_id, status: "PENDIENTE" };
  });

  // Aprobación (o pedido de info) de Impuestos sobre una modificación de datos
  // impositivos. Réplica del patrón de approveTreasuryModification:
  //   APROBAR → WF en estado "APROBADO" (tax_approval.approved = true) → BPA impacta los datos en S/4 y cierra el WF.
  //   INFO    → WF en estado "PENDIENTE" → vuelve a emailar al proveedor para que corrija los datos.
  this.on("approveTaxModification", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    const decision = String(req.data?.decision || "APROBAR").trim();
    const additionalInfo = String(req.data?.additional_info || "").trim();

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");
    if (!req.user.is("AprobadorImpuestos"))
      return req.reject(403, "El usuario no posee rol de aprobador de Impuestos");

    const isApproved = decision !== "INFO";
    if (!isApproved && !additionalInfo)
      return req.reject(400, "Debe indicar la información solicitada al proveedor");

    const { BusinessPartners, WorkflowStatus, BusinessPartnerModifications } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    const bp = await SELECT.one.from(BusinessPartners).where({ ID: bp_id });
    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);
    if (!bp.business_partner_number && !bp.lifnr)
      return req.reject(400, `BP ${bp_id} no tiene número S4 asignado`);

    // Sólo al APROBAR: es la única rama que escribe en S/4, y dos áreas impactando el mismo
    // BP a la vez dan R1/084. Un pedido de info (INFO) sólo manda un mail y no compite.
    if (isApproved) {
      const sLockError = await _checkOtraAreaImpactandoS4(WorkflowStatus, bp_id, "MODIF_IMPUESTOS");
      if (sLockError) return req.reject(409, sLockError);
    }

    try {
      let pendingPayload = null;
      if (isApproved) {
        const pending = await SELECT.one.from(BusinessPartnerModifications)
          .where({ businessPartner_ID: bp_id, area: "TAX", status: "PENDIENTE" });

        let merged = {};
        if (pending?.payload) { try { merged = JSON.parse(pending.payload); } catch { merged = {}; } }

        let approverData = req.data?.approver_payload || null;
        if (typeof approverData === "string") { try { approverData = JSON.parse(approverData); } catch { approverData = null; } }
        if (approverData && typeof approverData === "object") Object.assign(merged, approverData);

        if (Object.keys(merged).length) {
          pendingPayload = JSON.stringify(merged);
          if (pending) {
            await UPDATE(BusinessPartnerModifications).set({ payload: pendingPayload }).where({ ID: pending.ID });
          } else {
            await INSERT.into(BusinessPartnerModifications).entries({
              businessPartner_ID: bp_id, area: "TAX", status: "PENDIENTE", payload: pendingPayload
            });
          }
        }
      }

      // APROBAR → estado APROBADO (BPA escribe a S4). INFO → PENDIENTE (mail al proveedor).
      const wfState = isApproved ? "APROBADO" : "PENDIENTE";
      const wfData = await startTaxModificationWorkflow(bp_id, additionalInfo, wfState, req.user.id, pendingPayload);


      await UPDATE(WorkflowStatus)
        .set({
          workflow_instance_id: wfData?.id,
          status: isApproved ? "APROBADO" : "PENDIENTE",
          approved_by: isApproved ? req.user.id : null,
          description: isApproved
            ? "Modificación de impuestos aprobada"
            : `Información solicitada al proveedor: ${additionalInfo}`
        })
        .where({ business_partner_ID: bp_id, application_type: "MODIF_IMPUESTOS" });

    } catch (err) {
      console.error(`[approveTaxModification] Error WF:`, err.message);

      await UPDATE(WorkflowStatus)
        .set({ status: "ERROR_WF", description: `Error WF aprobación modificación impuestos: ${err.message}` })
        .where({ business_partner_ID: bp_id, application_type: "MODIF_IMPUESTOS" });

      // Incluye el caso en que el que falló fue el WF de alta de retenciones, que
      // corre primero y corta antes de que exista instancia del WF de modificación.
      await INSERT.into(ApplicationLogs).entries({
        app: 'ABM Contratistas',
        modification: isApproved ? 'TAX_MODIF_APPROVE' : 'TAX_MODIF_INFO',
        description: `Error procesando la ${isApproved ? 'aprobación' : 'solicitud de información'} de modificación de impuestos para BP: ${bp.provider_name || bp_id}: ${err.message}`.slice(0, 500),
        ticket_display: bp.business_partner_number || bp_id,
        business_partner_ID: bp_id,
        result: 'ERROR'
      });

      return req.reject(500, `Error procesando la aprobación de modificación de impuestos: ${err.message}`);
    }

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: isApproved ? 'TAX_MODIF_APPROVE' : 'TAX_MODIF_INFO',
      description: isApproved
        ? `Modificación de impuestos aprobada para BP: ${bp.provider_name || bp_id}`
        : `Información adicional solicitada al proveedor para BP: ${bp.provider_name || bp_id}`,
      ticket_display: bp.business_partner_number || bp_id,
      business_partner_ID: bp_id,
      result: 'SUCCESS'
    });

    return { message: isApproved ? "Modificación de impuestos aprobada correctamente" : "Información solicitada al proveedor correctamente" };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Pedido de modificación iniciado por el PROVEEDOR (self-service), sin submit
  // interno previo: guarda el borrador y manda el WF DIRECTO al aprobador del área
  // (mismo camino que resubmit*: wfState "INFO" → enviar_teso/enviar_tax = true).
  //
  // El proveedor no escribe comentario: lo que se revisa son los datos propuestos.
  // Si al aprobador le falta algo usa "Solicitar más información" (decision INFO de
  // approve*), que devuelve el pedido al proveedor sin cerrarlo. No hay rechazo.
  // ─────────────────────────────────────────────────────────────────────────
  this.on("submitProviderModification", async (req) => {
    const bp_id = String(req.data?.bp_id || "").trim();
    const area = String(req.data?.area || "").trim().toUpperCase();
    const payload = req.data?.payload;

    if (!bp_id) return req.reject(400, "bp_id es obligatorio");
    const oArea = PROVIDER_MODIF_AREAS[area];
    if (!oArea) return req.reject(400, `area inválida: se espera ${Object.keys(PROVIDER_MODIF_AREAS).join(" o ")}`);
    if (!payload) return req.reject(400, "El pedido no trae cambios (payload vacío)");

    const { BusinessPartners, WorkflowStatus, BusinessPartnerModifications } = cds.entities("ABMContratistaService");
    const { ApplicationLogs } = cds.entities("suppliersInitiative");

    const bp = await SELECT.one.from(BusinessPartners).where({ ID: bp_id });
    if (!bp) return req.reject(404, `Business Partner ${bp_id} no encontrado`);

    // La titularidad se valida con el BP cargado: el bp_id del token es el número de BP
    // (o el CUIT del provisorio), no el GUID que viaja en la request.
    const sAuthError = await _checkModificationRequestAuth(req, bp);
    if (sAuthError) return req.reject(403, sAuthError);

    // Un BP sin número de S/4 todavía está en el alta: sus datos se corrigen por el WF
    // de alta, no por el de modificación (que impacta con PATCH sobre lo que ya existe).
    if (!bp.business_partner_number && !bp.lifnr)
      return req.reject(400, "El proveedor todavía no está creado en S/4: no admite pedidos de modificación");

    // Un pedido en vuelo POR ÁREA. Tesorería e impuestos pueden convivir: mientras esperan
    // revisión el WF sólo manda mails y no toca S/4, así que no se pisan. Lo que no puede
    // solaparse es el impacto de las dos aprobaciones, y eso se corta en approve* con
    // _checkOtraAreaImpactandoS4. Dos pedidos de la MISMA área sí sobran: el WorkflowStatus
    // guarda una sola instancia por área, y el segundo dejaría callbacks huérfanos en
    // endWorkflowABM además de re-emailar al aprobador por lo mismo.
    const inFlight = await SELECT.one.from(WorkflowStatus)
      .columns("status")
      .where({
        business_partner_ID: bp_id,
        application_type: oArea.application_type,
        status: { in: ["PENDIENTE", "APROBADO"] }
      });
    if (inFlight) {
      return req.reject(409, `Ya hay un pedido de modificación de ${oArea.label} en revisión para este proveedor. Espere a que se resuelva antes de enviar uno nuevo.`);
    }

    let filtered;
    try {
      filtered = _filterPayloadByArea(payload, area);
    } catch (e) {
      return req.reject(400, e.message);
    }
    if (!Object.keys(filtered.clean).length)
      return req.reject(400, `El pedido no trae ningún dato que ${oArea.label} pueda modificar`);
    if (filtered.dropped.length)
      console.warn(`[submitProviderModification] BP ${bp_id} área ${area}: campos descartados por no pertenecer al área → ${filtered.dropped.join(", ")}`);

    // Borrador PENDIENTE (NO se patchea el BP: el apply ocurre en endWorkflowABM cuando
    // el WF impacta S/4 con éxito). Reemplaza cualquier PENDIENTE previo del área.
    await DELETE.from(BusinessPartnerModifications)
      .where({ businessPartner_ID: bp_id, area, status: "PENDIENTE" });
    await INSERT.into(BusinessPartnerModifications).entries({
      businessPartner_ID: bp_id,
      area,
      status: "PENDIENTE",
      payload: JSON.stringify(filtered.clean)
    });

    // Si el área venía en ERROR_WF, este pedido nuevo y explícito del proveedor renueva
    // el estado, pero la falla anterior no se pierde en silencio: queda en ApplicationLogs,
    // que es el rastro durable.
    const prevWf = await SELECT.one.from(WorkflowStatus)
      .columns("status", "description")
      .where({ business_partner_ID: bp_id, application_type: oArea.application_type });
    if (prevWf?.status === "ERROR_WF") {
      console.warn(`[submitProviderModification] ⚠ BP ${bp_id}: se reemplaza un ERROR_WF previo de ${oArea.label}`);
      await INSERT.into(ApplicationLogs).entries({
        app: 'ABM Contratistas',
        modification: `${oArea.logPrefix}_MODIF_ERROR_REEMPLAZADO`,
        description: `Nuevo pedido del proveedor sobre un WF de ${oArea.label} en ERROR_WF para BP: ${bp.provider_name || bp_id}. Error anterior: ${prevWf.description || 'sin descripción'}`.slice(0, 500),
        ticket_display: bp.business_partner_number || bp_id,
        business_partner_ID: bp_id,
        result: 'WARNING'
      });
    }

    // Sin este upsert el pedido no existiría para nadie: resubmit* sólo actualiza la fila
    // si ya la había (venía de un submit interno) y acá no hay ninguna, así que el pedido
    // no aparecería en la bandeja del aprobador ni approve* encontraría qué actualizar.
    const wfId = await upsertWorkflowStatus(WorkflowStatus, bp_id, oArea.application_type, {
      description: `Modificación de ${oArea.label} solicitada por el proveedor`,
      asigned_user: req.user?.id || "",
      status: "PENDIENTE",
      approved_by: null
    });

    try {
      // wfState "INFO" → enviar_teso / enviar_tax = true → mail directo al aprobador del
      // área. Sin comentario: el aprobador revisa los datos propuestos, no un texto.
      const startAreaWorkflow = area === "TESO" ? startTreasuryModificationWorkflow : startTaxModificationWorkflow;
      const wfData = await startAreaWorkflow(bp_id, "", "INFO");

      await UPDATE(WorkflowStatus)
        .set({ workflow_instance_id: wfData?.id })
        .where({ ID: wfId });

    } catch (err) {
      console.error(`[submitProviderModification] Error WF (${area}):`, err.message);

      await UPDATE(WorkflowStatus)
        .set({ status: "ERROR_WF", description: `Error WF pedido de modificación de ${oArea.label}: ${err.message}` })
        .where({ ID: wfId });

      await INSERT.into(ApplicationLogs).entries({
        app: 'ABM Contratistas',
        modification: 'PROVIDER_MODIF_REQUEST',
        description: `Error iniciando el pedido de modificación de ${oArea.label} del proveedor para BP: ${bp.provider_name || bp_id}: ${err.message}`.slice(0, 500),
        ticket_display: bp.business_partner_number || bp_id,
        business_partner_ID: bp_id,
        result: 'ERROR'
      });

      return req.reject(500, `Error iniciando el pedido de modificación de ${oArea.label}: ${err.message}`);
    }

    await INSERT.into(ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'PROVIDER_MODIF_REQUEST',
      description: `Pedido de modificación de ${oArea.label} enviado por el proveedor para BP: ${bp.provider_name || bp_id}`,
      ticket_display: bp.business_partner_number || bp_id,
      business_partner_ID: bp_id,
      result: 'SUCCESS'
    });

    return { bp_id, area, workflow_id: wfId, status: "PENDIENTE" };
  });

});

// PROTECTED_BP_FIELDS y applyModificationPayload viven en ./utils/modification
// (compartidos con log-service.js para que el apply del borrador al BP sea idéntico
// en ambos callbacks de fin de workflow).

// Mergea EN MEMORIA una propuesta PENDIENTE del proveedor sobre los datos leídos del BP, SIN
// persistir. Se usa para armar el context_bp a S/4 con los valores propuestos antes de que se
// apliquen realmente (el apply al BP ocurre al confirmar el WF con éxito).
// reads/return: { bp, addresses, banks, taxNumbers, contacts, collEmails } (los que se pasen).
function _mergePendingOverride(oOverride, reads) {
  let data = oOverride;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return { ...reads }; }
  }
  const out = { ...reads };
  if (!data || typeof data !== "object") return out;
  if (out.bp) {
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith("to_") || k === "documents" || k === "status") continue;
      if (PROTECTED_BP_FIELDS.has(k)) continue;
      out.bp[k] = v;
    }
  }
  if (Array.isArray(data.to_addresses)) out.addresses = data.to_addresses;
  if (Array.isArray(data.to_bank_details)) out.banks = data.to_bank_details;
  if (Array.isArray(data.to_tax_numbers)) out.taxNumbers = data.to_tax_numbers;
  if (Array.isArray(data.to_contacts)) out.contacts = data.to_contacts;
  if (Array.isArray(data.to_collections_emails)) out.collEmails = data.to_collections_emails;
  // Retenciones del aprobador (staged junto al borrador del proveedor): también se overridean
  // para que el context_bp a S/4 las lleve sin haberlas persistido todavía en el BP.
  if (Array.isArray(data.to_withholding_taxes)) out.withholdingTaxes = data.to_withholding_taxes;
  return out;
}

// Diagnóstico: lista los hijos reales de una carpeta y loguea cada cmis:name con
// sus bytes UTF-8 en hex, para detectar nombres guardados con mojibake
// ("PersonerÃ­a" en vez de "Personería") cuando DMS lee el multipart como latin1.
async function _logDMSChildren(dmsAxios, parentPath, expectedName) {
  const LOG = '[_logDMSChildren]';
  const hex = (s) => Buffer.from(s, 'utf8').toString('hex');
  // Si el nombre está mojibakeado, releer sus bytes como latin1 y decodificar
  // como UTF-8 devuelve el nombre original.
  const unmojibake = (s) => Buffer.from(s, 'latin1').toString('utf8');

  try {
    const res = await dmsAxios.get(
      `/browser/${REPO_ID}/root${parentPath}`,
      { params: { cmisselector: 'children', succinct: true } }
    );
    const kids = (res.data?.objects || []).map((o) => o.object?.succinctProperties ?? o.succinctProperties ?? {});

    console.error(`${LOG} esperábamos "${expectedName}" (utf8 hex: ${hex(expectedName)})`);
    console.error(`${LOG} hijos reales de "${parentPath}": ${kids.length}`);

    for (const k of kids) {
      const name = k['cmis:name'];
      if (!name) continue;
      const fixed = unmojibake(name);
      console.error(`${LOG}   · name=${JSON.stringify(name)} hex=${hex(name)} id=${k['cmis:objectId']}` +
        (fixed === expectedName ? '  ← MOJIBAKE: es la que buscamos, guardada mal' : ''));
    }
  } catch (e) {
    console.error(`${LOG} ✖ no se pudieron listar los hijos de "${parentPath}"`, JSON.stringify({
      status: e.response?.status,
      data: e.response?.data
    }));
  }
}

// Las partes de texto del multipart van sin Content-Type, y ante esa ausencia DMS
// las decodifica como ISO-8859-1: "Personería" quedaba guardada como "PersonerÃ­a".
// Declarar el charset en la parte hace que lea los bytes como UTF-8.
// El campo _charset_ es la convención del browser binding de CMIS para lo mismo.
// Sólo para el parámetro filename del Content-Disposition, que es un header y no
// tolera bytes no-ASCII. El cmis:name real conserva tildes y símbolos.
function _asciiFilename(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '_');
}

function _dmsForm() {
  const fd = new FormData();
  fd.append('_charset_', 'UTF-8');
  fd.appendText = (name, value) =>
    fd.append(name, String(value), { contentType: 'text/plain; charset=utf-8' });
  return fd;
}

// parentPath llega ya percent-encoded desde el caller: viaja en el path de la URL.
// folderName va crudo en el body CMIS, que es el que define el cmis:name real.
async function _ensureDMSFolder(dmsAxios, parentPath, folderName) {
  const LOG = '[_ensureDMSFolder]';
  const fd = _dmsForm();
  fd.appendText('cmisaction', 'createFolder');
  fd.appendText('propertyId[0]', 'cmis:name');
  fd.appendText('propertyValue[0]', folderName);
  fd.appendText('propertyId[1]', 'cmis:objectTypeId');
  fd.appendText('propertyValue[1]', 'cmis:folder');

  const createUrl = `/browser/${REPO_ID}/root${parentPath}`;

  try {
    const res = await dmsAxios.post(createUrl, fd, { headers: fd.getHeaders() });
    const objectId = res.data.succinctProperties?.['cmis:objectId'];
    return objectId;
  } catch (e) {
    const status = e.response?.status;

    if (status === 409) {
      const fullPath = `${parentPath}/${encodeURIComponent(folderName)}`;
      try {
        const res = await dmsAxios.get(
          `/browser/${REPO_ID}/root${fullPath}`,
          { params: { cmisselector: 'object', succinct: true } }
        );
        const objectId = res.data.succinctProperties?.['cmis:objectId'];
        console.log(`${LOG} resuelta "${folderName}" → objectId=${objectId}`);
        return objectId;
      } catch (getErr) {
        console.error(`${LOG} ✖ GET tras 409 falló`, JSON.stringify({
          status: getErr.response?.status,
          data: getErr.response?.data,
          url: getErr.config?.url,
          fullPath, folderName
        }));

        // DMS dice 409 ("ya existe") pero 404 al buscarla por path: el nombre
        // guardado no coincide byte a byte con el que mandamos. Listamos los
        // hijos reales del padre para ver con qué nombre quedó grabada.
        await _logDMSChildren(dmsAxios, parentPath, folderName);
        throw getErr;
      }
    }

    console.error(`${LOG} ✖ createFolder falló`, JSON.stringify({
      status,
      data: e.response?.data,
      url: e.config?.url,
      createUrl, parentPath, folderName
    }));
    throw e;
  }
}


const _COMPANY_CODES_TAXES = {
  "AR10": ["GA", "J1", "J2", "J4", "J5", "SUSS"],
  "AR11": ["GA", "SUSS"],
  "AR12": ["GA", "SUSS"],
  "AR30": ["GA", "J5"],
  "AR50": ["GA"],
  "AR60": ["GA", "J4", "SUSS"],
  "AR61": ["GA"],
};
const _COMPANY_CODES = Object.keys(_COMPANY_CODES_TAXES);

const S4_CONFIG = {
  authorizationGroup: "ARG",
  supplierAccountGroup: "PROV",
  paymentTerms: "0022",
  calculationSchemaGroup: "01",
  reconciliationAccount: "21120001",
  paymentMethodsList: "B",
  toleranceGroup: "DEUD",
};

function _toODataDate(isoDate) {
  if (!isoDate) return null;
  const ms = new Date(isoDate).getTime();
  return isNaN(ms) ? null : `/Date(${ms})/`;
}

function _fromODataDate(odataDate) {
  if (!odataDate) return null;
  console.log("[_fromODataDate] RAW:", odataDate, "| typeof:", typeof odataDate);
  // Formato OData V2 crudo: /Date(1767225600000)/
  const match = /\/Date\((-?\d+)\)\//.exec(String(odataDate));
  if (match) return new Date(Number(match[1])).toISOString().slice(0, 10);
  // Date / ISO string (lo que ya deserializa el cliente odata-v2 de CAP)
  const d = new Date(odataDate);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function _importBPFromS4(lifnr, tx) {
  const MIGRATED_STATUS = "MIGRADO";
  const { BusinessPartners, WorkflowStatus, BPApprovals } = cds.entities("ABMContratistaService");
  const { ApplicationLogs } = cds.entities("suppliersInitiative");
  const S4 = "OP_API_BUSINESS_PARTNER_SRV";

  const existing = await tx.run(SELECT.one.from(BusinessPartners).where({ lifnr }));
  if (existing) {
    return { bp_id: existing.ID, lifnr, status: "YA_EXISTE" };
  }

  const s4 = await getS4Service(S4);

  const [bp, supplier, withholdingTaxes] = await Promise.all([
    s4.run(SELECT.one.from(`${S4}.A_BusinessPartner`)
      .columns(['*',
        { ref: ['to_BusinessPartnerTax'], expand: ['*'] },
        { ref: ['to_BusinessPartnerBank'], expand: ['*'] },
        {
          ref: ['to_BusinessPartnerAddress'], expand: ['*',
            { ref: ['to_EmailAddress'], expand: ['*'] },
            { ref: ['to_PhoneNumber'], expand: ['*'] }
          ]
        }
      ])
      .where({ BusinessPartner: lifnr })),
    s4.run(SELECT.one.from(`${S4}.A_Supplier`)
      .columns(['*',
        { ref: ['to_SupplierCompany'], expand: ['*'] },
        { ref: ['to_SupplierPurchasingOrg'], expand: ['*'] }
      ])
      .where({ Supplier: lifnr })),
    s4.run(SELECT.from(`${S4}.A_SupplierWithHoldingTax`).where({ Supplier: lifnr }))
  ]);

  if (!bp) {
    const err = new Error(`BP ${lifnr} no existe en S4`);
    err.statusCode = 404;
    throw err;
  }

  // Las colecciones anidadas de S4 pueden venir como array o con envoltorio OData V2
  // { results: [...] }. Normalizamos a array para que .find/.map no rompan.
  const _toArr = (x) => Array.isArray(x) ? x : (Array.isArray(x?.results) ? x.results : []);

  const taxNumbers = _toArr(bp.to_BusinessPartnerTax);
  const addresses = _toArr(bp.to_BusinessPartnerAddress);
  const banks = _toArr(bp.to_BusinessPartnerBank);
  const companies = _toArr(supplier?.to_SupplierCompany);
  const purchOrgs = _toArr(supplier?.to_SupplierPurchasingOrg);
  const addr = addresses[0] || {};
  const emails = _toArr(addr.to_EmailAddress);
  const phones = _toArr(addr.to_PhoneNumber);

  const isHuman = bp.BusinessPartnerCategory === "1";
  const fullName = isHuman ? (bp.LastName || "") : (bp.OrganizationBPName1 || "");
  // Puede venir el mismo email repetido; se toma el marcado como default (o el primero).
  const defaultEmail = emails.find(e => e.IsDefaultEmailAddress) || emails[0] || {};
  const defaultPhone = phones.find(p => p.IsDefaultPhoneNumber) || phones[0] || {};

  // S/4 devuelve los emails como lista plana sin sector. El default va al
  // contacto principal; los no-default se reparten por posición a las colecciones
  // de cobranza: 1° → "Comercial", 2° → "Cobranzas". Se descarta el que coincide
  // con el principal (S/4 puede repetir el mismo email marcado y sin marcar).
  const collectionSectors = ["Comercial", "Cobranzas"];
  const collectionsEmails = emails
    .filter(e => e !== defaultEmail && e.EmailAddress && e.EmailAddress !== defaultEmail.EmailAddress)
    .slice(0, collectionSectors.length)
    .map((e, i) => ({ email: e.EmailAddress, sector: collectionSectors[i] }));
  const firstCompanyCurrency = (companies || [])[0]?.Currency || "";

  // A_SupplierWithHoldingTax viene repetido por CompanyCode y el schema local
  // no distingue por sociedad, así que nos quedamos con las filas de la
  // sociedad principal del proveedor (evita mezclar datos de otra sociedad).
  const primaryCompanyCode = companies[0]?.CompanyCode;
  const whtForCompany = primaryCompanyCode
    ? (withholdingTaxes || []).filter(wt => wt.CompanyCode === primaryCompanyCode)
    : (withholdingTaxes || []);

  const seenWht = new Map();
  for (const wt of whtForCompany) {
    const key = `${wt.WithholdingTaxType}_${wt.WithholdingTaxCode}`;
    if (!seenWht.has(key)) seenWht.set(key, wt);
  }

  const bp_id = cds.utils.uuid();

  const bpEntry = {
    ID: bp_id,
    provider_name: fullName,
    fullname: fullName,
    trade_name: bp.SearchTerm1 || "",
    legal_form: bp.LegalForm || "",
    authorization_group: bp.AuthorizationGroup || "",
    business_partner_number: lifnr,
    lifnr,
    is_human: isHuman,
    supplier_account_group: supplier?.SupplierAccountGroup || "",
    tax_status: "TAX_APPROVED",
    legal_status: "LEGAL_APPROVED",
    teso_status: "TESO_APROBADO",
    tax_decision: "APROBAR",
    legal_decision: "APROBAR",
    teso_decision: "APROBAR",
    to_addresses: addr.AddressID ? [{
      provider_country: addr.Country || "",
      region: addr.Region || "",
      street_name: addr.StreetName || "",
      house_number: addr.HouseNumber || "",
      city: addr.CityName || "",
      postal_code: addr.PostalCode || "",
      floor: addr.Floor || ""
    }] : [],
    to_contacts: (defaultEmail.EmailAddress || defaultPhone.PhoneNumber) ? [{
      contact_email: defaultEmail.EmailAddress || "",
      contact_phone: defaultPhone.PhoneNumber || ""
    }] : [],
    to_collections_emails: collectionsEmails,
    to_tax_numbers: (taxNumbers || []).map(tn => ({
      tax_identification_number: tn.BPTaxType || "",
      identification_number: tn.BPTaxNumber || ""
    })),
    to_bank_details: (banks || []).map(b => ({
      bank_key: b.BankNumber || "",
      bank_country: b.BankCountryKey || "",
      bank_account: b.BankAccount || "",
      bank_stardard_identification: b.BankAccountHolderName || "",
      account_type: b.BankControlKey || "",
      currency: firstCompanyCurrency
    })),
    to_company_data: (companies || []).map(c => ({
      company_code: c.CompanyCode || "",
      currency: c.Currency || "",
      payment_terms: c.PaymentTerms || "",
      blocking_indicator: !!c.SupplierIsBlockedForPosting,
      payment_block: c.PaymentBlockingReason || "",
      reconciliation_account: c.ReconciliationAccount || "",
      tolerance_group: c.APARToleranceGroup || "",
      payment_methods: c.PaymentMethodsList || ""
    })),
    to_purchasing_data: purchOrgs?.[0] ? {
      purchase_org: purchOrgs[0].PurchasingOrganization || "",
      buy_order_currency: purchOrgs[0].PurchaseOrderCurrency || "",
      po_payment_terms: purchOrgs[0].PaymentTerms || "",
      incoterms: purchOrgs[0].IncotermsClassification || "",
      puchase_block: !!purchOrgs[0].PurchasingIsBlockedForSupplier,
      pur_ord_auto_generation: !!purchOrgs[0].PurOrdAutoGenerationIsAllowed
    } : undefined,
    to_withholding_taxes: Array.from(seenWht.values()).map(wt => {
      const exemptFrom = _fromODataDate(wt.ExemptionDateBegin);
      const exemptTo = _fromODataDate(wt.ExemptionDateEnd);
      const exemptRate = wt.WithholdingTaxExmptPercent ? Number(wt.WithholdingTaxExmptPercent) : 0;
      // Exento si viene cargado alguno de estos datos: número, tasa, desde o hasta
      const isExempt = (wt.WithholdingTaxCertificate || exemptRate > 0 || exemptFrom || exemptTo) ? "SI" : "NO";
      return {
        taxes_country: addr.Country || "",
        taxes_type: wt.WithholdingTaxType || "",
        taxes_indicator: wt.WithholdingTaxNumber || "",
        taxes_code: wt.WithholdingTaxCode || "",
        is_subject_to_retention: wt.IsWithholdingTaxSubject ? "SI" : "NO",
        is_exempt: isExempt,
        exemption_number: wt.WithholdingTaxCertificate || "",
        exemption_reason_code: wt.ExemptionReason || "",
        exemption_rate: exemptRate,
        exemption_from: exemptFrom,
        exemption_to: exemptTo
      };
    })
  };

  await tx.run(INSERT.into(BusinessPartners).entries(bpEntry));


  await tx.run(
    INSERT.into(BPApprovals).entries(
      ["TAX", "LEGAL", "TREASURY"].map(area => ({
        business_partner_ID: bp_id,
        area,
        approved: true,
        user_id: "SYSTEM",
        approved_at: new Date(),
        additional_info: "Aprobación automática por migración desde S/4"
      }))
    )
  );

  await tx.run(
    INSERT.into(WorkflowStatus).entries({
      ID: cds.utils.uuid(),
      business_partner_ID: bp_id,
      status: MIGRATED_STATUS,
      description: "BP migrado desde S/4 — áreas aprobadas automáticamente",
      approved_by: "SYSTEM",
      application_type: "ABM_IMPORT"
    })
  );


  await tx.run(
    INSERT.into(ApplicationLogs).entries({
      app: "ABM Contratistas",
      modification: "S4_IMPORT",
      description: `BP importado desde S4. BusinessPartner: ${lifnr} | Nombre: ${fullName}`,
      ticket_display: lifnr,
      business_partner_ID: bp_id,
      result: "SUCCESS"
    })
  );

  return { bp_id, lifnr, status: MIGRATED_STATUS };
}

// Resuelve el BankIdentification REAL de CADA banco propuesto contra los registros de
// S/4. Esa clave (BusinessPartner + BankIdentification) es la que BPA usa para ubicar el
// registro a patchear en el cambio de CBU. BankDetails no la persiste, y hardcodear "0001"
// apunta al registro equivocado cuando el BP fue importado (su banco puede ser 0002+) o
// tiene más de un banco → causa de los "no unívocos" al patchear. Devuelve un array
// alineado 1:1 con `banks` de `{ identification, exists }`, donde `exists` dice si ese
// banco YA está en S/4 (→ PATCH) o hay que POSTearlo (→ startBankCreationWorkflow):
//   - match por BankNumber (el banco no cambia en un cambio de CBU) → identificación real, exists.
//   - banco nuevo (o sin match) → siguiente identificación libre (no colisiona con las de S/4).
//   - 1 solo banco en S/4 y 1 propuesto → esa identificación (se patchea aunque cambie el código).
//   - fallback secuencial 0001.. si no hay supplier / no hay bancos en S/4 / falla la lectura.
//
// Con `requireS4` (se usa al APROBAR, que es cuando BPA escribe) una lectura fallida
// propaga el error en vez de caer al fallback: sin los registros reales no se puede
// decidir alta vs PATCH, y asumir cualquiera de las dos duplica el banco o lo pierde.
async function _resolveS4BankIdentifications(supplier, banks, { requireS4 = false } = {}) {
  const list = banks || [];
  const seqFallback = list.map((_, i) => ({ identification: String(i + 1).padStart(4, "0"), exists: false }));
  if (!list.length) return [];
  if (!supplier) {
    if (requireS4) throw new Error("No se puede resolver la identificación bancaria: el BP todavía no tiene número de proveedor en S/4");
    return seqFallback;
  }

  let s4Banks = [];
  try {
    const S4 = "OP_API_BUSINESS_PARTNER_SRV";
    const s4 = await getS4Service(S4);
    const rows = await s4.run(
      SELECT.from(`${S4}.A_BusinessPartnerBank`)
        .columns("BankIdentification", "BankNumber", "BankAccount")
        .where({ BusinessPartner: supplier })
    );
    s4Banks = Array.isArray(rows) ? rows : (rows ? [rows] : []);
  } catch (err) {
    if (requireS4) throw new Error(`No se pudieron leer los bancos actuales del proveedor ${supplier} en S/4: ${err.message}`);
    console.error(`[_resolveS4BankIdentifications] no se pudo leer bancos de S/4 para ${supplier}: ${err.message}; uso identificaciones secuenciales`);
    return seqFallback;
  }

  // Las dos puntas de la comparación, para poder auditar el split desde el log sin
  // tener que entrar a S/4: si un banco se dio de alta cuando debía patchearse (o al
  // revés), acá se ve exactamente qué se comparó contra qué.
  console.log(`[_resolveS4BankIdentifications] BP ${supplier} — en S/4: ${s4Banks.length ? s4Banks.map(sb => `${sb.BankIdentification}/${sb.BankNumber}-${sb.BankAccount}`).join(", ") : "(ninguno)"}`);
  console.log(`[_resolveS4BankIdentifications] BP ${supplier} — propuestos: ${list.map(b => `${(b.bank_key || "").padStart(3, "0")}-${b.bank_account || ""}`).join(", ")}`);

  // Sin bancos en S/4 no hay nada que patchear: todos los propuestos son altas.
  if (!s4Banks.length) {
    console.log(`[_resolveS4BankIdentifications] BP ${supplier}: no tiene bancos en S/4 → los ${list.length} propuesto(s) van al WF de alta`);
    return seqFallback;
  }

  // 1 banco en S/4 y 1 propuesto → se patchea ese registro aunque haya cambiado el
  // código de banco (mismo criterio best-effort que tenía el helper de un solo banco).
  if (s4Banks.length === 1 && list.length === 1) {
    const id = s4Banks[0].BankIdentification || "0001";
    console.log(`[_resolveS4BankIdentifications] BP ${supplier}: 1 banco en S/4 y 1 propuesto → PATCH sobre BankIdentification=${id} (sin comparar BankNumber)`);
    return [{ identification: id, exists: true }];
  }

  const usedIds = new Set(s4Banks.map(b => b.BankIdentification).filter(Boolean));
  let nextSeq = 1;
  const nextFreeId = () => {
    let id;
    do { id = String(nextSeq++).padStart(4, "0"); } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };

  // Cada registro de S/4 se consume una sola vez (dos bancos propuestos no pueden
  // apuntar a la misma identificación).
  const remaining = [...s4Banks];
  return list.map((b, i) => {
    const bankNumber = (b.bank_key || "").padStart(3, "0");
    const idx = remaining.findIndex(sb => (sb.BankNumber || "") === bankNumber);
    if (idx >= 0) {
      const id = remaining[idx].BankIdentification || nextFreeId();
      console.log(`[_resolveS4BankIdentifications] BP ${supplier}: banco #${i + 1} BankNumber=${bankNumber} matchea S/4 BankIdentification=${id} (cuenta en S/4: ${remaining[idx].BankAccount || "(vacía)"} → propuesta: ${b.bank_account || "(vacía)"}) → PATCH`);
      remaining.splice(idx, 1);
      return { identification: id, exists: true };
    }
    const id = nextFreeId();
    console.warn(`[_resolveS4BankIdentifications] BP ${supplier}: banco #${i + 1} BankNumber=${bankNumber} no matchea ningún registro de S/4 → ALTA con BankIdentification=${id}`);
    return { identification: id, exists: false };
  });
}

// Lee un BP directo de S/4 y lo devuelve con la MISMA forma que el payload que
// _buildS4BPPayload manda al workflow (mismos nombres OData, mismos wrappers
// { results: [...] }), para poder comparar campo a campo lo enviado vs lo creado.
async function _readBPFromS4AsPayload(lifnr) {
  const S4 = "OP_API_BUSINESS_PARTNER_SRV";
  const s4 = await getS4Service(S4);

  const [bp, supplier, withholdingTaxes] = await Promise.all([
    s4.run(SELECT.one.from(`${S4}.A_BusinessPartner`)
      .columns(['*',
        { ref: ['to_BusinessPartnerTax'], expand: ['*'] },
        { ref: ['to_BusinessPartnerBank'], expand: ['*'] },
        { ref: ['to_BusinessPartnerRole'], expand: ['*'] },
        {
          ref: ['to_BusinessPartnerAddress'], expand: ['*',
            { ref: ['to_EmailAddress'], expand: ['*'] },
            { ref: ['to_PhoneNumber'], expand: ['*'] }
          ]
        }
      ])
      .where({ BusinessPartner: lifnr })),
    s4.run(SELECT.one.from(`${S4}.A_Supplier`)
      .columns(['*',
        { ref: ['to_SupplierCompany'], expand: ['*'] },
        { ref: ['to_SupplierPurchasingOrg'], expand: ['*'] }
      ])
      .where({ Supplier: lifnr })),
    s4.run(SELECT.from(`${S4}.A_SupplierWithHoldingTax`).where({ Supplier: lifnr }))
  ]);

  if (!bp) {
    const err = new Error(`BP ${lifnr} no existe en S4`);
    err.statusCode = 404;
    throw err;
  }

  // Las colecciones anidadas pueden venir como array o con envoltorio OData V2.
  const _toArr = (x) => Array.isArray(x) ? x : (Array.isArray(x?.results) ? x.results : []);

  const addresses = _toArr(bp.to_BusinessPartnerAddress);
  const companies = _toArr(supplier?.to_SupplierCompany);
  const purchOrgs = _toArr(supplier?.to_SupplierPurchasingOrg);

  // Retenciones agrupadas por sociedad, igual que to_SupplierCompany en el payload.
  const whtByCompany = {};
  for (const wt of (withholdingTaxes || [])) {
    (whtByCompany[wt.CompanyCode] ||= []).push({
      Supplier: wt.Supplier || "",
      CompanyCode: wt.CompanyCode || "",
      WithholdingTaxType: wt.WithholdingTaxType || "",
      WithholdingTaxCode: wt.WithholdingTaxCode || "",
      IsWithholdingTaxSubject: Boolean(wt.IsWithholdingTaxSubject),
      WithholdingTaxCertificate: wt.WithholdingTaxCertificate || "",
      WithholdingTaxExmptPercent: wt.WithholdingTaxExmptPercent != null ? String(wt.WithholdingTaxExmptPercent) : "0",
      WithholdingTaxNumber: wt.WithholdingTaxNumber || "",
      // Se normalizan al mismo formato /Date(ms)/ que se envía en el alta.
      ExemptionDateBegin: _toODataDate(_fromODataDate(wt.ExemptionDateBegin)) || "",
      ExemptionDateEnd: _toODataDate(_fromODataDate(wt.ExemptionDateEnd)) || "",
      ExemptionReason: wt.ExemptionReason || "",
      RecipientType: wt.RecipientType || "",
      AuthorizationGroup: wt.AuthorizationGroup || ""
    });
  }

  return {
    BusinessPartner: bp.BusinessPartner || "",
    BusinessPartnerCategory: bp.BusinessPartnerCategory || "",
    OrganizationBPName1: bp.OrganizationBPName1 || "",
    FirstName: bp.FirstName || "",
    LastName: bp.LastName || "",
    IsNaturalPerson: bp.IsNaturalPerson || "",
    SearchTerm1: bp.SearchTerm1 || "",
    LegalForm: bp.LegalForm || "",
    AuthorizationGroup: bp.AuthorizationGroup || "",
    BusinessPartnerGrouping: bp.BusinessPartnerGrouping || "",
    CorrespondenceLanguage: bp.CorrespondenceLanguage || "",
    Language: bp.Language || "",
    BusinessPartnerIsBlocked: Boolean(bp.BusinessPartnerIsBlocked),
    IsMarkedForArchiving: Boolean(bp.IsMarkedForArchiving),
    BusinessPartnerIDByExtSystem: bp.BusinessPartnerIDByExtSystem || "",
    to_BusinessPartnerAddress: {
      results: addresses.map(a => ({
        // AddressID + OrdinalNumber son la key con la que S/4 identifica cada
        // dirección y cada mail/teléfono colgando de ella. No se usan para armar el
        // payload de alta (ahí los asigna S/4), pero se exponen en esta lectura
        // porque son los valores que hay que mirar cuando un PATCH devuelve 404:
        // el OrdinalNumber real es NUMC(3) ("001") y no tiene por qué ser correlativo.
        AddressID: a.AddressID || "",
        Country: a.Country || "",
        Region: a.Region || "",
        StreetName: a.StreetName || "",
        HouseNumber: a.HouseNumber || "",
        CityName: a.CityName || "",
        PostalCode: a.PostalCode || "",
        ...(a.Floor ? { Floor: a.Floor } : {}),
        Language: a.Language || "",
        TimeZone: a.AddressTimeZone || "",
        to_AddressEmailAddress: {
          results: _toArr(a.to_EmailAddress).map(e => ({
            AddressID: e.AddressID || a.AddressID || "",
            Person: e.Person || "",
            OrdinalNumber: e.OrdinalNumber || "",
            EmailAddress: e.EmailAddress || "",
            IsDefaultEmailAddress: Boolean(e.IsDefaultEmailAddress)
          }))
        },
        to_AddressPhoneNumber: {
          results: _toArr(a.to_PhoneNumber).map(p => ({
            AddressID: p.AddressID || a.AddressID || "",
            Person: p.Person || "",
            OrdinalNumber: p.OrdinalNumber || "",
            PhoneNumber: p.PhoneNumber || "",
            IsDefaultPhoneNumber: Boolean(p.IsDefaultPhoneNumber)
          }))
        }
      }))
    },
    to_BusinessPartnerRole: {
      results: _toArr(bp.to_BusinessPartnerRole).map(r => ({
        BusinessPartnerRole: r.BusinessPartnerRole || ""
      }))
    },
    to_BusinessPartnerTax: {
      results: _toArr(bp.to_BusinessPartnerTax).map(t => ({
        BPTaxType: t.BPTaxType || "",
        BPTaxNumber: t.BPTaxNumber || ""
      }))
    },
    to_BusinessPartnerBank: {
      results: _toArr(bp.to_BusinessPartnerBank).map(b => ({
        BankIdentification: b.BankIdentification || "",
        BankCountryKey: b.BankCountryKey || "",
        BankNumber: b.BankNumber || "",
        BankName: b.BankName || "",
        BankAccount: b.BankAccount || "",
        BankAccountHolderName: b.BankAccountHolderName || "",
        BankControlKey: b.BankControlKey || ""
      }))
    },
    to_Supplier: supplier ? {
      Supplier: supplier.Supplier || "",
      PostingIsBlocked: Boolean(supplier.PostingIsBlocked),
      DeletionIndicator: Boolean(supplier.DeletionIndicator),
      PurchasingIsBlocked: Boolean(supplier.PurchasingIsBlocked),
      SupplierAccountGroup: supplier.SupplierAccountGroup || "",
      PaymentIsBlockedForSupplier: Boolean(supplier.PaymentIsBlockedForSupplier),
      ResponsibleType: supplier.ResponsibleType || "",
      to_SupplierCompany: {
        results: companies.map(c => ({
          CompanyCode: c.CompanyCode || "",
          Currency: c.Currency || "",
          PaymentTerms: c.PaymentTerms || "",
          DeletionIndicator: Boolean(c.DeletionIndicator),
          APARToleranceGroup: c.APARToleranceGroup || "",
          PaymentMethodsList: c.PaymentMethodsList || "",
          ClearCustomerSupplier: Boolean(c.ClearCustomerSupplier),
          ReconciliationAccount: c.ReconciliationAccount || "",
          IsToBeLocallyProcessed: Boolean(c.IsToBeLocallyProcessed),
          PaymentIsToBeSentByEDI: Boolean(c.PaymentIsToBeSentByEDI),
          ItemIsToBePaidSeparately: Boolean(c.ItemIsToBePaidSeparately),
          IsToBeCheckedForDuplicates: Boolean(c.IsToBeCheckedForDuplicates),
          SupplierIsBlockedForPosting: Boolean(c.SupplierIsBlockedForPosting),
          to_SupplierWithHoldingTax: { results: whtByCompany[c.CompanyCode] || [] }
        }))
      },
      to_SupplierPurchasingOrg: {
        results: purchOrgs.map(p => ({
          PurchasingOrganization: p.PurchasingOrganization || "",
          PaymentTerms: p.PaymentTerms || "",
          PurchaseOrderCurrency: p.PurchaseOrderCurrency || "",
          CalculationSchemaGroupCode: p.CalculationSchemaGroupCode || "",
          InvoiceIsGoodsReceiptBased: Boolean(p.InvoiceIsGoodsReceiptBased),
          PurOrdAutoGenerationIsAllowed: Boolean(p.PurOrdAutoGenerationIsAllowed),
          PurchasingIsBlockedForSupplier: Boolean(p.PurchasingIsBlockedForSupplier)
        }))
      }
    } : null
  };
}

async function _buildS4BPPayload(bp_ID, oOverride) {
  console.log(`[_buildS4BPPayload] Iniciando construcción de payload para BP: ${bp_ID}`);
  const { BusinessPartners, Addresses, BankDetails, TaxNumbers, Contacts, WithholdingTaxes, Banks, BusinessRoles, PaymentMethods, ExemptionReasons, CompanyData, PurchasingData, BusinessPartnerRoles } = cds.entities("ABMContratistaService");
  const { CollectionsEmails, PurchOrg } = cds.entities("suppliersInitiative");

  let [bp, addresses, banks, taxNumbers, contacts, withholdingTaxes, collEmails, allBanks, purchOrgs, bpRoles, paymentMethods, exemptionReasons, companyData, purchasingData, bpRolesOwn] = await Promise.all([
    SELECT.one.from(BusinessPartners).where({ ID: bp_ID }),
    SELECT.from(Addresses).where({ business_partner_ID: bp_ID }),
    SELECT.from(BankDetails).where({ business_partner_ID: bp_ID }),
    SELECT.from(TaxNumbers).where({ business_partner_ID: bp_ID }),
    SELECT.from(Contacts).where({ business_partner_ID: bp_ID }),
    SELECT.from(WithholdingTaxes).where({ business_partner_ID: bp_ID }),
    SELECT.from(CollectionsEmails).where({ business_partner_ID: bp_ID }),
    SELECT.from(Banks),
    SELECT.from(PurchOrg),
    SELECT.from(BusinessRoles),
    SELECT.from(PaymentMethods).where({ country_code: "AR" }).orderBy("pmt_method"),
    SELECT.from(ExemptionReasons),
    // Datos por-BP de sociedad y compras (los llena el import de S/4 y la carga
    // masiva). El payload se arma desde acá; si vienen vacíos, cae al config.
    SELECT.from(CompanyData).where({ business_partner_ID: bp_ID }),
    SELECT.from(PurchasingData).where({ business_partner_ID: bp_ID }),
    SELECT.from(BusinessPartnerRoles).where({ business_partner_ID: bp_ID })
  ]);

  if (oOverride) {
    ({ bp, addresses, banks, taxNumbers, contacts, collEmails, withholdingTaxes } =
      _mergePendingOverride(oOverride, { bp, addresses, banks, taxNumbers, contacts, collEmails, withholdingTaxes }));
  }

  const addr = (addresses || [])[0] || {};
  const contact = (contacts || [])[0] || {};
  const isNational = (addr.provider_country || "AR") === "AR";

  const supplierId = bp?.business_partner_number || bp?.lifnr || "";


  const emailComercial = (collEmails || []).find(e => e.sector === "Comercial") || {};
  const emailCobranzas = (collEmails || []).find(e => e.sector === "Cobranzas") || {};

  const aEmailResults = [{ EmailAddress: contact.contact_email || "", IsDefaultEmailAddress: true }];
  if (emailComercial.email) aEmailResults.push({ EmailAddress: emailComercial.email, IsDefaultEmailAddress: false });
  if (emailCobranzas.email) aEmailResults.push({ EmailAddress: emailCobranzas.email, IsDefaultEmailAddress: false });

  const aBankResults = (banks || []).map((b, i) => {
    const oBankCatalog = (allBanks || []).find(ab => ab.ID === b.bank_key);
    return {
      BankIdentification: String(i + 1).padStart(4, "0"),
      BankCountryKey: b.bank_country || (isNational ? "AR" : ""),
      BankNumber: (b.bank_key || "").padStart(3, "0"),
      BankName: oBankCatalog ? oBankCatalog.name : (b.account_holder || ""),
      BankAccount: b.bank_account || "",
      BankAccountHolderName: b.bank_stardard_identification || "",
      BankControlKey: b.account_type || ""
    };
  });


  const aTaxResults = (taxNumbers || []).map(tn => ({
    BPTaxType: tn.tax_identification_number || "",
    BPTaxNumber: tn.identification_number || ""
  }));


  const currency = (banks && banks[0]) ? (banks[0].currency || "") : "";

  const sPaymentMethodsList = (paymentMethods || [])
    .map(pm => pm.pmt_method)
    .filter(Boolean)
    .join("")
    .slice(0, 10);


  // "SUSS" no es un taxes_type real: agrupa todos los indicadores SX (SC, SE, SL, SV, etc.)
  const _isSussType = (taxesType) => typeof taxesType === "string" && taxesType.startsWith("S");

  // ExemptionReason depende del país (customizing S/4, tabla ExemptionReasons):
  // AR usa "1"; el resto, "01"/"02". Si el BP ya tiene un reason_code válido para
  // su país, se respeta; si no, se toma el primero configurado para ese país.
  const supplierCountry = addr.provider_country || "AR";
  const resolveExemptionReason = (storedCode) => {
    const forCountry = (exemptionReasons || []).filter(r => r.country_code === supplierCountry);
    if (!forCountry.length) return storedCode || "";
    const match = forCountry.find(r => r.reason_code === storedCode);
    return match ? match.reason_code : forCountry[0].reason_code;
  };

  const _buildWithholdingEntry = (wt, companyCode) => {
    // Los datos de exención solo se envían si la línea está marcada como exenta.
    // Si no lo está y se mandan reason/fechas/porcentaje sin certificado, S/4
    // rechaza con LFBW-WT_EXNR ("Introduzca el número del certificado de exención").
    const isExempt = wt.is_exempt === "SI" || wt.is_exempt === true;
    return {
      Supplier: supplierId,
      CompanyCode: companyCode,
      WithholdingTaxType: wt.taxes_type || "",
      WithholdingTaxCode: wt.taxes_code || "",
      IsWithholdingTaxSubject: Boolean(wt.is_subject_to_retention === "SI" || wt.is_subject_to_retention === true),
      WithholdingTaxCertificate: isExempt ? (wt.exemption_number || "") : "",
      WithholdingTaxExmptPercent: isExempt && wt.exemption_rate != null ? String(wt.exemption_rate) : "0",
      WithholdingTaxNumber: (taxNumbers || [])[0]?.tax_identification_number || "",
      // BPA valida estos campos como string (no acepta null): si la línea no está
      // exenta —o la fecha viene vacía— se manda "" en vez de null (S/4 lo ignora).
      ExemptionDateBegin: (isExempt ? _toODataDate(wt.exemption_from) : "") || "",
      ExemptionDateEnd: (isExempt ? _toODataDate(wt.exemption_to) : "") || "",
      ExemptionReason: isExempt ? resolveExemptionReason(wt.exemption_reason_code) : "",

      RecipientType: "",
      AuthorizationGroup: ""
    };
  };

  const buildWithholdingBlock = (companyCode) => {
    return (_COMPANY_CODES_TAXES[companyCode] || [])
      .flatMap(type => {
        if (type === "SUSS") {
          // expandir a todos los indicadores SX cargados para el BP
          return (withholdingTaxes || [])
            .filter(w => _isSussType(w.taxes_type))
            .map(wt => _buildWithholdingEntry(wt, companyCode));
        }
        const wt = (withholdingTaxes || []).find(w => w.taxes_type === type);
        return wt ? [_buildWithholdingEntry(wt, companyCode)] : [];
      });
  };

  // Sociedades del payload: si el BP trae CompanyData (import/carga masiva), se
  // arman desde ahí (cada BP con sus propios company codes y valores); si no,
  // se cae a la lista fija _COMPANY_CODES + S4_CONFIG (alta por UI actual).
  const companyByCode = Object.fromEntries(
    (companyData || []).map(c => [c.company_code, c])
  );
  const aCompanyCodes = (companyData && companyData.length)
    ? companyData.map(c => c.company_code).filter(Boolean)
    : _COMPANY_CODES;

  const aSupplierCompany = aCompanyCodes.map(code => {
    const cd = companyByCode[code] || {};
    return {
      CompanyCode: code,
      Currency: cd.currency || currency,
      PaymentTerms: cd.payment_terms || S4_CONFIG.paymentTerms,
      DeletionIndicator: false,
      APARToleranceGroup: cd.tolerance_group || S4_CONFIG.toleranceGroup,
      PaymentMethodsList: cd.payment_methods || sPaymentMethodsList || S4_CONFIG.paymentMethodsList,
      ClearCustomerSupplier: false,
      ReconciliationAccount: cd.reconciliation_account || S4_CONFIG.reconciliationAccount,
      IsToBeLocallyProcessed: false,
      PaymentIsToBeSentByEDI: false,
      ItemIsToBePaidSeparately: false,
      IsToBeCheckedForDuplicates: true,
      SupplierIsBlockedForPosting: false,
      to_SupplierWithHoldingTax: { results: buildWithholdingBlock(code) }
    };
  });

  // buildWithholdingBlock recorre la lista permitida de cada sociedad, no lo que cargó
  // el proveedor: un tipo que no figure en _COMPANY_CODES_TAXES (p. ej. J6) se descarta
  // sin llegar al payload, y río abajo parece que "el WF de altas no dispara" cuando en
  // realidad la línea nunca se armó. Se avisa para que el descarte no sea silencioso.
  const setTiposEnviados = new Set(
    aSupplierCompany.flatMap(c => (c.to_SupplierWithHoldingTax?.results || []).map(w => w.WithholdingTaxType))
  );
  const aTiposDescartados = [...new Set(
    (withholdingTaxes || []).map(w => w.taxes_type).filter(Boolean)
  )].filter(t => !setTiposEnviados.has(t));

  if (aTiposDescartados.length) {
    console.warn(`[_buildS4BPPayload] ⚠ BP ${bp_ID}: retenciones cargadas que NO se envían porque su tipo no está en _COMPANY_CODES_TAXES para ninguna sociedad del BP: ${aTiposDescartados.join(", ")}. Si corresponden, hay que agregarlas al mapeo por sociedad.`);
  }


  const isHuman = !!bp?.is_human;
  const bpCategory = isHuman ? "1" : "2";
  const legalForm = isHuman ? "" : (bp?.legal_form || "");
  const bpGrouping = bp?.business_partner_grouping || "BPEX";
  const corrLanguage = isNational ? "ES" : "EN";

  const sFullName = bp?.fullname || bp?.provider_name || "";
  const sSearchTerm = (bp?.trade_name || sFullName).substring(0, 20);

  const payload = {
    BusinessPartnerCategory: bpCategory,
    OrganizationBPName1: isHuman ? "" : sFullName,
    FirstName: "",
    LastName: isHuman ? sFullName : "",
    IsNaturalPerson: isHuman ? "X" : "",
    SearchTerm1: sSearchTerm,
    LegalForm: isHuman ? "" : legalForm,
    AuthorizationGroup: bp?.authorization_group || "GLOB",
    BusinessPartnerGrouping: bpGrouping,
    CorrespondenceLanguage: corrLanguage,
    Language: corrLanguage,
    BusinessPartnerIsBlocked: false,
    IsMarkedForArchiving: false,
    BusinessPartnerIDByExtSystem: "",
    to_BusinessPartnerAddress: {
      results: [{
        Country: addr.provider_country || "AR",
        Region: addr.region || "",
        StreetName: addr.street_name || "",
        HouseNumber: addr.house_number || "",
        CityName: addr.city || "",
        PostalCode: addr.postal_code || "",
        ...(addr.floor ? { Floor: addr.floor } : {}),
        Language: corrLanguage,
        TimeZone: "",
        to_AddressEmailAddress: { results: aEmailResults },
        to_AddressPhoneNumber: {
          results: contact.contact_phone
            ? [{ PhoneNumber: contact.contact_phone, IsDefaultPhoneNumber: true }]
            : []
        }
      }]
    },
    // Roles desde la composición del BP (to_roles) si vienen cargados —POST a la
    // entidad / carga masiva—; si no, desde la tabla de config BusinessRoles.
    to_BusinessPartnerRole: {
      results: (bpRolesOwn && bpRolesOwn.length)
        ? bpRolesOwn.map(r => ({ BusinessPartnerRole: r.role })).filter(r => r.BusinessPartnerRole)
        : (bpRoles || []).map(r => ({ BusinessPartnerRole: r.ID }))
    },
    to_BusinessPartnerTax: { results: aTaxResults },
    to_BusinessPartnerBank: { results: aBankResults },
    to_Supplier: {
      PostingIsBlocked: false,
      DeletionIndicator: false,
      PurchasingIsBlocked: false,
      SupplierAccountGroup: bp?.supplier_account_group || S4_CONFIG.supplierAccountGroup,
      PaymentIsBlockedForSupplier: false,
      ResponsibleType: bp?.responsible_type || "",
      to_SupplierCompany: { results: aSupplierCompany },
      // Organizaciones de compra: desde PurchasingData del BP (import/carga
      // masiva) si existen; si no, la lista fija PurchOrg + S4_CONFIG.
      to_SupplierPurchasingOrg: {
        results: (purchasingData && purchasingData.length)
          ? purchasingData.map(p => ({
            PurchasingOrganization: p.purchase_org,
            PaymentTerms: p.po_payment_terms || S4_CONFIG.paymentTerms,
            PurchaseOrderCurrency: p.buy_order_currency || currency || "ARS",
            CalculationSchemaGroupCode: p.calculation_type || S4_CONFIG.calculationSchemaGroup,
            InvoiceIsGoodsReceiptBased: true,
            PurOrdAutoGenerationIsAllowed: p.pur_ord_auto_generation ?? true,
            PurchasingIsBlockedForSupplier: p.puchase_block ?? false
          }))
          : (purchOrgs || []).map(({ ID: org }) => ({
            PurchasingOrganization: org,
            PaymentTerms: S4_CONFIG.paymentTerms,
            PurchaseOrderCurrency: currency || "ARS",
            CalculationSchemaGroupCode: S4_CONFIG.calculationSchemaGroup,
            InvoiceIsGoodsReceiptBased: true,
            PurOrdAutoGenerationIsAllowed: true,
            PurchasingIsBlockedForSupplier: false
          }))
      }
    }
  };

  return payload;
}

async function startWorkflow(bp_ID, s4Payload, wfState, approvals = {}, infoArea = null, infoComment = "", targetApproverArea = null) {
  const { BusinessPartners, Contacts, TaxNumbers, TaxIdentificationTypes, Addresses } = cds.entities("ABMContratistaService");

  try {
    const [bp, contacts, taxNumbers, taxTypes, addresses] = await Promise.all([
      SELECT.one.from(BusinessPartners).where({ ID: bp_ID }),
      SELECT.from(Contacts).where({ business_partner_ID: bp_ID }),
      SELECT.from(TaxNumbers).where({ business_partner_ID: bp_ID }),
      SELECT.from(TaxIdentificationTypes),
      SELECT.from(Addresses).where({ business_partner_ID: bp_ID })
    ]);
    const providerEmail = (contacts || [])[0]?.contact_email || "";

    // Proveedor exterior: solo legales aprueba. Impuestos y tesorería quedan predeterminados en aprobado
    const isForeign = ((addresses || [])[0]?.provider_country || "AR") !== "AR";
    if (isForeign) {
      approvals = {
        ...approvals,
        tax: { approved: true, user: "SYSTEM", date: new Date().toISOString() },
        treasury: { approved: true, user: "SYSTEM", date: new Date().toISOString() }
      };
    }

    const taxEntry = (taxNumbers || [])[0];
    const taxTypeMap = Object.fromEntries((taxTypes || []).map(t => [t.ID, t.description]));
    const taxLabel = taxEntry
      ? `${taxTypeMap[taxEntry.tax_identification_number] || taxEntry.tax_identification_number}: ${taxEntry.identification_number}`
      : "";

    // Recuadro destacado con el comentario del aprobador (sólo si lo escribió).
    // Mismo estilo que el box "Detalle del contratista" del mail de aprobación.
    const infoCommentBox = infoComment
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#D9D2F7;border-radius:6px;overflow:hidden;margin:0 0 16px;"><tr><td style="background:#9380E5;padding:8px 16px;"><p style="margin:0;color:#ffffff;font-size:12px;font-weight:bold;">Comentario del aprobador</p></td></tr><tr><td style="padding:12px 16px;"><p style="margin:0;font-size:13px;color:#3C3489;">${infoComment}</p></td></tr></table>`
      : "";

    const builtPayload = s4Payload || await _buildS4BPPayload(bp_ID);

    const axios = sapCfAxios('SBPA');

    const TEST_APPROVER_LEGAL_EMAILS = (process.env.TEST_APPROVER_LEGAL_EMAIL || "").split(",").map(e => e.trim()).filter(Boolean);
    const TEST_APPROVER_TAX_EMAILS = (process.env.TEST_APPROVER_TAX_EMAIL || "").split(",").map(e => e.trim()).filter(Boolean);
    const TEST_APPROVER_TREASURY_EMAILS = (process.env.TEST_APPROVER_TREASURY_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

    const FLP_BASE_URL = process.env.FLP_BASE_URL;
    const bpUrl = `${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp_ID}&sap-app-origin-hint=saas_approuter`;

    // Destinatarios del mail principal de "Solicitud de aprobación". Los aprobadores
    // de cada área se resuelven por su Role Collection de BTP (getApproverEmailsByArea);
    // los TEST_APPROVER_*_EMAILS quedan como fallback si BTP no devuelve usuarios.
    // - targetApproverArea seteada (reenvío del proveedor tras corregir) → solo esa área.
    // - proveedor exterior → solo Legales (impuestos y tesorería quedan auto-aprobados).
    // - caso normal (alta inicial) → los 3 aprobadores.
    const TEST_FALLBACK_BY_AREA = {
      LEGAL: TEST_APPROVER_LEGAL_EMAILS,
      TAX: TEST_APPROVER_TAX_EMAILS,
      TREASURY: TEST_APPROVER_TREASURY_EMAILS
    };
    let approverEmails;
    if (targetApproverArea && TEST_FALLBACK_BY_AREA[targetApproverArea] !== undefined) {
      approverEmails = await getApproverEmailsByArea(targetApproverArea, TEST_FALLBACK_BY_AREA[targetApproverArea]);
    } else if (isForeign) {
      approverEmails = await getApproverEmailsByArea("LEGAL", TEST_APPROVER_LEGAL_EMAILS);
    } else {
      const [legalEmails, taxEmails, tesoEmails] = await Promise.all([
        getApproverEmailsByArea("LEGAL", TEST_APPROVER_LEGAL_EMAILS),
        getApproverEmailsByArea("TAX", TEST_APPROVER_TAX_EMAILS),
        getApproverEmailsByArea("TREASURY", TEST_APPROVER_TREASURY_EMAILS)
      ]);
      approverEmails = [...legalEmails, ...taxEmails, ...tesoEmails];
    }
    // Dedup por si un mismo aprobador está en más de un área.
    const approverRecipients = [...new Set(approverEmails)].map(address => ({ emailAddress: { address } }));

    const context_bp = {
      ...builtPayload,
      AuthorizationGroup: builtPayload.AuthorizationGroup || "",
      BusinessPartnerIDByExtSystem: builtPayload.BusinessPartnerIDByExtSystem || "",
      to_BusinessPartnerAddress: {
        results: (builtPayload.to_BusinessPartnerAddress?.results || []).map(addr => {
          const { to_AddressEmailAddress, to_AddressPhoneNumber, ...rest } = addr;
          return {
            ...rest,
            CareOfName: "",
            AddressTimeZone: "",
            to_EmailAddress: {
              results: (to_AddressEmailAddress?.results || []).map(e => ({
                ...e,
                AddressCommunicationRemarkText: ""
              }))
            },
            to_PhoneNumber: {
              results: (to_AddressPhoneNumber?.results || []).map(p => ({
                ...p,
                AddressCommunicationRemarkText: ""
              }))
            }
          };
        })
      },
      to_Supplier: {
        ...builtPayload.to_Supplier,
        TaxNumberType: "",
        AuthorizationGroup: "",
        to_SupplierCompany: {
          results: (builtPayload.to_Supplier?.to_SupplierCompany?.results || []).map(c => ({
            ...c,
            AuthorizationGroup: "",
            PaymentBlockingReason: "",
            WithholdingTaxCountry: "",
            Supplier: "",
            to_SupplierWithHoldingTax: {
              results: (c.to_SupplierWithHoldingTax?.results || []).map(wt => {
                const wtObj = {
                  WithholdingTaxCode: wt.WithholdingTaxCode || "",
                  WithholdingTaxType: wt.WithholdingTaxType || "",
                  IsWithholdingTaxSubject: wt.IsWithholdingTaxSubject,
                  WithholdingTaxCertificate: wt.WithholdingTaxCertificate || "",
                  WithholdingTaxExmptPercent: wt.WithholdingTaxExmptPercent || "",
                  WithholdingTaxNumber: wt.WithholdingTaxNumber || "",
                  ExemptionReason: wt.ExemptionReason || ""
                };
                if (wt.ExemptionDateEnd) wtObj.ExemptionDateEnd = wt.ExemptionDateEnd;
                if (wt.ExemptionDateBegin) wtObj.ExemptionDateBegin = wt.ExemptionDateBegin;
                return wtObj;
              })
            }
          }))
        },
        to_SupplierPurchasingOrg: {
          results: (builtPayload.to_Supplier?.to_SupplierPurchasingOrg?.results || []).map(o => ({
            ...o,
            Supplier: "",
            PurchasingGroup: "",
            IncotermsClassification: ""
          }))
        }
      }
    };


    const response = await axios({
      method: 'POST',
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
      headers: {
        'irpa-api-key': process.env.IRPA_API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        definitionId: process.env.ABM_WORKFLOW_DEFINITION_ID,
        businessKey: bp_ID,
        context: {
          bp_id: bp_ID,
          input: {
            status: wfState,
            is_email_sent: wfState === "PENDIENTE"
          },
          send_info: wfState === "INFO",
          context_log: {
            bp_id: bp_ID,
            status: wfState,
            comments: infoComment,
            s4_business_partner: "",
            workflow_instance_id: ""
          },
          // Flags de envío de mail por área cuando se solicita información adicional.
          // En true sólo para el área que pidió info (infoArea); en false no manda mail.
          enviar_tax: infoArea === "TAX",
          enviar_legal: infoArea === "LEGAL",
          enviar_teso: infoArea === "TREASURY",
          context_bp,
          context_info: {
            tax_approval: approvals.tax ?? { approved: false, user: "", date: "" },
            legal_approval: approvals.legal ?? { approved: false, user: "", date: "" },
            tesoreria_approval: approvals.treasury ?? { approved: false, user: "", date: "" }
          },
          mail: wfState !== "PENDIENTE" ? {
            message: {
              subject: "",
              body: { contentType: "", content: "" },
              toRecipients: [],
              saveToSentItems: false
            }
          } : {
            message: {
              subject: `Solicitud de aprobación de Contratista: ${bp?.provider_name || bp_ID}`,
              body: {
                contentType: "HTML",
                content: `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><title>Solicitud de aprobación de Contratista</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
${mailHeader({ badge: `Nueva solicitud`, title: `Aprobación de Contratista`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;">
<p style="margin:0 0 16px;">Hola,</p><p style="margin:0 0 20px;">Le informamos que <strong>le llegó una solicitud de aprobación de contratista</strong> que requiere su revisión.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#D9D2F7;border-radius:6px;overflow:hidden;margin-bottom:20px;">
<tr><td style="background:#9380E5;padding:8px 16px;"><p style="margin:0;color:#ffffff;font-size:12px;font-weight:bold;">Detalle del contratista</p></td></tr>
<tr><td style="padding:12px 16px;"><p style="margin:0 0 4px;font-size:13px;color:#3C3489;"><strong>${taxLabel || 'N° BP: ' + bp_ID}</strong></p>
<p style="margin:0;font-size:13px;color:#3C3489;"><strong>Nombre:</strong> ${bp?.provider_name || ''}</p></td></tr></table>
<p style="margin:0 0 20px;color:#666666;font-size:13px;">Por favor, ingrese al sistema para gestionar esta solicitud.</p>
<p style="margin:0;text-align:center;"><a href="${bpUrl}" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">Ver Contratista</a></p>
</td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;">
<p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p>
</td></tr></table></td></tr></table></body></html>`
              },
              toRecipients: approverRecipients,
              saveToSentItems: false
            }
          },
          tax_mail: {
            message: {
              subject: `Solicitud de información adicional - Impuestos: ${bp?.provider_name || bp_ID}${taxLabel ? ' | ' + taxLabel : ''}`,
              body: {
                contentType: "HTML",
                content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Información adicional - Impuestos</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Solicitud de información`, title: `Información adicional - Impuestos`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Estimado proveedor,</p><p style="margin:0 0 20px;">El aprobador impositivo ha solicitado información adicional para completar el alta de <strong>${bp?.provider_name || bp_ID}</strong>${taxLabel ? ` (${taxLabel})` : ''}.</p>${infoCommentBox}<p style="margin:0 0 20px;color:#666666;font-size:13px;">Por favor, revise los comentarios y vuelva a ingresar al sistema.</p><p style="margin:0;text-align:center;"><a href="${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp_ID}&edit=true&sap-app-origin-hint=saas_approuter&section=tax" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">Editar Información</a></p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
              },
              toRecipients: [
                { emailAddress: { address: providerEmail } }
              ],
              saveToSentItems: false
            }
          },
          legal_mail: {
            message: {
              subject: `Solicitud de información adicional - Legal: ${bp?.provider_name || bp_ID}${taxLabel ? ' | ' + taxLabel : ''}`,
              body: {
                contentType: "HTML",
                content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Información adicional - Legal</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Solicitud de información`, title: `Información adicional - Legal`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Estimado proveedor,</p><p style="margin:0 0 20px;">El aprobador legal ha solicitado información adicional para completar el alta de <strong>${bp?.provider_name || bp_ID}</strong>${taxLabel ? ` (${taxLabel})` : ''}.</p>${infoCommentBox}<p style="margin:0 0 20px;color:#666666;font-size:13px;">Por favor, revise los comentarios y vuelva a ingresar al sistema.</p><p style="margin:0;text-align:center;"><a href="${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp_ID}&edit=true&sap-app-origin-hint=saas_approuter&section=legal" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">Editar Información</a></p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
              },
              toRecipients: [
                { emailAddress: { address: providerEmail } }
              ],
              saveToSentItems: false
            }
          },
          tesoreria_mail: {
            message: {
              subject: `Solicitud de información adicional - Tesorería: ${bp?.provider_name || bp_ID}${taxLabel ? ' | ' + taxLabel : ''}`,
              body: {
                contentType: "HTML",
                content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Información adicional - Tesorería</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Solicitud de información`, title: `Información adicional - Tesorería`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Estimado proveedor,</p><p style="margin:0 0 20px;">El aprobador de tesorería ha solicitado información adicional para completar el alta de <strong>${bp?.provider_name || bp_ID}</strong>${taxLabel ? ` (${taxLabel})` : ''}.</p>${infoCommentBox}<p style="margin:0 0 20px;color:#666666;font-size:13px;">Por favor, revise los comentarios y vuelva a ingresar al sistema.</p><p style="margin:0;text-align:center;"><a href="${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp_ID}&edit=true&sap-app-origin-hint=saas_approuter&section=banking" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">Editar Información Bancaria</a></p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
              },
              toRecipients: [
                { emailAddress: { address: providerEmail } }
              ],
              saveToSentItems: false
            }
          }
        }
      }
    });

    return response.data;

  } catch (error) {
    console.error(`[startWorkflow] ❌ Error — status HTTP: ${error.response?.status}`);
    console.error(`[startWorkflow] BPA response body:`, JSON.stringify(error.response?.data));
    console.error(`[startWorkflow] BPA request url:`, error.config?.url);
    console.error(`[startWorkflow] BPA request body (truncado):`, JSON.stringify(error.config?.data)?.slice(0, 2000));
    throw error;
  }
}

// Alta de bancos NUEVOS. Mismo caso que las retenciones (ver
// startWithholdingTaxCreationWorkflow): el WF de modificación de tesorería impacta los
// bancos con PATCH sobre A_BusinessPartnerBank, y un PATCH no crea el registro que no
// existe. El banco que el proveedor agregó de cero se cae sin error visible, así que va
// por este WF aparte, que lo postea.
//
// Contrato propio: array plano context_bank —con los campos completos de
// A_BusinessPartnerBank, incluidos los que la modificación no manda (IBAN, validez,
// CollectionAuthInd)— más un bloque `log` de trazabilidad y el business_partner.
async function startBankCreationWorkflow(bp_ID, supplier, aBanks) {
  const definitionId = process.env.ABM_ALTABANK_DEFINITION_ID;
  if (!definitionId) {
    throw new Error("Falta la variable ABM_ALTABANK_DEFINITION_ID: no se pueden dar de alta los bancos nuevos");
  }

  // El contrato pide el registro completo. Los campos que el ABM no modela (IBAN,
  // vigencias, autorización de débito, texto de referencia) van vacíos: mandarlos
  // ausentes hace que BPA no encuentre la propiedad al armar el POST.
  const context_bank = aBanks.map(b => {
    const oBank = {
      IBAN: "",
      BankNumber: b.BankNumber || "",
      BankAccount: b.BankAccount || "",
      BankControlKey: b.BankControlKey || "",
      BankCountryKey: b.BankCountryKey || "",
      BankAccountName: b.BankAccountName || "",
      BusinessPartner: supplier,
      ValidityEndDate: b.ValidityEndDate || "",
      CollectionAuthInd: false,
      ValidityStartDate: b.ValidityStartDate || "",
      AuthorizationGroup: "",
      BankIdentification: b.BankIdentification || "",
      BankAccountHolderName: b.BankAccountHolderName || "",
      IBANValidityStartDate: b.IBANValidityStartDate || "",
      BankAccountReferenceText: ""
    };

    // Las tres fechas son Edm.DateTime en A_BusinessPartnerBank y rechazan el "" con
    // "La propiedad ValidityEndDate del decalaje N tiene un valor no válido" (mismo
    // error que daban ExemptionDateBegin/End en el alta de retenciones). El ABM no
    // modela vigencias, así que hoy siempre se omiten; si algún día se cargan, viajan.
    for (const sFecha of ["ValidityStartDate", "ValidityEndDate", "IBANValidityStartDate"]) {
      if (!oBank[sFecha]) delete oBank[sFecha];
    }

    return oBank;
  });

  const axios = sapCfAxios('SBPA');

  const oPayload = {
    definitionId,
    businessKey: bp_ID,
    context: {
      context_bank,
      log: {
        bp_id: bp_ID,
        comments: "",
        s4_business_partner: supplier,
        status: "APROBADO",
        workflow_instance_id: ""
      },
      business_partner: supplier
    }
  };

  console.log(`[startBankCreationWorkflow] 📤 payload a BPA — BP: ${bp_ID} | supplier: ${supplier} | ${context_bank.length} banco(s)`);
  console.log(JSON.stringify(oPayload, null, 2));

  try {
    const response = await axios({
      method: 'POST',
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
      headers: {
        'irpa-api-key': process.env.IRPA_API_KEY,
        'Content-Type': 'application/json'
      },
      data: oPayload
    });

    const aKeys = context_bank.map(b => `${b.BankIdentification}/${b.BankNumber}-${b.BankAccount}`).join(", ");
    console.log(`[startBankCreationWorkflow] ✅ WF iniciado — BP: ${bp_ID} | supplier: ${supplier} | instance: ${response.data?.id} | altas: ${aKeys}`);

    // Este WF es el único que CREA bancos en S/4: sin esta fila una cuenta nueva
    // aparecía en el BP sin rastro de quién ni cuándo. El detalle completo va a
    // new_data (LargeString) porque description es String(500).
    await INSERT.into(cds.entities("suppliersInitiative").ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TESO_BANK_CREATE',
      description: `Alta de ${context_bank.length} banco(s) enviada a S4 para BP ${supplier}. WF Instance: ${response.data?.id || 'N/A'}`,
      new_data: JSON.stringify(context_bank),
      ticket_display: supplier || bp_ID,
      business_partner_ID: bp_ID,
      result: 'SUCCESS'
    });

    return response.data;

  } catch (error) {
    console.error(`[startBankCreationWorkflow] ❌ status HTTP: ${error.response?.status}`);
    console.error(`[startBankCreationWorkflow] BPA response body:`, JSON.stringify(error.response?.data));

    // El alta corre ANTES del WF de modificación y si falla corta el flujo: sin esta
    // fila el intento no queda en ningún lado (el WorkflowStatus lo marca el caller).
    await INSERT.into(cds.entities("suppliersInitiative").ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TESO_BANK_CREATE',
      description: `Error dando de alta ${context_bank.length} banco(s) en S4 para BP ${supplier}: ${error.message}`.slice(0, 500),
      new_data: JSON.stringify({ bancos: context_bank, bpa_response: error.response?.data }),
      ticket_display: supplier || bp_ID,
      business_partner_ID: bp_ID,
      result: 'ERROR'
    });

    throw error;
  }
}

// Workflow de modificación de tesorería (ABM). Solo reenvía datos bancarios y de
// supplier company; reutiliza el mapeo de bancos de _buildS4BPPayload.
async function startTreasuryModificationWorkflow(bp_ID, comments = "", wfState = "PENDIENTE", approverId = "", oOverride = null) {
  const { BusinessPartners, BankDetails, Banks, CompanyData, Addresses, Contacts } = cds.entities("ABMContratistaService");

  let [bp, banks, allBanks, companyData, addresses, contacts] = await Promise.all([
    SELECT.one.from(BusinessPartners).where({ ID: bp_ID }),
    SELECT.from(BankDetails).where({ business_partner_ID: bp_ID }),
    SELECT.from(Banks),
    SELECT.from(CompanyData).where({ business_partner_ID: bp_ID }),
    SELECT.from(Addresses).where({ business_partner_ID: bp_ID }),
    SELECT.from(Contacts).where({ business_partner_ID: bp_ID })
  ]);

  if (!bp) throw new Error(`Business Partner ${bp_ID} no encontrado`);
  // oOverride = propuesta PENDIENTE del proveedor: se mergea en memoria para que el context_bp
  // (CBU/datos bancarios) a S/4 lleve los valores propuestos sin persistirlos todavía.
  if (oOverride) {
    ({ bp, banks, addresses, contacts } =
      _mergePendingOverride(oOverride, { bp, banks, addresses, contacts }));
  }

  const supplier = bp.business_partner_number || bp.lifnr || "";
  const isNational = (((addresses || [])[0]?.provider_country) || "AR") === "AR";
  const providerEmail = (contacts || [])[0]?.contact_email || "";

  // Emails de los aprobadores de tesorería: se resuelven desde la Role Collection
  // de BTP (igual que el alta), con las TEST_APPROVER_TREASURY_EMAILS como fallback.
  const TEST_APPROVER_TREASURY_EMAILS = (process.env.TEST_APPROVER_TREASURY_EMAILS || "")
    .split(",").map(e => e.trim()).filter(Boolean);
  const treasuryApproverEmails = await getApproverEmailsByArea("TREASURY", TEST_APPROVER_TREASURY_EMAILS);
  const treasuryApproverRecipients = [...new Set(treasuryApproverEmails)].map(address => ({ emailAddress: { address } }));

  // Recuadro con el comentario que escribió el usuario al solicitar el cambio de CBU
  // (sólo si lo cargó). Mismo estilo que el box "Comentario del aprobador" del alta.
  const infoCommentBox = comments
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#D9D2F7;border-radius:6px;overflow:hidden;margin:0 0 16px;"><tr><td style="background:#9380E5;padding:8px 16px;"><p style="margin:0;color:#ffffff;font-size:12px;font-weight:bold;">Comentario</p></td></tr><tr><td style="padding:12px 16px;"><p style="margin:0;font-size:13px;color:#3C3489;">${comments}</p></td></tr></table>`
    : "";

  const FLP_BASE_URL = process.env.FLP_BASE_URL;

  // La definición del WF de tesorería declara context_bp como ARRAY (no objeto):
  // mandarlo como objeto devuelve 422 SAP_IPA_12094 desde BPA. Se envían todos los
  // bancos ya existentes (no solo el primero), cada uno con su BankIdentification real
  // de S/4 (no hardcodear "0001": rompe el PATCH cuando el banco del BP no es el 0001).
  //
  // Este WF impacta los bancos con PATCH, así que sólo puede tocar los que ya existen
  // en S/4: los que el proveedor agregó de cero hay que POSTearlos con el WF de alta
  // (startBankCreationWorkflow). Se separan recién al aprobar, que es cuando BPA
  // escribe en S/4 (en PENDIENTE/INFO el WF sólo manda mails y no vale pagar —ni
  // hacer fallar por— la lectura a S/4).
  const bSplitBancos = wfState === "APROBADO" && Boolean(supplier);
  const aResolved = await _resolveS4BankIdentifications(supplier, banks, { requireS4: bSplitBancos });

  const aBanksPayload = (banks || []).map((b, i) => {
    const oBankCatalog = (allBanks || []).find(ab => ab.ID === b.bank_key);
    return {
      BankNumber: (b.bank_key || "").padStart(3, "0"),
      BankAccount: b.bank_account || "",
      BankCountryKey: b.bank_country || (isNational ? "AR" : ""),
      BankIdentification: aResolved[i]?.identification || "",
      BankAccountHolderName: b.bank_stardard_identification || "",
      BankControlKey: b.account_type || "",
      BankAccountName: oBankCatalog ? oBankCatalog.name : (b.account_holder || "")
    };
  });

  const context_bp = bSplitBancos ? aBanksPayload.filter((_, i) => aResolved[i]?.exists) : aBanksPayload;
  const aBanksToCreate = bSplitBancos ? aBanksPayload.filter((_, i) => !aResolved[i]?.exists) : [];

  if (bSplitBancos) {
    const _fmt = (a) => a.length ? a.map(b => `${b.BankIdentification}/${b.BankNumber}-${b.BankAccount}`).join(", ") : "(ninguno)";
    console.log(`[startTreasuryModificationWorkflow] bancos — propuestos: ${aBanksPayload.length} | PATCH: ${_fmt(context_bp)} | ALTA: ${_fmt(aBanksToCreate)}`);
  } else {
    // Sin este aviso, "el WF de alta no dispara" en PENDIENTE/INFO parece un bug y es
    // el diseño: el split y el alta sólo corren al APROBAR, que es cuando BPA escribe.
    console.log(`[startTreasuryModificationWorkflow] estado ${wfState || "(vacío)"} → no se evalúan altas de bancos (sólo se hace en APROBADO)`);
  }

  // Currency de referencia: la del primer banco cargado.
  const currency = (banks && banks[0]) ? (banks[0].currency || "") : "";

  const aCompanyCodes = (companyData && companyData.length)
    ? companyData.map(c => ({ code: c.company_code, currency: c.currency || currency }))
    : _COMPANY_CODES.map(code => ({ code, currency }));

  const firstCompany = aCompanyCodes[0];
  const context_supplierc = firstCompany ? {
    Supplier: supplier,
    CompanyCode: firstCompany.code,
    Currency: firstCompany.currency
  } : {};

  const context = {
    bp_id: bp_ID,
    input: {
      status: wfState === "APROBADO" ? "APROBADO" : "PENDING",
      is_email_sent: wfState === "PENDIENTE"
    },
    mail: {
      message: {
        subject: `Solicitud de cambio de CBU - ${bp.provider_name || supplier}`,
        body: {
          contentType: "HTML",
          content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cambio de CBU</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Modificación de datos`, title: `Cambio de CBU`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Estimado proveedor,</p><p style="margin:0 0 20px;">Se ha iniciado una solicitud de cambio de CBU / datos bancarios para <strong>${bp.provider_name || supplier}</strong>.</p>${infoCommentBox}<p style="margin:0 0 20px;color:#666666;font-size:13px;">Por favor, revise la información y actualice sus datos bancarios ingresando al sistema.</p><p style="margin:0;text-align:center;"><a href="${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp_ID}&edit=true&sap-app-origin-hint=saas_approuter&section=banking&modificacion=true" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">Editar Información Bancaria</a></p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
        },
        toRecipients: [{ emailAddress: { address: providerEmail } }],
        saveToSentItems: false
      }
    },
    context_bp,
    context_info: {
      tesoreria_approval: wfState === "APROBADO"
        ? { approved: true, user: approverId, date: new Date().toISOString() }
        : { approved: false, user: "", date: "" }
    },
    tesoreria_mail: {
      message: {
        subject: `Modificación de datos de tesorería - ${bp.provider_name || supplier}`,
        body: {
          contentType: "HTML",
          content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Revisión de modificación - Tesorería</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Revisión requerida`, title: `Modificación de tesorería`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Hola,</p><p style="margin:0 0 20px;">Se solicita la revisión y aprobación de la modificación de datos de tesorería para <strong>${bp.provider_name || supplier}</strong>.</p><p style="margin:0;text-align:center;"><a href="${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp_ID}&edit=false&sap-app-origin-hint=saas_approuter&section=banking&modificacion=false" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">Revisar Modificación</a></p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
        },
        toRecipients: treasuryApproverRecipients,
        saveToSentItems: false
      }
    },
    // Banderas dinámicas según el estado del WF (mismo criterio que startWorkflow):
    //   PENDIENTE → mail al proveedor (cargar CBU); is_email_sent = true.
    //   INFO      → mail a Tesorería (revisión); enviar_teso = true.
    //   APROBADO  → sin mails; tesoreria_approval.approved = true → BPA impacta el CBU en S/4.
    send_info: wfState === "INFO",
    context_log: {
      bp_id: bp_ID,
      status: wfState,
      comments: "",
      s4_business_partner: supplier,
      workflow_instance_id: ""
    },
    enviar_teso: wfState === "INFO",
    business_partner: supplier,
    context_supplierc
  };

  const axios = sapCfAxios('SBPA');

  // El alta va PRIMERO y a propósito: si falla, corta acá sin haber impactado nada y
  // el aprobador reintenta limpio. Al revés (PATCH ok, alta falla) el reintento igual
  // se recompone solo, porque el split se recalcula contra S/4 en cada corrida.
  //
  // Se espera a que CIERRE antes de seguir, por el mismo motivo que en el WF de
  // impuestos: dos flujos de BPA escribiendo el mismo BP a la vez dan R1/084.
  if (aBanksToCreate.length) {
    const wfBanco = await startBankCreationWorkflow(bp_ID, supplier, aBanksToCreate);
    await _esperarFinDeWorkflow(wfBanco?.id, "alta de bancos");
  }

  // Log de lo que se manda a BPA (context_bp es lo que termina en el PATCH a S/4).
  console.log(`[startTreasuryModificationWorkflow] context_bp →`, JSON.stringify(context_bp));
  console.log(`[startTreasuryModificationWorkflow] context completo →`, JSON.stringify(context));

  try {
    const response = await axios({
      method: 'POST',
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
      headers: {
        'irpa-api-key': process.env.IRPA_API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        definitionId: process.env.ABM_MODIFICACIONTESORERIA_DEFINITION_ID,
        businessKey: bp_ID,
        context
      }
    });

    return response.data;

  } catch (error) {
    console.error(`[startTreasuryModificationWorkflow] ❌ status HTTP: ${error.response?.status}`);
    console.error(`[startTreasuryModificationWorkflow] BPA response body:`, JSON.stringify(error.response?.data));
    throw error;
  }
}


// Lee la cabecera del BP en S/4. Sirve para los datos que NO se pueden deducir de la base
// local porque S/4 es el dueño: la categoría de interlocutor (1 = persona física,
// 2 = organización), que es inmutable una vez creado el BP, y los nombres/forma jurídica
// que ya tiene cargados.
//
// Si la lectura falla se propaga el error en vez de caer al dato local: seguir con la
// categoría local es justamente lo que produce el R11/126, y es preferible que la aprobación
// falle con el error de lectura (queda ERROR_WF y se reintenta) a mandar un PATCH que S/4
// rechaza a mitad de camino.
async function _readS4BPHeader(supplier) {
  const S4 = "OP_API_BUSINESS_PARTNER_SRV";
  const s4 = await getS4Service(S4);

  const oBP = await s4.run(
    SELECT.one.from(`${S4}.A_BusinessPartner`)
      .columns(
        "BusinessPartner",
        "BusinessPartnerCategory",
        "LegalForm",
        "OrganizationBPName1",
        "FirstName",
        "LastName"
      )
      .where({ BusinessPartner: supplier })
  );

  if (!oBP) console.warn(`[_readS4BPHeader] ⚠ BP ${supplier} no encontrado en S/4: se usa la categoría local`);
  return oBP || null;
}

// Separa las retenciones propuestas en las que S/4 YA tiene cargadas y las que no.
// La key de A_SupplierWithHoldingTax es Supplier + CompanyCode + WithholdingTaxType
// (WithholdingTaxCode es un valor, no parte de la key): dos líneas con el mismo tipo
// en la misma sociedad son la MISMA retención aunque cambie el indicador.
//
// Si la lectura a S/4 falla se propaga el error en vez de asumir que están todas:
// mandarlas todas al PATCH haría que las nuevas se pierdan sin que nadie se entere.
async function _splitWithholdingTaxesByS4Existence(supplier, aLines) {
  const S4 = "OP_API_BUSINESS_PARTNER_SRV";
  const s4 = await getS4Service(S4);

  let aExisting = [];
  try {
    const raw = await s4.run(
      SELECT.from(`${S4}.A_SupplierWithHoldingTax`).where({ Supplier: supplier })
    );
    aExisting = Array.isArray(raw) ? raw : [raw].filter(Boolean);
  } catch (err) {
    throw new Error(`No se pudieron leer las retenciones actuales del proveedor ${supplier} en S/4: ${err.message}`);
  }

  const _key = (wt) => `${wt.CompanyCode || ""}|${wt.WithholdingTaxType || ""}`;
  const existingKeys = new Set(aExisting.map(_key));

  const existing = [];
  const missing = [];
  for (const wt of aLines) (existingKeys.has(_key(wt)) ? existing : missing).push(wt);

  return { existing, missing };
}

// Replacer de JSON.stringify para loguear los payloads que se mandan a BPA.
// El HTML de los mails son 2-3 KB por cuerpo y tapan los context_* que son lo que
// interesa mirar: se reemplaza por un marcador con el tamaño. Todo lo demás sale
// literal, así el log se puede copiar y comparar contra el contrato del WF.
function _sinHtmlDeMails(key, value) {
  if (key === "content" && typeof value === "string" && value.startsWith("<!DOCTYPE html")) {
    return `[HTML omitido del log — ${value.length} chars]`;
  }
  return value;
}

// Presupuesto de espera de los WF de alta. El tope tiene que quedar MUY por debajo del
// timeout del approuter (la aprobación es una llamada sincrónica: si nos pasamos, el
// usuario come un 504 aunque el flujo haya seguido bien). Un alta es un POST suelto a
// S/4: termina en segundos, así que 20s alcanzan de sobra y el poll corta apenas cierra.
const _WF_ESPERA_TIMEOUT_MS = 20000;
const _WF_ESPERA_INTERVALO_MS = 1500;
// Cuánto se espera "a ciegas" si no se puede consultar el estado de la instancia. Sin
// esto, un error de consulta nos devuelve al escenario que causó el R1/084.
const _WF_ESPERA_CIEGA_MS = 5000;

// Espera a que una instancia de BPA deje de estar en curso antes de disparar la
// siguiente contra el mismo BP.
//
// Los WF de alta (retenciones, mails, bancos) se lanzan justo antes del WF de
// modificación y BPA los corre en paralelo: los dos pegan a S/4 sobre el mismo
// interlocutor comercial y el que llega segundo se come el enqueue del primero
//   R1/084 "Actualmente, interlocutor comercial NNN tratado por USUARIO"
// que no es un problema de payload: es el BP bloqueado. Serializar acá lo evita.
//
// Nunca corta el flujo: si la consulta falla o se agota el presupuesto se sigue igual
// (el alta ya se disparó y frenar la modificación por la espera sería peor que el
// riesgo de lock, que además es reintentable).
async function _esperarFinDeWorkflow(instanceId, sEtiqueta = "") {
  if (!instanceId) return null;

  const axios = sapCfAxios('SBPA');
  const tVencimiento = Date.now() + _WF_ESPERA_TIMEOUT_MS;
  const _dormir = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  while (Date.now() < tVencimiento) {
    await _dormir(_WF_ESPERA_INTERVALO_MS);

    let sStatus;
    try {
      const response = await axios({
        method: 'GET',
        url: `/workflow/rest/v1/workflow-instances/${instanceId}?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
        headers: { 'irpa-api-key': process.env.IRPA_API_KEY }
      });
      sStatus = response.data?.status || "";
    } catch (err) {
      console.warn(`[_esperarFinDeWorkflow] ⚠ no se pudo consultar el estado de ${sEtiqueta} (${instanceId}): ${err.message}; espero ${_WF_ESPERA_CIEGA_MS / 1000}s a ciegas`);
      await _dormir(_WF_ESPERA_CIEGA_MS);
      return null;
    }

    // RUNNING es el único estado "todavía trabajando": COMPLETED, ERRONEOUS, CANCELED
    // y SUSPENDED ya liberaron el BP, y en los tres últimos la falla se ve en BPA.
    if (sStatus && sStatus !== "RUNNING") {
      console.log(`[_esperarFinDeWorkflow] ${sEtiqueta} (${instanceId}) terminó en estado ${sStatus} → sigo con la modificación`);
      return sStatus;
    }
  }

  console.warn(`[_esperarFinDeWorkflow] ⚠ ${sEtiqueta} (${instanceId}) sigue en curso después de ${_WF_ESPERA_TIMEOUT_MS / 1000}s; sigo igual (puede dar R1/084 si todavía tiene tomado el BP)`);
  return "TIMEOUT";
}

// Keys reales de los mails y teléfonos de la dirección del BP en S/4.
//
// A_AddressEmailAddress / A_AddressPhoneNumber tienen key AddressID + Person +
// OrdinalNumber. `Person` NO siempre es vacío: lo es en direcciones de organización,
// pero en un BP persona física (BusinessPartnerCategory "1") S/4 crea un registro
// Person y los contactos cuelgan de él — ahí Person trae el ID de esa persona. Con
// Person="" hardcodeado el PATCH pega contra una key inexistente y S/4 devuelve
// 404 "Ressource für Segment A_AddressPhoneNumberType nicht gefunden".
//
// Devuelve las filas ordenadas por OrdinalNumber. Si la lectura falla NO se corta el
// WF: se devuelve vacío y el caller cae al comportamiento previo.
//
// Con `requireS4` sí corta: el split de mails cuenta las filas devueltas para decidir
// cuáles se pisan con PATCH y cuáles se dan de alta, así que un vacío por error de
// lectura se leería como "el BP no tiene mails en S/4" y postearía duplicados.
async function _readAddressContactsFromS4(bpNumber, { requireS4 = false } = {}) {
  const S4 = "OP_API_BUSINESS_PARTNER_SRV";
  const _toArr = (x) => Array.isArray(x) ? x : (Array.isArray(x?.results) ? x.results : []);
  const _byOrdinal = (a, b) => String(a.OrdinalNumber || "").localeCompare(String(b.OrdinalNumber || ""), undefined, { numeric: true });

  try {
    const s4 = await getS4Service(S4);
    const raw = await s4.run(
      SELECT.from(`${S4}.A_BusinessPartnerAddress`)
        .columns(['*',
          { ref: ['to_EmailAddress'], expand: ['*'] },
          { ref: ['to_PhoneNumber'], expand: ['*'] }
        ])
        .where({ BusinessPartner: bpNumber })
    );
    const rows = Array.isArray(raw) ? raw : [raw].filter(Boolean);
    // El BP tiene una sola dirección (ver el armado de context_address).
    const addr = rows[0];
    if (!addr) return { emails: [], phones: [] };

    return {
      emails: _toArr(addr.to_EmailAddress).sort(_byOrdinal),
      phones: _toArr(addr.to_PhoneNumber).sort(_byOrdinal)
    };
  } catch (err) {
    if (requireS4) throw new Error(`No se pudieron leer los contactos de la dirección del proveedor ${bpNumber} en S/4: ${err.message}`);
    console.warn(`[_readAddressContactsFromS4] ⚠ no se pudieron leer los contactos de la dirección de ${bpNumber} en S/4 (${err.message}); se mandan las keys construidas`);
    return { emails: [], phones: [] };
  }
}

// Alta de retenciones NUEVAS. El WF de modificación de impuestos impacta las
// retenciones con PATCH sobre A_SupplierWithHoldingTax, y un PATCH no crea el
// registro que no existe: las líneas que el proveedor agregó de cero se caen sin
// error visible. Por eso van por este WF aparte, que las postea.
//
// Contrato propio (distinto al de modificación): array plano context_witholdingtax
// —con RecipientType y AuthorizationGroup, que el de modificación sí descarta— más
// un bloque `log` de trazabilidad.
async function startWithholdingTaxCreationWorkflow(bp_ID, supplier, aLines) {
  const definitionId = process.env.ABM_ALTAWITHHOLDINGTAX_DEFINITION_ID;
  if (!definitionId) {
    throw new Error("Falta la variable ABM_ALTAWITHHOLDINGTAX_DEFINITION_ID: no se pueden dar de alta las retenciones nuevas");
  }

  // Mismo criterio que el WF de modificación: ExemptionDateBegin/End son Edm.DateTime
  // en S/4 y rechazan el "" que arma _buildS4BPPayload para las líneas no exentas
  // ("La propiedad ExemptionDateEnd del decalaje N tiene un valor no válido").
  const context_witholdingtax = aLines.map((line) => {
    const wt = { ...line, Supplier: line.Supplier || supplier };
    if (!wt.ExemptionDateBegin) delete wt.ExemptionDateBegin;
    if (!wt.ExemptionDateEnd) delete wt.ExemptionDateEnd;
    return wt;
  });

  const axios = sapCfAxios('SBPA');

  const oPayload = {
    definitionId,
    businessKey: bp_ID,
    context: {
      context_witholdingtax,
      log: {
        bp_id: bp_ID,
        status: "APROBADO",
        comments: "",
        s4_business_partner: supplier,
        workflow_instance_id: ""
      }
    }
  };

  console.log(`[startWithholdingTaxCreationWorkflow] 📤 payload a BPA — BP: ${bp_ID} | supplier: ${supplier} | ${context_witholdingtax.length} línea(s)`);
  console.log(JSON.stringify(oPayload, null, 2));

  try {
    const response = await axios({
      method: 'POST',
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
      headers: {
        'irpa-api-key': process.env.IRPA_API_KEY,
        'Content-Type': 'application/json'
      },
      data: oPayload
    });

    const aKeys = context_witholdingtax.map(wt => `${wt.CompanyCode}/${wt.WithholdingTaxType}`).join(", ");
    console.log(`[startWithholdingTaxCreationWorkflow] ✅ WF iniciado — BP: ${bp_ID} | supplier: ${supplier} | instance: ${response.data?.id} | altas: ${aKeys}`);

    // Este WF es el único que CREA retenciones en S/4, así que sin esta fila una
    // línea nueva aparecía en el BP sin rastro de quién ni cuándo. El detalle
    // completo va a new_data (LargeString): el description es String(500) y el
    // listado de sociedad/indicador lo desborda apenas hay varias sociedades.
    await INSERT.into(cds.entities("suppliersInitiative").ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TAX_WHT_CREATE',
      description: `Alta de ${context_witholdingtax.length} retención(es) enviada a S4 para BP ${supplier}. WF Instance: ${response.data?.id || 'N/A'}`,
      new_data: JSON.stringify(context_witholdingtax),
      ticket_display: supplier || bp_ID,
      business_partner_ID: bp_ID,
      result: 'SUCCESS'
    });

    return response.data;

  } catch (error) {
    console.error(`[startWithholdingTaxCreationWorkflow] ❌ status HTTP: ${error.response?.status}`);
    console.error(`[startWithholdingTaxCreationWorkflow] BPA response body:`, JSON.stringify(error.response?.data));

    // El alta corre ANTES del WF de modificación y si falla corta el flujo: sin esta
    // fila el intento no quedaba en ningún lado (el WorkflowStatus lo marca el caller).
    await INSERT.into(cds.entities("suppliersInitiative").ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TAX_WHT_CREATE',
      description: `Error dando de alta ${context_witholdingtax.length} retención(es) en S4 para BP ${supplier}: ${error.message}`.slice(0, 500),
      new_data: JSON.stringify({ lineas: context_witholdingtax, bpa_response: error.response?.data }),
      ticket_display: supplier || bp_ID,
      business_partner_ID: bp_ID,
      result: 'ERROR'
    });

    throw error;
  }
}

// Tope de mails por dirección. No es una regla de S/4 sino del modelo del ABM: la
// dirección lleva el mail del contacto (default) + Comercial + Cobranzas y nada más
// (ver el armado de aEmailResults en _buildS4BPPayload). Con 3 ya cargados en S/4 el
// PATCH los pisa a todos y no hay nada que dar de alta.
const _MAX_EMAILS_POR_DIRECCION = 3;

// Alta de mails NUEVOS de la dirección. Mismo caso que las retenciones y los bancos:
// el WF de modificación de impuestos impacta los mails con PATCH sobre
// A_AddressEmailAddress —cuya key es AddressID + Person + OrdinalNumber— y un PATCH
// no crea la fila que no existe. Si el BP tiene 1 mail en S/4 y el proveedor cargó 3,
// los dos de más se caían en silencio.
//
// Contrato propio: context_email plano de 3 campos (sin las keys de la dirección: BPA
// las resuelve desde business_partner) más el bloque `log` de trazabilidad.
async function startEmailCreationWorkflow(bp_ID, supplier, aEmails) {
  const definitionId = process.env.ABM_ALTAEMAIL_DEFINITION_ID;
  if (!definitionId) {
    throw new Error("Falta la variable ABM_ALTAEMAIL_DEFINITION_ID: no se pueden dar de alta los mails nuevos");
  }

  const context_email = aEmails.map(e => ({
    EmailAddress: e.EmailAddress || "",
    IsDefaultEmailAddress: Boolean(e.IsDefaultEmailAddress),
    AddressCommunicationRemarkText: ""
  }));

  const axios = sapCfAxios('SBPA');

  const oPayload = {
    definitionId,
    businessKey: bp_ID,
    context: {
      business_partner: supplier,
      context_email,
      log: {
        bp_id: bp_ID,
        comments: "",
        s4_business_partner: supplier,
        status: "APROBADO",
        workflow_instance_id: ""
      }
    }
  };

  console.log(`[startEmailCreationWorkflow] 📤 payload a BPA — BP: ${bp_ID} | supplier: ${supplier} | ${context_email.length} mail(s)`);
  console.log(JSON.stringify(oPayload, null, 2));

  try {
    const response = await axios({
      method: 'POST',
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
      headers: {
        'irpa-api-key': process.env.IRPA_API_KEY,
        'Content-Type': 'application/json'
      },
      data: oPayload
    });

    console.log(`[startEmailCreationWorkflow] ✅ WF iniciado — BP: ${bp_ID} | supplier: ${supplier} | instance: ${response.data?.id} | altas: ${context_email.map(e => e.EmailAddress).join(", ")}`);

    // Este WF es el único que CREA mails en S/4: sin esta fila un mail nuevo aparecía
    // en el BP sin rastro de quién ni cuándo.
    await INSERT.into(cds.entities("suppliersInitiative").ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TAX_EMAIL_CREATE',
      description: `Alta de ${context_email.length} mail(s) enviada a S4 para BP ${supplier}. WF Instance: ${response.data?.id || 'N/A'}`,
      new_data: JSON.stringify(context_email),
      ticket_display: supplier || bp_ID,
      business_partner_ID: bp_ID,
      result: 'SUCCESS'
    });

    return response.data;

  } catch (error) {
    console.error(`[startEmailCreationWorkflow] ❌ status HTTP: ${error.response?.status}`);
    console.error(`[startEmailCreationWorkflow] BPA response body:`, JSON.stringify(error.response?.data));

    await INSERT.into(cds.entities("suppliersInitiative").ApplicationLogs).entries({
      app: 'ABM Contratistas',
      modification: 'TAX_EMAIL_CREATE',
      description: `Error dando de alta ${context_email.length} mail(s) en S4 para BP ${supplier}: ${error.message}`.slice(0, 500),
      new_data: JSON.stringify({ mails: context_email, bpa_response: error.response?.data }),
      ticket_display: supplier || bp_ID,
      business_partner_ID: bp_ID,
      result: 'ERROR'
    });

    throw error;
  }
}

// Workflow de modificación de IMPUESTOS (ABM). Mismo criterio de banderas que
// startTreasuryModificationWorkflow. El approval lo da el área de Impuestos.
//
// El WF ya no consume el árbol anidado de S/4: desde el payload de DEV recibe un
// array plano por entidad OData (context_address, context_email, context_phonenumber,
// context_purorg, context_supplier, context_supplierc, context_taxnumber,
// context_witholdingtax) más context_bp, que acá es sólo la cabecera del BP —no el
// árbol completo que sigue mandando el WF de alta con el mismo nombre—.
// _buildS4BPPayload sigue siendo la fuente única —así el alta y la modificación no
// divergen— y acá se lo aplana.
async function startTaxModificationWorkflow(bp_ID, comments = "", wfState = "PENDIENTE", approverId = "", oOverride = null) {
  const { BusinessPartners, Contacts } = cds.entities("ABMContratistaService");

  const [bp, contacts, s4] = await Promise.all([
    SELECT.one.from(BusinessPartners).where({ ID: bp_ID }),
    SELECT.from(Contacts).where({ business_partner_ID: bp_ID }),
    // oOverride = propuesta PENDIENTE: el payload a S/4 lleva los datos propuestos sin persistir.
    _buildS4BPPayload(bp_ID, oOverride)
  ]);

  if (!bp) throw new Error(`Business Partner ${bp_ID} no encontrado`);

  const supplier = bp.business_partner_number || bp.lifnr || "";
  const providerEmail = (contacts || [])[0]?.contact_email || "";

  // El BP tiene una sola dirección (con hasta 3 mails y un teléfono colgando), así que
  // aplanar la jerarquía dirección→contactos no pierde la relación: todos los mails y
  // teléfonos del array pertenecen a la única dirección de context_address.
  const aAddresses = s4.to_BusinessPartnerAddress?.results || [];

  // Floor no está en el contrato del WF: _buildS4BPPayload lo agrega condicionalmente
  // para el alta, acá se descarta junto con los sub-arrays de contacto.
  const context_address = aAddresses.map(({ to_AddressEmailAddress, to_AddressPhoneNumber, Floor, TimeZone, ...addr }) => ({
    ...addr,
    CareOfName: "",
    AddressTimeZone: ""
  }));

  // Mails y teléfonos se impactan como PATCH sobre A_AddressEmailAddress /
  // A_AddressPhoneNumber, cuya key es AddressID + Person + OrdinalNumber. `Person`
  // NO es siempre vacío (ver _readAddressContactsFromS4): en un BP persona física
  // trae el ID del registro Person, y mandarlo vacío da 404. Se toma la key real de
  // S/4 apareando por posición contra la lista ordenada por OrdinalNumber, que es la
  // misma semántica que venía usando BPA pero con los valores que existen de verdad.
  const oS4Contacts = (wfState === "APROBADO" && supplier)
    ? await _readAddressContactsFromS4(supplier, { requireS4: true })
    : { emails: [], phones: [] };

  // Un contacto propuesto de más no tiene fila que pisar en S/4: el PATCH no crea.
  // Se avisa para que no se pierda en silencio (mismo caso que las retenciones nuevas,
  // que van por startWithholdingTaxCreationWorkflow).
  const _keyDeContacto = (aS4, i, sTipo) => {
    const oS4 = aS4[i];
    if (!oS4) {
      if (aS4.length) console.warn(`[startTaxModificationWorkflow] ⚠ BP ${supplier}: el ${sTipo} #${i + 1} no existe en S/4 (hay ${aS4.length}); el PATCH no lo va a crear`);
      return {};
    }
    return { Person: oS4.Person || "", OrdinalNumber: oS4.OrdinalNumber || "" };
  };

  // Los mails se aparean por posición contra los de S/4: los primeros N (los que S/4
  // ya tiene) se pisan con PATCH y el resto se da de alta con startEmailCreationWorkflow,
  // hasta el tope de 3 por dirección. Con 3 ya cargados no hay alta: el PATCH los pisa
  // todos. Se separan recién al aprobar, que es cuando BPA escribe (en PENDIENTE/INFO
  // oS4Contacts viene vacío a propósito y todos los mails van al PATCH, como antes).
  const aProposedEmails = aAddresses.flatMap(a => a.to_AddressEmailAddress?.results || []);
  const bSplitMails = wfState === "APROBADO" && Boolean(supplier);
  const nS4Emails = oS4Contacts.emails.length;

  const aEmailsToPatch = bSplitMails ? aProposedEmails.slice(0, nS4Emails) : aProposedEmails;
  const aEmailsToCreate = bSplitMails
    ? aProposedEmails.slice(nS4Emails, _MAX_EMAILS_POR_DIRECCION)
    : [];

  if (bSplitMails) {
    const _fmt = (a) => a.length ? a.map(e => e.EmailAddress).join(", ") : "(ninguno)";
    console.log(`[startTaxModificationWorkflow] mails — en S/4: ${nS4Emails} | propuestos: ${aProposedEmails.length} | PATCH: ${_fmt(aEmailsToPatch)} | ALTA: ${_fmt(aEmailsToCreate)}`);

    // Más de 3 propuestos no entra en la dirección: ni se pisa ni se crea. Es un caso
    // que el modelo del ABM no debería producir (contacto + Comercial + Cobranzas),
    // pero si aparece tiene que verse en el log y no desaparecer sin más.
    if (aProposedEmails.length > _MAX_EMAILS_POR_DIRECCION) {
      console.warn(`[startTaxModificationWorkflow] ⚠ BP ${supplier}: se propusieron ${aProposedEmails.length} mails y la dirección admite ${_MAX_EMAILS_POR_DIRECCION}; quedan afuera: ${aProposedEmails.slice(_MAX_EMAILS_POR_DIRECCION).map(e => e.EmailAddress).join(", ")}`);
    }
  }

  const context_email = aEmailsToPatch.map((e, i) => ({
    ...e,
    AddressCommunicationRemarkText: "",
    Person: "",
    ..._keyDeContacto(oS4Contacts.emails, i, "mail")
  }));

  // DestinationLocationCountry no existe en el modelo del ABM: el contrato lo pide
  // pero no hay de dónde derivarlo, va vacío hasta que Impuestos defina el origen.
  const context_phonenumber = aAddresses.flatMap(a => (a.to_AddressPhoneNumber?.results || []).map((p, i) => ({
    ...p,
    DestinationLocationCountry: "",
    AddressCommunicationRemarkText: "",
    Person: "",
    ..._keyDeContacto(oS4Contacts.phones, i, "teléfono")
  })));

  // Los PATCH sobre A_Supplier / A_SupplierCompany / A_SupplierPurchasingOrg tienen
  // key Supplier: en modificación el BP ya existe → va el número real (no vacío como
  // en el alta). SupplierCorporateGroup tampoco existe en el modelo: va vacío.
  const oSupplier = s4.to_Supplier || {};
  const context_supplier = [{
    TaxNumberType: "",
    ResponsibleType: oSupplier.ResponsibleType || "",
    PostingIsBlocked: Boolean(oSupplier.PostingIsBlocked),
    DeletionIndicator: Boolean(oSupplier.DeletionIndicator),
    AuthorizationGroup: "",
    PurchasingIsBlocked: Boolean(oSupplier.PurchasingIsBlocked),
    SupplierAccountGroup: oSupplier.SupplierAccountGroup || "",
    SupplierCorporateGroup: "",
    PaymentIsBlockedForSupplier: Boolean(oSupplier.PaymentIsBlockedForSupplier),
    Supplier: supplier
  }];

  const aSupplierCompany = oSupplier.to_SupplierCompany?.results || [];

  // Condiciones de pago, moneda, grupo de tolerancia, vías de pago y cuenta asociada NO
  // los propone la modificación de impuestos: los define Finanzas y no cambian por acá.
  // Se sacan del PATCH en vez de reenviarlos con su valor actual, porque un campo que no
  // viaja es imposible de pisar. Reenviar el valor leído de S/4 parecía equivalente pero
  // dejaba un agujero: si la lectura fallaba se caía al valor construido —
  // `cd.payment_terms || S4_CONFIG.paymentTerms`— y el PATCH escribía el default "0022"
  // en todas las sociedades del BP.
  const _CAMPOS_DE_FINANZAS = [
    "Currency",
    "PaymentTerms",
    "APARToleranceGroup",
    "PaymentMethodsList",
    "ReconciliationAccount"
  ];

  const context_supplierc = aSupplierCompany.map(({ to_SupplierWithHoldingTax, ...c }) => {
    const oCompany = {
      ...c,
      Supplier: supplier,
      AuthorizationGroup: "",
      PaymentBlockingReason: "",
      WithholdingTaxCountry: ""
    };

    for (const sCampo of _CAMPOS_DE_FINANZAS) delete oCompany[sCampo];

    return oCompany;
  });

  // Las retenciones dejan de colgar de cada sociedad: van todas en un único array,
  // y cada línea se identifica por su par CompanyCode + Supplier (que ya arma
  // _buildS4BPPayload).
  const aProposedWht = aSupplierCompany.flatMap(c => c.to_SupplierWithHoldingTax?.results || []);

  // Este WF impacta las retenciones con PATCH, así que sólo puede tocar las que ya
  // existen en S/4: las que el proveedor agregó de cero hay que POSTearlas con el WF
  // de alta. Se separan recién al aprobar, que es cuando BPA escribe en S/4 (en
  // PENDIENTE/INFO el WF sólo manda mails y no vale pagar la lectura a S/4).
  let aWhtToPatch = aProposedWht;
  let aWhtToCreate = [];
  if (wfState === "APROBADO" && supplier) {
    ({ existing: aWhtToPatch, missing: aWhtToCreate } =
      await _splitWithholdingTaxesByS4Existence(supplier, aProposedWht));

    const _fmt = (a) => a.length ? a.map(w => `${w.CompanyCode}/${w.WithholdingTaxType}`).join(", ") : "(ninguna)";
    console.log(`[startTaxModificationWorkflow] retenciones — propuestas: ${aProposedWht.length} | PATCH: ${_fmt(aWhtToPatch)} | ALTA: ${_fmt(aWhtToCreate)}`);

    if (!aProposedWht.length) {
      console.warn(`[startTaxModificationWorkflow] ⚠ BP ${supplier}: no se armó ninguna retención. Revisar que las sociedades del BP tengan _COMPANY_CODES_TAXES y que el tipo cargado esté permitido en esa sociedad.`);
    }
  } else {
    // Sin este aviso, "el WF de alta no dispara" en PENDIENTE/INFO parece un bug y es
    // el diseño: el split y el alta sólo corren al APROBAR, que es cuando BPA escribe.
    console.log(`[startTaxModificationWorkflow] estado ${wfState || "(vacío)"} → no se evalúan altas de retenciones (sólo se hace en APROBADO)`);
  }

  // RecipientType / AuthorizationGroup no están en el contrato de este WF (el de
  // alta sí los pide, por eso se descartan acá y no antes del split).
  const context_witholdingtax = aWhtToPatch.map(({ RecipientType, AuthorizationGroup, ...wt }) => {
    // Las fechas de exención son Edm.DateTime en S/4: el "" que arma _buildS4BPPayload
    // para las líneas no exentas se rechaza con "La propiedad ExemptionDateEnd del
    // decalaje N tiene un valor no válido". Si están vacías se omiten (igual que el alta).
    if (!wt.ExemptionDateBegin) delete wt.ExemptionDateBegin;
    if (!wt.ExemptionDateEnd) delete wt.ExemptionDateEnd;
    return wt;
  });

  const context_purorg = (oSupplier.to_SupplierPurchasingOrg?.results || []).map(o => ({
    ...o,
    Supplier: supplier,
    PurchasingGroup: "",
    IncotermsClassification: ""
  }));

  const context_taxnumber = s4.to_BusinessPartnerTax?.results || [];

  // Cabecera del BP: la agregó Impuestos al contrato después de la primera vuelta
  // (antes el WF sólo tocaba dirección/contacto/supplier/retenciones y no había dónde
  // mandar razón social, forma jurídica ni grouping). Es un objeto, no un array: hay
  // un solo A_BusinessPartner. Se listan los 14 campos del contrato de forma explícita
  // en vez de spreadear s4, para que un campo nuevo en _buildS4BPPayload no se cuele
  // en el PATCH sin que Impuestos lo haya pedido.
  //
  // Los campos de nombre son EXCLUYENTES según la categoría del BP y no se pueden
  // mandar los dos juegos "por las dudas": A_BusinessPartner valida la presencia de la
  // propiedad, no su valor, así que un FirstName/LastName vacío sobre una organización
  // basta para que el PATCH se caiga con
  //   R11/126 "El tipo IC 1 no se ajusta a los datos del tipo 2"
  // (IC = interlocutor comercial; 1 = persona física, 2 = organización). Por eso cada
  // categoría manda sólo lo suyo: la organización razón social + forma jurídica, la
  // persona física nombre + apellido. IsNaturalPerson viaja en ambas (el alta lo manda
  // siempre, con "X" para la persona física y vacío para la organización).
  // OJO: `s4` es lo que arma _buildS4BPPayload con el dato LOCAL (BusinessPartnerCategory sale
  // de is_human), no lo que hay en S/4. La categoría de un BP ya creado es INMUTABLE en S/4, así
  // que si el local dice organización y el BP se creó como persona física (o al revés) el PATCH
  // manda el juego de nombre equivocado y S/4 lo rechaza con
  //   R11/126 "El tipo IC 2 no se ajusta a los datos del tipo 1"
  // Por eso, cuando el WF va a impactar, la categoría la dicta S/4. En PENDIENTE/INFO no se
  // escribe nada y no vale pagar —ni hacer fallar el mail por— la lectura.
  const oS4Header = (wfState === "APROBADO" && supplier) ? await _readS4BPHeader(supplier) : null;

  let sCategoria = s4.BusinessPartnerCategory || "";
  if (oS4Header?.BusinessPartnerCategory) {
    if (oS4Header.BusinessPartnerCategory !== sCategoria) {
      console.warn(`[startTaxModificationWorkflow] ⚠ BP ${supplier}: la categoría local (${sCategoria || "vacía"}) NO coincide con la de S/4 (${oS4Header.BusinessPartnerCategory}). Manda S/4 (es inmutable); revisar is_human/legal_form del BP local, que van a seguir discrepando.`);
    }
    sCategoria = oS4Header.BusinessPartnerCategory;
  }

  const bIsPersonaFisica = sCategoria === "1";

  // El nombre hay que re-ubicarlo en el campo de la categoría que manda S/4: _buildS4BPPayload
  // lo puso donde correspondía a la categoría LOCAL, así que ante discrepancia el campo bueno
  // viene vacío y el PATCH borraría la razón social / el apellido en S/4.
  const sNombre = s4.OrganizationBPName1 || s4.LastName || s4.FirstName || oS4Header?.OrganizationBPName1 || oS4Header?.LastName || "";
  // Ídem la forma jurídica: si el local la dejó vacía porque creía que era persona física,
  // se conserva la que ya tiene el BP en S/4 en vez de blanquearla.
  const sLegalForm = s4.LegalForm || oS4Header?.LegalForm || "";

  const context_bp = {
    Language: s4.Language || "",
    SearchTerm1: s4.SearchTerm1 || "",
    IsNaturalPerson: bIsPersonaFisica ? "X" : "",
    AuthorizationGroup: s4.AuthorizationGroup || "",
    IsMarkedForArchiving: Boolean(s4.IsMarkedForArchiving),
    CorrespondenceLanguage: s4.CorrespondenceLanguage || "",
    BusinessPartnerCategory: sCategoria,
    BusinessPartnerGrouping: s4.BusinessPartnerGrouping || "",
    BusinessPartnerIsBlocked: Boolean(s4.BusinessPartnerIsBlocked),
    BusinessPartnerIDByExtSystem: s4.BusinessPartnerIDByExtSystem || "",
    ...(bIsPersonaFisica
      ? {
        FirstName: "",
        LastName: sNombre
      }
      : {
        LegalForm: sLegalForm,
        OrganizationBPName1: sNombre
      })
  };

  console.log(`[startTaxModificationWorkflow] cabecera — BP ${supplier}: categoría ${sCategoria || "(vacía)"} (${oS4Header ? "leída de S/4" : "local, el WF no impacta"}) → se mandan ${bIsPersonaFisica ? "FirstName/LastName (persona física)" : "OrganizationBPName1/LegalForm (organización)"}`);

  // Emails de los aprobadores de impuestos: se resuelven desde la Role Collection
  // de BTP (igual que el alta), con las TEST_APPROVER_TAX_EMAILS como fallback.
  const TEST_APPROVER_TAX_EMAILS = (process.env.TEST_APPROVER_TAX_EMAIL || "")
    .split(",").map(e => e.trim()).filter(Boolean);
  const taxApproverEmails = await getApproverEmailsByArea("TAX", TEST_APPROVER_TAX_EMAILS);
  const taxApproverRecipients = [...new Set(taxApproverEmails)].map(address => ({ emailAddress: { address } }));

  // Recuadro con el comentario que escribió el usuario al solicitar el cambio
  // impositivo (sólo si lo cargó). Mismo estilo que el box del alta.
  const infoCommentBox = comments
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#D9D2F7;border-radius:6px;overflow:hidden;margin:0 0 16px;"><tr><td style="background:#9380E5;padding:8px 16px;"><p style="margin:0;color:#ffffff;font-size:12px;font-weight:bold;">Comentario</p></td></tr><tr><td style="padding:12px 16px;"><p style="margin:0;font-size:13px;color:#3C3489;">${comments}</p></td></tr></table>`
    : "";

  const FLP_BASE_URL = process.env.FLP_BASE_URL;

  const context = {
    input: {
      status: wfState === "APROBADO" ? "APROBADO" : "PENDING",
      is_email_sent: wfState === "PENDIENTE"
    },
    mail: {
      message: {
        subject: `Solicitud de modificación de datos impositivos - ${bp.provider_name || supplier}`,
        body: {
          contentType: "HTML",
          content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Modificación de datos impositivos</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Modificación de datos`, title: `Datos impositivos`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Estimado proveedor,</p><p style="margin:0 0 20px;">Se ha iniciado una solicitud de modificación de datos impositivos para <strong>${bp.provider_name || supplier}</strong>.</p>${infoCommentBox}<p style="margin:0 0 20px;color:#666666;font-size:13px;">Por favor, revise la información y actualice sus datos impositivos ingresando al sistema.</p><p style="margin:0;text-align:center;"><a href="${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp_ID}&edit=true&sap-app-origin-hint=saas_approuter&section=tax&modificacion=true" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">Editar Información Impositiva</a></p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
        },
        toRecipients: [{ emailAddress: { address: providerEmail } }],
        saveToSentItems: false
      }
    },
    context_info: {
      tax_approval: wfState === "APROBADO"
        ? { approved: true, user: approverId, date: new Date().toISOString() }
        : { approved: false, user: "", date: "" }
    },
    tax_mail: {
      message: {
        subject: `Modificación de datos impositivos - ${bp.provider_name || supplier}`,
        body: {
          contentType: "HTML",
          content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Revisión de modificación - Impuestos</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Revisión requerida`, title: `Modificación de impuestos`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Hola,</p><p style="margin:0 0 20px;">Se solicita la revisión y aprobación de la modificación de datos impositivos para <strong>${bp.provider_name || supplier}</strong>.</p><p style="margin:0;text-align:center;"><a href="${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp_ID}&edit=false&sap-app-origin-hint=saas_approuter&section=tax&modificacion=false" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">Revisar Modificación</a></p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
        },
        toRecipients: taxApproverRecipients,
        saveToSentItems: false
      }
    },
    // Banderas dinámicas según el estado del WF (mismo criterio que startTreasuryModificationWorkflow):
    //   PENDIENTE → mail al proveedor (actualizar datos); is_email_sent = true.
    //   INFO      → mail a Impuestos (revisión); enviar_tax = true.
    //   APROBADO  → sin mails; tax_approval.approved = true → BPA impacta los datos en S/4.
    send_info: wfState === "INFO",
    context_log: {
      bp_id: bp_ID,
      status: wfState,
      comments: "",
      s4_business_partner: supplier,
      workflow_instance_id: ""
    },
    enviar_tax: wfState === "INFO",
    business_partner: supplier,
    context_address,
    context_email,
    context_phonenumber,
    context_purorg,
    context_supplier,
    context_supplierc,
    context_taxnumber,
    context_witholdingtax,
    context_bp
  };


  const axios = sapCfAxios('SBPA');

  // Las altas van PRIMERO y a propósito: si fallan, corta acá sin haber impactado nada
  // y el aprobador reintenta limpio. Al revés (PATCH ok, alta falla) el reintento igual
  // se recompone solo, porque los splits se recalculan contra S/4 en cada corrida.
  //
  // Se espera a que cada una CIERRE antes de seguir: disparar el WF de modificación con
  // el alta todavía corriendo pone dos flujos de BPA a escribir el mismo BP a la vez y
  // el segundo se cae con R1/084 (ver _esperarFinDeWorkflow).
  if (aWhtToCreate.length) {
    const wfWht = await startWithholdingTaxCreationWorkflow(bp_ID, supplier, aWhtToCreate);
    await _esperarFinDeWorkflow(wfWht?.id, "alta de retenciones");
  }

  if (aEmailsToCreate.length) {
    const wfEmail = await startEmailCreationWorkflow(bp_ID, supplier, aEmailsToCreate);
    await _esperarFinDeWorkflow(wfEmail?.id, "alta de mails");
  }

  const oPayload = {
    definitionId: process.env.ABM_MODIFICACIONTAX_DEFINITION_ID,
    businessKey: bp_ID,
    context
  };

  console.log(`[startTaxModificationWorkflow] 📤 payload a BPA — BP: ${bp_ID} | estado: ${wfState}`);
  console.log(JSON.stringify(oPayload, _sinHtmlDeMails, 2));

  try {
    const response = await axios({
      method: 'POST',
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
      headers: {
        'irpa-api-key': process.env.IRPA_API_KEY,
        'Content-Type': 'application/json'
      },
      data: oPayload
    });

    console.log(`[startTaxModificationWorkflow] ✅ WF iniciado — BP: ${bp_ID} | instance: ${response.data?.id}`);
    return response.data;

  } catch (error) {
    console.error(`[startTaxModificationWorkflow] ❌ status HTTP: ${error.response?.status}`);
    console.error(`[startTaxModificationWorkflow] BPA response body:`, JSON.stringify(error.response?.data));
    throw error;
  }
}

async function postAbmWorkflow(bp_ID, s4Payload) {
  const axios = sapCfAxios('SBPA');

  const TEST_APPROVER_LEGAL_EMAILS = (process.env.TEST_APPROVER_LEGAL_EMAIL || "").split(",").map(e => e.trim()).filter(Boolean);
  const TEST_APPROVER_TAX_EMAILS = (process.env.TEST_APPROVER_TAX_EMAIL || "").split(",").map(e => e.trim()).filter(Boolean);
  const TEST_APPROVER_TREASURY_EMAILS = (process.env.TEST_APPROVER_TREASURY_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

  const builtPayload = s4Payload || await _buildS4BPPayload(bp_ID);

  const { BusinessPartners, Contacts, TaxNumbers, TaxIdentificationTypes } = cds.entities("ABMContratistaService");
  const [bp, contacts, taxNumbers, taxTypes] = await Promise.all([
    SELECT.one.from(BusinessPartners).where({ ID: bp_ID }),
    SELECT.from(Contacts).where({ business_partner_ID: bp_ID }),
    SELECT.from(TaxNumbers).where({ business_partner_ID: bp_ID }),
    SELECT.from(TaxIdentificationTypes)
  ]);
  const providerEmail = (contacts || [])[0]?.contact_email || "";
  const taxEntry = (taxNumbers || [])[0];
  const taxTypeMap = Object.fromEntries((taxTypes || []).map(t => [t.ID, t.description]));
  const taxLabel = taxEntry
    ? `${taxTypeMap[taxEntry.tax_identification_number] || taxEntry.tax_identification_number}: ${taxEntry.identification_number}`
    : "";

  try {
    const response = await axios({
      method: 'POST',
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
      headers: {
        'irpa-api-key': process.env.IRPA_API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        definitionId: process.env.ABM_WORKFLOW_DEFINITION_ID,
        businessKey: bp_ID,
        context: {
          input: {
            status: "",
            context: {
              s4_payload: builtPayload,
              legal_approval: { approved: false, user: "", date: "" },
              tax_approval: { approved: false, user: "", date: "" },
              tesoreria_approval: { approved: false, user: "", date: "" }
            }
          },
          mail: {
            message: {
              subject: "",
              body: { contentType: "", content: "" },
              toRecipients: [
                ...TEST_APPROVER_LEGAL_EMAILS.map(address => ({ emailAddress: { address } })),
                ...TEST_APPROVER_TAX_EMAILS.map(address => ({ emailAddress: { address } })),
                ...TEST_APPROVER_TREASURY_EMAILS.map(address => ({ emailAddress: { address } }))
              ],
              saveToSentItems: false
            }
          },
          tax_mail: {
            message: {
              subject: `Solicitud de información adicional - Impuestos: ${bp?.provider_name || bp_ID}${taxLabel ? ' | ' + taxLabel : ''}`,
              body: {
                contentType: "HTML",
                content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Información adicional - Impuestos</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Solicitud de información`, title: `Información adicional - Impuestos`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Estimado proveedor,</p><p style="margin:0;">El aprobador impositivo ha solicitado información adicional para completar el alta de <strong>${bp?.provider_name || bp_ID}</strong>${taxLabel ? ` (${taxLabel})` : ''}. Por favor, revise los comentarios y vuelva a ingresar al sistema.</p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
              },
              toRecipients: [
                { emailAddress: { address: providerEmail } }
              ],
              saveToSentItems: false
            }
          },
          legal_mail: {
            message: {
              subject: `Solicitud de información adicional - Legal: ${bp?.provider_name || bp_ID}${taxLabel ? ' | ' + taxLabel : ''}`,
              body: {
                contentType: "HTML",
                content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Información adicional - Legal</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Solicitud de información`, title: `Información adicional - Legal`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Estimado proveedor,</p><p style="margin:0;">El aprobador legal ha solicitado información adicional para completar el alta de <strong>${bp?.provider_name || bp_ID}</strong>${taxLabel ? ` (${taxLabel})` : ''}. Por favor, revise los comentarios y vuelva a ingresar al sistema.</p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
              },
              toRecipients: [
                { emailAddress: { address: providerEmail } }
              ],
              saveToSentItems: false
            }
          },
          tesoreria_mail: {
            message: {
              subject: `Solicitud de información adicional - Tesorería: ${bp?.provider_name || bp_ID}${taxLabel ? ' | ' + taxLabel : ''}`,
              body: {
                contentType: "HTML",
                content: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Información adicional - Tesorería</title></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">${mailHeader({ badge: `Solicitud de información`, title: `Información adicional - Tesorería`, padding: '20px 28px' })}<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;"><p style="margin:0 0 16px;">Estimado proveedor,</p><p style="margin:0;">El aprobador de tesorería ha solicitado información adicional para completar el alta de <strong>${bp?.provider_name || bp_ID}</strong>${taxLabel ? ` (${taxLabel})` : ''}. Por favor, revise los comentarios y vuelva a ingresar al sistema.</p></td></tr><tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;"><p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p></td></tr></table></td></tr></table></body></html>`
              },
              toRecipients: [
                { emailAddress: { address: providerEmail } }
              ],
              saveToSentItems: false
            }
          }
        }
      }
    });

    const instanceId = response.data.id;
    return { instanceId };

  } catch (err) {
    console.error(`[ABM] Error workflow BP ${bp_ID}:`, err.response?.data || err.message);
    throw err;
  }
}

async function sendManualBPNotification(bp, bp_validator) {
  const FLP_BASE_URL = process.env.FLP_BASE_URL;
  const bpUrl = `${FLP_BASE_URL}#vistaabmproveedores-create?bpId=${bp.ID}&sap-app-origin-hint=saas_approuter`;

  const axios = sapCfAxios('SBPA');

  await axios({
    method: 'POST',
    url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.ABM_WORKFLOW_ENV}`,
    headers: {
      'irpa-api-key': process.env.IRPA_API_KEY,
      'Content-Type': 'application/json'
    },
    data: {
      definitionId: process.env.ABM_WORKFLOW_DEFINITION_ID,
      businessKey: bp.ID,
      context: {
        input: {
          status: "",
          context: {
            s4_payload: {
              BusinessPartnerCategory: "",
              OrganizationBPName1: bp.provider_name || "",
              BusinessPartnerGrouping: "",
              CorrespondenceLanguage: "",
              to_BusinessPartnerAddress: [{ results: [{ Country: "", CityName: "", StreetName: "", HouseNumber: "", Language: "" }] }],
              to_BusinessPartnerRole: [{ results: [{ BusinessPartnerRole: "" }] }]
            },
            legal_approval: { approved: false, user: "", date: "" },
            tax_approval: { approved: false, user: "", date: "" },
            tesoreria_approval: { approved: false, user: "", date: "" }
          }
        },
        mail: {
          message: {
            subject: `Nuevo contratista ABM #${bp.business_partner_number || bp.ID} creado`,
            body: {
              contentType: "HTML",
              content: `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><title>Nuevo Contratista Creado</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
${mailHeader({ badge: 'ABM Contratistas', title: 'Nuevo Contratista Creado', padding: '20px 28px' })}
<tr><td style="padding:24px 28px;color:#333333;font-size:14px;line-height:1.6;">
<p style="margin:0 0 16px;">Hola,</p>
<p style="margin:0 0 20px;">Se creó un nuevo contratista que requiere revisión y aprobación.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#D9D2F7;border-radius:6px;overflow:hidden;margin-bottom:20px;">
<tr><td style="background:#9380E5;padding:8px 16px;">
<p style="margin:0;color:#ffffff;font-size:12px;font-weight:bold;">Detalle del contratista</p>
</td></tr>
<tr><td style="padding:12px 16px;">
<p style="margin:0 0 4px;font-size:13px;color:#3C3489;"><strong>N° BP:</strong> ${bp.business_partner_number || bp.ID}</p>
<p style="margin:0;font-size:13px;color:#3C3489;"><strong>Nombre:</strong> ${bp.provider_name || ''}</p>
</td></tr></table>
<p style="margin:0 0 20px;color:#666666;font-size:13px;">Ingresá al sistema para revisar el detalle completo.</p>
<p style="margin:0;text-align:center;">
<a href="${bpUrl}" style="display:inline-block;background:#563EC2;color:#ffffff;padding:10px 28px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;">
Ver Contratista #${bp.business_partner_number || bp.ID}
</a></p>
</td></tr>
<tr><td style="background:#D9D2F7;padding:14px 28px;text-align:center;">
<p style="margin:0;color:#563EC2;font-size:12px;">Este es un mensaje automático, por favor no responda este correo.</p>
</td></tr></table></td></tr></table>
</body></html>`
            },
            toRecipients: [{ emailAddress: { address: bp_validator } }],
            saveToSentItems: false
          }
        }
      }
    }
  });
}

