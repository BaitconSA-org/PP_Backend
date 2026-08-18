const { getS4Service } = require("./utils/s4-connector");
const { certificationRequestEmail, ocRequestEmail, solpedApprovalEmail } = require('./utils/email-templates');
const fs = require("fs");
const path = require("path");
const { generateProtectedExcel, readExcelByColumns, generateSubTicketExcel, generatePrecertExcel, generateManualExcel, generateApprovalManualExcel, generateMAWizardExcel, generatePurchaseContractExcel } = require('./utils/excel-generator');
const { generarProvisionesExcel } = require('./utils/excel-provisiones');
const cds = require('@sap/cds');
const { SELECT } = cds.ql;
const sapCfAxios = require('sap-cf-axios').default;
const FormData = require('form-data');

const REPO_ID = process.env.DMS_REPOSITORY_ID;

// Rollout gradual del modelo de precertificación por ítem de OC: lista de business_partner_ID
// separados por coma habilitados para el modelo nuevo, o "ALL" para habilitarlo globalmente.
// Tickets creados fuera de esta lista siguen usando el modelo plano por subservicio (LEGACY).
const PRECERT_ITEM_MODEL_ROLLOUT = process.env.PRECERT_ITEM_MODEL_ROLLOUT || "";

// TEMP: modelo ITEM forzado ON para todos — ya no hay flujo por subservicio, todo el
// precertificado pasa a ser directo contra el ítem de OC. El código LEGACY se deja en el
// repo por ahora; cuando se confirme que no hace falta volver atrás, se puede borrar junto
// con este override y PRECERT_ITEM_MODEL_ROLLOUT.
function isItemModelEnabled(bpId) {
  return true;
  // eslint-disable-next-line no-unreachable
  const list = PRECERT_ITEM_MODEL_ROLLOUT.split(",").map(v => v.trim()).filter(Boolean);
  if (list.includes("ALL")) return true;
  if (!bpId) return false;
  return list.includes(bpId);
}

async function _enrichSupplierName(records, BusinessPartners) {
  const ids = [...new Set(records.map(r => r.Supplier).filter(Boolean))];
  if (!ids.length) return;
  const bps = await SELECT.from(BusinessPartners).where({ lifnr: { in: ids } }).columns('lifnr', 'provider_name');
  const byLifnr = Object.fromEntries(bps.map(bp => [bp.lifnr, bp.provider_name]));
  for (const r of records) r.SupplierName = byLifnr[r.Supplier] ?? null;
}

// Mapea A_ServiceEntrySheetItem (nombres reales de S/4) al shape que espera el
// frontend (type PurchaseOrderItemService). PriceUnit no existe en esta entidad
// de S/4 — se fija en "1" (default estándar SAP cuando no se informa).
function _mapServiceEntrySheetItem(it) {
  return {
    PONumber: it.PurchaseOrder || "",
    POItemNumber: it.PurchaseOrderItem || "",
    IntRow: it.ServiceEntrySheetItem || "",
    ExtRow: it.ServiceEntrySheetItem || "",
    ActivityNumber: it.Service || "",
    Quantity: it.ConfirmedQuantity != null ? Number(it.ConfirmedQuantity) : 0,
    BaseUOM: it.QuantityUnit || "",
    PriceUnit: "1",
    GrossPrice: it.NetPriceAmount != null ? Number(it.NetPriceAmount) : 0,
    NetValue: it.NetAmount != null ? Number(it.NetAmount) : 0,
    ShortText: it.ServiceEntrySheetItemDesc || "",
    DeleteIndicator: it.IsDeleted || ""
  };
}

global._uploadTokens = global._uploadTokens ?? new Map();
const _uploadTokens = global._uploadTokens;
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutos
const TICKETS_ROOT_NAME = 'tickets';

