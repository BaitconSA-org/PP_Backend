namespace supplierPortalGD;

using { Currency, cuid, managed , sap.common } from '@sap/cds/common';

entity Suppliers : cuid {
  name            : String(100);
  taxId           : String(30);
  email           : String(100);
  phone           : String(30);
  address         : String(200);
  country         : String(50);
  isActive        : Boolean default true;
  users           : Association to many SupplierUsers on users.supplier = $self;
  products        : Association to many Products on products.supplier = $self;
  //purchaseOrders  : Association to many PurchaseOrders on purchaseOrders.supplier = $self;
  //invoices        : Association to many Invoices on invoices.supplier = $self;
  contracts       : Association to many Contracts on contracts.supplier = $self;
  evaluations     : Association to many SupplierEvaluations on evaluations.supplier = $self;
  documents       : Association to many SupplierDocuments on documents.supplier = $self;
}

entity SupplierUsers : cuid {
  username        : String(50);
  email           : String(100);
  role            : Association to Roles;
  supplier        : Association to Suppliers;
  isActive        : Boolean default true;
}

entity Roles : cuid {
  name            : String(50);
  description     : String(100);
  permissions     : Association to many Permissions on permissions.role = $self;
}

entity Permissions : cuid {
  entity          : String(100);
  action          : String(20);               // e.g., 'READ', 'WRITE'
  role            : Association to Roles;
}

entity Products : cuid {
  name            : String(100);
  description     : String(300);
  price           : Decimal(15,2);
  currency        : Currency;
  supplier        : Association to Suppliers;
  isService       : Boolean default false;
  isActive        : Boolean default true;
}

entity Invoices : cuid, managed {
 
  documentDate                  : Date;               // Fecha de la factura
  postingDate                   : Date;               // Fecha de carga de la factura
  supplierInvoiceIDByInvcgParty : String(50);         // ID de factura PDF
  totalAmount                   : Decimal(15,2);      // Importe total de la factura
  taxIsCalculatedAutomatically  : Boolean;
  InvoiceReceiptDate            : Date;               // Fecha de recepción de la factura
  purchaseOrderID               : String(10);         // FK a PurchaseOrderExt
  supplierInvoice               : String(20);         // FK a SupplierInvoiceExt
  fiscalYear                    : String(4);          // FK a SupplierInvoiceExt
  status                        : Association to InvoiceStatus;
  workflowInstanceId            : String(100);        // ID de la instancia del workflow
  invoiceItems                  : Composition of many InvoiceItems on invoiceItems.invoice = $self; // Ítems de la factura
  invoiceTaxes                  : Composition of many InvoiceTaxes on invoiceTaxes.invoice = $self; // Impuestos de la factura
  invoiceGLAccounts             : Composition of many InvoiceGLAccounts on invoiceGLAccounts.invoice = $self; // Cuentas contables de la factura
  currency                      : String(3);          // Moneda de la factura
  typeInvoice                   : String(20);         // Tipo de factura (normal, abono, etc.)   
  // files                         : Association to many InvoiceAttachments on files.invoice = $self;
}

entity InvoiceStatus {
  key statusCode  : String(1);                 // Código del estado: B-Borrador, E-Enviada, A-Aprobada, R-Rechazada
  description     : String(100);               // Descripción del estado
  color           : String(20);
}

entity InvoiceItems : cuid {
  key invoice                 : Association to Invoices;
  key invoiceItem             : String(10);       // Identificador del ítem de la factura
  purchaseOrder               : String(20);       // FK a PurchaseOrderItemExt
  purchaseOrderItem           : String(20);       // FK a PurchaseOrderItemExt
  taxCode                     : String(10);       // Código del impuesto (ej: IVA)
  supplierInvoiceItemQuantity : Decimal(13,3);    // Cantidad del ítem de
  supplierInvoiceItemAmmount  : Decimal(15,2);    // Importe del ítem de la factura
  inventoryValuationType      : String(20);       // Tipo de valoración de inventario (ej: FIFO, LIFO)
  taxAmount                   : Decimal(15,2);    // Importe del impuesto aplicado
  taxBaseAmountInTransCrcy    : Decimal(15,2);    // Base imponible del impuesto en la moneda de transacción
  taxCountry                  : String(3);        // País del impuesto (ej: ARG)
}
entity InvoiceGLAccounts : cuid {
  invoice                     : Association to Invoices;
  supplierInvoiceItem         : String(10);        // "0001"
  companyCode                 : String(10);        // "10AA"
  costCenter                  : String(20);        // "10AA002"
  controllingArea             : String(10);        // "A000"
  profitCenter                : String(20);        // "YB600"
  functionalArea              : String(20);        // "YB75"
  glAccount                   : String(20);        // "71000000"
  documentCurrency            : String(3);         // "ARS"
  supplierInvoiceItemAmount   : Decimal(15,2);     // 3200.00
  taxCode                     : String(10);        // "C0"
  debitCreditCode             : String(1);         // "S"
  supplierInvoiceItemText     : String(500);       // "item sin oc"
  isNotCashDiscountLiable     : Boolean;           // false
  quantity                   : Decimal(13,3);     // 1
  subtotal                   : Decimal(15,2);     // 693015.00
  unitOfMeasure               : String(3);         // "KG"
  unitPrice                 : Decimal(15,5);     // 69301.5
}

