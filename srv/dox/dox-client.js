// srv/dox-client.js
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const FormData = require('form-data');

// Nombre del destination que configuraste en BTP
const DESTINATION_NAME = 'DOX';

/**
 * Sube un archivo PDF al servicio DOX.
 * @param {Buffer} buffer - Contenido del PDF como buffer.
 * @param {String} filename - Nombre del archivo (opcional).
 * @returns {Promise<Object>} - Respuesta con documentId y jobId.
 */
async function uploadPdf(buffer, filename = 'invoice.pdf') {
  const form = new FormData();
  form.append('files', buffer, { filename });

  const response = await executeHttpRequest(
    { destinationName: DESTINATION_NAME },
    {
      method: 'POST',
      url: '/document-information-extraction/v1/document/jobs',
      headers: form.getHeaders(),
      data: form,
    },
  );

  return response.data;
}

/**
 * Consulta el estado del procesamiento DOX (ej: RUNNING, DONE).
 * @param {String} documentId - ID del documento extraído.
 * @returns {Promise<Object>} - Respuesta con status y campos extraídos si ya está procesado.
 */
async function getJobStatus(documentId) {
  const response = await executeHttpRequest(
    { destinationName: DESTINATION_NAME },
    {
      method: 'GET',
      //url: `/document-information-extraction/v1/document/jobs/${documentId}`,
      url: '/document-information-extraction/v1/document/jobs',
    },
  );

  return response.data;
}

module.exports = {
  uploadPdf,
  getJobStatus,
};
