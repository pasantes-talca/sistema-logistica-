from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Max, Sum
from django.utils.dateparse import parse_date

from .models import (
    RepartoERP,
    ParadaRepartoERP,
    DocumentoRepartoERP,
    DetalleDocumentoRepartoERP,
)

from .origen_sqlserver import (
    obtener_repartos,
    obtener_facturas,
    obtener_pedidos,
    obtener_remitos,
    obtener_detalle_factura,
)


# ============================================================
# UTILIDADES
# ============================================================

def texto(valor):
    """
    Convierte un valor a texto limpio.
    """

    if valor is None:
        return ""

    return str(valor).strip()


def entero(valor):
    """
    Convierte un valor a entero.
    """

    if valor is None:
        return None

    try:
        return int(valor)

    except (TypeError, ValueError):
        return None


def decimal(valor):
    """
    Convierte valores numéricos provenientes
    de SQL Server a Decimal.
    """

    if valor in (None, ""):
        return None

    try:
        return Decimal(
            str(valor)
        )

    except (
        InvalidOperation,
        TypeError,
        ValueError,
    ):
        return None


def fecha(valor):
    """
    Convierte fechas provenientes de SQL Server.

    Formatos contemplados:

        DD/MM/YYYY
        YYYY-MM-DD

    También admite datetime/date.
    """

    if not valor:
        return None

    if isinstance(
        valor,
        datetime,
    ):
        return valor.date()

    if (
        hasattr(valor, "year")
        and hasattr(valor, "month")
        and hasattr(valor, "day")
        and not isinstance(valor, str)
    ):
        return valor

    valor = texto(
        valor
    )

    # ----------------------------------------
    # Formato YYYY-MM-DD
    # ----------------------------------------

    resultado = parse_date(
        valor
    )

    if resultado:
        return resultado

    # ----------------------------------------
    # Formato DD/MM/YYYY
    # ----------------------------------------

    try:

        return datetime.strptime(
            valor,
            "%d/%m/%Y"
        ).date()

    except ValueError:
        return None


# ============================================================
# PARADAS / CLIENTES
# ============================================================

def obtener_o_crear_parada(
    reparto,
    cliente,
    codigo_cliente="",
):
    """
    Obtiene o crea una parada correspondiente
    a un cliente dentro de un reparto.

    IMPORTANTE:
    Todas las operaciones de escritura de esta
    función se realizan sobre PostgreSQL.

    SQL Server no se modifica.
    """

    cliente = texto(
        cliente
    )

    codigo_cliente = texto(
        codigo_cliente
    )

    parada = (
        ParadaRepartoERP.objects
        .filter(
            reparto=reparto,
            **({"codigo_cliente": codigo_cliente} if codigo_cliente else {"cliente": cliente}),
        )
        .first()
    )

    # Recuperar paradas de la primera versión (no persistía CodigoCliente),
    # sin crear otra parada ni duplicar el saldo de las mismas facturas.
    if not parada and codigo_cliente:
        anteriores = list(ParadaRepartoERP.objects.filter(reparto=reparto, cliente=cliente, codigo_cliente="")[:2])
        if len(anteriores) == 1:
            parada = anteriores[0]
        elif len(anteriores) > 1:
            raise ValueError("Hay paradas antiguas ambiguas para este cliente. Requieren revisión manual.")

    if parada:

        if codigo_cliente and not parada.codigo_cliente:
            parada.codigo_cliente = codigo_cliente
        if codigo_cliente:
            parada.cliente = cliente
        parada.save(update_fields=["codigo_cliente", "cliente", "actualizado_en"])

        return parada

    orden = (
        ParadaRepartoERP.objects
        .filter(
            reparto=reparto
        )
        .aggregate(ultimo=Max("orden"))["ultimo"] or 0
    ) + 1

    return (
        ParadaRepartoERP.objects
        .create(
            reparto=reparto,
            cliente=cliente,
            codigo_cliente=codigo_cliente,
            orden=orden,
        )
    )


