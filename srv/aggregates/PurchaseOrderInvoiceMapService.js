const cds = require('@sap/cds');

async function handlePurchaseOrderInvoiceMapRead(req, s4Invoices) {
  try {
    return await s4Invoices.run(req.query); // delega filtros como $filter, $select, etc.
  } catch (err) {
    console.error('[ERROR] PurchaseOrderInvoiceMap:', err.message);
    return req.reject(500, 'Error al obtener facturas vinculadas a órdenes de compra');
  }
}


module.exports = {
  handlePurchaseOrderInvoiceMapRead,
};
