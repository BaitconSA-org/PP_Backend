using { A_SupplierInvoice_edmx as suppInv } from '../../external/A_SupplierInvoice/A_SupplierInvoice_edmx';

@cds.persistence.skip
@readonly
entity PurchaseOrderSupplierInvoices as select from suppInv.A_SuplrInvcItemPurOrdRef {
  PurchaseOrder,
  SupplierInvoice,
  FiscalYear,
  sum(SupplierInvoiceItemAmount)  as TotalAmount : Decimal(15,2),
  max(RetentionDueDate)           as InvoiceDate : Date
}
group by PurchaseOrder, SupplierInvoice, FiscalYear;