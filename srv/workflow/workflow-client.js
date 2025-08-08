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

function formatDateToYYYYMMDD(date) {
  return date.toISOString().split('T')[0]; // Ej: "2025-08-04"
}

function formatDateToSAP(date) {
  return `/Date(${date.getTime()})/`;
}


async function triggerWorkflowInstance(req, context, definitionId) {
  const db = cds.transaction(req); // Asegura la transacción dentro del contexto CAP

  const today = new Date();
  const formattedDate = formatDateToYYYYMMDD(today);

  /*if (context.DocumentDate) {
    context.DocumentDate = formatDateToSAP(new Date(context.DocumentDate));
  } */

  if (context.PostingDate) {
    context.PostingDate = formatDateToSAP(new Date(context.PostingDate));
  }

  /* if (context.TaxDeterminationDate) {
    context.TaxDeterminationDate = formatDateToSAP(new Date(context.TaxDeterminationDate));
  }*/ 

  const inserted = await db.run(
    INSERT.into('Invoices').entries({
      status_statusCode: 'B',
      postingDate: formattedDate,
    }),
  );

  const generated = await db.run(
    SELECT.one.from('Invoices').orderBy('postingDate desc'),
  );

  const generatedId = generated?.ID;

  if (!context.entry) {
    context = { entry: context };
  }

  // Asegurar que "patch" esté presente dentro de "entry"
  if (!context.entry.patch || typeof context.entry.patch !== 'object') {
    context.entry.patch = {};
  }

  // Setear valores en patch
  context.entry.patch.fiscalYear = '';
  context.entry.patch.supplierInvoice = '';
  context.entry.patch.Invoice_ID = generatedId || '';

  // Validación del workflow definitionId
  if (!definitionId) {
    throw new Error('Se requiere el "definitionId" del workflow');
  }

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

  const workflowInstanceId = response.data?.instanceId || response.data?.id;
  const invoiceId = generatedId;

  // Solo actualizar si se obtuvo una instancia válida del workflow
  if (workflowInstanceId) {
    await db.run(
      UPDATE('Invoices')
        .set({
          status_statusCode: 'E',
          workflowInstanceId: workflowInstanceId,
        })
        .where({ ID: invoiceId }),
    );
  } else {
    console.warn('⚠️ No se obtuvo workflowInstanceId. No se actualiza la factura.');
  }

  return response.data;

}

module.exports = {
  triggerWorkflowInstance,
};
