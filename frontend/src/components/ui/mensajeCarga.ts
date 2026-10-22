/** Presentar las validaciones del servidor sin mostrar objetos JSON al usuario. */
export function mensajeCarga(error: Error): string {
  try {
    const contenido: unknown = JSON.parse(error.message);
    const textos = (valor: unknown): string[] => {
      if (typeof valor === "string") return [valor];
      if (Array.isArray(valor)) return valor.flatMap(textos);
      if (valor && typeof valor === "object")
        return Object.values(valor).flatMap(textos);
      return [];
    };
    return (
      textos(contenido).join(" · ") || "Volvé a intentar en unos momentos."
    );
  } catch {
    return error.message.startsWith("Unexpected")
      ? "La respuesta del servidor no fue válida. Volvé a intentar en unos momentos."
      : error.message;
  }
}
