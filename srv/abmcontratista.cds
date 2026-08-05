using {suppliersInitiative as db} from '../db/vista-schema';
using {OP_API_BUSINESS_PARTNER_SRV as A_BusinessPartner} from './external/OP_API_BUSINESS_PARTNER_SRV';

service ABMContratistaService @(path: '/srv/businessPartners') {
    entity ErrorLogs                as projection on db.ErrorLogs;
    entity BusinessPartnerDocuments as projection on db.BusinessPartnerDocuments;
    entity BusinessPartners         as projection on db.BusinessPartners;
    entity WorkflowStatus           as projection on db.WorkflowStatus;
    entity BPApprovals              as projection on db.BPApprovals;
    entity BusinessPartnerModifications as projection on db.BusinessPartnerModifications;
    entity Addresses                as projection on db.Addresses;
    entity TaxNumbers               as projection on db.TaxNumbers;
    entity BankDetails              as projection on db.BankDetails;
    entity WithholdingTaxes         as projection on db.WithholdingTaxes;
    entity PurchasingData           as projection on db.PurchasingData;
    entity CompanyData              as projection on db.CompanyData;
    entity BusinessPartnerRoles     as projection on db.BusinessPartnerRoles;
    entity Contacts                 as projection on db.Contacts;
    entity Provinces                as projection on db.Provinces;
    entity Banks                    as projection on db.Banks;
    entity Countries                as projection on db.Countries;
    entity Regions                  as projection on db.Regions;
    entity Companies                as projection on db.Companies;
    entity LegalForms               as projection on db.LegalForms;
    entity TaxIdentificationTypes   as projection on db.TaxIdentificationTypes;
    @readonly entity WithholdingTaxCodes as projection on db.WithholdingTaxCodes;
    @readonly entity ResponsibleType     as projection on db.ResponsibleType;
    @readonly entity ExemptionReasons    as projection on db.ExemptionReasons;
    @readonly entity PaymentMethods      as projection on db.PaymentMethods;
    @readonly entity BusinessRoles       as projection on db.BusinessRoles;

    action   saveDocument(bp_id: UUID not null, file_name: String not null, document_type: String, description: String, file_url: String) returns { document_id: UUID };
    action   uploadDMScontratistas(bp_id: UUID not null, file_name: String not null, document_type: String, description: String, file_content: String not null) returns { document_id: UUID; dms_object_id: String };
    action   downloadDMScontratistas(bp_id: UUID not null, file_name: String not null, document_type: String, description: String) returns { value: LargeString };
    action   deleteDMScontratistas(bp_id: UUID not null, file_name: String not null, document_type: String, description: String) returns { deleted: Boolean };
    action   generateBPUploadToken(bp_id: UUID not null) returns { token: String; expires_in: Integer };

    action   addCustomAttribute(email: String not null,
                                attributeName: String not null, // ej: "customAttribute1"
                                attributeValue: String not null // ej: "2000003093"
    )                                                                    returns String;

    action   assignRole(email: String not null,
                        roleName: String not null)                       returns String;

    action   submitBPApproval(bp_id: UUID not null, s4_payload: LargeString) returns { bp_id: UUID; workflow_id: UUID; status: String };
    action   submitBlockWorkflow(bp_id: UUID not null, block: Boolean not null, comments: String) returns { bp_id: UUID; workflow_id: UUID; status: String };
    
    action   submitTreasuryModification(bp_id: UUID not null, comments: String) returns { bp_id: UUID; workflow_id: UUID; status: String };
    action   resubmitTreasuryModification(bp_id: UUID not null, enviar_teso: Boolean, payload: LargeString) returns { bp_id: UUID; workflow_id: UUID; status: String };
    action   approveTreasuryModification(bp_id: UUID not null, decision: String, additional_info: String) returns { message: String };
    
    action   submitTaxModification(bp_id: UUID not null, comments: String) returns { bp_id: UUID; workflow_id: UUID; status: String };
    action   resubmitTaxModification(bp_id: UUID not null, enviar_tax: Boolean, payload: LargeString) returns { bp_id: UUID; workflow_id: UUID; status: String };
    action   approveTaxModification(bp_id: UUID not null, decision: String, additional_info: String, approver_payload: LargeString) returns { message: String };

    // Pedido de modificacion iniciado por el propio proveedor (sin submit interno previo):
    // area = TESO | TAX; el mail va directo al aprobador de esa area.
    action   submitProviderModification(bp_id: UUID not null, area: String not null, payload: LargeString not null) returns { bp_id: UUID; area: String; workflow_id: UUID; status: String };

    action   confirmS4Creation(bp_id: UUID not null, s4_business_partner: String not null, lifnr: String) returns { bp_id: UUID; s4_business_partner: String; status: String };
    action   approveBPTask(bp_id: UUID not null, decision: String, additional_info: String) returns { message: String };
    action   resubmitBPAfterEdits(bp_id: UUID not null, editSection: String not null) returns { bp_id: UUID; workflow_id: UUID; status: String; section: String };

    action   importBPFromS4(lifnr: String not null) returns { bp_id: UUID; lifnr: String; status: String };
    action   importBPsFromS4(lifnrs: array of String not null) returns {
        imported : array of { lifnr: String; bp_id: UUID; status: String };
        failed   : array of { lifnr: String; error: String };
    };


    // Devuelve el BP leído de S4 con la misma forma que el payload de alta, serializado como JSON.
    function readBPFromS4AsPayload(lifnr: String not null) returns LargeString;

    function getUserInfo() returns { isAprobadorLegal: Boolean; isAprobadorImpuestos: Boolean; isCoordinador: Boolean };

    function getBPByDoc(tipoDoc: String, nroDoc: String, nombre: String) returns array of BusinessPartnerExt;

    
    function me()                                                                     returns {
        email : String;
        roles : array of String;
        bp_ID : String;
    };
    entity BusinessPartnerExt       as projection on A_BusinessPartner.A_BusinessPartner;
}
