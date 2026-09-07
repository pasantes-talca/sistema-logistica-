from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ============================================================
# RUTAS
# ============================================================

# cambios/pdf.py
# parent       -> cambios
# parent.parent -> backend
BASE_DIR = Path(__file__).resolve().parent.parent

LOGO_PATH = (
    BASE_DIR
    / "static"
    / "img"
    / "logo-talca.png"
)


# ============================================================
# UTILIDADES
# ============================================================

def formatear_numero(valor):
    """
    Muestra números enteros sin decimales.
    Si tiene decimales reales, los conserva.
    """

    if valor is None:
        return ""

    numero = float(valor)

    if numero == 0:
        return ""

    if numero.is_integer():
        return str(int(numero))

    return f"{numero:.2f}"


def texto(valor):
    """
    Convierte None en una cadena vacía.
    """

    if valor is None:
        return ""

    return str(valor)


# ============================================================
# PRODUCTOS FIJOS DE LA PLANTILLA
# ============================================================

PRODUCTOS_PLANTILLA = [
    {
        "tam": "1/5 LT.",
        "codigo": "5051",
        "sabor": "COLA",
    },
    {
        "tam": "",
        "codigo": "5056",
        "sabor": "LIMA",
    },
    {
        "tam": "",
        "codigo": "5066",
        "sabor": "NARANJA",
    },
    {
        "tam": "",
        "codigo": "5071",
        "sabor": "POMELO",
    },

    {
        "tam": "2 1/4 LT",
        "codigo": "5200",
        "sabor": "COLA",
    },
    {
        "tam": "",
        "codigo": "5205",
        "sabor": "LIMA",
    },
    {
        "tam": "",
        "codigo": "5215",
        "sabor": "NARANJA",
    },
    {
        "tam": "",
        "codigo": "5220",
        "sabor": "POMELO",
    },

    {
        "tam": "3 LT",
        "codigo": "5670",
        "sabor": "COLA",
    },
    {
        "tam": "",
        "codigo": "5675",
        "sabor": "LIMA",
    },
    {
        "tam": "",
        "codigo": "5685",
        "sabor": "NARANJA",
    },
    {
        "tam": "",
        "codigo": "5690",
        "sabor": "POMELO",
    },

    {
        "tam": "2 1/4 LT",
        "codigo": "4900",
        "sabor": "SODA",
    },
    {
        "tam": "2 LT",
        "codigo": "4910",
        "sabor": "SIFON",
    },
    {
        "tam": "1/2 LT",
        "codigo": "417",
        "sabor": "SODA",
    },

    {
        "tam": "AGUA 6LT",
        "codigo": "8690",
        "sabor": "BIDON",
    },
    {
        "tam": "AGUA 2LT",
        "codigo": "8670",
        "sabor": "AGUA",
    },
]


# ============================================================
# GENERAR PDF
# ============================================================

