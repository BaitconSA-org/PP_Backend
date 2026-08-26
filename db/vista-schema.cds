namespace suppliersInitiative;

using {
    cuid,
    managed
} from '@sap/cds/common';
using {sap.changelog.Changes} from '@cap-js/change-tracking';


entity ErrorLogs : cuid, managed {
    message : String;
    date    : DateTime;
}

entity ApplicationLogs : cuid, managed {
    app               : String(50);
    modification      : String(50);
    description       : String(500);
    ticket_display    : String(50);
    previous_data     : LargeString;
    new_data          : LargeString;
    associated_ticket : Association to PrecertTickets;
    business_partner  : Association to BusinessPartners;
    result            : String(20);
    user              : String;
}

entity IdDescription : managed {
    key ID                     : String;
        @changelog description : String;
}

entity Companies : managed {
    key ID          : String(4);
        description : String(100);
}

entity LegalForms : managed {
    key ID           : String(2);
        abbreviation : String(40);
        description  : String(100);
}

entity TicketDocuments : cuid, managed {
    ticket        : Association to PrecertTickets;
    file_name     : String(255);
    dms_object_id : String(255);
    dms_folder_id : String(255);
    uploaded_by   : String(100);
}

entity TaxIdentificationTypes : managed {
    key ID          : String(5);
        description : String(100);
}

entity Provinces : IdDescription {
    s4_code : String;
}

entity Services : IdDescription {}
entity PurchOrg : IdDescription {}
entity PurchGroup : IdDescription {}
entity MaterialGroup : IdDescription {}
entity Plants : IdDescription {}
entity MeasureUnits : IdDescription {}
entity BusinessRoles : IdDescription {}


entity BusinessPartnerDocuments : cuid, managed {
    @changelog document_type    : String(50);
    @changelog file_name        : String(500);
    @changelog description      : String(200);
    @changelog file_url         : String(500);
    @changelog business_partner : Association to BusinessPartners;
}

entity BusinessPartners : cuid, managed {
    @changelog provider_name           : String;
    @changelog fullname                : String;
    @changelog trade_name              : String;
    @changelog legal_form              : String(2);
    @changelog provider_category       : String(4);
    @changelog regional_category       : String(4);
    @changelog vat_registration        : String;
    @changelog responsible_type        : String(2);
    @changelog authorization_group     : String(4);
    @changelog business_partner_number : String(50);
    @changelog order_number            : String(25);
    @changelog lifnr                   : String(10);
    @changelog is_human                : Boolean;
    @changelog is_local                : Boolean;
    @changelog accept_policy           : Boolean;
    @changelog accept_terms            : Boolean;
    @changelog accepts_anexo_h         : Boolean;
    @changelog supplier_account_group  : String(4);
    @changelog bp_role                 : String(8);
    @changelog business_partner_grouping : String(4);
    @changelog tax_decision            : String(20);
    @changelog tax_additional_info     : LargeString;
    @changelog tax_status              : String(30);

    // Resolución legal (enviada por aprobador en PATCH)
    @changelog legal_decision          : String(20);
    @changelog legal_additional_info   : LargeString;
    @changelog legal_status            : String(30);

    // Resolución de tesorería (enviada por aprobador en PATCH)
    @changelog teso_decision           : String(20);
    @changelog teso_additional_info    : LargeString;
    @changelog teso_status             : String(30);
    @changelog central_block           : Boolean;
    to_addresses                       : Composition of many Addresses
                                             on to_addresses.business_partner = $self;
    to_tax_numbers                     : Composition of many TaxNumbers
                                             on to_tax_numbers.business_partner = $self;
    to_bank_details                    : Composition of many BankDetails
                                             on to_bank_details.business_partner = $self;
    to_contacts                        : Composition of many Contacts
                                             on to_contacts.business_partner = $self;
    to_collections_emails              : Composition of many CollectionsEmails
                                             on to_collections_emails.business_partner = $self;
    to_tax_data                        : Composition of one TaxData
                                             on to_tax_data.business_partner = $self;
    to_withholding_taxes               : Composition of many WithholdingTaxes
                                             on to_withholding_taxes.business_partner = $self;
    to_company_data                    : Composition of many CompanyData
                                             on to_company_data.business_partner = $self;
    to_purchasing_data                 : Composition of one PurchasingData
                                             on to_purchasing_data.business_partner = $self;
    to_roles                           : Composition of many BusinessPartnerRoles
                                             on to_roles.business_partner = $self;
    documents                          : Composition of many BusinessPartnerDocuments
                                             on documents.business_partner = $self;
    status                             : Composition of many WorkflowStatus
                                             on status.business_partner = $self;
}

