const cds = require('@sap/cds');
const sapCfAxios = require('sap-cf-axios').default;

const scimHeaders = {
    'Content-Type': 'application/scim+json',
    'Accept': 'application/scim+json',
};

function iasAxios() {
    return sapCfAxios('CAP_IAS_SCIM');
}

async function _getBTPUsersByRoleCollection(roleCollection) {
    const axios = xsuaaApiAxios();

    // 1. Resolver el grupo (Role Collection) por displayName y obtener sus members
    const groupRes = await axios({
        method: 'GET',
        url: '/Groups',
        params: { filter: `displayName eq "${roleCollection}"` }
    });
    const group = (groupRes.data?.resources || groupRes.data?.Resources || [])[0];
    if (!group) return { found: false, users: [] };

    const memberIds = new Set((group.members || []).map(m => m.value).filter(Boolean));
    if (!memberIds.size) return { found: true, users: [] };

    // 2. Traer todos los users (paginado) y quedarnos con los que son members
    const users = [];
    let startIndex = 1;
    const pageSize = 500;
    while (true) {
        const res = await axios({
            method: 'GET',
            url: '/Users',
            params: { count: pageSize, startIndex }
        });
        const list = res.data?.resources || res.data?.Resources || [];
        const total = res.data?.totalResults || 0;

        for (const u of list) {
            if (!memberIds.has(u.id)) continue;
            const email = (u.emails?.find(e => e.primary) || u.emails?.[0] || {}).value || u.userName || '';
            users.push({
                id: u.id,
                userName: u.userName || '',
                email,
                firstName: u.name?.givenName || '',
                lastName: u.name?.familyName || '',
                origin: u.origin || '',
                active: u.active !== false
            });
        }

        if ((startIndex + list.length - 1) >= total || list.length < pageSize) break;
        startIndex += pageSize;
    }

    return { found: true, users };
}

// Asegura el shadow user en BTP y le asigna una lista de Role Collections (idempotente).
// Las que ya tenga devuelven 409 y se saltean; solo se agregan las que falten.
async function _ensureShadowUserWithRCs({ email, firstName, lastName, origin, rcList }) {
    const warnings = [];
    let btpId = null;

    if (!origin) {
        warnings.push('IAS_ORIGIN_KEY no configurado — se omitió el shadow user en BTP.');
        return { btpId, warnings };
    }
    if (!rcList.length) return { btpId, warnings };

    try {
        btpId = await _ensureBTPShadowUser({ email, firstName, lastName, origin });
        for (const rc of rcList) {
            try {
                await _assignBTPRoleCollectionById({ btpId, origin, roleCollection: rc });
            } catch (rcErr) {
                const st = rcErr.response?.status;
                if (st === 409) continue; // ya la tenía
                const d = rcErr.response?.data ? JSON.stringify(rcErr.response.data) : rcErr.message;
                warnings.push(`RC "${rc}" falló (${st || '?'}): ${d}`);
                console.warn(`[_ensureShadowUserWithRCs] RC "${rc}" falló: ${d}`);
            }
        }
    } catch (btpErr) {
        const d = btpErr.response?.data ? JSON.stringify(btpErr.response.data) : btpErr.message;
        warnings.push(`Shadow user BTP falló: ${d}`);
        console.warn(`[_ensureShadowUserWithRCs] cascada BTP falló: ${d}`);
    }

    return { btpId, warnings };
}

function xsuaaApiAxios() {
    return sapCfAxios('CAP_XSUAA_APIACCESS');
}

function mapScimUser(u) {
    const emails = u.emails || [];
    const email = (emails.find(e => e.primary) || emails[0] || {}).value || '';
    const groups = (u.groups || []).map(g => g.display || g.value || '').filter(Boolean);
    const iasExt = u['urn:ietf:params:scim:schemas:extension:sap:2.0:User'] || {};

    let status = u.active === false ? 'inactive' : 'active';
    if (['initial', 'newPassword'].includes(iasExt.status)) {
        status = 'invited';
    }

    return {
        id: u.id || '',
        email,
        firstName: u.name?.givenName || '',
        lastName: u.name?.familyName || '',
        displayName: u.displayName || `${u.name?.givenName || ''} ${u.name?.familyName || ''}`.trim(),
        status,
        groups,
        lastInvitedAt: iasExt.sendMailLastSentDate || null,
    };
}

const PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com',
    'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
    'yahoo.com', 'yahoo.com.ar', 'ymail.com',
    'icloud.com', 'me.com',
    'protonmail.com', 'proton.me',
    'aol.com', 'gmx.com', 'zoho.com',
    'fibertel.com.ar', 'speedy.com.ar', 'arnet.com.ar'  // ISPs locales AR
]);

function extractDomain(email) {
    const m = String(email || '').toLowerCase().trim().match(/@([^@\s]+)$/);
    return m ? m[1] : '';
}

function handleError(error, req, context) {
    const status = error.response?.status;
    const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
    console.error(`[IAS] ${context} → ${status || ''} ${detail}`);
    return req.error(status || 500, `IAS error en ${context}: ${detail}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers BTP — XSUAA apiaccess (destination CAP_XSUAA_APIACCESS)
// En la platform API de XSUAA las Role Collections se exponen como /Groups y se
// referencian por NOMBRE en la URL. El shadow user se identifica por userName+origin.
// ─────────────────────────────────────────────────────────────────────────────
async function _findBTPUserId(axios, userName, origin) {
    const res = await axios({ method: 'GET', url: '/Users', params: { count: 500 } });
    const list = res.data?.resources || res.data?.Resources || [];
    const u = list.find(x =>
        (x.userName || '').toLowerCase() === userName.toLowerCase() &&
        x.origin === origin
    );
    return u?.id || null;
}

async function _ensureBTPShadowUser({ email, firstName, lastName, origin }) {
    const axios = xsuaaApiAxios();
    const existing = await _findBTPUserId(axios, email, origin);
    if (existing) return existing;

    const createRes = await axios({
        method: 'POST',
        url: '/Users',
        headers: { 'Content-Type': 'application/json' },
        data: {
            userName: email,
            name: {
                givenName: firstName || email.split('@')[0],
                familyName: lastName || email.split('@')[0]
            },
            emails: [{ value: email, primary: true }],
            active: true,
            verified: true,
            origin
        }
    });
    return createRes.data?.id;
}

async function _assignBTPRoleCollectionById({ btpId, origin, roleCollection }) {
    const axios = xsuaaApiAxios();
    await axios({
        method: 'POST',
        url: `/Groups/${encodeURIComponent(roleCollection)}/members`,
        headers: { 'Content-Type': 'application/json' },
        data: { origin, type: 'USER', value: btpId }
    });
}

// Custom attribute en IAS (mismo patrón/namespace que addCustomAttribute del BP service)
async function _setIASCustomAttribute(userId, attributeName, attributeValue) {
    const axios = iasAxios();
    await axios({
        method: 'PATCH',
        url: `/scim/Users/${userId}`,
        data: {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{
                op: 'add',
                path: 'urn:sap:cloud:scim:schemas:extension:custom:2.0:User:attributes',
                value: [{ name: attributeName, value: String(attributeValue) }]
            }]
        },
        headers: scimHeaders
    });
}

module.exports = class IASUserService extends cds.ApplicationService {

    async init() {

        const { attachReadOnlyGuard } = require('./utils/read-only-guard');
        attachReadOnlyGuard(this, [
            'getProviderUsers', 'checkBPDuplicate', 'getBTPUsersByRoleCollection',
            'getServiceBPs', 'listBTPOrigins'
        ]);

        this.on('getProviderUsers', async (req) => {
            const axios = iasAxios();
            const allUsers = [];

            try {
                let startIndex = 1;
                const pageSize = 100;

                while (true) {
                    const response = await axios({
                        method: 'GET',
                        url: '/scim/Users',
                        params: { count: pageSize, startIndex },
                        headers: scimHeaders,
                    });

                    const resources = response.data?.Resources || [];
                    const totalResults = response.data?.totalResults || 0;

                    allUsers.push(...resources.map(mapScimUser));

                    if (allUsers.length >= totalResults || resources.length < pageSize) break;
                    startIndex += pageSize;
                }

                return allUsers;

            } catch (error) {
                return handleError(error, req, 'getProviderUsers');
            }
        });

        async function _findBPByEmailDomain(domain) {
            // Opción A — Repo local primero (rápido, si tenés los emails migrados)
            const { Contacts, BusinessPartners } = cds.entities;
            const localContacts = await SELECT.from(Contacts)
                .columns('business_partner_ID', 'contact_email')
                .where(`contact_email like '%@${domain}'`);
            if (localContacts.length) {
                const bp = await SELECT.one.from(BusinessPartners)
                    .where({ ID: localContacts[0].business_partner_ID });
                if (bp) return { source: 'LOCAL', bp_id: bp.ID, bp_name: bp.provider_name };
            }

            // Opción B — S/4 vía endswith (si el servicio lo soporta en V2/V4)
            try {
                const { getS4Service } = require('./utils/s4-connector');
                const s4 = await getS4Service('OP_API_BUSINESS_PARTNER_SRV');
                const hits = await s4.run(
                    SELECT.from('OP_API_BUSINESS_PARTNER_SRV.A_AddressEmailAddress')
                        .where(`endswith(EmailAddress, '@${domain}')`)
                        .limit(1)
                );
                if (hits?.length) {
                    return { source: 'S4', bp_id: '', bp_name: hits[0].AddressID || '' };
                }
            } catch (e) {
                console.warn(`[checkBPDuplicate] match por dominio en S4 no disponible: ${e.message}`);
            }

            return null;
        }

        this.on('getServiceBPs', async (req) => {
            try {
                const { BusinessPartners, Contacts, TaxNumbers, CollectionsEmails } = cds.entities;

                const bps = await SELECT.from(BusinessPartners)
                    .columns('ID', 'provider_name', 'business_partner_number', 'lifnr');

                const result = [];
                for (const bp of bps) {
                    const contact = await SELECT.one.from(Contacts)
                        .columns('contact_email', 'contact_first_name', 'contact_last_name')
                        .where({ business_partner_ID: bp.ID });

                    const tax = await SELECT.one.from(TaxNumbers)
                        .columns('identification_number')
                        .where({ business_partner_ID: bp.ID });

                    const collEmails = await SELECT.from(CollectionsEmails)
                        .columns('email', 'sector')
                        .where({ business_partner_ID: bp.ID });

                    // Reunir todos los invitables del BP, dedup por email.
                    const invitables = [];
                    const seen = new Set();
                    const add = (email, sector, firstName, lastName) => {
                        const e = String(email || '').trim().toLowerCase();
                        if (!e || seen.has(e)) return;
                        seen.add(e);
                        invitables.push({ email: email.trim(), sector, firstName, lastName });
                    };

                    add(contact?.contact_email, 'Contacto',
                        contact?.contact_first_name, contact?.contact_last_name);
                    collEmails.forEach(ce => add(ce.email, ce.sector || 'Cobranzas', '', ''));

                    const base = {
                        bp_id: bp.ID,
                        name: bp.provider_name || '',
                        cuit: tax?.identification_number || '',
                        lifnr: bp.lifnr || bp.business_partner_number || '',
                    };

                    invitables.forEach(inv => result.push({
                        ...base,
                        email: inv.email,
                        sector: inv.sector,
                        firstName: inv.firstName || inv.email.split('@')[0],
                        lastName: inv.lastName || bp.provider_name || '',
                    }));
                }

                return result.filter(r => r.email);

            } catch (error) {
                return handleError(error, req, 'getServiceBPs');
            }
        });
        this.on('getBTPUsersByRoleCollection', async (req) => {
            const { roleCollection } = req.data;
            if (!roleCollection) return req.error(400, '"roleCollection" es obligatorio.');
            try {
                const { found, users } = await _getBTPUsersByRoleCollection(roleCollection);
                if (!found) return req.error(404, `Role Collection "${roleCollection}" no encontrada en BTP.`);
                return { roleCollection, count: users.length, users };
            } catch (err) {
                const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                console.error(`[getBTPUsersByRoleCollection] Error: ${detail}`);
                return req.error(err.response?.status || 500, `Error obteniendo usuarios de la Role Collection: ${detail}`);
            }
        });

        this.on('checkBPDuplicate', async (req) => {
            const { razonSocial, cuit, email } = req.data;

            if (!cuit && !email) {
                return req.error(400, 'Se requiere al menos "cuit" o "email".');
            }

            const cuitNorm = String(cuit || '').replace(/\D/g, '');
            const domain = extractDomain(email);
            const isPublicDomain = !domain || PUBLIC_EMAIL_DOMAINS.has(domain);

            const { BusinessPartners, TaxNumbers, Contacts } = cds.entities;

            try {
                // ── 1. Match por CUIT ───────────────────────────────────────────────
                if (cuitNorm) {
                    const taxHit = await SELECT.one.from(TaxNumbers)
                        .columns('business_partner_ID')
                        .where({ identification_number: cuitNorm });

                    if (taxHit?.business_partner_ID) {
                        const bp = await SELECT.one.from(BusinessPartners)
                            .columns('ID', 'provider_name')
                            .where({ ID: taxHit.business_partner_ID });
                        if (bp) {
                            return {
                                alreadyDone: true, source: 'LOCAL', bp_id: bp.ID,
                                bp_name: bp.provider_name || '', matchedBy: 'CUIT'
                            };
                        }
                    }

                    const { getS4Service } = require('./utils/s4-connector');
                    const s4 = await getS4Service('OP_API_BUSINESS_PARTNER_SRV');
                    const s4Hit = await s4.run(
                        SELECT.one.from('OP_API_BUSINESS_PARTNER_SRV.A_Supplier')
                            .where({ TaxNumber1: cuitNorm })
                    );
                    if (s4Hit) {
                        return {
                            alreadyDone: true, source: 'S4', bp_id: '',
                            bp_name: s4Hit.SupplierName || '', matchedBy: 'CUIT'
                        };
                    }
                }

                // ── 2. Match por dominio corporativo (solo si NO es público) ────────
                if (!isPublicDomain) {
                    const contactHit = await SELECT.one.from(Contacts)
                        .columns('business_partner_ID', 'contact_email')
                        .where(`contact_email like '%@${domain}'`);

                    if (contactHit?.business_partner_ID) {
                        const bp = await SELECT.one.from(BusinessPartners)
                            .columns('ID', 'provider_name')
                            .where({ ID: contactHit.business_partner_ID });
                        if (bp) {
                            return {
                                alreadyDone: true, source: 'LOCAL', bp_id: bp.ID,
                                bp_name: bp.provider_name || '', matchedBy: 'DOMAIN'
                            };
                        }
                    }

                    try {
                        const { getS4Service } = require('./utils/s4-connector');
                        const s4 = await getS4Service('OP_API_BUSINESS_PARTNER_SRV');
                        const hits = await s4.run(
                            SELECT.from('OP_API_BUSINESS_PARTNER_SRV.A_AddressEmailAddress')
                                .where(`endswith(EmailAddress, '@${domain}')`)
                                .limit(1)
                        );
                        if (hits?.length) {
                            return {
                                alreadyDone: true, source: 'S4', bp_id: '',
                                bp_name: hits[0].EmailAddress || '', matchedBy: 'DOMAIN'
                            };
                        }
                    } catch (e) {
                        console.warn(`[checkBPDuplicate] match por dominio en S4 no disponible: ${e.message}`);
                    }
                }

                return { alreadyDone: false, source: 'NONE', bp_id: '', bp_name: '' };

            } catch (error) {
                return handleError(error, req, 'checkBPDuplicate');
            }
        });

        async function _inviteSingleUser({ email, firstName, lastName, caller, roleCollection, roleCollections, businessPartnerNumber, ensureRolesIfExists }) {
            const groupName = process.env.IAS_PROVIDER_GROUP || null;
            const btpOrigin = process.env.IAS_ORIGIN_KEY;
            const axios = iasAxios();
            const { ApplicationLogs } = cds.entities;
            const warnings = [];

            const rcList = (roleCollections?.length ? roleCollections : [roleCollection]).filter(Boolean);

            // 1. ¿Ya existe en IAS?
            const searchRes = await axios({
                method: 'GET', url: '/scim/Users',
                params: { filter: `emails.value eq "${email}"` },
                headers: scimHeaders,
            });
            if (searchRes.data?.totalResults > 0) {
                const existing = searchRes.data.Resources[0];

                // Camino A (sin ensureRolesIfExists): comportamiento original → skip
                if (!ensureRolesIfExists) {
                    await INSERT.into(ApplicationLogs).entries({
                        app: 'Gestión IAS', modification: 'IAS_INVITE_SKIPPED',
                        description: `Invitación cancelada para "${email}": ya existe en IAS (id: ${existing.id}). Solicitado por: ${caller}.`,
                        ticket_display: email, result: 'INFO',
                    });
                    return { success: false, existed: true, iasUserId: existing.id, message: `El usuario "${email}" ya existe en IAS.` };
                }

                // Camino B: NO recrear en IAS; asegurar RCs en BTP (idempotente → agrega solo lo que falta, ej. precert)
                const { btpId, warnings: rcW } = await _ensureShadowUserWithRCs({ email, firstName, lastName, origin: btpOrigin, rcList });
                await INSERT.into(ApplicationLogs).entries({
                    app: 'Gestión IAS', modification: 'IAS_ROLES_ENSURED',
                    description: `Usuario "${email}" ya existía en IAS (id: ${existing.id}). RC aseguradas: ${rcList.join(', ') || '—'}${btpId ? ` (btpId: ${btpId})` : ''}. Solicitado por: ${caller}.${rcW.length ? ' Advertencias: ' + rcW.join(' | ') : ''}`,
                    ticket_display: email, result: rcW.length ? 'WARNING' : 'SUCCESS',
                });
                return {
                    success: true,
                    existed: true,
                    iasUserId: existing.id,
                    message: rcW.length
                        ? `"${email}" ya existía; roles asegurados con advertencias: ${rcW.join(' | ')}`
                        : `"${email}" ya existía; se aseguraron sus roles (incluido precert).`
                };
            }

            // 2. ID del grupo IAS (solo si está configurado)
            let groupId = null;
            if (groupName) {
                try {
                    const groupRes = await axios({
                        method: 'GET', url: '/scim/Groups',
                        params: { filter: `displayName eq "${groupName}"` },
                        headers: scimHeaders,
                    });
                    groupId = groupRes.data?.Resources?.[0]?.id || null;
                } catch (groupErr) {
                    console.warn(`[_inviteSingleUser] No se pudo consultar el grupo IAS: ${groupErr.message}`);
                }
            }

            // 3. Crear usuario IAS (con sendMail para que llegue el mail de activación)
            const newUser = {
                schemas: [
                    'urn:ietf:params:scim:schemas:core:2.0:User',
                    'urn:ietf:params:scim:schemas:extension:sap:2.0:User'
                ],
                userName: email,
                displayName: `${firstName} ${lastName}`,
                name: { givenName: firstName, familyName: lastName },
                emails: [{ value: email, primary: true }],
                active: true,
                'urn:ietf:params:scim:schemas:extension:sap:2.0:User': {
                    sendMail: true,
                    mailVerified: false,
                },
                ...(groupId && { groups: [{ value: groupId, display: groupName }] }),
            };
            const createRes = await axios({
                method: 'POST', url: '/scim/Users', data: newUser, headers: scimHeaders,
            });
            const createdId = createRes.data?.id;

            // 3.5 Custom attribute en IAS (business_partner_number → customAttribute1)
            if (businessPartnerNumber) {
                try {
                    await _setIASCustomAttribute(createdId, 'customAttribute1', businessPartnerNumber);
                } catch (attrErr) {
                    const d = attrErr.response?.data ? JSON.stringify(attrErr.response.data) : attrErr.message;
                    warnings.push(`customAttribute1 falló: ${d}`);
                    console.warn(`[_inviteSingleUser] customAttribute1 falló: ${d}`);
                }
            }

            // 4. PATCH al grupo IAS (fallback, solo si hay grupo configurado)
            if (groupName && groupId && createdId) {
                try {
                    await axios({
                        method: 'PATCH', url: `/scim/Groups/${groupId}`,
                        data: {
                            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                            Operations: [{ op: 'add', path: 'members', value: [{ value: createdId }] }],
                        },
                        headers: scimHeaders,
                    });
                } catch (patchErr) {
                    console.warn(`[_inviteSingleUser] No se pudo asignar grupo IAS vía PATCH: ${patchErr.message}`);
                }
            }

            // 5. Cascada BTP: shadow user + Role Collections (idempotente)
            const { btpId, warnings: rcW } = await _ensureShadowUserWithRCs({ email, firstName, lastName, origin: btpOrigin, rcList });
            warnings.push(...rcW);

            await INSERT.into(ApplicationLogs).entries({
                app: 'Gestión IAS', modification: 'IAS_USER_INVITED',
                description: `Usuario "${email}" (${firstName} ${lastName}) creado en IAS (id: ${createdId}). RC BTP: ${rcList.join(', ') || '—'}${btpId ? ` (btpId: ${btpId})` : ''}.${businessPartnerNumber ? ` BP: ${businessPartnerNumber}.` : ''} Solicitado por: ${caller}.${warnings.length ? ' Advertencias: ' + warnings.join(' | ') : ''}`,
                ticket_display: email, result: warnings.length ? 'WARNING' : 'SUCCESS',
            });

            const baseMsg = `Usuario "${email}" creado en IAS. Email de activación enviado.`;
            return {
                success: true,
                existed: false,
                iasUserId: createdId,
                message: warnings.length ? `${baseMsg} Advertencias: ${warnings.join(' | ')}` : baseMsg
            };
        }
        // ── Camino B: invitar BPs de servicios → Activo + Precert + tiles WZ ──────────
        this.on('inviteBPUsers', async (req) => {
            const { invitations } = req.data;

            if (!Array.isArray(invitations) || invitations.length === 0) {
                return req.error(400, '"invitations" debe ser un array no vacío de { bp_id, email }.');
            }

            const { BusinessPartners, Contacts, CollectionsEmails } = cds.entities;
            const caller = req.user?.id || 'sistema';
            const details = [];
            let invited = 0, updated = 0, skipped = 0;

            const proveedorActivoRCs = [
                process.env.BTP_RC_ACTIVO || 'Proveedor_Activo',
                process.env.BTP_RC_WZ_PRECERT || 'WZ_Proveedor_Precert',
            ];

            for (const inv of invitations) {
                const bp_id = inv?.bp_id;
                const emailSel = String(inv?.email || '').trim();

                try {
                    if (!bp_id || !emailSel) {
                        skipped++;
                        details.push({ bp_id: bp_id || '', email: emailSel, result: 'DATOS_INCOMPLETOS' });
                        continue;
                    }

                    const bp = await SELECT.one.from(BusinessPartners)
                        .columns('ID', 'provider_name', 'business_partner_number', 'lifnr')
                        .where({ ID: bp_id });

                    if (!bp) {
                        skipped++;
                        details.push({ bp_id, email: emailSel, result: 'BP_NO_ENCONTRADO' });
                        continue;
                    }

                    // Validar que el email pertenezca al BP (contacto o cobranzas). Sin esto,
                    // el caller podría mandar cualquier email colgado de un bp_id ajeno.
                    const emailNorm = emailSel.toLowerCase();
                    const contact = await SELECT.one.from(Contacts)
                        .columns('contact_email', 'contact_first_name', 'contact_last_name')
                        .where({ business_partner_ID: bp_id });

                    const collEmails = await SELECT.from(CollectionsEmails)
                        .columns('email', 'sector')
                        .where({ business_partner_ID: bp_id });

                    const isContactEmail = (contact?.contact_email || '').trim().toLowerCase() === emailNorm;
                    const isCollEmail = collEmails.some(e => (e.email || '').trim().toLowerCase() === emailNorm);

                    if (!isContactEmail && !isCollEmail) {
                        skipped++;
                        details.push({ bp_id, email: emailSel, result: 'EMAIL_NO_PERTENECE_AL_BP' });
                        continue;
                    }

                    // Nombre: si el email es el del contacto principal, usamos su nombre;
                    // si es de cobranzas, no tenemos nombre → derivamos del email / provider_name.
                    const firstName = isContactEmail
                        ? (contact?.contact_first_name || emailSel.split('@')[0])
                        : emailSel.split('@')[0];
                    const lastName = isContactEmail
                        ? (contact?.contact_last_name || bp.provider_name || firstName)
                        : (bp.provider_name || firstName);

                    const businessPartnerNumber = bp.business_partner_number || bp.lifnr || '';

                    const result = await _inviteSingleUser({
                        email: emailSel, firstName, lastName, caller,
                        roleCollections: proveedorActivoRCs,
                        businessPartnerNumber,
                        ensureRolesIfExists: true
                    });

                    if (result.success && result.existed) {
                        updated++;
                        details.push({ bp_id, email: emailSel, result: 'ACTUALIZADO_PRECERT' });
                    } else if (result.success) {
                        invited++;
                        details.push({ bp_id, email: emailSel, result: 'INVITADO' });
                    } else {
                        skipped++;
                        details.push({ bp_id, email: emailSel, result: result.message || 'OMITIDO' });
                    }

                } catch (err) {
                    skipped++;
                    details.push({ bp_id: bp_id || '', email: emailSel, result: `ERROR: ${err.message}` });
                }
            }

            return { invited, updated, skipped, details };
        });
        // ── Camino A: invitar desde el cuadro → ProveedorProvisorio (sin custom attr) ──
        this.on('inviteProviderUser', async (req) => {
            const { email, firstName, lastName, razonSocial, cuit } = req.data;
            if (!email || !firstName || !lastName || !cuit) {
                return req.error(400, '"email", "firstName", "lastName" y "cuit" son obligatorios.');
            }
            const caller = req.user?.id || 'sistema';

            const cuitNorm = String(cuit).replace(/\D/g, '');
            try {
                const { BusinessPartners, TaxNumbers } = cds.entities;
                const taxHit = await SELECT.one.from(TaxNumbers)
                    .columns('business_partner_ID')
                    .where({ identification_number: cuitNorm });

                if (taxHit?.business_partner_ID) {
                    const bp = await SELECT.one.from(BusinessPartners)
                        .columns('ID', 'provider_name')
                        .where({ ID: taxHit.business_partner_ID });
                    if (bp) {
                        return {
                            success: false, iasUserId: null,
                            message: `El CUIT ${cuit} ya existe como proveedor (${bp.provider_name || bp.ID}).`
                        };
                    }
                }

                const { getS4Service } = require('./utils/s4-connector');
                const s4 = await getS4Service('OP_API_BUSINESS_PARTNER_SRV');
                const s4Hit = await s4.run(
                    SELECT.one.from('OP_API_BUSINESS_PARTNER_SRV.A_Supplier')
                        .where({ TaxNumber1: cuitNorm })
                );
                if (s4Hit) {
                    return {
                        success: false, iasUserId: null,
                        message: `El CUIT ${cuit} ya existe como proveedor (${s4Hit.SupplierName || s4Hit.Supplier}).`
                    };
                }
            } catch (error) {
                const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
                console.error(`[inviteProviderUser] Error validando CUIT: ${detail}`);
                return req.error(500, `Error validando CUIT: ${detail}`);
            }

            try {
                const result = await _inviteSingleUser({
                    email, firstName, lastName, caller,
                    roleCollections: [
                        process.env.BTP_RC_PROVISORIO || 'ProveedorProvisorio',
                        process.env.BTP_RC_WZ_PROVEEDOR || 'WZ_Proveedor',
                    ]
                });
                return result;
            } catch (error) {
                const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
                console.error(`[inviteProviderUser] Error: ${detail}`);
                try {
                    await INSERT.into(cds.entities.ApplicationLogs).entries({
                        app: 'Gestión IAS', modification: 'IAS_INVITE_ERROR',
                        description: `Error al crear usuario "${email}" en IAS. Detalle: ${detail}. Solicitado por: ${caller}.`,
                        ticket_display: email, result: 'ERROR',
                    });
                } catch (_) { }
                return { success: false, iasUserId: null, message: `Error al crear usuario en IAS: ${detail}` };
            }
        });
        // Helper: leer un custom attribute (business_partner_number) de un user IAS
        function _extractCustomAttr(u, name) {
            const ext = u['urn:sap:cloud:scim:schemas:extension:custom:2.0:User'] || {};
            const hit = (ext.attributes || []).find(a => a.name === name);
            return hit?.value || null;
        }

        this.on('resendInvitation', async (req) => {
            const { iasUserId } = req.data;
            if (!iasUserId) return req.error(400, '"iasUserId" es obligatorio.');

            const axios = iasAxios();
            const { ApplicationLogs } = cds.entities;
            const caller = req.user?.id || 'sistema';

            try {
                // 1. Leer el usuario actual (necesitamos sus datos para recrearlo)
                const getRes = await axios({ method: 'GET', url: `/scim/Users/${iasUserId}`, headers: scimHeaders });
                const u = getRes.data;
                const email = (u.emails?.find(e => e.primary) || u.emails?.[0] || {}).value || u.userName;
                const firstName = u.name?.givenName || '';
                const lastName = u.name?.familyName || '';
                const bpNumber = _extractCustomAttr(u, 'customAttribute1');

                const iasExt = u['urn:ietf:params:scim:schemas:extension:sap:2.0:User'] || {};

                // DEBUG temporal — ver qué devuelve IAS realmente para este user
                console.log(`[resendInvitation] ${email} → active=${u.active} mailVerified=${iasExt.mailVerified} status=${iasExt.status} pwdStatus=${iasExt.passwordDetails?.status}`);

                // "Activado" = verificó el mail / seteó su password. OJO: active:true NO
                // es activado (todos nacen active:true en la invitación).
                // Solo bloqueo si HAY evidencia positiva de activación.
                if (iasExt.mailVerified === true) {
                    return { success: false, message: `El usuario "${email}" ya activó su cuenta (mail verificado); no corresponde reenviar.` };
                }

                // 2. Borrar en IAS. El shadow user de BTP y la Role Collection NO se tocan:
                //    se matchean por email+origin, así que sobreviven al delete.
                await axios({ method: 'DELETE', url: `/scim/Users/${iasUserId}`, headers: scimHeaders });

                // 3. Recrear con sendMail=true → IAS reenvía el mail de activación
                const newUser = {
                    schemas: [
                        'urn:ietf:params:scim:schemas:core:2.0:User',
                        'urn:ietf:params:scim:schemas:extension:sap:2.0:User'
                    ],
                    userName: email,
                    displayName: `${firstName} ${lastName}`.trim(),
                    name: { givenName: firstName, familyName: lastName },
                    emails: [{ value: email, primary: true }],
                    active: true,
                    'urn:ietf:params:scim:schemas:extension:sap:2.0:User': { sendMail: true, mailVerified: false },
                };
                const createRes = await axios({ method: 'POST', url: '/scim/Users', data: newUser, headers: scimHeaders });
                const newId = createRes.data?.id;

                // 3.5 Re-aplicar customAttribute1 si venía del camino B (se pierde al borrar)
                if (bpNumber) {
                    try { await _setIASCustomAttribute(newId, 'customAttribute1', bpNumber); }
                    catch (e) { console.warn(`[resendInvitation] no se pudo re-setear customAttribute1: ${e.message}`); }
                }

                await INSERT.into(ApplicationLogs).entries({
                    app: 'Gestión IAS', modification: 'IAS_INVITE_RESENT',
                    description: `Invitación reenviada a "${email}": user IAS recreado (viejo id ${iasUserId} → nuevo id ${newId}). Solicitado por: ${caller}.`,
                    ticket_display: email, result: 'SUCCESS',
                });
                return { success: true, iasUserId: newId, message: `Email de activación reenviado a "${email}".` };

            } catch (error) {
                return handleError(error, req, 'resendInvitation');
            }
        });

        // ── Endpoints sueltos (testing por Postman) ─────────────────────────────
        this.on('createBTPShadowUser', async (req) => {
            const { email, firstName, lastName, origin } = req.data;
            if (!email || !origin) return req.error(400, '"email" y "origin" son obligatorios.');
            try {
                const axios = xsuaaApiAxios();
                const existing = await _findBTPUserId(axios, email, origin);
                if (existing) {
                    return { success: true, userId: existing, message: `El shadow user "${email}" ya existía en BTP (id: ${existing}).` };
                }
                const btpId = await _ensureBTPShadowUser({ email, firstName, lastName, origin });
                return { success: true, userId: btpId, message: `Shadow user "${email}" creado en BTP (id: ${btpId}).` };
            } catch (err) {
                const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                console.error(`[createBTPShadowUser] Error: ${detail}`);
                return req.error(err.response?.status || 500, `Error creando shadow user en BTP: ${detail}`);
            }
        });

        this.on('assignBTPRoleCollection', async (req) => {
            const { email, origin, roleCollection } = req.data;
            if (!email || !origin || !roleCollection) {
                return req.error(400, '"email", "origin" y "roleCollection" son obligatorios.');
            }
            try {
                const btpId = await _findBTPUserId(xsuaaApiAxios(), email, origin);
                if (!btpId) {
                    return req.error(404, `El shadow user "${email}" (origin ${origin}) no existe en BTP. Crealo primero con createBTPShadowUser.`);
                }
                await _assignBTPRoleCollectionById({ btpId, origin, roleCollection });
                return { success: true, message: `"${email}" asignado a la Role Collection "${roleCollection}".` };
            } catch (err) {
                const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                console.error(`[assignBTPRoleCollection] Error: ${detail}`);
                return req.error(err.response?.status || 500, `Error asignando Role Collection: ${detail}`);
            }
        });

        // Helper para descubrir el origin key real del trust de IAS
        this.on('listBTPOrigins', async (req) => {
            try {
                const res = await xsuaaApiAxios()({ method: 'GET', url: '/Users', params: { count: 500 } });
                const list = res.data?.resources || res.data?.Resources || [];
                const origins = [...new Set(list.map(u => u.origin).filter(Boolean))];
                return { origins };
            } catch (err) {
                const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                return req.error(err.response?.status || 500, `Error listando origins: ${detail}`);
            }
        });

        return super.init();
    }
};