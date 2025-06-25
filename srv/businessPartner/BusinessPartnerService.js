const cds = require('@sap/cds');

/* ------------------------------------------------------------------ */
const buildOrFilter = (field, values) =>
  values.flatMap((v, i) =>
    i === 0 ? [{ ref: [field] }, '=', { val: v }]
      : ['or', { ref: [field] }, '=', { val: v }],
  );

/* ------------------------------------------------------------------ */
async function handleBusinessPartnerRead(req) {
  const s4bp = await cds.connect.to('A_BusinessPartner');

  const fallback = ['31300001', '31300002', '31300003', '31300006'];

  const userSupplierIDs =
    Array.isArray(req.user?.attr?.supplierID) && req.user.attr.supplierID.length
      ? req.user.attr.supplierID
      : fallback;

  if (!Array.isArray(userSupplierIDs) || !userSupplierIDs.length) {
    return req.reject(403, 'El usuario no cuenta con roles de proveedor (supplierID).');
  }

  try {
    if (req.params?.length) {
      const bpRow = await s4bp.run(req.query);           // delega por clave
      if (!bpRow) return req.reject(404);

      if (!userSupplierIDs.includes(bpRow.Supplier)) {
        return req.reject(403, `BusinessPartner ${bpRow.BusinessPartner} no autorizado.`);
      }
      return await enrichWithAssociations(bpRow, s4bp);
    }

    const query = JSON.parse(JSON.stringify(req.query));
    delete query.SELECT?.count;                          // Eliminar count por no ser compatible con API

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
