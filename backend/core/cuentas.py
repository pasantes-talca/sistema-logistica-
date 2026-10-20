from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction, IntegrityError
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from .permissions import MODULOS, ADMINISTRADOR, es_administrador
from .auditoria import registrar


def cuenta_protegida(actor, target):
    return not actor.is_superuser and (target.is_superuser or target.is_staff or
        target.username.casefold() == "arielgarro" or
        (target.groups.filter(name=ADMINISTRADOR).exists() and actor.pk != target.pk))


def datos_cuenta(user, actor):
    groups = set(user.groups.values_list("name", flat=True))
    return dict(id=user.pk, username=user.username, nombre=user.first_name, apellido=user.last_name,
        activo=user.is_active, administrador=ADMINISTRADOR in groups, superusuario=user.is_superuser,
        protegido=cuenta_protegida(actor, user), modulos=sorted(groups & MODULOS.keys()),
        ultimo_ingreso=user.last_login, creado=user.date_joined)


def validar_password(password, user):
    if not isinstance(password, str) or not password or len(password) > 128:
        raise ValidationError({"password": "Ingresá una contraseña de hasta 128 caracteres."})
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise ValidationError({"password": exc.messages})


@transaction.atomic
def guardar_cuenta(actor, data, pk=None, request=None):
    if not es_administrador(actor):
        raise PermissionDenied("Solo un administrador puede gestionar usuarios.")
    User = get_user_model()
    user = get_object_or_404(User.objects.select_for_update(), pk=pk) if pk else User()
    if pk and cuenta_protegida(actor, user):
        raise PermissionDenied("Esta cuenta está protegida. Solo el superusuario puede modificarla.")
    before = datos_cuenta(user, actor) if pk else {}
    if any(k in data for k in ("is_staff", "is_superuser", "user_permissions", "groups", "grupos", "permisos")):
        raise ValidationError("No se admiten privilegios técnicos desde esta pantalla.")
    if "administrador" in data:
        if not isinstance(data["administrador"], bool):
            raise ValidationError("El rol administrador debe ser verdadero o falso.")
        if not actor.is_superuser and data["administrador"] != (ADMINISTRADOR in set(user.groups.values_list("name", flat=True)) if pk else False):
            raise PermissionDenied("Solo el superusuario puede otorgar o retirar el rol Administrador.")
    username = data.get("username", user.username)
    if not isinstance(username, str) or not username.strip() or len(username) > 150:
        raise ValidationError({"username": "Ingresá un nombre de usuario válido."})
    username = username.strip()
    if not actor.is_superuser and username.casefold() == "arielgarro":
        raise PermissionDenied("El nombre de la cuenta principal está reservado.")
    if User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists():
        raise ValidationError({"username": "Ya existe una cuenta con ese nombre."})
    user.username = username
    for field, attr in (("nombre", "first_name"), ("apellido", "last_name")):
        if field in data:
            if not isinstance(data[field], str) or len(data[field]) > 150:
                raise ValidationError({field: "Usá texto de hasta 150 caracteres."})
            setattr(user, attr, data[field].strip())
    if "activo" in data:
        if not isinstance(data["activo"], bool):
            raise ValidationError("El estado debe ser verdadero o falso.")
        if user.pk == actor.pk and not data["activo"]:
            raise ValidationError("No podés desactivar tu propia cuenta.")
        user.is_active = data["activo"]
    if "modulos" in data and (not isinstance(data["modulos"], list) or any(not isinstance(m, str) or m not in MODULOS for m in data["modulos"])):
        raise ValidationError({"modulos": "Elegí únicamente secciones del listado autorizado."})
    password = data.get("password")
    if not pk or password is not None:
        validar_password(password, user)
        user.set_password(password)
    try:
        user.full_clean(exclude=["password"], validate_unique=False)
        user.save()
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict)
    except IntegrityError:
        raise ValidationError({"username": "El usuario ya existe."})
    if "modulos" in data:
        user.groups.remove(*Group.objects.filter(name__in=MODULOS))
        user.groups.add(*[Group.objects.get_or_create(name=m)[0] for m in sorted(set(data["modulos"]))])
    if "administrador" in data:
        group, _ = Group.objects.get_or_create(name=ADMINISTRADOR)
        if data["administrador"]:
            user.groups.add(group)
        else:
            user.groups.remove(group)
    if password is not None and request and user.pk == actor.pk:
        update_session_auth_hash(request, user)
    after = datos_cuenta(user, actor)
    registrar(actor, "ADMINISTRACION", "Crear usuario" if not pk else "Modificar usuario", user.username,
              data.get("motivo", ""), before, {**after, "contraseña_restablecida": password is not None})
    return user


@transaction.atomic
def restablecer_password(actor, pk, password, request=None):
    if not es_administrador(actor):
        raise PermissionDenied()
    user = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
    if cuenta_protegida(actor, user):
        raise PermissionDenied("Esta cuenta está protegida.")
    validar_password(password, user)
    user.set_password(password)
    user.save(update_fields=["password"])
    if request and user.pk == actor.pk:
        update_session_auth_hash(request, user)
    registrar(actor, "ADMINISTRACION", "Restablecer contraseña", user.username)
    return user
