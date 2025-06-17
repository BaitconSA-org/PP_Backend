using supplierPortalGD from '../db/schema';

// Órdenes de compra
using { purchaseorder_edmx as ext } from './external/purchaseorder_edmx.csn';
// Facturación Proveedor
using { A_SupplierInvoice_edmx as inv } from './external/A_SupplierInvoice/A_SupplierInvoice_edmx.csn';

// View agregados con totales
using {
  PurchaseOrderNetAmount      as VirtualPONet,
  PurchaseOrderSupplierInvoiceAmount as VirtualSuppInv,
  PurchaseOrderItemSupplierInvoiceAmount as VirtualItemSuppInv
} from './aggregates/Virtual';



@path : 'ppservices'
service SupplierPortalService
{
    annotate PurchaseOrderExt with @restrict :
    [
        { grant : [ '*' ], to : [ 'Supplier' ] },
        { grant : [ '*' ], to : [ 'authenticated-user' ] }
    ];

    annotate SupplierInvoiceExt with @restrict : 
    [
        { grant : [ '*' ], to : [ 'Supplier' ] },
        { grant : [ '*' ], to : [ 'authenticated-user' ] }
    ];

    annotate PurchaseOrderNetAmount with @restrict : [
    { grant: ['READ'], to: ['Supplier'] },
    { grant: ['READ'], to: ['authenticated-user'] }
    ];

    annotate PurchaseOrderSupplierInvoiceAmount with @restrict : [
        { grant: ['READ'], to: ['Supplier'] },
        { grant: ['READ'], to: ['authenticated-user'] }
    ];

    annotate PurchaseOrderItemSupplierInvoiceAmount with @restrict : [
        { grant: ['READ'], to: ['Supplier'] },
        { grant: ['READ'], to: ['authenticated-user'] }
    ];



    entity Suppliers as
        projection on supplierPortalGD.Suppliers;

    entity SupplierUsers as
        projection on supplierPortalGD.SupplierUsers;

    entity Roles as
        projection on supplierPortalGD.Roles;

    entity Permissions as
        projection on supplierPortalGD.Permissions;

    entity Products as
        projection on supplierPortalGD.Products;

    entity PurchaseOrders as
        projection on supplierPortalGD.PurchaseOrders;

    entity PurchaseOrderItems as
        projection on supplierPortalGD.PurchaseOrderItems;

    entity Invoices as
        projection on supplierPortalGD.Invoices;

    entity InvoiceAttachments as
        projection on supplierPortalGD.InvoiceAttachments;

    entity Contracts as
        projection on supplierPortalGD.Contracts;

    entity SupplierEvaluations as
        projection on supplierPortalGD.SupplierEvaluations;

    entity SupplierDocuments as
        projection on supplierPortalGD.SupplierDocuments;

    entity Notifications as
        projection on supplierPortalGD.Notifications;

    @readonly
    entity PurchaseOrderExt as
        projection on ext.PurchaseOrder
        {
            key PurchaseOrder,
            *,
            _SupplierAddress,
        };

    @readonly
    @cds.redirection.target : true
    entity PurchaseOrderItemExt as
        projection on ext.PurchaseOrderItem;
        

    entity PurchaseOrderSupplierAddress as projection on ext.PurchaseOrderSupplierAddress;

    @readonly
    entity SupplierInvoiceExt as
        projection on inv.A_SupplierInvoice {
            key SupplierInvoice,
            key FiscalYear,
            *,
            _InvoiceItem: Association to many SupplierInvoiceItemExt
                on _InvoiceItem.SupplierInvoice = SupplierInvoice
                and _InvoiceItem.FiscalYear = FiscalYear
        };

    @readonly
    @cds.redirection.target : true
    entity SupplierInvoiceItemExt as projection on inv.A_SuplrInvcItemPurOrdRef;


    // Exponiendo vistas Virtuales
    @readonly
    entity PurchaseOrderNetAmount as projection on VirtualPONet{
        key PurchaseOrder,
        NetAmount
    };

    @readonly
    entity PurchaseOrderSupplierInvoiceAmount as projection on VirtualSuppInv;

    @readonly
    entity PurchaseOrderItemSupplierInvoiceAmount as projection on VirtualItemSuppInv;


}

annotate SupplierPortalService with @requires :
[
    'Supplier'
];
