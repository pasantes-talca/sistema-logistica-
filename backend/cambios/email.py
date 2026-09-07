from django.conf import settings
from django.core.mail import EmailMessage

from .pdf import generar_pdf_recibo_cambio


def enviar_recibo_cambio_por_email(
    recibo,
    *,
    actualizado=False,
):
    """
    Genera el PDF del recibo y lo envía
    automáticamente al correo configurado.
    """

    pdf = generar_pdf_recibo_cambio(
        recibo
    )

    fecha = recibo.fecha.strftime(
        "%d-%m-%Y"
    )

    concesionario = (
        recibo.concesionario.nombre
    )

    if actualizado:
        asunto = (
            f"Recibo de cambios actualizado "
            f"- {concesionario} - {fecha}"
        )

        mensaje = (
            "Se adjunta la versión actualizada "
            "del recibo de cambios.\n\n"
            f"Recibo N°: {recibo.id}\n"
            f"Fecha: {fecha}\n"
            f"Concesionario: {concesionario}"
        )

    else:
        asunto = (
            f"Nuevo recibo de cambios "
            f"- {concesionario} - {fecha}"
        )

        mensaje = (
            "Se adjunta el recibo de cambios "
            "generado desde el sistema de Logística.\n\n"
            f"Recibo N°: {recibo.id}\n"
            f"Fecha: {fecha}\n"
            f"Concesionario: {concesionario}"
        )

    destinatario = (
        settings.RECIBOS_EMAIL_DESTINO
    )

    email = EmailMessage(
        subject=asunto,
        body=mensaje,
        from_email=
            settings.DEFAULT_FROM_EMAIL,
        to=[
            destinatario
        ],
    )

    nombre_archivo = (
        f"recibo_cambios_"
        f"{recibo.id}_"
        f"{fecha}.pdf"
    )

    email.attach(
        nombre_archivo,
        pdf,
        "application/pdf",
    )

    email.send(
        fail_silently=False
    )

    return resultado
    