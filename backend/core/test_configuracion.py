from django.conf import settings
from django.test import SimpleTestCase


class ConfiguracionTests(SimpleTestCase):
    def test_hosts_y_origenes_actuales_se_conservan(self):
        self.assertIn("10.242.4.13", settings.ALLOWED_HOSTS)
        self.assertIn("http://10.242.4.13:8001", settings.CORS_ALLOWED_ORIGINS)
        self.assertIn("http://10.242.4.13:8001", settings.CSRF_TRUSTED_ORIGINS)

    def test_cookies_seguras_apagadas_por_defecto_en_http(self):
        self.assertIs(settings.SESSION_COOKIE_SECURE, False)
        self.assertIs(settings.CSRF_COOKIE_SECURE, False)
        self.assertEqual(settings.SECURE_HSTS_SECONDS, 0)

    def test_zona_horaria_argentina(self):
        self.assertEqual(settings.TIME_ZONE, "America/Argentina/Buenos_Aires")
        self.assertTrue(settings.USE_TZ)