# ============================================================
# FACTURAS
# ============================================================

def sincronizar_facturas(
    reparto,
    cod_reparto,
):
    """
    Lee facturas desde SQL Server
    y las guarda/actualiza en PostgreSQL.

    SQL Server:
        SOLO SELECT.

    PostgreSQL:
        INSERT / UPDATE mediante Django ORM.
    """

    creados = 0
    actualizados = 0
    detalles_creados = 0
    detalles_actualizados = 0

    facturas = obtener_facturas(
        cod_reparto
    )

    for factura in facturas:

        cod_factura = entero(
            factura.get(
                "codfactura"
            )
        )

        if cod_factura is None:
            continue

        cliente = texto(
            factura.get(
                "cliente"
            )
        )

        detalles = obtener_detalle_factura(cod_factura)
        codigo_cliente = next((texto(d.get("CodigoCliente")) for d in detalles if texto(d.get("CodigoCliente"))), "")
        cliente = next((texto(d.get("RazonSocial")) for d in detalles if texto(d.get("RazonSocial"))), cliente)
        anterior = DocumentoRepartoERP.objects.filter(tipo="FACTURA", origen_id=cod_factura).first()
        if anterior and anterior.reparto_id != reparto.id:
            raise ValueError("La factura ya está importada en otro reparto. Requiere revisión antes de moverla.")
        if anterior and anterior.parada_id:
            previa = anterior.parada
            if codigo_cliente and previa.codigo_cliente and previa.codigo_cliente != codigo_cliente:
                raise ValueError("Cambió el cliente de una factura importada. Requiere revisión antes de reasignar su saldo.")
            if codigo_cliente and not previa.codigo_cliente:
                # El vínculo documental, no una coincidencia aproximada de nombre,
                # permite completar el código faltante en registros antiguos.
                previa.codigo_cliente = codigo_cliente
                previa.cliente = cliente
                previa.save(update_fields=["codigo_cliente", "cliente", "actualizado_en"])

        parada = obtener_o_crear_parada(
            reparto=reparto,
            cliente=cliente,
            codigo_cliente=codigo_cliente,
        )

        documento, creado = (
            DocumentoRepartoERP.objects
            .update_or_create(
                tipo=(
                    DocumentoRepartoERP
                    .Tipo
                    .FACTURA
                ),
                origen_id=cod_factura,
                defaults={
                    "reparto":
                        reparto,

                    "parada":
                        parada,

                    "tipo_comprobante":
                        texto(
                            factura.get(
                                "TipoCompr"
                            )
                        ),

                    "nro_comprobante":
                        texto(
                            factura.get(
                                "nrocomprobante"
                            )
                        ),

                    "fecha_comprobante":
                        fecha(
                            factura.get(
                                "fechacomprobante"
                            )
                        ),

                    "cliente":
                        cliente,

                    "neto":
                        decimal(
                            factura.get(
                                "Neto"
                            )
                        ),

                    "monto":
                        decimal(
                            factura.get(
                                "monto"
                            )
                        ),

                    "estado":
                        entero(
                            factura.get(
                                "estado"
                            )
                        ),

                    "cobrado":
                        decimal(
                            factura.get(
                                "cobrado"
                            )
                        ),

                    "condicion_venta":
                        entero(
                            factura.get(
                                "codcondicionVenta"
                            )
                        ),
                }
            )
        )

        if creado:
            creados += 1
        else:
            actualizados += 1

        # ----------------------------------------
        # DETALLE DE LA FACTURA / PRODUCTOS
        # ----------------------------------------

        for detalle in detalles:

            origen_id = entero(
                detalle.get(
                    "codfacturadetalle"
                )
            )

            if origen_id is None:
                continue

            _, detalle_creado = (
                DetalleDocumentoRepartoERP.objects
                .update_or_create(
                    origen_id=origen_id,
                    defaults={
                        "documento":
                            documento,

                        "codigo":
                            texto(
                                detalle.get(
                                    "Codigo"
                                )
                            ),

                        "descripcion":
                            texto(
                                detalle.get(
                                    "descripcion"
                                )
                            ),

                        "cod_articulo":
                            entero(
                                detalle.get(
                                    "codarticulo"
                                )
                            ),

                        "cantidad":
                            decimal(
                                detalle.get(
                                    "cantidad"
                                )
                            ),

                        "cantidad_bultos":
                            decimal(
                                detalle.get(
                                    "cantBultos"
                                )
                            ),

                        "cantidad_unidades":
                            decimal(
                                detalle.get(
                                    "cantUnid"
                                )
                            ),

                        "bultos_dev":
                            decimal(
                                detalle.get(
                                    "cantBultosDev"
                                )
                            ),

                        "unidades_dev":
                            decimal(
                                detalle.get(
                                    "cantUnidDev"
                                )
                            ),

                        "precio":
                            decimal(
                                detalle.get(
                                    "precio"
                                )
                            ),

                        "rubro":
                            texto(
                                detalle.get(
                                    "rubro"
                                )
                            ),

                        "familia":
                            texto(
                                detalle.get(
                                    "flia"
                                )
                            ),
                    }
                )
            )

            if detalle_creado:
                detalles_creados += 1
            else:
                detalles_actualizados += 1

    return {
        "facturas_creadas":
            creados,

        "facturas_actualizadas":
            actualizados,

        "detalles_creados":
            detalles_creados,

        "detalles_actualizados":
            detalles_actualizados,
    }


