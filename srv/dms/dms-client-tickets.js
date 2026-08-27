/* eslint-disable no-console */
const SapCfAxios = require('sap-cf-axios').default;
const FormData = require('form-data');
const destinationName = 'DMSDest';
const dmsDestination = SapCfAxios(destinationName);
const axios = require('axios');

// El browser binding de CMIS del SDM expone cada repositorio bajo
// /browser/<repositoryId>. La destination solo lleva la URL base, asi que el
// prefijo /browser/<repo>/root lo arma el codigo (igual que hesmanagement.js y
// abmcontratista.js).
const REPO_ID = process.env.DMS_REPOSITORY_ID;
const DMS_ROOT = () => `/browser/${REPO_ID}/root`;

const createFolder = async (folderName, relativePath = '') => {
  const oForm = new FormData();

  oForm.append('cmisaction', 'createFolder');
  oForm.append('propertyId[0]', 'cmis:name');
  oForm.append('propertyValue[0]', folderName);
  oForm.append('propertyId[1]', 'cmis:objectTypeId');
  oForm.append('propertyValue[1]', 'cmis:folder');
  oForm.append('succinct', 'true');

  try {
    const targetPath = relativePath ? `${DMS_ROOT()}/${relativePath}` : DMS_ROOT();

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: targetPath,
      headers: {
        ...oForm.getHeaders(),
      },
      data: oForm,
    };

    const response = await dmsDestination(config);
    return response.data;

  } catch (error) {
    // Manejar caso cuando ya existe (409)
    if (error.response?.status === 409) {
      console.warn(`La carpeta '${folderName}' ya existe en '${relativePath}', se continúa.`);
      return; // continuar sin lanzar el error
    }

    console.error(`Error al crear la carpeta '${folderName}' en '${relativePath}':`, error.message);
    throw error;
  }
};



const uploadDocument = async (relativePath, name, fileData) => {
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
  const fullPath = relativePath ? `${DMS_ROOT()}/${relativePath}/` : `${DMS_ROOT()}/`;

  try {
    //Buscar si ya existe un documento con el mismo nombre
    const existing = await dmsDestination({
      method: 'get',
      url: fullPath,
      headers: { Accept: 'application/json' },
    });

    const existingDoc = (existing.data?.objects || []).find(
      entry => entry.object?.properties?.['cmis:name'].value === name,
    );
    if (existingDoc) {
      const fullObjectId = existingDoc.object.properties['cmis:objectId'].value;
      const objectId = fullObjectId.split('@')[0]; // ⚠️ Eliminar versión si es necesario

      console.warn(`[uploadDocument] Documento ya existe en '${relativePath}'. Eliminando: ${objectId}`);

      await deleteObject(objectId, 'delete', relativePath);
    }

    // ② Subir nuevo documento
    const config = {
      method: 'post',
      url: fullPath,
      headers: {
        ...oForm.getHeaders(),
      },
      data,
    };

    const response = await dmsDestination(config);
    return response.data;

  } catch (error) {
    console.error('Error al subir el Documento:', error.message);
    throw error;
  }
};



const deleteObject = async (objectId, type, relativePath = '') => {
  const oForm = new FormData();
  oForm.append('cmisaction', type);
  oForm.append('objectId', objectId);
  oForm.append('continueOnFailure', 'true');

  const url = `${DMS_ROOT()}${relativePath ? '/' + relativePath : ''}`;

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
    const encodedFolderPath = folderName
      .split('/')
      .map(seg => encodeURIComponent(seg))
      .join('/');
    const encodedDocumentName = encodeURIComponent(documentName);
    const config = {
      method: 'get',
      url: `${DMS_ROOT()}/${encodedFolderPath}/${encodedDocumentName}`,
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

const listarDocumentosEnCarpeta = async (relativePath = '') => {
  try {
    const response = await dmsDestination.get(`${DMS_ROOT()}/${relativePath}?succinct=true`);
    const objetos = response.data.objects ?? [];

    const documentos = objetos
      .filter(obj =>
        obj?.object?.succinctProperties?.['cmis:baseTypeId'] === 'cmis:document',
      )
      .map(obj => {
        const props = obj.object.succinctProperties;
        return {
          name         : props['cmis:name'] || '',
          objectId     : props['cmis:objectId'] || '',
          mimeType     : props['cmis:contentStreamMimeType'] || '',
          createdBy    : props['cmis:createdBy'] || '',
          creationDate : props['cmis:creationDate'] || '',
        };
      });

    return documentos;
  } catch (error) {
    console.error(`[listarDocumentosEnCarpeta] ${error.message}`);
    throw error;
  }
};


module.exports = { createFolder, uploadDocument, deleteFolder, deleteDocument, getDocument, listarDocumentosEnCarpeta };