const cds = require('@sap/cds');
const { UPDATE } = cds.ql;

async function updateInvoiceFromWorkflow(req) {
  const { Invoice_ID, supplierInvoice, fiscalYear } = req.data;
  if (!Invoice_ID) return req.reject(400, 'ID requerido');

  const tx = cds.transaction(req);
  const { Invoices } = cds.entities;

  const affected = await tx.run(
    UPDATE(Invoices).set({
      supplierInvoice: String(supplierInvoice ?? '').trim(),
      fiscalYear: String(fiscalYear ?? '').trim(),
    }).where({ ID: Invoice_ID }),
  );

  if (!affected) return req.reject(404, `Invoice ${Invoice_ID} no encontrada`);
  return { Invoice_ID, affectedRows: affected };
}

module.exports = { updateInvoiceFromWorkflow }; // 👈 named export correcto
