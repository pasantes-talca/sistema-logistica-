"""Nombre histórico de origen, sin conceder cuentas ni permisos de autenticación."""
def nombre_autor(usuario, observaciones=""):
    if usuario:
        return usuario.get_full_name() or usuario.username
    marker = "Usuario original: "
    if marker in str(observaciones):
        lines = str(observaciones).rsplit(marker, 1)[1].splitlines()
        return lines[0].strip() if lines else ""
    return ""
