// handlers/SupplierInvoiceItemRead.js
const cds = require('@sap/cds');

/**
 * READ  SupplierInvoiceItemExt  ─ navegación desde _InvoiceItems
 * Corrige SELECT * y re-inyecta filtros de PurchaseOrder + PurchaseOrderItem.
 */
async function handleSupplierInvoiceItemRead (req) {
  try {
    const s4Inv = await cds.connect.to('A_SupplierInvoice_edmx');

    /** 1. Clonar y limpiar COUNT */
    const q = JSON.parse(JSON.stringify(req.query));
    delete q.SELECT?.count;

    /** 2. Detectar navegación _InvoiceItems y redirigir */
    const path = q?.SELECT?.from?.ref;
    const last = path?.at(-1);

    if (last === '_InvoiceItems' || last === 'SupplierInvoiceItemExt') {
      // --- (a) sustituir FROM por entidad remota real
      q.SELECT.from = { ref: ['A_SuplrInvcItemPurOrdRef'] };
      // --- (b) quitar joins heredados
      delete q.SELECT.joins;
    }

    /** 3. Si no hay columnas explícitas → forzar SELECT mínimo */
    const cols = q.SELECT?.columns;
    if (!cols || (cols.length === 1 && cols[0].ref?.[0] === '*')) {
      q.SELECT.columns = [
        { ref: ['SupplierInvoice'] },
        { ref: ['FiscalYear'] },
        { ref: ['SupplierInvoiceItem'] },
        { ref: ['PurchaseOrder'] },
        { ref: ['PurchaseOrderItem'] },
        { ref: ['SupplierInvoiceItemAmount'] },
      ];
    }

    /** 4. Extraer claves de la URL y re-inyectar WHERE */
    // ─ req.params[0] ⇒ PO header  / req.params[1] ⇒ PO Item
    if (req.params?.length >= 2) {
      const { PurchaseOrder } = req.params[0];          // '4500000008'
      const { PurchaseOrderItem } = req.params[1];      // '10' o '00010'

      q.SELECT.where = [
        { ref: ['PurchaseOrder'] },     '=', { val: PurchaseOrder },
        'and',
        { ref: ['PurchaseOrderItem'] }, '=', { val: PurchaseOrderItem.padStart(5,'0') },
      ];
    }

    /** 5. Delegar a S/4 */
    return await s4Inv.run(q);

  } catch (err) {
    console.error('[ERROR] SupplierInvoiceItemExt:', err);
    return req.reject(500, 'Error delegando a servicio remoto de facturas');
  }
}

module.exports = { handleSupplierInvoiceItemRead };
