const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const s4 = await cds.connect.to('purchaseorder_edmx');
  

  // Manejo manual de PurchaseOrderItemExt con soporte de $select, $top, $skip, etc.
  this.on('READ', 'PurchaseOrderItemExt', async (req) => {
    console.log(req.user);
    try {
      console.log('>>> Handling custom READ for PurchaseOrderItemExt');
      return await s4.run(req.query);  // delega con $select, $skip, etc. incluidos
    } catch (err) {
      console.error(err);
      req.reject(500, 'Error delegating to remote service');
    }
  });


  this.on('READ', 'PurchaseOrderExt', async (req) => {
    //const userSupplierIDs = req.user?.attr?.supplierID;
    const userSupplierIDs = ['31300001', '31300002', '31300003', '31300006'];
  
    if (!Array.isArray(userSupplierIDs) || userSupplierIDs.length === 0) {
      return req.reject(403, 'El usuario no cuenta con roles de proveedor (supplierID).');
    }
  
    try {
      let poHeaders = [];
  
      if (req.params?.length) {
        const poNumber = req.params[0].PurchaseOrder;
  
        poHeaders = await s4.run(
          SELECT.from('PurchaseOrder')
            .where({ PurchaseOrder: poNumber })
            .and({ Supplier: { in: userSupplierIDs } }),
        );
      } else {
        // Clonar el query original con todos los filtros del front
        const query = { ...req.query };

        // Inyectar filtro adicional por Supplier (sin romper los filtros frontend)
        if (!query.where) {
          query.where = [
            { ref: ['Supplier'] },
            'in',
            { val: userSupplierIDs }
          ];
        } else {
          query.where = [
            '(', query.where, ')', 'and',
            { ref: ['Supplier'] },
            'in',
            { val: userSupplierIDs }
          ];
        }

        poHeaders = await s4.run(query);
      }
  
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
  

  /**
   * READ: PurchaseOrderExt._SupplierAddress
   * Navegación manual para /PurchaseOrderExt('...')/_SupplierAddress
   */
  this.on('READ', 'PurchaseOrderExt._SupplierAddress', async (req) => {
    try {
      const { PurchaseOrder } = req.params?.[0] || {};
      if (!PurchaseOrder) {
        return req.reject(400, 'El parámetro PurchaseOrder es obligatorio.');
      }

      const result = await s4.send({
        method: 'GET',
        path: `/PurchaseOrder(PurchaseOrder='${PurchaseOrder}')/to_PurchaseOrderSupplierAddress`,
      });

      if (!result) {
        return req.reject(404, `No se encontró dirección para la orden ${PurchaseOrder}`);
      }

      return result;

    } catch (error) {
      console.error('[ERROR] _SupplierAddress navigation:', error);
      return req.reject(500, 'Error al recuperar dirección del proveedor');
    }
  });

  /**
   * READ directo a la entidad de dirección (fallback manual si es necesario)
   */
  this.on('READ', 'PurchaseOrderSupplierAddress', async (req) => {
    try {
      const { PurchaseOrder } = req.params?.[0] || {};
      if (!PurchaseOrder) {
        return req.reject(400, 'El parámetro PurchaseOrder es obligatorio.');
      }

      const result = await s4.send({
        method: 'GET',
        path: `/PurchaseOrder(PurchaseOrder='${PurchaseOrder}')/_SupplierAddress`,
      });
      
      if (!result) {
        return req.reject(404, `No se encontró dirección para la orden ${PurchaseOrder}`);
      }

      return result;

    } catch (error) {
      console.error('[ERROR] PurchaseOrderSupplierAddress directa:', error);
      return req.reject(500, 'Error interno al consultar la dirección del proveedor.');
    }
  });
  
  
  
  
  

  
  
  
  
  
  
  
});
