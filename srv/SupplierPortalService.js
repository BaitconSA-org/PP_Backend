const cds = require('@sap/cds');
const {
  handleSupplierInvoiceRead,
  handleSupplierInvoiceItemRead,
} = require('./supplier/SupplierInvoiceService');

const {
  handleNetAmountRead,
  handleSupplierInvoiceAmountRead,
  handleItemSupplierInvoiceAmountRead,
} = require('./supplier/VirtualAggregatesService');

const { 
  handleBusinessPartnerRead,
} = require('./businessPartner/BusinessPartnerService');


module.exports = cds.service.impl(async function () {
  // Conexiones
  const s4Purchase = await cds.connect.to('purchaseorder_edmx');
  const s4Invoices = await cds.connect.to('A_SupplierInvoice_edmx');
  const s4bp = await cds.connect.to('A_BusinessPartner');


  
  /**************** 1 ****************/

  this.on('READ', 'PurchaseOrderItemExt', async (req) => {
    try { return await s4Purchase.run(req.query);  // delega con $select, $skip, etc. incluidos
    } catch (err) {  req.reject(500, 'Error delegating to remote service'); }
  });

  this.on('READ', 'PurchaseOrderExt', async (req) => {
    //const userSupplierIDs = ['31300001', '31300002', '31300003', '31300006'];
    const userSupplierIDs = req.user?.attr?.supplierID;
  
    if (!Array.isArray(userSupplierIDs) || userSupplierIDs.length === 0) {
      return req.reject(403, 'El usuario no cuenta con roles de proveedor (supplierID).');
    }
  
    try {
      let poHeaders = [];
  
      if (req.params?.length) {
        const poNumber = req.params[0].PurchaseOrder;
  
        poHeaders = await s4Purchase.run(
          SELECT.from('PurchaseOrder')
            .where({ PurchaseOrder: poNumber })
            .and({ Supplier: { in: userSupplierIDs } }),
        );
      } else {
        const query = { ...req.query };
  
        query.where = query.where
          ? ['(', query.where, ')', 'and', { ref: ['Supplier'] }, 'in', { val: userSupplierIDs }]
          : [{ ref: ['Supplier'] }, 'in', { val: userSupplierIDs }];
  
        poHeaders = await s4Purchase.run(query);
      }
  
      const poIds = poHeaders.map(po => po.PurchaseOrder);
  
      const poItems = await s4Purchase.run(
        SELECT.from('PurchaseOrderItem').where({ PurchaseOrder: { in: poIds } }),
      );
  
      const netAmounts = await handleNetAmountRead(poIds);
      const supplierInvoiceAmounts = await handleSupplierInvoiceAmountRead(poIds); 
      const supplierInvoiceAmount = await handleItemSupplierInvoiceAmountRead(poIds); 
  
      const itemsByPO = poItems.reduce((acc, item) => {
        const key = item.PurchaseOrder;
        acc[key] = acc[key] || [];
        acc[key].push(item);
        return acc;
      }, {});

      supplierInvoiceAmount.forEach((supplier) => {
        const { PurchaseOrder, SupplierInvoiceItemAmount } = supplier;
        const items = itemsByPO[PurchaseOrder];
        if (items) {
          items.forEach(item => {
            item.SupplierInvoiceItemAmount = SupplierInvoiceItemAmount;
          });
        }
      });
      
  
      const netAmountByPO = netAmounts.reduce((acc, row) => {
        acc[row.PurchaseOrder] = row.NetAmount;
        return acc;
      }, {});

      const supplierInvoiceAmountByPO = supplierInvoiceAmounts.reduce((acc, row) => {
        acc[row.PurchaseOrder] = row.SupplierInvoiceAmount;
        return acc;
      }, {});
  
      poHeaders.forEach(po => {
        po._PurchaseOrderItem = itemsByPO[po.PurchaseOrder] || [];
        po.NetAmountTotal = netAmountByPO[po.PurchaseOrder] || 0;
        po.SupplierInvoiceAmountTotal = supplierInvoiceAmountByPO[po.PurchaseOrder] || 0;
      
        if (po.NetAmountTotal > 0) {
          po.InvoicePercent = Math.round((po.SupplierInvoiceAmountTotal / po.NetAmountTotal) * 100);
        
          if (po.InvoicePercent < 25) {
            po.InvoiceStatusColor = 1;
          } else if (po.InvoicePercent <= 75) {
            po.InvoiceStatusColor = 2;
          } else {
            po.InvoiceStatusColor = 3;
          }
        } else {
          po.InvoicePercent = 0;
          po.InvoiceStatusColor = 1;
        }
        
      });
      
  
      return poHeaders.length === 1 ? poHeaders[0] : poHeaders;
  
    } catch (err) {
      console.error('Error al leer órdenes de compra:', err);
      return req.reject(500, 'Error al leer órdenes de compra');
    }
  });
  
  
  this.on('READ', 'PurchaseOrderExt._SupplierAddress', async (req) => {
    try {
      const { PurchaseOrder } = req.params?.[0] || {};
      if (!PurchaseOrder) {
        return req.reject(400, 'El parámetro PurchaseOrder es obligatorio.');
      }

      const result = await s4Purchase.send({
        method: 'GET',
        path: `/PurchaseOrder(PurchaseOrder='${PurchaseOrder}')/to_PurchaseOrderSupplierAddress`,
      });

      if (!result) {
        return req.reject(404, `No se encontró dirección para la orden ${PurchaseOrder}`);
      }

      return result;

    } catch (error) {  return req.reject(500, 'Error al recuperar dirección del proveedor'); }
  });

  /**************** FIN 1 **************/

  /**************** 2 ****************/
  /**
   * GET SupplierInvoiceExt
   * Devuelve las facturas desde el servicio S/4HANA,
   * incluyendo los ítems (_InvoiceItem) de cada factura
   */
  this.on('READ', 'SupplierInvoiceExt', (req) => handleSupplierInvoiceRead(req, s4Invoices));
  /**
   * GET SupplierInvoiceItemExt
   * Devuelve los ítems (líneas) de factura de forma directa
   */
  this.on('READ', 'SupplierInvoiceItemExt', handleSupplierInvoiceItemRead);
  /**************** FIN 2 **************/

  /**************** 3 ****************/
  /**
 * GET PurchaseOrderNetAmount
 * Vista agregada que devuelve el monto neto total agrupado por orden de compra,
 * calculado a partir de PurchaseOrderItem (servicio externo S/4HANA).
 * Se expone como entidad virtual (read-only).
 */
  this.on('READ', 'PurchaseOrderNetAmount', handleNetAmountRead);

  /**
 * GET PurchaseOrderSupplierInvoiceAmount
 * Vista agregada que devuelve el monto total facturado por orden de compra,
 * basado en los ítems de factura del servicio S/4HANA.
 */
  this.on('READ', 'PurchaseOrderSupplierInvoiceAmount', handleSupplierInvoiceAmountRead);

  /**
 * GET PurchaseOrderItemSupplierInvoiceAmount
 * Vista agregada que devuelve el monto total facturado por orden y posición (item),
 * permitiendo trazabilidad a nivel de ítem de orden.
 */
  this.on('READ', 'PurchaseOrderItemSupplierInvoiceAmount', handleItemSupplierInvoiceAmountRead);
  /**************** FIN 3 **************/

  
  /**************** 4 ****************/
  /**
 * GET BusinessPartnerExt
 * Devuelve los socios comerciales desde el servicio S/4HANA,
 * incluyendo direcciones (_BusinessPartnerAddress) y roles (_BusinessPartnerRole)
 */

  this.on('READ', 'BusinessPartnerExt', (req) => handleBusinessPartnerRead(req, s4bp));

  /**************** FIN 4 **************/
  
  
});
