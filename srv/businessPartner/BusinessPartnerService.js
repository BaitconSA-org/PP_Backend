// /srv/services/BusinessPartnerService.js
const cds = require('@sap/cds');

/**
 * GET BusinessPartnerExt
 * Devuelve los socios comerciales desde S/4HANA
 * (incluye direcciones, datos de cliente y proveedor).
 * Solo muestra los BP cuyo campo _Supplier_ está dentro
 * del listado de supplierIDs que tiene el usuario.
 */
async function handleBusinessPartnerRead (req) {
  const s4bp = await cds.connect.to('A_BusinessPartner');

  /** 1. SupplierIDs permitidos para el usuario */
  //  ➜  Des-comentar la línea real cuando tengas los atributos
  const userSupplierIDs = req.user?.attr?.supplierID;
  // const userSupplierIDs = ['31300001', '31300002', '31300003', '31300006']; // ← mock para pruebas

  if (!Array.isArray(userSupplierIDs) || userSupplierIDs.length === 0) {
    return req.reject(403, 'El usuario no cuenta con roles de proveedor (supplierID).');
  }

  try {
    /** 2. Clonar y limpiar la query original */
    const cleanQuery = JSON.parse(JSON.stringify(req.query));      // deep-clone
    if (cleanQuery.SELECT?.count) delete cleanQuery.SELECT.count;  // --count no se puede delegar

    /** 3. Inyectar el filtro "Supplier in <IDs>" */
    if (cleanQuery.SELECT?.where) {
      cleanQuery.SELECT.where = [
        '(', cleanQuery.SELECT.where, ')', 'and',
        { ref: ['Supplier'] }, 'in', { val: userSupplierIDs },
      ];
    } else {
      cleanQuery.SELECT.where = [
        { ref: ['Supplier'] }, 'in', { val: userSupplierIDs },
      ];
    }

    /** 4. Ejecutar la consulta filtrada en S/4 */
    const bpHeaders = await s4bp.run(cleanQuery);
    if (!bpHeaders.length) return [];

    /** 5. Obtener IDs para las asociaciones ------------- */
    const bpIds       = bpHeaders.map(b => b.BusinessPartner);
    const customerIds = bpHeaders.map(b => b.Customer).filter(Boolean);
    const supplierIds = bpHeaders.map(b => b.Supplier).filter(Boolean);

    /** 6. Leer asociaciones en paralelo ---------------- */
    const [addresses, customers, suppliers] = await Promise.all([
      s4bp.run(SELECT.from('A_BusinessPartnerAddress').where({ BusinessPartner: { in: bpIds } })),
      s4bp.run(SELECT.from('A_Customer').where({ Customer: { in: customerIds } })),
      s4bp.run(SELECT.from('A_Supplier').where({ Supplier: { in: supplierIds } })),
    ]);

    /** 7. Mapear resultados por ID -------------------- */
    const groupBy = (arr, key) => arr.reduce((acc, cur) => {
      (acc[cur[key]] ??= []).push(cur);
      return acc;
    }, {});

    const addrMap = groupBy(addresses, 'BusinessPartner');
    const custMap = groupBy(customers, 'Customer');
    const suppMap = groupBy(suppliers, 'Supplier');

    /** 8. Enriquecer BP con sus asociaciones ----------- */
    bpHeaders.forEach(bp => {
      bp._BusinessPartnerAddress = addrMap[bp.BusinessPartner] || [];
      bp._Customer               = custMap[bp.Customer]        || [];
      bp._Supplier               = suppMap[bp.Supplier]        || [];
    });

    return bpHeaders.length === 1 ? bpHeaders[0] : bpHeaders;

  } catch (err) {
    console.error('[ERROR] BusinessPartnerExt:', err);
    return req.reject(500, 'Error al obtener socios comerciales');
  }
}

module.exports = { handleBusinessPartnerRead };
