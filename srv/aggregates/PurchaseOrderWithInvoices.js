const cds = require('@sap/cds');

/**
 * Handler que construye jerarquía de:
 * - PurchaseOrderWithInvoices
 *   - _PurchaseOrderItem
 *     - _InvoiceItems (con acceso a _SupplierInvoice)
 */
module.exports = async function handlePOWithInvoicesRead(req, s4Purchase, s4Invoices) {
  try {
    const userSupplierIDs = ['31300001', '31300002', '31300003', '31300006'];
    const queryParams = req.query.SELECT?.columns || [];

    const poQuery = SELECT.from('PurchaseOrder')
      .where({ Supplier: { in: userSupplierIDs } });

    const poHeaders = await s4Purchase.run(poQuery);
    const poIds = poHeaders.map(po => po.PurchaseOrder);

    const poItems = await s4Purchase.run(
      SELECT.from('PurchaseOrderItem')
        .where({ PurchaseOrder: { in: poIds } }),
    );

    const invoiceItems = await s4Invoices.run(
      SELECT.from('A_SuplrInvcItemPurOrdRef')
        .where({ PurchaseOrder: { in: poIds } }),
    );

    const invoiceHeaders = await s4Invoices.run(
      SELECT.from('A_SupplierInvoice')
        .where({ SupplierInvoice: { in: invoiceItems.map(i => i.SupplierInvoice) } }),
    );

    const invoiceHeaderMap = invoiceHeaders.reduce((acc, inv) => {
      acc[`${inv.SupplierInvoice}-${inv.FiscalYear}`] = inv;
      return acc;
    }, {});

    const invoiceMapByPOItem = invoiceItems.reduce((acc, item) => {
      const key = `${item.PurchaseOrder}-${item.PurchaseOrderItem}`;
      acc[key] = acc[key] || [];
      acc[key].push({
        ...item,
        _SupplierInvoice: invoiceHeaderMap[`${item.SupplierInvoice}-${item.FiscalYear}`],
      });
      return acc;
    }, {});

    const poItemMap = poItems.reduce((acc, item) => {
      const key = item.PurchaseOrder;
      const itemKey = `${item.PurchaseOrder}-${item.PurchaseOrderItem}`;
      item._InvoiceItems = invoiceMapByPOItem[itemKey] || [];
      (acc[key] = acc[key] || []).push(item);
      return acc;
    }, {});

    const result = poHeaders.map(po => {
      po._PurchaseOrderItem = poItemMap[po.PurchaseOrder] || [];
      return po;
    });

    return req.params?.length === 1 ? result[0] : result;
  } catch (err) {
    console.error('[ERROR] handlePOWithInvoicesRead:', err);
    return req.reject(500, 'Error al construir jerarquía de órdenes con facturas');
  }
};
