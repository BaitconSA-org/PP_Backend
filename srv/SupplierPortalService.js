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
function isAdmin(req) {
  const xsapp = process.env.XSAPPNAME || "pp-backendServices-001";
  const scopes = req.user?.scopes || [];
  return scopes.includes(`${xsapp}.Admin`);
}
function getScopedSupplierIDs(req) {
    const raw = req.user?.attr?.supplierID;
    const supplierIDs = (Array.isArray(raw) ? raw : raw ? [raw] : [])
      .map(v => String(v).trim())
      .filter(Boolean);

    const isLocal =
      req.user?.id === "system" ||
      req.user?.id === "anonymous" ||
      cds.env.profile?.includes?.("development");

    if (!supplierIDs.length && isLocal) return ["0031300001"];

    if (!supplierIDs.length) {
      console.log("[AUTH] Missing supplierID attribute. user=", req.user?.id, "attrs=", req.user?.attr);
      req.reject(403, "El usuario no cuenta con supplierID");
      return null;
    }

    return supplierIDs;
  }
  function padWhereEq(where, refName, len) {
  if (!Array.isArray(where)) return;
  for (let i = 0; i < where.length - 2; i++) {
    const a = where[i], op = where[i + 1], b = where[i + 2];
    if (a?.ref?.length === 1 && a.ref[0] === refName && op === '=' && b?.val != null) {
      b.val = padIfDigits(b.val, len);
    }
  }
}
  function getTicketKeyWhere(req) {
  const id =
    req.data?.ID ||
    req.params?.[0]?.ID ||       // CAP suele poner la key acá en requests OData
    req.params?.[0]?.Id ||
    req.params?.[0]?.id;

  if (!id) return null;
  return { ID: id };
}
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function round2(v) {
  return Math.round(n(v) * 100) / 100;
}
function round6(v) {
  return Math.round(n(v) * 1e6) / 1e6;
}

function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }

async function nextSplitNo(tx, ticketId){
  const row = await tx.run(
    SELECT.one.from("PrecertTicketItems")
      .columns([{ func: "max", args: [{ ref: ["splitNo"] }], as: "maxNo" }])
      .where({ ticket_ID: ticketId })
  );
  const maxNo = row?.maxNo == null ? -1 : Number(row.maxNo);
  return maxNo + 1; // arranca en 0
}

async function nextSubTicketNo(tx, ticketId){
  const row = await tx.run(
    SELECT.one.from("PrecertTicketSplitLog")
      .columns([{ func: "max", args: [{ ref: ["subTicketNo"] }], as: "maxNo" }])
      .where({ ticket_ID: ticketId })
  );
  const maxNo = row?.maxNo == null ? -1 : Number(row.maxNo);
  return maxNo + 1;
}