# ============================================================
# PEDIDOS
# ============================================================

def sincronizar_pedidos(
    reparto,
    cod_reparto,
):
    """
    Lee pedidos desde SQL Server
    y los almacena en PostgreSQL.
    """

    creados = 0
    actualizados = 0

    pedidos = obtener_pedidos(
        cod_reparto
    )

    for pedido in pedidos:

        cod_pedido = entero(
            pedido.get(
                "codpedido"
            )
        )

        if cod_pedido is None:
            continue

        cliente = texto(
            pedido.get(
                "cliente"
            )
        )

        parada = obtener_o_crear_parada(
            reparto=reparto,
            cliente=cliente,
        )

        _, creado = (
            DocumentoRepartoERP.objects
            .update_or_create(
                tipo=(
                    DocumentoRepartoERP
                    .Tipo
                    .PEDIDO
                ),
                origen_id=cod_pedido,
                defaults={
                    "reparto":
                        reparto,

                    "parada":
                        parada,

                    "tipo_comprobante":
                        texto(
                            pedido.get(
                                "TipoCompr"
                            )
                        ),

                    "nro_comprobante":
                        texto(
                            pedido.get(
                                "nrocomprobante"
                            )
                        ),

                    "fecha_comprobante":
                        fecha(
                            pedido.get(
                                "fechacomprobante"
                            )
                        ),

                    "cliente":
                        cliente,

                    "neto":
                        decimal(
                            pedido.get(
                                "Neto"
                            )
                        ),

                    "monto":
                        decimal(
                            pedido.get(
                                "monto"
                            )
                        ),

                    "estado":
                        entero(
                            pedido.get(
                                "estado"
                            )
                        ),

                    "cobrado":
                        decimal(
                            pedido.get(
                                "cobrado"
                            )
                        ),

                    "condicion_venta":
                        entero(
                            pedido.get(
                                "codcondicionVenta"
                            )
                        ),
                }
            )
        )

        if creado:
            creados += 1
        else:
            actualizados += 1

    return {
        "pedidos_creados":
            creados,

        "pedidos_actualizados":
            actualizados,
    }


# ============================================================
# REMITOS
# ============================================================

