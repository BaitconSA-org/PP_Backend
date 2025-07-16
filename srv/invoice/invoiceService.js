const cds = require('@sap/cds');
const { SELECT } = cds.ql; 

async function handleInvoiceRead(req, srv) {
  //const s4Purchase = await cds.connect.to('purchaseorder_edmx');
  // aca va la validacion de roles
  try {
    const tx        = cds.transaction(req);
    let invoices  = await tx.run(req.query);

    if (!invoices) return null;

    const isArray = Array.isArray(invoices);
    if (!isArray) invoices = [invoices];

    if (!invoices.length) return isArray ? [] : null;

    const poIds = invoices.map(inv => inv.purchaseOrderID).filter(Boolean);
    if (poIds.length) {
      const poHeaders = await srv.run(
        SELECT.from('PurchaseOrderExt').where({ PurchaseOrder: { in: poIds } }),
      );
      const poMap = Object.fromEntries(poHeaders.map(po => [po.PurchaseOrder, po]));
      invoices.forEach(inv => {
        inv.toPurchaseOrder = poMap[inv.purchaseOrderID] || null;
      });
    }

    // 4) Si vino expandido invoiceItems, reutilizar enrichInvoiceItems
    for (const inv of invoices) {
      if (Array.isArray(inv.invoiceItems) && inv.invoiceItems.length) {
        await enrichInvoiceItems(inv.invoiceItems, req, srv);
      }
    }

    return isArray ? invoices : invoices[0];

  } catch (err) {
    console.error('[ERROR] handleInvoiceRead:', err);
    return req.reject(500, 'Error al leer órdenes de compra');
  }
}

async function enrichInvoiceItems(items, req, srv) {
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
}

/**
 * Handler para GET /InvoiceItems
 */
async function handleInvoiceItemsRead(req, srv) {
  try {
    const tx     = cds.transaction(req);
    const items  = await tx.run(req.query);
    return await enrichInvoiceItems(items, req, srv);
    
  } catch (err) {
    console.error('[ERROR] handleInvoiceItemsRead:', err);
    return req.reject(500, 'Error al leer items de órdenes de compra');
  }

}

module.exports = { handleInvoiceRead, handleInvoiceItemsRead };