using supplierPortalGD from '../db/schema';

using { supplierPortalGD.TaxCodes as TaxCodes_, supplierPortalGD.TaxCodesFooter as TaxCodesFooter_ } from '../db/schema';

// Órdenes de compra
using { purchaseorder_edmx as ext } from './external/purchaseorder_edmx.csn';
// Facturación Proveedor
using { A_SupplierInvoice_edmx as inv } from './external/A_SupplierInvoice/A_SupplierInvoice_edmx.csn';
// Business Partner
using { A_BusinessPartner as prt } from './external/A_BusinessPartner/A_BusinessPartner_edmx.csn';

// Material Document
using { A_MaterialDocument as mat } from './external/A_MaterialDocument/A_MaterialDocument.csn';

// Purchase Contract Service
using { API_PURCHASECONTRACT_PROCESS_SRV_0002 as PCAPI } from './external/PurchaseContract/API_PURCHASECONTRACT_PROCESS_SRV_0002.csn';


//Payment Advice Service
//using { API_PAYMENT_ADVICE_SRV as pay } from './external/A_PaymentAdvice/API_PAYMENT_ADVICE_SRV.csn';

//Payment Orders Service
//using { API_OPLACCTGDOCITEMCUBE_SRV as acc } from './external/API_OPLACCTGDOCITEMCUBE/API_OPLACCTGDOCITEMCUBE_SRV.csn';


// View agregados con totales 
using {
  PurchaseOrderNetAmount      as VirtualPONet,
  PurchaseOrderSupplierInvoiceAmount as VirtualSuppInv,
  PurchaseOrderItemSupplierInvoiceAmount as VirtualItemSuppInv
} from './aggregates/Virtual';


using {
  PurchaseOrderSupplierInvoices      as PO_SI,
} from './aggregates/views/PurchaseOrderSupplierInvoices';


