namespace supplierPortalGD;

using { Currency, cuid, sap.common } from '@sap/cds/common';

entity Suppliers : cuid {
  name: String(100);
  taxId: String(30);
  email: String(100);
  phone: String(30);
  address: String(200);
  country: String(50);
  isActive: Boolean default true;
  users: Association to many SupplierUsers on users.supplier = $self;
  products: Association to many Products on products.supplier = $self;
  purchaseOrders: Association to many PurchaseOrders on purchaseOrders.supplier = $self;
  invoices: Association to many Invoices on invoices.supplier = $self;
  contracts: Association to many Contracts on contracts.supplier = $self;
  evaluations: Association to many SupplierEvaluations on evaluations.supplier = $self;
  documents: Association to many SupplierDocuments on documents.supplier = $self;
}

entity SupplierUsers : cuid {
  username: String(50);
  email: String(100);
  role: Association to Roles;
  supplier: Association to Suppliers;
  isActive: Boolean default true;
}

entity Roles : cuid {
  name: String(50);
  description: String(100);
  permissions: Association to many Permissions on permissions.role = $self;
}

entity Permissions : cuid {
  entity: String(100);
  action: String(20); // e.g., 'READ', 'WRITE'
  role: Association to Roles;
}

entity Products : cuid {
  name: String(100);
  description: String(300);
  price: Decimal(15,2);
  currency: Currency;
  supplier: Association to Suppliers;
  isService: Boolean default false;
  isActive: Boolean default true;
}

entity PurchaseOrders : cuid {
  orderNumber: String(50);
  supplier: Association to Suppliers;
  orderDate: Date;
  status: String(20);
  items: Composition of many PurchaseOrderItems on items.parent = $self;
  totalAmount: Decimal(15,2);
  currency: Currency;
}

entity PurchaseOrderItems : cuid {
  parent: Association to PurchaseOrders;
  product: Association to Products;
  quantity: Integer;
  unitPrice: Decimal(15,2);
}

entity Invoices : cuid {
  invoiceNumber: String(50);
  supplier: Association to Suppliers;
  purchaseOrder: Association to PurchaseOrders;
  invoiceDate: Date;
  dueDate: Date;
  status: String(20);
  totalAmount: Decimal(15,2);
  currency: Currency;
  files: Association to many InvoiceAttachments on files.invoice = $self;
}

entity InvoiceAttachments : cuid {
  invoice       : Association to Invoices;               // Cabecera de la factura
  supplier      : Association to Suppliers;              // CUIT proveedor (validación contra usuario)
  purchaseOrder : Association to PurchaseOrders;         // OC origen para sociedad, etc.
  companyCode   : Association to CompanyCodes;           // Derivado de OC

  fileName      : String(255);                           // Nombre del archivo
  mimeType      : String(100);                           // Tipo MIME (application/pdf)
  url           : String(500);                           // Ruta al archivo en repositorio (S3, BTP Storage, etc.)

  uploadedAt    : Timestamp @readonly;                   // Fecha de carga automática
  uploadedBy    : String @readonly;                      // Usuario autenticado que realizó la carga

  invoiceDate   : Date @readonly;                        // Fecha de ingreso (fecha actual)
  invoiceNumber : String(20);                            // Código de factura (ej: 0001A00000001)

  currency      : String(3);                             // Moneda (extraída o ingresada)
  netAmount     : Decimal(15,2);                         // Importe sin impuestos (validado contra OC)
  totalAmount   : Decimal(15,2);                         // Importe total (campo informativo)
  quantity      : Decimal(13,3);                         // Unidades facturadas (validación contra OC)
  caeNumber     : String(14);                            // Número de CAE (obligatorio)
  caeDate       : Date;                                  // Fecha de CAE

  invoiceLetter : String(1);                             // Letra del comprobante (validar A, C, M, X)

  extractionStatus : String(50);                         // Estado de procesamiento del DOX (OK, ERROR, etc.)
  extractionMessage: String(500);                        // Mensaje del DOX si hubo error
  extractionJobId  : String(50);                         // Job ID de DOX (trazabilidad)

  items : Composition of many InvoiceAttachmentItems
    on items.parent = $self;                             // Ítems extraídos de la factura (coincidencias con OC)
}

entity InvoiceAttachmentItems : cuid {
  parent        : Association to InvoiceAttachments;
  poItem        : String(5);                             // Ítem de la OC a la que coincide
  description   : String(255);                           // Descripción del ítem facturado
  quantity      : Decimal(13,3);                         // Cantidad facturada (validar contra pendiente)
  unitPrice     : Decimal(15,5);                         // Precio unitario extraído
  netAmount     : Decimal(15,2);                         // Subtotal sin impuestos
  vatAmount     : Decimal(15,2);                         // IVA extraído si lo hubiera
  matchedStatus : String(20);                            // Estado de emparejamiento con OC (match, warning, error)
}

entity CompanyCodes {
  key CompanyCode : String(4);
      Name        : String(100);
      Country     : String(3);
}


entity Contracts : cuid {
  supplier: Association to Suppliers;
  contractNumber: String(50);
  startDate: Date;
  endDate: Date;
  terms: String(1000);
  fileUrl: String(500);
  status: String(30);
}

entity SupplierEvaluations : cuid {
  supplier: Association to Suppliers;
  date: Date;
  rating: Integer; // 1-10
  comments: String(500);
  evaluator: String(100);
}

entity SupplierDocuments : cuid {
  supplier: Association to Suppliers;
  documentType: String(50);
  description: String(200);
  fileUrl: String(500);
  uploadedAt: Timestamp;
}

entity Notifications : cuid {
  user: Association to SupplierUsers;
  message: String(300);
  read: Boolean default false;
  createdAt: Timestamp;
}

