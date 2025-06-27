const cds  = require('@sap/cds');
const { SELECT } = cds.ql;

// 1) Cabecera -------------------------------------------------
async function handleSupplierInvoiceRead (req, s4Inv) {
  const userSupplierIDs = ['31300001', '31300002', '31300003', '31300006'];

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

// 2) Líneas ---------------------------------------------------
async function handleSupplierInvoiceItemRead(req, s4Inv) {

  if (!s4Inv) s4Inv = await cds.connect.to('A_SupplierInvoice_edmx');
  const userSupplierIDs = ['31300001', '31300002', '31300003', '31300006'];
  try {
    const q = cds.clone(req.query);
    delete q.SELECT?.count;

    /* ---------- 2. Detectar columnas solicitadas de _SupplierInvoice ---------- */
    const headerCols = new Set();          // campos pedidas al expand
    const keepCols   = [];                

    (q.SELECT.columns || []).forEach(col => {
      if (col.ref?.[0] === '_SupplierInvoice') {
        if (col.ref.length > 1) headerCols.add(col.ref[col.ref.length - 1]);
        if (Array.isArray(col.expand)) {
          col.expand.forEach(e => headerCols.add(e.ref?.[0]));
        }
      } else {
        keepCols.push(col);                // no pertenece a la cabecera, lo conservamos
      }
    });

    // También puede venir como SELECT.expand
    const inExpand = q.SELECT.expand?.find(
      e => e.ref?.[e.ref.length - 1] === '_SupplierInvoice',
    );
    if (inExpand?.expand) {
      inExpand.expand.forEach(e => headerCols.add(e.ref?.[0]));
    }

    const wantsExpand = headerCols.size > 0;

    if (wantsExpand) {
      q.SELECT.columns = keepCols.length ? keepCols : ['*'];
      if (q.SELECT.expand)
        q.SELECT.expand = q.SELECT.expand.filter(
          e => e.ref?.[e.ref.length - 1] !== '_SupplierInvoice',
        );
      if (q.SELECT.expand?.length === 0) delete q.SELECT.expand;
    }

    /* ---------- 4. Ajustar FROM si vino por navegación ---------- */
    const fromRef = q.SELECT?.from?.ref?.at(-1);
    
    if (['_InvoiceItems', 'SupplierInvoiceItemExt'].includes(fromRef)) {

      // 1. Cambiar el FROM
      q.SELECT.from = { ref: ['A_SuplrInvcItemPurOrdRef'] };
      delete q.SELECT.joins;
      delete q.SELECT.orderBy;

      // 2. Traer facturas válidas del backend por Supplier
      const validHeaders = await s4Inv.run(
        SELECT.from('A_SupplierInvoice')
          .columns('SupplierInvoice', 'FiscalYear')
          .where({ InvoicingParty: { in: userSupplierIDs } })
      );

      const allowed = validHeaders.map(h => ({
        SupplierInvoice: h.SupplierInvoice,
        FiscalYear: h.FiscalYear,
      }));

      // 3. Inyectar WHERE a la query
      if (allowed.length > 0) {
        q.SELECT.where = q.SELECT.where?.length
          ? ['(', ...q.SELECT.where, ')', 'and', { ref: ['(', 'SupplierInvoice', '-', 'FiscalYear', ')'] }, 'in', allowed]
          : [{ ref: ['(', 'SupplierInvoice', '-', 'FiscalYear', ')'] }, 'in', allowed];
      } else {
        // Si no hay ninguno válido, retornar vacío
        return [];
      }
    }



    /* ---------- 5. Ejecutar líneas ---------- */
    const items = await s4Inv.run(q);
    if (!wantsExpand || !items.length) return items;

    /* ---------- 6. Traer cabeceras con los campos detectados ---------- */
    headerCols.add('SupplierInvoice').add('FiscalYear'); // claves mínimas

    const uniq = [...new Set(items.map(i => `${i.SupplierInvoice}-${i.FiscalYear}`))]
      .map(k => {
        const [SupplierInvoice, FiscalYear] = k.split('-');
        return { SupplierInvoice, FiscalYear };
      });

    const headers = await s4Inv.run(
      SELECT.from('A_SupplierInvoice')
        .columns(...headerCols)
        .where(uniq),
    );

    /* ---------- 7. Map y merge ---------- */
    const map = headers.reduce((m, h) => {
      m[`${h.SupplierInvoice}-${h.FiscalYear}`] = h;
      return m;
    }, {});

    items.forEach(it => {
      it._SupplierInvoice = map[`${it.SupplierInvoice}-${it.FiscalYear}`] || null;
    });

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
