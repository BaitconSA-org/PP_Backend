const exceljs = require('exceljs');

async function generatePrecertExcel(rows) {
    const workbook = new exceljs.Workbook();
    workbook.creator = "PrecertApp";

    // Hoja oculta para dropdowns
    const listsSheet = workbook.addWorksheet("__Listas__");
    listsSheet.state = "veryHidden";
    PROVINCIAS_ARGENTINA.forEach((p, i) => listsSheet.getCell(`A${i + 1}`).value = p);

    const sheet = workbook.addWorksheet("Precertificacion");

    const COLS = [
        { key: "OC", header: "OC", width: 14, locked: true },
        { key: "Posicion", header: "Posición", width: 10, locked: true },
        { key: "CantidadACertificar", header: "Cant. a Certif.", width: 14, locked: false, isNumber: true },
        { key: "CantidadDisponible", header: "Cant. disponible", width: 14, locked: true, isNumber: true },
        { key: "Desde", header: "Desde", width: 14, locked: false, isDate: true },
        { key: "Hasta", header: "Hasta", width: 14, locked: false, isDate: true },
        { key: "Servicio", header: "Servicio", width: 20, locked: true },
        { key: "SubServicio", header: "Sub Servicio", width: 20, locked: true },
        { key: "province_name", header: "Lug. Prest. Serv.", width: 22, locked: false, isProvince: true },
        { key: "Status", header: "Estado", width: 14, locked: true },
        { key: "observations", header: "Observaciones", width: 24, locked: false },
    ];

    sheet.columns = COLS.map(c => ({ key: c.key, width: c.width }));

    // Header
    const headerRow = sheet.addRow(
        COLS.reduce((acc, c) => { acc[c.key] = c.header; return acc; }, {})
    );
    headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "medium", color: { argb: COLORES.terciario } } };
        cell.protection = { locked: true };
    });
    headerRow.height = 24;

    // Datos
    rows.forEach((item, rowIdx) => {
        const row = sheet.addRow(item);
        const isEven = rowIdx % 2 === 0;

        COLS.forEach((col, colIdx) => {
            const cell = row.getCell(col.key);
            const colChar = String.fromCharCode(65 + colIdx);
            const cellAddr = `${colChar}${row.number}`;

            cell.fill = {
                type: "pattern", pattern: "solid",
                fgColor: {
                    argb: COLORES.claro
                }
            };
            cell.font = { color: { argb: col.locked ? COLORES.secundario : COLORES.tituloOscuro }, size: 10, name: "Titillium Web" };
            cell.alignment = { vertical: "middle", horizontal: "left" };
            cell.protection = { locked: col.locked };
            cell.border = { bottom: { style: "hair", color: { argb: COLORES.claro } } };

            if (col.isNumber && cell.value !== "" && cell.value !== null) {
                cell.numFmt = "#,##0.00";
                cell.alignment.horizontal = "right";
            }

            if (col.isDate && cell.value) {
                if (typeof cell.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(cell.value)) {
                    cell.value = new Date(cell.value);
                }
                cell.numFmt = "dd/mm/yyyy";
            }

            if (col.isProvince) {
                sheet.getCell(cellAddr).dataValidation = {
                    type: "list", allowBlank: true,
                    formulae: [`__Listas__!$A$1:$A$${PROVINCIAS_ARGENTINA.length}`],
                    showDropDown: false,
                    showErrorMessage: true,
                    error: "Seleccioná una provincia de la lista.",
                    errorTitle: "Valor inválido",
                    errorStyle: "stop"
                };
            }
        });

        // Borde izquierdo decorativo en col A
        const cellA = sheet.getCell(`A${row.number}`);
        cellA.border = { ...cellA.border, left: { style: "medium", color: { argb: COLORES.terciario } } };

        row.height = 20;
    });

    sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];

    await sheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false
    });

    return await workbook.xlsx.writeBuffer();
}

/**
 * Genera un buffer de Excel con celdas protegidas/desbloqueadas
 * @param {Array} columns - Configuración de columnas [{header, key, width, isEditable}]
 * @param {Array} data - Los registros a insertar
 * @param {String} sheetName - Nombre de la pestaña
 */

const PROVINCIAS_ARGENTINA = [
    "CABA", "Buenos Aires", "Catamarca", "Chaco", "Chubut",
    "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
    "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén",
    "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz",
    "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
    "Exterior"
];

const STATUS_OPTIONS = ["Pendiente", "Aprobado", "Rechazado"];

const COLORES = {
    primario: "FF2E2472",
    tituloOscuro: "FF1B1A3F",
    secundario: "FF3D3191",
    terciario: "FF563EC2",
    claro: "FFC8C3E8",
    muyClaro: "FFE8E5F5",
    acento: "FF92D050",
};

/**
 * Genera el Excel de subtickets con protección, dropdowns y colores corporativos.
 * @param {Array} rows - Filas de datos (objetos planos)
 * @returns {Buffer} - Buffer binario del .xlsx
 */
