const SapCfAxios = require('sap-cf-axios').default;
const FormData = require('form-data');
const destinationName = 'baitcon-exia-dms-repo';
const dmsDestination = SapCfAxios(destinationName);
const axios = require('axios');

const createFolder = async (folderName) => {
  const oForm = new FormData();

  oForm.append('cmisaction', 'createFolder');
  oForm.append('propertyId[0]', 'cmis:name'); 
  oForm.append('propertyValue[0]', folderName); 
  oForm.append('propertyId[1]', 'cmis:objectTypeId');
  oForm.append('propertyValue[1]', 'cmis:folder'); 
  oForm.append('succinct', 'true'); 

  try {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: '/root',
      headers: {
        ...oForm.getHeaders(),
      },
      data: oForm,
    };
    const response = await dmsDestination(config);
    return response.data; 
  } catch (error) {
    console.error('Error al crear la carpeta:', error);
    throw error;
  }
};

const uploadDocument = async (folderName, name, fileData) => {
  const oForm = new FormData();

  oForm.append('cmisaction', 'createDocument');
  oForm.append('propertyId[0]', 'cmis:name'); 
  oForm.append('propertyId[1]', 'cmis:objectTypeId');
  oForm.append('propertyValue[1]', 'cmis:document'); 
  oForm.append('succinct', 'true');

  const CRLF = '\r\n';
  const formOptions = {
    header:
                '--' + oForm.getBoundary() + CRLF +
                'Content-Disposition: form-data; name="propertyValue[0]"' + CRLF +
                'Content-Type: text/plain;charset=UTF-8' + CRLF + CRLF,
  };
  oForm.append('propertyValue[0]', name, formOptions);

  const buffer = Buffer.from(fileData, 'base64');

  const fileOptions = {
    header:
                '--' + oForm.getBoundary() + CRLF +
                'Content-Disposition: form-data; name="file"; filename*=UTF-8' + CRLF +
                'Content-Type: Binary' + CRLF + CRLF,
  };
  oForm.append('file', buffer, fileOptions);

  const data = oForm.getBuffer();

  try {
    const config = {
      method: 'post',
      url: `/root/${folderName}/`,
      headers: {
        ...oForm.getHeaders(),
      },
      data: data,
    };
    const response = await dmsDestination(config);
    return response.data; 
  } catch (error) {
    console.error('Error al subir el Documento:', error);
    throw error;
  }
};

const deleteObject = async (objectId, type, relativePath = '') => {
  const oForm = new FormData();
  oForm.append('cmisaction', type);
  oForm.append('objectId', objectId);
  oForm.append('continueOnFailure', 'true');

  const url = `/root${relativePath ? '/' + relativePath : ''}`;

  try {
    const config = {
      method: 'post',
      url: url,
      headers: {
        ...oForm.getHeaders(),
      },
      data: oForm,
    };
    const response = await dmsDestination(config);
    return response.data; 
  } catch (error) {
    console.error('Error al borrar:', error);
    throw error;
  }
};

const deleteFolder = async (folderId) => {
  return deleteObject(folderId, 'deleteTree');
};

const deleteDocument = async (documentId, folderName) => {
  return deleteObject(documentId, 'delete', folderName);
};

const getDocument = async (folderName, documentName) => {
  try {
    const encodedFolderName = encodeURIComponent(folderName);
    const encodedDocumentName = encodeURIComponent(documentName);
    const config = {
      method: 'get',
      url: `/root/${encodedFolderName}/${encodedDocumentName}`,
      responseType: 'arraybuffer',
    };
    const response = await dmsDestination(config);
    const responseBuffer = Buffer.from(response.data, 'binary');
    return responseBuffer;
        
  } catch (error) {
    console.error('Error al obtener el Documento:', error);
    throw new Error('Error al descargar el archivo desde DMS');
  }
};

module.exports = { createFolder, uploadDocument, deleteFolder, deleteDocument, getDocument };