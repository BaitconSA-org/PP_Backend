const { createFolder, uploadDocument } = require('../dms/dms-client');
const { uploadPdf } = require('./dox-client');
const Buffer = require('buffer').Buffer;

async function handleUploadPdf(req) {
  const { supplierId, purchaseOrderId, file, filename } = req.data;

  if (!supplierId || !purchaseOrderId || !file) {
    return req.reject(400, 'Missing supplierId, purchaseOrderId, or file');
  }

  const buf = Buffer.from(file, 'base64');
  const finalFilename = filename || 'invoice.pdf';

  const supplierFolder = supplierId;
  const poFolder = purchaseOrderId;
  const fullPath = `${supplierFolder}/${poFolder}`;

  try {
    // DMS
    await createFolder(supplierFolder).catch(() => {});
    await createFolder(poFolder, supplierFolder).catch(() => {});
    await uploadDocument(fullPath, finalFilename, file);

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
