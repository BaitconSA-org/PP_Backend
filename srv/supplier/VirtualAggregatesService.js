const cds = require('@sap/cds');

/**
 * GET PurchaseOrderNetAmount
 * Devuelve el monto neto total agrupado por orden de compra desde S/4HANA
 */
async function handleNetAmountRead(req) {
  try {
    const s4PO = await cds.connect.to('purchaseorder_edmx');

    const raw = await s4PO.run(
      SELECT.from('PurchaseOrderItem', ['PurchaseOrder', 'NetAmount']),
    );

    const agrupado = {};
    for (const row of raw) {
      const po = row.PurchaseOrder;
      const amount = Number(row.NetAmount) || 0;
      if (!agrupado[po]) agrupado[po] = 0;
      agrupado[po] += amount;
    }

    return Object.entries(agrupado).map(([PurchaseOrder, NetAmount]) => ({
      PurchaseOrder,
      NetAmount,
    }));
  } catch (err) {
    console.error('[ERROR] PurchaseOrderNetAmount:', err);
    return req.reject(500, 'Error al obtener datos de NetAmount');
  }
}

/**
 * GET PurchaseOrderSupplierInvoiceAmount
 * Devuelve el total facturado por orden de compra desde S/4HANA
 */
async function handleSupplierInvoiceAmountRead(req) {
  try {
    const s4INV = await cds.connect.to('A_SupplierInvoice_edmx');

    const raw = await s4INV.run(
      SELECT.from('A_SuplrInvcItemPurOrdRef', [
        'PurchaseOrder',
        'SupplierInvoiceItemAmount',
      ]),
    );

    const agrupado = {};
    for (const row of raw) {
      const po = row.PurchaseOrder;
      const amount = Number(row.SupplierInvoiceItemAmount) || 0;
      if (!agrupado[po]) agrupado[po] = 0;
      agrupado[po] += amount;
    }

    return Object.entries(agrupado).map(([PurchaseOrder, SupplierInvoiceAmount]) => ({
      PurchaseOrder,
      SupplierInvoiceAmount,
    }));
  } catch (err) {
    console.error('[ERROR] PurchaseOrderSupplierInvoiceAmount:', err);
    return req.reject(500, 'Error al obtener datos de facturación por orden');
  }
}

/**
 * GET PurchaseOrderItemSupplierInvoiceAmount
 * Devuelve el total facturado por orden + posición desde S/4HANA
 */
async function handleItemSupplierInvoiceAmountRead(req) {
  try {
    const s4INV = await cds.connect.to('A_SupplierInvoice_edmx');

    const raw = await s4INV.run(
      SELECT.from('A_SuplrInvcItemPurOrdRef', [
        'PurchaseOrder',
        'PurchaseOrderItem',
        'SupplierInvoiceItemAmount',
      ]),
    );

    const agrupado = {};
    for (const row of raw) {
      const key = `${row.PurchaseOrder}__${row.PurchaseOrderItem}`;
      const amount = Number(row.SupplierInvoiceItemAmount) || 0;
      if (!agrupado[key]) agrupado[key] = { 
        PurchaseOrder: row.PurchaseOrder, 
        PurchaseOrderItem: row.PurchaseOrderItem,
        SupplierInvoiceItemAmount: 0,
      };
      agrupado[key].SupplierInvoiceItemAmount += amount;
    }

    return Object.values(agrupado);
  } catch (err) {
    console.error('[ERROR] PurchaseOrderItemSupplierInvoiceAmount:', err);
    return req.reject(500, 'Error al obtener datos de facturación por ítem');
  }
}

module.exports = {
  handleNetAmountRead,
  handleSupplierInvoiceAmountRead,
  handleItemSupplierInvoiceAmountRead,
};
