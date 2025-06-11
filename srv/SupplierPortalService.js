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
    const userSupplierIDs = req.user?.attr?.supplierID;
    // const userSupplierIDs = ['31300001', '31300002', '31300003', '31300006'];
  
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
        const query = SELECT.from('PurchaseOrder').where({ Supplier: { in: userSupplierIDs } });
        poHeaders = await s4.run(query);
      }
  
      if (!poHeaders.length) return [];
  
      const filters = req.query?.SELECT?.where;

      const values = [];

      if (Array.isArray(filters)) {
        if (
          filters.length === 3 &&
          filters[0]?.ref?.[0] === 'PurchaseOrder' &&
          filters[1] === '=' &&
          typeof filters[2]?.val !== 'undefined'
        ) {
          values.push(filters[2].val);
        }

        else if (
          filters.length === 1 &&
          Array.isArray(filters[0]?.xpr)
        ) {
          const xpr = filters[0].xpr;

          for (let i = 0; i < xpr.length; i++) {
            if (
              xpr[i]?.ref?.[0] === 'PurchaseOrder' &&
              xpr[i + 1] === '=' &&
              typeof xpr[i + 2]?.val !== 'undefined'
            ) {
              values.push(xpr[i + 2].val);
              i += 2;
            }
          }
        }

        // Aplicar el filtro si encontramos valores
        if (values.length > 0) {
          poHeaders = poHeaders.filter(po => values.includes(po.PurchaseOrder));
        }
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