async function generateSubTicketExcel(rows) {
    const workbook = new exceljs.Workbook();
    workbook.creator = "TicketApp";
    workbook.lastModifiedBy = "TicketApp";

    // ── Hoja oculta para listas de validación ──────────────────────────────
    const listsSheet = workbook.addWorksheet("__Listas__");
    listsSheet.state = "veryHidden";

    PROVINCIAS_ARGENTINA.forEach((p, i) =>
        listsSheet.getCell(`A${i + 1}`).value = p
    );
    STATUS_OPTIONS.forEach((s, i) =>
        listsSheet.getCell(`B${i + 1}`).value = s
    );

    // ── Hoja principal ─────────────────────────────────────────────────────
    const sheet = workbook.addWorksheet("Subtickets", {
        pageSetup: { fitToPage: true, fitToWidth: 1 }
    });

    // Columnas: [key, header, width, isEditable, tipo]
    const COLS = [
        { key: "purchase_order_item", header: "Pos", width: 8, locked: true },
        { key: "qty_to_certify", header: "Cant a Certif.", width: 14, locked: false, isNumber: true },
        { key: "province_name", header: "Lug. Prest. Serv.", width: 22, locked: false, isProvince: true },
        { key: "date_from", header: "Desde", width: 14, locked: false, isDate: true },
        { key: "date_to", header: "Hasta", width: 14, locked: false, isDate: true },
        { key: "service", header: "Servicio", width: 20, locked: true },
        { key: "subService", header: "SubServicio", width: 20, locked: true },
        { key: "global_ledger_account", header: "Cta Cble", width: 14, locked: true },
        { key: "cost_center", header: "CeCo", width: 14, locked: true },
        { key: "grafo", header: "Grafo", width: 14, locked: true },
        { key: "order", header: "Orden", width: 14, locked: true },
        { key: "status", header: "Estado", width: 14, locked: false, isStatus: true },
        { key: "observations", header: "Observaciones", width: 24, locked: false },
    ];

    sheet.columns = COLS.map(c => ({ key: c.key, width: c.width }));

    // ── Fila de encabezado ─────────────────────────────────────────────────
    const headerRow = sheet.addRow(
        COLS.reduce((acc, c) => { acc[c.key] = c.header; return acc; }, {})
    );

    headerRow.eachCell(cell => {
        cell.fill = {
            type: "pattern", pattern: "solid",
            fgColor: { argb: COLORES.primario }
        };
        cell.font = {
            bold: true, color: { argb: "FFFFFFFF" }, size: 11,
            name: "Titillium Web"
        };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
        cell.border = {
            bottom: { style: "medium", color: { argb: COLORES.terciario } }
        };
        cell.protection = { locked: true };
    });
    headerRow.height = 24;

    // ── Filas de datos ─────────────────────────────────────────────────────
    rows.forEach((item, rowIdx) => {
        const row = sheet.addRow(item);
        const isEven = rowIdx % 2 === 0;

        COLS.forEach((col, colIdx) => {
            const cell = row.getCell(col.key);
            const colNum = colIdx + 1;          // 1-based para dataValidation

            // ─ Fondo ──────────────────────────────────────────────────────
            if (col.locked) {
                // Bloqueadas → claro (lavanda)
                cell.fill = {
                    type: "pattern", pattern: "solid",
                    fgColor: { argb: COLORES.claro }
                };
                cell.font = {
                    color: { argb: COLORES.secundario }, size: 10,
                    name: "Titillium Web"
                };
            } else {
                cell.fill = {
                    type: "pattern", pattern: "solid",
                    fgColor: { argb: COLORES.muyClaro }
                };
                cell.font = {
                    color: { argb: COLORES.tituloOscuro }, size: 10,
                    name: "Titillium Web"
                };
            }

            cell.alignment = { vertical: "middle", horizontal: "left" };
            cell.protection = { locked: col.locked };

            // ─ Formatos especiales ─────────────────────────────────────────
            if (col.isNumber && cell.value !== "" && cell.value !== null) {
                cell.numFmt = "#,##0.00";
                cell.alignment.horizontal = "right";
            }

            if (col.isDate && cell.value) {
                // Si viene como string "yyyy-MM-dd" convertir a Date para numFmt
                if (typeof cell.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(cell.value)) {
                    cell.value = new Date(cell.value);
                }
                cell.numFmt = "dd/mm/yyyy";
            }

            // ─ Validaciones (dropdown) ─────────────────────────────────────
            const cellAddr = `${String.fromCharCode(64 + colNum)}${row.number}`;

            if (col.isProvince) {
                sheet.getCell(cellAddr).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`__Listas__!$A$1:$A$${PROVINCIAS_ARGENTINA.length}`],
                    showDropDown: false,   // false = mostrar la flecha en Excel
                    showErrorMessage: true,
                    error: "Seleccioná una provincia de la lista.",
                    errorTitle: "Valor inválido",
                    errorStyle: "stop"
                };
            }

            if (col.isStatus) {
                sheet.getCell(cellAddr).dataValidation = {
                    type: "list",
                    allowBlank: true,
                    formulae: [`__Listas__!$B$1:$B$${STATUS_OPTIONS.length}`],
                    showDropDown: false,
                    showErrorMessage: true,
                    error: "Los valores válidos son: " + STATUS_OPTIONS.join(", "),
                    errorTitle: "Estado inválido",
                    errorStyle: "stop"
                };
            }

            // ─ Borde inferior suave ────────────────────────────────────────
            cell.border = {
                bottom: { style: "hair", color: { argb: COLORES.claro } }
            };
        });

        row.height = 20;
    });

    // ── Borde decorativo izquierdo en la primera columna ───────────────────
    for (let r = 2; r <= rows.length + 1; r++) {
        const cell = sheet.getCell(`A${r}`);
        cell.border = {
            ...cell.border,
            left: { style: "medium", color: { argb: COLORES.terciario } }
        };
    }

    // ── Congelar fila de encabezado ────────────────────────────────────────
    sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];

    // ── Proteger hoja (sólo celdas locked quedan bloqueadas) ───────────────
    await sheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false
    });

    return await workbook.xlsx.writeBuffer();
}

