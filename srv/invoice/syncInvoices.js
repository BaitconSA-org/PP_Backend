const cds = require('@sap/cds');
const { SELECT, UPDATE } = cds.ql;

module.exports = async function handleSyncInvoices(req, srv) {
  const s4Invoices = await cds.connect.to('A_SupplierInvoice_edmx');
  const { Invoices } = cds.entities;
  const tx = cds.transaction(req);

  // Paso 1: Obtener facturas locales con status = 'E'
  const invoices = await tx.run(
    SELECT.from(Invoices).where({ status: 'E' }),
  );

  const results = [];

  if (!invoices.length) return results;

  // Paso 2: Armar claves únicas para el WHERE dinámico
  const uniqueKeys = Array.from(
    new Map(
      invoices
        .filter(inv => inv.supplierInvoice && inv.fiscalYear)
        .map(inv => [`${inv.supplierInvoice}::${inv.fiscalYear}`, {
          SupplierInvoice: inv.supplierInvoice,
          FiscalYear: inv.fiscalYear,
        }]),
    ).values(),
  );

  // Paso 3: SELECT masivo a entidad externa
  const s4Data = await srv.run(
    SELECT.from('SupplierInvoiceExt').where(uniqueKeys),
  );

  // Paso 4: mapear resultados
  const siMap = Object.fromEntries(
    s4Data.map(si => [`${si.SupplierInvoice}::${si.FiscalYear}`, si]),
  );

  // Paso 5: actualizar resultados según status
  for (const invoice of invoices) {
    const key = `${invoice.supplierInvoice}::${invoice.fiscalYear}`;
    const si = siMap[key];

    if (!si) {
      await tx.run(
        UPDATE(Invoices).set({ status: 'R' }).where({ ID: invoice.ID }),
      );
      results.push({ invoiceID: invoice.ID, result: 'Rechazada (no encontrada)' });
    } else if (si.SupplierInvoiceStatus === '5') {
      await tx.run(
        UPDATE(Invoices).set({ status_statusCode: 'A' }).where({ ID: invoice.ID }),
      );

      results.push({ invoiceID: invoice.ID, result: 'Aprobada (status 5)' });
    } else if (si.SupplierInvoiceStatus === 'D') {
      results.push({ invoiceID: invoice.ID, result: 'Sin cambios (status D)' });
    } else {
      results.push({ invoiceID: invoice.ID, result: `Ignorado (status ${si.SupplierInvoiceStatus})` });
    }
  }

  return results;
};
