const { getDestination } = require('@sap-cloud-sdk/connectivity');
const FormData = require('form-data');
const axios = require('axios');
const https = require('https');
const DESTINATION_NAME = 'DOX';

/**
 * Sube un archivo PDF al servicio DOX.
 * @param {Buffer} buffer - Contenido del PDF como buffer.
 * @param {String} filename - Nombre del archivo (opcional).
 * @returns {Promise<Object>} - Respuesta con documentId, jobId y status.
 */
async function uploadPdf(buffer, filename = 'invoice.pdf') {
  const form = new FormData();

  // Agregamos el archivo PDF
  form.append('files', buffer, {
    filename,
    contentType: 'application/pdf',
  });

  // Agregamos las opciones
  form.append('options', JSON.stringify({
    clientId: 'default',
    documentType: 'invoice',
    schemaId: 'c0b723c4-f54d-4bf4-b4df-b5853bfb817f',
    schemaVersion: '1',
  }));

  // Obtenemos destination desde BTP
  const destination = await getDestination({ destinationName: DESTINATION_NAME });

  const baseURL =
    destination.url !== 'https://sap.com/DUMMY_URL'
      ? destination.url
      : destination.originalProperties?.destinationConfiguration?.url;

  const token = destination.authTokens?.[0]?.value;
  const tenantId = destination.originalProperties?.uaa?.tenantid || '21d57874-d2fa-4b40-a5c3-b88d8faa197f';

  if (!token || !baseURL) {
    throw new Error('No se pudo obtener token o URL del destination DOX');
  }

  // Obtenemos la longitud del form para el header Content-Length
  const contentLength = await new Promise((resolve, reject) => {
    form.getLength((err, length) => {
      if (err) reject(err);
      else resolve(length);
    });
  });

  // Configuración del request HTTPS
  const requestOptions = {
    method: 'POST',
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}`,
      'x-tenant': tenantId,
      'Content-Length': contentLength,
    },
  };

  console.log(Buffer.isBuffer(buffer));             // debe ser true
  console.log(buffer.length);                       // debe ser > 0
  console.log(buffer.toString('utf8', 0, 4));       // debe ser '%PDF'
  console.log('Form keys:', form.getBuffer().toString('utf8').slice(0, 500));



  // Promesa para enviar el request
  const response = await new Promise((resolve, reject) => {
    const req = https.request(
      `${baseURL}/document-information-extraction/v1/document/jobs`,
      requestOptions,
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              console.error('DOX error:', res.statusCode, json);
              reject(new Error(`DOX error ${res.statusCode}: ${json.error?.message || 'Unknown error'}`));
            }
          } catch (e) {
            reject(new Error('Error parsing DOX response'));
          }
        });
      },
    );

    req.on('error', (err) => {
      reject(err);
    });

    // Enviamos el contenido del form
    form.pipe(req);
  });

  return response;
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
