/* eslint-disable no-console */
const cds = require('@sap/cds');
const fs = require('fs');

const path = require('path');

const {
  handleInvoiceRead,
  handleInvoiceItemsRead,
} = require('./invoice/invoiceService');

const handleSyncInvoices = require('./invoice/syncInvoices');
const { updateInvoiceFromWorkflow } = require('./workflow/UpdateInvoiceFromWorkflow');


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

const dmsClient = require('./dms/dms-client');

const { handleUploadPdf } = require('./dox/dox-functions');

const { handleStartWorkflow } = require('./workflow/workflow-functions');


const {
  PurchaseOrderExt,
} = cds.entities('SupplierPortalService');

module.exports = cds.service.impl(async function () {
  // Conexiones
  const s4Purchase = await cds.connect.to('purchaseorder_edmx');
  const s4Invoices = await cds.connect.to('A_SupplierInvoice_edmx');
  const s4bp = await cds.connect.to('A_BusinessPartner');

  /**************** InvoiceReport Handler */
  // --- READ InvoiceReport (solo facturas aprobadas status = '5') ---
  this.on('READ', 'InvoiceReport', async (req) => {
    const tx = cds.transaction(req);

    // 1) Traer todas las facturas con su createdAt y status
    const rows = await tx.run(
      SELECT.from('supplierPortalGD.Invoices')
        .columns('createdAt', 'status_statusCode'),
    );

    // 2) Agrupar en memoria por año/mes
    const map = Object.create(null);
    for (const r of rows) {
      if (!r.createdAt) continue;
      const d = new Date(String(r.createdAt));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = `${y}-${m}`;
      if (!map[key]) map[key] = { year: y, month: m, totalInvoices: 0 };
      map[key].totalInvoices++;
    }

    return Object.values(map);
  });

   /**************** total de facturas del mes actual!****************/
  this.on('totalInvoicesCurrentMonth', async (req) => {
    const tx = cds.transaction(req);
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const result = await tx.run(
      SELECT.one`count(*) as total`
        .from('supplierPortalGD.Invoices')
        .where`month(createdAt) = ${currentMonth} and year(createdAt) = ${currentYear}`
    );

  const total = result?.total || 0;

  // 🔹 Detectar si el Launchpad pide texto plano
  const acceptHeader = req._.req.headers['accept'] || '';
  const wantsPlainText = acceptHeader.includes('text/plain');

  if (wantsPlainText) {
    const res = req._.res;
    res.status(200).type('text/plain').send(String(total));
    return; // 🔥 corta el flujo OData
  }

  return { value: total };
});

  /**************** 1 ****************/
  this.on('READ', 'PurchaseOrderItemExt', async req => {
    try {
    /* ------------------------------------------------------------------ */
    /* 1. Construir CQN base                                              */
    /* ------------------------------------------------------------------ */
      const q = SELECT.from('PurchaseOrderItem');
      let onlyOneItem = false;

      if (req.params?.length) {
        const { PurchaseOrder, PurchaseOrderItem } = req.params[0] || {};

        if (PurchaseOrder && PurchaseOrderItem) {
          q.where({ PurchaseOrder, PurchaseOrderItem });
          onlyOneItem = true;
        } else if (PurchaseOrder) {
          q.where({ PurchaseOrder });
        }
      }

      Object.assign(q, req.query);

      /* ------------------------------------------------------------------ */
      /* 2. Leer ítems de la orden (o el ítem único)                        */
      /* ------------------------------------------------------------------ */
      const poItemsRaw = await s4Purchase.run(q);
      const poItems = Array.isArray(poItemsRaw) ? poItemsRaw : [poItemsRaw];
      if (!poItems.length) return [];

      const poLineKeys = poItems.map(i => ({
        PurchaseOrder: i.PurchaseOrder,
        PurchaseOrderItem: i.PurchaseOrderItem,
      }));

      const poIds = [...new Set(poItems.map(i => i.PurchaseOrder))];

      /* ------------------------------------------------------------------ */
      /* 3. Llamadas paralelas: factura por ítem + referencia factura       */
      /* ------------------------------------------------------------------ */
      const [invoiceItems, invoiceItemsRef] = await Promise.all([
        handleItemSupplierInvoiceAmountRead(poLineKeys),
        s4Invoices.run(
          SELECT.from('A_SuplrInvcItemPurOrdRef').where({ PurchaseOrder: { in: poIds } }),
        ),
      ]);

      /* ------------------------------------------------------------------ */
      /* 4. Mapas de ayuda                                                  */
      /* ------------------------------------------------------------------ */
      const invByKey = Object.fromEntries(invoiceItems.map(r =>
        [`${r.PurchaseOrder}-${r.PurchaseOrderItem}`, r.SupplierInvoiceItemAmount],
      ));

      const invQtyByKey = {};
      for (const item of invoiceItemsRef) {
        const key = `${item.PurchaseOrder}-${item.PurchaseOrderItem}`;
        const qty = item.QuantityInPurchaseOrderUnit;
        invQtyByKey[key] = (invQtyByKey[key] || 0) + (qty ? parseFloat(qty) : 0);
      }

      /* ------------------------------------------------------------------ */
      /* 5. Enriquecer líneas con datos calculados                          */
      /* ------------------------------------------------------------------ */
      poItems.forEach(item => {
        const key = `${item.PurchaseOrder}-${item.PurchaseOrderItem}`;

        item.SupplierInvoiceItemAmount = invByKey[key] || 0;
        item.QuantityInPurchaseOrderUnit = invQtyByKey[key] || 0;

        item.UnitPrice = item.NetPriceQuantity
          ? Number((item.NetPriceAmount / item.NetPriceQuantity).toFixed(2))
          : 0;
      });

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


  function applyCalculatedFilters(poHeaders, whereCQN, rawFilter = '') {
    const CALC_FIELDS = [
      'InvoicePercent',
      'InvoiceStatusColor',
      'NetAmountTotal',
      'SupplierInvoiceAmountTotal',
      'UnitPrice',
    ];

    if ((!Array.isArray(whereCQN) || !whereCQN.length) && !rawFilter) return poHeaders;

    const keep = [];

    for (const po of poHeaders) {
      let include = true;

      /* ----------- A. Filtrado por whereCQN parseado ---------------------- */
      if (Array.isArray(whereCQN) && whereCQN.length) {
        for (let i = 0; i < whereCQN.length; i++) {
          const clause = whereCQN[i];

          if (clause?.ref && CALC_FIELDS.includes(clause.ref[0])) {
            const field = clause.ref[0];
            const op    = whereCQN[i + 1];
            const value = whereCQN[i + 2]?.val;
            include = evaluate(po[field], op, value);
            if (!include) break;
            i += 2;
          }

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
      }

      /* ----------- B. Si no vino whereCQN usable, usar rawFilter ----------- */
      if (include && rawFilter && CALC_FIELDS.some(f => rawFilter.includes(f))) {
        for (const field of CALC_FIELDS) {
          const regex = new RegExp(`${field}\\s+(eq|ne|gt|ge|lt|le)\\s+(\\d+(\\.\\d+)?)`, 'gi');
          let match;
          while ((match = regex.exec(rawFilter)) !== null) {
            const [, opStr, numStr] = match;
            const rhs = Number(numStr);
            const lhs = po[field];
            const op = operatorMap(opStr);
            if (!evaluate(lhs, op, rhs)) {
              include = false;
              break;
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

    function operatorMap(opStr) {
      switch (opStr.toLowerCase()) {
      case 'eq': return '=';
      case 'ne': return '!=';
      case 'gt': return '>';
      case 'ge': return '>=';
      case 'lt': return '<';
      case 'le': return '<=';
      default: return '=';
      }
    }
  }


  function applyPostFilters(poHeaders, originalWhere) {
    if (!Array.isArray(originalWhere) || originalWhere.length === 0)
      return poHeaders;

    return poHeaders.filter(po => {
      let include = true;

      for (let i = 0; i < originalWhere.length; i++) {
        const token = originalWhere[i];

        if (token?.ref && Array.isArray(token.ref)) {
          const field = token.ref[0];               // Ej: 'Supplier'
          const operator = originalWhere[i + 1];    // Ej: '='
          const value = originalWhere[i + 2]?.val;  // Ej: '31300003'

          if (!evaluate(po[field], operator, value)) {
            include = false;
            break;
          }

          i += 2; // Saltar al próximo grupo
        }

        // Saltar conectores ('and', 'or')
        if (typeof token === 'string' && ['and', 'or'].includes(token.toLowerCase())) {
          continue;
        }
      }

      return include;
    });

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
    //const userSupplierIDs = ['31300001'];
    let userSupplierIDs = req.user?.attr?.supplierID;

    const isLocal =
      req.user?.id === 'system' ||
      req.user?.id === 'anonymous' ||
      cds.env.profile?.includes?.('development');

    if (!Array.isArray(userSupplierIDs) || userSupplierIDs.length === 0) {
      if (isLocal) {
        console.warn('⚠️ Ejecutando en modo local o sin token. Usando proveedor mock.');
        userSupplierIDs = ['31300001']; // ← mock
      } else {
        return req.reject(403, 'El usuario no cuenta con roles de proveedor');
      }
    }

    req._batchCache = req._batchCache || {};
    const isCountEndpoint = req.http?.req?.originalUrl?.includes('/$count');

    // Si ya se procesó antes en el batch
    if (isCountEndpoint && req._batchCache.poHeaders) {
      return req._batchCache.poHeaders.length;
    }

    let query;
    let filteredPOs;
    const originalWhere = req.query?.SELECT?.where || [];
    const rawFilter = req.http?.req?.query?.$filter || '';

    if (req.params?.length) {
      const poNumber = req.params[0].PurchaseOrder;
      query = SELECT.from('PurchaseOrder')
        .where({ PurchaseOrder: poNumber }).and({ Supplier: { in: userSupplierIDs } });

    } else {
      query = cloneCQN(req.query);
      const parsedWhere = query.SELECT?.where || [];
      const poFromParsed = extractPOsFromCQN(parsedWhere);
      const poFromRaw = !poFromParsed.length && rawFilter.includes('PurchaseOrder')
        ? [...rawFilter.matchAll(/PurchaseOrder\s+eq\s+'([^']+)'/g)].map(m => m[1])
        : [];

      filteredPOs = poFromParsed.length ? poFromParsed : poFromRaw;



      // Eliminar count/columns si es $count=true
      if (req.query?.SELECT?.count) delete query.SELECT.count;
      if (query.SELECT?.columns?.some(c => c.func === 'count')) delete query.SELECT.columns;
    }

    let poHeaders = await s4Purchase.run(query);
      const allPoIds = poHeaders.map(p => p.PurchaseOrder);  // ← CAMBIA solo esta línea
    
      // Consulta adicional para obtener Supplier IDs reales
      const poDetails = await s4Purchase.run(
        SELECT.from('PurchaseOrder')
          .columns('PurchaseOrder', 'Supplier')
          .where({ PurchaseOrder: { in: allPoIds } })  // ← Y esta también
      );

      // Filtrar órdenes que pertenecen a los suppliers del usuario
      const validPOs = poDetails
        .filter(po => userSupplierIDs.includes(po.Supplier))
        .map(po => po.PurchaseOrder);

      // Aplicar filtro final
      poHeaders = poHeaders.filter(po => validPOs.includes(po.PurchaseOrder));
     // console.log('DEBUG - Número de órdenes después de consulta S4:', poHeaders.length);

    if (!poHeaders.length) return [];

    poHeaders = applyPostFilters(poHeaders, originalWhere);
    if (filteredPOs?.length)
    poHeaders = poHeaders.filter(po => filteredPOs.includes(po.PurchaseOrder));

    /* ------------------------------------------------------------------
 * 3. Enriquecer cabeceras (items, montos, campos calculados)
 * ------------------------------------------------------------------ */
    const poIds = poHeaders.map(p => p.PurchaseOrder);

    // 1. Obtener datos en paralelo
    const [poItems, invoiceItemsRef, netAmounts, invoiceHeaders, invoiceItems] = await Promise.all([
      s4Purchase.run(SELECT.from('PurchaseOrderItem').where({ PurchaseOrder: { in: poIds } })),
      s4Invoices.run(SELECT.from('A_SuplrInvcItemPurOrdRef').where({ PurchaseOrder: { in: poIds } })),
      handleNetAmountRead(poIds),
      handleSupplierInvoiceAmountRead(poIds),
      handleItemSupplierInvoiceAmountRead(poIds),
    ]);

    // 2. Mapear datos por clave
   const netByPO  = Object.fromEntries(netAmounts.map(r => [r.PurchaseOrder, r.NetAmount]));
    const invByPO  = Object.fromEntries(invoiceHeaders.map(r => [r.PurchaseOrder, r.SupplierInvoiceAmount]));
    const invByKey = Object.fromEntries(invoiceItems.map(r =>
      [`${r.PurchaseOrder}-${r.PurchaseOrderItem}`, r.SupplierInvoiceItemAmount],
    ));

    // 3. Mapear cantidad facturada por ítem
    const invQtyByKey = {};
    for (const item of invoiceItemsRef) {
      const key = `${item.PurchaseOrder}-${item.PurchaseOrderItem}`;
      const qty = item.QuantityInPurchaseOrderUnit;
      invQtyByKey[key] = (invQtyByKey[key] || 0) + (qty ? parseFloat(qty) : 0);
    }

    // 4. Agrupar ítems por orden y enriquecer
    const itemsByPO = {};
    for (const item of poItems) {
      const key = `${item.PurchaseOrder}-${item.PurchaseOrderItem}`;
      item.SupplierInvoiceItemAmount = invByKey[key] || 0;
      item.QuantityInPurchaseOrderUnit = invQtyByKey[key] || 0;

      item.UnitPrice = item.NetPriceQuantity
        ? Number((item.NetPriceAmount / item.NetPriceQuantity).toFixed(2))
        : 0;

      (itemsByPO[item.PurchaseOrder] ||= []).push(item);
    }

    // 5. Enriquecer cabeceras
    for (const header of poHeaders) {
      const items = itemsByPO[header.PurchaseOrder] || [];
      header._PurchaseOrderItem         = items;
      header.NetAmountTotal             = netByPO[header.PurchaseOrder] || 0;
      header.SupplierInvoiceAmountTotal = invByPO[header.PurchaseOrder] || 0;

      const totalNet = items.reduce((sum, i) => sum + (i.NetPriceAmount || 0), 0);
      const totalQty = items.reduce((sum, i) => sum + (i.NetPriceQuantity || 0), 0);

      header.UnitPrice = totalQty ? Number((totalNet / totalQty).toFixed(2)) : 0;

      if (header.NetAmountTotal) {
        header.InvoicePercent = Math.round(
          (header.SupplierInvoiceAmountTotal / header.NetAmountTotal) * 100,
        );
        header.InvoiceStatusColor = header.InvoicePercent < 25 ? 1
          : (header.InvoicePercent <= 75 ? 2 : 3);
      } else {
        header.InvoicePercent = 0;
        header.InvoiceStatusColor = 1;
      }
    }

    poHeaders = applyCalculatedFilters(poHeaders, originalWhere, rawFilter);

    // Guardar en cache por si en este mismo batch viene /$count
    req._batchCache.poHeaders = poHeaders;

    // Si justo era $count → devolver la cantidad
    if (isCountEndpoint) {
      return poHeaders.length;
    }

    return poHeaders;
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

  this.on('READ', 'PurchaseOrderWithInvoices', (req) => handlePOWithInvoicesRead( req, s4Purchase, s4Invoices));

  /**************** FIN 5 **************/

  this.on('READ', 'PurchaseOrderSupplierInvoices', req => handlePurchaseOrderSupplierInvRead( req, s4Invoices));

  /********************************************/
  this.on('READ', 'Invoices', (req) => handleInvoiceRead( req, this));

  this.on('READ', 'InvoiceItems', (req) => handleInvoiceItemsRead( req, this));

  this.on('SyncInvoiceStatuses', (req) => handleSyncInvoices( req, this));

  /**
   * DOX
   * Acción: uploadPdf
   * Recibe el archivo PDF como base64 y lo sube al servicio DOX
   */
  this.on('uploadPdf', handleUploadPdf);


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
        fields: result.extraction || null,
        documentId: result.documentId,
      };
    } catch (err) {
      console.error('[checkJob] Error:', err.message);
      return req.reject(500, 'Error checking DOX job status');
    }
  });
  /**************** FIN DOX **************/

  /**************** DMS  *****************/
  this.on('uploadDocumentService', async (req) => {
    const { folderName, name } = req.data;
    const fileData = req.data.file;
    return dmsClient.uploadDocument(folderName, name, fileData);
  });
  
  this.on('deleteFolderService', async (req) => {
    const { folderId } = req.data;
    return dmsClient.deleteFolder(folderId);   
  });
  
  this.on('deleteDocumentService', async (req) => {
    const { documentId, folderName } = req.data;
    return dmsClient.deleteDocument(documentId, folderName);
  });

  this.on('getFoldersService', async (req) => {
    const { relativePath } = req.data || {};
    return dmsClient.listarDocumentosEnCarpeta(relativePath);
  });

  this.on('getDocumentService', async (req) => {
    const { folderName, documentName } = req.data;
    if (!folderName || !documentName) {
      return req.reject(400, 'folderName and documentName are required');
    }
    try {
      const fileBuffer = await dmsClient.getDocument(folderName, documentName);
      const base64Data = fileBuffer.toString('base64');
      return { file: base64Data };
    } catch (error) {
      console.error('Error in getDocumentService:', error);
      return req.reject(500, 'Error retrieving document from DMS');
    }
  });

  this.on('createDocumentService', async (req) => {
    const { supplierId, purchaseOrderId, documentName, file } = req.data;
    if (!supplierId || !purchaseOrderId || !documentName || !file) {
      return req.reject(400, 'supplierId, purchaseOrderId, documentName and file are required');
    }
    try {
      await dmsClient.createFolder(supplierId).catch(() => {});
      await dmsClient.createFolder(purchaseOrderId, supplierId).catch(() => {});
      const fullPath = `${supplierId}/${purchaseOrderId}`;
      await dmsClient.uploadDocument(fullPath, documentName, file);
      return { success: true };
    } catch (error) {
      console.error('Error in createFolderService:', error);
      return req.reject(500, 'Error creating folder in DMS');
    }
  });

  /**************** FIN DMS ****************/


  /**
   * WORKFLOW
   * Acción: startWorkflow
   * Recibe el contexto y definitionID
   */
  this.on('startWorkflow', req => handleStartWorkflow(req));

  /**************** FIN WORKFLOW ***********/
  this.on('UpdateInvoiceWorkflow', (req) => updateInvoiceFromWorkflow( req, this));


  /** * Leer Materiales Documents desde S/4HANA * */

  this.on('READ', 'MaterialDocumentExt', async (req) => {
    try {
      const s4 = await cds.connect.to('A_MaterialDocument');
      return await s4.run(req.query);
    } catch (error) {
      console.error('[ERROR] al leer MaterialDocumentExt:', error);
      return req.reject(500, 'Error al leer MaterialDocument desde S/4HANA');
    }
  });
  
  this.on('READ', 'MaterialDocumentItemExt', async (req) => {
    try {
      const s4 = await cds.connect.to('A_MaterialDocument');
      return await s4.run(req.query);
    } catch (error) {
      console.error('[ERROR] al leer MaterialDocumentItemExt:', error);
      return req.reject(500, 'Error al leer MaterialDocumentItem desde S/4HANA');
    }
  });


  
});
