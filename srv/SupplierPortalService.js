const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const s4 = await cds.connect.to('purchaseorder_edmx');

  this.on('READ', 'PurchaseOrderItemExt', async (req) => {
    try {
      console.log('>>> Handling custom READ for PurchaseOrderItemExt');
      return await s4.run(req.query);
    } catch (err) {
      console.error('Error reading PurchaseOrderItemExt:', err);
      return req.reject(500, 'Error delegating to remote service');
    }
  });

  this.on('READ', 'PurchaseOrderExt', async (req) => {
    const userSupplierIDs = req.user?.attr?.supplierID;

    if (!Array.isArray(userSupplierIDs) || userSupplierIDs.length === 0) {
      return req.reject(403, 'El usuario no cuenta con roles de proveedor (supplierID).');
    }

    try {
      let poHeaders;

      if (req.params?.length) {
        const poNumber = req.params[0].PurchaseOrder;

        poHeaders = await s4.run(
          SELECT.from('PurchaseOrder')
            .where({ PurchaseOrder: poNumber })
            .and({ Supplier: { in: userSupplierIDs } }),
        );
      } else {
        // Clonamos y fusionamos el filtro original con el de seguridad
        const query = Object.assign({}, req.query); // copia "shallow"

        const supplierFilter = ['Supplier', 'in', userSupplierIDs];

        if (query.where) {
          query.where = ['and', query.where, supplierFilter];
        } else {
          query.where = supplierFilter;
        }

        poHeaders = await s4.run(query);
      }

      if (!poHeaders.length) return [];

      const poIds = poHeaders.map(po => po.PurchaseOrder);
      const poItems = await s4.run(
        SELECT.from('PurchaseOrderItem').where({ PurchaseOrder: { in: poIds } }),
      );

      const itemsByPO = poItems.reduce((acc, item) => {
        const key = item.PurchaseOrder;
        acc[key] = acc[key] || [];
        acc[key].push(item);
        return acc;
      }, {});

      poHeaders.forEach(po => {
        po._PurchaseOrderItem = itemsByPO[po.PurchaseOrder] || [];
      });

      return poHeaders.length === 1 ? poHeaders[0] : poHeaders;

    } catch (err) {
      console.error('Error reading PurchaseOrderExt:', err);
      return req.reject(500, 'Error al leer órdenes de compra');
    }
  });
});
