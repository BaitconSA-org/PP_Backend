using {suppliersInitiative as db} from '../db/vista-schema';
using {OP_API_PURCHASEORDER_PROCESS_SRV_0001 as poApi} from './external/OP_API_PURCHASEORDER_PROCESS_SRV_0001.cds';
using {OP_API_PURCHASECONTRACT_PROCESS_SRV_0002 as A_PurchaseContract} from './external/OP_API_PURCHASECONTRACT_PROCESS_SRV_0002';

service HESManagementService @(path: '/srv/hes') {

    type WorkflowResponse {
        status               : String;
        instanceId           : String;
        workflowDefinitionId : String;
    }

    // ─── Purchase Contract ────────────────────────────────────────
    entity PurchaseContractExt     as
        projection on A_PurchaseContract.A_PurchaseContract {
            *,
            null as SupplierName : String
        };

    @cds.redirection.target: true
    entity PurchaseContractItemExt as projection on A_PurchaseContract.A_PurchaseContractItem;

    // ─── Purchase Order ───────────────────────────────────────────
    @cds.redirection.target
    @readonly
    @Search.searchable
    entity PurchaseOrderExt        as
        select from poApi.A_PurchaseOrder as po {
            key po.PurchaseOrder,
                po.PurchaseOrderType,
                po.PurchaseOrderSubtype,
                po.PurchasingDocumentOrigin,
                po.CreatedByUser,
                po.CreationDate,
                po.PurchaseOrderDate,
                po.LastChangeDateTime,
                po.ValidityStartDate,
                po.ValidityEndDate,
                po.Language,
                po.PurchasingDocumentDeletionCode,
                po.ReleaseIsNotCompleted,
                po.PurchasingCompletenessStatus,
                po.PurchasingProcessingStatus,
                po.CompanyCode,
                po.PurchasingOrganization,
                po.PurchasingGroup,
                po.Supplier,
                po.ManualSupplierAddressID,
                po.SupplierRespSalesPersonName,
                po.SupplierPhoneNumber,
                po.SupplyingSupplier,
                po.SupplyingPlant,
                po.InvoicingParty,
                po.SupplierQuotationExternalID,
                po.PaymentTerms,
                po.CashDiscount1Days,
                po.CashDiscount2Days,
                po.NetPaymentDays,
                po.CashDiscount1Percent,
                po.CashDiscount2Percent,
                po.IncotermsClassification,
                po.IncotermsVersion,
                po.IncotermsLocation1,
                po.IncotermsLocation2,
                po.CorrespncExternalReference,
                po.CorrespncInternalReference,
                po.DocumentCurrency,
                po.ExchangeRate,
                po.ExchangeRateIsFixed,
                po.PurgAggrgdProdCmplncSuplrSts,
                po.PurgAggrgdProdMarketabilitySts,
                po.PurgAggrgdSftyDataSheetStatus,
                po.PurgProdCmplncTotDngrsGoodsSts,
                po.PurchasingCollectiveNumber,
                po.AddressName,

                @cds.persistence.skip
                cast(
                    null as Decimal(15, 2)
                ) as NetAmountTotal : Decimal(15, 2),

                @cds.persistence.skip
                cast(
                    null as Decimal(15, 2)
                ) as UnitPrice      : Decimal(15, 2),

                @cds.persistence.skip
                cast(
                    null as String
                ) as SupplierName   : String,

                _PurchaseOrderItem  : Composition of many PurchaseOrderItemExt
                                          on _PurchaseOrderItem.PurchaseOrder = PurchaseOrder
        }

    // ─── Purchase Order Item ──────────────────────────────────────
    @readonly
    @cds.redirection.target: true
    entity PurchaseOrderItemExt    as
        select from poApi.A_PurchaseOrderItem as item {
            key item.PurchaseOrder,
            key item.PurchaseOrderItem,
                item.PurchaseOrderItemText,
                item.Material,
                item.ProductType,
                item.Plant,
                item.StorageLocation,
                item.OrderQuantity,
                item.PurchaseOrderQuantityUnit,
                item.NetPriceAmount,
                item.NetPriceQuantity,
                item.DocumentCurrency,
                item.TaxCode,
                item.IncotermsClassification,
                item.IncotermsTransferLocation,
                item.IncotermsLocation1,
                item.IncotermsLocation2,
                item.DownPaymentType,
                item.DownPaymentPercentageOfTotAmt,
                item.DownPaymentAmount,
                item.DownPaymentDueDate,

                @cds.persistence.skip
                cast(
                    null as Decimal(15, 2)
                ) as UnitPrice : Decimal(15, 2)
        }

    // ─── Tipos ────────────────────────────────────────────────────
    type SubmitPrecertLine : {
        itemId     : String(10);
        qty        : Decimal(15, 3);
        unitPrice  : Decimal(15, 2);
        lineAmount : Decimal(15, 2);
    };

    type PCExcelHeader {
        ShortText            : String;
        text_workflow_solped : String;
        ZCRIT                : String;
    }


    type PCExcelLine {
        po_item        : String;
        short_text     : String;
        qty_to_certify : String;
        province_name  : String;
        date_from      : String;
        date_to        : String;
        delivery_date  : String;
        status         : String;
        can_edit       : Boolean;
        EKGRP          : String;
        WERKS          : String;
        KNTTP          : String(2);
        KOSTL          : String(15);
        NPLNR          : String(12);
        ACTIVITY       : String(12);
        AUFNR          : String(12);
        PSPNR          : String(50);
    }

    type PCExcelPositionGroup {
        po_item : String;
        service : String;
        ZCRIT   : String;
    }

    action   downloadPurchaseContractExcel(header: PCExcelHeader,
                                           lines: many PCExcelLine,
                                           positionGroups: many PCExcelPositionGroup,
                                           purchGroups: many MAWizardCatalogItem,
                                           plants: many MAWizardCatalogItem)          returns String;

    type SubTicketExcelRow {
        purchase_order_item   : String;
        qty_to_certify        : Decimal;
        province_name         : String;
        date_from             : String;
        date_to               : String;
        service               : String;
        subService            : String;
        global_ledger_account : String;
        cost_center           : String;
        order                 : String;
        grafo                 : String;
        status                : String;
        observations          : String;
    }

    type SubmitPrecertResult {
        ticketId     : UUID;
        ticketNumero : Integer;
        status       : String(30);
        currency     : String(3);
        totalAmount  : Decimal(15, 2);
        lines        : array of SubmitPrecertLine;
    }

    type AccountAssignment {
        PurchaseOrder           : String;
        PurchaseOrderItem       : String;
        AccountAssignmentNumber : String;
        GLAccount               : String;
        CostCenter              : String;
        ProjectNetwork          : String;
        OrderID                 : String;
    };

    type PrecertItem       : {
        qty_to_certify            : Decimal(15, 3);
        unit_price                : Decimal(15, 2);
        measure_unity             : String;
        purchasing_org            : String(4);
        province_ID               : String(100);
        date_from                 : Date;
        date_to                   : Date;
        account_assignment_number : String(2);
        project_network           : String(12);
        order                     : String(12);
        cost_center               : String(15);
        global_ledger_account     : String(20);
        po_item                   : Integer;
        ses_service               : String(200);
        ses_subservice            : String(300);
        ses_short_text            : String(40);
        co_area                   : String(4);
        profit_center             : String(10);
        po_item_text              : String(100);
        wbs_element               : String(50);
        observations              : String(150);
        subservice_position       : String(10);
        purchasing_group          : String(10);
        validator                 : String(250);
    };

    type PrecertExcelRow {
        OC                  : String;
        Posicion            : String;
        CantidadACertificar : Decimal;
        CantidadDisponible  : Decimal;
        Desde               : String;
        Hasta               : String;
        Servicio            : String;
        SubServicio         : String;
        province_name       : String;
        Status              : String;
        observations        : String;
    }

    type PurchaseOrderItemService {
        PONumber        : String;
        POItemNumber    : String;
        IntRow          : String;
        ExtRow          : String;
        ActivityNumber  : String;
        Quantity        : Decimal;
        BaseUOM         : String;
        PriceUnit       : String;
        GrossPrice      : Decimal;
        NetValue        : Decimal;
        ShortText       : String;
        DeleteIndicator : String;
    };

    type PurchaseContractAccountAssignment {
        PurchaseContract        : String;
        PurchaseContractItem    : String;
        AccountAssignmentNumber : String;
        GLAccount               : String;
        CostCenter              : String;
        ProjectNetwork          : String;
        OrderID                 : String;
    };

    type ApprovalManualHeader {
        TXZ01                : String;
        BSART                : String;
        ShortText            : String;
        text_workflow_solped : String;
        ZCRIT                : String;
    }

    type ApprovalManualHes {
        date_from : String;
        date_to   : String;
        hesText   : String;
    }

    type ApprovalManualLine {
        subticket_id  : String;
        EXTROW        : String;
        pr_item       : String; // ← NUEVO: PRItem auto-generado del wizard PC
        SRVPOS        : String;
        KTEXT1        : String;
        MENGE         : String;
        PREIS         : String;
        MEINS         : String(3);
        PEINH         : String;
        WAERS         : String;
        KNTTP         : String(2);
        currentStatus : String;
        validator     : String;
        KOSTL         : String(15);
        NPLNR         : String(12);
        ACTIVITY      : String(12);
        AUFNR         : String(12);
        PSPNR         : String(50);
    }

    type MAWizardLineFlat {
        SRVPOS        : String;
        KTEXT1        : String;
        MENGE         : String;
        PREIS         : String;
        MEINS         : String(3);
        WAERS         : String;
        EKGRP         : String;
        WERKS         : String;
        MATKL         : String;
        KNTTP         : String;
        KOSTL         : String;
        NPLNR         : String;
        ACTIVITY      : String(12);
        AUFNR         : String;
        PSPNR         : String;
        delivery_date : String;
    }

    type ApprovalManualPositionGroup {
        po_item              : String;
        po_item_original     : String;
        ShortText            : String;
        text_workflow_solped : String;
        EKGRP                : String;
        WERKS                : String;
        MATKL                : String;
        EKORG                : String;
        ZCRIT                : String;
        KNTTP                : String;
        KOSTL                : String(15);
        NPLNR                : String(12);
        ACTIVITY             : String(12);
        AUFNR                : String(12);
        PSPNR                : String(50);
        delivery_date        : String;
    }

    type MAWizardCatalogItem {
        ID          : String;
        description : String;
    }

    type MAWizardLine {
        SRVPOS : String;
        KTEXT1 : String;
        MENGE  : String;
    }

    type MAWizardPositionGroup {
        po_item              : String;
        ShortText            : String;
        text_workflow_solped : String;
        EKGRP                : String;
        WERKS                : String;
        MATKL                : String;
        EKORG                : String;
        ZCRIT                : String;
        KNTTP                : String;
        NPLNR                : String;
        ACTIVITY             : String(12);
        KOSTL                : String;
        AUFNR                : String;
        PSPNR                : String;
        delivery_date        : String;
        lines                : array of MAWizardLine;
    }

    // ─── tipo de retorno del nuevo get ───────────────────────────
    type POAccountAssignmentItem {
        AccountAssignmentNumber : String;
        GLAccount               : String;
        CostCenter              : String;
        ProjectNetwork          : String;
        OrderID                 : String;
        WBSElementExternalID    : String;
        ProfitCenter            : String;
    }

    type POScheduleLine {
        ScheduleLine              : String;
        ScheduleLineDeliveryDate  : Date;
        ScheduleLineOrderQuantity : Decimal;
        PurchaseOrderQuantityUnit : String;
    }

    type POItemExpanded {
        PurchaseOrderItem         : String;
        PurchaseOrderItemText     : String;
        Material                  : String;
        OrderQuantity             : Decimal;
        PurchaseOrderQuantityUnit : String;
        NetPriceAmount            : Decimal;
        DocumentCurrency          : String;
        to_AccountAssignment      : array of POAccountAssignmentItem;
        to_ScheduleLine           : array of POScheduleLine;
    }

    type POExpandedResult {
        PurchaseOrder        : String;
        PurchaseOrderDate    : Date;
        DocumentCurrency     : String;
        Supplier             : String;
        to_PurchaseOrderItem : array of POItemExpanded;
    }

    // ─── HES / Service Entry Sheet (API_SERVICE_ENTRY_SHEET_SRV) ──
    type SESItemExpanded {
        ServiceEntrySheetItem : String;
        ShortText             : String;
        Quantity              : Decimal;
        QuantityUnit          : String;
        NetAmount             : Decimal;
        PurchaseOrder         : String;
        PurchaseOrderItem     : String;
    }

    type SESExpandedResult {
        ServiceEntrySheet        : String;
        PostingDate              : Date;
        Supplier                 : String;
        PurchasingOrganization   : String;
        PurchasingGroup          : String;
        to_ServiceEntrySheetItem : array of SESItemExpanded;
    }

    // ─── Purchase Requisition / SOLPED (API_PURCHASEREQ_PROCESS_SRV) ──
    type PurchReqItemExpanded {
        PurchaseRequisitionItem : String;
        Plant                   : String;
        MaterialGroup           : String;
        ShortText                : String;
        RequestedQuantity        : Decimal;
        BaseUnit                 : String;
        Supplier                 : String;
        PurchasingGroup          : String;
        PurchasingOrganization   : String;
    }

    type PurchReqExpandedResult {
        PurchaseRequisition        : String;
        PurchaseRequisitionType    : String;
        CreationDate                : Date;
        to_PurchaseRequisitionItem : array of PurchReqItemExpanded;
    }

    // ─── Funciones ────────────────────────────────────────────────
    function getPurchaseOrderAccountAssignment(PurchaseOrder: String,
                                               PurchaseOrderItem: String)             returns array of AccountAssignment;

    function getPurchaseContractAccountAssignment(PurchaseContract: String,
                                                  PurchaseContractItem: String)       returns array of PurchaseContractAccountAssignment;

    function getPurchaseOrderItemServices(PurchaseOrder: String,
                                          POItemNumber: String)                       returns array of PurchaseOrderItemService;

    function getPurchaseContractItemServices(PurchaseContract: String,
                                             PurchaseContractItem: String)            returns array of PurchaseOrderItemService;

    function me()                                                                     returns {
        email            : String;
        roles            : array of String;
        bp_ID            : String;
        itemModelEnabled : Boolean;
    };

    // ─── NUEVO: get completo con expand directo a S4 ──────────────
    function getPurchaseOrderExpanded(PurchaseOrder: String)                          returns POExpandedResult;

    // ─── NUEVO: lectura de HES y SOLPED (Purchase Requisition) ────
    function getHESExpanded(ServiceEntrySheet: String)                                returns SESExpandedResult;
    function getPurchaseRequisitionExpanded(PurchaseRequisition: String)              returns PurchReqExpandedResult;

    // ─── DEBUG: lista los entity sets reales de un servicio OData estándar en S4 ──
    function debugEntitySets(servicePath: String)                                    returns array of String;

    // ─── Acciones ─────────────────────────────────────────────────
    action   submitPrecertTicket(source_type: String(10),
                                 source_number: String(20),
                                 currency: String(3),
                                 business_partner: String,
                                 contact_fiscalizador: String,
                                 items: array of PrecertItem)                         returns SubmitPrecertResult;

    action   checkIASUser(email: String)                                              returns {
        ![exists] : Boolean
    };

    @(requires: ['FiscalizadorPrecertificacion'])
    action   onApproveTicket(ticket_id: UUID,
                             items: LargeString,
                             approved_by: String,
                             hes_groups: LargeString,
                             comment: String)                                         returns String;

    action   getHESDocument(nro_hes: String)                                          returns {
        value : LargeString;
    };

    action   downloadPrecertExcel(rows: many PrecertExcelRow)                         returns String;
    action   downloadSubTicketExcel(rows: many SubTicketExcelRow)                     returns String;
    action   downloadPrecertTickets()                                                 returns LargeString;
    action   downloadProvisionTickets()                                               returns String;
    action   uploadPrecertTickets(file: LargeString)                                  returns String;

    action   saveApprovalManual(ticket_id: UUID,
                                header: ApprovalManualHeader,
                                lines: array of ApprovalManualLine,
                                positionGroups: array of ApprovalManualPositionGroup) returns String;

    action   sendSolped(ticket_id: UUID,
                        BSART: String,
                        lines: array of ApprovalManualLine,
                        positionGroups: array of ApprovalManualPositionGroup,
                        items: LargeString,
                        hes_groups: LargeString,
                        approved_by: String,
                        comment: String)                                              returns String;

    type MAExcelHeader {
        ShortText            : String;
        text_workflow_solped : String;
        ZCRIT                : String;
    }

    type MAExcelRow {
        SRVPOS        : String;
        KTEXT1        : String;
        MENGE         : String;
        PREIS         : String;
        MEINS         : String(3);
        WAERS         : String;
        currentStatus : String;
        observations  : String;
        EKGRP         : String;
        WERKS         : String;
        MATKL         : String;
        KNTTP         : String;
        KOSTL         : String;
        NPLNR         : String;
        ACTIVITY      : String(12);
        AUFNR         : String;
        PSPNR         : String;
        delivery_date : String;
        canEdit       : Boolean;
    }

    action   downloadApprovalManualExcel(header: MAExcelHeader,
                                         rows: many MAExcelRow)                       returns {
        value : LargeBinary
    };

    action   downloadMAWizardExcel(header: ApprovalManualHeader, // reutiliza el tipo existente
                                   lines: many MAWizardLineFlat,
                                   purchGroups: many MAWizardCatalogItem,
                                   plants: many MAWizardCatalogItem,
                                   matGroups: many MAWizardCatalogItem)               returns String;

    action   generateManualTicket(currency: String(3),
                                  items: array of {
        posicion        : Integer;
        service_ID      : String(200);
        delivery_date   : String;
        cantidad        : Decimal(13, 3);
        unidad          : String(3);
        proveedor_um    : String(40);
        precio_unitario : Decimal(13, 3);
        moneda          : String(3);
        observations    : String(150);
        validator       : String(250);
    })                                                                                returns {
        ticket_number   : String;
        ticket_id       : UUID;
        total_amount    : Decimal(13, 2);
        status          : String;
    };

    action   downloadTicketDocument(document_id: UUID)                                returns {
        file_name : String;
        content   : LargeString;
    };

    action   uploadTicketDocument(ticket_id: UUID,
                                  file_name: String(255),
                                  file_content: LargeString)                          returns {
        document_id   : UUID;
        dms_object_id : String;
    };

    action   generateUploadToken(ticket_id: UUID)                                     returns {
        token      : String;
        expires_in : Integer;
    };

    action   _uploadFileToDMS(ticket_id: UUID,
                              file_name: String(255),
                              file_b64: LargeString,
                              user_id: String(100))                                   returns {
        document_id   : UUID;
        dms_object_id : String;
    };

    action   downloadManualExcel(rows: array of {
        posicion        : String;
        service_ID      : String;
        delivery_date   : String;
        cantidad        : String;
        unidad          : String(3);
        proveedor_um    : String(40);
        precio_unitario : String;
        moneda          : String;
        precio_total    : String;
        observations    : String;
        validator       : String;
    })                                                                                returns {
        value           : LargeBinary
    };

    // ─── Entidades de base de datos local ─────────────────────────
    entity Messages                as projection on db.TicketMessages
                                      order by
                                          createdAt asc;

    entity Logs                    as projection on db.ErrorLogs;
    entity PrecertTickets          as projection on db.PrecertTickets;
    entity PrecertTicketItems      as projection on db.PrecertTicketItems;
    entity WorkflowStatus          as projection on db.WorkflowStatus;
    entity Provinces               as projection on db.Provinces;
    entity BusinessPartners        as projection on db.BusinessPartners;
    entity AccountAssignmentsTypes as projection on db.AccountAssignmentsTypes;

    @cds.query.limit: {
        default: 99999,
        max    : 99999
    }
    entity Services                as projection on db.Services;

    entity MaterialGroup           as projection on db.MaterialGroup;
    entity Plants                  as projection on db.Plants;
    entity PurchGroup              as projection on db.PurchGroup;
    entity MeasureUnits            as projection on db.MeasureUnits;
    entity PurchOrg                as projection on db.PurchOrg;
    entity TicketDocuments         as projection on db.TicketDocuments;
}


annotate HESManagementService.PurchaseOrderExt with {
    PurchaseOrder          @Search.defaultSearchElement;
    Supplier               @Search.defaultSearchElement;
    CompanyCode            @Search.defaultSearchElement;
    PurchasingOrganization @Search.defaultSearchElement;
    PurchasingGroup        @Search.defaultSearchElement;
    CreatedByUser          @Search.defaultSearchElement;
    PurchaseOrderType      @Search.defaultSearchElement;
    DocumentCurrency       @Search.defaultSearchElement;
};
