const cds = require('@sap/cds');
const fs = require('fs');

const path = require('path');

const cds = require(:contentReference[oaicite:5]{index=5}cds.service.impl(async function () {
  const { PrecertItemsByPO, PrecertItemsByPC, PrecertTickets } = this.entities;

  // Remotos (ajustá nombres según tu package.json / .cdsrc.json)
  const s4Purchase = await cds.connect.to('purchaseorder_edmx');

  // API Purchase Contract estándar (destino remoto a configurar)
  // Basado en API_PURCHASECONTRACT_PROCESS_SRV :contentReference[oaicite:6]{index=6}
  const s4Contract = await cds.connect.to('purchasecontract_edmx');

  function getSupplierIdsOrReject(req) {
    let supplierIDs = req.user?.attr?.supplierID;

    const isLocal =
      req.user?.id === 'system' ||
      req.user?.id === 'anonymous' ||
      cds.env.profile?.includes?.('development');

    if (!Array.isArray(supplierIDs) || supplierIDs.length === 0) {
      if (isLocal) return ['31300001']; // mock dev
      console.warn('[AUTH] 403 - Missing supplierID. scopes:', req.user?.scopes, 'attr:', req.user?.attr);
      req.reject(403, 'El usuario no cuenta con supplierID (rol Supplier).');
      return null;
    }
    return supplierIDs;
  }

  // =========================
  // READ safe items por PO
  // =========================
  this.on('READ', PrecertItemsByPO, async (req) => {
    const supplierIDs = getSupplierIdsOrReject(req);
    if (!supplierIDs) return;

    // Se espera filtro PurchaseOrder eq '4500000054'
    const q = cds.ql.clone(req.query);

    // 1) Leer items de PO desde S/4 (sin importes)
    // Nota: si el remoto expone PurchaseOrderItem con estos campos, perfecto.
    // Ajustá nombres a tu EDMX real si difiere.
    const rows = await s4Purchase.run(
      SELECT.from('PurchaseOrderItem').columns(
        'PurchaseOrder',
        'PurchaseOrderItem',
        'Material',
        'PurchaseOrderItemText',
        'OrderQuantity',
        'PurchaseOrderQuantityUnit',
        'QuantityInPurchaseOrderUnit' // si lo querés como “invoiced qty” lo calculás en tu handler actual
      )
      // Importante: no meter NetAmount/NetPrice/etc.
    );

    // 2) Filtrar por supplier (opcional recomendado):
    // Lo robusto es validar que la PO pertenezca al supplierIDs (similar a tu lógica actual) :contentReference[oaicite:7]{index=7}
    // Para simplificar acá: asumimos que el front trae PO válida ya filtrada por PurchaseOrderExt.

    return rows.map(r => ({
      PurchaseOrder: r.PurchaseOrder,
      PurchaseOrderItem: r.PurchaseOrderIte:contentReference[oaicite:8]{index=8}      PurchaseOrderItemText: r.PurchaseOrderItemText,
      OrderQuantity: r.OrderQuantity,
      PurchaseOrderQuantityUnit: r.PurchaseOrderQuantityUnit,
      QuantityInvoiced: r.QuantityInPurchaseOrderUnit || 0
    }));
  });

  // =========================
  // READ safe items por PC
  // =========================
  this.on('READ', PrecertItemsByPC, async (req) => {
    const supplierIDs = getSupplierIdsOrReject(req);
    if (!supplierIDs) return;

    // Ajustar entidad/remoto real según metadata del API Purchase Contract
    // (la estructura exacta depende de tu EDMX importado)
    const rows = await s4Contract.run(
      SELECT.from('A_PurchaseContractItem').columns(
        'PurchaseContract',
        'PurchaseContractItem',
        'Material',
        'PurchaseContractItemText',
        'TargetQuantity',
        'OrderUnit'
      )
    );

    return rows;
  });

  // =========================
  // createTicket
  // =========================
  this.on('createTicket', async (req) => {
    const supplierIDs = getSupplierIdsOrReject(req);
    if (!supplierIDs) return;

    const supplierId = supplierIDs[0]; // si vienen varios, definimos 1 por ahora
    const { referenceType, referenceId, items } = req.data || {};

    if (!referenceType) return req.reject(400, 'referenceType es obligatorio.');
    if (!Array.isArray(items) || items.length === 0) return req.reject(400, 'items es obligatorio.');

    // Reglas mínimas
    for (const it of items) {
      if (!it.quantity || Number(it.quantity) <= 0) return req.reject(400, 'quantity debe ser > 0.');
    }

    const created = await cds.tx(req).run(
      INSERT.into(PrecertTickets).entries({
        referenceType,
        referenceId: referenceId || '',
        supplierId,
        status: 'CREATED',
        items: items.map(it => ({
          purchaseOrder: it.purchaseOrder || null,
          purchaseOrderItem: it.purchaseOrderItem || null,
          purchaseContract: it.purchaseContract || null,
          purchaseContractItem: it.purchaseContractItem || null,
          serviceText: it.serviceText || null,
          quantity: it.quantity,
          unit: it.unit || null
        }))
      })
    );

    return { ticketId: created.ID };
  });

});
