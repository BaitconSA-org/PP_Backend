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

const {
  handlePurchaseOrderSupplierInvRead,
} = require('./aggregates/views/PurchaseOrderSupplierInvoicesRead');

const handlePOWithInvoicesRead = require('./aggregates/PurchaseOrderWithInvoices');

const doxClient = require('./dox/dox-client');


module.exports = cds.service.impl(async function () {
  // Conexiones
  const s4Purchase = await cds.connect.to('purchaseorder_edmx');
  const s4Invoices = await cds.connect.to('A_SupplierInvoice_edmx');
  const s4bp = await cds.connect.to('A_BusinessPartner');

  /**************** 1 ****************/
  this.on('READ', 'PurchaseOrderItemExt', async req => {
    try {
      /* ------------------------------------------------------------------ */
      /* 1. Construir CQN base                                              */
      /* ------------------------------------------------------------------ */
      const q = SELECT.from('PurchaseOrderItem');

      let onlyOneItem = false;      // ← para saber qué devolver al final

      if (req.params?.length) {
        const { PurchaseOrder, PurchaseOrderItem } = req.params[0] || {};

        if (PurchaseOrder && PurchaseOrderItem) {
          // Navegación directa a un ítem concreto …/_PurchaseOrderItem(PurchaseOrder=...,PurchaseOrderItem=...)
          q.where({ PurchaseOrder, PurchaseOrderItem });
          onlyOneItem = true;
        } else if (PurchaseOrder) {
          // Navegación …/PurchaseOrderExt('4500000008')/_PurchaseOrderItem
          q.where({ PurchaseOrder });
        }
      }

      /* Delegar $select, $top, $skip, etc. que vengan en la llamada       */
      Object.assign(q, req.query);

      /* ------------------------------------------------------------------ */
      /* 2. Leer ítems de la orden (o el ítem único)                        */
      /* ------------------------------------------------------------------ */
      const poItemsRaw = await s4Purchase.run(q);
      const poItems = Array.isArray(poItemsRaw) ? poItemsRaw : [poItemsRaw];

      if (!poItems.length) return [];

      /* ------------------------------------------------------------------ */
      /* 3. Calcular importes de factura por línea                          */
      /* handleItemSupplierInvoiceAmountRead debe aceptar array de claves   */
      /* ------------------------------------------------------------------ */
      const poLineKeys = poItems.map(i => ({
        PurchaseOrder     : i.PurchaseOrder,
        PurchaseOrderItem : i.PurchaseOrderItem,
      }));

      const invoiceAmounts = await handleItemSupplierInvoiceAmountRead(poLineKeys);

      /* Índice PO-Item  →  importe facturado */
      const amountMap = invoiceAmounts.reduce((m, row) => {
        m[`${row.PurchaseOrder}-${row.PurchaseOrderItem}`] = row.SupplierInvoiceItemAmount;
        return m;
      }, {});

      /* ------------------------------------------------------------------ */
      /* 4. Enriquecer líneas con importe facturado y UnitPrice             */
      /* ------------------------------------------------------------------ */
      poItems.forEach(item => {
        const key = `${item.PurchaseOrder}-${item.PurchaseOrderItem}`;
        const netPrice = item.NetPriceAmount   || 0;
        const quantity = item.NetPriceQuantity || 0;

        item.SupplierInvoiceItemAmount = amountMap[key] || 0;
        item.UnitPrice = quantity !== 0 ? parseFloat((netPrice / quantity).toFixed(2)) : 0;
      });

      /* ------------------------------------------------------------------ */
      /* 5. Respuesta                                                       */
      /* ------------------------------------------------------------------ */
      return onlyOneItem ? poItems[0] : poItems;

    } catch (err) {
      console.error('Error en PurchaseOrderItemExt:', err);
      return req.reject(500, 'Error al leer ítems de órdenes');
    }
  });


  this.on('READ', 'PurchaseOrderExt', async (req) => {
    //const userSupplierIDs = ['31300001'];
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
        //LOGICA PARA OMITIR FILTROS CALCULADOS
        const query = JSON.parse(JSON.stringify(req.query)); // clonado profundo para evitar mutaciones peligrosas

        // --- Limpiar filtros con campos calculados
        const calculatedFields = [
          'InvoicePercent',
          'InvoiceStatusColor',
          'NetAmountTotal',
          'SupplierInvoiceAmountTotal',
          'UnitPrice',
        ];

        if (query.SELECT?.where) {
          query.SELECT.where = query.SELECT.where.filter((clause) => {
            // Caso simple: { ref: [...] }
            if (clause?.ref && calculatedFields.includes(clause.ref[0])) return false;

            // Caso complejo: { xpr: [...] }
            if (clause?.xpr) {
              return !clause.xpr.some(
                part => part?.ref && calculatedFields.includes(part.ref[0]),
              );
            }

            return true;
          });
        }

        // Asegurar que query.where no exista a nivel raíz
        delete query.where;

        // --- Agregar filtro por proveedor
        const supplierFilter = [
          { ref: ['Supplier'] }, 'in', { val: userSupplierIDs },
        ];

        if (query.SELECT?.where) {
          query.SELECT.where = ['(', ...query.SELECT.where, ')', 'and', ...supplierFilter];
        } else {
          query.SELECT.where = supplierFilter;
        }


        poHeaders = await s4Purchase.run(query);
      }

      const poIds = poHeaders.map(po => po.PurchaseOrder);

      const poItems = await s4Purchase.run(
        SELECT.from('PurchaseOrderItem').where({ PurchaseOrder: { in: poIds } }),
      );

      const netAmounts = await handleNetAmountRead(poIds);
      const supplierInvoiceAmounts = await handleSupplierInvoiceAmountRead(poIds);
      const supplierInvoiceAmount = await handleItemSupplierInvoiceAmountRead(poIds);

      const amountMap = supplierInvoiceAmount.reduce((acc, row) => {
        const key = `${row.PurchaseOrder}-${row.PurchaseOrderItem}`;
        acc[key] = row.SupplierInvoiceItemAmount;
        return acc;
      }, {});

      const itemsByPO = poItems.reduce((acc, item) => {
        const key = item.PurchaseOrder;
        const poItemKey = `${item.PurchaseOrder}-${item.PurchaseOrderItem}`;
        item.SupplierInvoiceItemAmount = amountMap[poItemKey] || 0;

        const netPrice = item.NetPriceAmount || 0;
        const quantity = item.NetPriceQuantity || 0;
        item.UnitPrice = quantity !== 0 ? parseFloat((netPrice / quantity).toFixed(2)) : 0;

        (acc[key] = acc[key] || []).push(item);
        return acc;
      }, {});

      const netAmountByPO = netAmounts.reduce((acc, row) => {
        acc[row.PurchaseOrder] = row.NetAmount;
        return acc;
      }, {});

      const supplierInvoiceAmountByPO = supplierInvoiceAmounts.reduce((acc, row) => {
        acc[row.PurchaseOrder] = row.SupplierInvoiceAmount;
        return acc;
      }, {});

      poHeaders.forEach(po => {
        const items = itemsByPO[po.PurchaseOrder] || [];
        po._PurchaseOrderItem = items;

        po.NetAmountTotal = netAmountByPO[po.PurchaseOrder] || 0;
        po.SupplierInvoiceAmountTotal = supplierInvoiceAmountByPO[po.PurchaseOrder] || 0;

        const totalNetAmt = items.reduce((a, i) => a + (i.NetPriceAmount || 0), 0);
        const totalQty = items.reduce((a, i) => a + (i.NetPriceQuantity || 0), 0);
        po.UnitPrice = totalQty !== 0 ? parseFloat((totalNetAmt / totalQty).toFixed(2)) : 0;

        if (po.NetAmountTotal > 0) {
          po.InvoicePercent = Math.round((po.SupplierInvoiceAmountTotal / po.NetAmountTotal) * 100);
          po.InvoiceStatusColor = po.InvoicePercent < 25 ? 1 : (po.InvoicePercent <= 75 ? 2 : 3);
        } else {
          po.InvoicePercent = 0;
          po.InvoiceStatusColor = 1;
        }
      });

      // APLICAR FILTROS LOCALES
      const originalWhere = req.query?.SELECT?.where;

      if (originalWhere) {
        const calculatedFields = [
          'InvoicePercent',
          'InvoiceStatusColor',
          'NetAmountTotal',
          'SupplierInvoiceAmountTotal',
          'UnitPrice',
        ];

        poHeaders = poHeaders.filter(po => {
          let include = true;

          for (let i = 0; i < originalWhere.length; i++) {
            const cond = originalWhere[i];

            // condición como objeto xpr (ej: { xpr: [...] })
            if (cond?.xpr && Array.isArray(cond.xpr)) {
              const [left, op, right] = cond.xpr;

              if (left?.ref && calculatedFields.includes(left.ref[0])) {
                const field = left.ref[0];
                const value = right?.val;
                const fieldVal = po[field];

                switch (op) {
                case '=':  if (fieldVal !== value) include = false; break;
                case '!=': if (fieldVal === value) include = false; break;
                case '>':  if (!(fieldVal > value)) include = false; break;
                case '>=': if (!(fieldVal >= value)) include = false; break;
                case '<':  if (!(fieldVal < value)) include = false; break;
                case '<=': if (!(fieldVal <= value)) include = false; break;
                }
              }
            }

            // Caso 2: directa: { ref }, '=', { val }
            else if (cond?.ref && calculatedFields.includes(cond.ref[0])) {
              const field = cond.ref[0];
              const operator = originalWhere[i + 1];
              const value = originalWhere[i + 2]?.val;
              const fieldVal = po[field];

              switch (operator) {
              case '=':  if (fieldVal !== value) include = false; break;
              case '!=': if (fieldVal === value) include = false; break;
              case '>':  if (!(fieldVal > value)) include = false; break;
              case '>=': if (!(fieldVal >= value)) include = false; break;
              case '<':  if (!(fieldVal < value)) include = false; break;
              case '<=': if (!(fieldVal <= value)) include = false; break;
              }

              i += 2;
            }

            if (!include) break;
          }

          return include;
        });
      }


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
  this.on('READ', 'SupplierInvoiceItemExt', (req) => handleSupplierInvoiceItemRead(req, s4Invoices));
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

  /**************** 5 ****************/
  /**
 * GET PurchaseOrderInvoiceMap
 * Devuelve las facturas asociadas a las posiciones de la OC,
 */

  this.on('READ', 'PurchaseOrderWithInvoices', (req) => handlePOWithInvoicesRead(req, s4Purchase, s4Invoices));

  /**************** FIN 5 **************/

  this.on('READ', 'PurchaseOrderSupplierInvoices', req => handlePurchaseOrderSupplierInvRead(req, s4Invoices));


  /**
   * DOX
   * Acción: uploadPdf
   * Recibe el archivo PDF como base64 y lo sube al servicio DOX
   */
  this.on('uploadPdf', async (req) => {
    try {
      const { file, filename } = req.data;

      if (!file) return req.reject(400, 'Missing file');
      const buf = Buffer.from(file, 'base64');

      const result = await doxClient.uploadPdf(buf, filename || 'invoice.pdf');

      // Opcional: guardar documentId/jobId en una tabla local si querés
      return {
        documentId: result.documentId,
        jobId: result.jobId,
        status: result.status,
      };
    } catch (err) {
      console.error('[uploadPdf] Error:', err.message);
      return req.reject(500, 'Error uploading PDF to DOX');
    }
  });

  /**
   * Acción: checkJob
   * Consulta el estado del procesamiento DOX para un documentId
   */
  this.on('checkJob', async (req) => {
    try {
      const { documentId } = req.data;

      if (!documentId) return req.reject(400, 'Missing documentId');

      const result = await doxClient.getJobStatus(documentId);

      return {
        status: result.status,
        fields: result.extractedFields || null,
        documentId: result.documentId,
      };
    } catch (err) {
      console.error('[checkJob] Error:', err.message);
      return req.reject(500, 'Error checking DOX job status');
    }
  });
  /**************** FIN DOX **************/
  
  
});
