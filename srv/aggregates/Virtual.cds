using { SupplierPortalService as srv } from '../SupplierPortalService';

// Total por orden de compra
view PurchaseOrderNetAmount as select from srv.PurchaseOrderItemExt {
  key PurchaseOrder,
  sum(NetAmount) as NetAmount : Decimal(15,2)
}
group by PurchaseOrder;

// Total facturado por orden
view PurchaseOrderSupplierInvoiceAmount as select from srv.SupplierInvoiceItemExt {
  key PurchaseOrder,
  sum(SupplierInvoiceItemAmount) as SupplierInvoiceAmount : Decimal(15,2)
}
group by PurchaseOrder;

// Total facturado por orden y posición
view PurchaseOrderItemSupplierInvoiceAmount as select from srv.SupplierInvoiceItemExt {
  key PurchaseOrder,
  PurchaseOrderItem,
  sum(SupplierInvoiceItemAmount) as SupplierInvoiceItemAmount : Decimal(15,2)
}
group by PurchaseOrder, PurchaseOrderItem;
