const { createFolder, uploadDocument } = require('../dms/dms-client');
const { uploadPdf } = require('./dox-client');
const Buffer = require('buffer').Buffer;
const fs = require('fs');
const path = require('path');

async function handleUploadPdfLocalTest(req) {
  // Valores hardcodeados
  const supplierId = '31300001';
  const purchaseOrderId = '4500000008';
  const filename = 'Test tomi extraccion de datos.pdf';

  // Ruta absoluta al archivo local (ajustá según tu estructura)
  const filePath = path.resolve(__dirname, '../pdfs', filename);

  // Verifica que el archivo exista
  if (!fs.existsSync(filePath)) {
    return req.reject(404, `El archivo "${filename}" no fue encontrado en: ${filePath}`);
  }

  // Leer y convertir a base64
  const buffer = fs.readFileSync(filePath);
  const fileBase64 = buffer.toString('base64');

  const supplierFolder = supplierId;
  const poFolder = purchaseOrderId;
  const fullPath = `${supplierFolder}/${poFolder}`;

  try {
    // Crear carpetas en DMS
    await createFolder(supplierFolder).catch(() => {});
    await createFolder(poFolder, supplierFolder).catch(() => {});

    // Subir a DMS
    await uploadDocument(fullPath, filename, fileBase64);

    // Subir a DOX
    const result = await uploadPdf(buffer, filename);

    return {
      processedTime: result.processedTime,
      documentId: result.documentId ?? result.id,
      jobId: result.jobId,
      status: result.status,
    };

  } catch (err) {
    console.error('[handleUploadPdfLocalTest] Error:', err.message);
    return req.reject(500, 'Error uploading PDF to DMS or DOX');
  }
}

async function handleUploadPdf(req) {
  const { supplierId, purchaseOrderId, file, filename } = req.data;

  /* if(filename === 'test-local.pdf') {
    return await handleUploadPdfLocalTest(req);
  }  */
  

  if (!supplierId || !file) {
    return req.reject(400, 'Missing supplierId or file');
  }

  const buf = Buffer.from(file, 'base64');
  const finalFilename = filename || 'invoice.pdf';

  try {

    // DOX
    const result = await uploadPdf(buf, finalFilename);

    return {
      processedTime: result.processedTime,
      documentId: result.documentId ?? result.id,
      jobId: result.jobId,
      status: result.status,
    };

  } catch (err) {
    console.error('[handleUploadPdf] Error:', err.message);
    return req.reject(500, 'Error uploading PDF to DMS or DOX');
  }
}

module.exports = { handleUploadPdf };