entity InvoiceTaxes : cuid {
  invoice                     : Association to Invoices;
  taxCode                     : String(10);        // Código del impuesto (ej: IVA)
  taxAmount                   : Decimal(15,2);     // Importe del impuesto aplicado
  taxBaseAmountInTransCrcy    : Decimal(15,2);     // Base imponible del impuesto en la moneda de transacción
  taxCountry                  : String(3);         // País del impuesto (ej: ARG)
}

entity InvoiceAttachments : cuid {
  invoice       : Association to Invoices;         // Cabecera de la factura
  supplier      : Association to Suppliers;        // CUIT proveedor (validación contra usuario)
  //SpurchaseOrder : Association to PurchaseOrders;   // OC origen para sociedad, etc.
  companyCode   : Association to CompanyCode;     // Derivado de OC

  fileName      : String(255);                     // Nombre del archivo
  mimeType      : String(100);                     // Tipo MIME (application/pdf)
  url           : String(500);                     // Ruta al archivo en repositorio (S3, BTP Storage, etc.)

  uploadedAt    : Timestamp @readonly;             // Fecha de carga automática
  uploadedBy    : String @readonly;                // Usuario autenticado que realizó la carga

  invoiceDate   : Date @readonly;                  // Fecha de ingreso (fecha actual)
  invoiceNumber : String(20);                      // Código de factura (ej: 0001A00000001)

  currency      : String(3);                       // Moneda (extraída o ingresada)
  netAmount     : Decimal(15,2);                   // Importe sin impuestos (validado contra OC)
  totalAmount   : Decimal(15,2);                   // Importe total (campo informativo)
  quantity      : Decimal(13,3);                   // Unidades facturadas (validación contra OC)
  caeNumber     : String(14);                      // Número de CAE (obligatorio)
  caeDate       : Date;                            // Fecha de CAE

  invoiceLetter : String(1);                       // Letra del comprobante (validar A, C, M, X)

  extractionStatus : String(50);                   // Estado de procesamiento del DOX (OK, ERROR, etc.)
  extractionMessage: String(500);                  // Mensaje del DOX si hubo error
  extractionJobId  : String(50);                   // Job ID de DOX (trazabilidad)

  items : Composition of many InvoiceAttachmentItems
    on items.parent = $self;                       // Ítems extraídos de la factura (coincidencias con OC)
}

entity InvoiceAttachmentItems : cuid {
  parent        : Association to InvoiceAttachments;
  poItem        : String(5);                       // Ítem de la OC a la que coincide
  description   : String(255);                     // Descripción del ítem facturado
  quantity      : Decimal(13,3);                   // Cantidad facturada (validar contra pendiente)
  unitPrice     : Decimal(15,5);                   // Precio unitario extraído
  netAmount     : Decimal(15,2);                   // Subtotal sin impuestos
  vatAmount     : Decimal(15,2);                   // IVA extraído si lo hubiera
  matchedStatus : String(20);                      // Estado de emparejamiento con OC (match, warning, error)
}

entity Contracts : cuid {
  supplier        : Association to Suppliers;
  contractNumber  : String(50);
  startDate       : Date;
  endDate         : Date;
  terms           : String(1000);
  fileUrl         : String(500);
  status          : String(30);
}

entity SupplierEvaluations : cuid {
  supplier        : Association to Suppliers;
  date            : Date;
  rating          : Integer; // 1-10
  comments        : String(500);
  evaluator       : String(100);
}

entity SupplierDocuments : cuid {
  supplier        : Association to Suppliers;
  documentType    : String(50);
  description     : String(200);
  fileUrl         : String(500);
  uploadedAt      : Timestamp;
}

entity Notifications : cuid {
  user            : Association to SupplierUsers;
  message         : String(300);
  read            : Boolean default false;
  createdAt       : Timestamp;
}

entity TaxCodes {
  key code        : String(3);
      porcentege  : Decimal(5,2);
}

entity TaxCodesFooter {
  key code        : String(3);
      porcentege  : Decimal(5,2);
      description : String(500);
}
@readonly
entity InvoiceReport {
  key year          : Integer;
  key month         : Integer;
  totalInvoices     : Integer;
}

