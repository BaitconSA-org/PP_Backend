using supplierPortalGD from '../db/schema';
using { purchaseorder_edmx as external } from './external/purchaseorder.edmx';

@path: 'ppservices'
service SupplierPortalService {
  entity Suppliers as projection on supplierPortalGD.Suppliers;

  entity SupplierUsers as projection on supplierPortalGD.SupplierUsers;

  entity Roles as projection on supplierPortalGD.Roles;
  entity Permissions as projection on supplierPortalGD.Permissions;

  entity Products as projection on supplierPortalGD.Products;

  entity PurchaseOrders as projection on supplierPortalGD.PurchaseOrders;

  entity PurchaseOrderItems as projection on supplierPortalGD.PurchaseOrderItems;

  entity Invoices as projection on supplierPortalGD.Invoices;

  entity InvoiceAttachments as projection on supplierPortalGD.InvoiceAttachments;

  entity Contracts as projection on supplierPortalGD.Contracts;

  entity SupplierEvaluations as projection on supplierPortalGD.SupplierEvaluations;

  entity SupplierDocuments as projection on supplierPortalGD.SupplierDocuments;
  
  entity Notifications as projection on supplierPortalGD.Notifications;

  entity POOrders as projection on external.PurchaseOrder;

}