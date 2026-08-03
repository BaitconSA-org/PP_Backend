/**
 *
 *   const { generarProvisionesExcel } = require('./generarProvisionesExcel');
 *
 *   const datos = {
 *     solicitante: 'Nombre del Solicitante',
 *     ejercicio: 2026,
 *     periodo: 'FEBRERO',
 *     registros: [
 *       {
 *         gerencia: '',
 *         tipo: 'GASTOS OPEX-CECO',
 *         cuentaCodigo: '52080008',
 *         cuentaDenom: 'SERVICIO DE INFORMATICA',
 *         pozo: '',
 *         etapa: '',
 *         grafoDescripcion: '',
 *         grafoCodigo: '',
 *         grafoOperacion: '',
 *         pepN4: '',
 *         pad: '',
 *         ordenCodigo: '',
 *         ordenDenom: '',
 *         cecoCodigo: 'AVVISASIST',
 *         cecoDenom: 'SISTEMAS',
 *         moneda: 'ARS',
 *         monto: 40000000,
 *         proveedorCodigo: '2000003732',
 *         proveedorDenom: 'Stefanini Argentina SRL',
 *         descripcion: 'Soporte IT',
 *         motivo: 'Proveedor no envío certificación',
 *         mes: 'FEB',
 *         anio: 2026,
 *         descripcionAsiento: 'J6_FEB-2026_Soporte IT',
 *         materialCod: '',
 *         materialDescrip: '',
 *         precio: null,
 *         cantidad: null
 *       },
 *       // ... más registros
 *     ]
 *   };
 *
 *   const buffer = await generarProvisionesExcel(datos, deParaData);
 */

const ExcelJS = require("exceljs");


const COLORES = {
  primario: "FF2E2472", 
  tituloOscuro: "FF1B1A3F", 
  secundario: "FF3D3191", 
  terciario: "FF563EC2",
  claro: "FFC8C3E8", 
  muyClaro: "FFE8E5F5", 
  acento: "FF92D050", 
};


function aplicarEstiloCelda(
  celda,
  colorFondo,
  colorTexto = "FFFFFFFF",
  negrita = true,
  tamanio = 11,
  fuente = "Titillium Web",
) {
  if (colorFondo) {
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colorFondo },
    };
  }

  celda.font = {
    name: fuente,
    color: { argb: colorTexto },
    bold: negrita,
    size: tamanio,
  };

  celda.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };

  celda.border = {
    top: { style: "thin", color: { argb: "FFBFBFBF" } },
    left: { style: "thin", color: { argb: "FFBFBFBF" } },
    bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
    right: { style: "thin", color: { argb: "FFBFBFBF" } },
  };
}

async function generarProvisionesExcel(datos) {
  const workbook = new ExcelJS.Workbook();

  const sheetTemplate = workbook.addWorksheet("_TEMPLATE_INTEGRADO");
  crearHojaTemplate(sheetTemplate, datos);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}


