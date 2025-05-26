/* checksum : b5387c316b2290fa6069860aefdc37fe */
@cds.external : true
type purchaseorder_edmx.D_PurOrdGetOutputBinaryDataR {
  @Common.Label : 'Tipo MIME'
  @Common.Heading : 'Tp.MIME'
  @Common.QuickInfo : 'Tipo conten.HTML'
  MimeType : String(128) not null;
  @Common.Label : 'Datos de salida'
  OutputBinaryData : LargeBinary not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Canal'
  @Common.Heading : 'Canal de salida'
  @Common.QuickInfo : 'Canal de salida'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=APOC_CHANNEL'
  OutputChannel : String(5) not null;
  @Common.Label : 'Nombre del documento'
  OutputDocumentName : String(120) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Destinatario'
  @Common.Heading : 'Destinat.'
  @Common.QuickInfo : 'ID de destinatario'
  Recipient : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Rol'
  @Common.QuickInfo : 'Código de función'
  RecipientRole : String(2) not null;
};

@cds.external : true
type purchaseorder_edmx.SAP__Message {
  code : LargeString not null;
  message : LargeString not null;
  target : LargeString;
  additionalTargets : many LargeString not null;
  transition : Boolean not null;
  @odata.Type : 'Edm.Byte'
  numericSeverity : Integer not null;
  longtextUrl : LargeString;
};

@cds.external : true
@CodeList.CurrencyCodes : {
  Url: '../../../../default/iwbep/common/0001/$metadata',
  CollectionPath: 'Currencies'
}
@CodeList.UnitsOfMeasure : {
  Url: '../../../../default/iwbep/common/0001/$metadata',
  CollectionPath: 'UnitsOfMeasure'
}
@Common.ApplyMultiUnitBehaviorForSortingAndFiltering : true
@Capabilities.FilterFunctions : [
  'eq',
  'ne',
  'gt',
  'ge',
  'lt',
  'le',
  'and',
  'or',
  'contains',
  'startswith',
  'endswith',
  'any',
  'all'
]
@Capabilities.SupportedFormats : [ 'application/json', 'application/pdf' ]
@PDF.Features : {
  DocumentDescriptionReference: '../../../../default/iwbep/common/0001/$metadata',
  DocumentDescriptionCollection: 'MyDocumentDescriptions',
  ArchiveFormat: true,
  Border: true,
  CoverPage: true,
  FitToPage: true,
  FontName: true,
  FontSize: true,
  HeaderFooter: true,
  IANATimezoneFormat: true,
  Margin: true,
  Padding: true,
  ResultSizeDefault: 20000,
  ResultSizeMaximum: 20000,
  Signature: true,
  TextDirectionLayout: true,
  Treeview: true,
  UploadToFileShare: true
}
@Capabilities.KeyAsSegmentSupported : true
@Capabilities.AsynchronousRequestsSupported : true
service POService {
  entity POProxyOrders        as projection on purchaseorder_edmx.PurchaseOrder;
  entity POProxyItems         as projection on purchaseorder_edmx.PurchaseOrderItem;
  entity POProxyNotes         as projection on purchaseorder_edmx.PurchaseOrderNote;
  entity POProxyPartners      as projection on purchaseorder_edmx.PurchaseOrderPartner;
  entity POProxyAddresses     as projection on purchaseorder_edmx.PurchaseOrderSupplierAddress;
}



