/* eslint-disable no-console */
const cds = require('@sap/cds');
const dmsClient = require('./dms-client-tickets');

module.exports = cds.service.impl(async function () {

  this.on('createFolderService', async (req) => {
    const { folderName, relativePath } = req.data;
    return dmsClient.createFolder(folderName, relativePath);
  });

  this.on('uploadDocumentService', async (req) => {
    const { folderName, name, file } = req.data;
    return dmsClient.uploadDocument(folderName, name, file);
  });

  this.on('deleteFolderService', async (req) => {
    const { folderId } = req.data;
    return dmsClient.deleteFolder(folderId);
  });

  this.on('deleteDocumentService', async (req) => {
    const { documentId, folderName } = req.data;
    return dmsClient.deleteDocument(documentId, folderName);
  });

  this.on('getFoldersService', async (req) => {
    const { relativePath } = req.data || {};
    const docs = await dmsClient.listarDocumentosEnCarpeta(relativePath);
    return JSON.stringify(docs);
  });

  this.on('getDocumentService', async (req) => {
    const { folderName, documentName } = req.data;
    if (!folderName || !documentName) {
      return req.reject(400, 'folderName y documentName son requeridos');
    }
    try {
      const fileBuffer = await dmsClient.getDocument(folderName, documentName);
      return fileBuffer;
    } catch (error) {
      console.error('Error en getDocumentService:', error);
      return req.reject(500, 'Error al obtener el documento desde DMS');
    }
  });

  this.on('createDocumentService', async (req) => {
    const { businessPartnerId, documentType, description, documentName, file } = req.data;
    if (!businessPartnerId || !documentName || !file) {
      return req.reject(400, 'businessPartnerId, documentName y file son requeridos');
    }
    try {
      const docType = documentType || 'general';
      const docDesc = description || 'sin-descripcion';
      await dmsClient.createFolder(businessPartnerId).catch(() => {});
      await dmsClient.createFolder(docType, businessPartnerId).catch(() => {});
      await dmsClient.createFolder(docDesc, `${businessPartnerId}/${docType}`).catch(() => {});
      const relativePath = `${businessPartnerId}/${docType}/${docDesc}`;
      await dmsClient.uploadDocument(relativePath, documentName, file);
      return `${relativePath}/${documentName}`;
    } catch (error) {
      console.error('Error en createDocumentService:', error);
      return req.reject(500, 'Error al subir el documento al DMS');
    }
  });

});