def sincronizar_remitos(
    reparto,
    cod_reparto,
):
    """
    Lee remitos desde SQL Server
    y los almacena en PostgreSQL.

    NOTA:
    La vista v_RepartoRemitos puede depender
    internamente de funciones de SQL Server.

    Si el usuario de solo lectura no tiene permiso
    sobre alguna de esas funciones, el error se
    captura más adelante y NO se pierde el resto
    del reparto.
    """

    creados = 0
    actualizados = 0

    remitos = obtener_remitos(
        cod_reparto
    )

    for remito in remitos:

        cod_remito = entero(
            remito.get(
                "codremito"
            )
        )

        if cod_remito is None:
            continue

        cliente = texto(
            remito.get(
                "cliente"
            )
        )

        parada = obtener_o_crear_parada(
            reparto=reparto,
            cliente=cliente,
        )

        _, creado = (
            DocumentoRepartoERP.objects
            .update_or_create(
                tipo=(
                    DocumentoRepartoERP
                    .Tipo
                    .REMITO
                ),
                origen_id=cod_remito,
                defaults={
                    "reparto":
                        reparto,

                    "parada":
                        parada,

                    "tipo_comprobante":
                        texto(
                            remito.get(
                                "TipoCompr"
                            )
                        ),

                    "nro_comprobante":
                        texto(
                            remito.get(
                                "nrocomprobante"
                            )
                        ),

                    "fecha_comprobante":
                        fecha(
                            remito.get(
                                "fechacomprobante"
                            )
                        ),

                    "cliente":
                        cliente,

                    "estado":
                        entero(
                            remito.get(
                                "estado"
                            )
                        ),

                    "cobrado":
                        decimal(
                            remito.get(
                                "cobrado"
                            )
                        ),
                }
            )
        )

        if creado:
            creados += 1
        else:
            actualizados += 1

    return {
        "remitos_creados":
            creados,

        "remitos_actualizados":
            actualizados,
    }


# ============================================================
# SINCRONIZAR UN REPARTO
# ============================================================

