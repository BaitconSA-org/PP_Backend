const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const s4 = await cds.connect.to('purchaseorder_edmx');

  this.on('READ', 'PurchaseOrderExt', async (req) => {
    const poHeaders = await s4.run(req.query);

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

    return poHeaders;
  });
});
