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
// suma SupplierInvoiceItemAmount por PurchaseOrder
// INCLUYENDO SOLO facturas con estado '5'
async function handleSupplierInvoiceAmountRead(req) {
  const INCLUDED_STATUS = '5'; // Solo se suman facturas con este status

  try {
    const s4INV = await cds.connect.to('A_SupplierInvoice_edmx');

    // 1) Traer ítems con referencia a Orden de Compra y a la clave de factura
    const items = await s4INV.run(
      SELECT.from('A_SuplrInvcItemPurOrdRef', [
        'PurchaseOrder',
        'SupplierInvoice',             // clave de cabecera
        'SupplierInvoiceItemAmount',   // importe del ítem
      ])
    );

    if (!Array.isArray(items) || items.length === 0) {
      return []; // No hay ítems
    }

    // 2) Traer cabeceras de las facturas (status)
    const uniqueInvoiceKeys = [...new Set(items.map(it => it.SupplierInvoice).filter(Boolean))];
    if (uniqueInvoiceKeys.length === 0) {
      return [];
    }

    const invoices = await s4INV.run(
      SELECT.from('A_SupplierInvoice', [
        'SupplierInvoice',
        'SupplierInvoiceStatus',
      ])
      .where({ SupplierInvoice: { in: uniqueInvoiceKeys } })
    );

    // Mapear status por clave de factura
    const invoiceStatusByKey = {};
    for (const inv of invoices || []) {
      invoiceStatusByKey[inv.SupplierInvoice] = inv.SupplierInvoiceStatus;
    }

    // 3) Agrupar SOLO facturas con status '5'
    const agrupadoPorPO = {};
    for (const item of items) {
      const po = item.PurchaseOrder;
      const invKey = item.SupplierInvoice;
      const amount = Number(item.SupplierInvoiceItemAmount) || 0;

      const status = invoiceStatusByKey[invKey];
      if (status !== INCLUDED_STATUS) continue; // solo incluir status 5

      if (!agrupadoPorPO[po]) agrupadoPorPO[po] = 0;
      agrupadoPorPO[po] += amount;
    }

    // 4) Formato de salida
    return Object.entries(agrupadoPorPO).map(([PurchaseOrder, SupplierInvoiceAmount]) => ({
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
 *  Suma SupplierInvoiceItemAmount por (PurchaseOrder, PurchaseOrderItem)
 *  INCLUYENDO SOLO facturas con estado '5'
 */

async function handleItemSupplierInvoiceAmountRead(req) {
  const INCLUDED_STATUS = '5';

  try {
    const s4INV = await cds.connect.to('A_SupplierInvoice_edmx');

    // 1) Ítems con la clave de factura para poder cruzar contra la cabecera
    const items = await s4INV.run(
      SELECT.from('A_SuplrInvcItemPurOrdRef', [
        'PurchaseOrder',
        'PurchaseOrderItem',
        'SupplierInvoice',             // clave de cabecera
        'SupplierInvoiceItemAmount',
      ])
    );
    if (!Array.isArray(items) || items.length === 0) return [];

    // 2) Cabeceras (status) solo de las facturas mencionadas en los ítems
    const uniqueInvoiceKeys = [...new Set(items.map(i => i.SupplierInvoice).filter(Boolean))];
    if (uniqueInvoiceKeys.length === 0) return [];

    let invoices = [];
    try {
      invoices = await s4INV.run(
        SELECT.from('A_SupplierInvoice', [
          'SupplierInvoice',
          'SupplierInvoiceStatus',
        ]).where({ SupplierInvoice: { in: uniqueInvoiceKeys } })
      );
    } catch (e) {
      // Fallback por si el backend no soporta IN: traer todo y filtrar en memoria
      invoices = await s4INV.run(
        SELECT.from('A_SupplierInvoice', [
          'SupplierInvoice',
          'SupplierInvoiceStatus',
        ])
      );
    }

    const statusByInvoice = {};
    for (const inv of invoices || []) {
      statusByInvoice[inv.SupplierInvoice] = inv.SupplierInvoiceStatus;
    }

    // 3) Agrupar SOLO los ítems cuya factura tenga status '5'
    const grouped = {};
    for (const row of items) {
      const status = statusByInvoice[row.SupplierInvoice];
      if (status !== INCLUDED_STATUS) continue; // incluir solo status 5

      const key = `${row.PurchaseOrder}__${row.PurchaseOrderItem}`;
      const amount = Number(row.SupplierInvoiceItemAmount) || 0;

      if (!grouped[key]) {
        grouped[key] = {
          PurchaseOrder: row.PurchaseOrder,
          PurchaseOrderItem: row.PurchaseOrderItem,
          SupplierInvoiceItemAmount: 0,
        };
      }
      grouped[key].SupplierInvoiceItemAmount += amount;
    }

    return Object.values(grouped);
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