const cds = require('@sap/cds');


const buildSupplierFilter = (supplierIDs) =>
  supplierIDs.flatMap((id, idx) =>
    idx === 0
      ? [{ ref: ['SupplierInvoice'] }, '=', { val: id }]
      : ['or', { ref: ['SupplierInvoice'] }, '=', { val: id }],
  );

/**
 * READ handler para PurchaseOrderSupplierInvoices
 * Devuelve solo las facturas cuyos Supplier estén en la lista del usuario.
 * Delegado a servicio remoto `A_SupplierInvoice_edmx`.
 *
 * @param {import('@sap/cds/apis/input').Request} req
 * @param {import('@sap/cds/apis/services').Service} s4Inv  conexión a S/4
 */
async function handlePurchaseOrderSupplierInvRead(req, s4Inv) {
  // 1. SupplierIDs del usuario ─ mock de respaldo para dev local
  const supplierIDs =
    req.user?.attr?.supplierID ?? ['31300001', '31300002', '31300003', '31300006'];

  if (!Array.isArray(supplierIDs) || !supplierIDs.length) {
    return req.reject(403, 'El usuario no tiene SupplierID asignado');
  }

  try {
    // 2. Clonar la query y eliminar count (no delegable)
    const q = JSON.parse(JSON.stringify(req.query));
    delete q.SELECT?.count;

    // 3. Inyectar filtro (Supplier eq '…' or …)
    const supFilter = buildSupplierFilter(supplierIDs);
    q.SELECT.where = q.SELECT.where
      ? ['(', ...q.SELECT.where, ')', 'and', ...supFilter]
      : supFilter;

    // 4. Delegar a S/4
    return await s4Inv.run(q);
  } catch (err) {
    console.error('[ERROR] PurchaseOrderSupplierInvoices:', err);
    return req.reject(500, 'Error al leer vista agregada');
  }
}

module.exports = { handlePurchaseOrderSupplierInvRead };