async function generateProtectedExcel(columns, data, sheetName = 'Hoja1') {
    const workbook = new exceljs.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    // 1. Configurar columnas
    sheet.columns = columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15
    }));

    // 2. Insertar datos y aplicar protección por celda
    data.forEach(item => {
        const row = sheet.addRow(item);

        columns.forEach(col => {
            const cell = row.getCell(col.key);
            // Si la columna es editable, locked = false. Si no, true.
            cell.protection = {
                locked: !col.isEditable
            };

            // Formato opcional para precios
            if (col.isCurrency) {
                cell.numFmt = '"$"#,##0.00';
            }
        });
    });

    // 3. Proteger la hoja (sin password para que sea simple, o agrégale uno)
    await sheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true
    });

    return await workbook.xlsx.writeBuffer();
}
function getCellValue(value) {
    if (value === null || value === undefined) return null;

    if (value instanceof Date) return value;

    if (typeof value === 'object') {
        if (value.text !== undefined) return value.text;
        if (value.result !== undefined) return value.result;
        if (value.richText) return value.richText.map(t => t.text).join('');
    }

    return value;
}

async function readExcelByColumns(base64File, columns, sheetName = 'Hoja1') {
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.load(Buffer.from(base64File, 'base64'));

    const sheet = workbook.getWorksheet(sheetName) || workbook.worksheets[0];

    if (!sheet) {
        throw new Error('No se encontró la hoja del Excel');
    }

    const rows = [];

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const item = {};
        let hasData = false;

        columns.forEach((col, index) => {
            const rawValue = row.getCell(index + 1).value;
            const value = getCellValue(rawValue);

            if (value !== null && value !== '') {
                hasData = true;
            }

            item[col.key] = value;
        });

        if (hasData) {
            rows.push(item);
        }
    });

    return rows;
}

async function generateManualExcel(rows, aServices) {
    const workbook = new exceljs.Workbook();
    workbook.creator = "Solicitud de OC";

    // ── Hoja de datos ───────────────────────────────────────────────────
    const sheet = workbook.addWorksheet("SolicitudOC");

    const COLS = [
        { key: "posicion", header: "Posición", width: 10, locked: true },
        { key: "service_ID", header: "Descripción del servicio", width: 30, locked: false, isServicio: true },
        { key: "delivery_date", header: "Fecha entrega", width: 14, locked: false, isDate: true },
        { key: "cantidad", header: "Cantidad", width: 12, locked: false, isNumber: true },
        { key: "proveedor_um", header: "Unidad", width: 10, locked: false },
        { key: "precio_unitario", header: "Precio unitario", width: 16, locked: false, isNumber: true },
        { key: "precio_total", header: "Precio total", width: 16, locked: true, isNumber: true },
        { key: "observations", header: "Observaciones", width: 30, locked: false },
    ];

    sheet.columns = COLS.map(c => ({ key: c.key, width: c.width }));

    // ── Encabezado ────────────────────────────────────────────────────────
    const headerRow = sheet.addRow(
        COLS.reduce((acc, c) => { acc[c.key] = c.header; return acc; }, {})
    );
    headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "medium", color: { argb: COLORES.terciario } } };
        cell.protection = { locked: true };
    });
    headerRow.height = 24;

    // ── Filas de datos ────────────────────────────────────────────────────
    rows.forEach((item) => {
        const row = sheet.addRow(item);

        COLS.forEach((col) => {
            const cell = row.getCell(col.key);

            cell.fill = {
                type: "pattern", pattern: "solid",
                fgColor: { argb: col.locked ? COLORES.claro : COLORES.muyClaro }
            };
            cell.font = {
                color: { argb: col.locked ? COLORES.secundario : COLORES.tituloOscuro },
                size: 10, name: "Titillium Web"
            };
            cell.alignment = { vertical: "middle", horizontal: col.isNumber ? "right" : "left" };
            cell.protection = { locked: col.locked };
            cell.border = { bottom: { style: "hair", color: { argb: COLORES.claro } } };

            if (col.isNumber && cell.value !== "" && cell.value !== null) {
                cell.numFmt = "#,##0.000";
            }

            if (col.isDate && cell.value) {
                if (typeof cell.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(cell.value)) {
                    cell.value = new Date(cell.value + "T00:00:00");
                }
                cell.numFmt = "dd/mm/yyyy";
            }

        });

        // Borde izquierdo decorativo
        const cellA = sheet.getCell(`A${row.number}`);
        cellA.border = { ...cellA.border, left: { style: "medium", color: { argb: COLORES.terciario } } };
        row.height = 20;
    });

    sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];

    await sheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false
    });

    return await workbook.xlsx.writeBuffer();
}

