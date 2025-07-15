const cds = require('@sap/cds');
const { SELECT } = cds.ql; 

async function handleInvoiceRead(req, srv) {
  //const s4Purchase = await cds.connect.to('purchaseorder_edmx');
  // aca va la validacion de roles
  try {
    const tx        = cds.transaction(req);
    const invoices  = await tx.run(req.query);
    if (!invoices.length) return invoices;

    const poIds     = invoices.map(inv => inv.purchaseOrderID);
    const poHeaders = await srv.run(
      SELECT.from('PurchaseOrderExt')
        .where({ PurchaseOrder: { in: poIds } }),
    );

    // mapeo { PO_ID → encabezado }
    const poMap = poHeaders.reduce((m, po) => {
      m[po.PurchaseOrder] = po;
      return m;
    }, {});

    // Navegacion
    invoices.forEach(inv => {
      inv.toPurchaseOrder = poMap[ inv.purchaseOrderID ] || null;
    });

    return req.params?.length === 1 ? invoices[0] : invoices;

  } catch (err) {
    console.error('[ERROR] handleInvoiceRead:', err);
    return req.reject(500, 'Error al leer órdenes de compra');
  }
}

async function handleInvoiceItemsRead(req, srv) {
  try {
    const tx     = cds.transaction(req);
    const items  = await tx.run(req.query);
    if (!items.length) return items;

    const unique = new Map();
    for (const { purchaseOrder, purchaseOrderItem } of items) {
      if (purchaseOrder && purchaseOrderItem) {
        const key = `${purchaseOrder}-${purchaseOrderItem}`;
        if (!unique.has(key)) {
          unique.set(key, { 
            PurchaseOrder: purchaseOrder, 
            PurchaseOrderItem: purchaseOrderItem, 
          });
        }
      }
    }
    const keys = Array.from(unique.values());
    if (!keys.length) return items;

    // 3) Hago una sola llamada remota con un OR filter
    const poItems = await srv.run(
      SELECT
        .from('PurchaseOrderItemExt')
        .where(keys),
    );

    // 4) Mapeo y enriquezco
    const poMap = poItems.reduce((m, pi) => {
      m[`${pi.PurchaseOrder}-${pi.PurchaseOrderItem}`] = pi;
      return m;
    }, {});
    items.forEach(i => {
      const key = `${i.purchaseOrder}-${i.purchaseOrderItem}`;
      i.toPurchaseOrderItem = poMap[key] || null;
    });

    return req.params?.length === 1 ? items[0] : items;
    
  } catch (err) {
    console.error('[ERROR] handleInvoiceItemsRead:', err);
    return req.reject(500, 'Error al leer items de órdenes de compra');
  }

}

/**
 * 
 * @param {*} invoices 
 * @param {*} req 
 * @param {*} srv 
 * @returns 
async function handleInvoiceAfterRead(invoices, req, srv) {
  if (!invoices) return invoices;
  const list = Array.isArray(invoices) ? invoices : [invoices];
  const tx   = cds.transaction(req);

  const poIds = list.map(inv => inv.purchaseOrderID).filter(x=>x);
  if (poIds.length) {
    const poHeaders = await srv.run(
      SELECT.from('PurchaseOrderExt').where({ PurchaseOrder:{ in: poIds } }),
    );
    const poMap = Object.fromEntries(poHeaders.map(po => [po.PurchaseOrder,po]));
    list.forEach(inv => {
      inv.toPurchaseOrder = poMap[inv.purchaseOrderID] || null;
    });
  }
  return invoices;
}
 */

module.exports = { handleInvoiceRead, handleInvoiceItemsRead };