const { getDestination } = require('@sap-cloud-sdk/connectivity');
const FormData = require('form-data');
const axios = require('axios');
const https = require('https');
const DESTINATION_NAME = 'DOX';

/**
 * Sube un archivo PDF al servicio DOX.
 * @param {Buffer} buffer - Contenido del PDF como buffer.
 * @returns {Promise<Object>} - Respuesta con documentId, jobId y status.
 */

const _schemaCache = new Map();
async function _getSchemaId({ baseURL, token, clientId, documentType, schemaName }) {
  const cacheKey = `${clientId}|${documentType}|${schemaName}`;
  if (_schemaCache.has(cacheKey)) return _schemaCache.get(cacheKey);

  const { data } = await axios.get(
    `${baseURL}/document-information-extraction/v1/schemas`,
    {
      params  : { clientId },
      headers : { Authorization: `Bearer ${token}` },
      maxBodyLength: Infinity,
    },
  );

  const match = data.schemas?.find(
    s => s.name === schemaName && s.documentType === documentType,
  );
  if (!match) throw new Error(`Schema "${schemaName}" no encontrado para ${documentType}`);

  _schemaCache.set(cacheKey, match.id);
  return match.id;
}

async function uploadPdf(
  buffer,
  filename,
  {
    clientId      = 'default',
    documentType  = 'invoice',
    schemaName    = 'invoice_portal',
  } = {},
) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0)
    throw new Error('El parámetro "buffer" debe contener un PDF');

  /* 1. Destination de BTP ------------------------------------------------ */
  const destination = await getDestination({ destinationName: DESTINATION_NAME });
  const baseURL     =
    destination.url !== 'https://sap.com/DUMMY_URL'
      ? destination.url
      : destination.originalProperties?.destinationConfiguration?.url;

  const token     = destination.authTokens?.[0]?.value;
  const tenantId  = destination.originalProperties?.uaa?.tenantid || '21d57874-d2fa-4b40-a5c3-b88d8faa197f';

  if (!token || !baseURL)
    throw new Error('No se pudo obtener token o URL del destination DOX');

  const schemaId = await _getSchemaId({
    baseURL,
    token,
    clientId,
    documentType,
    schemaName,
  });

  /* 3. Construimos el multipart/form-data -------------------------------- */
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: 'application/pdf' });
  form.append(
    'options',
    JSON.stringify({ clientId, documentType, schemaId }, null, 2),
  );

  /* 4. Enviamos ----------------------------------------------------------- */
  const { data } = await axios.post(
    `${baseURL}/document-information-extraction/v1/document/jobs`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`,
        'x-tenant': tenantId,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    },
  );

  return data; // -> { id, status:'PENDING' | 'DONE', ... }
}

/**
 * Consulta el estado del procesamiento DOX.
 * @param {String} documentId - ID del documento procesado.
 * @returns {Promise<Object>} - Respuesta con status, fields, etc.
 */
async function getJobStatus(documentId) {
  const destination = await getDestination({ destinationName: DESTINATION_NAME });
  const baseURL =
  destination.url !== 'https://sap.com/DUMMY_URL'
    ? destination.url
    : destination.originalProperties?.destinationConfiguration?.url;

  if (!destination?.authTokens?.[0]?.value) {
    throw new Error('No se pudo obtener el token del destination DOX');
  }

  const token = destination.authTokens[0].value;
  const response = await axios.get(
    `${baseURL}/document-information-extraction/v1/document/jobs/${documentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
}

module.exports = {
  uploadPdf,
  getJobStatus,
};
