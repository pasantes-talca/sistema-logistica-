from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core.permissions import ADMINISTRADOR, MODULOS
from core.auditoria import registrar


class Command(BaseCommand):
    help = "Otorga el rol operativo sin privilegios técnicos. Opcionalmente crea una cuenta sin contraseña utilizable."

    def add_arguments(self, parser):
        parser.add_argument("usuario")
        parser.add_argument("--actor", default="arielgarro")
        parser.add_argument("--aplicar", action="store_true")
        parser.add_argument("--crear-sin-clave", action="store_true", help="Si la cuenta falta, prepararla sin contraseña utilizable. Se activa con changepassword.")

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        user = User.objects.select_for_update().filter(username=options["usuario"]).first()
        actor = User.objects.filter(username=options["actor"], is_superuser=True, is_active=True).first()
        if not actor:
            raise CommandError("El actor debe ser un superusuario activo existente.")
        if not user and not options["crear_sin_clave"]:
            raise CommandError("La cuenta no existe. Creala desde Administración con una contraseña propia; no se generó ninguna cuenta.")
        nueva = user is None
        if nueva:
            user = User(username=options["usuario"], first_name="Administrador", is_active=True, is_staff=False, is_superuser=False)
            user.set_unusable_password()
            user.full_clean(exclude=["password"])
        if user.is_superuser or user.is_staff or user.username.casefold() == "arielgarro":
            raise CommandError("Esta cuenta tiene privilegios técnicos o está protegida; no se modificó.")
        self.stdout.write(f"Cuenta: {user.username}. Rol: ADMINISTRADOR. Activa: {user.is_active}. Sin cambios en contraseña, staff o superusuario.")
        before = [] if nueva else list(user.groups.values_list("name", flat=True))
        if not options["aplicar"]:
            self.stdout.write("Simulación sin cambios. Usá --aplicar para otorgar el rol.")
            return
        if ADMINISTRADOR not in before:
            if nueva:
                user.save()
            # Conserva los grupos anteriores. Todos los módulos facilitan compatibilidad con el frontend anterior.
            user.groups.add(*[Group.objects.get_or_create(name=name)[0] for name in [ADMINISTRADOR, *MODULOS]])
            registrar(actor, "ADMINISTRACION", "Crear administrador sin clave" if nueva else "Otorgar rol Administrador", user.username,
                      "Configuración solicitada desde terminal", {"grupos": before}, {"grupos": list(user.groups.values_list("name", flat=True))})
        self.stdout.write(self.style.SUCCESS("Rol Administrador operativo configurado."))
        if nueva:
            self.stdout.write("Cuenta sin contraseña utilizable. Para habilitar el ingreso: python manage.py changepassword " + user.username)
