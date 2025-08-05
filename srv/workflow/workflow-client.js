const cds = require('@sap/cds');
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
    context,         
  };

  const response = await axios.post(
    `${baseURL}/workflow/rest/v1/workflow-instances?environmentId=dev`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'irpa-api-key': 'ThUn7khg6CBxyOqi5K5D-gcbJjtZiGAu',
      },
    },
  );

  const workflowInstanceId = response.data?.instanceId;

  const invoiceId = null;
  // Persistir en CAP
  const db = cds.transaction(req); // Asegura la transacción dentro del contexto CAP
  await db.run(
    UPDATE('Invoices')
      .set({
        status: 'E',
        workflowInstanceId: workflowInstanceId,
      })
      .where({ ID: invoiceId }), // Usa tu clave primaria real
  );

  return response.data; // Retorna info de la instancia creada
}

module.exports = {
  triggerWorkflowInstance,
};