async function generateApprovalManualExcel(oHeader, aRows, aUnits, aPurchGroups, aPlants, aMatGroups) {
    const workbook = new exceljs.Workbook();
    workbook.creator = "ApprovalApp";

    // ── Hojas ocultas con catálogos ───────────────────────────────────
    const _makeCatalog = (name, items) => {
        const ws = workbook.addWorksheet(name);
        ws.state = "veryHidden";
        (items || []).forEach((it, i) => {
            ws.getCell(`A${i + 1}`).value = it.ID || "";
        });
        return (items || []).length || 1;
    };

    const pgLen = _makeCatalog("__PG__", aPurchGroups);
    const plLen = _makeCatalog("__PL__", aPlants);
    const mgLen = _makeCatalog("__MG__", aMatGroups);
    const unLen = _makeCatalog("__UN__", aUnits);

    // ── HOJA 1: Cabecera ──────────────────────────────────────────────
    const cabSheet = workbook.addWorksheet("Cabecera");
    cabSheet.getColumn(1).width = 22;
    cabSheet.getColumn(2).width = 65;

    [
        { label: "Texto breve", value: oHeader.ShortText || "", dv: null },
        { label: "Texto workflow", value: oHeader.text_workflow_solped || "", dv: null },
        { label: "Criticidad", value: oHeader.ZCRIT || "", dv: '"A,B,C"' }
    ].forEach((def, i) => {
        const rn = i + 1;

        const cellL = cabSheet.getCell(`A${rn}`);
        cellL.value = def.label;
        cellL.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cellL.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cellL.alignment = { vertical: "middle" };
        cellL.protection = { locked: true };

        const cellV = cabSheet.getCell(`B${rn}`);
        cellV.value = def.value;
        cellV.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.muyClaro } };
        cellV.font = { color: { argb: COLORES.tituloOscuro }, size: 11, name: "Titillium Web" };
        cellV.alignment = { vertical: "middle" };
        cellV.protection = { locked: false };

        if (def.dv) {
            cellV.dataValidation = {
                type: "list", allowBlank: true,
                formulae: [def.dv],
                showErrorMessage: true,
                error: "Valores válidos: A, B, C",
                errorStyle: "stop"
            };
        }
        cabSheet.getRow(rn).height = 22;
    });

    await cabSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

    // ── HOJA 2: Líneas ────────────────────────────────────────────────
    const linSheet = workbook.addWorksheet("Líneas");

    const LINE_COLS = [
        // Referencia — bloqueadas (visualmente distintas con fondo claro)
        { key: "SRVPOS", header: "N° Servicio", width: 14, locked: false },
        { key: "KTEXT1", header: "Descripción", width: 32, locked: true },
        { key: "MENGE", header: "Cantidad", width: 12, locked: false, isNumber: true },
        { key: "PREIS", header: "Precio", width: 14, locked: true, isNumber: true },
        {
            key: "MEINS", header: "Unidad", width: 10, locked: false,
            dv: { ref: "__UN__", len: unLen, err: "Seleccioná una unidad de medida." }
        },
        {
            key: "WAERS", header: "Moneda", width: 8, locked: true
        },
        {
            key: "currentStatus", header: "Estado", width: 14, locked: false,
            dv: { inline: '"PENDIENTE,APROBADO,RECHAZADO"', err: "Valores válidos: PENDIENTE, APROBADO, RECHAZADO." }
        },
        { key: "observations", header: "Observaciones", width: 24, locked: true },
        // Compras — editables con dropdown
        {
            key: "EKGRP", header: "Grp. Compras", width: 14, locked: false,
            dv: { ref: "__PG__", len: pgLen, err: "Seleccioná un Grupo de Compras." }
        },
        {
            key: "WERKS", header: "Centro", width: 12, locked: false,
            dv: { ref: "__PL__", len: plLen, err: "Seleccioná un Centro." }
        },
        {
            key: "MATKL", header: "Grp. Art.", width: 12, locked: false,
            dv: { ref: "__MG__", len: mgLen, err: "Seleccioná un Grupo de Artículo." }
        },
        // Imputación — editables
        {
            key: "KNTTP", header: "Tp. Imput.", width: 10, locked: false,
            dv: { inline: '"K,N,F,P"', err: "Valores válidos: K, N, F, P." }
        },
        { key: "KOSTL", header: "CeCo", width: 16, locked: false },
        { key: "NPLNR", header: "Grafo", width: 16, locked: false },
        { key: "ACTIVITY", header: "Actividad", width: 10, locked: false },
        { key: "AUFNR", header: "Orden", width: 16, locked: false },
        { key: "PSPNR", header: "Proyecto", width: 18, locked: false },
        { key: "delivery_date", header: "Fec. Entrega", width: 14, locked: false, isDate: true }
    ];

    linSheet.columns = LINE_COLS.map(c => ({ key: c.key, width: c.width }));

    // Header
    const headerRow = linSheet.addRow(
        LINE_COLS.reduce((acc, c) => { acc[c.key] = c.header; return acc; }, {})
    );
    headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "medium", color: { argb: COLORES.terciario } } };
        cell.protection = { locked: true };
    });
    headerRow.height = 24;

    // Filas de datos
    (aRows || []).forEach(it => {
        // Filas no editables van con fondo gris y todas bloqueadas
        const bEditable = it.canEdit !== false;

        const row = linSheet.addRow({
            SRVPOS: it.SRVPOS || "",
            KTEXT1: it.KTEXT1 || "",
            MENGE: it.MENGE || "",
            PREIS: it.PREIS || "",
            MEINS: it.MEINS || "",
            WAERS: it.WAERS || "",
            currentStatus: it.currentStatus || "",
            observations: it.observations || "",
            EKGRP: it.EKGRP || "",
            WERKS: it.WERKS || "",
            MATKL: it.MATKL || "",
            KNTTP: it.KNTTP || "",
            KOSTL: it.KOSTL || "",
            NPLNR: it.NPLNR || "",
            ACTIVITY: it.ACTIVITY || "",
            AUFNR: it.AUFNR || "",
            PSPNR: it.PSPNR || "",
            delivery_date: it.delivery_date || ""
        });

        LINE_COLS.forEach((col, colIdx) => {
            const cell = row.getCell(col.key);
            const cellAddr = `${String.fromCharCode(65 + colIdx)}${row.number}`;
            const bLocked = col.locked || !bEditable;

            cell.fill = {
                type: "pattern", pattern: "solid",
                fgColor: {
                    argb: !bEditable
                        ? "FFD3D1C7"          // gris para filas no editables
                        : bLocked
                            ? COLORES.claro
                            : COLORES.muyClaro
                }
            };
            cell.font = {
                color: { argb: !bEditable ? "FF888780" : bLocked ? COLORES.secundario : COLORES.tituloOscuro },
                size: 10,
                name: "Titillium Web",
                italic: !bEditable
            };
            cell.alignment = { vertical: "middle", horizontal: col.isNumber ? "right" : "left" };
            cell.protection = { locked: bLocked };
            cell.border = { bottom: { style: "hair", color: { argb: COLORES.claro } } };

            if (col.isNumber && cell.value !== "" && cell.value !== null) {
                cell.numFmt = "#,##0.000";
            }

            if (col.isDate && cell.value) {
                if (typeof cell.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(cell.value)) {
                    cell.value = new Date(cell.value + "T00:00:00");
                }
                cell.numFmt = "dd/mm/yyyy";
            }

            // Dropdowns solo en filas editables
            if (bEditable && col.dv) {
                linSheet.getCell(cellAddr).dataValidation = {
                    type: "list", allowBlank: true,
                    formulae: col.dv.ref
                        ? [`${col.dv.ref}!$A$1:$A$${col.dv.len}`]
                        : [col.dv.inline],
                    showDropDown: false,
                    showErrorMessage: true,
                    error: col.dv.err,
                    errorTitle: "Valor inválido",
                    errorStyle: "stop"
                };
            }
        });

        // Borde izquierdo decorativo
        const cellA = linSheet.getCell(`A${row.number}`);
        cellA.border = {
            ...cellA.border,
            left: {
                style: bEditable ? "medium" : "thin",
                color: { argb: bEditable ? COLORES.terciario : "FFC0C0C0" }
            }
        };
        row.height = 20;
    });

    linSheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
    await linSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

    return await workbook.xlsx.writeBuffer();
}


