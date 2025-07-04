// srv/dox-service.js

const cds = require('@sap/cds');
const { uploadPdf, getJobStatus } = require('./dox/dox-client');

module.exports = cds.service.impl(function () {
  /**
   * Acción: uploadPdf
   * Recibe el archivo PDF como base64 y lo sube al servicio DOX
   */
  this.on('uploadPdf', async (req) => {
    try {
      const { file, filename } = req.data;

      if (!file) return req.reject(400, 'Missing file');
      const buf = Buffer.from(file, 'base64');

      const result = await uploadPdf(buf, filename || 'invoice.pdf');

      // Opcional: guardar documentId/jobId en una tabla local si querés
      return {
        documentId: result.documentId,
        jobId: result.jobId,
        status: result.status,
      };
    } catch (err) {
      console.error('[uploadPdf] Error:', err.message);
      return req.reject(500, 'Error uploading PDF to DOX');
    }
  });

  /**
   * Acción: checkJob
   * Consulta el estado del procesamiento DOX para un documentId
   */
  this.on('checkJob', async (req) => {
    try {
      const { documentId } = req.data;

      if (!documentId) return req.reject(400, 'Missing documentId');

      const result = await getJobStatus(documentId);

      return {
        status: result.status,
        fields: result.extractedFields || null,
        documentId: result.documentId,
      };
    } catch (err) {
      console.error('[checkJob] Error:', err.message);
      return req.reject(500, 'Error checking DOX job status');
    }
  });
});
