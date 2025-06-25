using { A_SupplierInvoice_edmx as suppInv } from '../../external/A_SupplierInvoice/A_SupplierInvoice_edmx';

@cds.persistence.skip
@readonly
entity PurchaseOrderSupplierInvoices as select from suppInv.A_SuplrInvcItemPurOrdRef {
  PurchaseOrder,
  SupplierInvoice,
  FiscalYear,
  sum(SupplierInvoiceItemAmount)  as TotalAmount,
  max(RetentionDueDate)                as InvoiceDate
}
group by PurchaseOrder, SupplierInvoice, FiscalYear;