function _pcAddHeaderRow(sheet, cols) {
    const headerRow = sheet.addRow(cols.reduce((acc, c) => { acc[c.key] = c.header; return acc; }, {}));
    headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "medium", color: { argb: COLORES.terciario } } };
        cell.protection = { locked: true };
    });
    headerRow.height = 24;
    return headerRow;
}

function _pcStyleCell(row, col) {
    const cell = row.getCell(col.key);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col.locked ? COLORES.claro : COLORES.muyClaro } };
    cell.font = { color: { argb: col.locked ? COLORES.secundario : COLORES.tituloOscuro }, size: 10, name: "Titillium Web" };
    cell.alignment = { vertical: "middle", horizontal: col.isNumber ? "right" : "left" };
    cell.protection = { locked: col.locked };
    cell.border = { bottom: { style: "hair", color: { argb: COLORES.claro } } };

    if (col.isNumber && cell.value !== "" && cell.value !== null) {
        cell.numFmt = "#,##0.000";
    }
    if (col.isDate && cell.value) {
        if (typeof cell.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(cell.value)) {
            cell.value = new Date(cell.value);
        }
        cell.numFmt = "dd/mm/yyyy";
    }
    return cell;
}

function _pcAddDropdown(sheet, cellAddr, formulae, errorMsg) {
    sheet.getCell(cellAddr).dataValidation = {
        type: "list", allowBlank: true,
        formulae: [formulae],
        showDropDown: false,
        showErrorMessage: true,
        error: errorMsg,
        errorTitle: "Valor inválido",
        errorStyle: "stop"
    };
}

function _pcAddLeftBorder(sheet, rowNumber) {
    const cell = sheet.getCell(`A${rowNumber}`);
    cell.border = { ...cell.border, left: { style: "medium", color: { argb: COLORES.terciario } } };
}

// ── Función principal ─────────────────────────────────────────────────

