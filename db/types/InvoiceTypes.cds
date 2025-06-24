namespace supplierPortalGD.types;

type InvoiceEntry {
  SupplierInvoice             : String;
  SupplierInvoiceItem         : String;
  DocumentCurrency            : String;
  SupplierInvoiceItemAmount   : Decimal(15,2);
}