def generar_pdf_recibo_cambio(recibo):
    """
    Genera el recibo de cambios en hoja A4 vertical
    siguiendo la estructura de la plantilla histórica.
    """

    buffer = BytesIO()

    documento = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.7 * cm,
        leftMargin=0.7 * cm,
        topMargin=0.6 * cm,
        bottomMargin=0.6 * cm,
    )

    elementos = []


    # ========================================================
    # ESTILOS
    # ========================================================

    estilo_normal = ParagraphStyle(
        "NormalRecibo",
        fontName="Helvetica",
        fontSize=7,
        leading=8,
        alignment=TA_CENTER,
    )

    estilo_negrita = ParagraphStyle(
        "NegritaRecibo",
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8,
        alignment=TA_CENTER,
    )

    estilo_izquierda = ParagraphStyle(
        "IzquierdaRecibo",
        fontName="Helvetica",
        fontSize=7,
        leading=8,
        alignment=TA_LEFT,
    )

    estilo_titulo = ParagraphStyle(
        "TituloRecibo",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=11,
        alignment=TA_CENTER,
    )

    estilo_logo_texto = ParagraphStyle(
        "LogoTexto",
        fontName="Helvetica-BoldOblique",
        fontSize=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#E62620"),
    )

    beige = colors.HexColor("#FFF2CC")
    gris = colors.HexColor("#E7E6E6")
    borde = colors.black


    # ========================================================
    # DETALLES DEL RECIBO POR CÓDIGO
    # ========================================================

    detalles_por_codigo = {}

    for detalle in recibo.detalles.all():

        codigo = str(
            detalle.producto.codigo
        ).strip()

        detalles_por_codigo[codigo] = detalle


    # ========================================================
    # LOGO TALCA
    # ========================================================

    if LOGO_PATH.exists():

        logo = Image(
            str(LOGO_PATH),
            width=2.1 * cm,
            height=0.8 * cm,
        )

    else:

        # Solo como respaldo si por algún motivo
        # falta el archivo del logo.
        logo = Paragraph(
            "talca",
            estilo_logo_texto,
        )


    # ========================================================
    # ENCABEZADO
    # ========================================================

    cabecera = Table(
        [
            [
                Paragraph(
                    (
                        "Rodriguez Peña 2163 - "
                        "Godoy Cruz - Mza - "
                        "Tel. 4316060"
                    ),
                    estilo_negrita,
                ),
                logo,
            ],
        ],
        colWidths=[
            13.5 * cm,
            6.0 * cm,
        ],
        rowHeights=[
            0.9 * cm,
        ],
    )

    cabecera.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.7,
                    borde,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "CENTER",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    3,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    3,
                ),
            ]
        )
    )

    elementos.append(
        cabecera
    )


    # ========================================================
    # FECHA
    # ========================================================

    tabla_fecha = Table(
        [
            [
                "",
                Paragraph(
                    "<b>FECHA:</b>",
                    estilo_negrita,
                ),
                Paragraph(
                    recibo.fecha.strftime(
                        "%d/%m/%Y"
                    ),
                    estilo_normal,
                ),
            ]
        ],
        colWidths=[
            12.5 * cm,
            2.0 * cm,
            5.0 * cm,
        ],
        rowHeights=[
            0.55 * cm,
        ],
    )

    tabla_fecha.setStyle(
        TableStyle(
            [
                (
                    "GRID",
                    (1, 0),
                    (2, 0),
                    0.6,
                    borde,
                ),
                (
                    "BACKGROUND",
                    (2, 0),
                    (2, 0),
                    beige,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    elementos.append(
        tabla_fecha
    )


    # ========================================================
    # TÍTULO
    # ========================================================

    tabla_titulo = Table(
        [
            [
                Paragraph(
                    "NOTA DE PEDIDO",
                    estilo_titulo,
                )
            ]
        ],
        colWidths=[
            19.5 * cm,
        ],
        rowHeights=[
            0.6 * cm,
        ],
    )

    tabla_titulo.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.7,
                    borde,
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    gris,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    elementos.append(
        tabla_titulo
    )


    # ========================================================
    # CONCESIONARIO
    # ========================================================

    tabla_concesionario = Table(
        [
            [
                Paragraph(
                    "<b>Concesionario</b>",
                    estilo_negrita,
                ),
                Paragraph(
                    recibo.concesionario.nombre,
                    estilo_izquierda,
                ),
            ]
        ],
        colWidths=[
            3.5 * cm,
            16.0 * cm,
        ],
        rowHeights=[
            0.55 * cm,
        ],
    )

    tabla_concesionario.setStyle(
        TableStyle(
            [
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.6,
                    borde,
                ),
                (
                    "BACKGROUND",
                    (1, 0),
                    (1, 0),
                    beige,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    elementos.append(
        tabla_concesionario
    )


    # ========================================================
    # TABLA DE PRODUCTOS
    # ========================================================

    filas = [
        [
            Paragraph(
                "<b>TAM</b>",
                estilo_negrita,
            ),
            Paragraph(
                "<b>COD</b>",
                estilo_negrita,
            ),
            Paragraph(
                "<b>SABOR</b>",
                estilo_negrita,
            ),
            Paragraph(
                "<b>DESCARGA<br/>CAMBIOS</b>",
                estilo_negrita,
            ),
            Paragraph(
                "<b>OBSERVACIONES</b>",
                estilo_negrita,
            ),
        ]
    ]

    for item in PRODUCTOS_PLANTILLA:

        detalle = detalles_por_codigo.get(
            item["codigo"]
        )

        cantidad = ""
        observacion = ""

        if detalle:

            cantidad = formatear_numero(
                detalle.cantidad
            )

            observacion = texto(
                detalle.observacion
            )

        filas.append(
            [
                Paragraph(
                    item["tam"],
                    estilo_negrita,
                ),
                Paragraph(
                    item["codigo"],
                    estilo_normal,
                ),
                Paragraph(
                    item["sabor"],
                    estilo_normal,
                ),
                Paragraph(
                    cantidad,
                    estilo_negrita,
                ),
                Paragraph(
                    observacion,
                    estilo_izquierda,
                ),
            ]
        )


    tabla_productos = Table(
        filas,
        colWidths=[
            3.0 * cm,
            3.0 * cm,
            3.0 * cm,
            3.0 * cm,
            7.5 * cm,
        ],
        rowHeights=[
            0.75 * cm,
        ] + [
            0.48 * cm
            for _ in PRODUCTOS_PLANTILLA
        ],
    )


    estilo_productos = [
        (
            "GRID",
            (0, 0),
            (-1, -1),
            0.5,
            borde,
        ),
        (
            "BACKGROUND",
            (0, 0),
            (-1, 0),
            gris,
        ),
        (
            "BACKGROUND",
            (3, 1),
            (3, -1),
            beige,
        ),
        (
            "VALIGN",
            (0, 0),
            (-1, -1),
            "MIDDLE",
        ),
        (
            "ALIGN",
            (0, 0),
            (3, -1),
            "CENTER",
        ),
        (
            "LEFTPADDING",
            (0, 0),
            (-1, -1),
            2,
        ),
        (
            "RIGHTPADDING",
            (0, 0),
            (-1, -1),
            2,
        ),
        (
            "TOPPADDING",
            (0, 0),
            (-1, -1),
            1,
        ),
        (
            "BOTTOMPADDING",
            (0, 0),
            (-1, -1),
            1,
        ),

        # 1/5 LT.
        (
            "SPAN",
            (0, 1),
            (0, 4),
        ),

        # 2 1/4 LT.
        (
            "SPAN",
            (0, 5),
            (0, 8),
        ),

        # 3 LT.
        (
            "SPAN",
            (0, 9),
            (0, 12),
        ),
    ]


    tabla_productos.setStyle(
        TableStyle(
            estilo_productos
        )
    )

    elementos.append(
        tabla_productos
    )


    # ========================================================
    # PALLETS / PRENSADOS
    # ========================================================

    resumen = [
        [
            Paragraph(
                "<b>7060</b>",
                estilo_negrita,
            ),
            Paragraph(
                "<b>Pallets.</b>",
                estilo_negrita,
            ),
            Paragraph(
                formatear_numero(
                    recibo.pallets
                ),
                estilo_negrita,
            ),
            Paragraph(
                recibo.pallets_observacion
                or "",
                estilo_izquierda,
            ),
        ],
        [
            "",
            Paragraph(
                "<b>Pal. Desc.</b>",
                estilo_negrita,
            ),
            Paragraph(
                formatear_numero(
                    recibo.pallets_descargados
                ),
                estilo_negrita,
            ),
            Paragraph(
                recibo
                .pallets_descargados_observacion
                or "",
                estilo_izquierda,
            ),
        ],
        [
            Paragraph(
                "<b>757</b>",
                estilo_negrita,
            ),
            Paragraph(
                "<b>Prensados.</b>",
                estilo_negrita,
            ),
            Paragraph(
                formatear_numero(
                    recibo.prensados
                ),
                estilo_negrita,
            ),
            Paragraph(
                recibo.prensados_observacion
                or "",
                estilo_izquierda,
            ),
        ],
    ]


    tabla_resumen = Table(
        resumen,
        colWidths=[
            3.0 * cm,
            6.0 * cm,
            3.0 * cm,
            7.5 * cm,
        ],
        rowHeights=[
            0.48 * cm,
            0.48 * cm,
            0.48 * cm,
        ],
    )

    tabla_resumen.setStyle(
        TableStyle(
            [
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    borde,
                ),
                (
                    "BACKGROUND",
                    (2, 0),
                    (2, -1),
                    beige,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    elementos.append(
        tabla_resumen
    )

    elementos.append(
        Spacer(
            1,
            0.35 * cm,
        )
    )


    # ========================================================
    # FIRMAS
    # ========================================================

    tabla_firmas = Table(
        [
            [
                Paragraph(
                    "<b>Firma Expedición</b>",
                    estilo_negrita,
                ),
                "",
                Paragraph(
                    "<b>Firma Distribuidor</b>",
                    estilo_negrita,
                ),
            ],
            [
                "",
                "",
                "",
            ],
        ],
        colWidths=[
            8.0 * cm,
            3.5 * cm,
            8.0 * cm,
        ],
        rowHeights=[
            0.5 * cm,
            2.0 * cm,
        ],
    )

    tabla_firmas.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (0, 1),
                    0.6,
                    borde,
                ),
                (
                    "BOX",
                    (2, 0),
                    (2, 1),
                    0.6,
                    borde,
                ),
                (
                    "LINEBELOW",
                    (0, 0),
                    (0, 0),
                    0.5,
                    borde,
                ),
                (
                    "LINEBELOW",
                    (2, 0),
                    (2, 0),
                    0.5,
                    borde,
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (0, 0),
                    gris,
                ),
                (
                    "BACKGROUND",
                    (2, 0),
                    (2, 0),
                    gris,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    elementos.append(
        tabla_firmas
    )


    # ========================================================
    # CONSTRUIR PDF
    # ========================================================

    documento.build(
        elementos
    )

    pdf = buffer.getvalue()

    buffer.close()

    return pdf