@transaction.atomic
def sincronizar_reparto(
    datos_reparto,
):
    """
    Copia un reparto desde SQL Server hacia PostgreSQL.

    REGLA FUNDAMENTAL:

    SQL SERVER:
        SOLO LECTURA.
        Únicamente SELECT.

    POSTGRESQL:
        Aquí se crean y actualizan los registros
        operativos del sistema TALCA.
    """

    cod_reparto = entero(
        datos_reparto.get(
            "codReparto"
        )
    )

    if cod_reparto is None:

        raise ValueError(
            "El reparto no tiene codReparto."
        )

    # ========================================================
    # CABECERA
    # ========================================================

    # Tanto las importaciones web como el comando respetan el bloqueo de operación.
    RepartoERP.objects.select_for_update().filter(cod_reparto=cod_reparto).first()
    reparto, creado = (
        RepartoERP.objects
        .update_or_create(
            cod_reparto=cod_reparto,
            defaults={
                "cod_jerarquia": entero(datos_reparto.get("codjerarquia")),
                "nro_comprobante":
                    texto(
                        datos_reparto.get(
                            "nrocomprobante"
                        )
                    ),

                "fecha_comprobante":
                    fecha(
                        datos_reparto.get(
                            "fechacomprobante"
                        )
                    ),

                "fecha_salida":
                    fecha(
                        datos_reparto.get(
                            "fechaSalida"
                        )
                    ),

                "almacen":
                    texto(
                        datos_reparto.get(
                            "almacen"
                        )
                    ),

                "ruta":
                    texto(
                        datos_reparto.get(
                            "ruta"
                        )
                    ),

                "transporte":
                    texto(
                        datos_reparto.get(
                            "transporte"
                        )
                    ),

                "chofer":
                    texto(
                        datos_reparto.get(
                            "chofer"
                        )
                    ),

                "camion":
                    texto(
                        datos_reparto.get(
                            "camion"
                        )
                    ),

                "estado":
                    entero(
                        datos_reparto.get(
                            "estado"
                        )
                    ),

                "observaciones":
                    texto(
                        datos_reparto.get(
                            "observaciones"
                        )
                    ),

                "hora_salida":
                    texto(
                        datos_reparto.get(
                            "horaSalida"
                        )
                    ),

                "monto_total":
                    decimal(
                        datos_reparto.get(
                            "montoTotal"
                        )
                    ),

                "cod_usuario":
                    texto(
                        datos_reparto.get(
                            "codusuario"
                        )
                    ),

                "cod_proveedor":
                    entero(
                        datos_reparto.get(
                            "codproveedor"
                        )
                    ),

                "cod_liquidacion":
                    entero(
                        datos_reparto.get(
                            "codliquidacion"
                        )
                    ),
            }
        )
    )

    # ========================================================
    # FACTURAS + PRODUCTOS
    # ========================================================

    facturas = sincronizar_facturas(
        reparto,
        cod_reparto,
    )

    # ========================================================
    # PEDIDOS
    # ========================================================

    pedidos = sincronizar_pedidos(
        reparto,
        cod_reparto,
    )

    # ========================================================
    # REMITOS
    # ========================================================
    #
    # Esta consulta puede fallar si el usuario SQL Server
    # no tiene permiso EXECUTE sobre alguna función interna
    # utilizada por la vista v_RepartoRemitos.
    #
    # Ese problema NO debe impedir guardar:
    #   - reparto
    #   - facturas
    #   - productos
    #   - pedidos
    #
    # Por eso Remitos es tratado como una fuente opcional.
    # ========================================================

    try:

        with transaction.atomic():
            remitos = sincronizar_remitos(reparto, cod_reparto)

    except Exception as exc:

        remitos = {
            "remitos_creados":
                0,

            "remitos_actualizados":
                0,

            "remitos_error":
                str(exc),
        }

    # ========================================================
    # Inicializar una única vez; una nueva sincronización nunca pisa el saldo operativo.
    for parada in reparto.paradas.all():
        referencia = parada.documentos.filter(tipo="FACTURA").aggregate(total=Sum("monto"))["total"] or Decimal("0")
        parada.importe_referencia = referencia
        if not parada.saldo_inicializado:
            parada.importe_a_cobrar = referencia
            parada.saldo_inicializado = True
        parada.save(update_fields=["importe_referencia", "importe_a_cobrar", "saldo_inicializado"])
    reparto.version_operativa += 1
    reparto.save(update_fields=["version_operativa"])

    # RESULTADO
    # ========================================================

    return {
        "cod_reparto":
            cod_reparto,

        "reparto_creado":
            creado,

        **facturas,

        **pedidos,

        **remitos,
    }


# ============================================================
# SINCRONIZACIÓN POR FECHA
# ============================================================

def sincronizar_repartos_fecha(
    fecha_repartos,
):
    """
    Sincroniza todos los repartos correspondientes
    a una fecha determinada.

    Formato esperado:

        DD/MM/YYYY

    Ejemplo:

        25/11/2026

    SQL Server:
        únicamente se consulta.

    PostgreSQL:
        recibe la información sincronizada.
    """

    repartos = obtener_repartos(
        fecha_repartos
    )

    resultados = []
    errores = []

    for datos_reparto in repartos:

        try:

            resultado = sincronizar_reparto(
                datos_reparto
            )

            resultados.append(
                resultado
            )

        except Exception as exc:

            errores.append({
                "cod_reparto":
                    datos_reparto.get(
                        "codReparto"
                    ),

                "error":
                    str(exc),
            })

    return {
        "fecha":
            fecha_repartos,

        "repartos_en_sqlserver":
            len(repartos),

        "sincronizados":
            len(resultados),

        "errores":
            errores,

        "resultados":
            resultados,
    }
