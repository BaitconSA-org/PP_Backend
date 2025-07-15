const { getDestination } = require('@sap-cloud-sdk/connectivity');

const axios = require('axios');

const DESTINATION_NAME = 'SBPA';

/**
 * Ejecuta un workflow en SBPA usando el destination configurado.
 * @param {Object} context - El contexto completo enviado desde el front-end.
 * @param {String} definitionId - ID del workflow a ejecutar.
 * @returns {Promise<Object>} - Respuesta del workflow (instancia creada).
 */
async function triggerWorkflowInstance(req, context, definitionId) {
  if (!definitionId) throw new Error('Se requiere el "definitionId" del workflow');
  if (!context || typeof context !== 'object') throw new Error('El parámetro "context" debe ser un objeto válido');

  const destination = await getDestination({ destinationName: DESTINATION_NAME });
  const baseURL = destination.url;
  const token = destination.authTokens?.[0]?.value;

  if (!token || !baseURL) {
    throw new Error('No se pudo obtener token o URL del destination SBPA');
  }

  const payload = {
    definitionId,    // ID del workflow definido en SBPA
    context,         // Contexto que se pasará al workflow como input
  };

  const response = await axios.post(
    `${baseURL}/workflow/rest/v1/workflow-instances?environmentId=dev`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'irpa-api-key': 'f3HRS8Si3htALNDeLenGytvfsEtLd2on',
      },
    },
  );

  return response.data; // Retorna info de la instancia creada
}

module.exports = {
  triggerWorkflowInstance,
};