function crearHojaTemplate(sheet, datos) {
  const celdaTitulo = sheet.getCell("B1");
  celdaTitulo.value = "SOLICITUD DE PROVISIÓN";
  sheet.mergeCells("B1:AC1");
  aplicarEstiloCelda(
    celdaTitulo,
    COLORES.tituloOscuro,
    "FFC9A96E",
    true,
    14,
    "Titillium Web Light",
  );
  celdaTitulo.alignment = { vertical: "middle", horizontal: "left", wrapText: false }
  sheet.getCell("B2").value = "SOLICITANTE:";
  aplicarEstiloCelda(
    sheet.getCell("B2"),
    COLORES.muyClaro,
    "FF000000",
    true,
    10,
    "Titillium Web Light",
  );
  sheet.getCell("B2").alignment = { vertical: "middle", horizontal: "left", wrapText: false }
  sheet.getCell("C2").value = datos.solicitante;
  aplicarEstiloCelda(
    sheet.getCell("C2"),
    COLORES.muyClaro,
    "FF000000",
    false,
    10,
    "Titillium Web Light",
  );
  
  sheet.getCell("B3").value = "EJERCICIO";
  aplicarEstiloCelda(
    sheet.getCell("B3"),
    COLORES.muyClaro,
    "FF000000",
    true,
    10,
    "Titillium Web Light",
  );
  sheet.getCell("B3").alignment = { vertical: "middle", horizontal: "left", wrapText: false }
  sheet.getCell("C3").value = datos.ejercicio;
  aplicarEstiloCelda(
    sheet.getCell("C3"),
    COLORES.muyClaro,
    "FF000000",
    false,
    10,
    "Titillium Web Light",
  );
  
  sheet.getCell("B4").value = "PERIODO:";
  aplicarEstiloCelda(
    sheet.getCell("B4"),
    COLORES.muyClaro,
    "FF000000",
    true,
    10,
    "Titillium Web Light",
  );
  sheet.getCell("B4").alignment = { vertical: "middle", horizontal: "left", wrapText: false }
  sheet.getCell("C4").value = datos.periodo;
  aplicarEstiloCelda(
    sheet.getCell("C4"),
    COLORES.muyClaro,
    "FF000000",
    false,
    10,
    "Titillium Web Light",
  );


  sheet.getCell("B6").value = "CLASIFICACIÓN";
  aplicarEstiloCelda(
    sheet.getCell("B6"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    14,
    "Titillium Web",
  );
 sheet.mergeCells("B6:B7");
  sheet.getCell("B6").value = "CLASIFICACIÓN";
  aplicarEstiloCelda(
    sheet.getCell("B6"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    14,
    "Titillium Web",
  );

  sheet.mergeCells("C6:D6");
  sheet.getCell("C6").value = "Obligatorio CAPEX y OPEX";
  aplicarEstiloCelda(
    sheet.getCell("C6"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    14,
    "Titillium Web",
  );
  sheet.mergeCells("C7:D7");
  sheet.getCell("C7").value = "CUENTA CONTABLE";
  aplicarEstiloCelda(
    sheet.getCell("C7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.mergeCells("E6:K6");
  sheet.getCell("E6").value = "IMPUTACIÓN A CAPEX";
  aplicarEstiloCelda(
    sheet.getCell("E6"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    14,
    "Titillium Web",
  );
  sheet.mergeCells("E7:K7");
  sheet.getCell("E7").value = "GRAFOS (Capex PS)";
  aplicarEstiloCelda(
    sheet.getCell("E7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.mergeCells("L6:M6");
  sheet.getCell("L6").value = "Opcional CAPEX / OPEX";
  aplicarEstiloCelda(
    sheet.getCell("L6"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    14,
    "Titillium Web",
  );
  sheet.mergeCells("L7:M7");
  sheet.getCell("L7").value = "ORDEN INTERNA";
  aplicarEstiloCelda(
    sheet.getCell("L7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.mergeCells("N6:O6");
  sheet.getCell("N6").value = "IMPUTACIÓN A OPEX";
  aplicarEstiloCelda(
    sheet.getCell("N6"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    14,
    "Titillium Web",
  );
  sheet.mergeCells("N7:O7");
  sheet.getCell("N7").value = "CENTRO DE COSTO";
  aplicarEstiloCelda(
    sheet.getCell("N7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.mergeCells("P6:X6");
  sheet.getCell("P6").value = "DETALLES COMPLEMENTARIOS";
  aplicarEstiloCelda(
    sheet.getCell("P6"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    14,
    "Titillium Web",
  );

  sheet.mergeCells("P7:Q7");
  sheet.getCell("P7").value = "IMPORTE";
  aplicarEstiloCelda(
    sheet.getCell("P7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.mergeCells("R7:S7");
  sheet.getCell("R7").value = "PROVEEDOR";
  aplicarEstiloCelda(
    sheet.getCell("R7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.getCell("T7").value = "DESCRIPCIÓN";
  aplicarEstiloCelda(
    sheet.getCell("T7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.getCell("U7").value = "MOTIVO";
  aplicarEstiloCelda(
    sheet.getCell("U7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.mergeCells("V7:W7");
  sheet.getCell("V7").value = "PERIODO";
  aplicarEstiloCelda(
    sheet.getCell("V7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.getCell("X7").value = "DESCRIPCIÓN";
  aplicarEstiloCelda(
    sheet.getCell("X7"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    12,
    "Titillium Web",
  );

  sheet.mergeCells("Y6:AC7");
  sheet.getCell("Y6").value = "MATERIALES";
  aplicarEstiloCelda(
    sheet.getCell("Y6"),
    COLORES.primario,
    "FFFFFFFF",
    true,
    14,
    "Titillium Web",
  );

  const columnNames = [
    "GERENCIA",
    "TIPO",
    "Código",
    "Denominación",
    "Pozo",
    "Etapa",
    "Descripción GRAFO",
    "Código GRAFO",
    "Operación",
    "PEP N4",
    "PAD",
    "Código CAPEX/OPEX",
    "Denominación CAPEX/OPEX",
    "Código CeCo",
    "Denominación CeCo",
    "Moneda",
    "Monto",
    "Código Proveedor",
    "Denominación Proveedor",
    "Detalle servicio/material a provisionar",
    "Se provisiona porque",
    "MES",
    "AÑO",
    "Descripción final asiento contable",
    "Cod",
    "Descrip",
    "Precio",
    "Cantidad",
    "PxQ",
  ];

  const filasDatos = datos.registros.map((reg) => [
    reg.gerencia || "",
    reg.tipo || "",
    reg.cuentaCodigo || "",
    reg.cuentaDenom || "",
    reg.pozo || "",
    reg.etapa || "",
    reg.grafoDescripcion || "",
    reg.grafoCodigo || "",
    reg.grafoOperacion || "",
    reg.pepN4 || "",
    reg.pad || "",
    reg.ordenCodigo || "",
    reg.ordenDenom || "",
    reg.cecoCodigo || "",
    reg.cecoDenom || "",
    reg.moneda || "",
    reg.monto || 0,
    reg.proveedorCodigo || "",
    reg.proveedorDenom || "",
    reg.descripcion || "",
    reg.motivo || "",
    reg.mes || "",
    reg.anio || "",
    reg.descripcionAsiento || "",
    reg.materialCod || "",
    reg.materialDescrip || "",
    reg.precio || 0,
    reg.cantidad || 0,
    reg.precio != null && reg.cantidad != null ? reg.precio * reg.cantidad : 0,
  ]);

  // --- AUTO-ANCHO: calcular largo máximo por columna ---
  // Factor ~1.15 para compensar el ancho de caracter en Excel
  const FACTOR = 1.15;
  const MIN_WIDTH = 8;
  const MAX_WIDTH = 45;

  const colWidths = columnNames.map((name) => name.length);

  filasDatos.forEach((fila) => {
    fila.forEach((val, i) => {
      const len = val != null ? String(val).length : 0;
      if (len > colWidths[i]) colWidths[i] = len;
    });
  });

  sheet.addTable({
    name: "TablaProvisiones",
    ref: "A8",
    headerRow: true,
    totalsRow: false,
    style: { theme: null, showRowStripes: true },
    columns: columnNames.map((name) => ({
      name: name + " ",
      filterButton: true,
    })),
    rows: filasDatos,
  });

  const headerRow = sheet.getRow(8);
  headerRow.eachCell((celda, colNumber) => {
    if (colNumber >= 1 && colNumber <= 29) {
      aplicarEstiloCelda(
        celda,
        COLORES.primario,
        "FFFFFFFF",
        false,
        10,
        "Titillium Web",
      );
    }
  });

  sheet.columns.forEach((col, i) => {
    if (i < 29) {
      col.width = Math.min(
        Math.max(Math.ceil(colWidths[i] * FACTOR) + 2, MIN_WIDTH),
        MAX_WIDTH,
      );
    }
  });

  sheet.views = [{ state: "frozen", ySplit: 8 }];

  const colorRosaPalido = COLORES.muyClaro;
  const columnasRosaNums = [4, 8, 10, 11, 13, 15, 19, 24, 29];
  const ultimaFila = 8 + datos.registros.length + 5;

  for (let r = 9; r <= ultimaFila; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 29; c++) {
      const celda = row.getCell(c);
      celda.font = {
        name: "Titillium Web Light",
        size: 10,
        color: { argb: "FF000000" },
        bold: false,
      };
      if (columnasRosaNums.includes(c)) {
        celda.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colorRosaPalido },
        };
      }
    }
  }
}


module.exports = {
  generarProvisionesExcel,
};


/*
const { generarProvisionesExcel } = require('./generarProvisionesExcel');

// Datos de provisiones a generar
const datos = {
  solicitante: 'Nahir Chalup',
  ejercicio: 2026,
  periodo: 'FEBRERO',
  registros: [
    {
      gerencia: '',
      tipo: 'GASTOS OPEX-CECO',
      cuentaCodigo: '52080008',
      cuentaDenom: 'SERVICIO DE INFORMATICA',
      pozo: '',
      etapa: '',
      grafoDescripcion: '',
      grafoCodigo: '',
      grafoOperacion: '',
      pepN4: '',
      pad: '',
      ordenCodigo: '',
      ordenDenom: '',
      cecoCodigo: 'AVVISASIST',
      cecoDenom: 'SISTEMAS',
      moneda: 'ARS',
      monto: 40000000,
      proveedorCodigo: '2000003732',
      proveedorDenom: 'Stefanini Argentina SRL',
      descripcion: 'Soporte IT',
      motivo: 'Proveedor no envío certificación',
      mes: 'FEB',
      anio: 2026,
      descripcionAsiento: 'J6_FEB-2026_Soporte IT',
      materialCod: '',
      materialDescrip: '',
      precio: null,
      cantidad: null
    }
  ]
};

*/