// Borrador (staging) de modificaciones hechas por el proveedor. Guarda el payload
// editado (datos bancarios para TESO, impositivos para TAX) en estado PENDIENTE
// hasta que el aprobador del área apruebe. Recién en approve*Modification con
// decisión APROBAR el payload se aplica (deep UPDATE por área) sobre el
// BusinessPartner y la fila se ELIMINA (no es tabla de historial: la auditoría
// queda en change-tracking + ApplicationLogs). NO se patchea el BP mientras está
// PENDIENTE.
entity BusinessPartnerModifications : cuid, managed {
    // OData expone el FK como businessPartner_ID (contrato del frontend / spec).
    businessPartner : Association to BusinessPartners;
    area            : String(5);  // TAX | TESO
    status          : String(12); // PENDIENTE | DESCARTADO
    payload         : LargeString; // JSON con el árbol parcial del BP a aplicar
}

entity CollectionsEmails : cuid, managed {
    @changelog business_partner : Association to BusinessPartners;
    @changelog email            : String(120);
    @changelog sector           : String(50);
}

// Roles del BP en S/4 (FLVN00, FLVN01, …). Multi-rol por BP para que el POST a
// la entidad / la carga masiva traiga sus propios roles, en vez de tomarlos de
// la tabla de config BusinessRoles.
entity BusinessPartnerRoles : cuid, managed {
    @changelog business_partner : Association to BusinessPartners;
    @changelog role             : String(8);
}

entity TaxData : cuid, managed {
    business_partner                   : Association to BusinessPartners;
    @changelog iva_condition           : String(20);
    @changelog is_iibb_registered      : String(2);
    @changelog iibb_condition          : String(20);
    @changelog iibb_type               : String(20);
    @changelog is_retention_agent_iibb : String(2);
    @changelog iibb_jurisdictions      : String(255);
    @changelog ganancias_condition     : String(20);
    @changelog has_ganancias_exemption : String(2);
    @changelog is_rg830                : String(2);
    @changelog is_suss_applicable      : String(2);
    @changelog suss_regime             : String(20);
    @changelog has_suss_exclusion      : String(2);
    @changelog ga_indicator            : String(10);
    @changelog ga_exemption            : String(2);
    @changelog iibb_indicator          : String(10);
    @changelog iibb_exemption          : String(2);
    @changelog suss_indicator          : String(10);
    @changelog suss_exemption_approval : String(2);
    @changelog tax_decision            : String(20);
    @changelog tax_additional_info     : LargeString;
}

entity Countries : managed {
    key code    : String(3);
        name_es : String(100);
        name_en : String(100);
}

entity Regions : managed {
    key countryCode : String(3);
    key code        : String(10);
        name        : String(150);
}

entity Banks : managed {
    key ID      : String(20);
    key name    : String(100);
        country : Association to Countries;
}

entity WorkflowStatus : cuid, managed {
    business_partner            : Association to BusinessPartners;
    precert_ticket              : Association to PrecertTickets;
    @changelog description      : String(1000);
    @changelog asigned_user     : String(100);
    @changelog status           : String(20);
    @changelog approved_by      : String(50);
    @changelog application_type : String(40);
    workflow_instance_id        : String(100);
}

entity BPApprovals : cuid, managed {
    business_partner : Association to BusinessPartners;
    area             : String(20);
    approved         : Boolean;
    user_id          : String(100);
    approved_at      : Timestamp;
    additional_info  : String(500);
}

entity Addresses : cuid, managed {
    business_partner            : Association to BusinessPartners;
    @changelog provider_country : String(3);
    @changelog street_name      : String;
    @changelog city             : String;
    @changelog postal_code      : String;
    @changelog house_number     : String;
    @changelog region           : String(3);
    @changelog floor            : String(10);
}

entity TaxNumbers : cuid, managed {
    business_partner                     : Association to BusinessPartners;
    @changelog identification_number     : String;
    @changelog tax_identification_number : String;
}

