// /srv/services/SupplierInvoiceService.js

const cds = require('@sap/cds');

async function handleSupplierInvoiceRead(req, s4Invoices) {
  try {
    const invoiceHeaders = await s4Invoices.run(req.query);

    const invoiceIds = invoiceHeaders.map(i => i.SupplierInvoice);
    if (!invoiceIds.length) return invoiceHeaders;

    const invoiceItems = await s4Invoices.run(
      SELECT.from('A_SuplrInvcItemPurOrdRef').where({ SupplierInvoice: { in: invoiceIds } }),
    );

    const itemsByInvoice = invoiceItems.reduce((acc, item) => {
      const key = item.SupplierInvoice;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    invoiceHeaders.forEach(inv => {
      inv._InvoiceItem = itemsByInvoice[inv.SupplierInvoice] || [];
    });

    return invoiceHeaders.length === 1 ? invoiceHeaders[0] : invoiceHeaders;
  } catch (err) {
    console.error('[ERROR] SupplierInvoiceExt:', err);
    return req.reject(500, 'Error al obtener facturas con líneas');
  }
}

async function handleSupplierInvoiceItemRead(req) {
  try {
    const s4Invoices = await cds.connect.to('A_SupplierInvoice_edmx');
    return await s4Invoices.run(req.query);
  } catch (err) {
    console.error('Error al leer SupplierInvoiceItemExt:', err);
    return req.reject(500, 'Error delegando a servicio remoto de facturas');
  }
}

module.exports = {
  handleSupplierInvoiceRead,
  handleSupplierInvoiceItemRead,
};