entity CostCenters {
  key costCenter   : String(20);
      description  : String(100);
}

entity DocumentTypes {
  key documentType : String(2);
      description  : String(100);
}

entity PaymentTerms{
  key paymentTerms  : String(4);
      description   : String(100);
}

entity GlobalLedgerAccounts{
  key GLAccount     : String(10);
      description   : String(100);
}

entity CompanyCode{
  key CompanyCode   : String(4);
      description   : String(100);
}
/*
entity PaymentOrders : cuid, managed {
  supplierID         : String(20);

  paymentAdvice      : String(30);
  companyCode        : String(4);
  paymentDate        : Date;
  paymentDocument   : String(100);
  paymentFiscalYear  : String(100);
  amount             : Decimal(15,2);
  currency           : String(3);
  status             : String(20);

  
     // Output Management
  applObjectType : String(30) default 'FFO_PAYM_LIST';
  applObjectId   : String(255);          // este es el dato “clave” para el PDF

  virtual pdfUrl  : String(500);
  virtual pdfText : String(10);

  lastSeenAt         : Timestamp;

  refs : Composition of many PaymentOrderRefs
    on refs.parent = $self;
}
entity PaymentOrderRefs : cuid, managed {
  parent : Association to PaymentOrders;

  companyCode             : String(4);    // recomendado
  fiscalYear              : String(4);
  accountingDocument      : String(10);
  accountingDocumentItem  : String(3);    // opcional, pero mejor acotar
}
*/
  entity PrecertItemCandidate @readonly {
    key sourceType       : String(10);   // "SPOT" "CONTRATO MARCO"
    key sourceId         : String(20);   // OC
    key itemId           : String(10);   // Posición OC
    key lineId           : String(20);   // NUEVO: sub-línea / renglón dentro de la posición

    // No editables para proveedor
    service             : String(80);
    subService          : String(80);
    status              : String(30);    // "Pendiente" (o derivado)

    // Editables por proveedor
    qtyToCertify         : Decimal(13,3);
    placeOfService       : String(20);
    dateFrom             : Date;
    dateTo               : Date;

    // Para validar
    availableQty         : Decimal(13,3);
    uom                  : String(3);

    
    orderedQty           : Decimal(13,3);
    invoicedQty          : Decimal(13,3);
    material             : String(60);
    description          : String(255);

   @readonly currency     : String(3);
   @readonly unitPrice    : Decimal(15,6);  // más precisión
  @readonly lineAmount   : Decimal(15,2);  // qtyToCertify * unitPrice (redondeado)
  }

  /** -----------------------------
   *  Ticket (persistente)
   *  ----------------------------- */
  entity PrecertTickets : cuid, managed {
    ticketNumero     : Integer @readonly;
    sourceType    : String(10);         // "PO" | "CM" | "NONE"
    sourceId      : String(20);         // nro OC o CM o vacío
    supplierID    : String(20);
    status        : String(30);         // CREADO / ENVIADO / APROBADO / RECHAZADO
    currency      : String(3);
    totalAmount   : Decimal(15,2);
    items         : Composition of many PrecertTicketItems
                    on items.ticket = $self;
    nodeType      : String(10);   // "TK" | "SUB"
    subTicketNo   : Integer;

    parentTicket  : Association to PrecertTickets;
    subTickets    : Composition of many PrecertTickets
                    on subTickets.parentTicket = $self;

    provincia : Association to Provincias;
                    

  }

  entity PrecertTicketItems : cuid, managed {
  ticket : Association to PrecertTickets;

  // Identificación del item en la OC
  itemId : String(10);      // PurchaseOrderItem
  lineId : String(20);      // Lineas dentro de la pos 

  @readonly service    : String(80);
  @readonly subService : String(80);
   status     : String(30);

  splitFrom : Association to PrecertTicketItems; 
  splitNo   : Integer;                           

  // editables
  qtyToCertify   : Decimal(13,3);
  placeOfService : String(20);
  dateFrom       : Date;
  dateTo         : Date;

  availableQty   : Decimal(13,3);
  uom            : String(3);
  

  // imputación
  AccountAssignmentNumber : String(2);
  GLAccount               : String(10);
  CostCenter              : String(10);
  ProjectNetwork          : String(12); // grafo/network
  OrderID                 : String(12); // orden
}

entity PrecertTicketSplitLog : cuid, managed {
  ticket_ID      : UUID;
  subTicketNo    : Integer;         // 0..N por ticket
  subTicket_ID   : UUID;
  splitFromItem  : UUID;            // item original
  newItem        : UUID;            // item nuevo creado
  changedBy      : String(255);
  snapshotJson   : LargeString;     // JSON para debug
}

entity Provincias : iDDescription {
  
}


entity iDDescription: managed {
key ID: String;
description: String;
}