entity BankDetails : cuid, managed {
    business_partner                        : Association to BusinessPartners;
    @changelog bank_key                     : String;
    @changelog bank_account                 : String;
    @changelog account_holder               : String;
    @changelog bank_country                 : String;
    @changelog bank_stardard_identification : String;
    @changelog account_type                 : String(2);
    @changelog currency                     : String(3);
}

entity CompanyData : cuid, managed {
    business_partner                  : Association to BusinessPartners;
    @changelog company_code           : String(4);
    @changelog currency               : String(3);
    @changelog payment_terms          : String(4);
    @changelog blocking_indicator     : Boolean;
    @changelog payment_block          : String(2);
    @changelog reconciliation_account : String(10);
    @changelog tolerance_group        : String(4);
    @changelog payment_methods        : String(10);
}

entity PurchasingData : cuid, managed {
    business_partner                   : Association to BusinessPartners;
    @changelog purchase_org            : String(4);
    @changelog buy_order_currency      : String(3);
    @changelog po_payment_terms        : String(4);
    @changelog incoterms               : String(3);
    @changelog puchase_block           : Boolean;
    @changelog payment_conditions      : String;
    @changelog webre_flag              : Boolean;
    @changelog lebre_flag              : Boolean;
    @changelog calculation_type        : String;
    @changelog pur_ord_auto_generation : Boolean;
}

entity WithholdingTaxes : cuid, managed {
    business_partner                   : Association to BusinessPartners;
    @changelog taxes_country           : String(3);
    @changelog taxes_type              : String;
    @changelog taxes_indicator         : String;
    @changelog taxes_code              : String;
    @changelog is_subject_to_retention : String(2);
    @changelog is_exempt               : String(2);
    @changelog exemption_number        : String(20);
    @changelog exemption_reason_code   : String(20);
    @changelog exemption_rate          : Decimal(5, 2);
    @changelog exemption_from          : Date;
    @changelog exemption_to            : Date;
}

entity Contacts : cuid, managed {
    business_partner              : Association to BusinessPartners;
    @changelog contact_first_name : String;
    @changelog contact_last_name  : String;
    @changelog contact_phone      : String;
    @changelog contact_email      : String;
    @changelog billing_email      : String;
}

// Agregado persistente del servicio de un ítem de OC/Contrato — sobrevive a través de
// múltiples precertificaciones (tickets) hechas contra el mismo ítem a lo largo del tiempo.
// Identificado de forma lógica por (source_type, source_number, po_item); la unicidad se
// resuelve con find-or-create en el backend, no con constraint de DB.
entity PrecertTicketItems : cuid, managed {
    source_type                          : String(10);
    source_number                        : String(20);
    po_item                              : Integer;
    po_item_text                         : String(100);
    service_id                           : String(80);
    service_desc                         : String(300);
    @changelog qty_total                 : Decimal(20, 3);
    @changelog qty_certified             : Decimal(20, 3);
    unit_price                           : Decimal(20, 3);
    currency                             : String(3);
    measure_unity                        : String;
    account_assignment_number            : String(2);
    project_network                      : String(12);
    order                                : String(12);
    cost_center                          : String(15);
    global_ledger_account                : String(20);
    wbs_element                          : String(50);
    partials                             : Association to many PrecertTickets
                                               on partials.precert_ticket_item = $self;
}

