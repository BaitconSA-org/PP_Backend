/* eslint-disable no-console */
/* eslint-disable prefer-const */
const { triggerWorkflowInstance } = require('./workflow-client');

async function handleStartWorkflow(req) {
  try {
    let { definitionId, context } = req.data;

    // Asegurarse de que context sea un objeto (parse si es string)
    if (typeof context === 'string') {
      context = JSON.parse(context);
    }

    // Si viene como { entry: {...} }, tomamos sólo el contenido real
    const data = context?.entry || context;

    const result = await triggerWorkflowInstance(req, data, definitionId);
    return {
      status: 'SUCCESS',
      instanceId: result.id,
      workflowDefinitionId: result.definitionId,
    };
  } catch (err) {
    console.error('[handleStartWorkflow] Error:', err.message);
    return req.reject(500, 'Error al iniciar el workflow: ' + err.message);
  }
}

module.exports = { handleStartWorkflow };
