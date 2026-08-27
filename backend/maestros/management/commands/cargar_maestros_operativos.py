from django.core.management.base import BaseCommand

from maestros.models import (
    Empleado,
    Vehiculo,
    Asignacion,
    MotivoRechazo,
)


class Command(BaseCommand):
    help = (
        "Carga empleados, vehículos, asignaciones, "
        "choferes predeterminados y motivos de rechazo."
    )

    def handle(self, *args, **options):
        self.cargar_empleados()
        self.cargar_vehiculos()
        self.cargar_asignaciones()
        self.asignar_choferes_predeterminados()
        self.cargar_motivos_rechazo()

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "Maestros operativos cargados correctamente."
            )
        )

    # =========================================================
    # EMPLEADOS
    # =========================================================

    def cargar_empleados(self):
        empleados = [
            {
                "legajo": "1",
                "nombre": "PEREZ GUILLERMO ANTONIO",
                "puesto": "Ayudante",
            },
            {
                "legajo": "2",
                "nombre": "MORANDINI OMAR HUMBERTO",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": "3",
                "nombre": "AVILA RICARDO HORACIO",
                "puesto": "Ayudante",
            },
            {
                "legajo": "4",
                "nombre": "OROZCO ALEJANDRO OSCAR",
                "puesto": "Ayudante",
            },
            {
                "legajo": "6",
                "nombre": "Vega Juan Carlos",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": "8",
                "nombre": "MORENO EMMANUEL NICOLAS",
                "puesto": "Operario Especializado",
            },
            {
                "legajo": "9",
                "nombre": "TORRES LEONARDO JESUS",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": "10",
                "nombre": "Cisternas Astudillo Jefte S.",
                "puesto": "Operario Especializado",
            },
            {
                "legajo": "11",
                "nombre": "ORTIZ DIEGO ARMANDO",
                "puesto": "Operario Especializado",
            },
            {
                "legajo": "13",
                "nombre": "Gonzales Angel Jose",
                "puesto": "Operario Especializado",
            },
            {
                "legajo": "14",
                "nombre": "LOPEZ JOSE CEFERINO",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": "21",
                "nombre": "HEREDIA DAVID",
                "puesto": "Operario Especializado",
            },
            {
                "legajo": "24",
                "nombre": "BUENANUEVA",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": "25",
                "nombre": "RIVERA",
                "puesto": "Operario Especializado",
            },
            {
                "legajo": "26",
                "nombre": "BRASILI",
                "puesto": "Operario Especializado",
            },
            {
                "legajo": "28",
                "nombre": "BRANDON SOSA",
                "puesto": "Operario Especializado",
            },
            {
                "legajo": "29",
                "nombre": "MARTIN FRANCO",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": "30",
                "nombre": "AGUSTIN ARANCIBIA",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": "31",
                "nombre": "Jesus Chanta",
                "puesto": "Operario Especializado",
            },

            # Actualmente figuran sin legajo en la Sheet
            {
                "legajo": None,
                "nombre": "CARLOS LESCANO",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": None,
                "nombre": "ESTEBAN VILLEGAS",
                "puesto": "Ayudante",
            },
            {
                "legajo": None,
                "nombre": "MOTA CARLOS",
                "puesto": "Chofer 1ra. Categoria",
            },
            {
                "legajo": None,
                "nombre": "FRANCO MAHONA",
                "puesto": "Chofer 1ra. Categoria",
            },
        ]

        for datos in empleados:
            legajo = datos["legajo"]

            defaults = {
                "nombre": datos["nombre"],
                "puesto": datos["puesto"],
                "disponible": True,
                "activo": True,
            }

            if legajo:
                Empleado.objects.update_or_create(
                    legajo=legajo,
                    defaults=defaults,
                )
            else:
                Empleado.objects.update_or_create(
                    nombre=datos["nombre"],
                    defaults={
                        **defaults,
                        "legajo": None,
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Empleados procesados: {len(empleados)}"
            )
        )

    # =========================================================
    # VEHÍCULOS
    # =========================================================

    def cargar_vehiculos(self):
        patentes = [
            "NJJ587",
            "LDF195",
            "NCH087",
            "NCH089",
            "IJC523",
            "UXC935",
            "NJJ586",
            "AC006UQ",
            "AC006UR",
            "TDW250",
        ]

        for patente in patentes:
            Vehiculo.objects.update_or_create(
                patente=patente.upper(),
                defaults={
                    "activo": True,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Vehículos procesados: {len(patentes)}"
            )
        )

    # =========================================================
    # ASIGNACIONES
    # =========================================================

    def cargar_asignaciones(self):
        codigos = [
            "50",
            "70",
            "80",
            "120",
            "160",
            "180",
            "240",
            "270",
            "920",
            "925",
        ]

        for codigo in codigos:
            Asignacion.objects.update_or_create(
                codigo=codigo,
                defaults={
                    "activo": True,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Asignaciones procesadas: {len(codigos)}"
            )
        )

    # =========================================================
    # CHOFER PREDETERMINADO
    # =========================================================

    def asignar_choferes_predeterminados(self):
        relaciones = {
            "50": "LOPEZ JOSE CEFERINO",
            "70": "TORRES LEONARDO JESUS",
            "80": "MORANDINI OMAR HUMBERTO",
            "120": "Vega Juan Carlos",
            "160": "BUENANUEVA",
            "180": "AGUSTIN ARANCIBIA",
            "270": "MARTIN FRANCO",
        }

        asignados = 0

        for codigo, nombre_empleado in relaciones.items():
            try:
                asignacion = Asignacion.objects.get(
                    codigo=codigo
                )

                empleado = Empleado.objects.get(
                    nombre__iexact=nombre_empleado
                )

                asignacion.chofer_predeterminado = empleado
                asignacion.save(
                    update_fields=[
                        "chofer_predeterminado",
                        "actualizado_en",
                    ]
                )

                asignados += 1

            except Asignacion.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f"No existe asignación {codigo}"
                    )
                )

            except Empleado.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f"No existe empleado: {nombre_empleado}"
                    )
                )

        # El código anterior también contiene:
        #
        # 240 -> PABLO LUNA
        # 920 -> RICARDO MANSILLA
        #
        # pero esas personas no figuran actualmente
        # en Datos Empleados.
        #
        # 925 tampoco tiene chofer automático configurado.
        #
        # Los dejamos en NULL hasta confirmar la información.

        self.stdout.write(
            self.style.SUCCESS(
                f"Choferes predeterminados asignados: {asignados}"
            )
        )

    # =========================================================
    # MOTIVOS DE RECHAZO / NO ENTREGA
    # =========================================================

    def cargar_motivos_rechazo(self):
        motivos = [
            "Sin dinero",
            "Sin sistema",
            "Mal facturado",
            "Facturación en la misma boleta",
            "No hay recepcionista",
            "Sobrestock",
            "Observado por producto cambiado",
            "Faltante de mercadería",
            "Sin producto",
            "No salió la factura",
            "Entrega parcial",
            "Sin lugar en el depósito",
            "Sin lugar de acopio",
            "No sacaron turno de descarga",
            "No es lo que pidió",
            "Otro",
        ]

        for nombre in motivos:
            MotivoRechazo.objects.update_or_create(
                nombre=nombre,
                defaults={
                    "activo": True,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Motivos de rechazo procesados: {len(motivos)}"
            )
        )