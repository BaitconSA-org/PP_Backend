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


  /**
 * READ - PurchaseOrderExt
 * - Soporta filtros mixtos (reales + calculados)
 * - Soporta $count
 * - Enriquecer con montos, % facturación y UnitPrice
 */
  /** Campos que se calculan en memoria */
  const CALC_FIELDS = [
    'InvoicePercent',
    'InvoiceStatusColor',
    'NetAmountTotal',
    'SupplierInvoiceAmountTotal',
    'UnitPrice',
  ];

  // ---------- utilidades ------------------------------------------
  /** Clona un CQN sin referencias circulares */
  const cloneCQN = q => JSON.parse(JSON.stringify(q));


  function applyCalculatedFilters(poHeaders, whereCQN) {
    if (!Array.isArray(whereCQN) || !whereCQN.length) return poHeaders;

    const CALC_FIELDS = [
      'InvoicePercent',
      'InvoiceStatusColor',
      'NetAmountTotal',
      'SupplierInvoiceAmountTotal',
      'UnitPrice',
    ];

    const keep = [];

    for (const po of poHeaders) {
      let include = true;

      for (let i = 0; i < whereCQN.length; i++) {
        const clause = whereCQN[i];

        /* Casos “campo op valor” directamente en el array ------------------- */
        if (clause?.ref && CALC_FIELDS.includes(clause.ref[0])) {
          const field = clause.ref[0];
          const op    = whereCQN[i + 1];
          const value = whereCQN[i + 2]?.val;
          include = evaluate(po[field], op, value);
          if (!include) break;
          i += 2;          
        }

        /* Casos con xpr (UI5 suele enviar así cuando hay OR/AND) ------------ */
        if (clause?.xpr) {
          for (let j = 0; j < clause.xpr.length; j++) {
            const x = clause.xpr;
            if (x[j]?.ref && CALC_FIELDS.includes(x[j].ref[0])) {
              const field = x[j].ref[0];
              const op    = x[j + 1];
              const value = x[j + 2]?.val;
              include = evaluate(po[field], op, value);
              if (!include) break;
              j += 2;
            }
          }
          if (!include) break;
        }
      }

      if (include) keep.push(po);
    }

    return keep;

    function evaluate(lhs, op, rhs) {
      switch (op) {
      case '='  : return lhs === rhs;
      case '!=' : return lhs !== rhs;
      case '>'  : return lhs >  rhs;
      case '>=' : return lhs >= rhs;
      case '<'  : return lhs <  rhs;
      case '<=' : return lhs <= rhs;
      default   : return true;  
      }
    }
  }


  this.on('READ', 'PurchaseOrderExt', async (req) => {
    const s4Purchase = await cds.connect.to('purchaseorder_edmx');
    const userSupplierIDs = req.user?.attr?.supplierID ?? [];   // prod
    //const userSupplierIDs = ['31300001'];                          // tests

    if (!userSupplierIDs.length)
      return req.reject(403, 'El usuario no cuenta con roles de proveedor (supplierID).');

    try {
      let query;
      let filteredPOs;
      const originalWhere = req.query?.SELECT?.where || [];   // ← lo usaremos al final

   
      if (req.params?.length) {
        const poNumber = req.params[0].PurchaseOrder;
        query = SELECT.from('PurchaseOrder')
          .where({ PurchaseOrder: poNumber }).and({ Supplier: { in: userSupplierIDs } });

      } else {

        // Clonar para no tocar req.query
        query = cloneCQN(req.query);

        /* ---------- 1.1 Extraer PurchaseOrder desde el WHERE parseado ---------- */
        const parsedWhere = query.SELECT?.where || [];
        const poFromParsed = extractPOsFromCQN(parsedWhere);  // helper (ver más abajo)

        /* ---------- 1.2 si CAP no parseó el $filter ------------------ */
        const poFromRaw = [];
        if (!poFromParsed.length) {
          const rawFilter = req.http?.req?.query?.$filter;   // Express query string
          if (typeof rawFilter === 'string' && rawFilter.includes('PurchaseOrder eq')) {
            const regex = /PurchaseOrder\s+eq\s+'([^']+)'/g;
            let m; while ((m = regex.exec(rawFilter)) !== null) poFromRaw.push(m[1]);
          }
        }

        filteredPOs = poFromParsed.length ? poFromParsed : poFromRaw;

        /* ---------- 1.4  Inyectar filtros finales al SELECT -------------------- */
        const supplierClause = [{ ref: ['Supplier'] }, 'in', { val: userSupplierIDs }];
        query.SELECT.where = supplierClause;
        
      }

      /* ------------------------------------------------------------------
     * 2. Ejecutar en S/4
     * ------------------------------------------------------------------ */
      let poHeaders = await s4Purchase.run(query);
      if (!poHeaders.length) return poHeaders;

      // --- si vienen POs específicos, filtramos localmente
      if (filteredPOs.length > 0) {
        poHeaders = poHeaders.filter(po => filteredPOs.includes(po.PurchaseOrder));
      }

      /* ------------------------------------------------------------------
     * 3. Enriquecer cabeceras (items, montos, campos calculados)
     * ------------------------------------------------------------------ */
      const poIds = poHeaders.map(p => p.PurchaseOrder);

      const [poItems, net, invHdr, invItem] = await Promise.all([
        s4Purchase.run(SELECT.from('PurchaseOrderItem').where({ PurchaseOrder: { in: poIds } })),
        handleNetAmountRead(poIds),
        handleSupplierInvoiceAmountRead(poIds),
        handleItemSupplierInvoiceAmountRead(poIds),
      ]);

      const netByPO  = Object.fromEntries(net.map(r => [r.PurchaseOrder, r.NetAmount]));
      const invByPO  = Object.fromEntries(invHdr.map(r => [r.PurchaseOrder, r.SupplierInvoiceAmount]));
      const invByKey = Object.fromEntries(
        invItem.map(r => [`${r.PurchaseOrder}-${r.PurchaseOrderItem}`, r.SupplierInvoiceItemAmount]),
      );

      const itemsByPO = {};
      for (const it of poItems) {
        it.SupplierInvoiceItemAmount = invByKey[`${it.PurchaseOrder}-${it.PurchaseOrderItem}`] || 0;
        it.UnitPrice = it.NetPriceQuantity
          ? Number((it.NetPriceAmount / it.NetPriceQuantity).toFixed(2))
          : 0;
        (itemsByPO[it.PurchaseOrder] ||= []).push(it);
      }

      for (const po of poHeaders) {
        const items = itemsByPO[po.PurchaseOrder] || [];
        po._PurchaseOrderItem         = items;
        po.NetAmountTotal             = netByPO[po.PurchaseOrder] || 0;
        po.SupplierInvoiceAmountTotal = invByPO[po.PurchaseOrder] || 0;

        const ttlNet = items.reduce((a,i)=>a + (i.NetPriceAmount  ||0),0);
        const ttlQty = items.reduce((a,i)=>a + (i.NetPriceQuantity||0),0);
        po.UnitPrice = ttlQty ? Number((ttlNet/ttlQty).toFixed(2)) : 0;

        if (po.NetAmountTotal) {
          po.InvoicePercent     = Math.round(po.SupplierInvoiceAmountTotal / po.NetAmountTotal * 100);
          po.InvoiceStatusColor = po.InvoicePercent < 25 ? 1
            : (po.InvoicePercent <= 75 ? 2 : 3);
        } else {
          po.InvoicePercent     = 0;
          po.InvoiceStatusColor = 1;
        }
      }

      /* ------------------------------------------------------------------
     * 4. Aplicar filtros locales (calculados)
     * ------------------------------------------------------------------ */
      // poHeaders(items, montos, etc.)
      poHeaders = applyCalculatedFilters(poHeaders, originalWhere);

      return poHeaders.length === 1 ? poHeaders[0] : poHeaders;


    } catch (err) {
      console.error('[ERROR] PurchaseOrderExt:', err);
      return req.reject(500, 'Error al leer órdenes de compra');
    }
  });

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  function extractPOsFromCQN(where = []) {
    const out = [];

    for (let i = 0; i < where.length; i++) {
      const cl = where[i];
      if (cl?.ref?.[0] === 'PurchaseOrder' && where[i+1] === 'eq' && where[i+2]?.val) {
        out.push(where[i+2].val);
      }
      if (cl?.xpr) {
        const x = cl.xpr;
        for (let j = 0; j < x.length; j++) {
          if (x[j]?.ref?.[0] === 'PurchaseOrder' && x[j+1] === 'eq' && x[j+2]?.val)
            out.push(x[j+2].val);
        }
      }
    }
    return out;
  }



  
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
