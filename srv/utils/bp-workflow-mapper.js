function mapBusinessPartnerToWorkflowContext(bp) {
  return {
    input: {
      provider_name: bp.provider_name,
      fullname: bp.fullname,
      trade_name: bp.trade_name,
      provider_category: bp.provider_category,
      regional_category: bp.regional_category,
      vat_registration: bp.vat_registration,
      authorization_group: bp.authorization_group,
      business_partner_number: bp.business_partner_number,
      order_number: bp.order_number,
      lifnr: bp.lifnr,

      addresses: (bp.to_addresses || []).map(a => ({
        provider_country: a.provider_country,
        street_name: a.street_name,
        city: a.city,
        postal_code: a.postal_code,
        house_number: a.house_number
      })),

      taxNumbers: (bp.to_tax_numbers || []).map(t => ({
        identification_number: t.identification_number,
        tax_identification_number: t.tax_identification_number
      })),

      bankDetails: (bp.to_bank_details || []).map(b => ({
        bank_key: b.bank_key,
        bank_account: b.bank_account,
        account_holder: b.account_holder,
        bank_country: b.bank_country,
        bank_stardard_identification: b.bank_stardard_identification
      })),

      companyData: (bp.to_company_codes || []).map(c => ({
        company_code: c.company_code,
        currency: c.currency,
        payment_terms: c.payment_terms,
        blocking_indicator: c.blocking_indicator,
        payment_block: c.payment_block,
        account_determination: c.account_determination,
        default_accounting_group: c.default_accounting_group
      })),

      purchasingData: (bp.to_purchasing || []).map(p => ({
        purchase_org: p.purchase_org,
        buy_order_currency: p.buy_order_currency,
        po_payment_terms: p.po_payment_terms,
        incoterms: p.incoterms,
        puchase_block: p.puchase_block,
        payment_conditions: p.payment_conditions,
        calculation_type: p.calculation_type
      })),

      withholdingTaxes: (bp.to_withholding || []).map(w => ({
        taxes_country: w.taxes_country,
        taxes_type: w.taxes_type,
        taxes_code: w.taxes_code
      })),

      contacts: (bp.to_contacts || []).map(c => ({
        contact_first_name: c.contact_first_name,
        contact_last_name: c.contact_last_name,
        contact_phone: c.contact_phone,
        contact_email: c.contact_email,
        billing_email: c.billing_email
      })),

      documents: (bp.documents || []).map(d => ({
        document_type: d.document_type,
        file_name: d.file_name,
        description: d.description,
        file_url: d.file_url
      }))
    }
  };
}

async function buildBPWorkflowContextById(ID, tx, BusinessPartners) {
  const bp = await tx.run(
    SELECT.one.from(BusinessPartners).where({ ID }).columns(
      '*',
      { to_addresses: ['*'] },
      { to_tax_numbers: ['*'] },
      { to_bank_details: ['*'] },
      { to_company_codes: ['*'] },
      { to_purchasing: ['*'] },
      { to_withholding: ['*'] },
      { to_contacts: ['*'] },
      { documents: ['*'] }
    )
  );

  if (!bp) {
    throw new Error(`No se encontró el Business Partner con ID ${ID}`);
  }

  return mapBusinessPartnerToWorkflowContext(bp);
}

module.exports = {
  mapBusinessPartnerToWorkflowContext,
  buildBPWorkflowContextById
};