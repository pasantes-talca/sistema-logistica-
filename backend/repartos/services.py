from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Reparto, RepartoPersonal


PUESTO_CHOFER = "Chofer 1ra. Categoria"

PUESTOS_AYUDANTE_VALIDOS = {
    "Ayudante",
    "Operario Especializado",
    "Chofer 1ra. Categoria",
}


def calcular_recargas(
    *,
    bultos,
    cantidad_ayudantes,
    hay_chofer=True
):
    """
    Reproduce la regla de negocio de Recargas 2026.

    Reglas:
    1. Hasta 480 bultos no hay recarga por exceso.
    2. Por encima de 480 se calcula el exceso sobre bloques de 480.
    3. Una fracción >= 40% del bloque (192 bultos) suma una recarga.
    4. Si hay 483 bultos o más y todavía dio 0, se asigna mínimo 1.
    5. Si hay exactamente un ayudante, se suma 1 recarga.
    6. Recargas totales = recargas por persona × cantidad de personas.
    """

    try:
        bultos = int(bultos)
    except (TypeError, ValueError):
        raise ValidationError("La cantidad de bultos debe ser un número entero.")

    try:
        cantidad_ayudantes = int(cantidad_ayudantes)
    except (TypeError, ValueError):
        raise ValidationError("La cantidad de ayudantes es inválida.")

    if bultos < 0:
        raise ValidationError("Los bultos no pueden ser negativos.")

    if cantidad_ayudantes < 0:
        raise ValidationError(
            "La cantidad de ayudantes no puede ser negativa."
        )

    recargas = 0

    # ---------------------------------------------------------
    # EXCESO SOBRE LOS 480 BULTOS
    # ---------------------------------------------------------

    if bultos > 480:
        exceso = bultos - 480

        # Cada bloque completo de 480 suma una recarga.
        bloques_completos = exceso // 480

        # Resto que no completa otro bloque.
        resto = exceso % 480

        recargas = bloques_completos

        # 40% de 480 = 192.
        if resto >= 192:
            recargas += 1

    # ---------------------------------------------------------
    # REGLA ESPECIAL: DESDE 483, MÍNIMO UNA RECARGA
    # ---------------------------------------------------------

    if bultos >= 483 and recargas == 0:
        recargas += 1

    # ---------------------------------------------------------
    # EXACTAMENTE UN AYUDANTE = +1 RECARGA
    # ---------------------------------------------------------

    if cantidad_ayudantes == 1:
        recargas += 1

    # ---------------------------------------------------------
    # TOTAL DE PERSONAS Y RECARGAS TOTALES
    # ---------------------------------------------------------

    cantidad_personas = (
        (1 if hay_chofer else 0)
        + cantidad_ayudantes
    )

    recargas_totales = (
        recargas * cantidad_personas
        if cantidad_personas > 0
        else 0
    )

    return {
        "recargas": recargas,
        "cantidad_personas": cantidad_personas,
        "recargas_totales": recargas_totales,
    }


def validar_personal_reparto(*, chofer, ayudantes):
    """
    Aplica las mismas restricciones de selección
    utilizadas actualmente en Recargas 2026.
    """

    if chofer is None:
        raise ValidationError("El reparto debe tener un chofer.")

    ayudantes = list(ayudantes or [])

    # ---------------------------------------------------------
    # VALIDAR CHOFER
    # ---------------------------------------------------------

    if not chofer.activo:
        raise ValidationError(
            f"{chofer.nombre} se encuentra inactivo."
        )

    if not chofer.disponible:
        raise ValidationError(
            f"{chofer.nombre} no se encuentra disponible."
        )

    if chofer.puesto != PUESTO_CHOFER:
        raise ValidationError(
            f"{chofer.nombre} no tiene categoría de chofer."
        )

    # ---------------------------------------------------------
    # EVITAR PERSONAS DUPLICADAS
    # ---------------------------------------------------------

    ayudantes_ids = [
        ayudante.id
        for ayudante in ayudantes
    ]

    if chofer.id in ayudantes_ids:
        raise ValidationError(
            "El chofer no puede aparecer también como ayudante."
        )

    if len(ayudantes_ids) != len(set(ayudantes_ids)):
        raise ValidationError(
            "No se puede repetir un ayudante en el mismo reparto."
        )

    # ---------------------------------------------------------
    # VALIDAR AYUDANTES
    # ---------------------------------------------------------

    for ayudante in ayudantes:

        if not ayudante.activo:
            raise ValidationError(
                f"{ayudante.nombre} se encuentra inactivo."
            )

        if not ayudante.disponible:
            raise ValidationError(
                f"{ayudante.nombre} no se encuentra disponible."
            )

        if ayudante.puesto not in PUESTOS_AYUDANTE_VALIDOS:
            raise ValidationError(
                f"{ayudante.nombre} no puede participar "
                "como ayudante."
            )


