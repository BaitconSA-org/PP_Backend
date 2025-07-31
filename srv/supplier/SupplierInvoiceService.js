const cds  = require('@sap/cds');
const { SELECT } = cds.ql;

// 1) Cabecera -------------------------------------------------
async function handleSupplierInvoiceRead (req, s4Inv) {
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
 
  try {
    const q = cds.clone(req.query);
    delete q.SELECT?.count;

    /* -------- 2. Inyectar filtro por Supplier ------ */
    const supplierFilter = [
      { ref: ['Supplier'] }, 'in', { val: userSupplierIDs },
    ];

    if (q.SELECT.where && q.SELECT.where.length) {
      q.SELECT.where = ['(', q.SELECT.where, ')', 'and', ...supplierFilter];
    } else {
      q.SELECT.where = supplierFilter;
    }

    const wantsExpand = q.SELECT?.expand?.some(e => e.ref?.[0] === '_InvoiceItem');
    if (!wantsExpand) return s4Inv.run(q);

    q.SELECT.expand = q.SELECT.expand.filter(e => e.ref?.[0] !== '_InvoiceItem');
    if (!q.SELECT.expand.length) delete q.SELECT.expand;

    const headers   = await s4Inv.run(q);
    if (!headers.length) return headers;

    const ids = [...new Set(headers.map(h => h.SupplierInvoice))];
    const items = await s4Inv.run(
      SELECT.from('A_SuplrInvcItemPurOrdRef').where({ SupplierInvoice: { in: ids } }),
    );

    const map = items.reduce((acc, it) => {
      (acc[it.SupplierInvoice] ??= []).push(it);
      return acc;
    }, {});

    headers.forEach(h => { h._InvoiceItem = map[h.SupplierInvoice] || []; });
    return headers;                                // <-- siempre array
  } catch (err) {
    console.error('[ERROR] SupplierInvoiceExt:', err);
    return req.reject(500, 'Error al obtener facturas con líneas');
  }
}

async function handleSupplierInvoiceItemRead(req, s4Inv) {
  if (!s4Inv) s4Inv = await cds.connect.to('A_SupplierInvoice_edmx');

  //const userSupplierIDs = ['31300001', '31300002', '31300003', '31300006'];
  const userSupplierIDs = req.user?.attr?.supplierID;
  const poNumber = req.params?.[0]?.PurchaseOrder;
  const poItem   = req.params?.[1]?.PurchaseOrderItem;


  try {
    const q = cds.clone(req.query);
    delete q.SELECT?.count;

    // Detectar columnas pedidas de _SupplierInvoice
    const headerCols = new Set();
    const keepCols = [];

    (q.SELECT.columns || []).forEach(col => {
      if (col.ref?.[0] === '_SupplierInvoice') {
        if (col.ref.length > 1) headerCols.add(col.ref.at(-1));
        if (Array.isArray(col.expand)) col.expand.forEach(e => headerCols.add(e.ref?.[0]));
      } else {
        keepCols.push(col);
      }
    });

    const expandEntry = q.SELECT.expand?.find(e => e.ref?.at(-1) === '_SupplierInvoice');
    if (expandEntry?.expand) {
      expandEntry.expand.forEach(e => headerCols.add(e.ref?.[0]));
    }

    const wantsExpand = headerCols.size > 0;
    if (wantsExpand) {
      q.SELECT.columns = keepCols.length ? keepCols : ['*'];
      q.SELECT.expand = (q.SELECT.expand || []).filter(e => e.ref?.at(-1) !== '_SupplierInvoice');
      if (q.SELECT.expand.length === 0) delete q.SELECT.expand;
    }

    // Asegurar el FROM correcto
    const fromRef = q.SELECT?.from?.ref?.at(-1);
    if (['_InvoiceItems', 'SupplierInvoiceItemExt'].includes(fromRef)) {
      q.SELECT.from = { ref: ['A_SuplrInvcItemPurOrdRef'] };
      delete q.SELECT.joins;
      delete q.SELECT.orderBy;
    }

    // Inyectar filtro por PurchaseOrder si vino por navegación
    if (poNumber) {
      const poFilter = poItem
        ? [                                           // pedido + posición
          { ref: ['PurchaseOrder'] }, '=', { val: poNumber },
          'and',
          { ref: ['PurchaseOrderItem'] }, '=', { val: poItem },
        ]
        : [                                           // solo pedido
          { ref: ['PurchaseOrder'] }, '=', { val: poNumber },
        ];

      if (q.SELECT.where?.length) {
        q.SELECT.where = ['(', ...q.SELECT.where, ')', 'and', ...poFilter];
      } else {
        q.SELECT.where = poFilter;
      }
    }

    // Ejecutar query a líneas
    let items = await s4Inv.run(q);
    if (!wantsExpand || !items.length) return items;

    // Agrupar claves para traer cabeceras válidas
    headerCols.add('SupplierInvoice').add('FiscalYear').add('InvoicingParty');
    const invoiceKeys = [...new Set(items.map(i => `${i.SupplierInvoice}-${i.FiscalYear}`))]
      .map(k => {
        const [SupplierInvoice, FiscalYear] = k.split('-');
        return { SupplierInvoice, FiscalYear };
      });

    const headers = await s4Inv.run(
      SELECT.from('A_SupplierInvoice')
        .columns(...headerCols)
        .where(invoiceKeys),
    );

    // Filtrar solo cabeceras válidas por Supplier autorizado
    const validHeaderSet = new Set(
      headers
        .filter(h => userSupplierIDs.includes(h.InvoicingParty))
        .map(h => `${h.SupplierInvoice}-${h.FiscalYear}`),
    );

    // Filtrar líneas por facturas autorizadas
    items = items.filter(i => validHeaderSet.has(`${i.SupplierInvoice}-${i.FiscalYear}`));

    // Inyectar cabeceras si aplica
    if (items.length) {
      const headerMap = Object.fromEntries(
        headers.map(h => [`${h.SupplierInvoice}-${h.FiscalYear}`, h]),
      );
      items.forEach(i => {
        i._SupplierInvoice = headerMap[`${i.SupplierInvoice}-${i.FiscalYear}`] || null;
      });
    }

    return items;
  } catch (err) {
    console.error('[ERROR] SupplierInvoiceItemExt:', err);
    return req.reject(
      500,
      `Error delegando a servicio remoto de facturas: ${err.message || err}`,
    );
  }
}



module.exports = { handleSupplierInvoiceRead, handleSupplierInvoiceItemRead };