@path : 'ppservices'
service SupplierPortalService
{
    annotate PurchaseOrderExt with @restrict :
    [
        { grant : [ '*' ], to : [ 'SupplierUser' ] },
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

    // Tablas Locales (CSV)
    entity TaxCodes             as projection on TaxCodes_;
    entity TaxCodesFooter       as projection on TaxCodesFooter_;


    entity Invoices             as projection on supplierPortalGD.Invoices{
      *,   // incluye invoiceNumber, supplier, purchaseOrderID, documentDate, …, files
      createdAt,
      invoiceItems : Composition of many InvoiceItems
        on invoiceItems.invoice = $self,

      // asociación a PurchaseOrderExt
      toPurchaseOrder : Association to PurchaseOrderExt
        on toPurchaseOrder.PurchaseOrder = purchaseOrderID,

      // asociación a SupplierInvoiceExt (tiene dos claves)
      toSupplierInvoice : Association to SupplierInvoiceExt
        on toSupplierInvoice.SupplierInvoice = supplierInvoice
      and toSupplierInvoice.FiscalYear = fiscalYear
    }

    entity InvoiceItems           as projection on supplierPortalGD.InvoiceItems {
        *,
        invoice : redirected to Invoices,
        // asociación a PurchaseOrderItemExt
        toPurchaseOrderItem : Association to PurchaseOrderItemExt
            on toPurchaseOrderItem.PurchaseOrder = purchaseOrder
            and toPurchaseOrderItem.PurchaseOrderItem = purchaseOrderItem
    };

    entity InvoiceTaxes           as projection on supplierPortalGD.InvoiceTaxes; 
    entity InvoiceAttachments     as projection on supplierPortalGD.InvoiceAttachments;
    entity InvoiceGLAccounts      as projection on supplierPortalGD.InvoiceGLAccounts;
    entity InvoiceAttachmentItems as projection on supplierPortalGD.InvoiceAttachmentItems;
    entity InvoiceStatus          as projection on supplierPortalGD.InvoiceStatus;
    //entity PaymentOrders          as projection on supplierPortalGD.PaymentOrders;
    //entity PaymentOrderRefs      as projection on supplierPortalGD.PaymentOrderRefs;

    @cds.redirection.target
    @readonly
        entity PurchaseOrderExt   as select from ext.PurchaseOrder as po {
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
        @cds.persistence.skip
        cast(null as Decimal(15,2)) as NetAmountTotal,
        @cds.persistence.skip
        cast(null as Decimal(15,2)) as SupplierInvoiceAmountTotal,
        @cds.persistence.skip
        cast(null as Decimal(15,2)) as UnitPrice,
        @cds.persistence.skip
        cast(null as Integer) as InvoicePercent,
        @cds.persistence.skip
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
        cast(null as Decimal(15,2)) as SupplierInvoiceItemAmount,
        cast(null as Decimal(15,2)) as QuantityInPurchaseOrderUnit,
        cast(null as Decimal(15,2)) as UnitPrice,
        

        // Asociaciones
   _InvoiceItems : Association to many SupplierInvoiceItemExt
        on  _InvoiceItems.PurchaseOrder     = $self.PurchaseOrder
        and _InvoiceItems.PurchaseOrderItem = $self.PurchaseOrderItem,

   _MaterialItems : Association to many MaterialDocumentItemExt
    on  _MaterialItems.PurchaseOrder     = $self.PurchaseOrder
    and _MaterialItems.PurchaseOrderItem = $self.PurchaseOrderItem

    }
      @readonly
      @cds.redirection.target : true
      @cds.api: true
      entity MaterialDocumentExt as select from mat.A_MaterialDocumentHeader as md {
        key md.MaterialDocumentYear,
        key md.MaterialDocument,
        md.InventoryTransactionType,
        md.DocumentDate,
        md.PostingDate,
        md.CreationDate,
        md.CreationTime,
        md.CreatedByUser,
        md.MaterialDocumentHeaderText,
        md.ReferenceDocument,
        md.VersionForPrintingSlip,
        md.ManualPrintIsTriggered,
        md.CtrlPostgForExtWhseMgmtSyst,
        md.GoodsMovementCode,
        _Items : Composition of many mat.A_MaterialDocumentItem
          on _Items.MaterialDocument = $self.MaterialDocument
          and _Items.MaterialDocumentYear = $self.MaterialDocumentYear
      }


      @readonly
      @cds.api: true
      @cds.redirection.target : true

      entity MaterialDocumentItemExt as select from mat.A_MaterialDocumentItem as item {
        key item.MaterialDocumentYear,
        key item.MaterialDocument,
        key item.MaterialDocumentItem,

        item.Material,
        item.Plant,
        item.StorageLocation,
        item.Batch,
        item.BatchBySupplier,
        item.GoodsMovementType,
        item.InventoryStockType,
        item.InventoryValuationType,
        item.InventorySpecialStockType,
        item.Supplier,
        item.Customer,
        item.SalesOrder,
        item.SalesOrderItem,
        item.SalesOrderScheduleLine,
        item.PurchaseOrder,
        item.PurchaseOrderItem,
        item.WBSElement,
        item.ManufacturingOrder,
        item.ManufacturingOrderItem,
        item.GoodsMovementRefDocType,
        item.GoodsMovementReasonCode,
        item.Delivery,
        item.DeliveryItem,
        item.AccountAssignmentCategory,
        item.CostCenter,
        item.ControllingArea,
        item.CostObject,
        item.GLAccount,
        item.FunctionalArea,
        item.ProfitabilitySegment,
        item.ProfitCenter,
        item.MasterFixedAsset,
        item.FixedAsset,
        item.MaterialBaseUnitISOCode,
        item.MaterialBaseUnitSAPCode,
        item.MaterialBaseUnit,
        item.QuantityInBaseUnit,
        item.EntryUnitISOCode,
        item.EntryUnitSAPCode,
        item.EntryUnit,
        item.QuantityInEntryUnit,
        item.CompanyCodeCurrency,
        item.GdsMvtExtAmtInCoCodeCrcy,
        item.SlsPrcAmtInclVATInCoCodeCrcy,
        item.FiscalYear,
        item.FiscalYearPeriod,
        item.FiscalYearVariant,
        item.IssgOrRcvgMaterial,
        item.IssgOrRcvgBatch,
        item.IssuingOrReceivingPlant,
        item.IssuingOrReceivingStorageLoc,
        item.IssuingOrReceivingStockType,
        item.IssgOrRcvgSpclStockInd,
        item.IssuingOrReceivingValType,
        item.IsCompletelyDelivered,
        item.MaterialDocumentItemText,
        item.GoodsRecipientName,
        item.UnloadingPointName,
        item.ShelfLifeExpirationDate,
        item.ManufactureDate,
        item.SerialNumbersAreCreatedAutomly,
        item.Reservation,
        item.ReservationItem,
        item.ReservationItemRecordType,
        item.ReservationIsFinallyIssued,
        item.SpecialStockIdfgSalesOrder,
        item.SpecialStockIdfgSalesOrderItem,
        item.SpecialStockIdfgWBSElement,
        item.IsAutomaticallyCreated,
        item.MaterialDocumentLine,
        item.MaterialDocumentParentLine,
        item.HierarchyNodeLevel,
        item.GoodsMovementIsCancelled,
        item.ReversedMaterialDocumentYear,
        item.ReversedMaterialDocument,
        item.ReversedMaterialDocumentItem,
        item.ReferenceDocumentFiscalYear,
        item.InvtryMgmtRefDocumentItem,
        item.InvtryMgmtReferenceDocument,
        item.MaterialDocumentPostingType,
        item.InventoryUsabilityCode,
        item.EWMWarehouse,
        item.EWMStorageBin,
        item.DebitCreditCode,

        // Asociación inversa hacia el encabezado
        to_MaterialDocumentHeader : Association to MaterialDocumentExt

          on to_MaterialDocumentHeader.MaterialDocument     = $self.MaterialDocument
          and to_MaterialDocumentHeader.MaterialDocumentYear = $self.MaterialDocumentYear

      };
              

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
    entity SupplierInvoiceItemExt as projection on inv.A_SuplrInvcItemPurOrdRef {
    *,
    
    _SupplierInvoice: Association to inv.A_SupplierInvoice
        on  _SupplierInvoice.SupplierInvoice = SupplierInvoice
        and _SupplierInvoice.FiscalYear     = FiscalYear
    }


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
    // Payment Advice Service Entities
    /*
    @readonly
      entity PaymentAdviceExt as select from pay.A_PaymentAdvice as h {
        key h.PaymentAdvice,                 // N° OP
        h.CompanyCode,
        h.PaymentDate,
        h.PaymentCurrency,
        h.PaidAmountInPaytCurrency as Amount,
        h.PaymentAdviceStatus,
        h.BusinessPartnerName
      };
      @readonly
      entity PaymentAdviceItemExt as select from pay.A_PaymentAdviceItem as i {
        key i.CompanyCode,
        key i.PaymentAdvice,
        key i.PaymentAdviceItem,

        i.AccountingDocument,
        i.FiscalYear,
        i.AccountingDocumentItem,
        i.NetPaymentAmountInPaytCurrency,
        i.Currency
      };
    // Accounting Document Items
     @readonly
      entity PaymentOrderItems as projection on acc.A_OperationalAcctgDocItemCube {
       key CompanyCode,
       key FiscalYear,
      key AccountingDocument,
      key AccountingDocumentItem,

      Supplier,
      SupplierName,
      PostingDate,
      DocumentDate,
      AccountingDocumentType,
      AmountInCompanyCodeCurrency,
      CompanyCodeCurrency,

      // Identificación del pago / OP (necesarios para agrupar)
      ClearingAccountingDocument,
      ClearingDocFiscalYear,
      ClearingDate,

      IsUsedInPaymentTransaction,
      HasPaymentOrder,
      PaymentReference
    };*/

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

     // FIN vistas Virtuales


    // Proyección directa de la vista agregada
  @readonly
  entity PurchaseOrderSupplierInvoices as projection on PO_SI {
    key PurchaseOrder,
    key SupplierInvoice,
    key FiscalYear,
        TotalAmount,
        InvoiceDate
  }

  // PurchaseOrder + posiciones + facturas
  entity PurchaseOrderWithInvoices as projection on ext.PurchaseOrder {
    key PurchaseOrder,
    Supplier,
    PurchaseOrderDate,

    _SupplierInvoices: Composition of many PO_SI
      on _SupplierInvoices.PurchaseOrder = $self.PurchaseOrder
  }

  //Proyección para Payment Orders Cabecera
  /*
  @readonly
  @cds.persistence.skip
  entity PaymentOrdersExt {
    key CompanyCode              : String(4);
    key ClearingDocFiscalYear    : String(4);
    key ClearingAccountingDocument : String(10);

    PaymentOrderNumber : String(35);   // ej: PaymentReference si corresponde
    ClearingDate       : Date;

    Supplier           : String(20);
    SupplierName       : String(80);

    CompanyCodeName    : String(80);

    Amount             : Decimal(15,2);
    Currency           : String(3);

    // Cabecera enriquecida BP
    SupplierFullAddress: String(255);
    SupplierCUIT       : String(20);
    SupplierEmail      : String(255);
    SupplierCBU        : String(40);

    // Empresa (si no lo trae API, mantenelo local)
    CompanyCUIT        : String(20);
    CompanyIIBB        : String(40);
    CompanyAddress     : String(255);

    virtual pdfUrl     : String(500);
    virtual pdfText    : String(10);

    // Navegación a items (para Object Page)
    to_Items : Association to many PaymentOrderItems
      on to_Items.CompanyCode = CompanyCode
    and to_Items.ClearingDocFiscalYear = ClearingDocFiscalYear
    and to_Items.ClearingAccountingDocument = ClearingAccountingDocument;
  }
*/

  // -------- PRECERTIFICACION VISTA --------//
      entity PrecertTickets as projection on supplierPortalGD.PrecertTickets {
  *,
  null as LimitedDescendantCount : Integer,
  null as DistanceFromRoot       : Integer,
  null as DrillState             : String,
  null as LimitedRank            : Integer
};
      entity PrecertItemCandidate as projection on supplierPortalGD.PrecertItemCandidate;
      @readonly
      @restrict: [
        { grant: 'READ', to: 'Admin' },      ]
      entity PrecertTicketSplitLog as projection on supplierPortalGD.PrecertTicketSplitLog;
      @readonly

       entity PrecertTicketItems as projection on supplierPortalGD.PrecertTicketItems {
        *,
        ticket.sourceId   as PurchaseOrder,
        itemId            as PurchaseOrderItem
      };
      @readonly
      entity PurchaseOrderAccountAssignments
        as projection on ext.PurchaseOrderAccountAssignment {
          PurchaseOrder,
          PurchaseOrderItem,
          AccountAssignmentNumber,
          GLAccount,
          CostCenter,
          ProjectNetwork,
          OrderID
      };

      

  entity PurchaseContractExt
    as projection on PCAPI.A_PurchaseContract
  {
    key PurchaseContract,
        CompanyCode,
        PurchasingOrganization,
        PurchasingGroup,
        Supplier,
        DocumentCurrency,
        ValidityStartDate,
        ValidityEndDate,
        CreationDate,
        CreatedByUser,
        LastChangeDateTime,

        to_PurchaseContractItem as _PurchaseContractItem : redirected to PurchaseContractItemExt,
        to_PurchaseContractItem as Items : redirected to PurchaseContractItemExt

  };

  @readonly
  entity PurchaseContractItemExt
    as projection on PCAPI.A_PurchaseContractItem
  {
    key PurchaseContract,
    key PurchaseContractItem,

        PurchasingDocumentItemCategory,
        Material,
        PurchaseContractItemText,
        Plant,
        TargetQuantity,
        OrderQuantityUnit,
        SupplierMaterialNumber,
        MaterialGroup
  };
  

extend supplierPortalGD.PrecertTickets with {
   purchaseOrder : Association to PurchaseOrderExt
    on purchaseOrder.PurchaseOrder = sourceId and sourceType = 'PO';

     contratoMarco : Association to PurchaseContractExt
    on contratoMarco.PurchaseContract = sourceId and sourceType = 'CM';

}

  // ACTION PRECERT

   action getPrecertCandidates(
    sourceType : String(10),   // "PO" | "CM"
    sourceId   : String(20)
  ) returns array of PrecertItemCandidate;

    type SubmitPrecertLine : {
    itemId     : String(10);
    qty        : Decimal(15,3);
    unitPrice  : Decimal(15,2);
    lineAmount : Decimal(15,2);
  };

    type SubmitPrecertResult {
    ticketId     : UUID;
    ticketNumero : Integer;
    status       : String(30);
    currency     : String(3);
    totalAmount  : Decimal(15,2);
    lines        : array of SubmitPrecertLine;
  }

    type CreatePrecertItem : {
    itemId        : String(10);
    qtyToCertify  : Decimal(15,3);
    placeOfService: String(100);
    dateFrom      : Date;
    dateTo        : Date;
  };

  type UpdatePrecertItem : {
  itemId         : String(10);          // Posición
  lineId         : String(20);          // Sub-línea: "0","1","2"... (split)

  qtyToCertify   : Decimal(15,3);
  placeOfService : String(100);
  dateFrom       : Date;
  dateTo         : Date;

  status         : String(30);          // "ENVIADO" | "APROBADO" | "RECHAZADO"
  AccountAssignmentNumber : String(2);
  GLAccount              : String(10);
  CostCenter             : String(10);
  ProjectNetwork         : String(12);
  OrderID                : String(12);
  };
    action createAndSubmitPrecertTicket(
    sourceType : String(10),
    sourceId   : String(20),
    items      : array of CreatePrecertItem
  ) returns SubmitPrecertResult;

  action submitPrecertTicket(ID : UUID) returns SubmitPrecertResult;

  action savePrecertTicketApproval(
  ID    : UUID,
  items : array of UpdatePrecertItem
) returns PrecertTickets;
  


    
  // ----> DOX
  action uploadPdf(
    supplierId       : String(20),
    purchaseOrderId  : String(20) null,
    file             : LargeBinary,
    filename         : String) returns String;
    
  action checkJob(documentId: String) returns String;

  // ----> DMS
  action createFolderService(folderName: String) returns String;
  action uploadDocumentService(folderName: String, name: String, file: LargeBinary) returns String;
  action deleteDocumentService(documentId: String, folderName: String);
  action deleteFolderService(folderId: String);
  action listDocumentsService(folderId: String) returns array of AttachmentData;
  action getFoldersService(relativePath: String) returns array of Folders;
  action createDocumentService(supplierId: String, purchaseOrderId: String null, documentName: String, file: LargeBinary) returns String;
  
  function getDocumentService(folderName: String, documentName: String) returns LargeBinary;

  type Folders : {
    name         : String;
    objectId     : String;
    createdBy    : String;
    creationDate : String;
  };

  type AttachmentData : {
    objectId: String;
    name: String;
    contentType: String;
    size: Integer;
};

// --> WORKFLOW
action startWorkflow(
    context: LargeString,
    definitionId: String
  ) returns WorkflowResponse;


type WorkflowResponse {
  status: String;
  instanceId: String;
  workflowDefinitionId: String;
}
// FIN --> WORKFLOW

// --> JOB SINCRONIZACIÓN INVOICES
action SyncInvoiceStatuses() returns array of SyncResult;

 // Acción que llamará el Workflow para actualizar la factura
  action UpdateInvoiceWorkflow(
    Invoice_ID      : UUID,
    supplierInvoice : String(20),
    fiscalYear      : String(4)
  ) returns {
    ID              : UUID;
    affectedRows    : Integer;
  };

type SyncResult {
  invoiceID: String;
  result: String;
}
 @readonly
  entity InvoiceReport as projection on supplierPortalGD.InvoiceReport;
     // 🔹 NUEVA FUNCIÓN para el tile dinámico del Launchpad
  function totalInvoicesCurrentMonth() returns Integer;


  // Proyecciones de tablas nuevas para CostCenters/Reportes/DocumentTypes/PaymentTerms/GLAccounts
  entity CostCenters as projection on supplierPortalGD.CostCenters;
  entity DocumentTypes as projection on supplierPortalGD.DocumentTypes;
  entity PaymentTerms as projection on supplierPortalGD.PaymentTerms;
  entity GlobalLedgerAccounts as projection on supplierPortalGD.GlobalLedgerAccounts;
  entity CompanyCode as projection on supplierPortalGD.CompanyCode;


  //proyecciones Roles

  entity Roles as projection on supplierPortalGD.Roles;

   type UserRoles : {
    isAdmin    : Boolean;
    isSupplier : Boolean;
    supplierIDs: array of String;
    scopes     : array of String;
  };

  action getUserRoles() returns UserRoles;

//annotate SupplierPortalService with @requires : ['Supplier'];
}
annotate SupplierPortalService.PrecertTickets
  @Aggregation.RecursiveHierarchy #TicketHierarchy : {
    ParentNavigationProperty : parentTicket,
    NodeProperty             : ID
  };

annotate SupplierPortalService.PrecertTickets with @(
  Hierarchy.RecursiveHierarchy #TicketHierarchy : {
    LimitedDescendantCount : LimitedDescendantCount,
    DistanceFromRoot       : DistanceFromRoot,
    DrillState             : DrillState,
    LimitedRank            : LimitedRank
  }
);
