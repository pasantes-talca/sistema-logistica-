export type CeldaOriginal = string | number | boolean | null;
export function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nombre;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(nombre: string, filas: CeldaOriginal[][]) {
  const cell = (v: CeldaOriginal) => {
    const s = String(v ?? "");
    return (
      '"' + (/^[\s]*[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"'
    );
  };
  descargar(
    nombre + ".csv",
    "\ufeff" + filas.map((r) => r.map(cell).join(";")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