entity PrecertTickets : cuid, managed {
    ticket_number                        : Integer @readonly;
    @changelog source_type               : String(10);
    @changelog source_number             : String(20);
    @changelog business_partner          : Association to BusinessPartners;
    status                               : Composition of many WorkflowStatus
                                               on status.precert_ticket = $self;
    @changelog currency                  : String(3);
    @changelog total_price               : Decimal(20, 3);
    @changelog measure_unity             : String;
    @changelog proveedor_um              : String(40);
    @changelog parent_ticket             : Association to PrecertTickets;
    @changelog sub_tickets               : Association to many PrecertTickets
                                               on sub_tickets.parent_ticket = $self;
    documents                            : Composition of many TicketDocuments
                                               on documents.ticket = $self;
    province                             : Association to Provinces;
    @changelog qty_to_certify            : Decimal(20, 3);
    @changelog qty_certified             : Decimal(20, 3);
    @changelog root_quantity             : Decimal(20, 3);
    @changelog ticket_quantity           : Decimal(20, 3);
    @changelog date_from                 : Date;
    @changelog date_to                   : Date;
    @readonly  @changelog  service       : String(80);
    @readonly  @changelog  subService    : String(80);
    @changelog account_assignment_number : String(2);
    @changelog project_network           : String(12);
    @changelog activity                  : String(12);
    @changelog order                     : String(12);
    @changelog cost_center               : String(15);
    @changelog global_ledger_account     : String(20);
    @changelog short_text                : String(250);
    @changelog text_workflow_solped      : String(250);
    @changelog solped_number             : String(50);
    @changelog po_item                   : Integer;
    @changelog po_item_text              : String(100);
    @changelog ses_service               : String(200);
    @changelog ses_subservice            : String(300);
    @changelog ses_short_text            : String(40);
    @changelog co_area                   : String(4);
    @changelog profit_center             : String(10);
    @changelog wbs_element               : String(50);
    @changelog provisioned               : Boolean;
    @changelog provisioned_by            : String(75);
    @changelog provisioned_motive        : String(75);
    @changelog hes_number                : String(50);
    @changelog observations              : String(150);
    @changelog subservice_position       : String(10);
    @changelog purchasing_group          : String(10);
    @changelog purchasing_org            : String(4);
    @changelog account_assignment_cat    : String(1);
    @changelog delivery_date             : Date;
    @changelog criticality               : String(1);
    @changelog plant                     : String(8);
    @changelog material_group            : String(9);
    @changelog material                  : String(18);
    @changelog company_code              : String(4);
    @changelog release_date              : Date;
    @changelog hes_date_from             : Date;
    @changelog hes_date_to               : Date;
    @changelog hes_long_text             : String(1000);
    @changelog pr_item                   : Integer;
    @changelog validator                 : String(250);
    precert_ticket_item                  : Association to PrecertTicketItems;
    @changelog ticket_model              : String(10) default 'LEGACY';
    messages                             : Composition of many TicketMessages
                                               on messages.ticket = $self;
}

entity TicketMessages : cuid, managed {
    ticket         : Association to PrecertTickets;
    author         : String;
    text           : String(1000);
    isFromProvider : Boolean;
}

entity AccountAssignmentsTypes {
    key ID          : String(2);
        description : String(50);
}

entity ResponsibleType : managed {
    key ID          : String(2);
        description : String(100);
}

// Motivos de exención de retención (customizing S/4). El código depende del
// país (C/R): AR usa "1"; el resto, "01"/"02".
entity ExemptionReasons : managed {
    key country_code : String(3);
    key reason_code  : String(2);
        description  : String(100);
}

entity WithholdingTaxCodes : managed {
    key country_code : String(3);
    key tax_type     : String(5);
    key tax_code     : String(5);
        description  : String(200);
}

entity PaymentMethods : managed {
    key country_code : String(3);
    key pmt_method   : String(1);
        description  : String(200);
}

