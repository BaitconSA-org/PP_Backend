const cds = require('@sap/cds');
const { SELECT } = cds.ql; 

async function handleInvoiceRead(req, s4Purchase) {
  //const s4Purchase = await cds.connect.to('purchaseorder_edmx');
  // Implementar POST a la entidad Invoices y despues ir armando de a poco la navegacion
  //    hacia purchaseOrdersExt.
  // aca va la validacion de roles
  try {
    const tx        = cds.transaction(req);
    const invoices  = await tx.run(req.query);
    if (!invoices.length) return invoices;

    const poIds     = invoices.map(inv => inv.purchaseOrderID);
    const poHeaders = await s4Purchase.run(
      SELECT.from('PurchaseOrder')
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

  } catch {
    return req.reject(500, 'Error al leer órdenes de compra');
  }
}

async function handleInvoiceItemsRead(req, s4Purchase) {
  const tx     = cds.transaction(req);
  const items  = await tx.run(req.query);
  if (!items.length) return items;

  // Claves compuestas
  const keys  = items.map(i => ({
    PurchaseOrder:     i.purchaseOrder,
    PurchaseOrderItem: i.purchaseOrderItem,
  }));

  // PO items
  const poItems = await s4Purchase.run(
    SELECT.from('PurchaseOrderItem')
      .where({ or: keys }),
  );

  // mapeo { "PO-Item" → registro PO item }
  const poItemMap = poItems.reduce((m, pi) => {
    m[`${pi.PurchaseOrder}-${pi.PurchaseOrderItem}`] = pi;
    return m;
  }, {});

  items.forEach(i => {
    const mapKey = `${i.purchaseOrder}-${i.purchaseOrderItem}`;
    i.toPurchaseOrderItem = poItemMap[mapKey] || null;
  });

  return req.params?.length === 1 ? items[0] : items;
}

module.exports = { handleInvoiceRead, handleInvoiceItemsRead };