@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Componentes de subcontratación'
@Common.Messages : SAP__Messages
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrder', '_PurchaseOrderItem', '_ScheduleLine' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [
  { Property: RequiredQuantity, AllowedExpressions: 'MultiValue' },
  { Property: QuantityInEntryUnit, AllowedExpressions: 'MultiValue' },
  { Property: VariableSizeItemQuantity, AllowedExpressions: 'MultiValue' },
  {
    Property: VariableSizeComponentQuantity,
    AllowedExpressions: 'MultiValue'
  },
  { Property: Size1, AllowedExpressions: 'MultiValue' },
  { Property: Size2, AllowedExpressions: 'MultiValue' },
  { Property: Size3, AllowedExpressions: 'MultiValue' },
  { Property: WithdrawnQuantity, AllowedExpressions: 'MultiValue' }
]
entity purchaseorder_edmx.POSubcontractingComponent {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Documento de compras'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición del documento de compras'
  key PurchaseOrderItem : String(5) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Reparto'
  @Common.Heading : 'Rep.'
  @Common.QuickInfo : 'Contador de repartos'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EETEN'
  key ScheduleLine : String(4) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición de reserva'
  key ReservationItem : String(4) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Clase de registro de reserva'
  key RecordType : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Material'
  @Common.QuickInfo : 'Número de material'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MATNR'
  Material : String(18) not null;
  @Common.Label : 'Ind pieza facilitada'
  @Common.Heading : 'InPzFac'
  @Common.QuickInfo : 'Indicador de pieza facilitada'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BEIKZ'
  IsMaterialProvision : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Clase de pieza facilitada'
  MaterialProvisionType : String(1) not null;
  @Common.Label : 'Contador'
  @Common.QuickInfo : 'Numerador para la conversión en unidades de medida base'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UMREZ'
  MaterialQtyToBaseQtyNmrtr : Decimal(precision: 5) not null;
  @Common.Label : 'Denominador'
  @Common.Heading : 'Denom.'
  @Common.QuickInfo : 'Denominador para la conversión en unidades de medida base'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UMREN'
  MaterialQtyToBaseQtyDnmntr : Decimal(precision: 5) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Estado de revisión'
  MaterialRevisionLevel : String(2) not null;
  @Common.Label : 'Pos.dimensión bruta'
  @Common.Heading : 'Posición de dimensión bruta'
  @Common.QuickInfo : 'Indicador de posición de dimensión bruta'
  MaterialCompIsVariableSized : Boolean not null;
  @Common.Label : 'Posición ficticia'
  @Common.QuickInfo : 'Indicador de posición ficticia'
  MaterialComponentIsPhantomItem : Boolean not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Reserva'
  @Common.Heading : 'Nº reserva'
  @Common.QuickInfo : 'Número de la reserva/las necesidades secundarias'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RSNUM'
  Reservation : String(10) not null;
  @Core.Computed : true
  @Measures.Unit : BaseUnit
  @Common.Label : 'Cantidad necesaria'
  @Common.Heading : 'Ctd.necesaria'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BDMNG'
  RequiredQuantity : Decimal(13, 3) not null;
  @Common.Label : 'Fecha de necesidad'
  @Common.QuickInfo : 'Fecha de necesidad de componente de material'
  RequirementDate : Date;
  @Common.Label : 'Hora de necesidad'
  @Common.QuickInfo : 'Hora de necesidad de componente de material'
  RequirementTime : Time not null;
  @Common.Label : 'Salida final'
  @Common.Heading : 'SFin'
  @Common.QuickInfo : 'Salida final de la reserva'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZEAR'
  ReservationIsFinallyIssued : Boolean not null;
  @Common.IsUnit : true
  @Core.Immutable : true
  @Common.Label : 'Unidad medida base'
  @Common.Heading : 'UMB'
  @Common.QuickInfo : 'Unidad de medida base'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MEINS'
  BaseUnit : String(3) not null;
  @Measures.Unit : EntryUnit
  @Common.Label : 'Cantidad'
  @Common.QuickInfo : 'Cantidad en la unidad de entrada'
  QuantityInEntryUnit : Decimal(13, 3) not null;
  @Common.IsUnit : true
  @Common.Label : 'Un.medida de entrada'
  @Common.Heading : 'UME'
  @Common.QuickInfo : 'Unidad de medida de entrada'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ERFME'
  EntryUnit : String(3) not null;
  @Measures.Unit : VariableSizeItemUnit
  @Common.Label : 'Cantidad de componentes en bruto'
  VariableSizeItemQuantity : Decimal(13, 3) not null;
  @Common.IsUnit : true
  @Common.Label : 'Unidad de medida de pieza en bruto'
  VariableSizeItemUnit : String(3) not null;
  @Common.IsUnit : true
  @Common.Label : 'Unidad de componente en bruto'
  @Common.QuickInfo : 'Unidad de medida para componentes en bruto'
  VariableSizeComponentUnit : String(3) not null;
  @Measures.Unit : VariableSizeComponentUnit
  @Common.Label : 'Cantidad PDB'
  @Common.QuickInfo : 'Cantidad de posición de dimensión bruta por unidad'
  VariableSizeComponentQuantity : Decimal(13, 3) not null;
  @Common.IsUnit : true
  @Common.Label : 'Un.dimensión bruta'
  @Common.Heading : 'UDBt'
  @Common.QuickInfo : 'Unidad de dimensiones brutas de 1 a 3'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ROMEI'
  UnitOfMeasureForSize1To3 : String(3) not null;
  @Measures.Unit : UnitOfMeasureForSize1To3
  @Common.Label : 'Dimensión bruta 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ROMS1'
  Size1 : Decimal(13, 3) not null;
  @Measures.Unit : UnitOfMeasureForSize1To3
  @Common.Label : 'Dimensión bruta 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ROMS2'
  Size2 : Decimal(13, 3) not null;
  @Measures.Unit : UnitOfMeasureForSize1To3
  @Common.Label : 'Dimensión bruta 3'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ROMS3'
  Size3 : Decimal(13, 3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Centro'
  @Common.Heading : 'Ce.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WERKS_D'
  Plant : String(4) not null;
  @Common.Label : 'Última fecha de necesidad'
  LatestRequirementDate : Date;
  @Common.IsDigitSequence : true
  @Common.Label : 'Nivel de la orden'
  @Common.Heading : 'NiOr'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AUFST'
  OrderLevelValue : String(2) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Camino de la orden'
  @Common.Heading : 'Cam'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AUFWG'
  OrderPathValue : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Nº de posición de lista de materiales'
  @Common.QuickInfo : 'Factura de número de posición de material'
  BillOfMaterialItemNumber : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Concepto clas.'
  @Common.Heading : 'Conc.clas.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SORTP'
  MatlCompFreeDefinedAttribute : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tp.pos.LMat'
  @Common.QuickInfo : 'Tipo de posición de lista de materiales'
  BOMItemCategory : String(1) not null;
  @Common.Label : 'Material a granel'
  @Common.Heading : 'MatGrn'
  @Common.QuickInfo : 'Indicador: Material a granel'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SCHGT'
  IsBulkMaterialComponent : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Categoría de asignación de cuenta'
  @Common.QuickInfo : 'Tipo de imputación'
  AccountAssignmentCategory : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tpo.stock especial'
  @Common.Heading : 'Stock esp.'
  @Common.QuickInfo : 'Tipo de stock especial de inventario'
  InventorySpecialStockType : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Contabiliz.consumo'
  @Common.QuickInfo : 'Contabilización de consumo'
  ConsumptionPosting : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tp.valoración stocks especial inventario'
  @Common.QuickInfo : 'Tipo de valoración de stocks especial de inventario'
  InventorySpecialStockValnType : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Código de Haber/Debe'
  @Common.QuickInfo : 'Código Debe/Haber'
  DebitCreditCode : String(1) not null;
  @Core.Computed : true
  @Measures.Unit : BaseUnit
  @Common.Label : 'Cantidad tomada'
  WithdrawnQuantity : Decimal(13, 3) not null;
  @Common.Label : 'Cantidad fija'
  @Common.Heading : 'Fij'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FMENG'
  QuantityIsFixed : Boolean not null;
  @Common.Label : 'Rechazo comp. (%)'
  @Common.Heading : 'RechCom'
  @Common.QuickInfo : 'Rechazo de componente en porcentaje'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KAUSF'
  ComponentScrapInPercent : Decimal(5, 2) not null;
  @Common.Label : 'Rech.niv.oper.en %'
  @Common.Heading : 'Rchzo op'
  @Common.QuickInfo : 'Rechazo a nivel de operación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AVOAU'
  OperationScrapInPercent : Decimal(5, 2) not null;
  @Common.Label : 'Indicador rech.neto'
  @Common.Heading : 'IndNeto'
  @Common.QuickInfo : 'Indicador de rechazo neto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=NETAU'
  IsNetScrap : Boolean not null;
  @Common.Label : 'Decalaje'
  LeadTimeOffset : Decimal(precision: 3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Clave distribución'
  @Common.Heading : 'Dist'
  @Common.QuickInfo : 'Clave de distribución Planificación de necesidades'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SA_VERTL'
  QuantityDistributionKey : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Fórmula PDB'
  @Common.Heading : 'Clv.fórm'
  @Common.QuickInfo : 'Clave de fórmula para posiciones de dimensión bruta'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RFORM'
  FormulaKey : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Almacén'
  StorageLocation : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Área de suministro de producción'
  ProductionSupplyArea : String(10) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Lote'
  @Common.QuickInfo : 'Número de lote'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CHARG_D'
  Batch : String(10) not null;
  @Core.Computed : true
  @Common.Label : 'Texto posición'
  @Common.Heading : 'Texto de posición línea 1'
  @Common.QuickInfo : 'Texto de posición de lista de materiales (Línea 1)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=POTX1'
  BOMItemDescription : String(40) not null;
  @Common.Label : 'Texto de posición 2'
  @Common.Heading : 'Texto de posición línea 2'
  @Common.QuickInfo : 'Texto de posición de lista de materiales (línea 2)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=POTX2'
  BOMItemText2 : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Número modificación'
  @Common.Heading : 'Nº modif.'
  @Common.QuickInfo : 'Número de modificación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AENNR'
  ChangeNumber : String(12) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  _PurchaseOrderItem : Association to one purchaseorder_edmx.PurchaseOrderItem {  };
  _ScheduleLine : Association to one purchaseorder_edmx.PurchaseOrderScheduleLine {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Pedido'
@Common.SemanticKey : [ 'PurchaseOrder' ]
@Common.Messages : SAP__Messages
@Capabilities.NavigationRestrictions.RestrictedProperties : [
  {
    NavigationProperty: _PurchaseOrderItem,
    InsertRestrictions: { Insertable: true }
  },
  {
    NavigationProperty: _PurchaseOrderNote,
    InsertRestrictions: { Insertable: true }
  },
  {
    NavigationProperty: _PurchaseOrderPartner,
    InsertRestrictions: { Insertable: true }
  },
  {
    NavigationProperty: _SupplierAddress,
    InsertRestrictions: { Insertable: true }
  }
]
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [
  '_PurchaseOrderItem',
  '_PurchaseOrderNote',
  '_PurchaseOrderPartner',
  '_SupplierAddress'
]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [ { Property: DownPaymentAmount, AllowedExpressions: 'MultiValue' } ]
entity purchaseorder_edmx.PurchaseOrder {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Pedido de compras'
  @Common.Heading : 'Número pedido de compras'
  @Common.QuickInfo : 'Número pedido de compras'
  key PurchaseOrder : String(10) not null;
  @Common.FieldControl : #Mandatory
  @Common.IsUpperCase : true
  @Common.Label : 'Cl.documento compras'
  @Common.Heading : 'Cl.'
  @Common.QuickInfo : 'Clase de documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ESART'
  PurchaseOrderType : String(4) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Indicador de control'
  @Common.Heading : 'Ctr'
  @Common.QuickInfo : 'Indicador de control para clase de documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BSAKZ'
  PurchaseOrderSubtype : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Status'
  @Common.Heading : 'S'
  @Common.QuickInfo : 'Status del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ESTAK'
  PurchasingDocumentOrigin : String(1) not null;
  @Common.SAPObjectNodeTypeReference : 'PurchasingDocumentProcessCode'
  @Common.IsUpperCase : true
  @Common.Label : 'Indicador proceso'
  @Common.QuickInfo : 'Indicador de proceso para pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PROCESS_INDICATOR'
  PurchasingDocumentProcessCode : String(3) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Autor'
  @Common.QuickInfo : 'Usuario de la persona que ha creado un documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_ERNAM'
  CreatedByUser : String(12) not null;
  @Core.Computed : true
  @Common.Label : 'Creado el'
  @Common.Heading : 'Creados'
  @Common.QuickInfo : 'Fecha de creación de documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_ERDAT'
  CreationDate : Date;
  @Common.Label : 'Fecha de pedido'
  @Common.Heading : 'Fe.pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BEDAT'
  PurchaseOrderDate : Date;
  @odata.Precision : 7
  @odata.Type : 'Edm.DateTimeOffset'
  @Core.Computed : true
  @Common.Label : 'Última modific.'
  @Common.Heading : 'Última modificación'
  @Common.QuickInfo : 'Modificar cronomarcador'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CHANGEDATETIME'
  LastChangeDateTime : Timestamp;
  @Common.Label : 'In.período validez'
  @Common.Heading : 'IniPerVa'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KDATB'
  ValidityStartDate : Date;
  @Common.Label : 'Fin período validez'
  @Common.Heading : 'Fin de validez'
  @Common.QuickInfo : 'Fin del período de validez'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KDATE'
  ValidityEndDate : Date;
  @Common.Label : 'Clave de idioma'
  @Common.Heading : 'Idioma'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SPRAS'
  Language : String(2) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Indicador de borrado'
  @Common.Heading : 'Indicador de borrado de pedido'
  @Common.QuickInfo : 'Indicador de borrado de pedido'
  PurchaseOrderDeletionCode : String(1) not null;
  @Core.Computed : true
  @Common.Label : 'Relevante p.liber.'
  @Common.Heading : 'L'
  @Common.QuickInfo : 'Liberación incompleta'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FRGRL'
  ReleaseIsNotCompleted : Boolean not null;
  @Common.Label : 'Incompleto'
  @Common.Heading : 'I'
  @Common.QuickInfo : 'Pedido incompleto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MEMER'
  PurchasingCompletenessStatus : Boolean not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Estado proces.'
  @Common.Heading : 'Estado procesamiento doc.compras'
  @Common.QuickInfo : 'Estado de procesamiento de documento de compras'
  PurchasingProcessingStatus : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Estado liberación'
  @Common.Heading : 'EstadLib'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FRGZU'
  PurgReleaseSequenceStatus : String(8) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Ind.liberación'
  @Common.Heading : 'Lib'
  @Common.QuickInfo : 'Ind.liberación documento compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FRGKE'
  ReleaseCode : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Estrategia liberac.'
  @Common.Heading : 'Estr.'
  @Common.QuickInfo : 'Estrategia liberación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FRGSX'
  PurchasingReleaseStrategy : String(2) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Motivo de rechazo'
  @Common.Heading : 'Mot.rechazo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ABSGR'
  PurgReasonForDocCancellation : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Sociedad'
  @Common.Heading : 'Soc.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BUKRS'
  CompanyCode : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Organización compras'
  @Common.Heading : 'OrgC'
  @Common.QuickInfo : 'Organización de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EKORG'
  PurchasingOrganization : String(4) not null;
  @Common.SAPObjectNodeTypeReference : 'PurchasingGroup'
  @Common.IsUpperCase : true
  @Common.Label : 'Grupo de compras'
  @Common.Heading : 'GCp'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BKGRP'
  PurchasingGroup : String(3) not null;
  @Common.FieldControl : #Mandatory
  @Common.IsUpperCase : true
  @Common.Label : 'Proveedor'
  Supplier : String(10) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Nº dirección'
  @Common.Heading : 'Nº direc.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_ADDRNUM'
  ManualSupplierAddressID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Nº dirección'
  @Common.Heading : 'Nº direc.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_ADDRNUM'
  SupplierAddressID : String(10) not null;
  @Common.Label : 'Vendedor'
  @Common.QuickInfo : 'Vendedor responsable en el proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EVERK'
  SupplierRespSalesPersonName : String(30) not null;
  @Common.Label : 'Teléf.proveedor'
  @Common.QuickInfo : 'Número de teléfono de proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TELFNR0'
  SupplierPhoneNumber : String(16) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Proveedor mercancías'
  @Common.Heading : 'Prov.mer.'
  @Common.QuickInfo : 'Proveedor de mercancías'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LLIEF'
  SupplyingSupplier : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Centro suministrador'
  @Common.Heading : 'CeSu'
  @Common.QuickInfo : 'Centro suministrador en el pedido de transporte'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RESWK'
  SupplyingPlant : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Emisor de factura'
  @Common.Heading : 'EmisorFact'
  @Common.QuickInfo : 'Emisor de factura diferente'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LIFRE'
  InvoicingParty : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cliente'
  @Common.QuickInfo : 'Número de cliente'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KUNNR'
  Customer : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Contrato marco'
  @Common.Heading : 'Contr.'
  @Common.QuickInfo : 'Número del contrato superior'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KONNR'
  PurchaseContract : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Oferta'
  @Common.QuickInfo : 'Número de oferta'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ANGNR'
  SupplierQuotationExternalID : String(10) not null;
  @Common.Label : 'Fecha de la oferta'
  @Common.Heading : 'Fe.oferta'
  @Common.QuickInfo : 'Fecha de presentación de la oferta'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=IHRAN'
  QuotationSubmissionDate : Date;
  @Common.IsDigitSequence : true
  @Common.Label : 'Interv.subposición'
  @Common.Heading : 'SubPI'
  @Common.QuickInfo : 'Intervalo de posición para subposiciones'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UPINC'
  ItemNumberIntervalForSubItems : String(5) not null;
  @Common.SAPObjectNodeTypeReference : 'PaymentTerms'
  @Common.IsUpperCase : true
  @Common.Label : 'Condiciones'
  @Common.Heading : 'CPgo'
  @Common.QuickInfo : 'Clave de condiciones de pago'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FARP_DZTERM'
  PaymentTerms : String(4) not null;
  @Common.Label : 'Días 1'
  @Common.Heading : 'Día1'
  @Common.QuickInfo : 'Días del descuento por pronto pago 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=DZBD1T'
  CashDiscount1Days : Decimal(precision: 3) not null;
  @Common.Label : 'Días 2'
  @Common.Heading : 'Día2'
  @Common.QuickInfo : 'Días del descuento por pronto pago 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=DZBD2T'
  CashDiscount2Days : Decimal(precision: 3) not null;
  @Common.Label : 'Días neto'
  @Common.Heading : 'Neto'
  @Common.QuickInfo : 'Plazo para condición de pago neto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=DZBD3T'
  NetPaymentDays : Decimal(precision: 3) not null;
  @Common.Label : '% descuento 1'
  @Common.Heading : '%dto.1'
  @Common.QuickInfo : 'Porcentaje de descuento 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=DZBD1P'
  CashDiscount1Percent : Decimal(5, 3) not null;
  @Common.Label : '% descuento 2'
  @Common.Heading : '%dto.2'
  @Common.QuickInfo : 'Porcentaje de descuento 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=DZBD2P'
  CashDiscount2Percent : Decimal(5, 3) not null;
  @Common.SAPObjectNodeTypeReference : 'DownPaymentType'
  @Common.IsUpperCase : true
  @Common.Label : 'Anticipo'
  @Common.QuickInfo : 'Indicador de anticipo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ME_DPTYP'
  DownPaymentType : String(4) not null;
  @Common.Label : '% anticipo'
  @Common.Heading : 'Porcentaje anticipo'
  @Common.QuickInfo : 'Porcentaje de anticipo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ME_DPPCNT'
  DownPaymentPercentageOfTotAmt : Decimal(5, 2) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Importe de anticipo'
  @Common.QuickInfo : 'Importe de anticipo en moneda del documento'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ME_DPAMNT'
  DownPaymentAmount : Decimal(precision: 11) not null;
  @Common.Label : 'Fecha vencim.antic.'
  @Common.Heading : 'Fecha vencimiento de anticipo'
  @Common.QuickInfo : 'Fecha de vencimiento del anticipo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ME_DPDDAT'
  DownPaymentDueDate : Date;
  @Common.SAPObjectNodeTypeReference : 'IncotermsClassification'
  @Common.IsUpperCase : true
  @Common.Label : 'Incoterms'
  @Common.Heading : 'Incot'
  @Common.QuickInfo : 'Incoterms (parte 1)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCO1'
  IncotermsClassification : String(3) not null;
  @Common.Label : 'Incoterms (parte 2)'
  @Common.Heading : 'Incoterms2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCO2'
  IncotermsTransferLocation : String(28) not null;
  @Common.SAPObjectNodeTypeReference : 'IncotermsVersion'
  @Common.IsUpperCase : true
  @Common.Label : 'Versión de Incoterms'
  @Common.Heading : 'VerIn'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCOV'
  IncotermsVersion : String(4) not null;
  @Common.Label : 'Ubicac.incoterms 1'
  @Common.QuickInfo : 'Ubicación de incoterms 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCO2_L'
  IncotermsLocation1 : String(70) not null;
  @Common.Label : 'Ubic.incoterms 2'
  @Common.QuickInfo : 'Ubicación de incoterms 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCO3_L'
  IncotermsLocation2 : String(70) not null;
  @Common.Label : 'Relevancia Instrast.'
  @Common.Heading : 'Relevante para Intrastat'
  @Common.QuickInfo : 'Relevante para reporting Instrastat'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INTRA_REL'
  IsIntrastatReportingRelevant : Boolean not null;
  @Common.Label : 'Excluir Instrastat'
  @Common.Heading : 'Excluir de Instrastat'
  @Common.QuickInfo : 'Excluir de reporting Instrastat'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INTRA_EXCL'
  IsIntrastatReportingExcluded : Boolean not null;
  @Common.Label : 'Su referencia'
  @Common.Heading : 'Su ref.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=IHREZ'
  CorrespncExternalReference : String(12) not null;
  @Common.Label : 'Nuestra referencia'
  @Common.Heading : 'Nuestra ref.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UNSEZ'
  CorrespncInternalReference : String(12) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Nº condición docum.'
  @Common.Heading : 'Cond.doc.'
  @Common.QuickInfo : 'Número de la condición de documento'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KNUMV'
  PricingDocument : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Esquema'
  @Common.Heading : 'Esq.'
  @Common.QuickInfo : 'Esquema (determ.precio, mensajes, determ.cuentas,...)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KALSM_D'
  PricingProcedure : String(6) not null;
  @Common.SAPObjectNodeTypeReference : 'Currency'
  @Common.IsCurrency : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda'
  @Common.Heading : 'Mon.'
  @Common.QuickInfo : 'Clave de moneda'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WAERS'
  DocumentCurrency : String(3) not null;
  @Common.Label : 'Tipo de cambio'
  ExchangeRate : Decimal(9, 5) not null;
  @Common.Label : 'Tipo de cambio fijo'
  @Common.Heading : 'Fij'
  @Common.QuickInfo : 'Indicador tipo de cambio fijo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KUFIX'
  ExchangeRateIsFixed : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'País/reg.decl.'
  @Common.Heading : 'DIm'
  @Common.QuickInfo : 'País/Región para declaración fiscal'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LAND1_STML'
  TaxReturnCountry : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'País/región NIF IVA'
  @Common.Heading : 'PIF'
  @Common.QuickInfo : 'País/región de número de identificación de IVA'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=STCEG_L'
  VATRegistrationCountry : String(3) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Est.verif.proveedor'
  @Common.Heading : 'Est.verif.prov.'
  @Common.QuickInfo : 'Estado verif.proveedor conformidad producto (todas las pos.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PC_TOTAL_STATUS_PCS'
  PurgAggrgdProdCmplncSuplrSts : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Est.cap.merc.prod.'
  @Common.Heading : 'EstCapMercProd'
  @Common.QuickInfo : 'Estado de capacidad de mercado (todas las posiciones)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PC_TOTAL_STATUS_PMA'
  PurgAggrgdProdMarketabilitySts : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Estado hoja dat.seg.'
  @Common.Heading : 'EstHojDatSeg.'
  @Common.QuickInfo : 'Estado de hoja de datos de seguridad (todas las posiciones)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PC_TOTAL_STATUS_SDS'
  PurgAggrgdSftyDataSheetStatus : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Est.mcía.pelig.'
  @Common.Heading : 'Est.mcía.pel.'
  @Common.QuickInfo : 'Estado de mercancías peligrosas (todas las posiciones)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PC_TOTAL_STATUS_DG'
  PurgProdCmplncTotDngrsGoodsSts : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Licitación'
  @Common.QuickInfo : 'Número de licitación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SUBMI'
  PurchasingCollectiveNumber : String(10) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  @Common.Composition : true
  _PurchaseOrderItem : Composition of many purchaseorder_edmx.PurchaseOrderItem {  };
  @Common.Composition : true
  _PurchaseOrderNote : Composition of many purchaseorder_edmx.PurchaseOrderNote {  };
  @Common.Composition : true
  _PurchaseOrderPartner : Composition of many purchaseorder_edmx.PurchaseOrderPartner {  };
  @Common.Composition : true
  _SupplierAddress : Composition of one purchaseorder_edmx.PurchaseOrderSupplierAddress {  };
} actions {
  function GetOutputBinaryData(
    _it : $self not null
  ) returns purchaseorder_edmx.D_PurOrdGetOutputBinaryDataR not null;
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Imputación'
@Common.Messages : SAP__Messages
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrder', '_PurchaseOrderItem' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [
  { Property: Quantity, AllowedExpressions: 'MultiValue' },
  { Property: PurgDocNetAmount, AllowedExpressions: 'MultiValue' },
  {
    Property: NonDeductibleInputTaxAmount,
    AllowedExpressions: 'MultiValue'
  }
]
entity purchaseorder_edmx.PurchaseOrderAccountAssignment {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Documento compras'
  @Common.Heading : 'Doc.compr.'
  @Common.QuickInfo : 'Número del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELN'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Número de posición del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELP'
  key PurchaseOrderItem : String(5) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Número de imputación'
  @Common.Heading : 'ImA'
  @Common.QuickInfo : 'Número actual de la imputación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=DZEKKN'
  key AccountAssignmentNumber : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Centro de coste'
  @Common.Heading : 'Ce.coste'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KOSTL'
  CostCenter : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Activo fijo'
  @Common.QuickInfo : 'Número principal de activo fijo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ANLN1'
  MasterFixedAsset : String(12) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Grafo'
  @Common.QuickInfo : 'Número de grafo para imputación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=NPLNR'
  ProjectNetwork : String(12) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Oper./Actividad'
  @Common.Heading : 'Número de operación/actividad'
  @Common.QuickInfo : 'Número de operación/actividad'
  NetworkActivity : String(4) not null;
  @Common.IsUnit : true
  @Common.Label : 'Unidad medida pedido'
  @Common.Heading : 'UMP'
  @Common.QuickInfo : 'Unidad de medida de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BSTME'
  OrderQuantityUnit : String(3) not null;
  @Measures.Unit : OrderQuantityUnit
  @Common.Label : 'Cantidad'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MENGE_D'
  Quantity : Decimal(13, 3) not null;
  @Common.Label : 'Distribución (%)'
  @Common.Heading : '%'
  @Common.QuickInfo : 'Porcentaje de distribución en la imputación múltiple'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VPROZ'
  MultipleAcctAssgmtDistrPercent : Decimal(3, 1) not null;
  @Common.IsCurrency : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda'
  @Common.Heading : 'Mon.'
  @Common.QuickInfo : 'Clave de moneda'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WAERS'
  DocumentCurrency : String(3) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Valor neto de orden'
  @Common.Heading : 'Valor neto'
  @Common.QuickInfo : 'Valor neto de orden en moneda de OC'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BWERT'
  PurgDocNetAmount : Decimal(precision: 13) not null;
  @Core.Computed : true
  @Common.Label : 'Indicador de borrado'
  @Common.Heading : 'B'
  @Common.QuickInfo : 'Indicador de borrado imputación del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KLOEK'
  IsDeleted : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cuenta de mayor'
  @Common.Heading : 'Cta.mayor'
  @Common.QuickInfo : 'Número de la cuenta de mayor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SAKNR'
  GLAccount : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'División'
  @Common.Heading : 'Div.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=GSBER'
  BusinessArea : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Doc.comercial'
  @Common.Heading : 'Documento'
  @Common.QuickInfo : 'Número de documento comercial'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VBELN_CO'
  SalesOrder : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Posición documento ventas'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=POSNR_CO'
  SalesOrderItem : String(6) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Nº de reparto'
  @Common.Heading : 'Rep.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ETENR'
  SalesOrderScheduleLine : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Subnúmero'
  @Common.Heading : 'SNº'
  @Common.QuickInfo : 'Subnúmero de activo fijo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ANLN2'
  FixedAsset : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Orden'
  @Common.QuickInfo : 'Número de orden'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AUFNR'
  OrderID : String(12) not null;
  @Common.Label : 'Puesto descarga'
  @Common.Heading : 'Puesto de descarga'
  @Common.QuickInfo : 'Puesto de descarga'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ABLAD'
  UnloadingPointName : String(25) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Sociedad CO'
  @Common.Heading : 'SoCO'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KOKRS'
  ControllingArea : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Objeto de coste'
  @Common.Heading : 'Obj.coste'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KSTRG'
  CostObject : String(12) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Centro de beneficio'
  @Common.Heading : 'CeBe'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PRCTR'
  ProfitCenter : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'ID interno de PEP'
  @Common.Heading : 'Elem.PEP'
  @Common.QuickInfo : 'Elemento PEP'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PS_S4_PSPNR'
  WBSElementInternalID : String(8) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Elemento PEP'
  @Common.QuickInfo : 'Elemento plan estruct.proyecto (elemento PEP) editado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PS_POSID_EDIT'
  WBSElementExternalID : String(24) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Nº hoja ruta oper.'
  @Common.Heading : 'Nº hoja de ruta operaciones'
  @Common.QuickInfo : 'Nº hoja ruta de operaciones en orden'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CO_AUFPL'
  ProjectNetworkInternalID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'ID breve posición presupuestaria'
  @Common.QuickInfo : 'ID breve de posición presupuestaria'
  CommitmentItemShortID : String(14) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Centro gestor'
  @Common.Heading : 'Ce.gestor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FISTL'
  FundsCenter : String(16) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Fondo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BP_GEBER'
  Fund : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Área funcional'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FKBER'
  FunctionalArea : String(16) not null;
  @Common.Label : 'Dest.mercancía'
  @Common.Heading : 'Destinatario'
  @Common.QuickInfo : 'Destinatario de mercancías'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WEMPF'
  GoodsRecipientName : String(12) not null;
  @Common.Label : 'Factura final'
  @Common.Heading : 'FaF'
  @Common.QuickInfo : 'Indicador de factura final'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EREKZ'
  IsFinallyInvoiced : Boolean not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Contador'
  @Common.QuickInfo : 'Contador interno'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CIM_COUNT'
  NetworkActivityInternalID : String(8) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Interlocutor'
  @Common.Heading : 'Interloc.'
  @Common.QuickInfo : 'Nº de cliente del interlocutor'
  PartnerAccountNumber : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Ind.recuperación'
  @Common.Heading : 'IR'
  @Common.QuickInfo : 'Indicador de recuperación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=JV_RECIND'
  JointVentureRecoveryCode : String(2) not null;
  @Common.Label : 'Fecha de referencia'
  @Common.Heading : 'Ref.'
  @Common.QuickInfo : 'Fecha de referencia para la liquidación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=DABRBEZ'
  SettlementReferenceDate : Date;
  @Common.IsDigitSequence : true
  @Common.Label : 'Nº hoja ruta oper.'
  @Common.Heading : 'Nº hoja de ruta operaciones'
  @Common.QuickInfo : 'Nº hoja ruta de operaciones en orden'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CO_AUFPL'
  OrderInternalID : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Contador'
  @Common.QuickInfo : 'Contador general de la orden'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CO_APLZL'
  OrderIntBillOfOperationsItem : String(8) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Indicador impuestos'
  @Common.Heading : 'II'
  @Common.QuickInfo : 'Indicador IVA'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MWSKZ'
  TaxCode : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Domicilio fiscal'
  @Common.Heading : 'Domicil.fiscal'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TXJCD'
  TaxJurisdiction : String(15) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'No deducible'
  @Common.QuickInfo : 'IVA soportado no deducible'
  NonDeductibleInputTaxAmount : Decimal(precision: 13) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Clase de actividad'
  @Common.Heading : 'ClAct'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LSTAR'
  CostCtrActivityType : String(6) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Proceso empresarial'
  @Common.Heading : 'Proc.empres.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CO_PRZNR'
  BusinessProcess : String(12) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Subvención'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=GM_GRANT_NBR'
  GrantID : String(20) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Per.presup.'
  @Common.QuickInfo : 'Período de presupuesto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FM_BUDGET_PERIOD'
  BudgetPeriod : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Doc.presupuestario'
  @Common.Heading : 'Marca'
  @Common.QuickInfo : 'Número de documento presupuestario'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KBLNR'
  EarmarkedFundsDocument : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición documento'
  @Common.Heading : 'Pos'
  @Common.QuickInfo : 'Posición de documento: Documento presupuestario'
  EarmarkedFundsDocumentItem : String(3) not null;
  ValidityDate : Date;
  @Common.IsUpperCase : true
  @Common.Label : 'Plan de cuentas'
  ChartOfAccounts : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Clase doc.servicio'
  @Common.Heading : 'Clase de documento de servicio'
  @Common.QuickInfo : 'Clase de documento de servicio'
  ServiceDocumentType : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Documento servicio'
  @Common.Heading : 'Documento de servicio'
  @Common.QuickInfo : 'ID de documento de servicio'
  ServiceDocument : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Pos.doc.servicio'
  @Common.Heading : 'Posición de documento de servicio'
  @Common.QuickInfo : 'ID de posición de documento de servicio'
  ServiceDocumentItem : String(6) not null;
  @Common.Label : 'Fecha de creación'
  @Common.Heading : 'Fe.creac.'
  @Common.QuickInfo : 'Fecha de creación del registro'
  CreationDate : Date;
  @Common.Label : 'Imput.final'
  @Common.Heading : 'Indicador imput.final'
  @Common.QuickInfo : 'Indicador de imputación final'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AA_FINAL_IND'
  IsAcctLineFinal : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Motivo imput.final'
  @Common.QuickInfo : 'Motivo de imputación final'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AA_FINAL_REASON'
  AcctLineFinalReason : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Sociedad'
  @Common.Heading : 'Soc.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BUKRS'
  CompanyCode : String(4) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  _PurchaseOrderItem : Association to one purchaseorder_edmx.PurchaseOrderItem {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Plan de facturación'
@Common.Messages : SAP__Messages
@Capabilities.NavigationRestrictions.RestrictedProperties : [
  {
    NavigationProperty: _POInvoicingPlanItem,
    InsertRestrictions: { Insertable: true }
  }
]
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_POInvoicingPlanItem', '_PurchaseOrder', '_PurchaseOrderItem' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
entity purchaseorder_edmx.PurchaseOrderInvoicingPlan {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Pedido de compras'
  @Common.Heading : 'Número pedido de compras'
  @Common.QuickInfo : 'Número pedido de compras'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición de pedido'
  @Common.Heading : 'Número de posición de orden de compra'
  @Common.QuickInfo : 'Número de posición de orden de compra'
  key PurchaseOrderItem : String(5) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Nº plan fact.'
  @Common.Heading : 'Plan fact.'
  @Common.QuickInfo : 'Número de plan de facturación'
  key InvoicingPlan : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cl.plan facturación'
  @Common.Heading : 'FA'
  @Common.QuickInfo : 'Clase de plan de facturación/factura'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FPART'
  InvoicingPlanType : String(2) not null;
  @Common.Label : 'Fecha de inicio'
  @Common.Heading : 'Fe.inicio'
  @Common.QuickInfo : 'Fecha de inicio para plan de facturación'
  InvoicingPlanStartDate : Date;
  @Common.Label : 'Fecha de fin'
  @Common.Heading : 'Fecha fin'
  @Common.QuickInfo : 'Fecha de fin del plan de facturación'
  InvoicingPlanEndDate : Date;
  @Common.IsUpperCase : true
  @Common.Label : 'Período fecha fact.'
  @Common.Heading : 'CP'
  @Common.QuickInfo : 'Regla origen fecha siguiente de facturación/de factura'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PERIO_FP'
  InvoicingPlanNextInvcDateRule : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Organización compras'
  @Common.Heading : 'OrgC'
  @Common.QuickInfo : 'Organización de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EKORG'
  PurchasingOrganization : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Grupo de compras'
  @Common.Heading : 'GCp'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BKGRP'
  PurchasingGroup : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cl.documento compras'
  @Common.Heading : 'Cl.'
  @Common.QuickInfo : 'Clase de documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ESART'
  PurchaseOrderType : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Centro'
  @Common.Heading : 'Ce.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EWERK'
  Plant : String(4) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  @Common.Composition : true
  _POInvoicingPlanItem : Composition of many purchaseorder_edmx.PurchaseOrderInvoicingPlanItem {  };
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  _PurchaseOrderItem : Association to one purchaseorder_edmx.PurchaseOrderItem {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Posición de plan de facturación'
@Common.Messages : SAP__Messages
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrder', '_PurchaseOrderInvoicingPlan', '_PurchaseOrderItem' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [ { Property: InvoicingPlanAmount, AllowedExpressions: 'MultiValue' } ]
entity purchaseorder_edmx.PurchaseOrderInvoicingPlanItem {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Pedido de compras'
  @Common.Heading : 'Número pedido de compras'
  @Common.QuickInfo : 'Número pedido de compras'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición de pedido'
  @Common.Heading : 'Número de posición de orden de compra'
  @Common.QuickInfo : 'Número de posición de orden de compra'
  key PurchaseOrderItem : String(5) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Posición plan facturación/plan factura/tarjeta de pago'
  key InvoicingPlanItem : String(6) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Nº plan fact.'
  @Common.Heading : 'Plan fact.'
  @Common.QuickInfo : 'Número de plan de facturación'
  key InvoicingPlan : String(10) not null;
  @Common.Label : 'Fe.inicio liquidación'
  @Common.QuickInfo : 'Fecha de inicio de liquidación de fecha de facturación'
  InvoicingPlanSettlementFromDte : Date;
  @Common.Label : 'Fecha fin liquid.'
  @Common.QuickInfo : 'Fecha de fin de liquidación de fecha de facturación'
  InvoicingPlanSettlementToDte : Date;
  @Common.Label : 'Fecha de factura'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FKDAT'
  InvoicingPlanInvoicingDate : Date;
  @Measures.ISOCurrency : TransactionCurrency
  @Common.Label : 'Valor de factura'
  @Common.QuickInfo : 'Val.a facturar/a calcular en fe.plan de facturación/factura'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FAKWR'
  InvoicingPlanAmount : Decimal(precision: 15) not null;
  @Common.IsCurrency : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda'
  @Common.Heading : 'Mon.'
  @Common.QuickInfo : 'Clave de moneda'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WAERS'
  TransactionCurrency : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Organización compras'
  @Common.Heading : 'OrgC'
  @Common.QuickInfo : 'Organización de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EKORG'
  PurchasingOrganization : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Grupo de compras'
  @Common.Heading : 'GCp'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BKGRP'
  PurchasingGroup : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cl.documento compras'
  @Common.Heading : 'Cl.'
  @Common.QuickInfo : 'Clase de documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ESART'
  PurchaseOrderType : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Centro'
  @Common.Heading : 'Ce.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EWERK'
  Plant : String(4) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  _PurchaseOrderInvoicingPlan : Association to one purchaseorder_edmx.PurchaseOrderInvoicingPlan {  };
  _PurchaseOrderItem : Association to one purchaseorder_edmx.PurchaseOrderItem {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Posición de pedido'
@Common.Messages : SAP__Messages
@Capabilities.NavigationRestrictions.RestrictedProperties : [
  {
    NavigationProperty: _DeliveryAddress,
    InsertRestrictions: { Insertable: true }
  },
  {
    NavigationProperty: _PurchaseOrderInvoicingPlan,
    InsertRestrictions: { Insertable: true }
  },
  {
    NavigationProperty: _PurchaseOrderItemNote,
    InsertRestrictions: { Insertable: true }
  },
  {
    NavigationProperty: _PurchaseOrderScheduleLineTP,
    InsertRestrictions: { Insertable: true }
  },
  {
    NavigationProperty: _PurOrdAccountAssignment,
    InsertRestrictions: { Insertable: true }
  },
  {
    NavigationProperty: _PurOrdPricingElement,
    InsertRestrictions: { Insertable: true }
  }
]
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [
  '_DeliveryAddress',
  '_PurchaseOrder',
  '_PurchaseOrderInvoicingPlan',
  '_PurchaseOrderItemNote',
  '_PurchaseOrderScheduleLineTP',
  '_PurOrdAccountAssignment',
  '_PurOrdPricingElement'
]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [
  { Property: ProductPurchasePointsQty, AllowedExpressions: 'MultiValue' },
  { Property: NetPriceQuantity, AllowedExpressions: 'MultiValue' },
  { Property: NetAmount, AllowedExpressions: 'MultiValue' },
  { Property: GrossAmount, AllowedExpressions: 'MultiValue' },
  { Property: EffectiveAmount, AllowedExpressions: 'MultiValue' },
  { Property: Subtotal1Amount, AllowedExpressions: 'MultiValue' },
  { Property: Subtotal2Amount, AllowedExpressions: 'MultiValue' },
  { Property: Subtotal3Amount, AllowedExpressions: 'MultiValue' },
  { Property: Subtotal4Amount, AllowedExpressions: 'MultiValue' },
  { Property: Subtotal5Amount, AllowedExpressions: 'MultiValue' },
  { Property: Subtotal6Amount, AllowedExpressions: 'MultiValue' },
  { Property: OrderQuantity, AllowedExpressions: 'MultiValue' },
  { Property: NetPriceAmount, AllowedExpressions: 'MultiValue' },
  { Property: ItemVolume, AllowedExpressions: 'MultiValue' },
  { Property: ItemGrossWeight, AllowedExpressions: 'MultiValue' },
  { Property: ItemNetWeight, AllowedExpressions: 'MultiValue' },
  {
    Property: NonDeductibleInputTaxAmount,
    AllowedExpressions: 'MultiValue'
  },
  { Property: DownPaymentAmount, AllowedExpressions: 'MultiValue' },
  {
    Property: ExpectedOverallLimitAmount,
    AllowedExpressions: 'MultiValue'
  },
  { Property: OverallLimitAmount, AllowedExpressions: 'MultiValue' }
]
entity purchaseorder_edmx.PurchaseOrderItem {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Pedido de compras'
  @Common.Heading : 'Número pedido de compras'
  @Common.QuickInfo : 'Número pedido de compras'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición de pedido'
  @Common.Heading : 'Número de posición de orden de compra'
  @Common.QuickInfo : 'Número de posición de orden de compra'
  key PurchaseOrderItem : String(5) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo doc.compras'
  @Common.Heading : 'Tp.'
  @Common.QuickInfo : 'Tipo de documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BSTYP'
  PurchaseOrderCategory : String(1) not null;
  @Common.IsCurrency : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda'
  @Common.Heading : 'Mon.'
  @Common.QuickInfo : 'Clave de moneda'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WAERS'
  DocumentCurrency : String(3) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Indicador de borrado'
  @Common.Heading : 'B'
  @Common.QuickInfo : 'Indicador de borrado en el documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ELOEK'
  PurchasingDocumentDeletionCode : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Grupo de artículos'
  @Common.Heading : 'Grupo art.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MATKL'
  MaterialGroup : String(9) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Material'
  @Common.QuickInfo : 'Número de material'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MATNR'
  Material : String(18) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de material'
  @Common.Heading : 'TpMt'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MTART'
  MaterialType : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Nº mater.proveedor'
  @Common.Heading : 'Nº material de proveedor'
  @Common.QuickInfo : 'Número de material utilizado por el proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=IDNLF'
  SupplierMaterialNumber : String(35) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Surt.parc.proveedor'
  @Common.Heading : 'SPP'
  @Common.QuickInfo : 'Surtido parcial de proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LTSNR'
  SupplierSubrange : String(6) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Nº pieza fabric.'
  @Common.Heading : 'NºFb'
  @Common.QuickInfo : 'Nº pieza fabricante'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MFRPN'
  ManufacturerPartNmbr : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Fabricante'
  @Common.QuickInfo : 'Número de un fabricante'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MFRNR'
  Manufacturer : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Material'
  @Common.QuickInfo : 'Número de material'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EMATNR'
  ManufacturerMaterial : String(18) not null;
  @Common.Label : 'Texto breve'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TXZ01'
  PurchaseOrderItemText : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Grupo tipos producto'
  @Common.Heading : 'Grupo de tipos de producto'
  @Common.QuickInfo : 'Grupo de tipos de producto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PRODUCT_TYPE'
  ProductTypeCode : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Sociedad'
  @Common.Heading : 'Soc.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BUKRS'
  CompanyCode : String(4) not null;
  @Common.FieldControl : #Mandatory
  @Common.IsUpperCase : true
  @Common.Label : 'Centro'
  @Common.Heading : 'Ce.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EWERK'
  Plant : String(4) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Dirección'
  @Common.QuickInfo : 'Nº dirección manual en posición de documento de compras'
  ManualDeliveryAddressID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Dirección'
  @Common.QuickInfo : 'Número dirección de la entrega'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ADRN2'
  ReferenceDeliveryAddressID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cliente'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EKUNNR'
  Customer : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Proveedor'
  @Common.QuickInfo : 'Proveedor que recibe la entrega/que suministra'
  Subcontractor : String(10) not null;
  @Common.Label : 'Proveedor subcontr.'
  @Common.Heading : 'P'
  @Common.QuickInfo : 'Proveedor de subcontratación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LBLKZ'
  SupplierIsSubcontractor : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Mat.config.p.tod.ce.'
  @Common.Heading : 'Mat.gral.conf.'
  @Common.QuickInfo : 'Material general configurable'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SATNR'
  CrossPlantConfigurableProduct : String(18) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Categoría material'
  @Common.Heading : 'Tp'
  @Common.QuickInfo : 'Categoría de material'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ATTYP'
  ArticleCategory : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Suministro prod.'
  @Common.QuickInfo : 'Clase suministro producción'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KBNKZ'
  PlndOrderReplnmtElmntType : String(1) not null;
  @Common.IsUnit : true
  @Common.Label : 'Unidad de puntos'
  @Common.Heading : 'UnP'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PUNEI'
  ProductPurchasePointsQtyUnit : String(3) not null;
  @Measures.Unit : ProductPurchasePointsQtyUnit
  @Common.Label : 'Puntos'
  @Common.QuickInfo : 'Número puntos'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ANZPU'
  ProductPurchasePointsQty : Decimal(13, 3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Ubicación de almacén'
  @Common.Heading : 'Alm.'
  StorageLocation : String(4) not null;
  @Common.IsUnit : true
  @Common.Label : 'Unidad medida pedido'
  @Common.Heading : 'UMP'
  @Common.QuickInfo : 'Unidad de medida de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BSTME'
  PurchaseOrderQuantityUnit : String(3) not null;
  @Common.Label : 'corresponde'
  @Common.Heading : 'Corres'
  @Common.QuickInfo : 'Numerador para la conversión de UM pedido en UM base'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UMBSZ'
  OrderItemQtyToBaseQtyNmrtr : Decimal(precision: 5) not null;
  @Common.Label : 'Denominador'
  @Common.Heading : 'Denom.'
  @Common.QuickInfo : 'Denominador para la conversión de UM-pedido en UM-base'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UMBSN'
  OrderItemQtyToBaseQtyDnmntr : Decimal(precision: 5) not null;
  @Measures.Unit : OrderPriceUnit
  @Common.Label : 'Unidad precio'
  @Common.Heading : 'Por'
  @Common.QuickInfo : 'Unidad de precio'
  NetPriceQuantity : Decimal(precision: 5) not null;
  @Common.Label : 'Entrega completa'
  @Common.Heading : 'EnC'
  @Common.QuickInfo : 'Indicador de "Entrega completa"'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ELIKZ'
  IsCompletelyDelivered : Boolean not null;
  @Common.Label : 'Factura final'
  @Common.Heading : 'FaF'
  @Common.QuickInfo : 'Indicador de factura final'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EREKZ'
  IsFinallyInvoiced : Boolean not null;
  @Common.Label : 'Entrada mercancías'
  @Common.Heading : 'EM'
  @Common.QuickInfo : 'Indicador de entrada de mercancías'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WEPOS'
  GoodsReceiptIsExpected : Boolean not null;
  @Common.Label : 'Recepción facturas'
  @Common.Heading : 'RF'
  @Common.QuickInfo : 'Indicador de recepción de factura'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=REPOS'
  InvoiceIsExpected : Boolean not null;
  @Common.Label : 'Oblig.confirmación'
  @Common.Heading : 'IOC'
  @Common.QuickInfo : 'Obligación de confirmación de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZABS'
  IsOrderAcknRqd : Boolean not null;
  @Common.Label : 'Verific.fact.base EM'
  @Common.Heading : 'EM/VF'
  @Common.QuickInfo : 'Indicador p.verificación de facturas sobre la base de la EM'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WEBRE'
  InvoiceIsGoodsReceiptBased : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Contrato marco'
  @Common.Heading : 'Contr.'
  @Common.QuickInfo : 'Número del contrato superior'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KONNR'
  PurchaseContract : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Pos.contrato'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Número de la posición del contrato marco superior'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KTPNR'
  PurchaseContractItem : String(5) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Solicitud de pedido'
  @Common.Heading : 'Sol.pedido'
  @Common.QuickInfo : 'Número de la solicitud de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BANFN'
  PurchaseRequisition : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Pos.solicitud pedido'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Número de posición de la solicitud de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BNFPO'
  PurchaseRequisitionItem : String(5) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Número de necesidad'
  @Common.Heading : 'Nº nec.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BEDNR'
  RequirementTracking : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Petición de oferta'
  @Common.Heading : 'Pet.oferta'
  @Common.QuickInfo : 'Núm.petición oferta'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ANFNR'
  SupplierQuotation : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Número de posición de la petición de oferta'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ANFPS'
  SupplierQuotationItem : String(5) not null;
  @Common.Label : 'Autofacturación'
  @Common.Heading : 'E'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=XERSY'
  EvaldRcptSettlmtIsAllowed : Boolean not null;
  @Common.Label : 'Exceso sumin.ilim.'
  @Common.Heading : 'Ilimitado'
  @Common.QuickInfo : 'Exceso ilimitado de suministro'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UEBTK'
  UnlimitedOverdeliveryIsAllowed : Boolean not null;
  @Common.Label : 'Tol.exc.suministro'
  @Common.Heading : 'Tol.exc.sum.'
  @Common.QuickInfo : 'Tolerancia de exceso de suministro'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UEBTO'
  OverdelivTolrtdLmtRatioInPct : Decimal(3, 1) not null;
  @Common.Label : 'Toler.faltas sumin.'
  @Common.Heading : 'TolSumIncomp'
  @Common.QuickInfo : 'Tolerancia de suministro incompleto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UNTTO'
  UnderdelivTolrtdLmtRatioInPct : Decimal(3, 1) not null;
  @Common.Label : 'Solicitante'
  @Common.QuickInfo : 'Nombre del solicitante'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AFNAM'
  RequisitionerName : String(12) not null;
  @Common.Label : 'Plazo entrega prev.'
  @Common.Heading : 'PzE'
  @Common.QuickInfo : 'Plazo de entrega previsto en días'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EPLIF'
  PlannedDeliveryDurationInDays : Decimal(precision: 3) not null;
  @Common.Label : 'Tmpo.tratamiento EM'
  @Common.Heading : 'HEM'
  @Common.QuickInfo : 'Tiempo de tratamiento para la entrada de mercancía en días'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WEBAZ'
  GoodsReceiptDurationInDays : Decimal(precision: 3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Entrega parcial/pos.'
  @Common.Heading : 'EP'
  @Common.QuickInfo : 'Entrega parcial nivel de posición (traslado)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZTUL'
  PartialDeliveryIsAllowed : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Consumo'
  @Common.Heading : 'CoC'
  @Common.QuickInfo : 'Contabilización de consumo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZVBR'
  ConsumptionPosting : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Prestatario serv.'
  @Common.Heading : 'PrestServ'
  @Common.QuickInfo : 'Prestatario de servicios'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SERVICEPERFORMER'
  ServicePerformer : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Nº paquete'
  @Common.Heading : 'Número'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PACKNO'
  ServicePackage : String(10) not null;
  @Common.IsUnit : true
  @Common.Label : 'Unidad medida base'
  @Common.Heading : 'UMB'
  @Common.QuickInfo : 'Unidad de medida base'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LAGME'
  BaseUnit : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de posición'
  @Common.Heading : 'P'
  @Common.QuickInfo : 'Tipo de posición del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PSTYP'
  PurchaseOrderItemCategory : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Centro de beneficio'
  @Common.Heading : 'CeBe'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PRCTR'
  ProfitCenter : String(10) not null;
  @Common.IsUnit : true
  @Common.Label : 'UM precio pedido'
  @Common.Heading : 'UMP'
  @Common.QuickInfo : 'Unidad medida de precio de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BBPRM'
  OrderPriceUnit : String(3) not null;
  @Common.IsUnit : true
  @Common.Label : 'Unidad de volumen'
  @Common.Heading : 'UV'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VOLEH'
  ItemVolumeUnit : String(3) not null;
  @Common.IsUnit : true
  @Common.Label : 'Unidad de peso'
  @Common.Heading : 'Un'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EGEWE'
  ItemWeightUnit : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Ind.distribución'
  @Common.Heading : 'D'
  @Common.QuickInfo : 'Indicador de distribución en la imputación múltiple'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VRTKZ'
  MultipleAcctAssgmtDistribution : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Factura parcial'
  @Common.Heading : 'FaP'
  @Common.QuickInfo : 'Indicador de factura parcial'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TWRKZ'
  PartialInvoiceDistribution : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Control fecha precio'
  @Common.Heading : 'C'
  @Common.QuickInfo : 'Control fecha determinación del precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MEPRF'
  PricingDateControl : String(1) not null;
  @Common.Label : 'Estadística'
  @Common.Heading : 'E'
  @Common.QuickInfo : 'Posición es estadística'
  IsStatisticalItem : Boolean not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición superior'
  @Common.Heading : 'PosSu'
  @Common.QuickInfo : 'Posición superior en documentos de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UEBPO'
  PurchasingParentItem : String(5) not null;
  @Common.Label : 'Fecha EM más tardía'
  @Common.Heading : 'Fecha EM'
  @Common.QuickInfo : 'Última entrada mercancías posible'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LEWED'
  GoodsReceiptLatestCreationDate : Date;
  @Common.Label : 'Posición devolución'
  @Common.Heading : 'R'
  @Common.QuickInfo : 'Posición de devolución'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RETPO'
  IsReturnsItem : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Motivo de pedido'
  @Common.Heading : 'MotPd'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BSGRU'
  PurchasingOrderReason : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Incoterms'
  @Common.Heading : 'Incot'
  @Common.QuickInfo : 'Incoterms (parte 1)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCO1'
  IncotermsClassification : String(3) not null;
  @Common.Label : 'Incoterms (parte 2)'
  @Common.Heading : 'Incoterms2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCO2'
  IncotermsTransferLocation : String(28) not null;
  @Common.Label : 'Ubicac.incoterms 1'
  @Common.QuickInfo : 'Ubicación de incoterms 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCO2_L'
  IncotermsLocation1 : String(70) not null;
  @Common.Label : 'Ubic.incoterms 2'
  @Common.QuickInfo : 'Ubicación de incoterms 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INCO3_L'
  IncotermsLocation2 : String(70) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Proveedor precedente'
  @Common.Heading : 'Prov.prec.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KOLIF'
  PriorSupplier : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Código EAN/UPC'
  @Common.QuickInfo : 'Número de artículo europeo (EAN)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EAN11'
  InternationalArticleNumber : String(18) not null;
  @Common.Label : 'Cód.serv.Intrastat'
  @Common.Heading : 'Código de servicio Intrastat'
  @Common.QuickInfo : 'Código de servicio Intrastat'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=%2FSAPSLL%2FISVCO'
  IntrastatServiceCode : String(30) not null;
  @Common.Label : 'Cód.estad.mercancías'
  @Common.QuickInfo : 'Código estadístico de mercancías'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=%2FSAPSLL%2FCOMCO'
  CommodityCode : String(30) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Gr.porte mat.'
  @Common.Heading : 'GrpPortM'
  @Common.QuickInfo : 'Grupo de porte del material'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MFRGR'
  MaterialFreightGroup : String(8) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Suscep.bonif.especie'
  @Common.Heading : 'SuBonEs'
  @Common.QuickInfo : 'El material es susceptible de bonificación en especie'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=NRFHG'
  DiscountInKindEligibility : String(1) not null;
  @Common.Label : 'Bloq.expedición'
  @Common.QuickInfo : 'Posición bloqueada p.entrega SD'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=NOVET'
  PurgItemIsBlockedForDelivery : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Control confirmación'
  @Common.Heading : 'Ctrl'
  @Common.QuickInfo : 'Clave de control de confirmaciones'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BSTAE'
  SupplierConfirmationControlKey : String(4) not null;
  @Common.Label : 'Confirmación pedido'
  @Common.Heading : 'Confirmación'
  @Common.QuickInfo : 'Número de confirmación de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LABNR'
  PurgDocOrderAcknNumber : String(20) not null;
  @Common.Label : 'Impresión de precio'
  @Common.Heading : 'I'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PRSDR'
  PriceIsToBePrinted : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de imputación'
  @Common.Heading : 'I'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KNTTP'
  AccountAssignmentCategory : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Reg.info de compras'
  @Common.Heading : 'Reg.info'
  @Common.QuickInfo : 'Número del registro info de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INFNR'
  PurchasingInfoRecord : String(10) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Valor neto de orden'
  @Common.Heading : 'Valor neto'
  @Common.QuickInfo : 'Valor neto de orden en moneda de OC'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BWERT'
  NetAmount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Val.bruto pedido'
  @Common.Heading : 'Valor bruto'
  @Common.QuickInfo : 'Valor bruto del pedido en moneda de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BBWERT'
  GrossAmount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Valor efectivo'
  @Common.QuickInfo : 'Valor efectivo de la posición'
  EffectiveAmount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Subtotal 1'
  @Common.QuickInfo : 'Subtotal 1 de procedim.det.precios para elemento precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZWI1'
  Subtotal1Amount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Subtotal 2'
  @Common.QuickInfo : 'Subtotal 2 de proced.determin.precio p.elemento de precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZWI2'
  Subtotal2Amount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Subtotal 3'
  @Common.QuickInfo : 'Subtotal 3 de proced.determin.precio p.elemento de precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZWI3'
  Subtotal3Amount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Subtotal 4'
  @Common.QuickInfo : 'Subtotal 4 de proced.determin.precio p.elemento de precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZWI4'
  Subtotal4Amount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Subtotal 5'
  @Common.QuickInfo : 'Subtotal 5 de proced.determin.precio p.elemento de precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZWI5'
  Subtotal5Amount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Subtotal 6'
  @Common.QuickInfo : 'Subtotal 6 de proced.determin.precio p.elemento de precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZWI6'
  Subtotal6Amount : Decimal(precision: 13) not null;
  @Measures.Unit : PurchaseOrderQuantityUnit
  @Common.Label : 'Cantidad de orden'
  @Common.Heading : 'Ctd.orden'
  @Common.QuickInfo : 'Cantidad de orden de compra'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BSTMG'
  OrderQuantity : Decimal(13, 3) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Precio neto pedido'
  @Common.Heading : 'Prc.neto'
  @Common.QuickInfo : 'Precio neto en doc.compras moneda documento'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BPREI'
  NetPriceAmount : Decimal(precision: 11) not null;
  @Measures.Unit : ItemVolumeUnit
  @Common.Label : 'Volumen'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VOLUM'
  ItemVolume : Decimal(13, 3) not null;
  @Measures.Unit : ItemWeightUnit
  @Common.Label : 'Peso bruto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BRGEW'
  ItemGrossWeight : Decimal(13, 3) not null;
  @Measures.Unit : ItemWeightUnit
  @Common.Label : 'Peso neto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ENTGE'
  ItemNetWeight : Decimal(13, 3) not null;
  @Common.Label : 'Conversión cantidad'
  @Common.Heading : 'Conv.'
  @Common.QuickInfo : 'Numerador para la conversión UMPRP en UMP'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BPUMZ'
  OrderPriceUnitToOrderUnitNmrtr : Decimal(precision: 5) not null;
  @Common.Label : 'Conversión cantidad'
  @Common.Heading : 'Conv.'
  @Common.QuickInfo : 'Denominador para la conversión UMPRP en UMP'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BPUMN'
  OrdPriceUnitToOrderUnitDnmntr : Decimal(precision: 5) not null;
  @Common.Label : 'EM no valorada'
  @Common.Heading : 'N'
  @Common.QuickInfo : 'Entrada de mercancías no valorada'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WEUNB'
  GoodsReceiptIsNonValuated : Boolean not null;
  @Common.Label : 'Aceptación proveedor'
  @Common.Heading : 'AP'
  @Common.QuickInfo : 'Aceptación por parte del proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WEORA'
  IsToBeAcceptedAtOrigin : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Indicador impuestos'
  @Common.Heading : 'II'
  @Common.QuickInfo : 'Indicador IVA'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MWSKZ'
  TaxCode : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Domicilio fiscal'
  @Common.Heading : 'Domicil.fiscal'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TXJCD'
  TaxJurisdiction : String(15) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'País/Reg.decl.'
  @Common.Heading : 'País/Región de declaración fiscal'
  @Common.QuickInfo : 'País/Región de declaración fiscal'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FOT_TAX_COUNTRY'
  TaxCountry : String(3) not null;
  @Common.Label : 'Fecha fiscal'
  @Common.QuickInfo : 'Fecha para determinar tipos impositivos'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TXDAT'
  TaxDeterminationDate : Date;
  @Common.IsUpperCase : true
  @Common.Label : 'Normas de envío'
  @Common.Heading : 'En'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EVERS'
  ShippingInstruction : String(2) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'No deducible'
  @Common.QuickInfo : 'IVA soportado no deducible'
  NonDeductibleInputTaxAmount : Decimal(precision: 13) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de stocks'
  @Common.Heading : 'S'
  @Common.QuickInfo : 'Tipo de stock'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=INSMK'
  StockType : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Clase de valoración'
  @Common.Heading : 'Cl.valor.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BWTAR_D'
  ValuationType : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de valoración'
  @Common.Heading : 'TipVal'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BWTTY_D'
  ValuationCategory : String(1) not null;
  @Common.Label : 'Indicador de rechazo'
  @Common.Heading : 'R'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ABSKZ'
  ItemIsRejectedBySupplier : Boolean not null;
  @Common.Label : 'Fecha de precio'
  @Common.Heading : 'Fe.precio'
  @Common.QuickInfo : 'Fecha de la determinación del precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PREDT'
  PurgDocPriceDate : Date;
  @Common.IsUpperCase : true
  @Common.Label : 'Act.info'
  @Common.Heading : 'I'
  @Common.QuickInfo : 'Indicador: Actualizar registro Info'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SPINF'
  PurchasingInfoRecordUpdateCode : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Stock especial'
  @Common.Heading : 'E'
  @Common.QuickInfo : 'Indicador de stock especial'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SOBKZ'
  InventorySpecialStockType : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cl.entrega devol.'
  @Common.QuickInfo : 'Clase de entrega para devoluciones a proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LFRET'
  DeliveryDocumentType : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Almacén emisor'
  @Common.Heading : 'AlmEmi'
  @Common.QuickInfo : 'Almacén emisor para pedido de traslado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RESLO'
  IssuingStorageLocation : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tabla asignación'
  @Common.Heading : 'Tab.asign.'
  @Common.QuickInfo : 'Tabla de asignación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ABELN'
  AllocationTable : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Posición de tabla de asignación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ABELP'
  AllocationTableItem : String(5) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Promoción comercial'
  @Common.Heading : 'Promoción'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WAKTION'
  RetailPromotion : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Número de jerarquía'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EXLIN'
  PurgConfigurableItemNumber : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Subposiciones'
  @Common.Heading : 'S'
  @Common.QuickInfo : 'Existen subposiciones'
  PurgDocAggrgdSubitemCategory : String(1) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Clas.número ext.'
  @Common.Heading : 'Clas.número externo'
  @Common.QuickInfo : 'Número externo de clasificación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EXSNR'
  PurgExternalSortNumber : String(5) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Lote'
  @Common.QuickInfo : 'Número de lote'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CHARG_D'
  Batch : String(10) not null;
  @Common.Label : 'Gratis'
  @Common.QuickInfo : 'Posición sin cargo'
  PurchasingItemIsFreeOfCharge : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Anticipo'
  @Common.QuickInfo : 'Indicador de anticipo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ME_DPTYP'
  DownPaymentType : String(4) not null;
  @Common.Label : '% anticipo'
  @Common.Heading : 'Porcentaje anticipo'
  @Common.QuickInfo : 'Porcentaje de anticipo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ME_DPPCNT'
  DownPaymentPercentageOfTotAmt : Decimal(5, 2) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Importe de anticipo'
  @Common.QuickInfo : 'Importe de anticipo en moneda del documento'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ME_DPAMNT'
  DownPaymentAmount : Decimal(precision: 11) not null;
  @Common.Label : 'Fecha vencim.antic.'
  @Common.Heading : 'Fecha vencimiento de anticipo'
  @Common.QuickInfo : 'Fecha de vencimiento del anticipo'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ME_DPDDAT'
  DownPaymentDueDate : Date;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Valor previsto'
  @Common.QuickInfo : 'Valor previsto del límite global'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=COMMITMENT'
  ExpectedOverallLimitAmount : Decimal(precision: 13) not null;
  @Measures.ISOCurrency : DocumentCurrency
  @Common.Label : 'Límite global'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SUMLIMIT'
  OverallLimitAmount : Decimal(precision: 13) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Contrato para límite'
  @Common.QuickInfo : 'Pedido abierto de compras para límite ampliado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CTR_FOR_LIMIT'
  PurContractForOverallLimit : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Pos.contr.p.PosLím'
  @Common.Heading : 'Posición ref.contrato compra p.posición límite ampliado'
  @Common.QuickInfo : 'Posición ref.contrato de compra p.posición límite ampliado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CTR_ITEM_FOR_LIMIT'
  PurContractItemForOverallLimit : String(5) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Est.verif.proveedor'
  @Common.Heading : 'Est.verif.prov.'
  @Common.QuickInfo : 'Estado verificación proveedor conformidad de producto (pos.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PC_STATUS_PCS'
  PurgProdCmplncSupplierStatus : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Est.cap.merc.prod.'
  @Common.Heading : 'EstCapMercProd'
  @Common.QuickInfo : 'Estado de capacidad de mercado (posición)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PC_STATUS_PMA'
  PurgProductMarketabilityStatus : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Estado hoja dat.seg.'
  @Common.Heading : 'EstHojDatSeg.'
  @Common.QuickInfo : 'Estado de hoja de datos de seguridad (posición)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PC_STATUS_SDS'
  PurgSafetyDataSheetStatus : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Est.mcía.pelig.'
  @Common.Heading : 'Est.mcía.pel.'
  @Common.QuickInfo : 'Estado de mercancías peligrosas (posición)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_PC_STATUS_DG'
  PurgProdCmplncDngrsGoodsStatus : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Origen de material'
  @Common.Heading : 'O'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=J_1BMATORG'
  BR_MaterialOrigin : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Uso de material'
  @Common.QuickInfo : 'Utilización del material'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=J_1BMATUSE'
  BR_MaterialUsage : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Material: Tipo CFOP'
  @Common.Heading : 'MC'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=J_1BINDUS3'
  BR_CFOPCategory : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'NCM Code'
  @Common.QuickInfo : 'Brazilian NCM Code'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=J_1BNBMCO1'
  BR_NCM : String(16) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'HSN/SAC Code'
  @Common.QuickInfo : 'HSN or SAC Code'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=J_1IG_HSN_SAC'
  ConsumptionTaxCtrlCode : String(16) not null;
  @Common.Label : 'Fabricación propia'
  @Common.Heading : 'P'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=J_1BOWNPRO'
  BR_IsProducedInHouse : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Año de temporada'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FSH_SAISJ'
  ProductSeasonYear : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Temporada'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FSH_SAISO'
  ProductSeason : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Colección'
  @Common.QuickInfo : 'Colección Fashion'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FSH_COLLECTION'
  ProductCollection : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tema'
  @Common.QuickInfo : 'Tema Fashion'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FSH_THEME'
  ProductTheme : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Ind.integr.temporada'
  @Common.Heading : 'Indicador de integridad de temporada'
  @Common.QuickInfo : 'Indicador de integridad de temporada'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RFM_SCC_INDICATOR'
  SeasonCompletenessStatus : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Regla agrup.PSST'
  @Common.Heading : 'Regla de agrupación PSST'
  @Common.QuickInfo : 'Regla de agrupación PSST'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RFM_PSST_RULE'
  ShippingGroupRule : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Grupo PSST'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RFM_PSST_GROUP_ID'
  ShippingGroupNumber : String(10) not null;
  @Common.Label : 'Característica 1'
  @Common.Heading : 'Denom.característica 1'
  @Common.QuickInfo : 'Denom.característica 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WRF_CHARSTC1'
  ProductCharacteristic1 : String(18) not null;
  @Common.Label : 'Característica 2'
  @Common.Heading : 'Denom.característica 2'
  @Common.QuickInfo : 'Denom.característica 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WRF_CHARSTC2'
  ProductCharacteristic2 : String(18) not null;
  @Common.Label : 'Característica 3'
  @Common.Heading : 'Denom.característica 3'
  @Common.QuickInfo : 'Denominación de característica 3'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WRF_CHARSTC3'
  ProductCharacteristic3 : String(18) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de subposición'
  @Common.Heading : 'S'
  @Common.QuickInfo : 'Tipo de subposición doc. compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=UPTYP'
  PurgDocSubitemCategory : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Estado de desviación'
  @Common.Heading : 'Estado de proceso de desviación'
  @Common.QuickInfo : 'Estado de proceso de desviación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RFM_DIVERSION_STATUS'
  DiversionStatus : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Documento referencia'
  @Common.Heading : 'Documento referencia para rastreabilidad de pedido'
  @Common.QuickInfo : 'Número de documento de referencia para rastreabilidad pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RFM_REF_DOC'
  ReferenceDocumentNumber : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Pos.referencia'
  @Common.Heading : 'Posición referencia para pedido'
  @Common.QuickInfo : 'Número posición de referencia para rastreabilidad de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RFM_REF_ITEM'
  ReferenceDocumentItem : String(6) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Acción de referencia'
  @Common.Heading : 'Acción de partición de referencia en pedido'
  @Common.QuickInfo : 'Acción para rastreabilidad en pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=RFM_REF_ACTION'
  PurchaseOrderReferenceType : String(1) not null;
  @Common.Label : 'SVA relevante'
  @Common.Heading : 'SVA relev.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=FSH_VAS_REL'
  ItemHasValueAddedService : Boolean not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Número de posición del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELP'
  ValAddedSrvcParentItmNumber : String(5) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Segmento de stock'
  @Common.Heading : 'Segmento stock'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SGT_SCAT'
  StockSegment : String(40) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  @Common.Composition : true
  _DeliveryAddress : Composition of one purchaseorder_edmx.PurOrderItemDeliveryAddress {  };
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  @Common.Composition : true
  _PurchaseOrderInvoicingPlan : Composition of many purchaseorder_edmx.PurchaseOrderInvoicingPlan {  };
  @Common.Composition : true
  _PurchaseOrderItemNote : Composition of many purchaseorder_edmx.PurchaseOrderItemNote {  };
  @Common.Composition : true
  _PurchaseOrderScheduleLineTP : Composition of many purchaseorder_edmx.PurchaseOrderScheduleLine {  };
  @Common.Composition : true
  _PurOrdAccountAssignment : Composition of many purchaseorder_edmx.PurchaseOrderAccountAssignment {  };
  @Common.Composition : true
  _PurOrdPricingElement : Composition of many purchaseorder_edmx.PurOrderItemPricingElement {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Notas de posición'
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.FilterRestrictions.Filterable : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [ { Property: PlainLongText, AllowedExpressions: 'SearchExpression' } ]
@Capabilities.SortRestrictions.NonSortableProperties : [ 'PlainLongText' ]
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.Updatable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrder', '_PurchaseOrderItem' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
entity purchaseorder_edmx.PurchaseOrderItemNote {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Pedido de compras'
  @Common.Heading : 'Número pedido de compras'
  @Common.QuickInfo : 'Número pedido de compras'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición de pedido'
  @Common.Heading : 'Número de posición de orden de compra'
  @Common.QuickInfo : 'Número de posición de orden de compra'
  key PurchaseOrderItem : String(5) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'ID texto'
  @Common.Heading : 'ID'
  @Common.QuickInfo : 'ID de texto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TDID'
  key TextObjectType : String(4) not null;
  @Core.Immutable : true
  @Common.Label : 'Clave de idioma'
  @Common.Heading : 'Idioma'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SPRAS'
  key Language : String(2) not null;
  @Common.Label : 'Txt.explicativo'
  @Common.QuickInfo : 'Texto explicativo'
  PlainLongText : LargeString not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Posic.doc.'
  @Common.Heading : 'Posición'
  @Common.QuickInfo : 'Concatenación de EBELN y EBELP'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PURCHASINGDOCUMENTITEMUNIQUEID'
  PurchaseOrderItemUniqueID : String(15) not null;
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  _PurchaseOrderItem : Association to one purchaseorder_edmx.PurchaseOrderItem {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Notas de cabecera'
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.FilterRestrictions.Filterable : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [ { Property: PlainLongText, AllowedExpressions: 'SearchExpression' } ]
@Capabilities.SortRestrictions.NonSortableProperties : [ 'PlainLongText' ]
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.Updatable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrder' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
entity purchaseorder_edmx.PurchaseOrderNote {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Pedido de compras'
  @Common.Heading : 'Número pedido de compras'
  @Common.QuickInfo : 'Número pedido de compras'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'ID texto'
  @Common.Heading : 'ID'
  @Common.QuickInfo : 'ID de texto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TDID'
  key TextObjectType : String(4) not null;
  @Core.Immutable : true
  @Common.Label : 'Clave de idioma'
  @Common.Heading : 'Idioma'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SPRAS'
  key Language : String(2) not null;
  @Common.Label : 'Txt.explicativo'
  @Common.QuickInfo : 'Texto explicativo'
  PlainLongText : LargeString not null;
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Soc.cial.'
@Common.Messages : SAP__Messages
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrderTP' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
entity purchaseorder_edmx.PurchaseOrderPartner {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Documento compras'
  @Common.Heading : 'Doc.compr.'
  @Common.QuickInfo : 'Número del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELN'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Función de socio'
  @Common.Heading : 'FunSc'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PARVW_UNV'
  key PartnerFunction : String(2) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Surt.parc.proveedor'
  @Common.Heading : 'SPP'
  @Common.QuickInfo : 'Surtido parcial de proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LTSNR'
  SupplierSubrange : String(6) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Centro'
  @Common.Heading : 'Ce.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WERKS_D'
  Plant : String(4) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Organización compras'
  @Common.Heading : 'OrgC'
  @Common.QuickInfo : 'Organización de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EKORG'
  PurchasingOrganization : String(4) not null;
  @Core.Computed : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Contador interlocut.'
  @Common.Heading : 'CInt'
  @Common.QuickInfo : 'Contador de interlocutor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PARZA'
  PartnerCounter : String(3) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Autor'
  @Common.QuickInfo : 'Nombre del responsable que ha añadido el objeto'
  CreatedByUser : String(12) not null;
  @Core.Computed : true
  @Common.Label : 'Fecha de creación'
  @Common.Heading : 'Fe.creac.'
  @Common.QuickInfo : 'Fecha de creación del registro'
  CreationDate : Date;
  @Common.IsUpperCase : true
  @Common.Label : 'Clase interlocutor'
  @Common.Heading : 'ClNúm'
  @Common.QuickInfo : 'Clase del número de interlocutor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=NRART'
  PurchasingDocumentPartnerType : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Proveedor'
  @Common.QuickInfo : 'Número de cuenta de proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LIFNR'
  Supplier : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo jerarquía'
  @Common.Heading : 'Proveedor de tipo de jerarquía'
  @Common.QuickInfo : 'Tipo de jerarquía: Jerarquía de proveedores'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=HITYP_LH'
  SupplierHierarchyCategory : String(1) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Persona de contacto'
  @Common.Heading : 'Interl.'
  @Common.QuickInfo : 'Número de la persona de contacto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PARNR'
  SupplierContact : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Número de personal'
  @Common.Heading : 'Nº pers.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PERNR_D'
  PersonWorkAgreement : String(8) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Número de personal'
  @Common.Heading : 'Nº pers.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PERNR_D'
  EmploymentInternalID : String(8) not null;
  @Core.Computed : true
  @Common.Label : 'Interl. por defecto'
  @Common.Heading : 'I'
  @Common.QuickInfo : 'Interlocutor por defecto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=DEFPA'
  DefaultPartner : Boolean not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  _PurchaseOrderTP : Association to one purchaseorder_edmx.PurchaseOrder {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Repartos'
@Common.Messages : SAP__Messages
@Capabilities.NavigationRestrictions.RestrictedProperties : [
  {
    NavigationProperty: _SubcontractingComponent,
    InsertRestrictions: { Insertable: true }
  }
]
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrder', '_PurchaseOrderItem', '_SubcontractingComponent' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [
  { Property: ScheduleLineOrderQuantity, AllowedExpressions: 'MultiValue' },
  { Property: OpenPurchaseOrderQuantity, AllowedExpressions: 'MultiValue' }
]
entity purchaseorder_edmx.PurchaseOrderScheduleLine {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Documento compras'
  @Common.Heading : 'Doc.compr.'
  @Common.QuickInfo : 'Número del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELN'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Número de posición del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELP'
  key PurchaseOrderItem : String(5) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Reparto'
  @Common.Heading : 'Rep.'
  @Common.QuickInfo : 'Contador de repartos'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EETEN'
  key ScheduleLine : String(4) not null;
  @Common.Label : 'Fecha de entrega'
  @Common.Heading : 'Fe.entrega'
  @Common.QuickInfo : 'Fecha de entrega de posición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EINDT'
  ScheduleLineDeliveryDate : Date;
  @Common.Label : 'Fecha entrega estad.'
  @Common.Heading : 'FeEntEst'
  @Common.QuickInfo : 'Fecha de entrega relevante para estadística'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SLFDT'
  SchedLineStscDeliveryDate : Date;
  @Common.Label : 'Fecha de inicio'
  @Common.QuickInfo : 'Fecha de inicio para el período de prestación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_SERVPROC_PERIOD_START'
  PerformancePeriodStartDate : Date;
  @Common.Label : 'Fecha de fin'
  @Common.QuickInfo : 'Fecha de fin para el período de prestación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MMPUR_SERVPROC_PERIOD_END'
  PerformancePeriodEndDate : Date;
  @Common.Label : 'Hora'
  @Common.QuickInfo : 'Hora de la fecha de entrega'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LZEIT'
  ScheduleLineDeliveryTime : Time not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Lote'
  @Common.QuickInfo : 'Número de lote'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=CHARG_D'
  Batch : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Lote de proveedor'
  @Common.Heading : 'Lote proveedor'
  @Common.QuickInfo : 'Número de lote de proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LICHN'
  BatchBySupplier : String(15) not null;
  @Measures.Unit : PurchaseOrderQuantityUnit
  @Common.Label : 'Cantidad de reparto'
  @Common.Heading : 'Cantidad reparto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ETMEN'
  ScheduleLineOrderQuantity : Decimal(13, 3) not null;
  @Measures.Unit : PurchaseOrderQuantityUnit
  OpenPurchaseOrderQuantity : Decimal(14, 3) not null;
  @Common.IsUnit : true
  @Core.Computed : true
  @Common.Label : 'Unidad medida pedido'
  @Common.Heading : 'UMP'
  @Common.QuickInfo : 'Unidad de medida de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BSTME'
  PurchaseOrderQuantityUnit : String(3) not null;
  @Common.IsCurrency : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda'
  @Common.Heading : 'Mon.'
  @Common.QuickInfo : 'Clave de moneda'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WAERS'
  Currency : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Solicitud de pedido'
  @Common.Heading : 'Sol.pedido'
  @Common.QuickInfo : 'Número de la solicitud de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BANFN'
  PurchaseRequisition : String(10) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Pos.solicitud pedido'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Número de posición de la solicitud de pedido'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=BNFPO'
  PurchaseRequisitionItem : String(5) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de fe.entrega'
  @Common.Heading : 'T'
  @Common.QuickInfo : 'Tipo de fecha de la fecha de entrega'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LPEIN'
  DelivDateCategory : String(1) not null;
  @Common.Label : 'Fecha de pedido'
  @Common.Heading : 'Fe.pedido'
  @Common.QuickInfo : 'Fecha de pedido del reparto'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=ETBDT'
  ScheduleLineOrderDate : Date;
  @Common.Label : 'Fecha puesta dis.Mat'
  @Common.Heading : 'FeDispoMat'
  @Common.QuickInfo : 'Fecha de puesta a disposición del material'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MBDAT'
  ProductAvailabilityDate : Date;
  @Common.Label : 'Fecha de carga'
  @Common.Heading : 'Fe.carga'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LDDAT'
  LoadingDate : Date;
  @Common.Label : 'Hora de carga'
  @Common.Heading : 'Hora carga'
  @Common.QuickInfo : 'Hora de carga (local, referida a un puesto de expedición)'
  LoadingTime : Time not null;
  @Common.Label : 'Fecha planif.transp.'
  @Common.Heading : 'Pl.transp.'
  @Common.QuickInfo : 'Fecha de planificación de transporte'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TDDAT_D'
  TransportationPlanningDate : Date;
  @Common.Label : 'Hora planif.transp.'
  @Common.Heading : 'HPlanTrans'
  @Common.QuickInfo : 'Hora planificación transporte (local, referida a pto.exped.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TDUHR'
  TransportationPlanningTime : Time not null;
  @Common.Label : 'Fecha salida mcías.'
  @Common.Heading : 'Sal.mcías.'
  @Common.QuickInfo : 'Fecha de salida de mercancías'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WADAT'
  GoodsIssueDate : Date;
  @Common.Label : 'Hora sal.mcías.'
  @Common.Heading : 'Hora SM'
  @Common.QuickInfo : 'Hora de salida de mercancías (local con ref.a un centro)'
  GoodsIssueTime : Time not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Plan de itinerarios'
  @Common.Heading : 'PlIti'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AULWE'
  RouteSchedule : String(10) not null;
  @Common.Label : 'h puesta disp.mat.'
  @Common.Heading : 'h PtaDisp'
  @Common.QuickInfo : 'Hora de puesta a disposición del mat.(local, en rel.a ce.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MBUHR'
  ProductAvailabilityTime : Time not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  _PurchaseOrderItem : Association to one purchaseorder_edmx.PurchaseOrderItem {  };
  @Common.Composition : true
  _SubcontractingComponent : Composition of many purchaseorder_edmx.POSubcontractingComponent {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Dirección de proveedor'
@Common.Messages : SAP__Messages
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrderTP' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [ { Property: EmailAddress, AllowedExpressions: 'MultiValue' } ]
entity purchaseorder_edmx.PurchaseOrderSupplierAddress {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Nº dirección'
  @Common.Heading : 'Nº direc.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_ADDRNUM'
  key SupplierAddressID : String(10) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Pedido de compras'
  @Common.Heading : 'Número pedido de compras'
  @Common.QuickInfo : 'Número pedido de compras'
  key PurchaseOrder : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Nº dirección'
  @Common.Heading : 'Nº direc.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_ADDRNUM'
  AddressID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Número de persona'
  @Common.Heading : 'Persona'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PERSNUM'
  AddressPersonID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Versión dirección'
  @Common.Heading : 'Versión'
  @Common.QuickInfo : 'Indicadores de versión para direcciones internacionales'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_NATION'
  AddressRepresentationCode : String(1) not null;
  @Common.Label : 'Clave de idioma'
  @Common.Heading : 'Idioma'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SPRAS'
  CorrespondenceLanguage : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Forma comunicación'
  @Common.Heading : 'Fo.comunicación'
  @Common.QuickInfo : 'Forma de comunicación (clave) (Business Address Services)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_COMM'
  PrfrdCommMediumType : String(3) not null;
  @Common.Label : 'Nombre completo'
  @Common.QuickInfo : 'Nombre completo de la persona'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_NAMTEXT'
  AddresseeFullName : String(80) not null;
  @Common.Label : 'Nombre'
  @Common.QuickInfo : 'Nombre 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_NAME1'
  OrganizationName1 : String(40) not null;
  @Common.Label : 'Nombre 2'
  OrganizationName2 : String(40) not null;
  @Common.Label : 'Nombre 3'
  OrganizationName3 : String(40) not null;
  @Common.Label : 'Nombre 4'
  OrganizationName4 : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Concepto búsqueda 1'
  @Common.QuickInfo : 'Concepto de búsqueda 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_SORT1'
  AddressSearchTerm1 : String(20) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Concepto búsqueda 2'
  @Common.QuickInfo : 'Concepto de búsqueda 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_SORT2'
  AddressSearchTerm2 : String(20) not null;
  @Common.Label : 'Población'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_CITY1'
  CityName : String(40) not null;
  @Common.Label : 'Distrito'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_CITY2'
  DistrictName : String(40) not null;
  @Common.Label : 'Residencia alt.'
  @Common.Heading : 'Lugar de residencia (dif.población CP)'
  @Common.QuickInfo : 'Lugar de residencia (diferente de población cód.postal)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_CITY3'
  VillageName : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Código postal'
  @Common.Heading : 'Cód.postal'
  @Common.QuickInfo : 'Código postal de la población'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PSTCD1'
  PostalCode : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cód.postal empresa'
  @Common.Heading : 'Cód.postal'
  @Common.QuickInfo : 'Código postal de la empresa (en caso de clientes import.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PSTCD3'
  CompanyPostalCode : String(10) not null;
  @Common.Label : 'Calle'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_STREET'
  StreetName : String(60) not null;
  @Common.Label : 'Calle 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_STRSPP1'
  StreetPrefixName1 : String(40) not null;
  @Common.Label : 'Calle 3'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_STRSPP2'
  StreetPrefixName2 : String(40) not null;
  @Common.Label : 'Calle 4'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_STRSPP3'
  StreetSuffixName1 : String(40) not null;
  @Common.Label : 'Calle 5'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_LCTN'
  StreetSuffixName2 : String(40) not null;
  @Common.Label : 'Nº (edificio)'
  @Common.Heading : 'Nº (edif.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_HSNM1'
  HouseNumber : String(10) not null;
  @Common.Label : 'Apéndice'
  @Common.Heading : 'Suplemento'
  @Common.QuickInfo : 'Suplemento al número de casa'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_HSNM2'
  HouseNumberSupplementText : String(10) not null;
  @Common.Label : 'Sigla del edificio'
  @Common.Heading : 'Edificios'
  @Common.QuickInfo : 'Edificio (número o sigla)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_BLDNG'
  Building : String(20) not null;
  @Common.Label : 'Piso'
  @Common.QuickInfo : 'Planta del edificio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_FLOOR'
  Floor : String(10) not null;
  @Common.Label : 'Número de sala'
  @Common.Heading : 'Nº sala'
  @Common.QuickInfo : 'Número de un piso, un apartamento o una sala'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_ROOMNUM'
  RoomNumber : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Clave de país/región'
  @Common.Heading : 'P/R'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LAND1'
  Country : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Región'
  @Common.Heading : 'Rg'
  @Common.QuickInfo : 'Región (Estado federal, Estado federado, provincia, condado)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=REGIO'
  Region : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tratamiento'
  @Common.Heading : 'Clave'
  @Common.QuickInfo : 'Clave de tratamiento'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_TITLE'
  FormOfAddress : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Domicilio fiscal'
  @Common.Heading : 'Domicil.fiscal'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_TXJCD'
  TaxJurisdiction : String(15) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Zona de transporte'
  @Common.Heading : 'ZonaTransp'
  @Common.QuickInfo : 'Zona de transporte donde se efectúan las entregas'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LZONE'
  TransportZone : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Apartado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBX'
  POBox : String(10) not null;
  @Common.Label : 'Apartado sin nº'
  @Common.Heading : 'Ap'
  @Common.QuickInfo : 'Indicador: Datos del apartado del correos sin número'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBXNUM'
  POBoxIsWithoutNumber : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'CP apartado'
  @Common.Heading : 'Cód.postal'
  @Common.QuickInfo : 'Código postal del apartado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PSTCD2'
  POBoxPostalCode : String(10) not null;
  @Common.Label : 'Estación ap.correos'
  @Common.Heading : 'Estación de apartado de correos'
  @Common.QuickInfo : 'Estación de apartado de correos (PO Box Lobby)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PO_BOX_LBY'
  POBoxLobbyName : String(40) not null;
  @Common.Label : 'Población apartado'
  @Common.QuickInfo : 'Población del apartado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBXLOC'
  POBoxDeviatingCityName : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Región del apartado'
  @Common.Heading : 'Reg.apart'
  @Common.QuickInfo : 'Región del apartado (estado federal, land, provincia, etc.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBXREG'
  POBoxDeviatingRegion : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'País/reg.apartado'
  @Common.Heading : 'P/R AC'
  @Common.QuickInfo : 'País/región de apartado de correos'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBXCTY'
  POBoxDeviatingCountry : String(3) not null;
  @Common.Label : 'c/o'
  @Common.Heading : 'Nombre c/o'
  @Common.QuickInfo : 'Nombre c/o'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_NAME_CO'
  CareOfName : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cl.serv.entrega'
  @Common.QuickInfo : 'Clase del servicio de entrega'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_DELIVERY_SERVICE_TYPE'
  DeliveryServiceTypeCode : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Número serv.entrega'
  @Common.Heading : 'Número del servicio de entrega'
  @Common.QuickInfo : 'Número del servicio de entrega'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_DELIVERY_SERVICE_NUMBER'
  DeliveryServiceNumber : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Huso horario'
  @Common.Heading : 'Hu.hor.'
  @Common.QuickInfo : 'Huso horario de la dirección'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_TZONE'
  AddressTimeZone : String(6) not null;
  @Common.Label : 'Correo electrónico'
  @Common.Heading : 'Dirección de correo electrónico'
  @Common.QuickInfo : 'Dirección de correo electrónico'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_SMTPADR'
  EmailAddress : String(241) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'St.verif./fich.pobl.'
  @Common.Heading : 'Status'
  @Common.QuickInfo : 'Status verif.resp.fichero población'
  RegionalStructureCheckStatus : String(1) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  _PurchaseOrderTP : Association to one purchaseorder_edmx.PurchaseOrder {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Dirección de entrega de posición'
@Common.Messages : SAP__Messages
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrder', '_PurchaseOrderItem' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [ { Property: EmailAddress, AllowedExpressions: 'MultiValue' } ]
entity purchaseorder_edmx.PurOrderItemDeliveryAddress {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Documento compras'
  @Common.Heading : 'Doc.compr.'
  @Common.QuickInfo : 'Número del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELN'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición de pedido'
  @Common.Heading : 'Número de posición de orden de compra'
  @Common.QuickInfo : 'Número de posición de orden de compra'
  key PurchaseOrderItem : String(5) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Dirección'
  @Common.QuickInfo : 'Nº dirección manual en posición de documento de compras'
  key DeliveryAddressID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Nº dirección'
  @Common.Heading : 'Nº direc.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_ADDRNUM'
  AddressID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Número de persona'
  @Common.Heading : 'Persona'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PERSNUM'
  AddressPersonID : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Versión dirección'
  @Common.Heading : 'Versión'
  @Common.QuickInfo : 'Indicadores de versión para direcciones internacionales'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_NATION'
  AddressRepresentationCode : String(1) not null;
  @Common.Label : 'Clave de idioma'
  @Common.Heading : 'Idioma'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SPRAS'
  CorrespondenceLanguage : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Forma comunicación'
  @Common.Heading : 'Fo.comunicación'
  @Common.QuickInfo : 'Forma de comunicación (clave) (Business Address Services)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_COMM'
  PrfrdCommMediumType : String(3) not null;
  @Common.Label : 'Nombre completo'
  @Common.QuickInfo : 'Nombre completo de la persona'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_NAMTEXT'
  AddresseeFullName : String(80) not null;
  @Common.Label : 'Nombre'
  @Common.QuickInfo : 'Nombre 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_NAME1'
  OrganizationName1 : String(40) not null;
  @Common.Label : 'Nombre 2'
  OrganizationName2 : String(40) not null;
  @Common.Label : 'Nombre 3'
  OrganizationName3 : String(40) not null;
  @Common.Label : 'Nombre 4'
  OrganizationName4 : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Concepto búsqueda 1'
  @Common.QuickInfo : 'Concepto de búsqueda 1'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_SORT1'
  AddressSearchTerm1 : String(20) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Concepto búsqueda 2'
  @Common.QuickInfo : 'Concepto de búsqueda 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_SORT2'
  AddressSearchTerm2 : String(20) not null;
  @Common.Label : 'Población'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_CITY1'
  CityName : String(40) not null;
  @Common.Label : 'Distrito'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_CITY2'
  DistrictName : String(40) not null;
  @Common.Label : 'Residencia alt.'
  @Common.Heading : 'Lugar de residencia (dif.población CP)'
  @Common.QuickInfo : 'Lugar de residencia (diferente de población cód.postal)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_CITY3'
  VillageName : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Código postal'
  @Common.Heading : 'Cód.postal'
  @Common.QuickInfo : 'Código postal de la población'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PSTCD1'
  PostalCode : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cód.postal empresa'
  @Common.Heading : 'Cód.postal'
  @Common.QuickInfo : 'Código postal de la empresa (en caso de clientes import.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PSTCD3'
  CompanyPostalCode : String(10) not null;
  @Common.Label : 'Calle'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_STREET'
  StreetName : String(60) not null;
  @Common.Label : 'Calle 2'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_STRSPP1'
  StreetPrefixName1 : String(40) not null;
  @Common.Label : 'Calle 3'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_STRSPP2'
  StreetPrefixName2 : String(40) not null;
  @Common.Label : 'Calle 4'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_STRSPP3'
  StreetSuffixName1 : String(40) not null;
  @Common.Label : 'Calle 5'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_LCTN'
  StreetSuffixName2 : String(40) not null;
  @Common.Label : 'Nº (edificio)'
  @Common.Heading : 'Nº (edif.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_HSNM1'
  HouseNumber : String(10) not null;
  @Common.Label : 'Apéndice'
  @Common.Heading : 'Suplemento'
  @Common.QuickInfo : 'Suplemento al número de casa'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_HSNM2'
  HouseNumberSupplementText : String(10) not null;
  @Common.Label : 'Sigla del edificio'
  @Common.Heading : 'Edificios'
  @Common.QuickInfo : 'Edificio (número o sigla)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_BLDNG'
  Building : String(20) not null;
  @Common.Label : 'Piso'
  @Common.QuickInfo : 'Planta del edificio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_FLOOR'
  Floor : String(10) not null;
  @Common.Label : 'Número de sala'
  @Common.Heading : 'Nº sala'
  @Common.QuickInfo : 'Número de un piso, un apartamento o una sala'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_ROOMNUM'
  RoomNumber : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Clave de país/región'
  @Common.Heading : 'P/R'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LAND1'
  Country : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Región'
  @Common.Heading : 'Rg'
  @Common.QuickInfo : 'Región (Estado federal, Estado federado, provincia, condado)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=REGIO'
  Region : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tratamiento'
  @Common.Heading : 'Clave'
  @Common.QuickInfo : 'Clave de tratamiento'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_TITLE'
  FormOfAddress : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Domicilio fiscal'
  @Common.Heading : 'Domicil.fiscal'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_TXJCD'
  TaxJurisdiction : String(15) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Zona de transporte'
  @Common.Heading : 'ZonaTransp'
  @Common.QuickInfo : 'Zona de transporte donde se efectúan las entregas'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LZONE'
  TransportZone : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Apartado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBX'
  POBox : String(10) not null;
  @Common.Label : 'Apartado sin nº'
  @Common.Heading : 'Ap'
  @Common.QuickInfo : 'Indicador: Datos del apartado del correos sin número'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBXNUM'
  POBoxIsWithoutNumber : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'CP apartado'
  @Common.Heading : 'Cód.postal'
  @Common.QuickInfo : 'Código postal del apartado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PSTCD2'
  POBoxPostalCode : String(10) not null;
  @Common.Label : 'Estación ap.correos'
  @Common.Heading : 'Estación de apartado de correos'
  @Common.QuickInfo : 'Estación de apartado de correos (PO Box Lobby)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_PO_BOX_LBY'
  POBoxLobbyName : String(40) not null;
  @Common.Label : 'Población apartado'
  @Common.QuickInfo : 'Población del apartado'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBXLOC'
  POBoxDeviatingCityName : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Región del apartado'
  @Common.Heading : 'Reg.apart'
  @Common.QuickInfo : 'Región del apartado (estado federal, land, provincia, etc.)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBXREG'
  POBoxDeviatingRegion : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'País/reg.apartado'
  @Common.Heading : 'P/R AC'
  @Common.QuickInfo : 'País/región de apartado de correos'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_POBXCTY'
  POBoxDeviatingCountry : String(3) not null;
  @Common.Label : 'c/o'
  @Common.Heading : 'Nombre c/o'
  @Common.QuickInfo : 'Nombre c/o'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_NAME_CO'
  CareOfName : String(40) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cl.serv.entrega'
  @Common.QuickInfo : 'Clase del servicio de entrega'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_DELIVERY_SERVICE_TYPE'
  DeliveryServiceTypeCode : String(4) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Número serv.entrega'
  @Common.Heading : 'Número del servicio de entrega'
  @Common.QuickInfo : 'Número del servicio de entrega'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_DELIVERY_SERVICE_NUMBER'
  DeliveryServiceNumber : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Huso horario'
  @Common.Heading : 'Hu.hor.'
  @Common.QuickInfo : 'Huso horario de la dirección'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_TZONE'
  AddressTimeZone : String(6) not null;
  @Common.Label : 'Correo electrónico'
  @Common.Heading : 'Dirección de correo electrónico'
  @Common.QuickInfo : 'Dirección de correo electrónico'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=AD_SMTPADR'
  EmailAddress : String(241) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'St.verif./fich.pobl.'
  @Common.Heading : 'Status'
  @Common.QuickInfo : 'Status verif.resp.fichero población'
  RegionalStructureCheckStatus : String(1) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  _PurchaseOrderItem : Association to one purchaseorder_edmx.PurchaseOrderItem {  };
};

@cds.external : true
@cds.persistence.skip : true
@Common.Label : 'Elemento de determinación de precio'
@Common.Messages : SAP__Messages
@Capabilities.SearchRestrictions.Searchable : false
@Capabilities.InsertRestrictions.Insertable : false
@Capabilities.DeleteRestrictions.Deletable : false
@Capabilities.UpdateRestrictions.NonUpdatableNavigationProperties : [ '_PurchaseOrder', '_PurchaseOrderItem' ]
@Capabilities.UpdateRestrictions.QueryOptions.SelectSupported : true
@Capabilities.FilterRestrictions.FilterExpressionRestrictions : [
  { Property: ConditionRateRatio, AllowedExpressions: 'MultiValue' },
  { Property: ConditionQuantity, AllowedExpressions: 'MultiValue' },
  { Property: CndnRoundingOffDiffAmount, AllowedExpressions: 'MultiValue' },
  { Property: ConditionAmount, AllowedExpressions: 'MultiValue' },
  {
    Property: ConditionAmountInLocalCrcy,
    AllowedExpressions: 'MultiValue'
  },
  { Property: ConditionAdjustedQuantity, AllowedExpressions: 'MultiValue' }
]
entity purchaseorder_edmx.PurOrderItemPricingElement {
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Documento compras'
  @Common.Heading : 'Doc.compr.'
  @Common.QuickInfo : 'Número del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELN'
  key PurchaseOrder : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'Pos.'
  @Common.QuickInfo : 'Número de posición del documento de compras'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=EBELP'
  key PurchaseOrderItem : String(5) not null;
  @Core.Immutable : true
  @Common.IsUpperCase : true
  @Common.Label : 'Nº condición docum.'
  @Common.Heading : 'Cond.doc.'
  @Common.QuickInfo : 'Número de la condición de documento'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KNUMV'
  key PricingDocument : String(10) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Posición'
  @Common.Heading : 'NºPos'
  @Common.QuickInfo : 'Número de posición de la condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KPOSN'
  key PricingDocumentItem : String(6) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Número nivel'
  @Common.Heading : 'Nivel'
  @Common.QuickInfo : 'Número de paso'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=STUNR'
  key PricingProcedureStep : String(3) not null;
  @Core.Immutable : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Contador'
  @Common.Heading : 'Cont'
  @Common.QuickInfo : 'Contador de condiciones'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_COND_COUNT'
  key PricingProcedureCounter : String(3) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Aplicación'
  @Common.Heading : 'Apl'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KAPPL'
  ConditionApplication : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de condición'
  @Common.Heading : 'TpCd'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KSCHA'
  ConditionType : String(4) not null;
  @Core.Computed : true
  @Common.Label : 'Fec.det.precio cond.'
  @Common.Heading : 'FeDetPrcCo'
  @Common.QuickInfo : 'Fecha de creación de precio para la condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KDATU'
  PriceConditionDeterminationDte : Date;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Tipo de cálculo'
  @Common.Heading : 'TpCál'
  @Common.QuickInfo : 'Tipo de cálculo para condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KRECH_LONG'
  ConditionCalculationType : String(3) not null;
  @Measures.ISOCurrency : TransactionCurrency
  @Common.Label : 'Importe base cond.'
  @Common.Heading : 'Importe de base de condición'
  @Common.QuickInfo : 'Importe de base de la condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_BASE_AMOUNT'
  ConditionBaseAmount : Decimal(24, 9) not null;
  @Core.Computed : true
  @Common.Label : 'Base de condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_ELEMENT_BASE_VALUE'
  ConditionBaseValue : Decimal(24, 9) not null;
  @Measures.ISOCurrency : ConditionCurrency
  @Common.Label : 'Importe de condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_RATE_AMOUNT'
  ConditionRateAmount : Decimal(24, 9) not null;
  @Measures.Unit : ConditionRateRatioUnit
  @Common.Label : 'Ratio'
  @Common.QuickInfo : 'Ratio de condición (en porcentaje o por miles)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_ELEMENT_RATIO'
  ConditionRateRatio : Decimal(24, 9) not null;
  @Common.IsUnit : true
  @Common.Label : 'Un.medida interna'
  @Common.Heading : 'UM'
  @Common.QuickInfo : 'Unidad de medida'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MSEHI'
  ConditionRateRatioUnit : String(3) not null;
  @Common.IsCurrency : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda'
  @Common.Heading : 'Mon.'
  @Common.QuickInfo : 'Clave de moneda'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WAERS'
  ConditionCurrency : String(3) not null;
  @Core.Computed : true
  @Common.Label : 'Tipo de cambio'
  @Common.Heading : 'Tp.cambio'
  @Common.QuickInfo : 'Tipo de cambio para determinación de precios'
  PriceDetnExchangeRate : Decimal(9, 5) not null;
  @Measures.Unit : ConditionQuantityUnit
  @Common.Label : 'UM de precio'
  @Common.Heading : 'por'
  @Common.QuickInfo : 'Cantidad base de la condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KPEIN'
  ConditionQuantity : Decimal(precision: 5) not null;
  @Common.IsUnit : true
  @Common.Label : 'UM de la condición'
  @Common.Heading : 'UM'
  @Common.QuickInfo : 'Unidad de medida de la condición en documento'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KVMEI'
  ConditionQuantityUnit : String(3) not null;
  @Common.Label : 'Numerador'
  @Common.QuickInfo : 'Numerador para convertir a UM base'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_NUMERATOR'
  ConditionToBaseQtyNmrtr : Decimal(precision: 10) not null;
  @Common.Label : 'Denominador'
  @Common.QuickInfo : 'Denominador conversión en UM base'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_DENOMINATOR'
  ConditionToBaseQtyDnmntr : Decimal(precision: 10) not null;
  @Core.Computed : true
  @Common.Label : 'Tipo de condición'
  @Common.Heading : 'TpCnd'
  @Common.QuickInfo : 'Tipo condición: Porte,impuesto,prec.base=Ingr.,prec.,val.'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KNTYP'
  ConditionCategory : String(1) not null;
  @Core.Computed : true
  @Common.Label : 'Estadística'
  @Common.Heading : 'Est.'
  @Common.QuickInfo : 'Condición estadística'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KSTAT'
  ConditionIsForStatistics : Boolean not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Clase de escala'
  @Common.Heading : 'E'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=STFKZ'
  PricingScaleType : String(1) not null;
  @Core.Computed : true
  @Common.Label : 'Provisión'
  @Common.Heading : 'CProv'
  @Common.QuickInfo : 'Condición relevante para la provisión (p. ej. porte)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KRUEK'
  IsRelevantForAccrual : Boolean not null;
  @Core.Computed : true
  @Common.Label : 'Cond.lista facturas'
  @Common.Heading : 'CnLFc'
  @Common.QuickInfo : 'Condición para lista de facturas'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KRELI'
  CndnIsRelevantForInvoiceList : Boolean not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Origen condición'
  @Common.Heading : 'Orig'
  @Common.QuickInfo : 'Origen de la condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KHERK'
  ConditionOrigin : String(1) not null;
  @Core.Computed : true
  @Common.Label : 'Condición colectiva'
  @Common.Heading : 'Col'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KGRPE'
  IsGroupCondition : Boolean not null;
  @Core.Computed : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Acceso'
  @Common.Heading : 'Acc.'
  @Common.QuickInfo : 'Secuencia de acceso - Acceso'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KOLNR'
  AccessNumberOfAccessSequence : String(3) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Nº reg.condición'
  @Common.Heading : 'NºRegCond'
  @Common.QuickInfo : 'Número de registro condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KNUMH'
  ConditionRecord : String(10) not null;
  @Core.Computed : true
  @Common.IsDigitSequence : true
  @Common.Label : 'Nº secuen. condición'
  @Common.Heading : 'No'
  @Common.QuickInfo : 'Número secuencial de condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KOPOS_LONG'
  ConditionSequentialNumber : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Clave de cuenta'
  @Common.Heading : 'ClCta'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KVSL1'
  AccountKeyForGLAccount : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cuenta de mayor'
  @Common.Heading : 'Cta.mayor'
  @Common.QuickInfo : 'Número de la cuenta de mayor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SAKNR'
  GLAccount : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Indicador impuestos'
  @Common.Heading : 'II'
  @Common.QuickInfo : 'Indicador IVA'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=MWSKZ'
  TaxCode : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Provisión clv.cuenta'
  @Common.Heading : 'Prov.'
  @Common.QuickInfo : 'Clave de cuenta: Provisión'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KVSL2'
  AcctKeyForAccrualsGLAccount : String(3) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cuenta provisiones'
  @Common.Heading : 'CtaProvis'
  @Common.QuickInfo : 'Nº de la cuenta de provisiones'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=SAKNR_ACCR'
  AccrualsGLAccount : String(10) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Indicador ret.'
  @Common.Heading : 'Ret'
  @Common.QuickInfo : 'Indicador de retención'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WT_WITHCD'
  WithholdingTaxCode : String(2) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Proveedor'
  @Common.QuickInfo : 'Número de cuenta de proveedor'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=LIFNR'
  FreightSupplier : String(10) not null;
  @Measures.ISOCurrency : TransactionCurrency
  @Common.Label : 'Dif.redondeo cond.'
  @Common.Heading : 'Dif-cond'
  @Common.QuickInfo : 'Diferencia de redondeo para la condición'
  CndnRoundingOffDiffAmount : Decimal(precision: 5) not null;
  @Core.Computed : true
  @Measures.ISOCurrency : TransactionCurrency
  @Common.Label : 'Valor de condición'
  @Common.QuickInfo : 'Valor de la condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_ELEMENT_VALUE'
  ConditionAmount : Decimal(precision: 15) not null;
  @Common.IsCurrency : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda del documento'
  @Common.Heading : 'Mon.'
  @Common.QuickInfo : 'Moneda de documento comercial'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=WAERK'
  TransactionCurrency : String(3) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Control de condición'
  @Common.Heading : 'Ctrl'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KSTEU'
  ConditionControl : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Condición inactiva'
  @Common.Heading : 'Inact'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KINAK'
  ConditionInactiveReason : String(1) not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Clase de condición'
  @Common.Heading : 'CtgCond'
  @Common.QuickInfo : 'Catgoría de condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KOAID'
  ConditionClass : String(1) not null;
  @Common.IsDigitSequence : true
  @Common.Label : 'Contador'
  @Common.Heading : 'Cont'
  @Common.QuickInfo : 'Contador de condición (cabecera)'
  PrcgProcedureCounterForHeader : String(3) not null;
  @Core.Computed : true
  @Common.Label : 'Factor de condición'
  @Common.Heading : 'Factor'
  @Common.QuickInfo : 'Factor p. la base de condición'
  FactorForConditionBasisValue : Double not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Condición estructura'
  @Common.Heading : 'Estruc'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KDUPL'
  StructureCondition : String(1) not null;
  @Common.Label : 'Factor de condición'
  @Common.Heading : 'Factor'
  @Common.QuickInfo : 'Factor para base de condición (periodo)'
  PeriodFactorForCndnBasisValue : Double not null;
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Base de escala'
  @Common.Heading : 'BsEsc'
  @Common.QuickInfo : 'Indicador de base de escala'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KZBZG_LONG'
  PricingScaleBasis : String(3) not null;
  @Core.Computed : true
  @Common.Label : 'Base p.escala'
  @Common.Heading : 'Base para la escala'
  @Common.QuickInfo : 'Base para la escala'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFRPC_SCALE_BASE_VALUE'
  ConditionScaleBasisValue : Decimal(24, 9) not null;
  @Common.IsUnit : true
  @Core.Computed : true
  @Common.Label : 'Unidad medida escala'
  @Common.Heading : 'UM'
  @Common.QuickInfo : 'Unidad de medida para escala de condiciones'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KONMS'
  ConditionScaleBasisUnit : String(3) not null;
  @Common.IsCurrency : true
  @Core.Computed : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda de la escala'
  @Common.Heading : 'MonEs'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KONWS'
  ConditionScaleBasisCurrency : String(3) not null;
  @Common.IsCurrency : true
  @Common.IsUpperCase : true
  @Common.Label : 'Moneda condición'
  @Common.Heading : 'MonCd'
  @Common.QuickInfo : 'Moneda de la condición (para campos de acumulación)'
  ConditionAlternativeCurrency : String(3) not null;
  @Measures.ISOCurrency : ConditionAlternativeCurrency
  @Common.Label : 'Valor de condición'
  @Common.QuickInfo : 'Valor de la condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_ELEMENT_VALUE'
  ConditionAmountInLocalCrcy : Decimal(precision: 15) not null;
  @Core.Computed : true
  @Common.Label : 'Cond.facturac.inter.'
  @Common.Heading : 'FI'
  @Common.QuickInfo : 'Condición para facturación interna'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KFKIV'
  CndnIsRelevantForIntcoBilling : Boolean not null;
  @Core.Computed : true
  @Common.Label : 'Modific.manualmente'
  @Common.Heading : 'mn.'
  @Common.QuickInfo : 'Condición modificada manualmente'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KMPRS'
  ConditionIsManuallyChanged : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Origen de precio'
  @Common.Heading : 'OrPr'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=PRSQU1'
  BillingPriceSource : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Niv.emplaz.fiscal'
  @Common.QuickInfo : 'Nivel del código de emplazamiento fiscal'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=TXJCD_LEVEL'
  TaxJurisdictionLevel : String(1) not null;
  @Common.Label : 'Ind.codif.bits'
  @Common.Heading : 'IndC'
  @Common.QuickInfo : 'Indicadores c/codificación bits en determinación precio'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KBFLAG'
  ConditionByteSequence : Binary(2) not null;
  @Core.Computed : true
  @Common.Label : 'Actualiz.cond.'
  @Common.Heading : 'AcCon'
  @Common.QuickInfo : 'Actualización de condiciones'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KOUPD'
  CndnIsRelevantForLimitValue : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Base máxima'
  @Common.Heading : 'BaMx'
  @Common.QuickInfo : 'Indicador base de la condición máxima'
  ConditionBasisLimitExceeded : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Importe máximo'
  @Common.Heading : 'VaMx'
  @Common.QuickInfo : 'Indicador valor de la condición máximo'
  ConditionAmountLimitExceeded : String(1) not null;
  @Common.Label : 'Base de condición'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VFPRC_ELEMENT_BASE_VALUE'
  CumulatedConditionBasisValue : Decimal(24, 9) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Cliente'
  @Common.QuickInfo : 'Número de cliente (Destinatario de rappel)'
  CustomerRebateRecipient : String(10) not null;
  @Core.Computed : true
  @Common.Label : 'UtilPConfigVarian'
  @Common.Heading : 'Var.'
  @Common.QuickInfo : 'Condición utilizada para la configuración de variante'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KVARC'
  ConditionIsForConfiguration : Boolean not null;
  @Common.Label : 'Clave variante'
  @Common.Heading : 'Variante'
  @Common.QuickInfo : 'Clave condición variante'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=VARCOND'
  VariantCondition : String(26) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Relevancia imputac.'
  @Common.Heading : 'RelIm'
  @Common.QuickInfo : 'Relevancia para imputación'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KTREL'
  ConditionAcctAssgmtRelevance : String(1) not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Actualización matriz'
  @Common.Heading : 'AM'
  @Common.QuickInfo : 'Indicador: Actualización de matriz'
  ConditionMatrixMaintRelevance : String(1) not null;
  @Common.Label : 'ID fórmula en docum.'
  @Common.Heading : 'ID de fórmula en documento'
  @Common.QuickInfo : 'ID de fórmula CPF en documento'
  ConfigblParametersAndFormulas : UUID;
  @Measures.Unit : ConditionQuantityUnit
  @Common.Label : 'Ctd.ajustada'
  @Common.Heading : 'Ctd.ajust.'
  @Common.QuickInfo : 'Cantidad ajustada'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KAQTY'
  ConditionAdjustedQuantity : Decimal(31, 14) not null;
  @Common.Label : 'Descripción'
  ConditionTypeName : String(30) not null;
  @Core.Computed : true
  @Common.Label : 'Unidad de condición'
  @Common.Heading : 'Un.'
  @Common.QuickInfo : 'Unidad de salida (moneda, unidad de ventas o %)'
  ConditionBaseValueIntlUnit : String(5) not null;
  @Core.Computed : true
  @Common.Label : 'Unidad de condición'
  @Common.Heading : 'Un.'
  @Common.QuickInfo : 'Unidad de salida (moneda, unidad de ventas o %)'
  ConditionBaseValueUnit : String(5) not null;
  @Core.Computed : true
  @Common.Label : 'Unidad de condición'
  @Common.Heading : 'Un.'
  @Common.QuickInfo : 'Unidad de salida (moneda, unidad de ventas o %)'
  ConditionRateValueIntlUnit : String(5) not null;
  @Core.Computed : true
  @Common.Label : 'Unidad de condición'
  @Common.Heading : 'Un.'
  @Common.QuickInfo : 'Unidad de salida (moneda, unidad de ventas o %)'
  ConditionRateValueUnit : String(5) not null;
  @Common.Label : 'Descr.ind.impuestos'
  @Common.Heading : 'Descripción de indicador de impuestos'
  @Common.QuickInfo : 'Descripción de indicador de impuestos'
  TaxCodeName : String(50) not null;
  ConditionIsDeletable : Boolean not null;
  @Common.IsUpperCase : true
  @Common.Label : 'Esquema'
  @Common.Heading : 'Esq.'
  @Common.QuickInfo : 'Esquema (determ.precio, mensajes, determ.cuentas,...)'
  @Common.DocumentationRef : 'urn:sap-com:documentation:key?=type=DE&id=KALSM_D'
  PricingProcedure : String(6) not null;
  SuperordinateDocument : String(32) not null;
  SuperordinateDocumentItem : String(70) not null;
  SAP__Messages : many purchaseorder_edmx.SAP__Message not null;
  _PurchaseOrder : Association to one purchaseorder_edmx.PurchaseOrder {  };
  _PurchaseOrderItem : Association to one purchaseorder_edmx.PurchaseOrderItem {  };
};

