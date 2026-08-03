const cds = require('@sap/cds');

// Campos de control/aprobación del BP que el borrador del proveedor NUNCA debe
// sobrescribir: los gobierna el backend o los aprobadores. Se filtran antes del
// deep UPDATE para que un payload del proveedor no pueda pisar el estado del WF.
const PROTECTED_BP_FIELDS = new Set([
  "ID", "createdAt", "createdBy", "modifiedAt", "modifiedBy",
  "business_partner_number", "lifnr", "order_number", "authorization_group",
  "tax_decision", "tax_additional_info", "tax_status",
  "legal_decision", "legal_additional_info", "legal_status",
  "teso_decision", "teso_additional_info", "teso_status",
  "central_block",
  "status" // composición WorkflowStatus
]);

// Aplica el payload PENDIENTE de un borrador (BusinessPartnerModifications) sobre
// el BusinessPartner mediante un deep UPDATE de CAP. El payload trae el árbol
// parcial del BP del área (escalares + composiciones: to_bank_details para TESO,
// to_tax_data / to_withholding_taxes para TAX). CAP reemplaza las composiciones
// presentes matcheando por key. Devuelve true si aplicó algo.
async function applyModificationPayload(bp_id, payload) {
  const { BusinessPartners } = cds.entities;

  let data = payload;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      throw new Error(`Payload de modificación inválido (no es JSON): ${e.message}`);
    }
  }
  if (!data || typeof data !== "object") return false;

  // Quitar la clave y los campos de control para no pisar el estado de aprobación.
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (PROTECTED_BP_FIELDS.has(k)) continue;
    clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return false;

  await UPDATE(BusinessPartners, bp_id).with(clean);
  return true;
}

module.exports = { PROTECTED_BP_FIELDS, applyModificationPayload };