async function generatePurchaseContractExcel({ lines = [], positionGroups = [], purchGroups = [], plants = [], header = {} }) {
    const workbook = new exceljs.Workbook();
    workbook.creator = "PrecertApp";

    // ── Hojas ocultas con catálogos ──────────────────────────────────────
    const listsSheet = workbook.addWorksheet("__Listas__");
    listsSheet.state = "veryHidden";

    PROVINCIAS_ARGENTINA.forEach((p, i) => listsSheet.getCell(`A${i + 1}`).value = p);
    ["PENDIENTE", "APROBADO", "RECHAZADO"].forEach((s, i) => listsSheet.getCell(`B${i + 1}`).value = s);
    ["K", "N", "P", "F"].forEach((v, i) => listsSheet.getCell(`C${i + 1}`).value = v);

    const PG_IDS = (purchGroups || []).map(p => p.ID || String(p)).filter(Boolean);
    PG_IDS.forEach((pg, i) => listsSheet.getCell(`D${i + 1}`).value = pg);

    const PLANT_IDS = (plants || []).map(p => p.ID || String(p)).filter(Boolean);
    PLANT_IDS.forEach((pl, i) => listsSheet.getCell(`E${i + 1}`).value = pl);

    const nProv = PROVINCIAS_ARGENTINA.length;
    const nPG = PG_IDS.length || 1;
    const nPL = PLANT_IDS.length || 1;

    // ══════════════════════════════════════════════════════════════════
    //  HOJA 1: Cabecera
    // ══════════════════════════════════════════════════════════════════
    const cabSheet = workbook.addWorksheet("Cabecera");
    cabSheet.getColumn(1).width = 22;
    cabSheet.getColumn(2).width = 65;

    [
        { label: "Texto breve", field: "ShortText", dv: null },
        { label: "Texto workflow", field: "text_workflow_solped", dv: null },
        { label: "Criticidad", field: "ZCRIT", dv: '"A,B,C"' }
    ].forEach((def, i) => {
        const rn = i + 1;

        const cellL = cabSheet.getCell(`A${rn}`);
        cellL.value = def.label;
        cellL.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cellL.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cellL.alignment = { vertical: "middle" };
        cellL.protection = { locked: true };

        const cellV = cabSheet.getCell(`B${rn}`);
        cellV.value = (header || {})[def.field] || "";
        cellV.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.muyClaro } };
        cellV.font = { color: { argb: COLORES.tituloOscuro }, size: 11, name: "Titillium Web" };
        cellV.alignment = { vertical: "middle" };
        cellV.protection = { locked: false };

        if (def.dv) {
            cellV.dataValidation = {
                type: "list", allowBlank: true,
                formulae: [def.dv],
                showErrorMessage: true,
                error: "Valores válidos: A, B, C",
                errorStyle: "stop"
            };
        }
        cabSheet.getRow(rn).height = 22;
    });

    await cabSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

    // ══════════════════════════════════════════════════════════════════
    //  HOJA 2: Líneas
    // ══════════════════════════════════════════════════════════════════
    const linesSheet = workbook.addWorksheet("Líneas");

    const LINE_COLS = [
        { key: "po_item", header: "Posición", width: 10, locked: true },
        { key: "short_text", header: "Descripción", width: 38, locked: true },
        { key: "qty_to_certify", header: "Cantidad", width: 14, locked: false, isNumber: true },
        { key: "province_name", header: "Lugar Prest.", width: 22, locked: false, isProvince: true },
        { key: "date_from", header: "Desde", width: 14, locked: false, isDate: true },
        { key: "date_to", header: "Hasta", width: 14, locked: false, isDate: true },
        { key: "delivery_date", header: "Fec. Entrega", width: 14, locked: false, isDate: true },
        { key: "status", header: "Estado", width: 14, locked: false, isStatus: true },
        {
            key: "EKGRP", header: "Grp. Compras", width: 14, locked: false,
            dv: PG_IDS.length ? `__Listas__!$D$1:$D$${nPG}` : null,
            dvErr: "Seleccioná un Grupo de Compras."
        },
        {
            key: "WERKS", header: "Centro", width: 12, locked: false,
            dv: PLANT_IDS.length ? `__Listas__!$E$1:$E$${nPL}` : null,
            dvErr: "Seleccioná un Centro."
        },
        {
            key: "MATKL", header: "Grp. Art.", width: 12, locked: false,
            dv: null
        },
        {
            key: "KNTTP", header: "Tp. Imput.", width: 10, locked: false,
            dv: `__Listas__!$C$1:$C$4`,
            dvErr: "Valores válidos: K, N, F, P."
        },
        { key: "KOSTL", header: "CeCo", width: 16, locked: false },
        { key: "NPLNR", header: "Grafo", width: 16, locked: false },
        { key: "ACTIVITY", header: "Actividad", width: 10, locked: false },
        { key: "AUFNR", header: "Orden", width: 16, locked: false },
        { key: "PSPNR", header: "Proyecto", width: 18, locked: false }
    ];

    linesSheet.columns = LINE_COLS.map(c => ({ key: c.key, width: c.width }));

    const linesHeader = linesSheet.addRow(
        LINE_COLS.reduce((acc, c) => { acc[c.key] = c.header; return acc; }, {})
    );
    linesHeader.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "medium", color: { argb: COLORES.terciario } } };
        cell.protection = { locked: true };
    });
    linesHeader.height = 24;

    lines.forEach(item => {
        const bCanEdit = item.can_edit !== false;

        const row = linesSheet.addRow({
            po_item: item.po_item || "",
            short_text: item.short_text || "",
            qty_to_certify: item.qty_to_certify || "",
            province_name: item.province_name || "",
            date_from: item.date_from || "",
            date_to: item.date_to || "",
            delivery_date: item.delivery_date || "",
            status: item.status || "",
            EKGRP: item.EKGRP || "",
            WERKS: item.WERKS || "",
            KNTTP: item.KNTTP || "",
            KOSTL: item.KOSTL || "",
            NPLNR: item.NPLNR || "",
            ACTIVITY: item.ACTIVITY || "",
            AUFNR: item.AUFNR || "",
            PSPNR: item.PSPNR || ""
        });

        LINE_COLS.forEach((col, colIdx) => {
            const cell = row.getCell(col.key);
            const cellAddr = `${String.fromCharCode(65 + colIdx)}${row.number}`;
            const bLocked = col.locked || !bCanEdit;

            cell.fill = {
                type: "pattern", pattern: "solid",
                fgColor: { argb: !bCanEdit ? "FFD3D1C7" : bLocked ? COLORES.claro : COLORES.muyClaro }
            };
            cell.font = {
                color: { argb: !bCanEdit ? "FF888780" : bLocked ? COLORES.secundario : COLORES.tituloOscuro },
                size: 10, name: "Titillium Web", italic: !bCanEdit
            };
            cell.alignment = { vertical: "middle", horizontal: col.isNumber ? "right" : "left" };
            cell.protection = { locked: bLocked };
            cell.border = { bottom: { style: "hair", color: { argb: COLORES.claro } } };

            if (col.isNumber && cell.value !== "" && cell.value !== null)
                cell.numFmt = "#,##0.000";

            if (col.isDate && cell.value) {
                if (typeof cell.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(cell.value))
                    cell.value = new Date(cell.value);
                cell.numFmt = "dd/mm/yyyy";
            }

            if (bCanEdit) {
                if (col.isProvince) {
                    linesSheet.getCell(cellAddr).dataValidation = {
                        type: "list", allowBlank: true,
                        formulae: [`__Listas__!$A$1:$A$${nProv}`],
                        showDropDown: false, showErrorMessage: true,
                        error: "Seleccioná una provincia.", errorTitle: "Valor inválido", errorStyle: "stop"
                    };
                }
                if (col.isStatus) {
                    linesSheet.getCell(cellAddr).dataValidation = {
                        type: "list", allowBlank: true,
                        formulae: [`__Listas__!$B$1:$B$3`],
                        showDropDown: false, showErrorMessage: true,
                        error: "Valores válidos: PENDIENTE, APROBADO, RECHAZADO",
                        errorTitle: "Estado inválido", errorStyle: "stop"
                    };
                }
                if (col.dv) {
                    linesSheet.getCell(cellAddr).dataValidation = {
                        type: "list", allowBlank: true,
                        formulae: [col.dv],
                        showDropDown: false, showErrorMessage: true,
                        error: col.dvErr, errorTitle: "Valor inválido", errorStyle: "stop"
                    };
                }
            }
        });

        const cellA = linesSheet.getCell(`A${row.number}`);
        cellA.border = {
            ...cellA.border,
            left: { style: bCanEdit ? "medium" : "thin", color: { argb: bCanEdit ? COLORES.terciario : "FFC0C0C0" } }
        };
        row.height = 20;
    });

    linesSheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
    await linesSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true, formatCells: false, formatColumns: false, formatRows: false });

    return await workbook.xlsx.writeBuffer();
}


