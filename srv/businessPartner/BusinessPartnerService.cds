using { supplierPortalGD as db } from '../../db/schema';

service BusinessPartnerService {
    entity BusinessPartnerDocuments as projection on db.BusinessPartnerDocuments;
    entity BusinessPartners         as projection on db.BusinessPartners;
    entity WorkflowStatus           as projection on db.WorkflowStatus;
    entity Addresses                as projection on db.Addresses;
    entity TaxNumbers               as projection on db.TaxNumbers;
    entity BankDetails              as projection on db.BankDetails;
    entity WithholdingTaxes         as projection on db.WithholdingTaxes;
    entity PurchasingData           as projection on db.PurchasingData;
    entity CompanyData              as projection on db.CompanyData;
    entity Contacts                 as projection on db.Contacts;
}