import json
from io import StringIO
import uuid
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.core.management import call_command, CommandError
from rest_framework.test import APIClient
from .models import EventoAuditoria
from .permissions import ADMINISTRADOR, MODULOS
from maestros.models import Asignacion, MotivoRechazo
from rechazos.models import Rechazo

BASE = "/api/administracion/"
PASSWORD = "Prueba-segura-Cuentas-492!"


class AdministracionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.root = User.objects.create_superuser("arielgarro", "root@example.test", PASSWORD)
        self.admin = User.objects.create_user("administrador", password=PASSWORD)
        self.admin.groups.add(Group.objects.get_or_create(name=ADMINISTRADOR)[0])
        self.peer = User.objects.create_user("otroadmin", password=PASSWORD, is_active=False)
        self.peer.groups.add(Group.objects.get_or_create(name=ADMINISTRADOR)[0])
        self.carlos = User.objects.create_user("cbagnardi", first_name="Carlos", last_name="Bagnardi", password=PASSWORD)
        self.carlos.groups.add(Group.objects.get_or_create(name="CAMBIOS")[0])
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def nuevo(self, **extra):
        return self.client.post(BASE + "usuarios/", {"username": "nuevo.operador", "nombre": "Operador", "apellido": "Prueba", "password": PASSWORD, "modulos": ["CAMBIOS"], **extra}, format="json")

    def test_admin_no_es_superusuario_ni_staff_y_ve_todo(self):
        self.assertFalse(self.admin.is_superuser)
        self.assertFalse(self.admin.is_staff)
        result = self.client.get("/api/auth/usuario/")
        self.assertTrue(result.data["es_administrador"])
        for url in ["/api/repartos/", "/api/rechazos/", "/api/cambios/recibos/", "/api/viaticos/", "/api/kilometrajes/", "/api/control-diario/", "/api/expedicion/operativa/", BASE+"usuarios/", BASE+"catalogos/", BASE+"auditoria/"]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_crea_usuario_solo_con_modulos_elegidos_sin_exponer_claves(self):
        result = self.nuevo()
        self.assertEqual(result.status_code, 201, result.data)
        user = get_user_model().objects.get(username="nuevo.operador")
        self.assertTrue(user.check_password(PASSWORD))
        self.assertFalse(user.is_staff or user.is_superuser)
        self.assertEqual(list(user.groups.values_list("name", flat=True)), ["CAMBIOS"])
        body = json.dumps(self.client.get(BASE+"usuarios/").data, default=str)
        events = json.dumps(list(EventoAuditoria.objects.values()), default=str)
        for secret in [PASSWORD, user.password, "password"]:
            self.assertNotIn(secret, body)
            self.assertNotIn(secret, events)

    def test_password_no_valida_no_crea_usuario_ni_evento(self):
        self.assertEqual(self.nuevo(password="123").status_code, 400)
        self.assertFalse(get_user_model().objects.filter(username="nuevo.operador").exists())
        self.assertFalse(EventoAuditoria.objects.exists())

    def test_nombres_duplicados_sin_distinguir_mayusculas(self):
        self.assertEqual(self.nuevo(username="CBAGNARDI").status_code, 400)

    def test_rechaza_elevacion_por_campos_o_roles_inyectados(self):
        for data in [{"is_superuser": True}, {"is_staff": True}, {"administrador": True}, {"modulos": [ADMINISTRADOR]}, {"groups": [1]}, {"user_permissions": [1]}]:
            with self.subTest(data=data):
                self.assertIn(self.nuevo(**data).status_code, [400,403])
        self.assertFalse(get_user_model().objects.filter(username="nuevo.operador").exists())

    def test_cuenta_principal_y_administradores_inactivos_protegidos(self):
        for user in [self.root, self.peer]:
            url=BASE+f"usuarios/{user.pk}/"
            self.assertEqual(self.client.patch(url,{"activo":False},format="json").status_code,403)
            self.assertEqual(self.client.post(url+"password/",{"password":PASSWORD+"x"},format="json").status_code,403)
        self.assertFalse(EventoAuditoria.objects.exists())

    def test_no_puede_desactivarse_a_si_mismo(self):
        self.assertEqual(self.client.patch(BASE+f"usuarios/{self.admin.pk}/",{"activo":False},format="json").status_code,400)

    def test_edicion_permisos_estado_y_nombre_con_auditoria(self):
        result=self.client.patch(BASE+f"usuarios/{self.carlos.pk}/",{"apellido":"Bagnardi", "modulos":["REPARTOS"], "activo":False},format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.carlos.refresh_from_db()
        self.assertFalse(self.carlos.is_active)
        self.assertEqual(set(self.carlos.groups.values_list("name",flat=True)),{"REPARTOS"})
        event=EventoAuditoria.objects.get()
        self.assertEqual(event.antes["modulos"],["CAMBIOS"])
        self.assertEqual(event.despues["modulos"],["REPARTOS"])
        self.assertEqual(event.usuario,"administrador")

    def test_reset_password_invalida_sesion_anterior(self):
        browser=APIClient()
        self.assertTrue(browser.login(username="cbagnardi",password=PASSWORD))
        self.assertEqual(browser.get("/api/auth/usuario/").status_code,200)
        result=self.client.post(BASE+f"usuarios/{self.carlos.pk}/password/",{"password":PASSWORD+"Nueva"},format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(browser.get("/api/auth/usuario/").status_code,401)
        self.carlos.refresh_from_db()
        self.assertTrue(self.carlos.check_password(PASSWORD+"Nueva"))

    def test_desactivar_impide_ingreso_y_no_borra_historial(self):
        self.client.patch(BASE+f"usuarios/{self.carlos.pk}/",{"activo":False},format="json")
        login=APIClient().post("/api/auth/login/",{"username":"cbagnardi","password":PASSWORD},format="json")
        self.assertEqual(login.status_code,401)
        self.assertTrue(get_user_model().objects.filter(pk=self.carlos.pk).exists())

    def test_solo_superusuario_puede_designar_administrador(self):
        tecnico = get_user_model().objects.create_superuser("tecnico.prueba", "tecnico@example.test", PASSWORD)
        self.client.force_authenticate(tecnico)
        response=self.nuevo(administrador=True)
        self.assertEqual(response.status_code,201,response.data)
        self.assertTrue(get_user_model().objects.get(pk=response.data["id"]).groups.filter(name=ADMINISTRADOR).exists())

    def test_arielgarro_no_accede_administracion_pero_conserva_modulos(self):
        self.root.groups.add(Group.objects.get_or_create(name=ADMINISTRADOR)[0])
        self.client.force_authenticate(self.root)
        self.assertFalse(self.client.get("/api/auth/usuario/").data["puede_administrar"])
        for url in [BASE+"usuarios/", BASE+"catalogos/", BASE+"auditoria/"]:
            self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.nuevo().status_code, 403)
        self.assertEqual(self.client.get("/api/repartos/").status_code, 200)
        self.client.force_authenticate(self.admin)
        self.assertTrue(self.client.get("/api/auth/usuario/").data["puede_administrar"])

    def test_ordinario_no_ve_administracion_ni_otras_apis_incluso_url_directa(self):
        self.client.force_authenticate(self.carlos)
        for url in [BASE+"usuarios/",BASE+"catalogos/",BASE+"auditoria/","/api/repartos/","/api/rechazos/","/api/expedicion/operativa/","/api/kilometrajes/","/api/viaticos/","/api/control-diario/"]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code,403)
        for url in ["/api/cambios/recibos/","/api/maestros/productos/","/api/maestros/concesionarios/","/api/maestros/motivos-cambio/"]:
            self.assertEqual(self.client.get(url).status_code,200)
        self.assertEqual(self.client.get("/api/maestros/choferes/").status_code,403)

    def test_anonimo_no_lee_ni_modifica_modulos(self):
        self.client.force_authenticate(user=None)
        for url in ["/api/rechazos/","/api/cambios/recibos/",BASE+"usuarios/","/api/maestros/productos/"]:
            self.assertIn(self.client.get(url).status_code,[401,403])
            self.assertIn(self.client.post(url,{},format="json").status_code,[401,403])

    def test_no_borra_usuarios_auditoria_o_historicos(self):
        for url in [BASE+f"usuarios/{self.carlos.pk}/",BASE+"auditoria/","/api/viaticos/999/","/api/control-diario/999/","/api/kilometrajes/999/"]:
            self.assertIn(self.client.delete(url).status_code,[403,405])

    def test_auditoria_solo_lectura_paginada_filtrada_y_csv_sin_formulas(self):
        self.nuevo()
        EventoAuditoria.objects.create(actor=self.admin,usuario="=HYPERLINK(x)",modulo="PRUEBA",accion="Prueba",referencia="+comando")
        rows=self.client.get(BASE+"auditoria/?buscar=nuevo.operador&tamano=1")
        self.assertEqual(rows.status_code,200)
        self.assertEqual(rows.data["total"],1)
        self.assertEqual(len(rows.data["resultados"]),1)
        csv=self.client.get(BASE+"auditoria/?formato=csv").content.decode("utf-8")
        self.assertIn("'=HYPERLINK(x)",csv)
        self.assertIn("'+comando",csv)
        self.assertEqual(self.client.post(BASE+"auditoria/",{},format="json").status_code,405)
        self.assertEqual(self.client.get(BASE+"auditoria/?pagina=texto").status_code,400)

    def test_catalogo_creacion_edicion_desactivacion_sin_borrado(self):
        response=self.client.post(BASE+"catalogos/concesionarios/",{"nombre":"Concesionario prueba"},format="json")
        self.assertEqual(response.status_code,201,response.data)
        pk=response.data["id"]
        self.assertEqual(self.client.patch(BASE+f"catalogos/concesionarios/{pk}/",{"activo":False},format="json").status_code,400)
        result=self.client.patch(BASE+f"catalogos/concesionarios/{pk}/",{"activo":False,"motivo":"Ya no opera"},format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(EventoAuditoria.objects.count(),2)
        self.assertEqual(self.client.delete(BASE+f"catalogos/concesionarios/{pk}/").status_code,405)

    def test_catalogo_no_permite_saldo_privilegios_o_productos_directos(self):
        for data in [{"nombre":"Ejemplo","stock":999}, {"nombre":"Ejemplo","is_superuser":True}]:
            self.assertEqual(self.client.post(BASE+"catalogos/concesionarios/",data,format="json").status_code,400)
        self.assertEqual(self.client.post(BASE+"catalogos/productos/",{},format="json").status_code,400)

    def test_motivo_cambio_preserva_familias_y_historial(self):
        response=self.client.post(BASE+"catalogos/motivos-cambio/",{"nombre":"Prueba familias","familias":["SODA"]},format="json")
        self.assertEqual(response.status_code,201,response.data)
        result=self.client.patch(BASE+f"catalogos/motivos-cambio/{response.data['id']}/",{"familias":["SIFON"],"motivo":"Corrección"},format="json")
        self.assertEqual(result.status_code,200,result.data)
        event=EventoAuditoria.objects.first()
        self.assertEqual(event.antes["familias"],["SODA"])
        self.assertEqual(event.despues["familias"],["SIFON"])

    def test_operacion_corregida_requiere_motivo_y_guarda_antes_despues(self):
        asignacion=Asignacion.objects.create(codigo="991")
        motivo=MotivoRechazo.objects.create(nombre="Prueba rechazo")
        rechazo=Rechazo.objects.create(fecha="2026-10-19",asignacion=asignacion,punto_venta="Prueba",bultos=1,motivo=motivo)
        data={"fecha":"2026-10-19","asignacion_id":asignacion.pk,"punto_venta":"Corregido","bultos":2,"motivo_id":motivo.pk,"observacion":"Prueba"}
        url=f"/api/rechazos/{rechazo.pk}/"
        self.assertEqual(self.client.put(url,data,format="json").status_code,400)
        self.assertFalse(EventoAuditoria.objects.exists())
        result=self.client.put(url,{**data,"motivo_correccion":"Error de carga"},format="json")
        self.assertEqual(result.status_code,200,result.data)
        event=EventoAuditoria.objects.get()
        self.assertEqual(event.antes["punto_venta"],"Prueba")
        self.assertEqual(event.despues["datos"]["punto_venta"],"Corregido")

    def test_legado_expedicion_no_permite_eludir_proteccion(self):
        payload={"accion":"usuario","turno":"Mañana","clave":str(uuid.uuid4()),"id":self.root.pk,"username":"arielgarro","nombre":"Otro","activo":False}
        self.assertEqual(self.client.post("/api/expedicion/operativa/",payload,format="json").status_code,403)
        self.root.refresh_from_db()
        self.assertTrue(self.root.is_active)
        self.assertFalse(EventoAuditoria.objects.exists())

    def test_staff_sin_rol_no_administra(self):
        user=get_user_model().objects.create_user("staff.sin.rol",is_staff=True)
        user.groups.add(Group.objects.get_or_create(name="EXPEDICION")[0])
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get(BASE+"usuarios/").status_code,403)
        data=self.client.get("/api/expedicion/operativa/").data
        self.assertFalse(data["admin"])
        self.assertEqual(data["usuarios"],[])

    def test_csrf_obligatorio_y_cierre_de_sesion_valido(self):
        browser=APIClient(enforce_csrf_checks=True)
        response=browser.post("/api/auth/login/",{"username":"administrador","password":PASSWORD},format="json")
        self.assertEqual(response.status_code,200)
        self.assertEqual(browser.post(BASE+"usuarios/",{},format="json").status_code,403)
        token=browser.cookies['csrftoken'].value
        self.assertEqual(browser.post("/api/auth/logout/",{},format="json",HTTP_X_CSRFTOKEN=token).status_code,200)
        self.assertEqual(browser.get("/api/auth/usuario/").status_code,401)

    def test_fallo_de_auditoria_revierte_cambios(self):
        with patch('core.cuentas.registrar',side_effect=RuntimeError('Fallo simulado')):
            with self.assertRaises(RuntimeError):
                self.nuevo()
        self.assertFalse(get_user_model().objects.filter(username="nuevo.operador").exists())

    def test_comando_prepara_cuenta_sin_clave_solo_con_confirmacion(self):
        out=StringIO()
        call_command("configurar_administrador", "admin.nuevo", crear_sin_clave=True, stdout=out)
        self.assertFalse(get_user_model().objects.filter(username="admin.nuevo").exists())
        call_command("configurar_administrador", "admin.nuevo", crear_sin_clave=True, aplicar=True, stdout=out)
        user=get_user_model().objects.get(username="admin.nuevo")
        self.assertFalse(user.has_usable_password())
        self.assertFalse(user.is_superuser or user.is_staff)
        self.assertEqual(set(user.groups.values_list("name",flat=True)), {ADMINISTRADOR,*MODULOS})
        count=EventoAuditoria.objects.count()
        call_command("configurar_administrador", "admin.nuevo", crear_sin_clave=True, aplicar=True, stdout=out)
        self.assertEqual(EventoAuditoria.objects.count(),count)
        with self.assertRaises(CommandError):
            call_command("configurar_administrador", "arielgarro", aplicar=True, stdout=out)
