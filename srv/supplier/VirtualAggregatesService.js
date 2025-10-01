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
  const INCLUDED_STATUS = '5'; // solo status 5

  // Normaliza flags tipo ABAP ('X'), boolean o '1'
  const isTrue = v => v === true || v === 'X' || v === 'x' || v === '1' || v === 1;

  // Evita doble negativos si el backend ya trae montos negativos
  const applySigned = (amount, isCredit) => {
    const a = Number(amount) || 0;
    if (a === 0) return 0;
    return isCredit ? -Math.abs(a) : Math.abs(a);
  };

  try {
    const s4INV = await cds.connect.to('A_SupplierInvoice_edmx');

    // 1) Ítems con referencia a OC y factura
    const items = await s4INV.run(
      SELECT.from('A_SuplrInvcItemPurOrdRef', [
        'PurchaseOrder',
        'SupplierInvoice',            // clave de cabecera
        'SupplierInvoiceItemAmount',  // importe del ítem
      ])
    );
    if (!Array.isArray(items) || items.length === 0) return [];

    // 2) Cabeceras: status + indicador de Nota de Crédito
    const uniqueInvoiceKeys = [...new Set(items.map(it => it.SupplierInvoice).filter(Boolean))];
    if (uniqueInvoiceKeys.length === 0) return [];

    let invoices = [];
    try {
      invoices = await s4INV.run(
        SELECT.from('A_SupplierInvoice', [
          'SupplierInvoice',
          'SupplierInvoiceStatus',
          'SupplierInvoiceIsCreditMemo', // ← importante para el signo
        ]).where({ SupplierInvoice: { in: uniqueInvoiceKeys } })
      );
    } catch {
      // Fallback si no soporta IN
      invoices = await s4INV.run(
        SELECT.from('A_SupplierInvoice', [
          'SupplierInvoice',
          'SupplierInvoiceStatus',
          'SupplierInvoiceIsCreditMemo',
        ])
      );
    }

    // Indexar cabeceras por factura
    const invoiceInfo = {};
    for (const inv of invoices || []) {
      invoiceInfo[inv.SupplierInvoice] = {
        status: inv.SupplierInvoiceStatus,
        isCredit: isTrue(inv.SupplierInvoiceIsCreditMemo),
      };
    }

    // 3) Agrupar SOLO facturas con status '5' y aplicar signo por NC
    const agrupadoPorPO = {};
    for (const item of items) {
      const info = invoiceInfo[item.SupplierInvoice];
      if (!info || info.status !== INCLUDED_STATUS) continue; // solo status 5

      const signed = applySigned(item.SupplierInvoiceItemAmount, info.isCredit);
      const po = item.PurchaseOrder;

      if (!agrupadoPorPO[po]) agrupadoPorPO[po] = 0;
      agrupadoPorPO[po] += signed;
    }

    // 4) Salida
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

  // Normaliza valores tipo ABAP ('X'), boolean o '1'
  const isTrue = v => v === true || v === 'X' || v === 'x' || v === '1' || v === 1;

  // Evita doble negativos si el backend ya trae montos negativos
  const applySigned = (amount, isCredit) => {
    const a = Number(amount) || 0;
    if (a === 0) return 0;
    return isCredit ? -Math.abs(a) : Math.abs(a);
  };

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

    // 2) Cabeceras (status) de las facturas mencionadas en los ítems
    const uniqueInvoiceKeys = [...new Set(items.map(i => i.SupplierInvoice).filter(Boolean))];
    if (uniqueInvoiceKeys.length === 0) return [];

    let invoices = [];
    try {
      invoices = await s4INV.run(
        SELECT.from('A_SupplierInvoice', [
          'SupplierInvoice',
          'SupplierInvoiceStatus',
          'SupplierInvoiceIsCreditMemo',   // ⬅ AQUI: traemos el flag de Nota de Crédito
        ]).where({ SupplierInvoice: { in: uniqueInvoiceKeys } })
      );
    } catch (e) {
      // Fallback por si el backend no soporta IN: traer todo y filtrar en memoria
      invoices = await s4INV.run(
        SELECT.from('A_SupplierInvoice', [
          'SupplierInvoice',
          'SupplierInvoiceStatus',
          'SupplierInvoiceIsCreditMemo',   // ⬅ AQUI también
        ])
      );
    }

    // Index con status e indicador de NC
    const infoByInvoice = {};
    for (const inv of invoices || []) {
      infoByInvoice[inv.SupplierInvoice] = {
        status: inv.SupplierInvoiceStatus,
        isCredit: isTrue(inv.SupplierInvoiceIsCreditMemo), // ⬅ AQUI: normalizamos 'X'/'1'/true
      };
    }

    // 3) Agrupar SOLO los ítems cuya factura tenga status '5'
    //    y aplicar signo negativo si es Nota de Crédito
    const grouped = {};
    for (const row of items) {
      const info = infoByInvoice[row.SupplierInvoice];
      if (!info || info.status !== INCLUDED_STATUS) continue; // incluir solo status 5

      const key = `${row.PurchaseOrder}__${row.PurchaseOrderItem}`;

      // ⬅ AQUI: aplicamos el signo según NC
      const signedAmount = applySigned(row.SupplierInvoiceItemAmount, info.isCredit);

      if (!grouped[key]) {
        grouped[key] = {
          PurchaseOrder: row.PurchaseOrder,
          PurchaseOrderItem: row.PurchaseOrderItem,
          SupplierInvoiceItemAmount: 0,
        };
      }
      grouped[key].SupplierInvoiceItemAmount += signedAmount;
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