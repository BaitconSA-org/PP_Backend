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
  invoice: Association to Invoices;
  fileName: String(255);
  mimeType: String(100);
  url: String(500);
  uploadedAt: Timestamp;
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