view SoxUnifiedAuditLog as
        select from Changes

        // JOIN a PrecertTickets usando Changes.entity (nivel DB, siempre consistente)
        // Para composiciones de ticket (WorkflowStatus, etc.), Changes.objectID
        // apunta al UUID del PrecertTicket raíz de la operación
        left join PrecertTickets as pt
            on  pt.ID          =  Changes.objectID
            and Changes.entity in (
                'suppliersInitiative.PrecertTickets', 'suppliersInitiative.WorkflowStatus', 'suppliersInitiative.TicketDocuments', 'suppliersInitiative.TicketMessages'
            )

        // Número fiscal (CUIT/NIF) para cambios a nivel BusinessPartner.
        left join BusinessPartners as bpf
            on  bpf.ID         =  Changes.objectID
            and Changes.entity =  'suppliersInitiative.BusinessPartners'
        {
            key Changes.ID        as LogID,
                Changes.createdAt as Fecha,
                Changes.createdBy as Usuario,

                cast(
                    case
                        Changes.modification
                        when 'create'
                             then 'CREATE'
                        when 'update'
                             then 'UPDATE_FIELD'
                        when 'delete'
                             then 'DELETE'
                        else Changes.modification
                    end as String(50)
                )                 as Accion,

                cast(
                    case
                        Changes.modification
                        when 'create'
                             then 'Campo ' || coalesce(
                                      Changes.attribute, ''
                                  ) || ' establecido en [' || coalesce(
                                      Changes.valueChangedTo, ''
                                  ) || ']'
                        when 'delete'
                             then 'Campo ' || coalesce(
                                      Changes.attribute, ''
                                  ) || ' era [' || coalesce(
                                      Changes.valueChangedFrom, ''
                                  ) || ']'
                        else 'Campo ' || coalesce(
                                 Changes.attribute, ''
                             ) || ' cambió de [' || coalesce(
                                 Changes.valueChangedFrom, ''
                             ) || '] a [' || coalesce(
                                 Changes.valueChangedTo, ''
                             ) || ']'
                    end as String(500)
                )                 as Descripcion,

                case
                    when Changes.entity in (
                             'suppliersInitiative.PrecertTickets', 'suppliersInitiative.WorkflowStatus', 'suppliersInitiative.TicketDocuments', 'suppliersInitiative.TicketMessages'
                         )
                         then cast(
                                  pt.ticket_number as String(50)
                              )
                    when Changes.entity = 'suppliersInitiative.BusinessPartners'
                         then 'BP:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.Addresses'
                         then 'BP-Direccion:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.TaxNumbers'
                         then 'BP-NroFiscal:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.BankDetails'
                         then 'BP-DatosBanco:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.Contacts'
                         then 'BP-Contacto:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.CollectionsEmails'
                         then 'BP-EmailCobranza:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.TaxData'
                         then 'BP-DatosImp:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.WithholdingTaxes'
                         then 'BP-Retenciones:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.CompanyData'
                         then 'BP-Sociedad:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.PurchasingData'
                         then 'BP-Compras:' || Changes.objectID
                    when Changes.entity = 'suppliersInitiative.BusinessPartnerDocuments'
                         then 'BP-Doc:' || Changes.objectID
                    else Changes.objectID
                end               as Ticket  : String(80),

                case
                    when Changes.entity = 'suppliersInitiative.PrecertTickets'
                         then 'Ticket'
                    when Changes.entity = 'suppliersInitiative.WorkflowStatus'
                         then 'Estado Workflow'
                    when Changes.entity = 'suppliersInitiative.TicketDocuments'
                         then 'Documento Ticket'
                    when Changes.entity = 'suppliersInitiative.TicketMessages'
                         then 'Mensaje Ticket'
                    when Changes.entity = 'suppliersInitiative.BusinessPartners'
                         then 'Business Partner'
                    when Changes.entity = 'suppliersInitiative.Addresses'
                         then 'Dirección BP'
                    when Changes.entity = 'suppliersInitiative.TaxNumbers'
                         then 'Nro. Fiscal BP'
                    when Changes.entity = 'suppliersInitiative.BankDetails'
                         then 'Datos Bancarios BP'
                    when Changes.entity = 'suppliersInitiative.Contacts'
                         then 'Contacto BP'
                    when Changes.entity = 'suppliersInitiative.CollectionsEmails'
                         then 'Email Cobranza BP'
                    when Changes.entity = 'suppliersInitiative.TaxData'
                         then 'Datos Impositivos BP'
                    when Changes.entity = 'suppliersInitiative.WithholdingTaxes'
                         then 'Retenciones BP'
                    when Changes.entity = 'suppliersInitiative.CompanyData'
                         then 'Datos Sociedad BP'
                    when Changes.entity = 'suppliersInitiative.PurchasingData'
                         then 'Datos Compras BP'
                    when Changes.entity = 'suppliersInitiative.BusinessPartnerDocuments'
                         then 'Documento BP'
                    else Changes.entity
                end               as Entidad : String(60),

                cast(
                    bpf.vat_registration as String(40)
                )                 as NumeroFiscal
        }

    union all

        select from ApplicationLogs {
            key ID             as LogID,
                createdAt      as Fecha,
                createdBy      as Usuario,
                modification   as Accion,
                description    as Descripcion,
                ticket_display as Ticket,
                app            as Entidad,
                cast(
                    business_partner.vat_registration as String(40)
                )              as NumeroFiscal
        };