@transaction.atomic
def crear_reparto(
    *,
    fecha,
    bultos,
    chofer,
    ayudantes=None,
    vehiculo=None,
    asignacion=None,
    puntos_venta="",
    observaciones="",
    creado_por=None,
):
    """
    Crea un reparto completo:

    - valida el personal;
    - calcula las recargas;
    - crea el reparto;
    - agrega el chofer;
    - agrega todos los ayudantes.

    Todo se ejecuta dentro de una transacción.
    Si algo falla, no se guarda un reparto incompleto.
    """

    ayudantes = list(ayudantes or [])

    validar_personal_reparto(
        chofer=chofer,
        ayudantes=ayudantes,
    )

    calculo = calcular_recargas(
        bultos=bultos,
        cantidad_ayudantes=len(ayudantes),
        hay_chofer=True,
    )

    reparto = Reparto.objects.create(
        fecha=fecha,
        vehiculo=vehiculo,
        asignacion=asignacion,
        bultos=int(bultos),
        puntos_venta=str(puntos_venta or "").strip(),
        recargas=calculo["recargas"],
        observaciones=str(observaciones or "").strip(),
        creado_por=creado_por,
    )

    # ---------------------------------------------------------
    # CHOFER
    # ---------------------------------------------------------

    RepartoPersonal.objects.create(
        reparto=reparto,
        empleado=chofer,
        rol=RepartoPersonal.Rol.CHOFER,
        orden=0,
    )

    # ---------------------------------------------------------
    # AYUDANTES
    # ---------------------------------------------------------

    RepartoPersonal.objects.bulk_create(
        [
            RepartoPersonal(
                reparto=reparto,
                empleado=ayudante,
                rol=RepartoPersonal.Rol.AYUDANTE,
                orden=indice,
            )
            for indice, ayudante in enumerate(
                ayudantes,
                start=1
            )
        ]
    )


@transaction.atomic
def actualizar_reparto(
    *,
    reparto,
    fecha,
    bultos,
    chofer,
    ayudantes=None,
    vehiculo=None,
    asignacion=None,
    puntos_venta="",
    observaciones="",
):
    """
    Actualiza un reparto existente.

    Vuelve a:
    - validar el personal;
    - calcular las recargas;
    - actualizar los datos del reparto;
    - reconstruir chofer y ayudantes.
    """

    ayudantes = list(ayudantes or [])

    validar_personal_reparto(
        chofer=chofer,
        ayudantes=ayudantes,
    )

    calculo = calcular_recargas(
        bultos=bultos,
        cantidad_ayudantes=len(ayudantes),
        hay_chofer=True,
    )

    reparto.fecha = fecha
    reparto.vehiculo = vehiculo
    reparto.asignacion = asignacion
    reparto.bultos = int(bultos)
    reparto.puntos_venta = str(
        puntos_venta or ""
    ).strip()

    reparto.recargas = calculo["recargas"]

    reparto.observaciones = str(
        observaciones or ""
    ).strip()

    reparto.save()

    # Borramos la composición anterior del reparto.
    reparto.personal.all().delete()

    # Chofer
    RepartoPersonal.objects.create(
        reparto=reparto,
        empleado=chofer,
        rol=RepartoPersonal.Rol.CHOFER,
        orden=0,
    )

    # Ayudantes
    RepartoPersonal.objects.bulk_create(
        [
            RepartoPersonal(
                reparto=reparto,
                empleado=ayudante,
                rol=RepartoPersonal.Rol.AYUDANTE,
                orden=indice,
            )
            for indice, ayudante in enumerate(
                ayudantes,
                start=1,
            )
        ]
    )

    return reparto