module.exports = cds.service.impl(async function () {
  const { attachReadOnlyGuard } = require('./utils/read-only-guard');
  attachReadOnlyGuard(this, [
    'me', 'getPurchaseOrderAccountAssignment', 'getPurchaseContractAccountAssignment',
    'getPurchaseOrderItemServices', 'getPurchaseContractItemServices', 'getPurchaseOrderExpanded',
    'getHESExpanded', 'getPurchaseRequisitionExpanded', 'debugEntitySets',
    'checkIASUser', 'getHESDocument', 'downloadTicketDocument',
    'downloadPurchaseContractExcel', 'downloadPrecertExcel', 'downloadSubTicketExcel',
    'downloadPrecertTickets', 'downloadApprovalManualExcel', 'downloadMAWizardExcel',
    'downloadManualExcel'
  ]);
  // downloadProvisionTickets queda deliberadamente afuera: además de generar el
  // Excel hace UPDATE(PrecertTickets).set({provisioned:true...}) — no es solo lectura.

  const { PrecertTickets, PrecertTicketItems, Provinces, WorkflowStatus, BusinessPartners, Services } = this.entities;

  this.on("READ", "PurchaseOrderExt", async (req) => {
    try {
      const s4Purchase = await getS4Service("OP_API_PURCHASEORDER_PROCESS_SRV_0001");

      const isCount =
        req.http?.req?.originalUrl?.includes("/$count") ||
        (req.query?.SELECT?.columns?.length === 1 &&
          req.query.SELECT.columns[0].as === "$count");

      const wantsInlineCount = req.query?.SELECT?.count === true;

      const limit = req.query?.SELECT?.limit;
      const top = Number(limit?.rows?.val ?? limit?.rows ?? 0);
      const skip = Number(limit?.offset?.val ?? limit?.offset ?? 0);

      const purchaseOrder = req.params?.[0]?.PurchaseOrder;
      const isSingle = !!purchaseOrder || !!req.query?.SELECT?.one;

      let poHeaders = [];

      if (purchaseOrder) {
        const q = SELECT.from("A_PurchaseOrder").where({ PurchaseOrder: purchaseOrder });
        const result = await s4Purchase.run(q);
        poHeaders = Array.isArray(result) ? result : [result].filter(Boolean);
      } else {
        const q = SELECT.from("A_PurchaseOrder");

        if (req.query?.SELECT?.where) {
          q.SELECT.where = req.query.SELECT.where;
        }

        // Prefiltro: solo último año
        const oneYearAgo = _getOneYearAgoDateStr();
        const dateCondition = [{ ref: ['CreationDate'] }, '>=', { val: oneYearAgo }];
        q.SELECT.where = q.SELECT.where
          ? [...q.SELECT.where, 'and', ...dateCondition]
          : dateCondition;

        q.orderBy('CreationDate desc');

        const result = await s4Purchase.run(q);
        poHeaders = Array.isArray(result) ? result : [result].filter(Boolean);
      }

      const searchTerm = _extractSearchTerm(req);
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const searchableFields = [
          "PurchaseOrder", "PurchaseOrderType", "Supplier",
          "CompanyCode", "PurchasingOrganization", "PurchasingGroup",
          "CreatedByUser", "DocumentCurrency", "PurchasingDocumentOrigin",
          "SupplierRespSalesPersonName", "IncotermsClassification"
        ];
        poHeaders = poHeaders.filter(po =>
          searchableFields.some(f => po[f] && String(po[f]).toLowerCase().includes(term))
        );
      }

      if (!poHeaders.length) {
        if (isCount) return [{ $count: 0 }];

        const empty = [];
        if (wantsInlineCount) empty.$count = 0;
        return isSingle ? null : empty;
      }

      const poIds = poHeaders.map((po) => po.PurchaseOrder);

      const itemQuery = SELECT.from("A_PurchaseOrderItem")
        .columns("PurchaseOrder", "NetPriceAmount", "NetPriceQuantity")
        .where({ PurchaseOrder: { in: poIds } });

      const itemsResult = await s4Purchase.run(itemQuery);
      const items = Array.isArray(itemsResult) ? itemsResult : [itemsResult].filter(Boolean);

      const totalsByPO = {};
      const qtyByPO = {};

      for (const item of items) {
        const poId = item.PurchaseOrder;
        const amount = parseFloat(item.NetPriceAmount) || 0;
        const qty = parseFloat(item.NetPriceQuantity) || 0;

        totalsByPO[poId] = (totalsByPO[poId] || 0) + amount;
        qtyByPO[poId] = (qtyByPO[poId] || 0) + qty;
      }

      for (const po of poHeaders) {
        const totalAmount = totalsByPO[po.PurchaseOrder] || 0;
        const totalQty = qtyByPO[po.PurchaseOrder] || 0;

        po.NetAmountTotal = Number(totalAmount.toFixed(2));
        po.UnitPrice = totalQty ? Number((totalAmount / totalQty).toFixed(2)) : 0;
      }

      await _enrichSupplierName(poHeaders, BusinessPartners);

      const total = poHeaders.length;

      if (isCount) {
        return [{ $count: total }];
      }

      let result = poHeaders;

      if (!isSingle && top > 0) {
        result = poHeaders.slice(skip, skip + top);
      }

      if (wantsInlineCount) {
        result.$count = total;
      }

      return isSingle ? result[0] || null : result;
    } catch (err) {
      console.error("Error en PurchaseOrderExt:", err);
      return req.reject(500, "Error al leer órdenes de compra");
    }
  });

  this.on("READ", "PurchaseOrderItemExt", async (req) => {
    try {
      const s4Purchase = await getS4Service("OP_API_PURCHASEORDER_PROCESS_SRV_0001");

      const isCount =
        req.http?.req?.originalUrl?.includes("/$count") ||
        (req.query?.SELECT?.columns?.length === 1 &&
          req.query.SELECT.columns[0].as === "$count");

      const wantsInlineCount = req.query?.SELECT?.count === true;

      const limit = req.query?.SELECT?.limit;
      const top = Number(limit?.rows?.val ?? limit?.rows ?? 0);
      const skip = Number(limit?.offset?.val ?? limit?.offset ?? 0);

      const purchaseOrder = req.params?.[0]?.PurchaseOrder;
      const purchaseOrderItem = req.params?.[0]?.PurchaseOrderItem;
      const isSingle = !!(purchaseOrder && purchaseOrderItem) || !!req.query?.SELECT?.one;

      let q = SELECT.from("A_PurchaseOrderItem");

      if (purchaseOrder && purchaseOrderItem) {
        q.where({
          PurchaseOrder: purchaseOrder,
          PurchaseOrderItem: purchaseOrderItem
        });
      } else if (purchaseOrder) {
        q.where({ PurchaseOrder: purchaseOrder });
      } else {
        if (req.query?.SELECT?.where) {
          q.SELECT.where = req.query.SELECT.where;
        }

        if (req.query?.SELECT?.orderBy?.length) {
          q.SELECT.orderBy = req.query.SELECT.orderBy;
        } else {
          q.SELECT.orderBy = [
            { ref: ["PurchaseOrder"], sort: "asc" },
            { ref: ["PurchaseOrderItem"], sort: "asc" }
          ];
        }
      }

      const rawResult = await s4Purchase.run(q);
      const poItems = Array.isArray(rawResult) ? rawResult : [rawResult].filter(Boolean);

      if (!poItems.length) {
        if (isCount) return [{ $count: 0 }];

        const empty = [];
        if (wantsInlineCount) empty.$count = 0;
        return isSingle ? null : empty;
      }

      for (const item of poItems) {
        const qty = parseFloat(item.NetPriceQuantity) || 0;
        const amount = parseFloat(item.NetPriceAmount) || 0;

        item.UnitPrice = qty ? Number((amount / qty).toFixed(2)) : 0;
      }

      const total = poItems.length;

      if (isCount) {
        return [{ $count: total }];
      }

      let result = poItems;

      if (!isSingle && top > 0) {
        result = poItems.slice(skip, skip + top);
      }

      if (wantsInlineCount) {
        result.$count = total;
      }

      return isSingle ? result[0] || null : result;
    } catch (err) {
      console.error("Error en PurchaseOrderItemExt:", err);
      return req.reject(500, "Error al leer posiciones de la orden de compra");
    }
  });

  this.on("READ", "PurchaseContractExt", async (req) => {
    try {
      const s4Contract = await getS4Service("OP_API_PURCHASECONTRACT_PROCESS_SRV_0002");
      const { BusinessPartners } = this.entities;

      const purchaseContract = req.params?.[0]?.PurchaseContract;

      if (purchaseContract) {
        const q = SELECT.from("A_PurchaseContract").where({ PurchaseContract: purchaseContract });
        const result = await s4Contract.run(q);
        const list = Array.isArray(result) ? result : [result].filter(Boolean);
        await _enrichSupplierName(list, BusinessPartners);
        return Array.isArray(result) ? list : list[0];
      }

      const q = SELECT.from("A_PurchaseContract");

      if (req.query?.SELECT?.where) {
        q.SELECT.where = req.query.SELECT.where;
      }

      // Prefiltro: solo contratos vigentes (ValidityEndDate >= hoy)
      /*  const today = new Date().toISOString().split('T')[0];
       const dateCondition = [{ ref: ['ValidityEndDate'] }, '>=', { val: today }];
       q.SELECT.where = q.SELECT.where
         ? [...q.SELECT.where, 'and', ...dateCondition]
         : dateCondition; */

      q.orderBy('ValidityEndDate desc');

      const contracts = await s4Contract.run(q);
      if (Array.isArray(contracts)) await _enrichSupplierName(contracts, BusinessPartners);
      return contracts;
    } catch (err) {
      console.error("Error en PurchaseContract:", err);
      return req.reject(500, "Error al leer contratos de compra");
    }
  });

  this.on("READ", "PurchaseContractItemExt", async (req) => {
    try {
      const s4Contract = await getS4Service("OP_API_PURCHASECONTRACT_PROCESS_SRV_0002");

      const purchaseContract = req.params?.[0]?.PurchaseContract;

      const q = SELECT.from("A_PurchaseContractItem");

      if (purchaseContract) {
        q.where({ PurchaseContract: purchaseContract });
      } else if (req.query?.SELECT?.where) {
        q.SELECT.where = req.query.SELECT.where;
      }

      if (req.query?.SELECT?.orderBy?.length) q.SELECT.orderBy = req.query.SELECT.orderBy;

      const rawItems = await s4Contract.run(q);
      const contractItems = Array.isArray(rawItems) ? rawItems : [rawItems].filter(Boolean);

      return contractItems.filter(item => {
        if (item.PurchasingContractDeletionCode?.trim()) return false;
        const target = Number(item.TargetQuantity || 0);
        const consumed = Number(item.ContractItemConsumedQuantity || 0);
        return (target - consumed) > 0;
      });
    } catch (err) {
      console.error("Error en PurchaseContractItemExt:", err);
      return req.reject(500, "Error al leer posiciones del contrato de compra");
    }
  });

  /*
    this.on("READ", "PurchaseOrderAccountAssignments", (req) => {
      const sel = req.query?.SELECT;
      if (sel?.where) {
        padWhereEq(sel.where, "PurchaseOrder", 10);
        padWhereEq(sel.where, "PurchaseOrderItem", 5);
      }
      return s4Purchase.run(req.query);
    });

    this.before("READ", "PurchaseContractExt", (req) => {
      const supplierIDs = getScopedSupplierIDs(req);
      if (!supplierIDs) return;

      // Fuerza scope por Supplier
      req.query.where({ Supplier: { in: supplierIDs } });
    });

    this.before("READ", "PurchaseContractItemExt", async (req) => {
      const supplierIDs = getScopedSupplierIDs(req);
      if (!supplierIDs) return;

      const pc = req.data?.PurchaseContract; // viene si es READ por key
      if (!pc) {
        return req.reject(400, "Debe filtrar por PurchaseContract");
      }

      const ok = await SELECT.one
        .from(this.entities.PurchaseContractExt)
        .columns(["PurchaseContract"])
        .where({ PurchaseContract: pc, Supplier: { in: supplierIDs } });

      if (!ok) return req.reject(404, "Not found");
      }); */
  // Helper: obtiene el bp_ID del usuario actual desde IAS
  this.before('READ', 'PurchaseOrderExt', async (req) => {
    if (req.user.attr?.bp_id) {

      const bpId =
        req.user.attr?.bp_id[0]
        ?? req.user.tokenInfo?.getTokenValue?.('customAttribute1')  // ← fallback XSUAA
        ?? null;

      if (!bpId) return req.error(403, 'El usuario no tiene un bp_ID asignado.');

      req.query.where({ Supplier: bpId, ReleaseIsNotCompleted: false });
    }
  });

  this.before('READ', 'PurchaseContractExt', async (req) => {
    if (req.user.attr?.bp_id) {

      const bpId =
        req.user.attr?.bp_id[0]
        ?? req.user.tokenInfo?.getTokenValue?.('customAttribute1')  // ← fallback XSUAA
        ?? null;

      if (!bpId) return req.error(403, 'El usuario no tiene un bp_ID asignado.');

      req.query.where({ Supplier: bpId });
    }
  });
  this.before("CREATE", "PrecertTickets", async (req) => {

    const tx = cds.tx(req);

    // si es subticket, copio defaults del padre
    if (req.data.parent_ticket_ID) {
      const parent = await tx.run(
        SELECT.one.from(PrecertTickets).where({ ID: req.data.parent_ticket_ID })
      );

      if (!parent) {
        return req.reject(404, "Ticket padre inexistente");
      }

      req.data.ticket_number = req.data.ticket_number ?? parent.ticket_number;

      req.data.source_type =
        req.data.source_type ?? parent.source_type;

      req.data.source_number =
        req.data.source_number ?? parent.source_number;

      req.data.business_partner_ID =
        req.data.business_partner_ID ?? parent.business_partner_ID;

      req.data.currency =
        req.data.currency ?? parent.currency;

      req.data.measure_unity =
        req.data.measure_unity ?? parent.measure_unity;

      req.data.province_ID =
        req.data.province_ID ?? parent.province_ID ?? null;

      req.data.date_from =
        req.data.date_from ?? parent.date_from ?? null;

      req.data.date_to =
        req.data.date_to ?? parent.date_to ?? null;

      req.data.service =
        req.data.service ?? parent.service ?? null;

      req.data.subService =
        req.data.subService ?? parent.subService ?? null;

      req.data.account_assignment_number =
        req.data.account_assignment_number ?? parent.account_assignment_number ?? null;

      req.data.project_network =
        req.data.project_network ?? parent.project_network ?? null;

      req.data.order =
        req.data.order ?? parent.order ?? null;

      req.data.cost_center =
        req.data.cost_center ?? parent.cost_center ?? null;

      req.data.global_ledger_account =
        req.data.global_ledger_account ?? parent.global_ledger_account ?? null;

      req.data.total_price =
        req.data.total_price ?? 0;

      req.data.qty_to_certify =
        req.data.qty_to_certify ?? 0;

      req.data.qty_certified =
        req.data.qty_certified ?? 0;

      req.data.root_quantity =
        req.data.root_quantity ?? parent.qty_to_certify ?? 0;

      req.data.ticket_quantity =
        req.data.ticket_quantity ?? 0;
    } else {
      // ticket raíz
      // ticket_number correlativo solo para tickets raíz
      if (req.data.ticket_number == null) {
        req.data.ticket_number = await _nextTicketNumber(tx);
      }
      req.data.business_partner_ID =
        req.data.business_partner_ID ?? "DEFAULT_BP";
    }
  });
  this.before(["UPDATE", "PATCH"], "PrecertTickets", async (req) => {
    const id =
      req.data?.ID ||
      req.params?.[0]?.ID ||
      req.params?.[0]?.Id ||
      req.params?.[0]?.id;

    if (!id) return;

    const tx = cds.tx(req);

    const current = await tx.run(
      SELECT.one.from(PrecertTickets).where({ ID: id })
    );

    if (!current) {
      return req.reject(404, "Ticket inexistente");
    }

    // valido subtickets
    if (!current.parent_ticket_ID) return;

    const parent = await tx.run(
      SELECT.one.from(PrecertTickets).where({ ID: current.parent_ticket_ID })
    );

    if (!parent) {
      return req.reject(404, "Ticket origen inexistente");
    }

    const siblings = await tx.run(
      SELECT.from(PrecertTickets).where({ parent_ticket_ID: current.parent_ticket_ID })
    );

    const newQty =
      req.data.qty_to_certify !== undefined
        ? Number(req.data.qty_to_certify || 0)
        : Number(current.qty_to_certify || 0);

    const otherQty = siblings
      .filter(s => s.ID !== current.ID)
      .reduce((sum, s) => sum + (Number(s.qty_to_certify) || 0), 0);

    const parentQty = Number(parent.ticket_quantity || parent.qty_to_certify || 0);

    if (newQty < 0) {
      return req.reject(400, "qty_to_certify no puede ser negativo");
    }

    if (otherQty + newQty > parentQty + 412321321) {
      return req.reject(
        400,
        `La cantidad solicitada supera la cantidad disponible del ticket padre (${parentQty})`
      );
    }
  });


  this.before("DELETE", "PrecertTickets", async (req) => {

    const where = getTicketKeyWhere(req);
    if (!where) return req.reject(400, "ID requerido");

    const existing = await SELECT.one
      .from(PrecertTickets)
      .columns(["ID", "business_partner_ID", "parent_ticket_ID"])
      .where(where);

    if (!existing) return req.reject(404, "Ticket inexistente");


    /*     if (!existing.parent_ticket_ID) {
          return req.reject(400, "Solo se pueden eliminar subtickets");
        } */
  });


  // Agregado persistente por (source_type, source_number, po_item): sobrevive a todas las
  // precertificaciones parciales que se hagan contra ese ítem a lo largo del tiempo, no solo
  // a las del ticket que lo crea. Si no existe, se crea trayendo la cantidad total del
  // servicio desde SAP (OrderQuantity de A_PurchaseOrderItem / TargetQuantity de
  // A_PurchaseContractItem) — el mismo campo que ya expone PurchaseOrderItemExt/
  // PurchaseContractItemExt, sin agregar ninguna llamada nueva a SAP.
  async function _findOrCreatePrecertTicketItem(tx, { source_type, source_number, po_item, po_item_text, service_id, sampleItem, pcItemDataMap }) {
    const existing = await tx.run(
      SELECT.one.from(PrecertTicketItems).where({ source_type, source_number, po_item })
    );
    if (existing) return existing;

    let qty_total = 0;
    let unit_price = 0;
    let currencyCode = null;
    let measureUnity = sampleItem?.measure_unity ?? null;

    if (source_type === "PO") {
      try {
        const s4Purchase = await getS4Service("OP_API_PURCHASEORDER_PROCESS_SRV_0001");
        const poItem = await s4Purchase.run(
          SELECT.one.from("A_PurchaseOrderItem")
            .columns("OrderQuantity", "PurchaseOrderQuantityUnit", "NetPriceAmount", "NetPriceQuantity", "DocumentCurrency")
            .where({ PurchaseOrder: source_number, PurchaseOrderItem: String(po_item).padStart(5, "0") })
        );
        qty_total = Number(poItem?.OrderQuantity) || 0;
        measureUnity = poItem?.PurchaseOrderQuantityUnit || measureUnity;
        unit_price = Number(poItem?.NetPriceQuantity) > 0
          ? round2(Number(poItem.NetPriceAmount) / Number(poItem.NetPriceQuantity))
          : 0;
        currencyCode = poItem?.DocumentCurrency || null;
      } catch (err) {
        console.error(`[_findOrCreatePrecertTicketItem] Error leyendo ítem de OC ${source_number}/${po_item}:`, err.message);
        throw err;
      }
    } else if (source_type === "PC") {
      try {
        const s4Contract = await getS4Service("OP_API_PURCHASECONTRACT_PROCESS_SRV_0002");
        const contractItem = await s4Contract.run(
          SELECT.one.from("A_PurchaseContractItem")
            .columns("TargetQuantity", "OrderQuantityUnit", "NetPriceAmount", "NetPriceQuantity")
            .where({ PurchaseContract: source_number, PurchaseContractItem: String(po_item).padStart(5, "0") })
        );
        qty_total = Number(contractItem?.TargetQuantity) || 0;
        measureUnity = contractItem?.OrderQuantityUnit || measureUnity;
        unit_price = Number(contractItem?.NetPriceQuantity) > 0
          ? round2(Number(contractItem.NetPriceAmount) / Number(contractItem.NetPriceQuantity))
          : 0;
      } catch (err) {
        console.error(`[_findOrCreatePrecertTicketItem] Error leyendo ítem de Contrato ${source_number}/${po_item}:`, err.message);
        throw err;
      }
    }

    const newRow = {
      ID: cds.utils.uuid(),
      source_type,
      source_number,
      po_item,
      po_item_text: pcItemDataMap?.[String(po_item)]?.PurchaseContractItemText ?? po_item_text ?? null,
      service_id: service_id ?? null,
      service_desc: sampleItem?.ses_subservice ?? null,
      qty_total,
      qty_certified: 0,
      unit_price,
      currency: currencyCode,
      measure_unity: measureUnity,
      account_assignment_number: sampleItem?.account_assignment_number ?? null,
      project_network: sampleItem?.project_network ?? null,
      order: sampleItem?.order ?? null,
      cost_center: sampleItem?.cost_center ?? null,
      global_ledger_account: sampleItem?.global_ledger_account ?? null,
      wbs_element: sampleItem?.wbs_element ?? null
    };

    await tx.run(INSERT.into(PrecertTicketItems).entries(newRow));
    return newRow;
  }

  // ====== ACTION: submitPrecertTicket(ID) ======
  this.on("submitPrecertTicket", async (req) => {
    const tx = cds.tx(req);

    const source_type = String(req.data?.source_type || "").toUpperCase().trim();
    const source_number = String(req.data?.source_number || "").trim();
    const currency = String(req.data?.currency || "").toUpperCase().trim();
    const business_partner = String(req.data?.business_partner || "").trim();
    const contact_vista = String(req.data?.contact_vista || "").trim();
    const items = Array.isArray(req.data?.items) ? req.data.items : [];

    const bp = await tx.run(
      SELECT.one.from(BusinessPartners).where({ business_partner_number: business_partner })
    );

    // El backend decide el modelo, no confía en lo que mande el front — evalúa el flag
    // de rollout contra el business_partner real del ticket que se está creando.
    const ticketModel = isItemModelEnabled(business_partner) ? "ITEM" : "LEGACY";

    if (!source_type || !source_number) {
      return req.reject(400, "source_type y source_number son obligatorios");
    }

    if (source_type !== "PO" && source_type !== "PC") {
      return req.reject(400, "source_type debe ser PO o PC");
    }

    if (!business_partner) {
      return req.reject(400, "business_partner es obligatorio");
    }

    if (!bp) {
      return req.reject(400, `No se encontró el proveedor "${business_partner}" en BusinessPartners`);
    }

    if (!currency || currency.length !== 3) {
      return req.reject(400, "currency inválida");
    }

    if (!items.length) {
      return req.reject(400, "items no puede estar vacío");
    }

    let totalCents = 0;

    for (const it of items) {
      const qty = n(it.qty_to_certify);
      const unitPrice = round2(n(it.unit_price));

      if (!(qty > 0)) {
        return req.reject(400, "qty_to_certify inválida");
      }

      if (!(unitPrice >= 0)) {
        return req.reject(400, "unit_price inválido");
      }

      if (!it.date_from || !it.date_to) {
        return req.reject(400, "date_from/date_to obligatorias");
      }

      if (String(it.date_from) > String(it.date_to)) {
        return req.reject(400, "Rango de fechas inválido");
      }

      const lineAmount = round2(qty * unitPrice);
      totalCents += Math.round(lineAmount * 100);
    }

    const total_price = totalCents / 100;
    const ticket_number = await _nextTicketNumber(tx);
    const rootId = cds.utils.uuid();

    let validator = contact_vista ? contact_vista : null;
    const pcItemDataMap = {};
    let pcPurchasingGroup = null;
    let pcPurchasingOrg = null;

    if (source_type === "PC") {
      try {
        const s4Contract = await getS4Service("OP_API_PURCHASECONTRACT_PROCESS_SRV_0002");
        const pcPadded = String(source_number).padStart(10, "0");
        const [contract, contractItems] = await Promise.all([
          s4Contract.run(
            SELECT.one.from("A_PurchaseContract")
              .columns("ZZ_FISCA", "ZZ_FISCA_EMAIL", "PurchasingGroup", "PurchasingOrganization")
              .where({ PurchaseContract: source_number })
          ),
          s4Contract.run(
            SELECT.from("A_PurchaseContractItem")
              .columns("PurchaseContractItem", "Plant", "MaterialGroup", "AccountAssignmentCategory", "PurchaseContractItemText")
              .where({ PurchaseContract: source_number })
          )
        ]);
        validator = contract?.ZZ_FISCA_EMAIL || null;
        pcPurchasingGroup = contract?.PurchasingGroup || null;
        pcPurchasingOrg = contract?.PurchasingOrganization || null;
        for (const item of (Array.isArray(contractItems) ? contractItems : [])) {
          pcItemDataMap[String(parseInt(item.PurchaseContractItem))] = item;
        }
      } catch (err) {
        console.error(`[submitPrecertTicket] Error leyendo datos de S4 para ${source_number}:`, err.message);
        throw err;
      }
    }

    // Mapeo ses_subservice (description) → ses_service (ID) desde tabla local Services
    const subserviceDescriptions = [...new Set(
      items.map(it => it.ses_subservice).filter(Boolean)
    )];

    const serviceRows = subserviceDescriptions.length
      ? await tx.run(
        SELECT.from(Services)
          .columns("ID", "description")
          .where({ description: { in: subserviceDescriptions } })
      )
      : [];

    const serviceDescToId = Object.fromEntries(
      serviceRows.map(s => [s.description, s.ID])
    );

    // Modelo ITEM: find-or-create del agregado persistente por po_item, y validación del
    // remanente real (qty_total - qty_certified) contra la suma de lo que se pide certificar
    // ahora para ese ítem — reemplaza a la validación rota de antes (ver before UPDATE).
    const poItemAggregates = {};
    if (ticketModel === "ITEM") {
      const qtyByPoItem = {};
      for (const it of items) {
        const key = String(it.po_item ?? "");
        qtyByPoItem[key] = (qtyByPoItem[key] || 0) + n(it.qty_to_certify);
      }

      for (const key of Object.keys(qtyByPoItem)) {
        if (!key) {
          return req.reject(400, "po_item es obligatorio para el modelo de precertificación por ítem");
        }

        const sampleItem = items.find(it => String(it.po_item ?? "") === key);
        const serviceId = serviceDescToId[sampleItem?.ses_subservice] ?? null;

        const aggregate = await _findOrCreatePrecertTicketItem(tx, {
          source_type,
          source_number,
          po_item: sampleItem.po_item,
          po_item_text: sampleItem.po_item_text,
          service_id: serviceId,
          sampleItem,
          pcItemDataMap
        });

        const remaining = Number(aggregate.qty_total || 0) - Number(aggregate.qty_certified || 0);
        if (qtyByPoItem[key] > remaining + 1e-9) {
          return req.reject(400,
            `La cantidad a certificar del ítem ${key} (${qtyByPoItem[key]}) supera el remanente disponible del servicio (${remaining}).`);
        }

        poItemAggregates[key] = aggregate;
      }
    }

    await tx.run(
      INSERT.into(PrecertTickets).entries({
        ID: rootId,
        ticket_number,
        source_type,
        source_number,
        business_partner_ID: bp.ID,
        currency,
        total_price,
        validator,
        parent_ticket_ID: null,
        ticket_model: ticketModel,
        provisioned: false
      })
    );

    const subTickets = items.map((it) => {
      const qty = n(it.qty_to_certify);
      const unitPrice = round2(n(it.unit_price));
      const lineAmount = round2(qty * unitPrice);

      return {
        ID: cds.utils.uuid(),
        parent_ticket_ID: rootId,
        ticket_number,
        precert_ticket_item_ID: ticketModel === "ITEM"
          ? (poItemAggregates[String(it.po_item ?? "")]?.ID ?? null)
          : null,
        source_type,
        source_number,
        validator,
        business_partner_ID: bp.ID,
        currency,
        total_price: Math.round(unitPrice * 1000) / 1000,
        measure_unity: it.measure_unity ?? null,
        province_ID: it.province_ID ?? null,
        qty_to_certify: qty,
        qty_certified: null,
        root_quantity: null,
        ticket_quantity: qty,
        date_from: it.date_from,
        date_to: it.date_to,
        account_assignment_number: it.account_assignment_number ?? null,
        project_network: it.project_network ?? null,
        order: it.order ?? null,
        cost_center: it.cost_center ?? null,
        global_ledger_account: it.global_ledger_account ?? null,
        po_item: it.po_item ?? null,
        ses_service: serviceDescToId[it.ses_subservice] ?? null,
        ses_subservice: it.ses_subservice ?? null,
        ses_short_text: it.ses_short_text ?? null,
        wbs_element: it.wbs_element ?? null,
        co_area: it.co_area ?? null,
        profit_center: it.profit_center ?? null,
        observations: it.observations ?? null,
        subservice_position: it.subservice_position ?? null,
        purchasing_group: pcPurchasingGroup ?? it.purchasing_group ?? null,
        purchasing_org: pcPurchasingOrg ?? it.purchasing_org ?? null,
        po_item_text: pcItemDataMap[String(it.po_item)]?.PurchaseContractItemText ?? it.po_item_text ?? null,
        account_assignment_cat: pcItemDataMap[String(it.po_item)]?.AccountAssignmentCategory ?? null,
        plant: pcItemDataMap[String(it.po_item)]?.Plant ?? null,
        material_group: pcItemDataMap[String(it.po_item)]?.MaterialGroup ?? null,
        provisioned: false
      };
    });

    await tx.run(
      INSERT.into(PrecertTickets).entries(subTickets)
    );

    const wfEntries = subTickets.map(sub => ({
      ID: cds.utils.uuid(),
      precert_ticket_ID: sub.ID,
      business_partner_ID: bp.ID,
      description: "Pendiente aprobación",
      asigned_user: "",
      status: "PENDIENTE",
      approved_by: null,
      application_type: "PRECERT"
    }));

    await tx.run(INSERT.into(WorkflowStatus).entries(wfEntries));

    // Commitear acá, antes de arrancar el WF: el primer paso de BPA ("POST AUDIT")
    // llama de vuelta a endWorkflowPrecert casi al instante, y si el ticket todavía
    // no está persistido pierde la carrera contra ese callback → "Ticket not found".
    await tx.commit();

    const tempRoot = { source_number, ticket_number, validator };
    const sesPayload = _buildSesPayload(tempRoot, subTickets);

    startWorkflow(rootId, sesPayload).then(async instance => {
      if (instance?.id) {
        const txWf = cds.tx();
        await txWf.run(UPDATE(WorkflowStatus).set({ workflow_instance_id: instance.id }).where({ precert_ticket_ID: rootId }));
        await txWf.commit();
      }
    }).catch(err =>
      console.error(`[startWorkflow] Error iniciando workflow para ticket ${rootId}:`, err.message)
    );

    return {
      ticket_id: rootId,
      ticket_number,
      status: 'PENDIENTE',
      currency,
      total_price
    };
  });

  const handleIASError = (error, req) => {
    if (error.config) {
      const base = error.config.baseURL || '';
      const url = error.config.url || '';
      console.error(`[IAS ERROR]: ${error.config.method?.toUpperCase()} -> ${base}${url}`);
    }
    if (error.response) {
      console.error(`[IAS RESPONSE]:`, JSON.stringify(error.response.data));
    }
    const detail = error.response?.data?.detail || error.message;
    return req.error(500, `Error al contactar con IAS: ${detail}`);
  };

  const scimHeaders = {
    "Accept": "application/scim+json",
    "Content-Type": "application/scim+json"
  };


  this.on("checkIASUser", async (req) => {
    const { email } = req.data;

    if (!email?.trim()) {
      return req.error(400, "El email es obligatorio.");
    }

    try {
      const axios = sapCfAxios("CAP_IAS_SCIM");

      const oResponse = await axios({
        method: "GET",
        url: "/scim/Users",
        params: { filter: `emails.value eq "${email.trim().toLowerCase()}"` },
        headers: scimHeaders
      });

      const nTotal = oResponse.data?.totalResults ?? 0;
      return { exists: nTotal > 0 };

    } catch (error) {
      return handleIASError(error, req);
    }
  });

  this.on("me", async (req) => {
    const u = req.user;
    const jwt = (req.headers.authorization || "").split(" ")[1];

    const p = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString("utf8"));
    console.log("[me] aud:", JSON.stringify(p.aud),
      "| cid:", p.cid,
      "| client_id:", p.client_id,
      "| azp:", p.azp,
      "| origin:", p.origin,
      "| scope:", JSON.stringify(p.scope));
    if (jwt) {
      try {
        const p = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString("utf8"));
        console.log("[me] origin:", p.origin,
          "| user_name:", p.user_name,
          "| email:", p.email,
          "| scope:", JSON.stringify(p.scope),
          "| xs.user.attributes:", JSON.stringify(p["xs.user.attributes"]));
      } catch (e) { console.error("[me] no pude decodificar el JWT", e); }
    }

    const KNOWN_ROLES = [
      "FiscalizadorPrecertificacion",
      "ProveedorActivo",
      "AprobadorImpuestos",
      "AprobadorLegales",
      "AprobadorTesoreria",
      "Visualizador",
      "Auditor",
      "ACAP"
    ];
    const roles = KNOWN_ROLES.filter(r => u.is(r));   // no depende de serializar u.roles

    const sBpId = Array.isArray(u.attr?.bp_id)
      ? (u.attr.bp_id[0] || "")
      : (u.attr?.bp_id || "");

    return {
      email: (u.id || "").toLowerCase(),
      roles,
      bp_ID: sBpId,
      itemModelEnabled: isItemModelEnabled(sBpId)
    };
  });

  this.on("getHESDocument", async (req) => {
    const { nro_hes } = req.data;

    if (!nro_hes) return req.error(400, "nro_hes es obligatorio.");

    try {
      // TODO: verificar el entity set real de PDF en API_SERVICE_ENTRY_SHEET_SRV estándar;
      // "ServiceEntrySheetPDFSet" era específico del servicio Z y puede no existir acá.
      const response = await sapCfAxios("S4HANA")({
        method: "GET",
        url: `/sap/opu/odata/sap/API_SERVICE_ENTRY_SHEET_SRV/ServiceEntrySheetPDFSet('${encodeURIComponent(nro_hes)}')/$value`,
        responseType: "arraybuffer",        // fuerza binario, sin decodificar a texto
        headers: { Accept: "application/pdf" }
      });

      const buf = Buffer.from(response.data); // ArrayBuffer -> Buffer, byte a byte, intacto

      // Diagnóstico real: si el logo está, el tamaño será mayor que la versión corrupta
      console.log("[getHESDocument] bytes:", buf.length,
        "header:", buf.subarray(0, 5).toString("latin1"));

      return { value: buf.toString("base64") };

    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.statusText || err.message;
      console.error(`[getHESDocument] Error ${status} para HES ${nro_hes}:`, msg);

      if (status === 404) return req.error(404, `HES ${nro_hes} no encontrado en S4.`);
      return req.error(500, `Error al obtener el documento HES: ${msg}`);
    }
  });

  this.on('downloadTicketDocument', async (req) => {
    const { document_id } = req.data;
    if (!document_id) return req.error(400, 'document_id es obligatorio.');

    const { TicketDocuments } = cds.entities('suppliersInitiative');
    const tx = cds.tx(req);

    const oDoc = await tx.run(
      SELECT.one.from(TicketDocuments).where({ ID: document_id })
    );
    if (!oDoc) return req.error(404, 'Documento no encontrado.');
    if (!oDoc.dms_object_id) return req.error(400, 'El documento no tiene referencia DMS.');

    const REPO_ID = process.env.DMS_REPOSITORY_ID;
    const dmsAxios = sapCfAxios('DMSDest');

    try {
      const oRes = await dmsAxios.get(
        `/browser/${REPO_ID}/root`,
        {
          params: {
            cmisselector: 'content',
            objectId: oDoc.dms_object_id
          },
          responseType: 'arraybuffer'
        }
      );

      return {
        file_name: oDoc.file_name,
        content: Buffer.from(oRes.data).toString('base64')
      };

    } catch (e) {
      console.error('[DMS] Download falló:', e.response?.status, e.response?.data);
      return req.error(500, `No se pudo descargar el documento desde DMS (${e.response?.status}).`);
    }
  });

  this.on('_uploadFileToDMS', async (req) => {
    const { ticket_id, file_name, file_b64, user_id } = req.data;

    if (!REPO_ID) return req.error(500, 'DMS_REPOSITORY_ID no configurado.');

    const { PrecertTickets, TicketDocuments } = cds.entities('suppliersInitiative');
    const tx = cds.tx(req);

    const ticket = await tx.run(
      SELECT.one.from(PrecertTickets).where({ ID: ticket_id })
    );
    if (!ticket) return req.error(404, `Ticket ${ticket_id} no encontrado.`);

    const fileBuffer = Buffer.from(file_b64, 'base64');
    const ticketFolder = String(ticket.ticket_number);
    const dmsAxios = sapCfAxios('DMSDest');

    // ── Asegurar /tickets ────────────────────────────────────────────────────
    await _ensureDMSFolder(dmsAxios, '', TICKETS_ROOT_NAME);

    // ── Asegurar /tickets/{ticket_number} — este objectId es el destino ──────
    const folderId = await _ensureDMSFolder(
      dmsAxios,
      `/${TICKETS_ROOT_NAME}`,
      ticketFolder
    );
    const uploadUrl = `/browser/${REPO_ID}/root/${TICKETS_ROOT_NAME}/${encodeURIComponent(ticketFolder)}`;


    try {
      const listRes = await dmsAxios.get(uploadUrl, {
        params: { cmisselector: 'children', succinct: true }
      });
      const existing = (listRes.data?.objects || [])
        .find(o => o.object?.succinctProperties?.['cmis:name'] === file_name);

      if (existing) {
        const existingObjectId =
          existing.object?.succinctProperties?.['cmis:objectId'] ?? null;

        console.warn(
          `[DMS] Documento '${file_name}' ya existe (pre-check), reusando: ${existingObjectId}`
        );

        const inserted = await INSERT.into(TicketDocuments).entries({
          ticket_ID: ticket_id,
          file_name,
          dms_object_id: existingObjectId,
          dms_folder_id: folderId ?? null,
          uploaded_by: user_id ?? 'system'
        });
        return { document_id: inserted.ID ?? null, dms_object_id: existingObjectId };
      }
    } catch (listErr) {
      // Si el listado falla no bloqueamos — intentamos subir igual
      console.warn('[DMS] No se pudo listar carpeta, intentando upload directo:', listErr.message);
    }

    // ── Armar el FormData del documento ──────────────────────────────────────
    const buildDocumentFd = () => {
      const fd = new FormData();
      fd.append('cmisaction', 'createDocument');
      fd.append('propertyId[0]', 'cmis:name');
      fd.append('propertyValue[0]', file_name);
      fd.append('propertyId[1]', 'cmis:objectTypeId');
      fd.append('propertyValue[1]', 'cmis:document');
      fd.append('succinct', 'true');
      fd.append('content', fileBuffer, {
        filename: file_name,
        contentType: 'application/pdf'
      });
      return fd;
    };


    let uploadRes;
    try {
      const fd = buildDocumentFd();
      uploadRes = await dmsAxios.post(uploadUrl, fd, { headers: fd.getHeaders() });

    } catch (uploadErr) {
      const status = uploadErr.response?.status;
      const errBody = uploadErr.response?.data;

      // Log completo para futuros diagnósticos
      console.error('[DMS] Upload documento falló:');
      console.error('[DMS]   status  :', status);
      console.error('[DMS]   url     :', uploadErr.config?.url);
      console.error('[DMS]   data    :', JSON.stringify(errBody));
      console.error('[DMS]   headers :', JSON.stringify(uploadErr.response?.headers));

      // SAP SDM puede devolver 409 o 500 con exception nameConstraintViolation
      // cuando el documento ya existe en la carpeta
      const isNameConflict =
        status === 409 ||
        (status === 500 && errBody?.exception === 'nameConstraintViolation') ||
        (status === 500 &&
          typeof errBody?.message === 'string' &&
          errBody.message.toLowerCase().includes('already exists'));

      if (isNameConflict) {
        try {
          const listRes = await dmsAxios.get(uploadUrl, {
            params: { cmisselector: 'children', succinct: true }
          });
          const existing = (listRes.data?.objects || [])
            .find(o => o.object?.succinctProperties?.['cmis:name'] === file_name);
          const existingObjectId =
            existing?.object?.succinctProperties?.['cmis:objectId'] ?? null;

          console.warn(
            `[DMS] Documento '${file_name}' ya existe (post-conflict), reusando: ${existingObjectId}`
          );

          const inserted = await INSERT.into(TicketDocuments).entries({
            ticket_ID: ticket_id,
            file_name,
            dms_object_id: existingObjectId,
            dms_folder_id: folderId ?? null,
            uploaded_by: user_id ?? 'system'
          });
          return { document_id: inserted.ID ?? null, dms_object_id: existingObjectId };

        } catch (listErr) {
          console.error('[DMS] Error listando carpeta post-conflict:', listErr.message);
          throw new Error(
            `El documento '${file_name}' ya existe en DMS y no se pudo reusar: ${listErr.message}`
          );
        }
      }

      // Cualquier otro error real
      throw new Error(
        `DMS upload falló con status ${status}: ` +
        (errBody?.message || uploadErr.message)
      );
    }

    // ── Éxito — guardar metadata en DB ───────────────────────────────────────
    const dmsObjectId = uploadRes.data?.succinctProperties?.['cmis:objectId'];


    const inserted = await INSERT.into(TicketDocuments).entries({
      ticket_ID: ticket_id,
      file_name,
      dms_object_id: dmsObjectId ?? null,
      dms_folder_id: folderId ?? null,
      uploaded_by: user_id ?? 'system'
    });

    return { document_id: inserted.ID ?? null, dms_object_id: dmsObjectId ?? null };
  });

  // ── Verificar si el documento ya existe en DMS ────────────────────────
  async function _getExistingDMSDocument(dmsAxios, uploadPath, file_name) {
    try {
      const res = await dmsAxios.get(
        `${uploadPath}/${encodeURIComponent(file_name)}`,
        { params: { cmisselector: 'object', succinct: true } }
      );
      return res.data?.succinctProperties?.['cmis:objectId'] ?? null;
    } catch (e) {
      // 404 = no existe, cualquier otro error lo ignoramos
      return null;
    }
  }

  this.on("downloadManualExcel", async (req) => {
    const { rows } = req.data;

    if (!Array.isArray(rows) || !rows.length) {
      return req.error(400, "rows debe ser un array no vacío.");
    }

    const buffer = await generateManualExcel(rows);
    return { value: Buffer.from(buffer).toString("base64") };
  });

  this.on("onApproveTicket", async (req) => {
    const tx = cds.tx(req);

    const ticketId = req.data.ticket_id;
    const approvedBy = req.data.approved_by || req.user?.id || "SYSTEM";
    const comment = req.data.comment || "";

    if (!ticketId) return req.reject(400, "ticket_id es obligatorio");

    const root = await tx.run(
      SELECT.one.from(PrecertTickets).where({ ID: ticketId })
    );

    if (!root) return req.reject(404, "Ticket inexistente");
    if (root.parent_ticket_ID) return req.reject(400, "Solo se puede aprobar el ticket raíz");

    const subs = await tx.run(
      SELECT.from(PrecertTickets).where({ parent_ticket_ID: ticketId })
    );

    const map = new Map(subs.map(s => [s.ID, s]));
    let totalPrice = 0;

    // ── Normalizar items ──────────────────────────────────────────────────────
    let itemsToProcess = subs.map(s => ({ ID: s.ID }));
    if (req.data.items) {
      try {
        const parsed = typeof req.data.items === "string"
          ? JSON.parse(req.data.items)
          : req.data.items;
        if (Array.isArray(parsed) && parsed.length) {
          itemsToProcess = parsed.map(i => typeof i === "string" ? { ID: i } : i);
        }
      } catch (e) {
        console.warn("[WARN] No se pudo parsear items:", e.message);
      }
    }

    // ── Parsear hes_groups → mapa clave "province_ID__po_item" ───────────────
    const hesGroupsMap = {};
    if (req.data.hes_groups) {
      try {
        const parsed = typeof req.data.hes_groups === "string"
          ? JSON.parse(req.data.hes_groups)
          : req.data.hes_groups;

        for (const g of parsed) {
          const key = `${g.province_ID || "NO_PROVINCE"}__${g.po_item || "NO_ITEM"}`;
          hesGroupsMap[key] = {
            date_from: g.date_from || null,
            date_to: g.date_to || null,
            long_text: g.hesText || null
          };
        }
      } catch (e) {
        console.warn("[WARN] No se pudo parsear hes_groups:", e.message);
      }
    }

    // ── Actualizar cantidades ─────────────────────────────────────────────────
    for (const item of itemsToProcess) {
      const existing = map.get(item.ID);
      if (!existing) continue;

      totalPrice += Number(item.total_price ?? existing.total_price ?? 0);

      await tx.run(
        UPDATE(PrecertTickets)
          .set({
            qty_to_certify: item.qty_to_certify ?? existing.qty_to_certify,
            qty_certified: item.qty_certified ?? existing.qty_to_certify,
            total_price: item.total_price ?? existing.total_price
          })
          .where({ ID: item.ID })
      );
    }

    await tx.run(
      UPDATE(PrecertTickets)
        .set({ total_price: totalPrice })
        .where({ ID: ticketId })
    );

    // ── Persistir datos HES en cada subticket ─────────────────────────────────
    const subIds = itemsToProcess.map(i => i.ID).filter(Boolean);

    for (const sub of subs) {
      if (!subIds.includes(sub.ID)) continue;

      const key = `${sub.province_ID || "NO_PROVINCE"}__${sub.po_item || "NO_ITEM"}`;
      const hesData = hesGroupsMap[key];
      if (!hesData) continue;

      await tx.run(
        UPDATE(PrecertTickets)
          .set({
            hes_date_from: hesData.date_from,
            hes_date_to: hesData.date_to,
            hes_long_text: hesData.long_text
          })
          .where({ ID: sub.ID })
      );
    }

    // ── Status → APROBANDO ────────────────────────────────────────────────────
    if (subIds.length) {
      await tx.run(
        UPDATE(WorkflowStatus)
          .set({
            status: "APROBANDO",
            approved_by: approvedBy,
            description: comment || "Iniciando aprobación"
          })
          .where({ precert_ticket_ID: { in: subIds } })
      );
    }

    // ── Re-fetch con datos HES ya persistidos ─────────────────────────────────
    const updatedSubs = await tx.run(
      SELECT.from(PrecertTickets).where({ parent_ticket_ID: ticketId })
    );

    // ── Disparar WF HES ───────────────────────────────────────────────────────
    try {
      await postHesWorkflows(ticketId, root, updatedSubs, subIds);
    } catch (wfErr) {
      console.error(`[onApproveTicket] WF falló para ${ticketId}:`, wfErr.message);

      await tx.run(
        UPDATE(WorkflowStatus)
          .set({
            status: "ERROR_WF",
            description: `Error al iniciar HES workflow: ${wfErr.message}`
          })
          .where({ precert_ticket_ID: { in: subIds } })
      );

      return JSON.stringify({
        success: false,
        ticket_id: ticketId,
        status: "ERROR_WF",
        error: wfErr.message
      });
    }

    return JSON.stringify({ success: true, ticket_id: ticketId, status: "ENVIANDO_HES" });
  });

  this.on("generateManualTicket", async (req) => {
    const tx = cds.tx(req);
    const { currency, items } = req.data;

    if (!currency) return req.error(400, "generateManualTicket: currency es obligatorio");
    if (!items?.length) return req.error(400, "generateManualTicket: items debe ser un array no vacío");

    const { PrecertTickets, WorkflowStatus } = cds.entities("suppliersInitiative");
    const bpId =
      req.user.attr?.bp_id[0]
      ?? req.user.tokenInfo?.getTokenValue?.('customAttribute1')  // ← fallback XSUAA
      ?? null;

    const businessPartner = await tx.run(
      SELECT.one.from(BusinessPartners).where({ business_partner_number: bpId })
    );

    const nTotalAmount = items.reduce((acc, it) =>
      acc + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0
    );
    const nTotalRounded = Math.round(nTotalAmount * 1000) / 1000;

    const ticket_number = await _nextTicketNumber(tx);

    const oParent = {
      source_type: "SO",
      source_number: "",
      business_partner_ID: businessPartner?.ID || "2000003093",
      currency: currency.toUpperCase().trim(),
      total_price: nTotalRounded,
      validator: items[0].validator,
      ticket_number
    };

    const [oInsertedParent] = await INSERT.into(PrecertTickets).entries(oParent);
    const oParentDB = await SELECT.one.from(PrecertTickets).where({ ID: oInsertedParent.ID });
    if (!oParentDB) return req.error(500, "No se pudo recuperar el ticket creado.");

    const aSubTickets = items.map((it) => ({
      source_type: "SO",
      source_number: "",
      business_partner_ID: businessPartner?.ID || "2000003093",
      parent_ticket_ID: oParentDB.ID,
      ticket_number: oParentDB.ticket_number,
      currency: String(it.moneda || currency).toUpperCase().trim(),
      measure_unity: it.unidad || null,
      proveedor_um: it.proveedor_um || null,
      ses_service: null,
      short_text: String(it.service_ID || "").trim(),
      delivery_date: it.delivery_date || null,
      qty_to_certify: Number(it.cantidad) || 0,
      total_price: Math.round((Number(it.precio_unitario) || 0) * 1000) / 1000,
      po_item: Number(it.posicion) || 0,
      po_item_text: String(it.service_ID || "").trim(),
      observations: it.observations || null,
      validator: it.validator || null
    }));

    if (aSubTickets.length) {
      const aInserted = await INSERT.into(PrecertTickets).entries(aSubTickets);

      const aStatuses = (Array.isArray(aInserted) ? aInserted : [aInserted]).map(sub => ({
        precert_ticket_ID: sub.ID,
        status: "PENDIENTE",
        description: "Subticket creado por solicitud manual",
        application_type: "PRECERT_MANUAL"
      }));

      if (aStatuses.length) {
        await INSERT.into(WorkflowStatus).entries(aStatuses);
      }
    }

    sendManualTicketNotification(oParentDB, nTotalRounded, currency, items[0].validator).catch(err =>
      console.error(`[sendSoliSolpedTicketNotification SO] Error para ticket ${oParentDB.ID}:`,
        JSON.stringify(err.response?.data || err.message, null, 2))
    );

    return {
      ticket_number: String(oParentDB.ticket_number),
      ticket_id: oParentDB.ID,               // ← NEW
      total_amount: nTotalRounded,
      status: "PENDIENTE"
    };
  });

  this.on("saveTicketDocument", async (req) => {
    const { ticket_id, file_name, dms_object_id, dms_folder_id } = req.data;

    if (!ticket_id) return req.error(400, "ticket_id es obligatorio.");
    if (!file_name) return req.error(400, "file_name es obligatorio.");

    if (!file_name.toLowerCase().endsWith(".pdf"))
      return req.error(400, "Solo se permiten archivos PDF.");

    const { PrecertTickets, TicketDocuments } = cds.entities("suppliersInitiative");
    const tx = cds.tx(req);

    const ticket = await tx.run(
      SELECT.one.from(PrecertTickets).where({ ID: ticket_id })
    )
    if (!ticket) return req.error(404, `Ticket ${ticket_id} no encontrado.`);

    const inserted = await INSERT.into(TicketDocuments).entries({
      ticket_ID: ticket_id,
      file_name,
      dms_object_id: dms_object_id ?? null,
      dms_folder_id: dms_folder_id ?? null,
      uploaded_by: req.user?.id ?? "system"
    });

    return { document_id: inserted.ID ?? null };
  });

  this.on("generateUploadToken", async (req) => {
    const { ticket_id } = req.data;
    if (!ticket_id) return req.error(400, "ticket_id es obligatorio.");

    const { PrecertTickets } = cds.entities("suppliersInitiative");
    const tx = cds.tx(req);

    const ticket = await tx.run(
      SELECT.one.from(PrecertTickets).where({ ID: ticket_id })
    );
    if (!ticket) return req.error(404, `Ticket ${ticket_id} no encontrado.`);

    // Generar token aleatorio
    const sToken = require("crypto").randomBytes(32).toString("hex");
    _uploadTokens.set(sToken, {
      ticket_id,
      user_id: req.user?.id ?? "system",
      expires: Date.now() + TOKEN_TTL_MS
    });

    // Limpiar tokens expirados
    for (const [k, v] of _uploadTokens.entries()) {
      if (v.expires < Date.now()) _uploadTokens.delete(k);
    }

    return { token: sToken, expires_in: TOKEN_TTL_MS / 1000 };
  });

  this.on('uploadTicketDocument', async (req) => {
    const { ticket_id, file_name, file_content } = req.data;

    if (!ticket_id) return req.error(400, 'ticket_id es obligatorio.');
    if (!file_name) return req.error(400, 'file_name es obligatorio.');
    if (!file_content) return req.error(400, 'file_content es obligatorio.');

    if (!file_name.toLowerCase().endsWith('.pdf'))
      return req.error(400, 'Solo se permiten archivos PDF.');

    if (!REPO_ID)
      return req.error(500, 'DMS_REPOSITORY_ID no está configurado en el entorno.');

    const { PrecertTickets, TicketDocuments } = cds.entities('suppliersInitiative');
    const tx = cds.tx(req);

    const ticket = await tx.run(
      SELECT.one.from(PrecertTickets).where({ ID: ticket_id })
    );
    if (!ticket) return req.error(404, `Ticket ${ticket_id} no encontrado.`);

    const fileBuffer = Buffer.from(file_content, 'base64');
    const ticketFolder = String(ticket.ticket_number);
    const dmsAxios = sapCfAxios('DMSDest');

    // Asegurar /tickets
    await _ensureDMSFolder(dmsAxios, '', TICKETS_ROOT_NAME);

    // Asegurar /tickets/{ticket_number}
    const folderId = await _ensureDMSFolder(
      dmsAxios,
      `/${TICKETS_ROOT_NAME}`,
      ticketFolder
    );

    // Subir el PDF
    const fd = new FormData();
    fd.append('cmisaction', 'createDocument');
    fd.append('propertyId[0]', 'cmis:name');
    fd.append('propertyValue[0]', file_name);
    fd.append('propertyId[1]', 'cmis:objectTypeId');
    fd.append('propertyValue[1]', 'cmis:document');
    fd.append('versioningState', 'none');
    fd.append('succinct', 'true');
    fd.append('content', fileBuffer, {
      filename: file_name,
      contentType: 'application/pdf'
    });

    const uploadRes = await dmsAxios.post(
      `/browser/${REPO_ID}/root/${TICKETS_ROOT_NAME}/${encodeURIComponent(ticketFolder)}`,
      fd,
      { headers: fd.getHeaders() }
    );

    const dmsObjectId = uploadRes.data.succinctProperties?.['cmis:objectId'];

    // Guardar metadata en DB
    const inserted = await INSERT.into(TicketDocuments).entries({
      ticket_ID: ticket_id,
      file_name,
      dms_object_id: dmsObjectId ?? null,
      dms_folder_id: folderId ?? null,
      uploaded_by: req.user?.id ?? 'system'
    });

    return {
      document_id: inserted.ID,
      dms_object_id: dmsObjectId ?? null
    };
  });
  this.on("downloadApprovalManualExcel", async (req) => {
    const { header, rows } = req.data;

    if (!Array.isArray(rows) || !rows.length) {
      return req.error(400, "rows debe ser un array no vacío.");
    }

    const [aUnits, aServices, aPurchGroups, aPlants, aMatGroups] = await Promise.all([
      SELECT.from("MeasureUnits"),
      SELECT.from("Services"),
      SELECT.from("PurchGroup"),
      SELECT.from("Plants"),
      SELECT.from("MaterialGroup")
    ]);

    const buffer = await generateApprovalManualExcel(
      header || {},
      rows,
      aUnits,
      aPurchGroups,
      aPlants,
      aMatGroups
    );
    return { value: Buffer.from(buffer).toString("base64") };
  });
  // ── Wizard Aprobaci/*  */ón Manual ──────────────────────────────────────────────
  this.on("downloadMAWizardExcel", async (req) => {
    const { header, lines, purchGroups, plants, matGroups } = req.data;
    const buffer = await generateMAWizardExcel(
      header || {},
      lines || [],
      purchGroups || [],
      plants || [],
      matGroups || []
    );
    return buffer.toString("base64");
  });
  this.on("saveApprovalManual", async (req) => {
    const { ticket_id, header, lines, positionGroups } = req.data;
    let bpNumber
    const sShortText = header?.ShortText || "";
    const sWorkflow = header?.text_workflow_solped || "";
    const sZCRIT = header?.ZCRIT || "";


    if (!ticket_id) return req.error(400, "ticket_id es obligatorio");
    if (!lines?.length) return req.error(400, "lines no puede estar vacío");

    const bHasAprobado = (positionGroups?.length > 0) &&
      lines.some(l => l.currentStatus === "APROBADO");

    const tx = cds.tx(req);

    const root = await tx.run(
      SELECT.one.from(PrecertTickets).where({ ID: ticket_id })
    );
    const rootBP = await tx.run(
      SELECT.one.from(BusinessPartners).where({ ID: root.business_partner_ID })
    );
    const sFixedVendor = rootBP?.business_partner_number || ""
    if (!root) return req.error(404, "Ticket inexistente");

    // Mapa positionGroups por po_item para lookup rápido
    const oPosDataMap = {};
    (positionGroups || []).forEach(pg => {
      oPosDataMap[String(pg.po_item).trim()] = pg;
    });

    // ── Persistir cada línea ──────────────────────────────────────────
    for (const line of lines) {
      const sPo = String(line.EXTROW || "").trim();
      const oPD = oPosDataMap[sPo] || {};

      const oImputacion = {
        purchasing_group: oPD.EKGRP || null,
        plant: oPD.WERKS || null,
        material_group: oPD.MATKL || null,
        delivery_date: oPD.delivery_date || null,
        criticality: sZCRIT || null,
        // Estos vienen de cada línea — el cambio central
        account_assignment_number: line.KNTTP || null,
        project_network: line.KNTTP === "N" ? (line.NPLNR || null) : null,
        activity: line.KNTTP === "N" ? (line.ACTIVITY || null) : null,
        cost_center: line.KNTTP === "K" ? (line.KOSTL || null) : null,
        order: line.KNTTP === "F" ? (line.AUFNR || null) : null,
        wbs_element: line.KNTTP === "P" ? (line.PSPNR || null) : null,
      };

      if (line.subticket_id) {
        await tx.run(
          UPDATE(PrecertTickets)
            .set({
              po_item: parseInt(line.EXTROW) || null,
              ses_service: line.SRVPOS || null,
              short_text: line.KTEXT1 || "",
              qty_to_certify: parseFloat(line.MENGE) || null,
              total_price: parseFloat(line.PREIS) || null,
              currency: line.WAERS || null,
              measure_unity: line.MEINS || null,
              validator: line.validator || null,
              text_workflow_solped: sWorkflow,
              criticality: sZCRIT,
              ...oImputacion
            })
            .where({ ID: line.subticket_id })
        );

        if (line.currentStatus) {
          const oStatus = await tx.run(
            SELECT.one.from(WorkflowStatus)
              .where({ precert_ticket_ID: line.subticket_id })
              .orderBy("createdAt desc")
          );

          if (oStatus) {
            await tx.run(
              UPDATE(WorkflowStatus)
                .set({ status: line.currentStatus })
                .where({ ID: oStatus.ID })
            );
          } else {
            // ← subticket sin WorkflowStatus todavía → crear
            await tx.run(
              INSERT.into(WorkflowStatus).entries({
                precert_ticket_ID: line.subticket_id,
                status: line.currentStatus,
                description: "Estado inicial asignado en aprobación manual",
                application_type: "Solicitud_SOLPED"
              })
            );
          }
        }

      } else {
        const oNew = {
          parent_ticket_ID: ticket_id,
          ticket_number: root.ticket_number,
          business_partner_ID: root.business_partner_ID,
          source_type: root.source_type || "SO",
          source_number: root.source_number || "",
          currency: line.WAERS || root.currency || "ARS",
          measure_unity: line.MEINS || null,
          po_item: parseInt(line.EXTROW) || null,
          ses_service: line.SRVPOS || null,
          short_text: line.KTEXT1 || sShortText || "",
          qty_to_certify: parseFloat(line.MENGE) || 0,
          total_price: parseFloat(line.PREIS) || 0,
          validator: line.validator || null,
          text_workflow_solped: sWorkflow,
          criticality: sZCRIT,
          ...oImputacion
        };
        const [oInserted] = await INSERT.into(PrecertTickets).entries(oNew);

        await INSERT.into(WorkflowStatus).entries({
          precert_ticket_ID: oInserted.ID,
          status: line.currentStatus || "PENDIENTE",
          description: "Línea creada por split",
          application_type: "Solicitud_SOLPED"
        });

        line.subticket_id = oInserted.ID;
      }
    }

    const nTotal = lines.reduce(
      (acc, l) => acc + (parseFloat(l.MENGE) || 0) * (parseFloat(l.PREIS) || 0), 0
    );
    await tx.run(
      UPDATE(PrecertTickets)
        .set({ total_price: Math.round(nTotal * 100) / 100, short_text: sShortText, text_workflow_solped: sWorkflow })
        .where({ ID: ticket_id })
    );

    if (!bHasAprobado) {
      return JSON.stringify({ success: true, ticket_id, bpa: false });
    }

    // ── Agrupar líneas aprobadas por po_item ──────────────────────────
    const oLinesByPo = {};
    lines
      .filter(l => l.currentStatus === "APROBADO")
      .forEach(l => {
        const sPo = String(l.EXTROW || "").trim();
        if (!oLinesByPo[sPo]) oLinesByPo[sPo] = [];
        oLinesByPo[sPo].push(l);
      });

    const to_pritems = [];
    const to_prservices = [];
    const to_praccass = [];

    Object.entries(oLinesByPo).forEach(([sPo, aLines]) => {
      const oPD = oPosDataMap[sPo] || {};
      const sUnit = aLines.find(l => l.MEINS)?.MEINS || "UN";

      to_pritems.push({
        PRItem: sPo,
        PurGroup: oPD.EKGRP || "",
        ShortText: sShortText,
        WorkflowJustificationTextB02: sWorkflow || "",
        Plant: oPD.WERKS || "",
        MaterialGroup: "0" + (oPD.MATKL || ""),
        Quantity: String(aLines.reduce((s, l) => s + (parseFloat(l.MENGE) || 0), 0)),
        Unit: sUnit,
        ItemCat: "9",
        AcctAssCat: oPD.KNTTP || "",
        FixedVendor: sFixedVendor,
        PurchOrg: oPD.EKORG || "",
        DeliveryDate: oPD.delivery_date
          ? `/Date(${new Date(oPD.delivery_date).getTime()})/`
          : null,
        Criticidad: sZCRIT || ""
      });

      aLines.forEach((l, idx) => {
        to_prservices.push({
          PRItem: sPo,
          ExtRow: String((idx + 1) * 10),
          Service: l.SRVPOS || "",
          Quantity: l.MENGE || "",
          GrossPrice: l.PREIS || "",
          Currency: l.WAERS || ""
        });
      });

      aLines.forEach((l, idx) => {
        to_praccass.push({
          PRItem: sPo,
          ExtRow: String((idx + 1) * 10),   // ← nuevo
          Network: l.KNTTP === "N" ? (l.NPLNR || "") : "",
          Activity: l.KNTTP === "N" ? (l.ACTIVITY || "") : "",
          WBSElement: l.KNTTP === "P" ? (l.PSPNR || "") : "",
          Order: l.KNTTP === "F" ? (l.AUFNR || "") : "",
          CostCenter: l.KNTTP === "K" ? (l.KOSTL || "") : ""
        });
      });
    });

    const FLP_BASE_URL = process.env.FLP_BASE_URL;
    const ticketUrl = `${FLP_BASE_URL}#ticketlist-display?sap-ui-app-id-hint=saas_approuter_vistaticketlist&/ticket/${ticket_id}`;
    const APPROVER = "tobias.racedo@datco.net";

    const bpaPayload = {
      definitionId: process.env.SOLOSOLPED_WORKFLOW_DEFINITION_ID,//"br10.acap-dev-qas-cliou2p9.contralanada.workflowprecert",
      context: {
        input: {
          ticket_ID: ticket_id,
          app_link: ticketUrl,
          approvers: { acap_approvers: [APPROVER] },
          acap_approval: { approved: true, user: "", date: "" },
          is_updated_ticket: false
        },
        log: { ticket_ID: ticket_id, status: "", comments: "" },
        mail: {
          message: {
            subject: `Aprobación SolPed — Ticket #${root.ticket_number}`,
            body: { contentType: "html", content: "" },
            toRecipients: [{ emailAddress: { address: APPROVER } }]
          },
          saveToSentItems: false
        },
        solped: [{ PRType: "ZNB", to_pritems, to_prservices, to_praccass }]
      }
    };

    try {
      const axios = sapCfAxios("SBPA");
      const response = await axios({
        method: "POST",
        url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.SOLPED_WORKFLOW_ENV}`,
        headers: {
          "irpa-api-key": process.env.SOLOSOLPED_IRPA_API_KEY,
          "Content-Type": "application/json"
        },
        data: bpaPayload
      });

      const instanceId = response.data?.id;

      const aApprovedIds = lines
        .filter(l => l.currentStatus === "APROBADO" && l.subticket_id)
        .map(l => l.subticket_id);

      for (const sSubId of aApprovedIds) {
        const oStatus = await tx.run(
          SELECT.one.from(WorkflowStatus)
            .where({ precert_ticket_ID: sSubId })
            .orderBy("createdAt desc")
        );
        if (oStatus) {
          await tx.run(
            UPDATE(WorkflowStatus)
              .set({
                status: "ENVIANDO_SOLPED",
                workflow_instance_id: instanceId || null,
                description: `WF SolPed iniciado: ${instanceId}`
              })
              .where({ ID: oStatus.ID })
          );
        }
      }
      return JSON.stringify({ success: true, ticket_id, instanceId, bpa: true });

    } catch (err) {
      console.error("[saveApprovalManual] Error BPA:", err.response?.data || err.message);

      for (const sSubId of aApprovedIds) {
        const oStatus = await tx.run(
          SELECT.one.from(WorkflowStatus)
            .where({ precert_ticket_ID: sSubId })
            .orderBy("createdAt desc")
        );
        if (oStatus) {
          await tx.run(
            UPDATE(WorkflowStatus)
              .set({ status: "ERROR_WF", description: `Error SolPed: ${err.message}` })
              .where({ ID: oStatus.ID })
          );
        }
      }

      return req.error(500, `Error al iniciar workflow: ${err.message}`);
    }
  });


  this.on("sendSolped", async (req) => {
    const { ticket_id, BSART, lines, positionGroups, approved_by, comment } = req.data;

    if (!ticket_id) return req.error(400, "ticket_id es obligatorio");
    if (!lines?.length) return req.error(400, "lines no puede estar vacío");

    const tx = cds.tx(req);
    const root = await tx.run(SELECT.one.from(PrecertTickets).where({ ID: ticket_id }));
    if (!root) return req.error(404, "Ticket inexistente");
    if (root.parent_ticket_ID) return req.error(400, "Solo se puede aprobar el ticket raíz");

    const rootBP = await tx.run(
      SELECT.one.from(BusinessPartners).where({ ID: root.business_partner_ID })
    );
    const sFixedVendor = rootBP?.business_partner_number || "";
    const approvedBy = approved_by || req.user?.id || "SYSTEM";

    const subs = await tx.run(
      SELECT.from(PrecertTickets).where({ parent_ticket_ID: ticket_id })
    );
    const map = new Map(subs.map(s => [s.ID, s]));

    // ── Normalizar items ──────────────────────────────────────────
    let itemsToProcess = subs.map(s => ({ ID: s.ID }));
    if (req.data.items) {
      try {
        const parsed = typeof req.data.items === "string"
          ? JSON.parse(req.data.items)
          : req.data.items;
        if (Array.isArray(parsed) && parsed.length) {
          itemsToProcess = parsed.map(i => typeof i === "string" ? { ID: i } : i);
        }
      } catch (e) {
        console.warn("[sendSolped] No se pudo parsear items:", e.message);
      }
    }

    // ── Parsear hes_groups ────────────────────────────────────────
    const hesGroupsMap = {};
    if (req.data.hes_groups) {
      try {
        const parsed = typeof req.data.hes_groups === "string"
          ? JSON.parse(req.data.hes_groups)
          : req.data.hes_groups;
        for (const g of parsed) {
          const key = root.source_type === "PC"
            ? [
              String(g.po_item || ""),
              String(g.province_ID || "NO_PROVINCE"),
              g.KNTTP || "",
              g.MATKL || "",
              g.WERKS || "",
              g.EKGRP || ""
            ].join("||")
            : `${g.province_ID || "NO_PROVINCE"}__${g.po_item || "NO_ITEM"}`;

          hesGroupsMap[key] = {
            date_from: g.date_from || null,
            date_to: g.date_to || null,
            long_text: g.hesText || null,
            KNTTP: g.KNTTP || "",
            KOSTL: g.KOSTL || "",
            NPLNR: g.NPLNR || "",
            ACTIVITY: g.ACTIVITY || "",
            AUFNR: g.AUFNR || "",
            PSPNR: g.PSPNR || "",
            MATKL: g.MATKL || "",
            WERKS: g.WERKS || "",
            EKGRP: g.EKGRP || ""
          };
        }
      } catch (e) {
        console.warn("[sendSolped] No se pudo parsear hes_groups:", e.message);
      }
    }

    // ── Actualizar cantidades ─────────────────────────────────────
    let totalPrice = 0;
    for (const item of itemsToProcess) {
      const existing = map.get(item.ID);
      if (!existing) continue;
      totalPrice += Number(item.total_price ?? existing.total_price ?? 0);
      await tx.run(
        UPDATE(PrecertTickets)
          .set({
            qty_to_certify: item.qty_to_certify ?? existing.qty_to_certify,
            qty_certified: item.qty_certified ?? existing.qty_to_certify,
            total_price: item.total_price ?? existing.total_price
          })
          .where({ ID: item.ID })
      );
    }
    await tx.run(
      UPDATE(PrecertTickets).set({ total_price: totalPrice }).where({ ID: ticket_id })
    );

    // ── Persistir datos HES en cada subticket ─────────────────────
    const subIds = itemsToProcess.map(i => i.ID).filter(Boolean);
    for (const sub of subs) {
      if (!subIds.includes(sub.ID)) continue;
      const key = `${sub.province_ID || "NO_PROVINCE"}__${sub.po_item || "NO_ITEM"}`;
      const hesData = hesGroupsMap[key];
      if (!hesData) continue;
      await tx.run(
        UPDATE(PrecertTickets)
          .set({
            hes_date_from: hesData.date_from,
            hes_date_to: hesData.date_to,
            hes_long_text: hesData.long_text
          })
          .where({ ID: sub.ID })
      );
    }

    // ── Asegurar WorkflowStatus para splits PC ────────────────────
    if (subIds.length) {
      for (const subId of subIds) {
        const existing = await tx.run(
          SELECT.one.from(WorkflowStatus).where({ precert_ticket_ID: subId })
        );
        if (!existing) {
          console.warn(`[sendSolped] WorkflowStatus ausente para subticket ${subId}, creando...`);
          await tx.run(
            INSERT.into(WorkflowStatus).entries({
              precert_ticket_ID: subId,
              status: "PENDIENTE",
              description: "Auto-creado para posición split PC",
              application_type: "Solicitud_SOLPED"
            })
          );
        }
      }
    }

    if (subIds.length) {
      await tx.run(
        UPDATE(WorkflowStatus)
          .set({
            status: "APROBANDO",
            approved_by: approvedBy,
            description: comment || "Iniciando aprobación SOLPED"
          })
          .where({ precert_ticket_ID: { in: subIds } })
      );
    }

    // ── Re-fetch con datos HES ya persistidos ─────────────────────
    const updatedSubs = await tx.run(
      SELECT.from(PrecertTickets).where({ parent_ticket_ID: ticket_id })
    );

    // ── Provincias para HES ───────────────────────────────────────
    const provinceIds = [...new Set(updatedSubs.map(s => s.province_ID).filter(Boolean))];
    const provinceRows = provinceIds.length
      ? await tx.run(SELECT.from(Provinces).columns("ID", "s4_code", "description").where({ ID: { in: provinceIds } }))
      : [];
    const provinceS4Code = {};
    for (const p of provinceRows) {
      provinceS4Code[p.ID] = `${p.s4_code || ""} ${(p.description || "").trim()}`.trim();
    }

    const activeSubs = subIds.length ? updatedSubs.filter(s => subIds.includes(s.ID)) : updatedSubs;

    const subsGroupedByKey = {};
    for (const sub of activeSubs) {
      const groupKey = `${sub.province_ID || "NO_PROVINCE"}__${sub.po_item || "NO_ITEM"}`;
      if (!subsGroupedByKey[groupKey]) subsGroupedByKey[groupKey] = [];
      subsGroupedByKey[groupKey].push(sub);
    }

    // ── 1. resolvedPositionGroups — SIEMPRE PRIMERO ───────────────
    let resolvedPositionGroups = positionGroups;
    if (root.source_type === "PC") {

      const frontendPgMap = {};
      (positionGroups || []).forEach(pg => { frontendPgMap[String(pg.po_item)] = pg; });

      const posGroupsByPoItem = {};
      for (const sub of activeSubs) {
        const poItem = String(sub.po_item || "");
        if (!poItem || posGroupsByPoItem[poItem]) continue;
        const fg = frontendPgMap[poItem] || {};
        posGroupsByPoItem[poItem] = {
          po_item: poItem,
          po_item_original: fg.po_item_original || poItem,
          ShortText: fg.ShortText || sub.ses_short_text || sub.ses_subservice || "",
          EKGRP: fg.EKGRP || sub.purchasing_group || "",
          WERKS: fg.WERKS || sub.plant || "",
          MATKL: fg.MATKL || sub.material_group || "",
          EKORG: fg.EKORG || sub.purchasing_org || "",
          KNTTP: fg.KNTTP || sub.account_assignment_cat || "",
          PSPNR: fg.PSPNR || sub.wbs_element || "",
          NPLNR: fg.NPLNR || sub.project_network || "",
          KOSTL: fg.KOSTL || sub.cost_center || "",
          AUFNR: fg.AUFNR || sub.order || "",
          ACTIVITY: fg.ACTIVITY || sub.activity || "",
          ZCRIT: fg.ZCRIT || sub.criticality || "",
          delivery_date: fg.delivery_date || sub.delivery_date || "",
          text_workflow_solped: fg.text_workflow_solped || sub.text_workflow_solped || ""
        };
      }

      for (const [poItem, fg] of Object.entries(frontendPgMap)) {
        if (posGroupsByPoItem[poItem]) continue;
        posGroupsByPoItem[poItem] = {
          po_item: poItem,
          po_item_original: fg.po_item_original || poItem,
          ShortText: fg.ShortText || "",
          EKGRP: fg.EKGRP || "",
          WERKS: fg.WERKS || "",
          MATKL: fg.MATKL || "",
          EKORG: fg.EKORG || "",
          KNTTP: fg.KNTTP || "",
          PSPNR: fg.PSPNR || "",
          NPLNR: fg.NPLNR || "",
          KOSTL: fg.KOSTL || "",
          AUFNR: fg.AUFNR || "",
          ACTIVITY: fg.ACTIVITY || "",
          ZCRIT: fg.ZCRIT || "",
          delivery_date: fg.delivery_date || "",
          text_workflow_solped: fg.text_workflow_solped || ""
        };
      }
      resolvedPositionGroups = Object.values(posGroupsByPoItem);
    }

    if (root.source_type === "PC") {
      const oLinesByPrItem = {};
      (lines || [])
        .filter(l => l.currentStatus === "APROBADO" && l.subticket_id)
        .forEach(l => {
          const sPRItem = String(l.pr_item || "").trim();
          if (!sPRItem) return;
          if (!oLinesByPrItem[sPRItem]) oLinesByPrItem[sPRItem] = [];
          oLinesByPrItem[sPRItem].push(l.subticket_id);
        });

      for (const [sPRItem, aSubticketIds] of Object.entries(oLinesByPrItem)) {
        await tx.run(
          UPDATE(PrecertTickets)
            .set({ pr_item: sPRItem })
            .where({ ID: { in: aSubticketIds } })
        );
      }
    }

    // ── 2. hesPayload — usa resolvedPositionGroups ────────────────
    let hesPayload;
    if (root.source_type === "PC" && Object.keys(hesGroupsMap).length > 0) {
      const pcProvinceIds = [...new Set(activeSubs.map(s => s.province_ID).filter(Boolean))];
      const pcProvinceRows = pcProvinceIds.length
        ? await tx.run(SELECT.from(Provinces).columns("ID", "s4_code", "description").where({ ID: { in: pcProvinceIds } }))
        : [];
      const pcProvinceS4Code = {};
      for (const p of pcProvinceRows) {
        pcProvinceS4Code[p.ID] = `${p.s4_code || ""} ${(p.description || "").trim()}`.trim();
      }

      hesPayload = Object.entries(hesGroupsMap).map(([sKey, hesData]) => {
        const sParts = sKey.split("||");
        const sPoItem = sParts[0] || "";
        const sProvinceId = sParts[1] === "NO_PROVINCE" ? "" : (sParts[1] || "");
        const sKNTTP = sParts[2] || "";
        const sMATKL = sParts[3] || "";
        const sWERKS = sParts[4] || "";
        const sEKGRP = sParts[5] || "";

        // Buscar el PRItem de la SolPed que corresponde a esta HES
        const oMatchingPosGroup = resolvedPositionGroups.find(pg =>
          String(pg.po_item_original || "") === sPoItem &&
          (pg.KNTTP || "") === sKNTTP &&
          (pg.WERKS || "") === sWERKS &&
          (pg.MATKL || "") === sMATKL &&
          (pg.EKGRP || "") === sEKGRP
        );
        const sPRItem = oMatchingPosGroup?.po_item || sPoItem;

        // Subtickets: los que el frontend asignó a este PRItem
        const subticketIdsForPRItem = (lines || [])
          .filter(l => String(l.pr_item || "") === sPRItem)
          .map(l => l.subticket_id)
          .filter(Boolean);

        // Lista ordenada de aprobados para este PRItem — mismo orden que usa
        // _buildSolpedPCPayload para asignar ExtRow (10, 20, 30...).
        // Usar el índice global evita que cada grupo-provincia reinicie en 0.
        const approvedSubIdsForPRItem = (lines || [])
          .filter(l => String(l.pr_item || "") === sPRItem && l.currentStatus === "APROBADO")
          .map(l => l.subticket_id)
          .filter(Boolean);

        const subsForGroup = activeSubs.filter(s =>
          subticketIdsForPRItem.includes(s.ID) &&
          (sProvinceId === "" || (s.province_ID || "") === sProvinceId)
        );

        const firstSub = subsForGroup[0];
        const location = sProvinceId ? (pcProvinceS4Code[sProvinceId] || "") : "";
        const sPersonInt = firstSub?.purchasing_group || sEKGRP || "";

        return {
          PONumber: root.source_number || "",
          POItem: sPRItem,
          ShortText: `SES - ${root.source_number || root.ticket_number}`,
          PackageNo: "1",
          BeginDate: hesData.date_from ? `/Date(${new Date(hesData.date_from).getTime()})/` : "",
          EndDate: hesData.date_to ? `/Date(${new Date(hesData.date_to).getTime()})/` : "",
          LongText: hesData.long_text || "",
          Location: location,
          PersonInt: sPersonInt,
          ZZ_FISCA_EMAIL: root.validator || firstSub?.validator || "",
          to_service: subsForGroup.map((sub, idx) => {
            const globalIdx = approvedSubIdsForPRItem.indexOf(sub.ID);
            const externalLine = String(((globalIdx >= 0 ? globalIdx : idx) + 1) * 10);
            return {
              Quantity: String(Number(sub.qty_to_certify || 0).toFixed(3)),
              ShortText: sub.ses_subservice || sub.short_text || "",
              ExternalLine: externalLine
            };
          })
        };
      });
    } else {
      hesPayload = _buildHesPayload(root, subsGroupedByKey, provinceS4Code);
    }

    // ── 3. solpedPayload y disparo WF ─────────────────────────────
    try {


      const solpedPayload = root.source_type === "PC"
        ? _buildSolpedPCPayload(resolvedPositionGroups, lines, root.source_number, activeSubs, sFixedVendor)
        : _buildSolpedPayload(positionGroups, lines, { BSART });


      const instanceId = await _sendSolpedWorkflow(ticket_id, root, solpedPayload, hesPayload, subIds, tx);
      return JSON.stringify({ success: true, ticket_id, instanceId, status: "ENVIANDO_SOLPED" });

    } catch (err) {
      console.error("[sendSolped] Error BPA:", JSON.stringify(err.response?.data, null, 2) || err.message);
      await tx.run(
        UPDATE(WorkflowStatus)
          .set({ status: "ERROR_WF", description: `Error SolPed: ${err.message}` })
          .where({ precert_ticket_ID: { in: subIds.length ? subIds : [ticket_id] } })
      );
      return req.error(500, `Error al iniciar workflow SolPed: ${err.message}`);
    }
  });

  this.on("downloadPurchaseContractExcel", async (req) => {
    const { lines, positionGroups, purchGroups, plants } = req.data;   // ← plants
    if (!lines || lines.length === 0) {
      req.error(400, "No se recibieron filas para exportar.");
      return;
    }
    try {
      const buffer = await generatePurchaseContractExcel({ lines, positionGroups, purchGroups, plants });
      return Buffer.from(buffer).toString("base64");
    } catch (err) {
      req.error(500, `Error al generar el Excel: ${err.message}`);
    }
  });


  this.on("getPurchaseOrderAccountAssignment", async (req) => {
    try {
      const s4Purchase = await getS4Service("OP_API_PURCHASEORDER_PROCESS_SRV_0001");

      const { PurchaseOrder, PurchaseOrderItem } = req.data;

      if (!PurchaseOrder || !PurchaseOrderItem) {
        return req.reject(400, "PurchaseOrder y PurchaseOrderItem son obligatorios");
      }

      const poPadded = String(PurchaseOrder).padStart(10, "0");
      const itemPadded = String(PurchaseOrderItem).padStart(5, "0");

      const result = await s4Purchase.run(
        SELECT.from("A_PurOrdAccountAssignment")
          .columns("PurchaseOrder", "PurchaseOrderItem", "AccountAssignmentNumber",
            "GLAccount", "CostCenter", "ProjectNetwork", "OrderID")
          .where({ PurchaseOrder: poPadded, PurchaseOrderItem: itemPadded })
      );

      return Array.isArray(result) ? result : [result].filter(Boolean);

    } catch (err) {
      console.error("Error en getPurchaseOrderAccountAssignment:", err);
      return req.reject(500, "Error al leer imputación contable");
    }
  });

  this.on("getPurchaseOrderExpanded", async (req) => {
    try {
      const s4Purchase = await getS4Service("OP_API_PURCHASEORDER_PROCESS_SRV_0001");

      const { PurchaseOrder } = req.data;

      if (!PurchaseOrder) {
        return req.reject(400, "PurchaseOrder es obligatorio");
      }

      const poPadded = String(PurchaseOrder).padStart(10, "0");

      const result = await s4Purchase.get(
        `/A_PurchaseOrder('${poPadded}')?$expand=to_PurchaseOrderNote,to_PurchaseOrderItem,to_PurchaseOrderItem/to_AccountAssignment,to_PurchaseOrderItem/to_PurchaseOrderItemNote,to_PurchaseOrderItem/to_PurchaseOrderPricingElement,to_PurchaseOrderItem/to_ScheduleLine,to_PurchaseOrderItem/to_ScheduleLine/to_SubcontractingComponent`
      );

      if (!result) {
        return req.reject(404, `Purchase Order ${poPadded} no encontrada`);
      }

      return result;

    } catch (err) {
      console.error("Error en getPurchaseOrderExpanded:", err);
      return req.reject(500, "Error al leer Purchase Order con expand");
    }
  });
  // TODO: los nombres de entity set (A_ServiceEntrySheet / A_ServiceEntrySheetItem) y de
  // campos siguen la convención estándar documentada en API_SERVICE_ENTRY_SHEET_SRV, pero no
  // fueron validados todavía contra el sistema real. Probar con una HES real (ej. HES 8) antes
  // de usar en producción.
  this.on("getHESExpanded", async (req) => {
    const { ServiceEntrySheet } = req.data;

    if (!ServiceEntrySheet) {
      return req.reject(400, "ServiceEntrySheet es obligatorio");
    }

    const sesPadded = String(ServiceEntrySheet).padStart(10, "0");

    try {
      const s4Ses = await getS4Service("API_SERVICE_ENTRY_SHEET_SRV");

      const [header, itemsResult] = await Promise.all([
        s4Ses.get(`/A_ServiceEntrySheet('${sesPadded}')`),
        s4Ses.get(`/A_ServiceEntrySheetItem?$filter=ServiceEntrySheet eq '${sesPadded}'`)
      ]);

      if (!header) {
        return req.reject(404, `HES ${sesPadded} no encontrada`);
      }

      const items = Array.isArray(itemsResult) ? itemsResult : (itemsResult?.value ?? [itemsResult].filter(Boolean));

      return { ...header, to_ServiceEntrySheetItem: items };

    } catch (err) {
      const status = err.response?.status;
      console.error("Error en getHESExpanded:", err.response?.data || err.message);

      if (status === 404) return req.reject(404, `HES ${sesPadded} no encontrada en S4`);
      return req.reject(500, "Error al leer la HES");
    }
  });

  // TODO: los nombres de entity set (A_PurchaseRequisition / A_PurchaseRequisitionItem) y de
  // campos siguen la convención estándar documentada en API_PURCHASEREQ_PROCESS_SRV, pero no
  // fueron validados todavía contra el sistema real. Probar con una SOLPED real (ej. 2607)
  // antes de usar en producción.
  this.on("getPurchaseRequisitionExpanded", async (req) => {
    const { PurchaseRequisition } = req.data;

    if (!PurchaseRequisition) {
      return req.reject(400, "PurchaseRequisition es obligatorio");
    }

    const prPadded = String(PurchaseRequisition).padStart(10, "0");

    try {
      const s4Pr = await getS4Service("API_PURCHASEREQ_PROCESS_SRV");

      const [header, itemsResult] = await Promise.all([
        s4Pr.get(`/A_PurchaseRequisition('${prPadded}')`),
        s4Pr.get(`/A_PurchaseRequisitionItem?$filter=PurchaseRequisition eq '${prPadded}'`)
      ]);

      if (!header) {
        return req.reject(404, `Purchase Requisition ${prPadded} no encontrada`);
      }

      const items = Array.isArray(itemsResult) ? itemsResult : (itemsResult?.value ?? [itemsResult].filter(Boolean));

      return { ...header, to_PurchaseRequisitionItem: items };

    } catch (err) {
      const status = err.response?.status;
      console.error("Error en getPurchaseRequisitionExpanded:", err.response?.data || err.message);

      if (status === 404) return req.reject(404, `Purchase Requisition ${prPadded} no encontrada en S4`);
      return req.reject(500, "Error al leer la Purchase Requisition");
    }
  });

  // DEBUG temporal: lista los entity sets reales de un servicio OData v2 estándar en S4
  // (ej. servicePath='API_PURCHASEREQ_PROCESS_SRV' o 'API_SERVICE_ENTRY_SHEET_SRV'),
  // leyendo su $metadata. Sirve para confirmar los nombres reales cuando difieren
  // de la convención estándar documentada en api.sap.com.
  this.on("debugEntitySets", async (req) => {
    const { servicePath } = req.data;

    if (!servicePath) {
      return req.reject(400, "servicePath es obligatorio");
    }

    try {
      const axios = sapCfAxios("S4HANA");

      const response = await axios({
        method: "GET",
        url: `/sap/opu/odata/sap/${servicePath}/$metadata`,
        responseType: "text",
        headers: { Accept: "application/xml" }
      });

      const xml = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
      const entitySets = [...xml.matchAll(/<EntitySet Name="([^"]+)"/g)].map(m => m[1]);

      return entitySets;

    } catch (err) {
      const status = err.response?.status;
      console.error(`Error en debugEntitySets para ${servicePath}:`, err.response?.data || err.message);
      return req.reject(status || 500, `Error al leer metadata de ${servicePath}: ${err.message}`);
    }
  });

  this.on("getPurchaseContractAccountAssignment", async (req) => {
    try {
      const s4Contract = await getS4Service("OP_API_PURCHASECONTRACT_PROCESS_SRV_0002");

      const { PurchaseContract, PurchaseContractItem } = req.data;

      if (!PurchaseContract || !PurchaseContractItem) {
        return req.reject(400, "PurchaseContract y PurchaseContractItem son obligatorios");
      }

      const pcPadded = String(PurchaseContract).padStart(10, "0");
      const itemPadded = String(PurchaseContractItem).padStart(5, "0");

      const result = await s4Contract.run(
        SELECT.from("A_PurCtrAccount")
          .columns("PurchaseContract", "PurchaseContractItem", "AccountAssignment",
            "GLAccount", "CostCenter", "ProjectNetwork", "OrderID")
          .where({ PurchaseContract: pcPadded, PurchaseContractItem: itemPadded })
      );

      const rows = Array.isArray(result) ? result : [result].filter(Boolean);
      return rows.map(r => ({ ...r, AccountAssignmentNumber: r.AccountAssignment }));

    } catch (err) {
      console.error("Error en getPurchaseContractAccountAssignment:", err);
      return req.reject(500, "Error al leer imputación contable del contrato");
    }
  });

  this.on("downloadSubTicketExcel", async (req) => {
    const { rows } = req.data;

    if (!rows || rows.length === 0) {
      req.error(400, "No se recibieron filas para exportar.");
      return;
    }

    try {
      const buffer = await generateSubTicketExcel(rows);
      return buffer.toString("base64");
    } catch (err) {
      req.error(500, `Error al generar el Excel: ${err.message}`);
    }
  });

  this.on("downloadPrecertExcel", async (req) => {
    const { rows } = req.data;

    if (!rows?.length) {
      req.error(400, "No se recibieron filas.");
      return;
    }

    try {
      const buffer = await generatePrecertExcel(rows);
      return buffer.toString("base64");
    } catch (err) {
      req.error(500, `Error al generar el Excel: ${err.message}`);
    }
  });


  this.on("downloadProvisionTickets", async (req) => {
    try {
      // 1. IDs de tickets pendientes
      const precerts = await SELECT
        .from(WorkflowStatus)
        .columns('precert_ticket_ID', 'business_partner_ID')
        .where({ application_type: 'PRECERT', status: "PENDIENTE" });
      const bp = await SELECT.one
        .from(BusinessPartners)
        .where({ ID: precerts[0].business_partner_ID });

      const ticketIds = precerts.map(p => p.precert_ticket_ID);

      if (ticketIds.length === 0) return req.error(404, 'No hay tickets pendientes');

      // 2. Traer los tickets con sus asociaciones
      const tickets = await SELECT
        .from(PrecertTickets)
        .where({ ID: { in: ticketIds } });
      if (tickets.length === 0) return req.error(404, 'No hay tickets pendientes de provision');

      // 3. Usuario logueado
      const usuario = req.user?.id || 'SISTEMA';

      // 4. Mapear al payload
      const registros = tickets.map(t => {
        const dateTO = t.date_to ? new Date(t.date_to) : null;
        const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const KNTTP_MAP = {
          'P': 'CAPEX',
          'K': 'OPEX',
          'N': 'Grafo'
        };

        return {
          gerencia: '',
          tipo: KNTTP_MAP[t.account_assignment_number] || '',
          cuentaCodigo: t.global_ledger_account || '',
          cuentaDenom: '',
          pozo: '',
          etapa: '',
          grafoDescripcion: '',
          grafoCodigo: t.project_network || '',
          grafoOperacion: t.po_item != null && t.account_assignment_number == 'N' ? String(t.po_item) : '',
          pepN4: t.wbs_element || '',
          pad: '',
          ordenCodigo: t.order || '',
          ordenDenom: '',
          cecoCodigo: t.cost_center,
          cecoDenom: '',
          moneda: t.currency || '',
          monto: t.total_price || 0,
          proveedorCodigo: bp.business_partner_number || '',
          proveedorDenom: bp.fullname || '',
          descripcion: t.ses_subservice || '',
          motivo: t.provisioned_motive || '',
          mes: dateTO ? MESES[dateTO.getMonth()] : '',
          anio: dateTO ? dateTO.getFullYear() : '',
          descripcionAsiento: '',
          materialCod: '',
          materialDescrip: '',
          precio: null,
          cantidad: null
        };
      });

      const MESES_LARGO = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

      const datos = {
        solicitante: usuario,
        ejercicio: new Date().getFullYear(),
        periodo: MESES_LARGO[new Date().getMonth()],
        registros
      };

      // 5. Actualizar provisioned = true
      await UPDATE(PrecertTickets)
        .set({ provisioned: true, provisioned_by: usuario })
        .where({ ID: { in: ticketIds } });

      // 6. Generar y retornar el Excel
      const buffer = await generarProvisionesExcel(datos);

      return buffer

    } catch (error) {
      console.error('❌ Error al generar el archivo:', error);
      return req.error(500, error.message);
    }
  });

  this.on('downloadPrecertTickets', async (req) => {
    try {
      const tx = cds.tx(req);

      const provinces = await tx.run(
        SELECT.from(Provinces).columns('ID', 'description')
      );

      const provinceMap = {};
      provinces.forEach(p => {
        provinceMap[p.ID] = p.description;
      });

      const dataDB = await tx.run(
        SELECT.from(PrecertTickets).columns(
          'ID',
          'currency',
          'total_price',
          'measure_unity',
          'province_ID',
          'qty_to_certify',
          'date_from',
          'date_to',
          'account_assignment_number',
          'project_network',
          'order',
          'cost_center',
          'global_ledger_account'
        )
      );

      const data = dataDB.map(item => ({
        ID: item.ID,
        currency: item.currency,
        total_price: item.total_price,
        measure_unity: item.measure_unity,
        province: item.province_ID ? provinceMap[item.province_ID] || '' : '',
        qty_to_certify: item.qty_to_certify,
        date_from: item.date_from,
        date_to: item.date_to,
        account_assignment_number: item.account_assignment_number,
        project_network: item.project_network,
        order: item.order,
        cost_center: item.cost_center,
        global_ledger_account: item.global_ledger_account
      }));

      const columns = [
        { header: 'ID', key: 'ID', width: 38, isEditable: false },
        { header: 'Moneda', key: 'currency', width: 12, isEditable: true },
        { header: 'Precio Total', key: 'total_price', width: 18, isEditable: true, isCurrency: true },
        { header: 'Unidad de Medida', key: 'measure_unity', width: 18, isEditable: true },
        { header: 'Provincia', key: 'province', width: 25, isEditable: true },
        { header: 'Cantidad a Certificar', key: 'qty_to_certify', width: 20, isEditable: true },
        { header: 'Fecha Desde', key: 'date_from', width: 15, isEditable: true, isDate: true },
        { header: 'Fecha Hasta', key: 'date_to', width: 15, isEditable: true, isDate: true },
        { header: 'Account Assignment Number', key: 'account_assignment_number', width: 25, isEditable: true },
        { header: 'Project Network', key: 'project_network', width: 18, isEditable: true },
        { header: 'Order', key: 'order', width: 18, isEditable: true },
        { header: 'Cost Center', key: 'cost_center', width: 18, isEditable: true },
        { header: 'Global Ledger Account', key: 'global_ledger_account', width: 22, isEditable: true }
      ];

      const buffer = await generateProtectedExcel(columns, data, 'PrecertTickets');
      return buffer.toString('base64');
    } catch (error) {
      req.error(500, 'Error generando el Excel: ' + error.message);
    }
  });

  this.on("getPurchaseOrderItemServices", async (req) => {
    try {
      const s4Ses = await getS4Service("API_SERVICE_ENTRY_SHEET_SRV");

      const { PurchaseOrder, POItemNumber } = req.data;

      if (!PurchaseOrder || POItemNumber == null) {
        return req.reject(400, "PurchaseOrder y POItemNumber son obligatorios");
      }

      const poPadded = String(PurchaseOrder).padStart(10, "0");
      const itemPadded = String(POItemNumber).padStart(5, "0");

      const result = await s4Ses.get(
        `/A_ServiceEntrySheetItem?$filter=PurchaseOrder eq '${poPadded}' and PurchaseOrderItem eq '${itemPadded}'`
      );

      const services = Array.isArray(result) ? result : result?.value ?? [];
      return services.map(_mapServiceEntrySheetItem);

    } catch (err) {
      console.error("Error en getPurchaseOrderItemServices:", err.response?.data || err.message);
      return req.reject(500, "Error al consultar servicios de la orden de compra");
    }
  });

  this.on("getPurchaseContractItemServices", async (req) => {
    try {
      const s4Ses = await getS4Service("API_SERVICE_ENTRY_SHEET_SRV");

      const { PurchaseContract, PurchaseContractItem } = req.data;

      if (!PurchaseContract || PurchaseContractItem == null) {
        return req.reject(400, "PurchaseContract y PurchaseContractItem son obligatorios");
      }

      const pcPadded = String(PurchaseContract).padStart(10, "0");
      const itemPadded = String(PurchaseContractItem).padStart(5, "0");

      const result = await s4Ses.get(
        `/A_ServiceEntrySheetItem?$filter=PurchaseContract eq '${pcPadded}' and PurchaseContractItem eq '${itemPadded}'`
      );

      const services = Array.isArray(result) ? result : result?.value ?? [];

      return services.map(_mapServiceEntrySheetItem);

    } catch (err) {
      console.error("Error en getPurchaseContractItemServices:", err.response?.data || err.message);
      return req.reject(500, "Error al consultar servicios del contrato");
    }
  });
  this.on('uploadPrecertTickets', async (req) => {
    const { file } = req.data;

    if (!file) {
      return req.reject(400, 'No se recibió el archivo');
    }

    try {
      const tx = cds.tx(req);

      const provinces = await tx.run(
        SELECT.from(Provinces).columns('ID', 'description')
      );

      const provinceByDescription = {};
      provinces.forEach(p => {
        provinceByDescription[(p.description || '').trim().toLowerCase()] = p.ID;
      });

      const columns = [
        { header: 'ID', key: 'ID' },
        { header: 'Moneda', key: 'currency' },
        { header: 'Precio Total', key: 'total_price' },
        { header: 'Unidad de Medida', key: 'measure_unity' },
        { header: 'Provincia', key: 'province' },
        { header: 'Cantidad a Certificar', key: 'qty_to_certify' },
        { header: 'Fecha Desde', key: 'date_from' },
        { header: 'Fecha Hasta', key: 'date_to' },
        { header: 'Account Assignment Number', key: 'account_assignment_number' },
        { header: 'Project Network', key: 'project_network' },
        { header: 'Order', key: 'order' },
        { header: 'Cost Center', key: 'cost_center' },
        { header: 'Global Ledger Account', key: 'global_ledger_account' }
      ];

      const rows = await readExcelByColumns(file, columns, 'PrecertTickets');

      if (!rows.length) {
        return req.reject(400, 'El Excel no contiene registros');
      }

      for (const row of rows) {
        if (!row.ID) continue;

        let province_ID = null;

        if (row.province) {
          province_ID = provinceByDescription[String(row.province).trim().toLowerCase()];

          if (!province_ID) {
            return req.reject(400, `Provincia inválida para el registro ${row.ID}: ${row.province}`);
          }
        }

        await tx.run(
          UPDATE(PrecertTickets)
            .set({
              currency: row.currency || null,
              total_price: row.total_price !== null && row.total_price !== '' ? Number(row.total_price) : null,
              measure_unity: row.measure_unity || null,
              province_ID: province_ID,
              qty_to_certify: row.qty_to_certify !== null && row.qty_to_certify !== '' ? Number(row.qty_to_certify) : null,
              date_from: row.date_from || null,
              date_to: row.date_to || null,
              account_assignment_number: row.account_assignment_number || null,
              project_network: row.project_network || null,
              order: row.order || null,
              cost_center: row.cost_center || null,
              global_ledger_account: row.global_ledger_account || null
            })
            .where({ ID: row.ID })
        );
      }

      return `Se actualizaron ${rows.length} registros correctamente`;
    } catch (error) {
      req.error(500, 'Error procesando el Excel: ' + error.message);
    }
  });

  function _getOneYearAgoDateStr() {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  }

  function _extractSearchTerm(req) {
    const search = req.query?.SELECT?.search;
    if (!search) return null;
    if (Array.isArray(search)) {
      for (const s of search) {
        if (s?.val != null) return String(s.val);
        if (typeof s === "string") return s;
      }
    }
    if (typeof search === "string") return search;
    if (search?.val != null) return String(search.val);
    return null;
  }

  function getTicketKeyWhere(req) {
    const id =
      req.data?.ID ||
      req.params?.[0]?.ID ||
      req.params?.[0]?.Id ||
      req.params?.[0]?.id;

    if (!id) return null;
    return { ID: id };
  }
  function n(val) {
    return parseFloat(val) || 0;
  }

  function round2(val) {
    return Math.round(val * 100) / 100;
  }


  async function _nextTicketNumber(tx) {
    const row = await tx.run(
      SELECT.one
        .from(PrecertTickets)
        .columns([
          { func: "max", args: [{ ref: ["ticket_number"] }], as: "maxNo" },
        ]),
    );

    const maxNo = row?.maxNo == null ? -1 : Number(row.maxNo);
    return maxNo + 1;
  }


  function _buildSesPayload(root, subs, location = "") {
    const to_service = subs.map(sub => ({
      Quantity: String(Number(sub.qty_to_certify || 0).toFixed(3)),
      ShortText: sub.ses_subservice || "",
      ExternalLine: sub.subservice_position || ""
    }));

    return [{
      PONumber: root.source_number || "",
      POItem: String(subs[0]?.po_item || ""),
      ShortText: `SES - ${root.source_number || root.ticket_number}`,
      PackageNo: "1",
      BeginDate: (root.date_from || subs[0]?.date_from)
        ? `/Date(${new Date(root.date_from || subs[0]?.date_from).getTime()})/`
        : "",
      EndDate: (root.date_to || subs[0]?.date_to)
        ? `/Date(${new Date(root.date_to || subs[0]?.date_to).getTime()})/`
        : "",
      LongText: root.short_text || subs[0]?.short_text || "",
      Location: location,
      PersonInt: subs[0].purchasing_group || "",
      ZZ_FISCA_EMAIL: root.validator || "",
      to_service
    }];
  }

  async function startWorkflow(ticket_ID, sesPayload) {
    const cds = require('@sap/cds');
    const tx = cds.tx();

    try {
      const { PrecertTickets, BusinessPartners } = cds.entities;

      const ticket = await tx.run(
        SELECT.one.from(PrecertTickets).where({ ID: ticket_ID })
      );
      const bp = await tx.run(
        SELECT.one.from(BusinessPartners).where({ ID: ticket.business_partner_ID })
      );

      const axios = sapCfAxios('SBPA');

      const validator = ticket.validator || "";

      const FLP_BASE_URL = process.env.FLP_BASE_URL;
      const ticketUrl = `${FLP_BASE_URL}#ticketlist-display?sap-ui-app-id-hint=saas_approuter_vistaticketlist&/ticket/${ticket_ID}`;

      const response = await axios({
        method: 'POST',
        url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.HES_WORKFLOW_ENV}`,
        headers: {
          'irpa-api-key': process.env.IRPA_API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          definitionId: process.env.HES_WORKFLOW_DEFINITION_ID,
          businessKey: ticket_ID,
          context: {
            input: {
              ticket_ID,
              app_link: ticketUrl,
              approvers: {
                acap_approvers: validator
              },
              ticket_payload: sesPayload || [],
              is_updated_ticket: true,
              acap_approval: {
                approved: false,
                user: '',
                date: ''
              }
            },
            log: {
              ticket_ID,
              status: '',
              comments: ''
            },
            mail: {
              message: {
                subject: 'Solicitud de Certificación',
                body: {
                  contentType: '',
                  content: certificationRequestEmail({ ticketNumber: ticket.ticket_number, requesterName: bp.fullname, currency: ticket.currency || "", totalAmount: ticket.total_price || 0, ticketUrl })
                },
                toRecipients: [{ emailAddress: { address: validator } }]
              },
              saveToSentItems: false
            }
          }
        }
      });

      await tx.commit();
      return response.data;

    } catch (error) {
      await tx.rollback();
      console.error('Error iniciando WF:', error.response?.data || error.message);
      throw error;
    }
  }
  async function postHesWorkflows(ticket_ID, root, subs, currentSubIds = []) {
    const axios = sapCfAxios("SBPA");

    const approverEmail = root.validator || "";
    const FLP_BASE_URL = process.env.FLP_BASE_URL;
    const ticketUrl = `${FLP_BASE_URL}#ticketlist-display?sap-ui-app-id-hint=saas_approuter_vistaticketlist&/ticket/${ticket_ID}`;

    const supplierBp = root.business_partner_ID
      ? await cds.run(SELECT.one.from(BusinessPartners).columns("lifnr").where({ ID: root.business_partner_ID }))
      : null;
    const supplierLifnr = supplierBp?.lifnr || "";

    const provinceIds = [...new Set(subs.map(s => s.province_ID).filter(Boolean))];
    const provinceRows = provinceIds.length
      ? await cds.run(
        SELECT.from(Provinces)
          .columns("ID", "s4_code", "description")
          .where({ ID: { in: provinceIds } })
      )
      : [];

    const provinceS4Code = {};
    for (const p of provinceRows) {
      provinceS4Code[p.ID] = `${p.s4_code || ""} ${(p.description || "").trim()}`.trim();
    }

    const activeSubs = currentSubIds.length
      ? subs.filter(s => currentSubIds.includes(s.ID))
      : subs;

    const poGroups = {};
    for (const sub of activeSubs) {
      const poKey = sub.source_number || root.source_number || "NO_PO";
      const groupKey = `${sub.province_ID || "NO_PROVINCE"}__${sub.po_item || "NO_ITEM"}`;
      if (!poGroups[poKey]) poGroups[poKey] = {};
      if (!poGroups[poKey][groupKey]) poGroups[poKey][groupKey] = [];
      poGroups[poKey][groupKey].push(sub);
    }

    const results = [];
    const errors = [];

    for (const [poNumber, subsGroupedByKey] of Object.entries(poGroups)) {
      const sesPayload = _buildHesWorkflowPayload(root, subsGroupedByKey, provinceS4Code, supplierLifnr);

      const allSubIds = Object.values(subsGroupedByKey).flat().map(s => s.ID);

      try {
        const response = await axios({
          method: "POST",
          url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.HES_WORKFLOW_ENV}`,
          headers: {
            "irpa-api-key": process.env.IRPA_API_KEY,
            "Content-Type": "application/json"
          },
          data: {
            definitionId: process.env.HES_WORKFLOW_DEFINITION_ID,
            businessKey: `${ticket_ID}_${poNumber}`,
            context: {
              input: {
                ticket_ID,
                app_link: ticketUrl,
                approvers: { acap_approvers: approverEmail },
                is_updated_ticket: false,
                acap_approval: { approved: true, user: "", date: "" }
              },
              log: { ticket_ID, status: "", comments: "" },
              mail: {
                message: {
                  subject: "",
                  body: { contentType: "", content: "" },
                  toRecipients: [{ emailAddress: { address: approverEmail } }]
                },
                saveToSentItems: false
              },
              hes: sesPayload
            }
          }
        });

        const instanceId = response.data.id;

        await cds.run(
          UPDATE(WorkflowStatus)
            .set({
              workflow_instance_id: instanceId,
              status: "ENVIANDO_HES",
              description: `WF HES iniciado: ${instanceId}`
            })
            .where({ precert_ticket_ID: { in: allSubIds } })
        );

        results.push({ poNumber, instanceId });

      } catch (err) {
        console.error(`[HES] Error workflow PO ${poNumber}:`, err.response?.data || err.message);
        errors.push({ poNumber, error: err.message });
      }
    }

    if (errors.length) {
      const detail = errors.map(e => `PO ${e.poNumber}: ${e.error}`).join(" | ");
      throw new Error(detail);
    }

    return results;
  }

  async function sendManualTicketNotification(ticket, totalAmount, currency, ticket_validator) {
    const NOTIFY_EMAIL = "tobias.racedo@datco.net";

    const FLP_BASE_URL = process.env.FLP_BASE_URL;
    const ticketUrl = `${FLP_BASE_URL}#ticketlist-display?sap-ui-app-id-hint=saas_approuter_vistaticketlist&/ticket/${ticket.ID}`;

    const axios = sapCfAxios("SBPA");

    await axios({
      method: "POST",
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.SOLPED_WORKFLOW_ENV}`,
      headers: {
        "irpa-api-key": process.env.SOLOSOLPED_IRPA_API_KEY,
        "Content-Type": "application/json"
      },
      data: {
        definitionId: process.env.SOLOSOLPED_WORKFLOW_DEFINITION_ID,
        businessKey: ticket.ID,
        context: {
          input: {
            ticket_ID: ticket.ID,
            app_link: ticketUrl,
            approvers: { acap_approvers: [ticket_validator] },
            ticket_payload: [],
            is_updated_ticket: true,
            acap_approval: { approved: false, user: "", date: "" }
          },
          log: { ticket_ID: ticket.ID, status: "", comments: "" },
          mail: {
            message: {
              subject: `Nuevo ticket de Solicitud de OC #${ticket.ticket_number} creado`,
              body: { content: ocRequestEmail({ ticketNumber: ticket.ticket_number, currency, totalAmount, ticketUrl }) },
              toRecipients: [{ emailAddress: { address: ticket_validator } }]
            },
            saveToSentItems: false
          }
        }
      }
    });

  }

  function _buildSolpedPayload(positionGroups, lines, header) {
    const oLinesByPo = {};
    lines
      .filter(l => l.currentStatus === "APROBADO")
      .forEach(l => {
        const sPo = String(l.EXTROW || "").trim();
        if (!oLinesByPo[sPo]) oLinesByPo[sPo] = [];
        oLinesByPo[sPo].push(l);
      });

    const oPosDataMap = {};
    (positionGroups || []).forEach(pg => {
      oPosDataMap[String(pg.po_item)] = pg;
    });

    const to_pritems = [];
    const to_prservices = [];
    const to_praccass = [];

    Object.entries(oLinesByPo).forEach(([sPo, aLines]) => {
      const oPD = oPosDataMap[sPo] || {};

      to_pritems.push({
        PRItem: sPo,
        PurGroup: oPD.EKGRP || "",
        ShortText: oPD.ShortText || aLines[0]?.KTEXT1 || "",
        Plant: oPD.WERKS || "",
        MaterialGroup: oPD.MATKL || "",
        Quantity: String(aLines.reduce((s, l) => s + (parseFloat(l.MENGE) || 0), 0)),
        Unit: "UP",
        ItemCat: "9",
        AcctAssCat: oPD.KNTTP || "",
        FixedVendor: "2000003093",
        PurchOrg: oPD.EKORG || "",
        Agreement: "4600002772",
        AgreementItem: "10",
        DeliveryDate: oPD.delivery_date ? `/Date(${new Date(oPD.delivery_date).getTime()})/` : "",
        Criticidad: oPD.ZCRIT || "",
        WorkflowJustificationTextB02: oPD.text_workflow_solped || ""
      });

      aLines.forEach((l, idx) => {
        to_prservices.push({
          PRItem: sPo,
          ExtRow: String((idx + 1) * 10),
          Quantity: l.MENGE || ""
        });
      });

      to_praccass.push({
        PRItem: sPo,
        CostCenter: oPD.KOSTL || ""
      });
    });

    return [{ to_pritems, to_prservices, to_praccass, PRType: header?.BSART || "" }];
  }
  function _buildSolpedPCPayload(positionGroups, lines, source_number, subs, fixedVendor = "") {
    const oSubBySubticketId = {};
    (subs || []).forEach(s => { if (s.ID) oSubBySubticketId[s.ID] = s; });

    const oPosDataMap = {};
    (positionGroups || []).forEach(pg => { oPosDataMap[String(pg.po_item)] = pg; });

    const oLinesByPrItem = {};
    lines.filter(l => l.currentStatus === "APROBADO").forEach(l => {
      const sPrItem = String(l.pr_item || l.EXTROW || "").trim();
      if (!oLinesByPrItem[sPrItem]) oLinesByPrItem[sPrItem] = [];
      oLinesByPrItem[sPrItem].push(l);
    });

    const to_pritems = [];
    const to_prservices = [];
    const to_praccass = [];

    Object.entries(oLinesByPrItem).forEach(([sPRItem, aLines]) => {
      const oPD = oPosDataMap[sPRItem] || {};
      const sAgreementItem = oPD.po_item_original || sPRItem;
      const sUnit = aLines.find(l => l.MEINS)?.MEINS || "AU";

      to_pritems.push({
        PRItem: sPRItem,
        PurGroup: oPD.EKGRP || "",
        ShortText: oPD.ShortText || "",
        Plant: oPD.WERKS || "",
        MaterialGroup: "0" + (oPD.MATKL || ""),
        Quantity: String(aLines.reduce((s, l) => s + (parseFloat(l.MENGE) || 0), 0)),
        Unit: sUnit,
        ItemCat: "9",
        AcctAssCat: oPD.KNTTP || "",
        FixedVendor: fixedVendor,
        PurchOrg: oPD.EKORG || "",
        Agreement: source_number || "",
        AgreementItem: sAgreementItem,
        DeliveryDate: oPD.delivery_date ? `/Date(${new Date(oPD.delivery_date).getTime()})/` : "",
        Criticidad: oPD.ZCRIT || "",
        WorkflowJustificationTextB02: oPD.text_workflow_solped || ""
      });

      // ← ExtRow secuencial por PRItem, independiente de subservice_position
      aLines.forEach((l, idx) => {
        const oSub = oSubBySubticketId[l.subticket_id];
        const sExtRow = String((idx + 1) * 10);   // 10, 20, 30...

        to_prservices.push({
          PRItem: sPRItem,
          ExtRow: sExtRow,
          Service: l.SRVPOS || "",
          Quantity: l.MENGE || "",
          GrossPrice: l.PREIS || "",
          Currency: l.WAERS || oSub?.currency || ""
        });

        to_praccass.push({
          PRItem: sPRItem,
          ExtRow: sExtRow,   // ← mismo ExtRow que el servicio correspondiente
          Network: l.KNTTP === "N" ? (l.NPLNR || "") : "",
          Activity: l.KNTTP === "N" ? (l.ACTIVITY || "") : "",
          WBSElement: l.KNTTP === "P" ? (l.PSPNR || "") : "",
          CostCenter: l.KNTTP === "K" ? (l.KOSTL || "") : "",
          Order: l.KNTTP === "F" ? (l.AUFNR || "") : ""
        });
      });
    });

    return [{ to_pritems, to_prservices, to_praccass, PRType: "ZCON" }];
  }
  async function _ensureDMSFolder(dmsAxios, parentPath, folderName) {
    const fd = new FormData();
    fd.append('cmisaction', 'createFolder');
    fd.append('propertyId[0]', 'cmis:name');
    fd.append('propertyValue[0]', folderName);
    fd.append('propertyId[1]', 'cmis:objectTypeId');
    fd.append('propertyValue[1]', 'cmis:folder');
    fd.append('succinct', 'true');

    // Siempre buscamos el objectId por path — el POST no lo devuelve de forma confiable
    const fetchObjectId = async () => {
      const fullPath = `${parentPath}/${encodeURIComponent(folderName)}`;
      const res = await dmsAxios.get(
        `/browser/${REPO_ID}/root${fullPath}`,
        { params: { cmisselector: 'object', succinct: true } }
      );
      return res.data.succinctProperties?.['cmis:objectId'] ?? null;
    };

    try {
      const res = await dmsAxios.post(
        `/browser/${REPO_ID}/root${parentPath}`,
        fd,
        { headers: fd.getHeaders() }
      );

      // SAP SDM a veces no devuelve succinctProperties en el POST,
      // así que si no está lo buscamos por GET
      const objectId = res.data.succinctProperties?.['cmis:objectId'];
      if (objectId) return objectId;

      return await fetchObjectId();

    } catch (e) {
      console.error('[DMS] status:', e.response?.status);
      console.error('[DMS] data:', JSON.stringify(e.response?.data));
      console.error('[DMS] config url:', e.config?.url);

      if (e.response?.status === 409) {
        return await fetchObjectId();
      }
      throw e;
    }
  }
  async function _sendSolpedWorkflow(ticket_id, _root, solpedPayload, hesPayload, subIds, tx) {
    const FLP_BASE_URL = process.env.FLP_BASE_URL;
    const ticketUrl = `${FLP_BASE_URL}#ticketlist-display?sap-ui-app-id-hint=saas_approuter_vistaticketlist&/ticket/${ticket_id}`;

    const mailHtml = solpedApprovalEmail({ ticketNumber: _root.ticket_number, ticketUrl });

    const bpaPayload = {
      definitionId: process.env.SOLPED_WORKFLOW_DEFINITION_ID,
      context: {
        input: {
          ticket_ID: ticket_id,
          app_link: ticketUrl,
          approvers: { acap_approvers: [""] },
          acap_approval: { approved: true, user: "", date: "" },
          is_updated_ticket: false
        },
        log: { ticket_ID: ticket_id, status: "", comments: "" },
        mail: {
          message: {
            subject: `Aprobación SolPed — Ticket #${_root.ticket_number}`,
            body: { contentType: "HTML", content: mailHtml },
            toRecipients: [{ emailAddress: { address: _root.validator || "" } }]
          },
          saveToSentItems: false
        },
        data: hesPayload || [],
        solped: solpedPayload
      }
    };

    const axios = sapCfAxios("SBPA");
    const response = await axios({
      method: "POST",
      url: `/workflow/rest/v1/workflow-instances?environmentId=${process.env.SOLPED_WORKFLOW_ENV}`,
      headers: {
        "irpa-api-key": process.env.SOLPED_IRPA_API_KEY,
        "Content-Type": "application/json"
      },
      data: bpaPayload
    });

    const instanceId = response.data?.id;

    await tx.run(
      UPDATE(WorkflowStatus)
        .set({
          status: "ENVIANDO_SOLPED",
          workflow_instance_id: instanceId || null,
          description: `WF SolPed iniciado: ${instanceId}`
        })
        .where({ precert_ticket_ID: { in: subIds?.length ? subIds : [ticket_id] } })
    );

    return instanceId;
  }

  // Payload para el WF de HES en SAP Build Process Automation — nombres de campo
  // alineados al schema del workflow (PurchaseOrder/ServiceEntrySheetName/
  // to_ServiceEntrySheetItem), distinto del shape legacy que usa _buildHesPayload
  // para el flujo de SOLPED (PONumber/POItem/to_service).
  function _buildHesWorkflowPayload(root, subsGroupedByKey, provinceS4Code, supplierLifnr) {
    return Object.entries(subsGroupedByKey)
      .filter(([, subs]) => Array.isArray(subs) && subs.length > 0)
      .map(([, subs]) => {
        const first = subs[0];
        const dateFrom = first?.hes_date_from || root.date_from || first?.date_from;
        const dateTo = first?.hes_date_to || root.date_to || first?.date_to;

        const to_ServiceEntrySheetItem = subs.map((sub, idx) => {
          const itemDateFrom = sub.hes_date_from || dateFrom;
          const itemDateTo = sub.hes_date_to || dateTo;
          return {
            ServiceEntrySheetItem: String((idx + 1) * 10),
            PurchaseOrder: root.source_number || "",
            PurchaseOrderItem: String(sub.po_item || ""),
            Plant: sub.plant || "",
            ServiceEntrySheetItemDesc: sub.ses_subservice || sub.short_text || "",
            ConfirmedQuantity: String(Number(sub.qty_to_certify || 0).toFixed(3)),
            Currency: root.currency || "",
            ServicePerformanceDate: itemDateFrom ? `/Date(${new Date(itemDateFrom).getTime()})/` : "",
            QuantityUnit: sub.measure_unity || "",
            ServicePerformanceEndDate: itemDateTo ? `/Date(${new Date(itemDateTo).getTime()})/` : "",
            TaxJurisdiction: "",
            TaxCountry: ""
          };
        });

        return {
          PurchaseOrder: root.source_number || "",
          ServiceEntrySheetName: `SES - ${root.source_number || root.ticket_number}`,
          to_ServiceEntrySheetItem: { results: to_ServiceEntrySheetItem },
          PurchasingOrganization: first?.purchasing_org || "",
          PurchasingGroup: first?.purchasing_group || "",
          Currency: root.currency || "",
          Supplier: supplierLifnr || "",
          PostingDate: `/Date(${Date.now()})/`,
          PurgDocExternalReference: String(root.ticket_number || "")
        };
      });
  }

  function _buildHesPayload(root, subsGroupedByKey, provinceS4Code) {
    return Object.entries(subsGroupedByKey)
      .filter(([, subs]) => Array.isArray(subs) && subs.length > 0)
      .map(([, subs]) => {
        const first = subs[0];
        const provinceId = first?.province_ID;
        const location = provinceS4Code[provinceId] || "";

        // ✅ Datos HES leídos desde los campos persistidos en cada subticket
        const dateFrom = first?.hes_date_from || root.date_from || first?.date_from;
        const dateTo = first?.hes_date_to || root.date_to || first?.date_to;
        const longText = first?.hes_long_text || root.short_text || first?.short_text || "";

        const to_service = subs.map(sub => ({
          Quantity: String(Number(sub.qty_to_certify || 0).toFixed(3)),
          ShortText: sub.ses_subservice || "",
          ExternalLine: sub.subservice_position || ""
        }));

        return {
          PONumber: root.source_number || "",
          POItem: String(first?.po_item || ""),
          ShortText: `SES - ${root.source_number || root.ticket_number}`,
          PackageNo: "1",
          BeginDate: dateFrom ? `/Date(${new Date(dateFrom).getTime()})/` : "",
          EndDate: dateTo ? `/Date(${new Date(dateTo).getTime()})/` : "",
          LongText: longText,
          Location: location,
          PersonInt: subs[0].purchasing_group || "",
          ZZ_FISCA_EMAIL: root.validator || first?.validator || "",
          to_service
        };
      });
  }
});