module.exports = cds.service.impl(async function () {
  // Conexiones
  const s4Purchase = await cds.connect.to('purchaseorder_edmx');
  const s4Invoices = await cds.connect.to('A_SupplierInvoice_edmx');
  const s4bp = await cds.connect.to('A_BusinessPartner');
  const s4op = await cds.connect.to('API_OPLACCTGDOCITEMCUBE_SRV');
  const s4pay = await cds.connect.to('API_PAYMENT_ADVICE_SRV');
  const s4Contract = await cds.connect.to('API_PURCHASECONTRACT_PROCESS_SRV_0002');

  const { PrecertTickets, PrecertTicketItems, PrecertTicketSplitLog } = this.entities;

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
    /* ------------------------------------------------------------------ */
    /* 6. Enriquecer con Material Documents si se pidió en la query       */
    /* ------------------------------------------------------------------ */
       const shouldExpandMaterials = req.query.SELECT.columns?.some(col => 
      col.ref && col.ref[0] === '_MaterialItems'
    );

    if (shouldExpandMaterials && poItems.length > 0) {
      const materialService = await cds.connect.to('A_MaterialDocument');
      
      for (let item of poItems) {
        try {
          const materials = await materialService.run(
            SELECT.from('A_MaterialDocumentItem')
              .where({
                PurchaseOrder: item.PurchaseOrder,
                PurchaseOrderItem: item.PurchaseOrderItem
              })
          );
          item._MaterialItems = materials;
        } catch (error) {
          console.error('Error fetching materials:', error);
          item._MaterialItems = [];
        }
      }
    }

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
    const wantsInlineCount = req.query?.SELECT?.count === true;

    const limit = req.query?.SELECT?.limit;
    const top = Number(limit?.rows?.val ?? limit?.rows ?? 0);
    const skip = Number(limit?.offset?.val ?? limit?.offset ?? 0);

    const isCountEndpoint =
      req.http?.req?.originalUrl?.includes('/$count') ||
      (req.query?.SELECT?.columns?.length === 1 && req.query.SELECT.columns[0].as === '$count');

    if (isCountEndpoint && req._batchCache.poHeaders) {
      return [{ $count: req._batchCache.poHeaders.length }];
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
      if (query.SELECT?.limit) delete query.SELECT.limit;
      if (!query.SELECT?.orderBy || query.SELECT.orderBy.length === 0) query.SELECT.orderBy = [{ ref: ['PurchaseOrder'], sort: 'asc' }];
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

    const total = poHeaders.length;

    req._batchCache.poHeaders = poHeaders;

    if (isCountEndpoint) {
      return [{ $count: total }];
    }

    let result = poHeaders;
    if (top > 0) result = result.slice(skip, skip + top);
    if (wantsInlineCount) result.$count = total;

    return result;

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
  if (!supplierId || !documentName || !file) {
    return req.reject(400, 'supplierId, documentName and file are required');
  }
  try {
    await dmsClient.createFolder(supplierId).catch(() => {});
    
    // Usar 'facturas-sin-oc' si no hay purchaseOrderId
    const targetFolder = purchaseOrderId || 'facturas-sin-oc';
    await dmsClient.createFolder(targetFolder, supplierId).catch(() => {});
    
    const fullPath = `${supplierId}/${targetFolder}`; // ← Usar targetFolder en lugar de purchaseOrderId
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
        console.log('[MaterialDocumentItemExt] Iniciando lectura');

        let purchaseOrder, purchaseOrderItem;

        if (req.params && Array.isArray(req.params)) {
            const paramsWithItem = req.params.find(p => p.PurchaseOrder && p.PurchaseOrderItem);
            if (paramsWithItem) {
                purchaseOrder = paramsWithItem.PurchaseOrder;
                purchaseOrderItem = paramsWithItem.PurchaseOrderItem;
                console.log(`[MaterialDocumentItemExt] Filtros aplicados: PO=${purchaseOrder}, Item=${purchaseOrderItem}`);
            }
        }

        const materialService = await cds.connect.to('A_MaterialDocument');

        // Query base (NO se usa req.query porque rompe la navegación)
        let query = SELECT.from('A_MaterialDocumentItem');

        if (purchaseOrder && purchaseOrderItem) {
            query.where({
                PurchaseOrder: purchaseOrder,
                PurchaseOrderItem: purchaseOrderItem
            });
        } else {
            query.limit(100);
        }

        // Manejar expand
        const expandHeader =
            req.query.SELECT.expand &&
            req.query.SELECT.expand.find(e => e.ref && e.ref[0] === 'to_MaterialDocumentHeader');

        if (expandHeader) {
            console.log('[MaterialDocumentItemExt] Detectado expand to_MaterialDocumentHeader');

            const items = await materialService.run(query);

            if (!items.length) return [];

            const materialDocs = [...new Set(items.map(i => i.MaterialDocument))];
            const materialDocYears = [...new Set(items.map(i => i.MaterialDocumentYear))];

            const headers = await materialService.run(
                SELECT.from('A_MaterialDocument')
                      .where({
                          MaterialDocument: { in: materialDocs },
                          MaterialDocumentYear: { in: materialDocYears }
                      })
            );

            return items.map(item => ({
                ...item,
                to_MaterialDocumentHeader: headers.find(h =>
                    h.MaterialDocument === item.MaterialDogitcument &&
                    h.MaterialDocumentYear === item.MaterialDocumentYear
                ) || null
            }));
        }

        // Sin expand
        return await materialService.run(query);

    } catch (error) {
        console.error('[MaterialDocumentItemExt] Error:', error);
        req.reject(500, 'Error al leer documentos de material desde S/4HANA');
    }
  })
   
this.on("getPrecertCandidates", async (req) => {
  
  const supplierIDs = getScopedSupplierIDs(req);
  if (!Array.isArray(supplierIDs) || supplierIDs.length === 0) {
    return req.reject(403, "El usuario no cuenta con supplierID");
  }

  const { sourceType, sourceId } = req.data || {};
  const sType = String(sourceType || "").toUpperCase().trim();
  const sId = String(sourceId || "").trim();

  if (!sType || !sId) return req.reject(400, "sourceType y sourceId son obligatorios");
  if (sType !== "OC" && sType !== "CM") return req.reject(400, "sourceType debe ser OC o CM");

  try {
    // Conexiones remotas (las mismas que ya usás en otros handlers)
    const s4Purchase = await cds.connect.to("purchaseorder_edmx");
    const s4Invoices = await cds.connect.to("A_SupplierInvoice_edmx");

    const { PurchaseContractExt, PurchaseContractItemExt } = this.entities;

    // ==========================
    // PO
    // ==========================
    if (sType === "OC") {
      // (Opcional pero recomendable) validar ownership del PO por supplier
      // Si no querés bloquear por supplier, podés comentar este bloque.
      const poHeader = await s4Purchase.run(
      SELECT.one.from("PurchaseOrder")
        .columns(["PurchaseOrder", "Supplier"])
        .where({ PurchaseOrder: sId })
    );

      if (!poHeader) {
        // si no existe / no accesible, devolvemos vacío (para tu UX de "no candidates")
        return [];
      }

      const poSupplier = String(poHeader.Supplier || "").trim();
      if (poSupplier && !supplierIDs.includes(poSupplier)) {
        return req.reject(403, "No autorizado: la Purchase Order no pertenece al proveedor logueado");
      }

      const poItemsRaw = await s4Purchase.run(
      SELECT.from("PurchaseOrderItem")
        .columns([
          "PurchaseOrder",
          "PurchaseOrderItem",
          "Material",
          "PurchaseOrderItemText",
          "OrderQuantity"
        ])
        .where({ PurchaseOrder: sId })
    );

      const poItems = Array.isArray(poItemsRaw) ? poItemsRaw : (poItemsRaw ? [poItemsRaw] : []);
      if (!poItems.length) return [];

      // 2) Qty facturada por item (referencias de factura)
      const refs = await s4Invoices.run(
        SELECT.from("A_SuplrInvcItemPurOrdRef")
          .columns(["PurchaseOrder", "PurchaseOrderItem", "QuantityInPurchaseOrderUnit"])
          .where({ PurchaseOrder: sId })
      );

      const invQtyByKey = {};
      for (const r of refs || []) {
        const k = `${r.PurchaseOrder}-${r.PurchaseOrderItem}`;
        const qty = r.QuantityInPurchaseOrderUnit;
        invQtyByKey[k] = (invQtyByKey[k] || 0) + (qty ? parseFloat(qty) : 0);
      }

      // 3) Map a PrecertItemCandidate
      return poItems.map((it) => {
        const key = `${it.PurchaseOrder}-${it.PurchaseOrderItem}`;
        const ordered = parseFloat(it.OrderQuantity || 0);
        const invoiced = parseFloat(invQtyByKey[key] || 0);
        const available = Math.max(0, ordered - invoiced);

        return {
          sourceType: "PO",
          sourceId: it.PurchaseOrder,
          itemId: String(it.PurchaseOrderItem || ""),
          material: it.Material || "",
          description: it.PurchaseOrderItemText || "",
          orderedQty: ordered,
          invoicedQty: invoiced,
          availableQty: available,
        };
      });
    }

    // ==========================
    // CM
    // ==========================
    if (sType === "CM") {
      // Validar que el contrato pertenece al supplier del token
      const cmHeader = await SELECT.one.from(PurchaseContractExt)
        .columns(["PurchaseContract", "Supplier"])
        .where({
          PurchaseContract: sId,
          Supplier: { in: supplierIDs },
        });

      if (!cmHeader) return [];

      const cmItems = await SELECT.from(PurchaseContractItemExt)
        .columns([
          "PurchaseContract",
          "PurchaseContractItem",
          "Material",
          "PurchaseContractItemText",
          "TargetQuantity",
        ])
        .where({ PurchaseContract: sId });

      return (cmItems || []).map((it) => {
        const ordered = parseFloat(it.TargetQuantity || 0);
        const invoiced = 0;
        const available = Math.max(0, ordered - invoiced);

        return {
          sourceType: "CM",
          sourceId: it.PurchaseContract,
          itemId: String(it.PurchaseContractItem || ""),
          material: it.Material || "",
          description: it.PurchaseContractItemText || "",
          orderedQty: ordered,
          invoicedQty: invoiced,
          availableQty: available,
        };
      });
    }

    return [];
  } catch (e) {
    console.error("[getPrecertCandidates] error:", e);
    return req.reject(500, "Error al obtener posiciones para precertificación");
  }
});
  async function assertSourceOwnership(req, supplierIDs, srv) {
  const sType = String(req.data?.sourceType || "").toUpperCase().trim();
  const sId   = String(req.data?.sourceId || "").trim();

  if (!sType || !sId) req.reject(400, "sourceType y sourceId son obligatorios");
  if (sType !== "OC" && sType !== "CM") req.reject(400, "sourceType debe ser OC o CM");

  // ----- CM: validar con CAP projection -----
  if (sType === "CM") {
    const { PurchaseContractExt } = srv.entities;

    const ok = await SELECT.one.from(PurchaseContractExt)
      .columns(["PurchaseContract"])
      .where({
        PurchaseContract: sId,
        Supplier: { in: supplierIDs }
      });

    if (!ok) req.reject(403, "No autorizado: el Contrato Marco no pertenece al proveedor logueado");
    return;
  }

  // ----- PO: validar contra S/4 (si no tenés PO header proyectado local) -----
  const s4Purchase = await cds.connect.to("purchaseorder_edmx");

  // ----- PO: validar contra S/4 -----
let poHeader = null;

try {
  poHeader = await s4Purchase.run(
    SELECT.one.from("PurchaseOrder")
      .columns(["PurchaseOrder", "Supplier"])
      .where({ PurchaseOrder: sId })
  );
} catch (e) {
  // fallback por si tu EDMX expone A_PurchaseOrder
  try {
    poHeader = await s4Purchase.run(
      SELECT.one.from("A_PurchaseOrder")
        .columns(["PurchaseOrder", "Supplier"])
        .where({ PurchaseOrder: sId })
    );
  } catch (e2) {}
}

if (!poHeader) return req.reject(404, "Purchase Order inexistente");

const poSupplier = String(poHeader.Supplier || "").trim();
if (!supplierIDs.includes(poSupplier)) {
  return req.reject(403, "No autorizado: la Purchase Order no pertenece al proveedor logueado");
}
  }

// ==== availability por PO item (ordered - invoiced) ====
async function fetchAvailableByItem({ s4Purchase, s4Invoices, poId }) {
  // (opcional) normalizador: en S/4 el item suele venir "00010"
  const normItem = (v) => String(v || "").trim(); // si querés padStart(5) lo agregamos después

  // 1) orderedQty por item (SOLO OData4 PurchaseOrderItem)
  const poItems = await s4Purchase.run(
    SELECT.from("PurchaseOrderItem")
      .columns(["PurchaseOrderItem", "OrderQuantity"])
      .where({ PurchaseOrder: poId })
  );

  const orderedByItem = new Map();
  for (const it of poItems || []) {
    const itemId = normItem(it.PurchaseOrderItem);
    if (!itemId) continue;
    orderedByItem.set(itemId, n(it.OrderQuantity));
  }

  // 2) invoicedQty por item (facturas referenciando PO)
  const refs = await s4Invoices.run(
    SELECT.from("A_SuplrInvcItemPurOrdRef")
      .columns(["PurchaseOrderItem", "QuantityInPurchaseOrderUnit"])
      .where({ PurchaseOrder: poId })
  );

  const invoicedByItem = new Map();
  for (const r of refs || []) {
    const itemId = normItem(r.PurchaseOrderItem);
    if (!itemId) continue;
    invoicedByItem.set(itemId, (invoicedByItem.get(itemId) || 0) + n(r.QuantityInPurchaseOrderUnit));
  }

  // 3) available = ordered - invoiced
  const availableByItem = new Map();
  for (const [itemId, ordered] of orderedByItem.entries()) {
    const invoiced = invoicedByItem.get(itemId) || 0;
    availableByItem.set(itemId, Math.max(0, ordered - invoiced));
  }

  return availableByItem;
}

// ==== pricing por PO item ====
async function fetchPricingByItem({ s4Purchase, poId, itemIds }) {

  const pad5 = v => String(v || "").padStart(5, "0");
  itemIds = (itemIds || []).map(pad5);
  const rows = await s4Purchase.run(
    SELECT.from("PurchaseOrderItem")
      .columns(["PurchaseOrderItem", "NetPriceAmount", "NetPriceQuantity", "DocumentCurrency"])
      .where({ PurchaseOrder: poId, PurchaseOrderItem: { in: itemIds } })
  );

  const pricing = new Map();
  for (const r of rows || []) {
    const itemId = String(r.PurchaseOrderItem || "").trim();
    if (!itemId) continue;

    const net = n(r.NetPriceAmount);
    const per = n(r.NetPriceQuantity) || 1;
    const curr = String(r.DocumentCurrency || "").trim();

    const unitPrice = per > 0 ? net / per : 0;
    pricing.set(itemId, { currency: curr, unitPrice: round6(unitPrice) });
  }
  return pricing;
}

  // ACTION: submitPrecertTicket(ID: UUID) returns SubmitPrecertResult
  async function _nextTicketNumero(tx) {
  const row = await tx.run(
    SELECT.one.from(PrecertTickets).columns([
      { func: "max", args: [{ ref: ["ticketNumero"] }], as: "maxNo" }
    ])
  );

  const maxNo = row?.maxNo == null ? -1 : Number(row.maxNo);
  return maxNo + 1;
}

// ====== BEFORE CREATE PrecertTickets: asigna ticketNumero incremental ======
  this.before("CREATE", "PrecertTickets", async (req) => {
    const supplierIDs = getScopedSupplierIDs(req);
    if (!supplierIDs) return;

    // 1) Seguridad: ownership del documento
    await assertSourceOwnership(req, supplierIDs, this);

    const tx = cds.tx(req);

    // ✅ ticketNumero incremental (display) - SIN SEQUENCE
    if (req.data.ticketNumero == null) {
      req.data.ticketNumero = await _nextTicketNumero(tx);
    }

    // controlado por backend
    req.data.supplierID = supplierIDs[0];
    req.data.status = req.data.status || "CREADO";

    console.log(
      "[PrecertTickets.CREATE] supplierID=",
      req.data.supplierID,
      "sourceType=",
      req.data.sourceType,
      "sourceId=",
      req.data.sourceId,
      "ticketNumero=",
      req.data.ticketNumero
    );
  });

  // ====== ACTION: submitPrecertTicket(ID) ======
  this.on("submitPrecertTicket", async (req) => {
    const supplierIDs = getScopedSupplierIDs(req);
    if (!supplierIDs) return;

    const ticketId = req.data?.ID;
    if (!ticketId) return req.reject(400, "ID es obligatorio");

    const tx = cds.tx(req);

    // 1) Leer ticket + ownership
    const ticket = await tx.run(
      SELECT.one.from(PrecertTickets)
        .columns(["ID", "ticketNumero", "supplierID", "status", "sourceType", "sourceId"])
        .where({ ID: ticketId })
    );
    if (!ticket) return req.reject(404, "Ticket inexistente");

    const owner = String(ticket.supplierID || "").trim();
    if (!supplierIDs.includes(owner)) {
      return req.reject(403, "No autorizado: ticket de otro proveedor");
    }

    const status = String(ticket.status || "").toUpperCase();
    if (status !== "CREADO") {
      return req.reject(400, `Solo se puede enviar en estado CREADO (actual: ${status})`);
    }

    const sourceType = String(ticket.sourceType || "").toUpperCase().trim();
    const poId = String(ticket.sourceId || "").trim();

    if (sourceType !== "PO" || !poId) {
      return req.reject(400, "submitPrecertTicket soporta solo sourceType=PO con sourceId (OC)");
    }

    // 2) Leer items del ticket
    const items = await tx.run(
      SELECT.from(PrecertTicketItems)
        .columns(["ID", "itemId", "qtyToCertify", "dateFrom", "dateTo"])
        .where({ ticket_ID: ticketId })
    );

    if (!items?.length) return req.reject(400, "El ticket no tiene items");

    // 3) Validaciones locales (fechas/cantidades)
    const itemIds = [];
    for (const it of items) {
      const itemId = String(it.itemId || "").trim();
      const qty = n(it.qtyToCertify);

      if (!itemId) return req.reject(400, "Item inválido: falta itemId");
      if (!(qty > 0)) return req.reject(400, `Cantidad inválida (>0) en item ${itemId}`);

      if (!it.dateFrom || !it.dateTo) {
        return req.reject(400, `Fechas obligatorias (item ${itemId})`);
      }
      if (String(it.dateFrom) > String(it.dateTo)) {
        return req.reject(400, `Rango de fechas inválido (item ${itemId})`);
      }

      itemIds.push(itemId);
    }

    const uniqItemIds = [...new Set(itemIds)];

    // 4) Consultas S/4: availability + pricing (solo al enviar)
    const s4Purchase = await cds.connect.to("purchaseorder_edmx");
    const s4Invoices = await cds.connect.to("A_SupplierInvoice_edmx");

    const availableByItem = await fetchAvailableByItem({ s4Purchase, s4Invoices, poId });
    const pricingByItem = await fetchPricingByItem({ s4Purchase, poId, itemIds: uniqItemIds });

    // 5) Validar qty vs available y calcular total + lines
    let currency = "";
    let totalCents = 0;
    const lines = [];

    for (const it of items) {
      const itemId = String(it.itemId || "").trim();
      const qty = n(it.qtyToCertify);

      const available = n(availableByItem.get(itemId));
      if (qty > available) {
        return req.reject(400, `Cantidad ${qty} supera disponible ${available} (item ${itemId})`);
      }

      const p = pricingByItem.get(itemId);
      if (!p) return req.reject(400, `No se pudo determinar precio/moneda para item ${itemId}`);
      if (!p.currency) return req.reject(400, `Moneda vacía para item ${itemId}`);

      if (!currency) currency = p.currency;
      if (currency !== p.currency) {
        return req.reject(400, `Moneda inconsistente: ${currency} vs ${p.currency} (item ${itemId})`);
      }

      const unitPrice = round2(n(p.unitPrice));
      const lineAmount = round2(qty * unitPrice);

      lines.push({
        itemId,
        qty,
        unitPrice,
        lineAmount
      });

      totalCents += Math.round(lineAmount * 100);
    }

    const totalAmount = totalCents / 100;

    // 6) Persistir estado + total
    await tx.run(
      UPDATE(PrecertTickets)
        .set({
          status: "ENVIADO",
          currency: currency,
          totalAmount: totalAmount
        })
        .where({ ID: ticketId })
    );

    // 7) Respuesta para el popup
    return {
      ticketId: ticketId,
      ticketNumero: ticket.ticketNumero,
      status: "ENVIADO",
      currency: currency,
      totalAmount: totalAmount,
      lines: lines
    };
  });
this.before("DELETE", "PrecertTickets", async (req) => {
  const supplierIDs = getScopedSupplierIDs(req);
  if (!supplierIDs) return;

  const where = getTicketKeyWhere(req);
  if (!where) return req.reject(400, "No se pudo determinar la key del ticket (ajustar getTicketKeyWhere)");

  const existing = await SELECT.one.from(PrecertTickets)
    .columns(["supplierID"])
    .where(where);

  if (!existing) return req.reject(404, "Ticket inexistente");

  if (!supplierIDs.includes(String(existing.supplierID || "").trim())) {
    return req.reject(403, "No autorizado: ticket de otro proveedor");
  }
});


  this.before("READ", "PurchaseContractExt", (req) => {
  const supplierIDs = getScopedSupplierIDs(req);
  if (!supplierIDs) return;

  // Fuerza scope por Supplier
  req.query.where({ Supplier: { in: supplierIDs } });
});

this.before("READ", "PurchaseContractItemExt", async (req) => {
  const supplierIDs = getScopedSupplierIDs(req);
  if (!supplierIDs) return;

  const pc = req.data?.PurchaseContract; // viene si es READ por key
  if (!pc) {
    // si no viene por key, exigí filtro
    return req.reject(400, "Debe filtrar por PurchaseContract");
  }

  const ok = await SELECT.one.from(this.entities.PurchaseContractExt)
    .columns(["PurchaseContract"])
    .where({ PurchaseContract: pc, Supplier: { in: supplierIDs } });

  if (!ok) return req.reject(403, "No autorizado");
});
this.before(["UPDATE", "PATCH"], "PrecertTickets", async (req) => {
  
  if (isAdmin(req)) return;

  const supplierIDs = getScopedSupplierIDs(req);
  if (!supplierIDs) return;

  const where = getTicketKeyWhere(req);
  if (!where) return req.reject(400, "No se pudo determinar la key ID del ticket");

  const existing = await SELECT.one.from(PrecertTickets)
    .columns(["ID", "supplierID", "sourceType", "sourceId", "status"])
    .where(where);

  if (!existing) return req.reject(404, "Ticket inexistente");

  const owner = String(existing.supplierID || "").trim();
  if (!supplierIDs.includes(owner)) {
    return req.reject(403, "No autorizado: ticket de otro proveedor");
  }


  // Inmutabilidad de campos críticos
  const immutable = ["sourceType", "sourceId", "supplierID"];
  for (const f of immutable) {
    if (req.data[f] !== undefined && String(req.data[f]) !== String(existing[f] || "")) {
      return req.reject(400, `No se permite modificar ${f} en un ticket existente`);
    }
  }

  // Validación opcional de transición de estado (ajustá a tu flujo real)
  if (req.data.status !== undefined) {
    const from = String(existing.status || "").toUpperCase();
    const to   = String(req.data.status || "").toUpperCase();

    const allowed = {
      CREADO:    new Set(["CREADO", "ENVIADO", "CANCELADO"]),
      ENVIADO:  new Set(["ENVIADO", "APROBADO", "RECHAZADO"]),
      APROBADO:   new Set(["APROBADO"]),
      RECHAZADO:   new Set(["RECHAZADO"]),
      CANCELADO:  new Set(["CANCELADO"])
    };

    if (allowed[from] && !allowed[from].has(to)) {
      return req.reject(400, `Transición de status no permitida: ${from} -> ${to}`);
    }
  }
});

this.before("READ", "PrecertTickets", (req) => {
  //  Admin: 
  if (isAdmin(req)) return;

  // Supplier:
  const supplierIDs = getScopedSupplierIDs(req);
  if (!supplierIDs) return;

  req.query.where({ supplierID: { in: supplierIDs } });
});

this.before("CREATE", "PrecertTicketItems", async (req) => {
  const tx = cds.tx(req);

  const ticketId = req.data?.ticket_ID;
  const splitFrom = req.data?.splitFrom_ID;

  // solo si es split
  if (ticketId && splitFrom) {
    req.data.splitNo = await nextSplitNo(tx, ticketId);
  }
});

this.after("CREATE", "PrecertTicketItems", async (data, req) => {
  const tx = cds.tx(req);

  const ticketId = data?.ticket_ID;
  const splitFrom = data?.splitFrom_ID;

  if (!ticketId || !splitFrom) return; // no era split

  const subTicketNo = await nextSubTicketNo(tx, ticketId);

  // snapshot simple (podés meter más fields)
  const snap = {
    splitFrom_ID: splitFrom,
    newItem_ID: data.ID,
    itemId: data.itemId,
    qtyToCertify: data.qtyToCertify,
    placeOfService: data.placeOfService,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    status: data.status,
    splitNo: data.splitNo
  };

  await tx.run(
    INSERT.into("PrecertTicketSplitLog").entries({
      ticket_ID: ticketId,
      subTicketNo,
      splitFromItem: splitFrom,
      newItem: data.ID,
      changedBy: req.user?.id || "unknown",
      snapshotJson: JSON.stringify(snap)
    })
  );
});


this.before("READ", "PrecertTicketItems", async (req) => {
  if (isAdmin(req)) return;

  const supplierIDs = getScopedSupplierIDs(req);
  if (!supplierIDs) return;

  req.query.where({
    ticket_ID: {
      in: SELECT.from(PrecertTickets).columns("ID").where({ supplierID: { in: supplierIDs } })
    }
  });
});
this.on("getUserRoles", (req) => {
  const xsapp = process.env.XSAPPNAME || "pp-backendServices-001";
  const scopes = req.user?.scopes || [];

  const isAdmin = scopes.includes(`${xsapp}.Admin`);
  const isSupplier = scopes.includes(`${xsapp}.Supplier`);

  const supplierIDs = getScopedSupplierIDs(req) || [];

  return { isAdmin, isSupplier, supplierIDs, scopes };
});

this.on("createAndSubmitPrecertTicket", async (req) => {
  const supplierIDs = getScopedSupplierIDs(req);
  if (!supplierIDs) return;

  const sType = String(req.data?.sourceType || "").toUpperCase().trim();
  const sId   = String(req.data?.sourceId || "").trim();
  const inItems = Array.isArray(req.data?.items) ? req.data.items : [];

  if (!sType || !sId) return req.reject(400, "sourceType y sourceId son obligatorios");
  if (sType !== "OC" && sType !== "CM") return req.reject(400, "sourceType debe ser OC o CM");
  if (!inItems.length) return req.reject(400, "items es obligatorio (no puede estar vacío)");

  // Seguridad ownership del documento (OC/CM)
  await assertSourceOwnership(req, supplierIDs, this);

  const tx = cds.tx(req);

  // Validaciones de items (mismas reglas que submit)
  const itemIds = [];
  for (const it of inItems) {
    const itemId = String(it.itemId || "").trim();
    const qty = n(it.qtyToCertify);

    if (!itemId) return req.reject(400, "Item inválido: falta itemId");
    if (!(qty > 0)) return req.reject(400, `Cantidad inválida (>0) en item ${itemId}`);

    if (!it.dateFrom || !it.dateTo) {
      return req.reject(400, `Fechas obligatorias (item ${itemId})`);
    }
    if (String(it.dateFrom) > String(it.dateTo)) {
      return req.reject(400, `Rango de fechas inválido (item ${itemId})`);
    }

    itemIds.push(itemId);
  }
  const uniqItemIds = [...new Set(itemIds)];

  // Pricing + availability (si es PO). Si CM por ahora dejalo igual a tu lógica.
  if (sType !== "OC") {
    return req.reject(400, "createAndSubmitPrecertTicket por ahora soporta solo OC (igual que submit)");
  }

  const s4Purchase = await cds.connect.to("purchaseorder_edmx");
  const s4Invoices = await cds.connect.to("A_SupplierInvoice_edmx");

  const availableByItem = await fetchAvailableByItem({ s4Purchase, s4Invoices, poId: sId });
  const pricingByItem = await fetchPricingByItem({ s4Purchase, poId: sId, itemIds: uniqItemIds });

  // Calcular lines + total (mismo que submit)
  let currency = "";
  let totalCents = 0;
  const lines = [];

  for (const it of inItems) {
    const itemId = String(it.itemId || "").trim();
    const qty = n(it.qtyToCertify);

    const available = n(availableByItem.get(itemId));
    if (qty > available) {
      return req.reject(400, `Cantidad ${qty} supera disponible ${available} (item ${itemId})`);
    }

    const p = pricingByItem.get(itemId);
    if (!p) return req.reject(400, `No se pudo determinar precio/moneda para item ${itemId}`);
    if (!p.currency) return req.reject(400, `Moneda vacía para item ${itemId}`);

    if (!currency) currency = p.currency;
    if (currency !== p.currency) {
      return req.reject(400, `Moneda inconsistente: ${currency} vs ${p.currency} (item ${itemId})`);
    }

    const unitPrice = round2(n(p.unitPrice));
    const lineAmount = round2(qty * unitPrice);

    lines.push({ itemId, qty, unitPrice, lineAmount });
    totalCents += Math.round(lineAmount * 100);
  }

  const totalAmount = totalCents / 100;

  // TicketNumero incremental sin sequence
  const ticketNumero = await _nextTicketNumero(tx);

  // Crear ticket + items en la misma tx (si algo falla, rollback)
  const ticketId = cds.utils.uuid();

  await tx.run(
    INSERT.into(PrecertTickets).entries({
      ID: ticketId,
      ticketNumero,
      sourceType: sType,
      sourceId: sId,
      supplierID: supplierIDs[0],
      status: "ENVIADO",
      currency,
      totalAmount
    })
  );

  // Insert items
  await tx.run(
    INSERT.into(PrecertTicketItems).entries(
      inItems.map(it => ({
        ID: cds.utils.uuid(),
        ticket_ID: ticketId,
        itemId: String(it.itemId || "").trim(),
        qtyToCertify: it.qtyToCertify,
        placeOfService: String(it.placeOfService || "").trim(),
        dateFrom: it.dateFrom,
        dateTo: it.dateTo
      }))
    )
  );

  // Respuesta para popup
  return {
    ticketId,
    ticketNumero,
    status: "ENVIADO",
    currency,
    totalAmount,
    lines
  };
});

this.on('savePrecertTicketApproval', async (req) => {
  const { ID, items } = req.data;

  // 1) validar ticket existe
  const ticket = await SELECT.one.from(PrecertTickets).where({ ID });
  if (!ticket) return req.error(404, 'Ticket no existe');

  // 2) upsert items
  for (const it of items) {
    const itemId = String(it.itemId || '').trim();
    const lineId = String(it.lineId ?? '0').trim(); // default 0
    const status = String(it.status || 'ENVIADO').toUpperCase();

    // buscar item existente por (ticket,itemId,lineId)
    const existing = await SELECT.one.from(PrecertTicketItems).where({
      ticket_ID: ID,
      itemId,
      lineId
    });

    if (existing) {
      await UPDATE(PrecertTicketItems).set({
        qtyToCertify: it.qtyToCertify,
        placeOfService: it.placeOfService,
        dateFrom: it.dateFrom,
        dateTo: it.dateTo,
        status
      }).where({ ID: existing.ID });
    } else {
      // crear split nuevo
      const created = await INSERT.into(PrecertTicketItems).entries({
        ticket_ID: ID,
        itemId,
        lineId,
        qtyToCertify: it.qtyToCertify,
        placeOfService: it.placeOfService,
        dateFrom: it.dateFrom,
        dateTo: it.dateTo,
        status,

        // opcional: copiar availableQty/uom/service/subservice desde el item base lineId=0 o desde Candidate
      });

      // opcional: log de split si lineId != "0"
      // INSERT.into(PrecertTicketSplitLog)...
    }
  }

  // 3) recalcular estado del ticket (OPEN/CLOSED)
  const dbItems = await SELECT.from(PrecertTicketItems).where({ ticket_ID: ID });

  const anyPending = dbItems.some(x => (x.status || '').toUpperCase() === 'ENVIADO');
  const anyApproved = dbItems.some(x => (x.status || '').toUpperCase() === 'APROBADO');
  const allRejected = dbItems.length && dbItems.every(x => (x.status || '').toUpperCase() === 'RECHAZADO');

  const newTicketStatus =
    anyPending ? 'ENVIADO'
    : allRejected ? 'RECHAZADO'
    : anyApproved ? 'APROBADO'
    : ticket.status || 'ENVIADO';

  // 4) recalcular totalAmount (si tu unitPrice viene del PO/candidate)
  // total = SUM(qtyToCertify * unitPrice) por item/line
  // UPDATE ticket.totalAmount y ticket.status

  await UPDATE(PrecertTickets).set({ status: newTicketStatus /*, totalAmount */ }).where({ ID });

  // 5) devolver ticket expandido
  return await SELECT.one.from(PrecertTickets).where({ ID }).columns(
    '*', { items: '*' }
  );
});
 this.on('READ', 'PurchaseOrderAccountAssignments', (req) => {
    // Normalizar filtros típicos SAP
    const sel = req.query?.SELECT;
    if (sel?.where) {
      padWhereEq(sel.where, 'PurchaseOrder', 10);
      padWhereEq(sel.where, 'PurchaseOrderItem', 5);
    }
    return s4Purchase.run(req.query);
  });



})
