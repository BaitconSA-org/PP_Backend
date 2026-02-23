const cds = require('@sap/cds');
const { SELECT } = cds.ql;

/* ------------------------------------------------------------------ */
const buildOrFilter = (field, values) =>
  values.flatMap((v, i) =>
    i === 0 ? [{ ref: [field] }, '=', { val: v }]
      : ['or', { ref: [field] }, '=', { val: v }],
  );

/* ------------------------------------------------------------------ */
function getSupplierIDs(req) {
  // 1) Lo que vos esperabas (mapeo CAP)
  let raw = req.user?.attr?.supplierID;

  // 2) Fallback: leer directo del JWT (xsuaa)
  if (!raw && req.user?.tokenInfo?.getPayload) {
    const p = req.user.tokenInfo.getPayload();
    raw =
      p?.['xs.user.attributes']?.supplierID ??
      p?.['xs.user.attributes']?.supplierId ??
      p?.supplierID ??
      p?.supplierId;
  }

  // Normalizar a array
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}
async function handleBusinessPartnerRead(req) {
  const s4bp = await cds.connect.to('A_BusinessPartner');

  let userSupplierIDs = req.user?.attr?.supplierID;

  const isLocal =
    req.user?.id === 'system' ||
    req.user?.id === 'anonymous' ||
    cds.env.profile?.includes?.('development');

  if (!Array.isArray(userSupplierIDs) || !userSupplierIDs.length) {
    if (isLocal) {
      console.warn('⚠️ Ejecutando en modo local o sin token. Usando proveedor mock.');
      userSupplierIDs = ['31300001'];
    } else {
      return req.reject(403, 'El usuario no cuenta con roles de proveedor (supplierID).');
    }
  }

  try {
    if (req.params?.length) {
      const bpRow = await s4bp.run(req.query);
      if (!bpRow) return req.reject(404);

      if (!userSupplierIDs.includes(bpRow.Supplier)) {
        return req.reject(403, `BusinessPartner ${bpRow.BusinessPartner} no autorizado.`);
      }
      return await enrichWithAssociations(bpRow, s4bp);
    }

    const query = JSON.parse(JSON.stringify(req.query));
    delete query.SELECT?.count;

    const supplierFilter = buildOrFilter('Supplier', userSupplierIDs);

    if (query.SELECT.where) {
      query.SELECT.where = ['(', ...query.SELECT.where, ')', 'and', ...supplierFilter];
    } else {
      query.SELECT.where = supplierFilter;
    }

    const bpHeaders = await s4bp.run(query);
    if (!bpHeaders.length) return [];

    return await enrichWithAssociations(bpHeaders, s4bp);

  } catch (err) {
    console.error('[ERROR] BusinessPartnerExt:', err);
    return req.reject(500, 'Error al obtener socios comerciales');
  }
}

/* ------------------------------------------------------------------ */
/* Complementar con direcciones, cliente y proveedor                     */
async function enrichWithAssociations(bpData, s4bpSrv) {
  const bpArr       = Array.isArray(bpData) ? bpData : [bpData];
  const bpIds       = bpArr.map(b => b.BusinessPartner);
  const customerIds = bpArr.map(b => b.Customer).filter(Boolean);
  const supplierIds = bpArr.map(b => b.Supplier).filter(Boolean);

  const [addresses, customers, suppliers] = await Promise.all([
    s4bpSrv.run(SELECT.from('A_BusinessPartnerAddress').where({ BusinessPartner: { in: bpIds } })),
    s4bpSrv.run(SELECT.from('A_Customer').where({ Customer: { in: customerIds } })),
    s4bpSrv.run(SELECT.from('A_Supplier').where({ Supplier: { in: supplierIds } })),
  ]);

  const groupBy = (arr, key) =>
    arr.reduce((acc, cur) => ((acc[cur[key]] ??= []).push(cur), acc), {});

  const addrMap = groupBy(addresses, 'BusinessPartner');
  const custMap = groupBy(customers, 'Customer');
  const suppMap = groupBy(suppliers, 'Supplier');

  bpArr.forEach(bp => {
    bp._BusinessPartnerAddress = addrMap[bp.BusinessPartner] || [];
    bp._Customer               = custMap[bp.Customer]        || [];
    bp._Supplier               = suppMap[bp.Supplier]        || [];
  });

  return Array.isArray(bpData) ? bpArr : bpArr[0];
}

module.exports = { handleBusinessPartnerRead };
