const cds = require('@sap/cds');

/**
 * GET BusinessPartnerExt
 * Devuelve los socios comerciales desde S/4HANA,
 * incluyendo direcciones (_BusinessPartnerAddress), datos de cliente (_Customer),
 * y proveedor (_Supplier).
 */
async function handleBusinessPartnerRead(req) {
  const s4bp = await cds.connect.to('A_BusinessPartner');

  try {
    const result = await s4bp.run(req.query);
    const bpIds = result.map(bp => bp.BusinessPartner);
    const customerIds = result.map(bp => bp.Customer).filter(Boolean); // filtra vacíos
    const supplierIds = result.map(bp => bp.Supplier).filter(Boolean);

    if (!bpIds.length) return result;

    const [addresses, customers, suppliers] = await Promise.all([
      s4bp.run(SELECT.from('A_BusinessPartnerAddress').where({ BusinessPartner: { in: bpIds } })),
      s4bp.run(SELECT.from('A_Customer').where({ Customer: { in: customerIds } })),
      s4bp.run(SELECT.from('A_Supplier').where({ Supplier: { in: supplierIds } })),
    ]);

    const groupBy = (arr, key) =>
      arr.reduce((acc, cur) => {
        const k = cur[key];
        if (!acc[k]) acc[k] = [];
        acc[k].push(cur);
        return acc;
      }, {});

    const addressMap = groupBy(addresses, 'BusinessPartner');
    const customerMap = groupBy(customers, 'Customer');
    const supplierMap = groupBy(suppliers, 'Supplier');

    result.forEach(bp => {
      bp._BusinessPartnerAddress = addressMap[bp.BusinessPartner] || [];
      bp._Customer = customerMap[bp.Customer] || [];
      bp._Supplier = supplierMap[bp.Supplier] || [];
    });

    return result.length === 1 ? result[0] : result;
  } catch (err) {
    console.error('[ERROR] BusinessPartnerExt:', err);
    return req.reject(500, 'Error al obtener socios comerciales');
  }
}

module.exports = {
  handleBusinessPartnerRead,
};