async function generateMAWizardExcel(oHeader, aLines, purchGroups, plants, matGroups) {
    const workbook = new exceljs.Workbook();
    workbook.creator = "ApprovalWizardApp";

    // ── Hojas ocultas con catálogos ───────────────────────────────────
    const _makeCatalogSheet = (name, items) => {
        const ws = workbook.addWorksheet(name);
        ws.state = "veryHidden";
        (items || []).forEach((item, i) => {
            ws.getCell(`A${i + 1}`).value = item.ID || "";
        });
    };
    _makeCatalogSheet("__PG__", purchGroups);
    _makeCatalogSheet("__PL__", plants);
    _makeCatalogSheet("__MG__", matGroups);

    const pgLen = (purchGroups || []).length || 1;
    const plLen = (plants || []).length || 1;
    const mgLen = (matGroups || []).length || 1;

    // ── HOJA 1: Cabecera ──────────────────────────────────────────────
    const cabSheet = workbook.addWorksheet("Cabecera");
    cabSheet.getColumn(1).width = 22;
    cabSheet.getColumn(2).width = 65;

    const aCabRows = [
        { label: "Texto breve", field: "ShortText", dv: null },
        { label: "Texto workflow", field: "text_workflow_solped", dv: null },
        { label: "Criticidad", field: "ZCRIT", dv: '"A,B,C"' }
    ];

    aCabRows.forEach((def, i) => {
        const rn = i + 1;
        const cellL = cabSheet.getCell(`A${rn}`);
        cellL.value = def.label;
        cellL.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cellL.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cellL.alignment = { vertical: "middle" };
        cellL.protection = { locked: true };

        const cellV = cabSheet.getCell(`B${rn}`);
        cellV.value = (oHeader || {})[def.field] || "";
        cellV.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.muyClaro } };
        cellV.font = { color: { argb: COLORES.tituloOscuro }, size: 11, name: "Titillium Web" };
        cellV.alignment = { vertical: "middle" };
        cellV.protection = { locked: false };

        if (def.dv) {
            cabSheet.getCell(`B${rn}`).dataValidation = {
                type: "list", allowBlank: true,
                formulae: [def.dv],
                showErrorMessage: true,
                error: "Valores válidos: A, B, C",
                errorStyle: "stop"
            };
        }
    });

    await cabSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

    // ── HOJA 2: Líneas ────────────────────────────────────────────────
    const linSheet = workbook.addWorksheet("Líneas");

    const LINE_COLS = [
        // Referencia (bloqueadas)
        { key: "SRVPOS", header: "N° Servicio", width: 14, locked: true },
        { key: "KTEXT1", header: "Descripción", width: 32, locked: true },
        { key: "MENGE", header: "Cantidad", width: 12, locked: true, isNumber: true },
        { key: "PREIS", header: "Precio", width: 14, locked: true, isNumber: true },
        { key: "MEINS", header: "Unidad", width: 10, locked: true },
        { key: "WAERS", header: "Moneda", width: 8, locked: true },
        // Datos de compras (editables, con dropdown)
        {
            key: "EKGRP", header: "Grp. Compras", width: 14, locked: false,
            dv: { ref: "__PG__", len: pgLen, err: "Seleccioná un Grupo de Compras." }
        },
        {
            key: "WERKS", header: "Centro", width: 12, locked: false,
            dv: { ref: "__PL__", len: plLen, err: "Seleccioná un Centro." }
        },
        {
            key: "MATKL", header: "Grp. Art.", width: 12, locked: false,
            dv: { ref: "__MG__", len: mgLen, err: "Seleccioná un Grupo de Artículo." }
        },
        // Imputación (editables)
        {
            key: "KNTTP", header: "Tp. Imput.", width: 10, locked: false,
            dv: { inline: '"K,N,F,P"', err: "Valores válidos: K, N, F, P." }
        },
        { key: "KOSTL", header: "CeCo", width: 16, locked: false },
        { key: "NPLNR", header: "Grafo", width: 16, locked: false },
        { key: "ACTIVITY", header: "Actividad", width: 10, locked: false },
        { key: "AUFNR", header: "Orden", width: 16, locked: false },
        { key: "PSPNR", header: "Proyecto", width: 18, locked: false },
        { key: "delivery_date", header: "Fec. Entrega", width: 14, locked: false, isDate: true }
    ];

    linSheet.columns = LINE_COLS.map(c => ({ key: c.key, width: c.width }));

    // Header row
    const headerRow = linSheet.addRow(
        LINE_COLS.reduce((acc, c) => { acc[c.key] = c.header; return acc; }, {})
    );
    headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORES.primario } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Titillium Web" };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "medium", color: { argb: COLORES.terciario } } };
        cell.protection = { locked: true };
    });
    headerRow.height = 24;

    // Data rows
    (aLines || []).forEach(l => {
        const row = linSheet.addRow({
            SRVPOS: l.SRVPOS || "",
            KTEXT1: l.KTEXT1 || "",
            MENGE: l.MENGE || "",
            PREIS: l.PREIS || "",
            MEINS: l.MEINS || "",
            WAERS: l.WAERS || "",
            EKGRP: l.EKGRP || "",
            WERKS: l.WERKS || "",
            MATKL: l.MATKL || "",
            KNTTP: l.KNTTP || "",
            KOSTL: l.KOSTL || "",
            NPLNR: l.NPLNR || "",
            ACTIVITY: l.ACTIVITY || "",
            AUFNR: l.AUFNR || "",
            PSPNR: l.PSPNR || "",
            delivery_date: l.delivery_date || ""
        });

        LINE_COLS.forEach((col, colIdx) => {
            const cell = row.getCell(col.key);
            const cellAddr = `${String.fromCharCode(65 + colIdx)}${row.number}`;

            cell.fill = {
                type: "pattern", pattern: "solid",
                fgColor: { argb: col.locked ? COLORES.claro : COLORES.muyClaro }
            };
            cell.font = {
                color: { argb: col.locked ? COLORES.secundario : COLORES.tituloOscuro },
                size: 10, name: "Titillium Web"
            };
            cell.alignment = { vertical: "middle", horizontal: col.isNumber ? "right" : "left" };
            cell.protection = { locked: col.locked };
            cell.border = { bottom: { style: "hair", color: { argb: COLORES.claro } } };

            if (col.isNumber && cell.value !== "" && cell.value !== null) {
                cell.numFmt = "#,##0.000";
            }

            if (col.isDate && cell.value) {
                if (typeof cell.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(cell.value)) {
                    cell.value = new Date(cell.value + "T00:00:00");
                }
                cell.numFmt = "dd/mm/yyyy";
            }

            if (col.dv) {
                linSheet.getCell(cellAddr).dataValidation = {
                    type: "list", allowBlank: true,
                    formulae: col.dv.ref
                        ? [`${col.dv.ref}!$A$1:$A$${col.dv.len}`]
                        : [col.dv.inline],
                    showDropDown: false,
                    showErrorMessage: true,
                    error: col.dv.err,
                    errorTitle: "Valor inválido",
                    errorStyle: "stop"
                };
            }
        });

        const cellA = linSheet.getCell(`A${row.number}`);
        cellA.border = { ...cellA.border, left: { style: "medium", color: { argb: COLORES.terciario } } };
        row.height = 20;
    });

    linSheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
    await linSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

    return await workbook.xlsx.writeBuffer();
}

module.exports = { generateProtectedExcel, readExcelByColumns, generateSubTicketExcel, generatePrecertExcel, generateManualExcel, generateApprovalManualExcel, generatePurchaseContractExcel, generateMAWizardExcel };