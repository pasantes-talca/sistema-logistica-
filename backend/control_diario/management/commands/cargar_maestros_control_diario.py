from django.core.management.base import BaseCommand

from control_diario.models import (
    ProductoControlDiario,
    UbicacionControlDiario,
)


class Command(BaseCommand):

    help = (
        "Carga los productos y ubicaciones iniciales "
        "del módulo Control Diario."
    )

    def handle(self, *args, **options):

        self.stdout.write(
            "\nCargando maestros de Control Diario...\n"
        )

        productos_creados = 0
        productos_actualizados = 0

        ubicaciones_creadas = 0
        ubicaciones_actualizadas = 0


        # ==========================================
        # PRODUCTOS
        # ==========================================

        productos = [

            # 3 LITROS
            {
                "nombre": "Cola 3 L",
                "familia": "Gaseosa",
                "sabor": "Cola",
                "presentacion": "3 L",
                "orden": 1,
            },
            {
                "nombre": "Lima 3 L",
                "familia": "Gaseosa",
                "sabor": "Lima",
                "presentacion": "3 L",
                "orden": 2,
            },
            {
                "nombre": "Naranja 3 L",
                "familia": "Gaseosa",
                "sabor": "Naranja",
                "presentacion": "3 L",
                "orden": 3,
            },
            {
                "nombre": "Pomelo 3 L",
                "familia": "Gaseosa",
                "sabor": "Pomelo",
                "presentacion": "3 L",
                "orden": 4,
            },


            # 2,25 LITROS
            {
                "nombre": "Cola 2,25 L",
                "familia": "Gaseosa",
                "sabor": "Cola",
                "presentacion": "2,25 L",
                "orden": 5,
            },
            {
                "nombre": "Lima 2,25 L",
                "familia": "Gaseosa",
                "sabor": "Lima",
                "presentacion": "2,25 L",
                "orden": 6,
            },
            {
                "nombre": "Naranja 2,25 L",
                "familia": "Gaseosa",
                "sabor": "Naranja",
                "presentacion": "2,25 L",
                "orden": 7,
            },
            {
                "nombre": "Pomelo 2,25 L",
                "familia": "Gaseosa",
                "sabor": "Pomelo",
                "presentacion": "2,25 L",
                "orden": 8,
            },


            # 500 CC
            {
                "nombre": "Cola 500 cc",
                "familia": "Gaseosa",
                "sabor": "Cola",
                "presentacion": "500 cc",
                "orden": 9,
            },
            {
                "nombre": "Lima 500 cc",
                "familia": "Gaseosa",
                "sabor": "Lima",
                "presentacion": "500 cc",
                "orden": 10,
            },
            {
                "nombre": "Naranja 500 cc",
                "familia": "Gaseosa",
                "sabor": "Naranja",
                "presentacion": "500 cc",
                "orden": 11,
            },
            {
                "nombre": "Pomelo 500 cc",
                "familia": "Gaseosa",
                "sabor": "Pomelo",
                "presentacion": "500 cc",
                "orden": 12,
            },


            # SODA
            {
                "nombre": "Soda 2250 cc tapa",
                "familia": "Soda",
                "sabor": "",
                "presentacion": "2250 cc tapa",
                "orden": 13,
            },
            {
                "nombre": "Sifón Talca",
                "familia": "Soda",
                "sabor": "",
                "presentacion": "Sifón",
                "orden": 14,
            },


            # AGUA
            {
                "nombre": "Agua 500 cc",
                "familia": "Agua",
                "sabor": "",
                "presentacion": "500 cc",
                "orden": 15,
            },
            {
                "nombre": "Agua bidón 6000",
                "familia": "Agua",
                "sabor": "",
                "presentacion": "6000",
                "orden": 16,
            },
            {
                "nombre": "Agua 2 L",
                "familia": "Agua",
                "sabor": "",
                "presentacion": "2 L",
                "orden": 17,
            },

        ]


        for producto in productos:

            objeto, creado = (
                ProductoControlDiario.objects.update_or_create(
                    nombre=producto["nombre"],
                    defaults={
                        "familia":
                            producto["familia"],

                        "sabor":
                            producto["sabor"],

                        "presentacion":
                            producto["presentacion"],

                        "orden":
                            producto["orden"],

                        "activo":
                            True,
                    },
                )
            )

            if creado:
                productos_creados += 1
            else:
                productos_actualizados += 1


        # ==========================================
        # UBICACIONES
        # ==========================================

        ubicaciones = [

            # PLANTA
            {
                "nombre": "Planta Mendoza",
                "tipo": "PLANTA",
                "orden": 1,
            },


            # DEPÓSITOS
            {
                "nombre": "Martins",
                "tipo": "DEPOSITO",
                "orden": 10,
            },
            {
                "nombre": "San Juan",
                "tipo": "DEPOSITO",
                "orden": 11,
            },
            {
                "nombre": "San Luis",
                "tipo": "DEPOSITO",
                "orden": 12,
            },


            # DESTINOS DE ASIGNACIÓN
            {
                "nombre": "Sharp",
                "tipo": "DESTINO",
                "orden": 20,
            },
            {
                "nombre": "Distribuidores Mza",
                "tipo": "DESTINO",
                "orden": 21,
            },
            {
                "nombre": "SMK Mza",
                "tipo": "DESTINO",
                "orden": 22,
            },
            {
                "nombre": "Vertelier",
                "tipo": "DESTINO",
                "orden": 23,
            },
            {
                "nombre": "Feria Mza",
                "tipo": "DESTINO",
                "orden": 24,
            },


            # DISTRIBUIDORES MENDOZA
            {
                "nombre": "Rojo",
                "tipo": "DISTRIBUIDOR",
                "orden": 100,
            },
            {
                "nombre": "Aibak",
                "tipo": "DISTRIBUIDOR",
                "orden": 101,
            },
            {
                "nombre": "Escudero",
                "tipo": "DISTRIBUIDOR",
                "orden": 102,
            },
            {
                "nombre": "Gatica",
                "tipo": "DISTRIBUIDOR",
                "orden": 103,
            },
            {
                "nombre": "Ochoa",
                "tipo": "DISTRIBUIDOR",
                "orden": 104,
            },
            {
                "nombre": "Marthos",
                "tipo": "DISTRIBUIDOR",
                "orden": 105,
            },
            {
                "nombre": "Mariano",
                "tipo": "DISTRIBUIDOR",
                "orden": 106,
            },
            {
                "nombre": "Garro",
                "tipo": "DISTRIBUIDOR",
                "orden": 107,
            },
            {
                "nombre": "Zarate",
                "tipo": "DISTRIBUIDOR",
                "orden": 108,
            },
            {
                "nombre": "Abraham",
                "tipo": "DISTRIBUIDOR",
                "orden": 109,
            },
            {
                "nombre": "Scifo",
                "tipo": "DISTRIBUIDOR",
                "orden": 110,
            },
            {
                "nombre": "Central Bebidas",
                "tipo": "DISTRIBUIDOR",
                "orden": 111,
            },

        ]


        for ubicacion in ubicaciones:

            objeto, creado = (
                UbicacionControlDiario.objects.update_or_create(
                    nombre=ubicacion["nombre"],
                    defaults={
                        "tipo":
                            ubicacion["tipo"],

                        "orden":
                            ubicacion["orden"],

                        "activo":
                            True,
                    },
                )
            )

            if creado:
                ubicaciones_creadas += 1
            else:
                ubicaciones_actualizadas += 1


        # ==========================================
        # RESULTADO
        # ==========================================

        self.stdout.write(
            self.style.SUCCESS(
                "\nCarga finalizada correctamente."
            )
        )

        self.stdout.write(
            f"\nProductos creados: "
            f"{productos_creados}"
        )

        self.stdout.write(
            f"Productos actualizados: "
            f"{productos_actualizados}"
        )

        self.stdout.write(
            f"\nUbicaciones creadas: "
            f"{ubicaciones_creadas}"
        )

        self.stdout.write(
            f"Ubicaciones actualizadas: "
            f"{ubicaciones_actualizadas}"
        )

        self.stdout.write("")

