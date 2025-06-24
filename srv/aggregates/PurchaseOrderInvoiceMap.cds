using { A_SupplierInvoice_edmx as inv } from '../external/A_SupplierInvoice/A_SupplierInvoice_edmx.csn';

view PurchaseOrderInvoiceMap as select from inv.A_SuplrInvcItemPurOrdRef {
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierInvoice,
  SupplierInvoiceItem,
  FiscalYear,
  ReferenceDocument,
  ReferenceDocumentItem,
  DocumentCurrency,
  QuantityInPurchaseOrderUnit,
  SupplierInvoiceItemAmount
}
group by
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierInvoice,
  SupplierInvoiceItem,
  ReferenceDocument,
  ReferenceDocumentItem,
  FiscalYear,
  DocumentCurrency,
  QuantityInPurchaseOrderUnit,
  SupplierInvoiceItemAmount;
