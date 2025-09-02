/* eslint-disable no-console */
/* eslint-disable prefer-const */
const cds = require('@sap/cds');
const { triggerWorkflowInstance } = require('./workflow-client');

function formatDateToYYYYMMDD(date) {
  return date.toISOString().split('T')[0]; // Ej: "2025-08-04"
}

function formatDateToSAP(date) {
  return `/Date(${date.getTime()})/`;
}

async function insertInvoice(data, db) {
  const today = new Date();
  const formattedDate = formatDateToYYYYMMDD(today);

  const num = v => (v === undefined || v === null || v === '' ? null : Number(v));

  const poRefs = data?.to_SuplrInvcItemPurOrdRef?.results ?? [];
  const taxes  = data?.to_SupplierInvoiceTax?.results ?? [];

  // Mapeo a InvoiceItems
  const invoiceItems = poRefs.map(po => ({
    invoiceItem: String(po.SupplierInvoiceItem),
    purchaseOrder: po.PurchaseOrder,
    purchaseOrderItem: po.PurchaseOrderItem,
    taxCode: po.TaxCode ?? taxes[0]?.TaxCode ?? null,
    supplierInvoiceItemQuantity: null, 
    supplierInvoiceItemAmmount: num(po.SupplierInvoiceItemAmount),
    inventoryValuationType: null,
    taxAmount: null,
    taxBaseAmountInTransCrcy: null,
    taxCountry: taxes[0]?.TaxCountry ?? null,
  }));

  //console.log('Invoice Items:', invoiceItems);

  // Mapeo a InvoiceTaxes
  const invoiceTaxes = taxes.map(t => ({
    taxCode: t.TaxCode,
    taxAmount: num(t.TaxAmount),
    taxBaseAmountInTransCrcy: num(t.TaxBaseAmountInTransCrcy),
    taxCountry: t.TaxCountry,
  }));

  //console.log('Invoice Taxes:', invoiceTaxes);

  const invoiceId = (cds.utils?.uuid?.() ?? require('uuid').v4());

  const result = await db.run(
    INSERT.into('Invoices').entries({
      ID: invoiceId,
      documentDate: data.DocumentDate,
      postingDate: formattedDate,
      supplierInvoiceIDByInvcgParty:data.SupplierInvoiceIDByInvcgParty,
      taxIsCalculatedAutomatically: false,
      InvoiceReceiptDate: data.DocumentDate,
      purchaseOrderID: poRefs[0]?.PurchaseOrder ?? null,
      totalAmount: data.InvoiceGrossAmount,
      currency: data.DocumentCurrency,
      status_statusCode: 'B',
      invoiceItems,
      invoiceTaxes,
    }),
  );

  //console.log('Inserted Invoice ID:', invoiceId);

  return invoiceId;
}

async function handleStartWorkflow(req) {
  try {
    let { definitionId, context } = req.data;
    const db = cds.transaction(req);

    // Asegurarse de que context sea un objeto (parse si es string)
    if (typeof context === 'string') {
      context = JSON.parse(context);
    }

    // Si viene como { entry: {...} }, tomamos sólo el contenido real
    let data = context?.entry || context;

    //console.log('Context received for workflow:', data);

    const invoiceId = await insertInvoice(data, db);

    if (!data.postact)
      data.postact = {};

    if (data.DocumentDate) {
      data.DocumentDate = formatDateToSAP(new Date(data.DocumentDate));
    }
    
    if (data.PostingDate) {
      data.PostingDate = formatDateToSAP(new Date(data.PostingDate));
    }
    
    if (data.TaxDeterminationDate) {
      data.TaxDeterminationDate = formatDateToSAP(new Date(data.TaxDeterminationDate));
    } 

    const result = await triggerWorkflowInstance(req, data, definitionId, invoiceId);

    const workflowInstanceId = result?.instanceId || result?.id;

    //console.log('Triggered Workflow Instance ID:', workflowInstanceId);

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
      console.log(`Invoice ${invoiceId} updated with workflowInstanceId ${workflowInstanceId}`);
    } else {
      console.warn('⚠️ No se obtuvo workflowInstanceId. No se actualiza la factura.');
    }

    if (!result.id) {
      // Opcional: log extra
      console.warn('[handleStartWorkflow] Resultado sin ID:', result);
      return req.reject(500, 'No se pudo obtener instancia del workflow');
    }

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
