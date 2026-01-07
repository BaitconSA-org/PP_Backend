const { getDestination } = require('@sap-cloud-sdk/connectivity');
const cds = require('@sap/cds');
const FormData = require('form-data');
const axios = require('axios');

const DESTINATION_NAME = 'DOX';
const DUMMY_URL = 'https://sap.com/DUMMY_URL';

/* ----------------------------- helpers --------------------------------- */

function safeJsonParse(v) {
  if (!v || typeof v !== 'string') return null;
  try { return JSON.parse(v); } catch { return null; }
}

function resolveBaseURL(destination) {
  // 1) si el URL principal no es dummy
  if (destination?.url && destination.url !== DUMMY_URL) {
    return destination.url.replace(/\/+$/, '');
  }

  // 2) destinationConfiguration suele traer additional properties
  const cfg = destination?.originalProperties?.destinationConfiguration || {};

  // en tu destination DOX real: endpoints={"backend":{"url":"https://aiservices-dox..."}}
  const endpoints = safeJsonParse(cfg.endpoints);
  if (endpoints?.backend?.url) return endpoints.backend.url.replace(/\/+$/, '');

  // fallback a additional property "url"
  if (cfg.url && cfg.url !== DUMMY_URL) return String(cfg.url).replace(/\/+$/, '');

  // último fallback: a veces viene en mayúsculas
  if (cfg.URL && cfg.URL !== DUMMY_URL) return String(cfg.URL).replace(/\/+$/, '');

  return null;
}

function logAxiosError(err, tag = 'DOX') {
  console.error(`[${tag}]`, {
    message: err?.message,
    status: err?.response?.status,
    data: err?.response?.data,
    method: err?.config?.method,
    url: err?.config?.url,
    params: err?.config?.params,
  });
}

/* ------------------------- schemaId resolver --------------------------- */

const _schemaCache = new Map();

async function _getSchemaId({ baseURL, token, clientId, documentType, schemaName }) {
  const cacheKey = `${clientId}|${documentType}|${schemaName}`;
  if (_schemaCache.has(cacheKey)) return _schemaCache.get(cacheKey);

  let data;
  try {
    const res = await axios.get(
      `${baseURL}/document-information-extraction/v1/schemas`,
      {
        params: { clientId },
        headers: { Authorization: `Bearer ${token}` },
        maxBodyLength: Infinity,
        timeout: 30000,
      },
    );
    data = res.data;
  } catch (err) {
    logAxiosError(err, 'DOX GET /schemas');
    throw err;
  }

  // debug opcional: lista acotada de schemas
  if (process.env.DOX_DEBUG_SCHEMAS === 'true') {
    const schemas = data?.schemas || [];
    console.log('[DOX GET /schemas] schemas_count:', schemas.length);
    console.log('[DOX GET /schemas] sample:', schemas.slice(0, 30).map(s => ({
      id: s.id, name: s.name, documentType: s.documentType,
    })));
  }

  const match = data.schemas?.find(
    s =>
      String(s.name || '').trim() === String(schemaName).trim() &&
      String(s.documentType || '').trim() === String(documentType).trim(),
  );

  if (!match) throw new Error(`Schema "${schemaName}" no encontrado para ${documentType} (clientId=${clientId})`);

  _schemaCache.set(cacheKey, match.id);
  return match.id;
}

/* ------------------------------ upload --------------------------------- */

async function uploadPdf(
  buffer,
  filename,
  {
    clientId     = process.env.DOX_CLIENT_ID || 'default',
    documentType = 'invoice',
    schemaName   = 'invoice_portal',
    templateId   = process.env.DOX_TEMPLATE_ID,
    tenant       = process.env.DOX_TENANT || cds.context?.tenant, 
  } = {},
) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('El parámetro "buffer" debe contener un PDF');
  }

  const destination = await getDestination({ destinationName: DESTINATION_NAME });
  const baseURL = resolveBaseURL(destination);
  const token = destination?.authTokens?.[0]?.value;

  if (!token || !baseURL) {
    throw new Error('No se pudo obtener token o URL del destination DOX');
  }

  // log claro de config (sin secretos)
  console.log('📍 DOX config:', {
    baseURL,
    clientId,
    documentType,
    schemaName,
    templateId: templateId ? 'SET' : 'NOT_SET',
    tenant: tenant || '(none)',
    disableXTenant: process.env.DOX_DISABLE_X_TENANT === 'true',
  });

  const schemaId = await _getSchemaId({
    baseURL,
    token,
    clientId,
    documentType,
    schemaName,
  });

  const form = new FormData();
  const options = { clientId, documentType, schemaId };
  if (templateId) options.templateId = templateId;
  form.append('file', buffer, { filename, contentType: 'application/pdf' });
  form.append('options', JSON.stringify(options, null, 2));

  const headers = {
    ...form.getHeaders(),
    Authorization: `Bearer ${token}`,
  };

  // Para probar si x-tenant te está rompiendo QAS:
  // export DOX_DISABLE_X_TENANT=true
  if (process.env.DOX_DISABLE_X_TENANT !== 'true' && tenant) {
    headers['x-tenant'] = tenant;
  }

  try {
    const { data } = await axios.post(
      `${baseURL}/document-information-extraction/v1/document/jobs`,
      form,
      {
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 30000,
      },
    );
    return data;
  } catch (err) {
    logAxiosError(err, 'DOX POST /document/jobs');
    throw err;
  }
}

/* ------------------------------ status --------------------------------- */

async function getJobStatus(documentId) {
  const destination = await getDestination({ destinationName: DESTINATION_NAME });
  const baseURL = resolveBaseURL(destination);

  const token = destination?.authTokens?.[0]?.value;
  if (!token || !baseURL) {
    throw new Error('No se pudo obtener el token o URL del destination DOX');
  }

  try {
    const response = await axios.get(
      `${baseURL}/document-information-extraction/v1/document/jobs/${documentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000,
      },
    );

    const { data } = response;

    // Enriquecer lineItems con TaxCode si existe taxRate
    const db = await cds.connect.to('db');

    const lineItems = data?.extraction?.lineItems || [];
    for (const item of lineItems) {
      const taxRateField = item.find(f => f.name === 'taxRate');
      if (taxRateField?.value) {
        const taxRate = parseInt(taxRateField.value, 10);
        const result = await db.run(
          SELECT.one.from('TaxCodes').where({ porcentege: taxRate }),
        );
        taxRateField.TaxCode = result ? result.code : 'NO_ENCONTRADO';
      }
    }

    return response.data;
  } catch (err) {
    logAxiosError(err, 'DOX GET /document/jobs/{id}');
    throw err;
  }
}

module.exports = {
  uploadPdf,
  getJobStatus,
};
