const cds = require('@sap/cds');
const { createFolder, uploadDocument, deleteFolder, deleteDocument } = require('./dms-client'); 

module.exports = cds.service.impl(async function () {
  this.on('createFolderService', async (req) => {
    const folderName = req.data.folderName;
    return createFolder(folderName);
  });

  this.on('uploadDocumentService', async (req) => {
    const { folderName, name } = req.data;
    const fileData = req.data.file;
    return uploadDocument(folderName, name, fileData);
  });

  this.on('deleteFolderService', async (req) => {
    const { folderId } = req.data;
    return deleteFolder(folderId);   
  });

  this.on('deleteDocumentService', async (req) => {
    const { documentId, folderName } = req.data;
    return deleteDocument(documentId, folderName);
  });

});