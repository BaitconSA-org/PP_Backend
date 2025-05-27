using supplierPortalGD from '../db/schema';
using { purchaseorder_edmx as ext } from './external/purchaseorder_edmx.csn';

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

  @cds.persistence.skip
  @readonly
  entity PurchaseOrderExt as projection on ext.PurchaseOrder {
    key PurchaseOrder,
    *                   
  };

  // ✅ Proyección de los ítems de la orden de compra
  @cds.persistence.skip
  @readonly
  entity PurchaseOrderItemExt as projection on ext.PurchaseOrderItem;

}