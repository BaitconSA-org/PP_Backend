using supplierPortalGD from '../db/schema';

// Órdenes de compra
using { purchaseorder_edmx as ext } from './external/purchaseorder_edmx.csn';
// Facturación Proveedor
using { A_SupplierInvoice_edmx as inv } from './external/A_SupplierInvoice/A_SupplierInvoice_edmx.csn';
// Business Partner
using { A_BusinessPartner as prt } from './external/A_BusinessPartner/A_BusinessPartner_edmx.csn';

// View agregados con totales
using {
  PurchaseOrderNetAmount      as VirtualPONet,
  PurchaseOrderSupplierInvoiceAmount as VirtualSuppInv,
  PurchaseOrderItemSupplierInvoiceAmount as VirtualItemSuppInv
} from './aggregates/Virtual';



@path : 'ppservices'
service SupplierPortalService
{
    annotate PurchaseOrderExt with @restrict :
    [
        { grant : [ '*' ], to : [ 'Supplier' ] },
        { grant : [ '*' ], to : [ 'authenticated-user' ] }
    ];

    annotate SupplierInvoiceExt with @restrict : 
    [
        { grant : [ '*' ], to : [ 'Supplier' ] },
        { grant : [ '*' ], to : [ 'authenticated-user' ] }
    ];

    annotate PurchaseOrderNetAmount with @restrict : [
    { grant: ['READ'], to: ['Supplier'] },
    { grant: ['READ'], to: ['authenticated-user'] }
    ];

    annotate PurchaseOrderSupplierInvoiceAmount with @restrict : [
        { grant: ['READ'], to: ['Supplier'] },
        { grant: ['READ'], to: ['authenticated-user'] }
    ];

    annotate PurchaseOrderItemSupplierInvoiceAmount with @restrict : [
        { grant: ['READ'], to: ['Supplier'] },
        { grant: ['READ'], to: ['authenticated-user'] }
    ];



    entity Suppliers as
        projection on supplierPortalGD.Suppliers;

    entity SupplierUsers as
        projection on supplierPortalGD.SupplierUsers;

    entity Roles as
        projection on supplierPortalGD.Roles;

    entity Permissions as
        projection on supplierPortalGD.Permissions;

    entity Products as
        projection on supplierPortalGD.Products;

    entity PurchaseOrders as
        projection on supplierPortalGD.PurchaseOrders;

    entity PurchaseOrderItems as
        projection on supplierPortalGD.PurchaseOrderItems;

    entity Invoices as
        projection on supplierPortalGD.Invoices;

    entity InvoiceAttachments as
        projection on supplierPortalGD.InvoiceAttachments;

    entity Contracts as
        projection on supplierPortalGD.Contracts;

    entity SupplierEvaluations as
        projection on supplierPortalGD.SupplierEvaluations;

    entity SupplierDocuments as
        projection on supplierPortalGD.SupplierDocuments;

    entity Notifications as
        projection on supplierPortalGD.Notifications;


    @readonly
        entity PurchaseOrderExt as select from ext.PurchaseOrder as po {
        key po.PurchaseOrder,
        po.PurchaseOrderType,
        po.PurchaseOrderSubtype,
        po.PurchasingDocumentOrigin,
        po.PurchasingDocumentProcessCode,
        po.CreatedByUser,
        po.CreationDate,
        po.PurchaseOrderDate,
        po.LastChangeDateTime,
        po.ValidityStartDate,
        po.ValidityEndDate,
        po.Language,
        po.PurchaseOrderDeletionCode,
        po.ReleaseIsNotCompleted,
        po.PurchasingCompletenessStatus,
        po.PurchasingProcessingStatus,
        po.PurgReleaseSequenceStatus,
        po.ReleaseCode,
        po.PurchasingReleaseStrategy,
        po.PurgReasonForDocCancellation,
        po.CompanyCode,
        po.PurchasingOrganization,
        po.PurchasingGroup,
        po.Supplier,
        po.ManualSupplierAddressID,
        po.SupplierAddressID,
        po.SupplierRespSalesPersonName,
        po.SupplierPhoneNumber,
        po.SupplyingSupplier,
        po.SupplyingPlant,
        po.InvoicingParty,
        po.Customer,
        po.PurchaseContract,
        po.SupplierQuotationExternalID,
        po.QuotationSubmissionDate,
        po.ItemNumberIntervalForSubItems,
        po.PaymentTerms,
        po.CashDiscount1Days,
        po.CashDiscount2Days,
        po.NetPaymentDays,
        po.CashDiscount1Percent,
        po.CashDiscount2Percent,
        po.DownPaymentType,
        po.DownPaymentPercentageOfTotAmt,
        po.DownPaymentAmount,
        po.DownPaymentDueDate,
        po.IncotermsClassification,
        po.IncotermsTransferLocation,
        po.IncotermsVersion,
        po.IncotermsLocation1,
        po.IncotermsLocation2,
        po.IsIntrastatReportingRelevant,
        po.IsIntrastatReportingExcluded,
        po.CorrespncExternalReference,
        po.CorrespncInternalReference,
        po.PricingDocument,
        po.PricingProcedure,
        po.DocumentCurrency,
        po.ExchangeRate,
        po.ExchangeRateIsFixed,
        po.TaxReturnCountry,
        po.VATRegistrationCountry,
        po.PurgAggrgdProdCmplncSuplrSts,
        po.PurgAggrgdProdMarketabilitySts,
        po.PurgAggrgdSftyDataSheetStatus,
        po.PurgProdCmplncTotDngrsGoodsSts,
        po.PurchasingCollectiveNumber,
        po.SAP__Messages,
        po._SupplierAddress,
        // ✅ Campos agregados
        cast(null as Decimal(15,2)) as NetAmountTotal,
        cast(null as Decimal(15,2)) as SupplierInvoiceAmountTotal,
        cast(null as Integer) as InvoicePercent,
        cast(null as Integer) as InvoiceStatusColor,
        _PurchaseOrderItem : Composition of many PurchaseOrderItemExt
             on _PurchaseOrderItem.PurchaseOrder = PurchaseOrder

        }

    // Anotaciones UI
  annotate PurchaseOrderExt with {
    InvoicePercent @UI.DataPoint #Coverage : {
      title: 'Cobertura de Factura (%)',
      value: 'InvoicePercent',
      criticality: 'InvoiceStatusColor'
    };
  };



    @readonly
    @cds.redirection.target : true
    entity PurchaseOrderItemExt as select from ext.PurchaseOrderItem as poi {
        key poi.PurchaseOrder,
        key poi.PurchaseOrderItem,
        poi.PurchaseOrderCategory,
        poi.DocumentCurrency,
        poi.PurchasingDocumentDeletionCode,
        poi.MaterialGroup,
        poi.Material,
        poi.MaterialType,
        poi.SupplierMaterialNumber,
        poi.SupplierSubrange,
        poi.ManufacturerPartNmbr,
        poi.Manufacturer,
        poi.ManufacturerMaterial,
        poi.PurchaseOrderItemText,
        poi.ProductTypeCode,
        poi.CompanyCode,
        poi.Plant,
        poi.ManualDeliveryAddressID,
        poi.ReferenceDeliveryAddressID,
        poi.Customer,
        poi.Subcontractor,
        poi.SupplierIsSubcontractor,
        poi.CrossPlantConfigurableProduct,
        poi.ArticleCategory,
        poi.PlndOrderReplnmtElmntType,
        poi.ProductPurchasePointsQtyUnit,
        poi.ProductPurchasePointsQty,
        poi.StorageLocation,
        poi.PurchaseOrderQuantityUnit,
        poi.OrderItemQtyToBaseQtyNmrtr,
        poi.OrderItemQtyToBaseQtyDnmntr,
        poi.NetPriceQuantity,
        poi.IsCompletelyDelivered,
        poi.IsFinallyInvoiced,
        poi.GoodsReceiptIsExpected,
        poi.InvoiceIsExpected,
        poi.IsOrderAcknRqd,
        poi.InvoiceIsGoodsReceiptBased,
        poi.PurchaseContract,
        poi.PurchaseContractItem,
        poi.PurchaseRequisition,
        poi.PurchaseRequisitionItem,
        poi.RequirementTracking,
        poi.SupplierQuotation,
        poi.SupplierQuotationItem,
        poi.EvaldRcptSettlmtIsAllowed,
        poi.UnlimitedOverdeliveryIsAllowed,
        poi.OverdelivTolrtdLmtRatioInPct,
        poi.UnderdelivTolrtdLmtRatioInPct,
        poi.RequisitionerName,
        poi.PlannedDeliveryDurationInDays,
        poi.GoodsReceiptDurationInDays,
        poi.PartialDeliveryIsAllowed,
        poi.ConsumptionPosting,
        poi.ServicePerformer,
        poi.ServicePackage,
        poi.BaseUnit,
        poi.PurchaseOrderItemCategory,
        poi.ProfitCenter,
        poi.OrderPriceUnit,
        poi.ItemVolumeUnit,
        poi.ItemWeightUnit,
        poi.MultipleAcctAssgmtDistribution,
        poi.PartialInvoiceDistribution,
        poi.PricingDateControl,
        poi.IsStatisticalItem,
        poi.PurchasingParentItem,
        poi.GoodsReceiptLatestCreationDate,
        poi.IsReturnsItem,
        poi.PurchasingOrderReason,
        poi.IncotermsClassification,
        poi.IncotermsTransferLocation,
        poi.IncotermsLocation1,
        poi.IncotermsLocation2,
        poi.PriorSupplier,
        poi.InternationalArticleNumber,
        poi.IntrastatServiceCode,
        poi.CommodityCode,
        poi.MaterialFreightGroup,
        poi.DiscountInKindEligibility,
        poi.PurgItemIsBlockedForDelivery,
        poi.SupplierConfirmationControlKey,
        poi.PurgDocOrderAcknNumber,
        poi.PriceIsToBePrinted,
        poi.AccountAssignmentCategory,
        poi.PurchasingInfoRecord,
        poi.NetAmount,
        poi.GrossAmount,
        poi.EffectiveAmount,
        poi.Subtotal1Amount,
        poi.Subtotal2Amount,
        poi.Subtotal3Amount,
        poi.Subtotal4Amount,
        poi.Subtotal5Amount,
        poi.Subtotal6Amount,
        poi.OrderQuantity,
        poi.NetPriceAmount,
        poi.ItemVolume,
        poi.ItemGrossWeight,
        poi.ItemNetWeight,
        poi.OrderPriceUnitToOrderUnitNmrtr,
        poi.OrdPriceUnitToOrderUnitDnmntr,
        poi.GoodsReceiptIsNonValuated,
        poi.IsToBeAcceptedAtOrigin,
        poi.TaxCode,
        poi.TaxJurisdiction,
        poi.TaxCountry,
        poi.TaxDeterminationDate,
        poi.ShippingInstruction,
        poi.NonDeductibleInputTaxAmount,
        poi.StockType,
        poi.ValuationType,
        poi.ValuationCategory,
        poi.ItemIsRejectedBySupplier,
        poi.PurgDocPriceDate,
        poi.PurchasingInfoRecordUpdateCode,
        poi.InventorySpecialStockType,
        poi.DeliveryDocumentType,
        poi.IssuingStorageLocation,
        poi.AllocationTable,
        poi.AllocationTableItem,
        poi.RetailPromotion,
        poi.PurgConfigurableItemNumber,
        poi.PurgDocAggrgdSubitemCategory,
        poi.PurgExternalSortNumber,
        poi.Batch,
        poi.PurchasingItemIsFreeOfCharge,
        poi.DownPaymentType,
        poi.DownPaymentPercentageOfTotAmt,
        poi.DownPaymentAmount,
        poi.DownPaymentDueDate,
        poi.ExpectedOverallLimitAmount,
        poi.OverallLimitAmount,
        poi.PurContractForOverallLimit,
        poi.PurContractItemForOverallLimit,
        poi.PurgProdCmplncSupplierStatus,
        poi.PurgProductMarketabilityStatus,
        poi.PurgSafetyDataSheetStatus,
        poi.PurgProdCmplncDngrsGoodsStatus,
        poi.BR_MaterialOrigin,
        poi.BR_MaterialUsage,
        poi.BR_CFOPCategory,
        poi.BR_NCM,
        poi.ConsumptionTaxCtrlCode,
        poi.BR_IsProducedInHouse,
        poi.ProductSeasonYear,
        poi.ProductSeason,
        poi.ProductCollection,
        poi.ProductTheme,
        poi.SeasonCompletenessStatus,
        poi.ShippingGroupRule,
        poi.ShippingGroupNumber,
        poi.ProductCharacteristic1,
        poi.ProductCharacteristic2,
        poi.ProductCharacteristic3,
        poi.PurgDocSubitemCategory,
        poi.DiversionStatus,
        poi.ReferenceDocumentNumber,
        poi.ReferenceDocumentItem,
        poi.PurchaseOrderReferenceType,
        poi.ItemHasValueAddedService,
        poi.ValAddedSrvcParentItmNumber,
        poi.StockSegment,
        poi.SAP__Messages,
        cast(null as Decimal(15,2)) as SupplierInvoiceItemAmount
    }
        

    entity PurchaseOrderSupplierAddress as projection on ext.PurchaseOrderSupplierAddress;

    @readonly
    entity SupplierInvoiceExt as
        projection on inv.A_SupplierInvoice {
            key SupplierInvoice,
            key FiscalYear,
            *,
            _InvoiceItem: Association to many SupplierInvoiceItemExt
                on _InvoiceItem.SupplierInvoice = SupplierInvoice
                and _InvoiceItem.FiscalYear = FiscalYear
        };

    @readonly
    @cds.redirection.target : true
    entity SupplierInvoiceItemExt as projection on inv.A_SuplrInvcItemPurOrdRef;


    @readonly
    entity BusinessPartnerExt as select from prt.A_BusinessPartner as bp {
    key bp.BusinessPartner,
        bp.Customer,
        bp.Supplier,
        bp.BusinessPartnerFullName,
        bp.CreationDate,
        bp.to_Customer,
        bp.Language,
        bp.LastName,
        bp.BusinessPartnerBirthplaceName,
        bp.NameCountry,
        bp.to_Supplier,
        bp.to_BusinessPartner,
        bp.to_BusinessPartnerAddress
    }


    // Exponiendo vistas Virtuales
    @readonly
    entity PurchaseOrderNetAmount as projection on VirtualPONet{
        key PurchaseOrder,
        NetAmount
    };

    @readonly
    entity PurchaseOrderSupplierInvoiceAmount as projection on VirtualSuppInv;

    @readonly
    entity PurchaseOrderItemSupplierInvoiceAmount as projection on VirtualItemSuppInv;


}

annotate SupplierPortalService with @requires : ['Supplier'];
