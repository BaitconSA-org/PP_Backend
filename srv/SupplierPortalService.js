const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const s4 = await cds.connect.to('purchaseorder_edmx');

  // Manejo manual de PurchaseOrderItemExt con soporte de $select, $top, $skip, etc.
  this.on('READ', 'PurchaseOrderItemExt', async (req) => {
    try {
      console.log('>>> Handling custom READ for PurchaseOrderItemExt');
      return await s4.run(req.query);  // delega con $select, $skip, etc. incluidos
    } catch (err) {
      console.error(err);
      req.reject(500, 'Error delegating to remote service');
    }
  });

  // Lógica de PurchaseOrderExt con expand manual (como ya tenés)
  this.on('READ', 'PurchaseOrderExt', async (req) => {
    let poHeaders;

    if (req.params && req.params.length) {
      const poNumber = req.params[0].PurchaseOrder;
      poHeaders = await s4.run(
        SELECT.from('PurchaseOrder').where({ PurchaseOrder: poNumber }),
      );
    } else {
      poHeaders = await s4.run(req.query);
    }

    const poIds = poHeaders.map(p => p.PurchaseOrder);
    if (!poIds.length) return poHeaders;

    const poItems = await s4.run(
      SELECT.from('PurchaseOrderItem').where({ PurchaseOrder: { in: poIds } }),
    );

    const itemsByPO = {};
    for (const item of poItems) {
      const po = item.PurchaseOrder;
      if (!itemsByPO[po]) itemsByPO[po] = [];
      itemsByPO[po].push(item);
    }

    for (const po of poHeaders) {
      po._PurchaseOrderItem = itemsByPO[po.PurchaseOrder] || [];
    }

    return poHeaders.length === 1 ? poHeaders[0] : poHeaders;
  });
});
