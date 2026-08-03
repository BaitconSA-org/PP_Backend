/* checksum : faffd23ac7574b08e22c5fc98906a5da */
@cds.external : true
@m.IsDefaultEntityContainer : 'true'
@sap.supported.formats : 'atom json xlsx'
service OP_API_PURCHASEORDER_PROCESS_SRV_0001 {};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Subcontracting Components'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_POSubcontractingComponent {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing Document'
  key PurchaseOrder : String(10) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Purchasing Document Item'
  key PurchaseOrderItem : String(5) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Schedule Line'
  @sap.quickinfo : 'Delivery Schedule Line Counter'
  key ScheduleLine : String(4) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Reservation Item'
  @sap.creatable : 'false'
  key ReservationItem : String(4) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Reservation Record Type'
  @sap.creatable : 'false'
  key RecordType : String(1) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Material'
  @sap.quickinfo : 'Material Number'
  Material : String(40);
  @sap.label : 'BOM Item Text'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  BOMItemDescription : String(40);
  @sap.unit : 'BaseUnit'
  @sap.label : 'Requirement Quantity'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  RequiredQuantity : Decimal(13, 3);
  @sap.label : 'Base Unit of Measure'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.semantics : 'unit-of-measure'
  BaseUnit : String(3);
  @sap.display.format : 'Date'
  @sap.label : 'Requirement Date'
  @sap.quickinfo : 'Material Component Requirement Date'
  RequirementDate : Date;
  @sap.unit : 'EntryUnit'
  @sap.label : 'Quantity in Unit of Entry'
  QuantityInEntryUnit : Decimal(13, 3);
  @sap.label : 'Unit of Entry'
  @sap.quickinfo : 'Unit of entry'
  @sap.semantics : 'unit-of-measure'
  EntryUnit : String(3);
  @sap.unit : 'BaseUnit'
  @sap.label : 'Withdrawn Quantity'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  WithdrawnQuantity : Decimal(13, 3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Plant'
  Plant : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Batch'
  @sap.quickinfo : 'Batch Number'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  Batch : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Requirement Segment'
  RequirementSegment : String(40);
};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Purchase Order'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrder {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchase Order'
  @sap.quickinfo : 'Purchase Order Number'
  key PurchaseOrder : String(10) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Company Code'
  CompanyCode : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing Doc. Type'
  @sap.quickinfo : 'Purchasing Document Type'
  PurchaseOrderType : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Deletion Code'
  @sap.quickinfo : 'Purchase Order Deletion Code'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurchasingDocumentDeletionCode : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Proc. State'
  @sap.quickinfo : 'Purchasing Document Processing State'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurchasingProcessingStatus : String(2);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Created By'
  @sap.quickinfo : 'User of person who created a purchasing document'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  CreatedByUser : String(12);
  @sap.display.format : 'Date'
  @sap.label : 'Created On'
  @sap.quickinfo : 'Creation Date of Purchasing Document'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  CreationDate : Date;
  @odata.Type : 'Edm.DateTimeOffset'
  @odata.Precision : 7
  @sap.label : 'Last Changed'
  @sap.quickinfo : 'Change Time Stamp'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  LastChangeDateTime : Timestamp;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Supplier'
  Supplier : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Control indicator'
  @sap.quickinfo : 'Control indicator for purchasing document type'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurchaseOrderSubtype : String(1);
  @sap.label : 'Language Key'
  Language : String(2);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Payment Terms'
  @sap.quickinfo : 'Terms of Payment Key'
  PaymentTerms : String(4);
  @sap.label : 'Days 1'
  @sap.quickinfo : 'Cash Discount Days 1'
  CashDiscount1Days : Decimal(3, 0);
  @sap.label : 'Days 2'
  @sap.quickinfo : 'Cash Discount Days 2'
  CashDiscount2Days : Decimal(3, 0);
  @sap.label : 'Days Net'
  @sap.quickinfo : 'Net Payment Terms Period'
  NetPaymentDays : Decimal(3, 0);
  @sap.label : 'CD Percentage 1'
  @sap.quickinfo : 'Cash Discount Percentage 1'
  CashDiscount1Percent : Decimal(5, 3);
  @sap.label : 'CD Percentage 2'
  @sap.quickinfo : 'Cash Discount Percentage 2'
  CashDiscount2Percent : Decimal(5, 3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purch. Organization'
  @sap.quickinfo : 'Purchasing Organization'
  PurchasingOrganization : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Status'
  @sap.quickinfo : 'Status of Purchasing Document'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurchasingDocumentOrigin : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing Group'
  PurchasingGroup : String(3);
  @sap.display.format : 'Date'
  @sap.label : 'Purchase Order Date'
  PurchaseOrderDate : Date;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Currency'
  @sap.quickinfo : 'Currency Key'
  @sap.semantics : 'currency-code'
  DocumentCurrency : String(5);
  ExchangeRate : String(12);
  @sap.label : 'Fixed Exchange Rate'
  @sap.quickinfo : 'Indicator for Fixed Exchange Rate'
  ExchangeRateIsFixed : Boolean;
  @sap.display.format : 'Date'
  @sap.label : 'Validity Per. Start'
  @sap.quickinfo : 'Start of Validity Period'
  ValidityStartDate : Date;
  @sap.display.format : 'Date'
  @sap.label : 'Validity Period End'
  @sap.quickinfo : 'End of Validity Period'
  ValidityEndDate : Date;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Quotation'
  @sap.quickinfo : 'Quotation Number'
  SupplierQuotationExternalID : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Collective Number'
  PurchasingCollectiveNumber : String(10);
  @sap.label : 'Salesperson'
  @sap.quickinfo : 'Responsible Salesperson at Supplier''s Office'
  SupplierRespSalesPersonName : String(30);
  @sap.label : 'Supplier Phone'
  @sap.quickinfo : 'Supplier''s Phone Number'
  SupplierPhoneNumber : String(16);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Goods Supplier'
  SupplyingSupplier : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Supplying Plant'
  @sap.quickinfo : 'Supplying (issuing) plant in case of stock transport order'
  SupplyingPlant : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Incoterms'
  @sap.quickinfo : 'Incoterms (Part 1)'
  IncotermsClassification : String(3);
  @sap.label : 'Your Reference'
  CorrespncExternalReference : String(12);
  @sap.label : 'Our Reference'
  CorrespncInternalReference : String(12);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Invoicing Party'
  @sap.quickinfo : 'Different Invoicing Party'
  InvoicingParty : String(10);
  @sap.label : 'Subject to Release'
  @sap.quickinfo : 'Release Not Yet Completely Effected'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ReleaseIsNotCompleted : Boolean;
  @sap.label : 'Incomplete'
  @sap.quickinfo : 'Purchase order not yet complete'
  PurchasingCompletenessStatus : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Incoterms Version'
  IncotermsVersion : String(4);
  @sap.label : 'Incoterms Location 1'
  IncotermsLocation1 : String(70);
  @sap.label : 'Incoterms Location 2'
  IncotermsLocation2 : String(70);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Address Number'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ManualSupplierAddressID : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Busin. Purp. Cmpltd.'
  @sap.quickinfo : 'Business Purpose Completed'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  IsEndOfPurposeBlocked : String(1);
  @sap.label : 'City'
  AddressCityName : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Fax Number'
  @sap.quickinfo : 'Complete Number: Dialing Code+Number+Extension'
  AddressFaxNumber : String(30);
  @sap.label : 'House Number'
  AddressHouseNumber : String(10);
  @sap.label : 'Name'
  @sap.quickinfo : 'Name 1'
  AddressName : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Postal Code'
  @sap.quickinfo : 'City postal code'
  AddressPostalCode : String(10);
  @sap.label : 'Street'
  AddressStreetName : String(60);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Telephone number'
  @sap.quickinfo : 'Complete Number: Dialing Code+Number+Extension'
  AddressPhoneNumber : String(30);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Region'
  @sap.quickinfo : 'Region (State, Province, County)'
  AddressRegion : String(3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Country/Region Key'
  AddressCountry : String(3);
  @sap.label : 'Language Key'
  AddressCorrespondenceLanguage : String(2);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Supplier Check Sts'
  @sap.quickinfo : 'Product Compliance Supplier Check Status (All Items)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgAggrgdProdCmplncSuplrSts : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Prod. Marktablty Sts'
  @sap.quickinfo : 'Product Marketability Status (All Items)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgAggrgdProdMarketabilitySts : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Sfty Data Sheet Sts'
  @sap.quickinfo : 'Safety Data Sheet Status (All Items)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgAggrgdSftyDataSheetStatus : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Dangerous Goods Sts'
  @sap.quickinfo : 'Dangerous Goods Status (All Items)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgProdCmplncTotDngrsGoodsSts : String(1);
  to_PurchaseOrderItem : Composition of many OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrderItem {  };
  to_PurchaseOrderNote : Composition of many OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrderNote {  };
} actions {
  function GetOutputBinaryData() returns OP_API_PURCHASEORDER_PROCESS_SRV_0001.GetPDFResult;
  function GetPDF() returns OP_API_PURCHASEORDER_PROCESS_SRV_0001.GetPDFResult;
};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Item'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrderItem {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchase Order'
  @sap.quickinfo : 'Purchase Order Number'
  key PurchaseOrder : String(10) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Purchase Order Item'
  @sap.quickinfo : 'Item Number of Purchase Order'
  key PurchaseOrderItem : String(5) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Deletion Indicator'
  @sap.quickinfo : 'Deletion Indicator in Purchasing Document'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurchasingDocumentDeletionCode : String(1);
  @sap.label : 'Short Text'
  PurchaseOrderItemText : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Plant'
  Plant : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Storage Location'
  StorageLocation : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Material Group'
  MaterialGroup : String(9);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing info rec.'
  @sap.quickinfo : 'Number of purchasing info record'
  PurchasingInfoRecord : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Supplier Mat. No.'
  @sap.quickinfo : 'Material Number Used by Supplier'
  SupplierMaterialNumber : String(35);
  @sap.unit : 'PurchaseOrderQuantityUnit'
  @sap.label : 'Order Quantity'
  @sap.quickinfo : 'Purchase Order Quantity'
  OrderQuantity : Decimal(13, 3);
  @sap.label : 'Order Unit'
  @sap.quickinfo : 'Purchase Order Unit of Measure'
  @sap.semantics : 'unit-of-measure'
  PurchaseOrderQuantityUnit : String(3);
  @sap.label : 'Order Price Unit'
  @sap.quickinfo : 'Order Price Unit (Purchasing)'
  @sap.semantics : 'unit-of-measure'
  OrderPriceUnit : String(3);
  @sap.label : 'Quantity Conversion'
  @sap.quickinfo : 'Numerator for Conversion of Order Price Unit into Order Unit'
  OrderPriceUnitToOrderUnitNmrtr : Decimal(5, 0);
  @sap.label : 'Quantity Conversion'
  @sap.quickinfo : 'Denominator for Conv. of Order Price Unit into Order Unit'
  OrdPriceUnitToOrderUnitDnmntr : Decimal(5, 0);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Currency'
  @sap.quickinfo : 'Currency Key'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.semantics : 'currency-code'
  DocumentCurrency : String(5);
  @sap.unit : 'DocumentCurrency'
  @sap.label : 'Net Order Price'
  @sap.quickinfo : 'Net Price in Purchasing Document (in Document Currency)'
  NetPriceAmount : Decimal(12, 3);
  @sap.unit : 'OrderPriceUnit'
  @sap.label : 'Price Unit'
  NetPriceQuantity : Decimal(5, 0);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Tax Code'
  @sap.quickinfo : 'Tax on sales/purchases code'
  TaxCode : String(2);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Shipping Instr.'
  @sap.quickinfo : 'Shipping Instructions'
  ShippingInstruction : String(2);
  @sap.display.format : 'Date'
  @sap.label : 'Tax Date'
  @sap.quickinfo : 'Date for Determining Tax Rates'
  TaxDeterminationDate : Date;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Tax Ctry/Reg.'
  @sap.quickinfo : 'Tax Reporting Country/Region'
  TaxCountry : String(3);
  @sap.label : 'Print Price'
  @sap.quickinfo : 'Price Printout'
  PriceIsToBePrinted : Boolean;
  @sap.label : 'Overdeliv. Tolerance'
  @sap.quickinfo : 'Overdelivery Tolerance'
  OverdelivTolrtdLmtRatioInPct : Decimal(3, 1);
  @sap.label : 'Unltd Overdelivery'
  @sap.quickinfo : 'Unlimited Overdelivery Allowed'
  UnlimitedOverdeliveryIsAllowed : Boolean;
  @sap.label : 'Underdel. Tolerance'
  @sap.quickinfo : 'Underdelivery Tolerance'
  UnderdelivTolrtdLmtRatioInPct : Decimal(3, 1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Valuation Type'
  ValuationType : String(10);
  @sap.label : 'Delivery Completed'
  @sap.quickinfo : '&quot;Delivery Completed&quot; Indicator'
  IsCompletelyDelivered : Boolean;
  @sap.label : 'Final Invoice'
  @sap.quickinfo : 'Final Invoice Indicator'
  IsFinallyInvoiced : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Item Category'
  @sap.quickinfo : 'Item category in purchasing document'
  PurchaseOrderItemCategory : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Acct Assignment Cat.'
  @sap.quickinfo : 'Account Assignment Category'
  AccountAssignmentCategory : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Distrib. Indicator'
  @sap.quickinfo : 'Distribution Indicator for Multiple Account Assignment'
  MultipleAcctAssgmtDistribution : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Partial invoice'
  @sap.quickinfo : 'Partial invoice indicator'
  PartialInvoiceDistribution : String(1);
  @sap.label : 'Goods Receipt'
  @sap.quickinfo : 'Goods Receipt Indicator'
  GoodsReceiptIsExpected : Boolean;
  @sap.label : 'GR Non-Valuated'
  @sap.quickinfo : 'Goods Receipt, Non-Valuated'
  GoodsReceiptIsNonValuated : Boolean;
  @sap.label : 'Invoice Receipt'
  @sap.quickinfo : 'Invoice Receipt Indicator'
  InvoiceIsExpected : Boolean;
  @sap.label : 'GR-Based Inv. Verif.'
  @sap.quickinfo : 'Indicator: GR-Based Invoice Verification'
  InvoiceIsGoodsReceiptBased : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Outline agreement'
  @sap.quickinfo : 'Number of principal purchase agreement'
  PurchaseContract : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Agreement Item'
  @sap.quickinfo : 'Item Number of Principal Purchase Agreement'
  PurchaseContractItem : String(5);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Customer'
  Customer : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Supplier'
  @sap.quickinfo : 'Supplier to be Supplied/Who is to Receive Delivery'
  Subcontractor : String(10);
  @sap.label : 'SC Supplier'
  @sap.quickinfo : 'Subcontracting Supplier'
  SupplierIsSubcontractor : Boolean;
  @sap.unit : 'ItemWeightUnit'
  @sap.label : 'Net Weight'
  ItemNetWeight : Decimal(13, 3);
  @sap.label : 'Unit of Weight'
  @sap.semantics : 'unit-of-measure'
  ItemWeightUnit : String(3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Tax Jurisdiction'
  TaxJurisdiction : String(15);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Pricing Date Control'
  @sap.quickinfo : 'Price Determination (Pricing) Date Control'
  PricingDateControl : String(1);
  @sap.unit : 'ItemVolumeUnit'
  @sap.label : 'Volume'
  ItemVolume : Decimal(13, 3);
  @sap.label : 'Volume Unit'
  @sap.semantics : 'unit-of-measure'
  ItemVolumeUnit : String(3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Confirmation Control'
  @sap.quickinfo : 'Confirmation Control Key'
  SupplierConfirmationControlKey : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Incoterms'
  @sap.quickinfo : 'Incoterms (Part 1)'
  IncotermsClassification : String(3);
  @sap.label : 'Incoterms (Part 2)'
  IncotermsTransferLocation : String(28);
  @sap.label : 'Eval. Receipt Sett.'
  @sap.quickinfo : 'Evaluated Receipt Settlement (ERS)'
  EvaldRcptSettlmtIsAllowed : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchase Requisition'
  @sap.quickinfo : 'Purchase Requisition Number'
  PurchaseRequisition : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item of requisition'
  @sap.quickinfo : 'Item number of purchase requisition'
  PurchaseRequisitionItem : String(5);
  @sap.label : 'Returns Item'
  IsReturnsItem : Boolean;
  @sap.label : 'Requisitioner'
  @sap.quickinfo : 'Name of requisitioner/requester'
  RequisitionerName : String(12);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Package number'
  ServicePackage : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Earmarked Funds'
  @sap.quickinfo : 'Document Number for Earmarked Funds'
  EarmarkedFunds : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Earmarked Funds'
  @sap.quickinfo : 'Document Number for Earmarked Funds'
  EarmarkedFundsDocument : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Document Item'
  @sap.quickinfo : 'Earmarked Funds: Document Item'
  EarmarkedFundsItem : String(3);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Document Item'
  @sap.quickinfo : 'Earmarked Funds: Document Item'
  EarmarkedFundsDocumentItem : String(3);
  @sap.label : 'Incoterms Location 1'
  IncotermsLocation1 : String(70);
  @sap.label : 'Incoterms Location 2'
  IncotermsLocation2 : String(70);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Material'
  @sap.quickinfo : 'Material Number'
  Material : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'EAN/UPC'
  @sap.quickinfo : 'International Article Number (EAN/UPC)'
  InternationalArticleNumber : String(18);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Material'
  @sap.quickinfo : 'Material number'
  ManufacturerMaterial : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Service Performer'
  ServicePerformer : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Product Type Group'
  ProductType : String(2);
  @sap.unit : 'DocumentCurrency'
  @sap.label : 'Expected Value'
  @sap.quickinfo : 'Expected Value of Overall Limit'
  ExpectedOverallLimitAmount : Decimal(14, 3);
  @sap.unit : 'DocumentCurrency'
  @sap.label : 'Overall Limit'
  OverallLimitAmount : Decimal(14, 3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Contract For Limit'
  @sap.quickinfo : 'Purchase Contract for Enhanced Limit'
  PurContractForOverallLimit : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Higher-Level Item'
  @sap.quickinfo : 'Higher-Level Item in Purchasing Documents'
  PurchasingParentItem : String(5);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Hierarchy Number'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgConfigurableItemNumber : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Sub-items'
  @sap.quickinfo : 'Subitems Exist'
  PurgDocAggrgdSubitemCategory : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Subitem Category'
  @sap.quickinfo : 'Subitem Category, Purchasing Document'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgDocSubitemCategory : String(1);
  @sap.display.format : 'NonNegative'
  @sap.label : 'External Sort No.'
  @sap.quickinfo : 'External Sort Number'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgExternalSortNumber : String(5);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Batch'
  @sap.quickinfo : 'Batch Number'
  Batch : String(10);
  @sap.label : 'Free of Charge'
  @sap.quickinfo : 'Free Item'
  PurchasingItemIsFreeOfCharge : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Address'
  @sap.quickinfo : 'Number of delivery address'
  ReferenceDeliveryAddressID : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Address'
  @sap.quickinfo : 'Manual address number in purchasing document item'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  DeliveryAddressID : String(10);
  @sap.label : 'Name'
  @sap.quickinfo : 'Name 1'
  DeliveryAddressName : String(40);
  @sap.label : 'Name 2'
  DeliveryAddressName2 : String(40);
  @sap.label : 'Full Name'
  @sap.quickinfo : 'Full Name of Person'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  DeliveryAddressFullName : String(80);
  @sap.label : 'Street'
  DeliveryAddressStreetName : String(60);
  @sap.label : 'House Number'
  DeliveryAddressHouseNumber : String(10);
  @sap.label : 'City'
  DeliveryAddressCityName : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Postal Code'
  @sap.quickinfo : 'City postal code'
  DeliveryAddressPostalCode : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Region'
  @sap.quickinfo : 'Region (State, Province, County)'
  DeliveryAddressRegion : String(3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Country/Region Key'
  DeliveryAddressCountry : String(3);
  @sap.label : 'District'
  DeliveryAddressDistrictName : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Down Payment'
  @sap.quickinfo : 'Down Payment Indicator'
  DownPaymentType : String(4);
  @sap.label : 'Down Payment %'
  @sap.quickinfo : 'Down Payment Percentage'
  DownPaymentPercentageOfTotAmt : Decimal(5, 2);
  @sap.unit : 'DocumentCurrency'
  @sap.label : 'Down Payment Amount'
  @sap.quickinfo : 'Down Payment Amount in Document Currency'
  DownPaymentAmount : Decimal(12, 3);
  @sap.display.format : 'Date'
  @sap.label : 'Due Date for DP'
  @sap.quickinfo : 'Due Date for Down Payment'
  DownPaymentDueDate : Date;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Material Usage'
  @sap.quickinfo : 'Usage of the material'
  BR_MaterialUsage : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Material Origin'
  @sap.quickinfo : 'Origin of the material'
  BR_MaterialOrigin : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Matl. CFOP Category'
  @sap.quickinfo : 'Material CFOP Category'
  BR_CFOPCategory : String(2);
  @sap.label : 'In-House Production'
  BR_IsProducedInHouse : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'NCM Code'
  @sap.quickinfo : 'Brazilian NCM Code'
  ConsumptionTaxCtrlCode : String(16);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Supplier Check Sts'
  @sap.quickinfo : 'Product Compliance Supplier Check Status (Item)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgProdCmplncSupplierStatus : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Prod. Marktablty Sts'
  @sap.quickinfo : 'Product Marketability Status (Item)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgProductMarketabilityStatus : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Sfty Data Sheet Sts'
  @sap.quickinfo : 'Safety Data Sheet Status (Item)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgSafetyDataSheetStatus : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Dangerous Goods Sts'
  @sap.quickinfo : 'Dangerous Goods Status (Item)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PurgProdCmplncDngrsGoodsStatus : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Season Year'
  ProductSeasonYear : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Season'
  ProductSeason : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Collection'
  @sap.quickinfo : 'Fashion Collection'
  ProductCollection : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Theme'
  @sap.quickinfo : 'Fashion Theme'
  ProductTheme : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Season Comp.Ind'
  @sap.quickinfo : 'Season Completeness Indicator'
  SeasonCompletenessStatus : String(1);
  @sap.label : 'Characteristic 1'
  @sap.quickinfo : 'Characteristic Value 1'
  ProductCharacteristic1 : String(18);
  @sap.label : 'Characteristic 2'
  @sap.quickinfo : 'Characteristic Value 2'
  ProductCharacteristic2 : String(18);
  @sap.label : 'Characteristic 3'
  @sap.quickinfo : 'Characteristic Value 3'
  ProductCharacteristic3 : String(18);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Subitem Category'
  @sap.quickinfo : 'Subitem Category, Purchasing Document'
  SubItemCategory : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Cross-plant CM'
  @sap.quickinfo : 'Cross-Plant Configurable Material'
  CrossPlantConfigurableProduct : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Diversion Status'
  @sap.quickinfo : 'Status of Diversion process'
  DiversionStatus : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Reference Document'
  @sap.quickinfo : 'Reference Document number for PO Traceability'
  ReferenceDocumentNumber : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Reference Item'
  @sap.quickinfo : 'Reference Item number for PO Traceability'
  ReferenceDocumentItem : String(6);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Reference Action'
  @sap.quickinfo : 'Action for Traceability in PO'
  PurchaseOrderReferenceType : String(1);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Reference Schedule Line Item number for PO Traceability'
  @sap.heading : ''
  ReferenceDocumentScheduleLine : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Material Category'
  ArticleCategory : String(2);
  @sap.display.format : 'UpperCase'
  @sap.label : 'VAS Relevant'
  ItemHasValueAddedService : String(1);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item'
  @sap.quickinfo : 'Item Number of Purchasing Document'
  ValAddedSrvcParentItmNumber : String(5);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Stock Segment'
  StockSegment : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Requirement Segment'
  RequirementSegment : String(40);
  to_PurchaseOrder : Association to OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrder {  };
  to_AccountAssignment : Composition of many OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurOrdAccountAssignment {  };
  to_PurchaseOrderItemNote : Composition of many OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrderItemNote {  };
  to_PurchaseOrderPricingElement : Composition of many OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurOrdPricingElement {  };
  to_ScheduleLine : Composition of many OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrderScheduleLine {  };
  to_ValueAddedService_2 : Association to many OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_ValAddedSrvcMM_2 {  };
};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Item Notes'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrderItemNote {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing Document'
  @sap.quickinfo : 'Purchasing Document Number'
  key PurchaseOrder : String(10) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item'
  @sap.quickinfo : 'Item Number of Purchasing Document'
  key PurchaseOrderItem : String(5) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Text ID'
  key TextObjectType : String(4) not null;
  @sap.label : 'Language Key'
  key Language : String(2) not null;
  @sap.label : 'Long Text'
  @sap.filterable : 'false'
  PlainLongText : String;
};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Header Notes'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrderNote {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing Document'
  @sap.quickinfo : 'Purchasing Document Number'
  key PurchaseOrder : String(10) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Text ID'
  key TextObjectType : String(4) not null;
  @sap.label : 'Language Key'
  key Language : String(2) not null;
  @sap.label : 'Long Text'
  @sap.filterable : 'false'
  PlainLongText : String;
};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Schedule Lines'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurchaseOrderScheduleLine {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing Document'
  @sap.quickinfo : 'Purchasing Document Number'
  key PurchasingDocument : String(10) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item'
  @sap.quickinfo : 'Item Number of Purchasing Document'
  key PurchasingDocumentItem : String(5) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Schedule Line'
  @sap.quickinfo : 'Delivery Schedule Line Counter'
  key ScheduleLine : String(4) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Deliv. date category'
  @sap.quickinfo : 'Category of delivery date'
  DelivDateCategory : String(1);
  @sap.display.format : 'Date'
  @sap.label : 'Delivery Date'
  @sap.quickinfo : 'Item Delivery Date'
  ScheduleLineDeliveryDate : Date;
  @sap.label : 'Order Unit'
  @sap.quickinfo : 'Purchase Order Unit of Measure'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.semantics : 'unit-of-measure'
  PurchaseOrderQuantityUnit : String(3);
  @sap.unit : 'PurchaseOrderQuantityUnit'
  @sap.label : 'Scheduled Quantity'
  ScheduleLineOrderQuantity : Decimal(13, 3);
  @sap.label : 'Time'
  @sap.quickinfo : 'Delivery Date Time-Spot'
  ScheduleLineDeliveryTime : Time;
  @sap.display.format : 'Date'
  @sap.label : 'Stat.-Rel. Del. Date'
  @sap.quickinfo : 'Statistics-Relevant Delivery Date'
  SchedLineStscDeliveryDate : Date;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchase Requisition'
  @sap.quickinfo : 'Purchase Requisition Number'
  PurchaseRequisition : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item of requisition'
  @sap.quickinfo : 'Item number of purchase requisition'
  PurchaseRequisitionItem : String(5);
  @sap.unit : 'PurchaseOrderQuantityUnit'
  @sap.label : 'Committed Quantity'
  ScheduleLineCommittedQuantity : Decimal(13, 3);
  @sap.display.format : 'Date'
  @sap.label : 'Start Date'
  @sap.quickinfo : 'Start Date for Period of Performance'
  PerformancePeriodStartDate : Date;
  @sap.display.format : 'Date'
  @sap.label : 'End Date'
  @sap.quickinfo : 'End Date for Period of Performance'
  PerformancePeriodEndDate : Date;
  to_SubcontractingComponent : Composition of many OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_POSubcontractingComponent {  };
};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Account Assignment'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurOrdAccountAssignment {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing Document'
  @sap.quickinfo : 'Purchasing Document Number'
  key PurchaseOrder : String(10) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item'
  @sap.quickinfo : 'Item Number of Purchasing Document'
  key PurchaseOrderItem : String(5) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Account Assgmt No.'
  @sap.quickinfo : 'Sequential Number of Account Assignment'
  key AccountAssignmentNumber : String(2) not null;
  @sap.label : 'Deletion Indicator'
  @sap.quickinfo : 'Deletion Indicator: Purchasing Document Account Assignment'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  IsDeleted : Boolean;
  @sap.label : 'Order Unit'
  @sap.quickinfo : 'Purchase Order Unit of Measure'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.semantics : 'unit-of-measure'
  PurchaseOrderQuantityUnit : String(3);
  @sap.unit : 'PurchaseOrderQuantityUnit'
  @sap.label : 'Quantity'
  Quantity : Decimal(13, 3);
  @sap.label : 'Distribution (%)'
  @sap.quickinfo : 'Distribution percentage in the case of multiple acct assgt'
  MultipleAcctAssgmtDistrPercent : Decimal(3, 1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Currency'
  @sap.quickinfo : 'Currency Key'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.semantics : 'currency-code'
  DocumentCurrency : String(5);
  @sap.unit : 'DocumentCurrency'
  @sap.label : 'Net Order Value'
  @sap.quickinfo : 'Net Order Value in PO Currency'
  PurgDocNetAmount : Decimal(14, 3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'G/L Account'
  @sap.quickinfo : 'G/L Account Number'
  GLAccount : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Business Area'
  BusinessArea : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Cost Center'
  CostCenter : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'SD Document'
  @sap.quickinfo : 'Sales and Distribution Document Number'
  SalesOrder : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item'
  @sap.quickinfo : 'Sales Document Item'
  SalesOrderItem : String(6);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Schedule Line Number'
  SalesOrderScheduleLine : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Asset'
  @sap.quickinfo : 'Main Asset Number'
  MasterFixedAsset : String(12);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Subnumber'
  @sap.quickinfo : 'Asset Subnumber'
  FixedAsset : String(4);
  @sap.label : 'Goods Recipient'
  GoodsRecipientName : String(12);
  @sap.label : 'Unloading Point'
  UnloadingPointName : String(25);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Controlling Area'
  ControllingArea : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Cost Object'
  CostObject : String(12);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Order'
  @sap.quickinfo : 'Order Number'
  OrderID : String(12);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Profit Center'
  ProfitCenter : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'WBS Element'
  @sap.quickinfo : 'Work Breakdown Structure Element (WBS Element)'
  WBSElementInternalID : String(24);
  @sap.display.format : 'UpperCase'
  @sap.label : 'WBS Element'
  @sap.quickinfo : 'Work Breakdown Structure Element (WBS Element)'
  WBSElement : String(24);
  @sap.display.format : 'UpperCase'
  @sap.label : 'WBS Element'
  @sap.quickinfo : 'Work Breakdown Structure Element (WBS Element) Edited'
  WBSElementExternalID : String(24);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Network'
  @sap.quickinfo : 'Network Number for Account Assignment'
  ProjectNetwork : String(12);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Oper./Act.'
  @sap.quickinfo : 'Operation/Activity Number'
  NetworkActivity : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Real Estate Key'
  @sap.quickinfo : 'Internal Key for Real Estate Object'
  RealEstateObject : String(40);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Partner'
  @sap.quickinfo : 'Partner account number'
  PartnerAccountNumber : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Commitment item'
  @sap.quickinfo : 'Commitment Item'
  CommitmentItem : String(24);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Recovery Indicator'
  JointVentureRecoveryCode : String(2);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Funds Center'
  FundsCenter : String(16);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Fund'
  Fund : String(10);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Functional Area'
  FunctionalArea : String(16);
  @sap.display.format : 'Date'
  @sap.label : 'Reference date'
  @sap.quickinfo : 'Reference date for settlement'
  SettlementReferenceDate : Date;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Tax Code'
  @sap.quickinfo : 'Tax on sales/purchases code'
  TaxCode : String(2);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Tax Jurisdiction'
  TaxJurisdiction : String(15);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Activity Type'
  CostCtrActivityType : String(6);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Business Process'
  BusinessProcess : String(12);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Earmarked Funds'
  @sap.quickinfo : 'Document Number for Earmarked Funds'
  EarmarkedFundsDocument : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Document Item'
  @sap.quickinfo : 'Earmarked Funds: Document Item'
  EarmarkedFundsDocumentItem : String(3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Grant'
  GrantID : String(20);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Budget Period'
  BudgetPeriod : String(10);
};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Pricing Element'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_PurOrdPricingElement {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Purchasing Document'
  @sap.quickinfo : 'Purchasing Document Number'
  key PurchaseOrder : String(10) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item'
  @sap.quickinfo : 'Item Number of Purchasing Document'
  key PurchaseOrderItem : String(5) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Doc. Condition No.'
  @sap.quickinfo : 'Number of the Document Condition'
  key PricingDocument : String(10) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item'
  @sap.quickinfo : 'Condition item number'
  key PricingDocumentItem : String(6) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Step Number'
  key PricingProcedureStep : String(3) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Counter'
  @sap.quickinfo : 'Condition Counter'
  key PricingProcedureCounter : String(3) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Condition Type'
  ConditionType : String(4);
  @sap.label : 'Amount'
  @sap.quickinfo : 'Condition Amount or Percentage'
  ConditionRateValue : Decimal(24, 9);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Currency'
  @sap.quickinfo : 'Currency Key'
  @sap.semantics : 'currency-code'
  ConditionCurrency : String(5);
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PriceDetnExchangeRate : String(12);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Document Currency'
  @sap.quickinfo : 'SD Document Currency'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.semantics : 'currency-code'
  TransactionCurrency : String(5);
  @sap.unit : 'TransactionCurrency'
  @sap.label : 'Condition Value'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionAmount : Decimal(16, 3);
  @sap.label : 'Condition Unit'
  @sap.quickinfo : 'Condition Unit in the Document'
  @sap.semantics : 'unit-of-measure'
  ConditionQuantityUnit : String(3);
  @sap.unit : 'ConditionQuantityUnit'
  @sap.label : 'Pricing Unit'
  @sap.quickinfo : 'Condition Pricing Unit'
  ConditionQuantity : Decimal(5, 0);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Application'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionApplication : String(2);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Valid From'
  @sap.quickinfo : 'Timestamp for Pricing'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PricingDateTime : String(14);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Calculation Type'
  @sap.quickinfo : 'Calculation Type for Condition'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionCalculationType : String(3);
  @sap.label : 'Condition Basis'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionBaseValue : Decimal(24, 9);
  @sap.label : 'Numerator'
  @sap.quickinfo : 'Numerator for Converting to Base UoM'
  ConditionToBaseQtyNmrtr : Decimal(10, 0);
  @sap.label : 'Denominator'
  @sap.quickinfo : 'Denominator for Converting to Base UoM'
  ConditionToBaseQtyDnmntr : Decimal(10, 0);
  @sap.label : 'Condition Category'
  @sap.quickinfo : 'Condition Category (Examples: Tax, Freight, Price, Cost)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionCategory : String(1);
  @sap.label : 'Statistical'
  @sap.quickinfo : 'Condition is used for statistics'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionIsForStatistics : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Scale Type'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PricingScaleType : String(1);
  @sap.label : 'Accruals'
  @sap.quickinfo : 'Condition is Relevant for Accrual (e.g. Freight)'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  IsRelevantForAccrual : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Invoice List Cond.'
  @sap.quickinfo : 'Condition for Invoice List'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  CndnIsRelevantForInvoiceList : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Condition Origin'
  @sap.quickinfo : 'Origin of the Condition'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionOrigin : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Group Condition'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  IsGroupCondition : String(1);
  @sap.label : 'Condition Update'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  CndnIsRelevantForLimitValue : Boolean;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Sequent.No. of Cond.'
  @sap.quickinfo : 'Sequential Number of the Condition'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionSequentialNumber : String(3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Condition Control'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionControl : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Inactive Condition'
  @sap.quickinfo : 'Condition is Inactive'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionInactiveReason : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Condition Class'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionClass : String(1);
  @sap.label : 'Condition Factor'
  @sap.quickinfo : 'Factor for Condition Base Value'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  FactorForConditionBasisValue : Double;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Scale Basis'
  @sap.quickinfo : 'Scale Basis Indicator'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  PricingScaleBasis : String(3);
  @sap.label : 'Scale Base Val.'
  @sap.quickinfo : 'Scale Base Value'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionScaleBasisValue : Decimal(24, 9);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Scale Currency'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.semantics : 'currency-code'
  ConditionScaleBasisCurrency : String(5);
  @sap.label : 'Scale Unit of Meas.'
  @sap.quickinfo : 'Condition Scale Unit of Measure'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.semantics : 'unit-of-measure'
  ConditionScaleBasisUnit : String(3);
  @sap.label : 'Intercomp.Billing'
  @sap.quickinfo : 'Condition for Intercompany Billing'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  CndnIsRelevantForIntcoBilling : Boolean;
  @sap.label : 'UsedforVariantConfig'
  @sap.quickinfo : 'Condition Used for Variant Configuration'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionIsForConfiguration : Boolean;
  @sap.label : 'Changed Manually'
  @sap.quickinfo : 'Condition Changed Manually'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionIsManuallyChanged : Boolean;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Condition Record No.'
  @sap.quickinfo : 'Number of Condition Record'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ConditionRecord : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Access'
  @sap.quickinfo : 'Access sequence - Access number'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  AccessNumberOfAccessSequence : String(3);
};

@cds.external : true
@cds.persistence.skip : true
@sap.content.version : '1'
@sap.label : 'Item Value Added Service'
entity OP_API_PURCHASEORDER_PROCESS_SRV_0001.A_ValAddedSrvcMM_2 {
  @sap.display.format : 'UpperCase'
  @sap.label : 'Reference Document'
  @sap.quickinfo : 'Reference Document Number'
  key PurchaseOrder : String(10) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Reference item'
  @sap.quickinfo : 'Item of reference document'
  key PurchaseOrderItem : String(5) not null;
  @sap.display.format : 'NonNegative'
  @sap.label : 'VAS Service Types'
  key ValueAddedServiceType : String(2) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'VAS Sub Services'
  key ValueAddedSubServiceType : String(5) not null;
  @sap.display.format : 'UpperCase'
  @sap.label : 'Material Number'
  @sap.quickinfo : 'VAS Material Number'
  ValueAddedServiceProduct : String(40);
  @sap.label : 'Req Relevance'
  @sap.quickinfo : 'Requirement Relevancy Flag for VAS Material'
  ValAddedSrvcHasToBeOrdered : Boolean;
  @sap.display.format : 'NonNegative'
  @sap.label : 'Increment'
  @sap.quickinfo : 'VAS Increment'
  ValAddedSrvcIncrement : String(4);
  @sap.display.format : 'UpperCase'
  @sap.label : 'VAS Charge Code'
  @sap.quickinfo : 'VAS Charge Codes'
  ValueAddedServiceChargeCode : String(3);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Manual Entry Ind.'
  @sap.quickinfo : 'Manual Entry Indicator'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ValAddedSrvcIsCreatedManually : String(1);
  @sap.display.format : 'UpperCase'
  @sap.label : 'VAS Del. Indicator'
  @sap.quickinfo : 'VAS Deletion Indicator'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ValueAddedServiceDeletionCode : String(1);
  @sap.display.format : 'NonNegative'
  @sap.label : 'VAS Item Number'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ValAddedSrvcItemNumberInMM : String(5);
  @sap.label : 'Field1'
  @sap.quickinfo : 'VAS Field 1 for Free Use by Customer'
  ValueAddedServiceText1 : String(20);
  @sap.label : 'Field2'
  @sap.quickinfo : 'VAS Field 2 for Free Use by Customer'
  ValueAddedServiceText2 : String(20);
  @sap.label : 'Field3'
  @sap.quickinfo : 'VAS Field 3 for Free Use by Customer'
  ValueAddedServiceText3 : String(20);
  @sap.sortable : 'false'
  @sap.filterable : 'false'
  ValueAddedServiceLongText : String(132);
  @sap.display.format : 'UpperCase'
  @sap.label : 'Transaction Number'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ValAddedSrvcTransactionNumber : String(10);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item Group'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ValAddedSrvcItemGroup : String(5);
  @sap.display.format : 'NonNegative'
  @sap.label : 'Item Number'
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  ValAddedSrvcItemNumber : String(5);
};

@cds.external : true
type OP_API_PURCHASEORDER_PROCESS_SRV_0001.DummyFunctionImportResult {
  @sap.label : 'TRUE'
  IsInvalid : Boolean;
};

@cds.external : true
type OP_API_PURCHASEORDER_PROCESS_SRV_0001.GetPDFResult {
  @sap.creatable : 'false'
  @sap.updatable : 'false'
  @sap.sortable : 'false'
  @sap.filterable : 'false'
  PurchaseOrderBinary : String not null;
};

