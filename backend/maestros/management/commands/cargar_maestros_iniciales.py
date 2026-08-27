from django.core.management.base import BaseCommand

from maestros.models import (
    Producto,
    Concesionario,
    MotivoCambio,
    MotivoCambioFamilia,
)


class Command(BaseCommand):
    help = "Carga los datos maestros iniciales del sistema de Logística"

    def handle(self, *args, **options):
        self.cargar_productos()
        self.cargar_concesionarios()
        self.cargar_motivos_cambio()

        self.stdout.write(
            self.style.SUCCESS(
                "Datos maestros iniciales cargados correctamente."
            )
        )

    def cargar_productos(self):
        productos = [
            {
                "codigo": "5051",
                "nombre": "1/5 LT COLA",
                "presentacion": "1/5 LT",
                "sabor": "COLA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5056",
                "nombre": "1/5 LT LIMA",
                "presentacion": "1/5 LT",
                "sabor": "LIMA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5066",
                "nombre": "1/5 LT NARANJA",
                "presentacion": "1/5 LT",
                "sabor": "NARANJA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5071",
                "nombre": "1/5 LT POMELO",
                "presentacion": "1/5 LT",
                "sabor": "POMELO",
                "familia": Producto.Familia.GASEOSA,
            },

            {
                "codigo": "5200",
                "nombre": "2 1/4 LT COLA",
                "presentacion": "2 1/4 LT",
                "sabor": "COLA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5205",
                "nombre": "2 1/4 LT LIMA",
                "presentacion": "2 1/4 LT",
                "sabor": "LIMA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5215",
                "nombre": "2 1/4 LT NARANJA",
                "presentacion": "2 1/4 LT",
                "sabor": "NARANJA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5220",
                "nombre": "2 1/4 LT POMELO",
                "presentacion": "2 1/4 LT",
                "sabor": "POMELO",
                "familia": Producto.Familia.GASEOSA,
            },

            {
                "codigo": "5670",
                "nombre": "3 LT COLA",
                "presentacion": "3 LT",
                "sabor": "COLA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5675",
                "nombre": "3 LT LIMA",
                "presentacion": "3 LT",
                "sabor": "LIMA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5685",
                "nombre": "3 LT NARANJA",
                "presentacion": "3 LT",
                "sabor": "NARANJA",
                "familia": Producto.Familia.GASEOSA,
            },
            {
                "codigo": "5690",
                "nombre": "3 LT POMELO",
                "presentacion": "3 LT",
                "sabor": "POMELO",
                "familia": Producto.Familia.GASEOSA,
            },

            {
                "codigo": "4900",
                "nombre": "SODA 2L",
                "presentacion": "2 LT",
                "sabor": "",
                "familia": Producto.Familia.SODA,
            },
            {
                "codigo": "4910",
                "nombre": "SIFÓN",
                "presentacion": "",
                "sabor": "",
                "familia": Producto.Familia.SIFON,
            },
            {
                "codigo": "417",
                "nombre": "SODA 1/2 LT",
                "presentacion": "1/2 LT",
                "sabor": "",
                "familia": Producto.Familia.SODA,
            },

            {
                "codigo": "8690",
                "nombre": "AGUA BIDÓN 6L",
                "presentacion": "6 LT",
                "sabor": "",
                "familia": Producto.Familia.AGUA,
            },
            {
                "codigo": "8670",
                "nombre": "AGUA BOTELLA 2L",
                "presentacion": "2 LT",
                "sabor": "",
                "familia": Producto.Familia.AGUA,
            },
        ]

        for datos in productos:
            Producto.objects.update_or_create(
                codigo=datos["codigo"],
                defaults=datos,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Productos cargados: {len(productos)}"
            )
        )

    def cargar_concesionarios(self):
        concesionarios = [
            "Rojo",
            "Aiobak",
            "Escudero",
            "Scifo",
            "Abraham",
            "Gatica",
            "Mariano",
            "Ochoa",
            "Martos",
            "Garro",
        ]

        for nombre in concesionarios:
            Concesionario.objects.update_or_create(
                nombre=nombre,
                defaults={
                    "activo": True,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Concesionarios cargados: {len(concesionarios)}"
            )
        )

    def cargar_motivos_cambio(self):
        motivos_por_familia = {
            Producto.Familia.GASEOSA: [
                "Falta de etiqueta",
                "Mal tapado",
                "Pérdida",
                "Golpeado",
                "Deformado",
                "Sucio",
                "Bajo nivel / mal llenado",
                "Vencido / mal fechado",
                "Otro",
            ],

            Producto.Familia.SODA: [
                "Falta de etiqueta",
                "Mal tapado",
                "Pérdida",
                "Golpeado",
                "Sucio",
                "Bajo nivel / mal llenado",
                "Otro",
            ],

            Producto.Familia.SIFON: [
                "Falta de etiqueta",
                "Mal tapado",
                "Bajo de gas",
                "Pérdida",
                "Pico defectuoso",
                "Golpeado",
                "Sucio",
                "Otro",
            ],

            Producto.Familia.AGUA: [
                "Falta de etiqueta",
                "Mal tapado",
                "Pérdida",
                "Golpeado",
                "Sucio",
                "Vencido / mal fechado",
                "Otro",
            ],
        }

        relaciones_creadas = 0

        for familia, motivos in motivos_por_familia.items():
            for nombre in motivos:
                motivo, _ = MotivoCambio.objects.update_or_create(
                    nombre=nombre,
                    defaults={
                        "activo": True,
                    },
                )

                _, creada = MotivoCambioFamilia.objects.get_or_create(
                    motivo=motivo,
                    familia=familia,
                )

                if creada:
                    relaciones_creadas += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Motivos de cambios y relaciones cargados. "
                f"Nuevas relaciones: {relaciones_creadas}"
            )
        )