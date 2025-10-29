// handlers/PurchaseOrderSupplierInvoicesRead.js
const cds = require('@sap/cds');

/**
 * READ handler para PurchaseOrderSupplierInvoices
 * Devuelve SOLO las posiciones de facturas cuyos Supplier (de cabecera) estén en supplierIDs del usuario.
 * El handler primero filtra cabeceras y luego trae las posiciones asociadas.
 */
async function handlePurchaseOrderSupplierInvRead(req, s4Inv) {
  // 1. SupplierIDs del usuario – fallback en local
  //const supplierIDs =
    //req.user?.attr?.supplierID ?? ['31300001', '31300002', '31300003', '31300006'];
  
    let supplierIDs = req.user?.attr?.supplierID;

  if (!Array.isArray(supplierIDs) || supplierIDs.length === 0) {
    return req.reject(403, 'El usuario no tiene SupplierID asignado');
  }

  try {
    // 2. Caso 1: Lookup por claves
    if (req.params?.length) {
      const { SupplierInvoice, FiscalYear } = req.params[0];

      // Consultar la cabecera de la factura
      const invHeaders = await s4Inv.run(
        SELECT.from('A_SupplierInvoice')
          .columns('Supplier')
          .where({ SupplierInvoice, FiscalYear }),
      );

      if (!invHeaders.length) return req.reject(404, 'Factura no encontrada');

      const invoice = invHeaders[0];

      // Verificar autorización del proveedor
      if (!supplierIDs.includes(invoice.Supplier)) {
        return req.reject(403, `Supplier ${invoice.Supplier} no autorizado para el usuario.`);
      }

      // Si está autorizado, delegar consulta original (a las posiciones)
      return await s4Inv.run(req.query);
    }

    // 3. Caso 2: Consulta general – obtener facturas autorizadas primero
    const invHeaders = await s4Inv.run(
      SELECT.from('A_SupplierInvoice')
        .columns('SupplierInvoice', 'FiscalYear')
        .where({ Supplier: { in: supplierIDs } }),
    );

    if (!invHeaders.length) return [];

    const invoiceKeys = invHeaders.map(i => ({
      SupplierInvoice: i.SupplierInvoice,
      FiscalYear: i.FiscalYear,
    }));

    // 4. Armar la query con WHERE extendido (por múltiples claves)
    const q = JSON.parse(JSON.stringify(req.query));
    delete q.SELECT?.count;

    q.SELECT.where = invoiceKeys.flatMap((k, idx) =>
      idx === 0
        ? [
          { ref: ['SupplierInvoice'] }, '=', { val: k.SupplierInvoice },
          'and',
          { ref: ['FiscalYear'] }, '=', { val: k.FiscalYear },
        ]
        : [
          'or',
          { ref: ['SupplierInvoice'] }, '=', { val: k.SupplierInvoice },
          'and',
          { ref: ['FiscalYear'] }, '=', { val: k.FiscalYear },
        ],
    );

    return await s4Inv.run(q);
  } catch (err) {
    console.error('[ERROR] PurchaseOrderSupplierInvoices:', err);
    return req.reject(500, 'Error al leer vista agregada');
  }
}

module.exports = { handlePurchaseOrderSupplierInvRead };
