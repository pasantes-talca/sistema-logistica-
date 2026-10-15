import { useState } from "react";
import type {
  LineaCarga,
  ProductoOperativo,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import { fmt, normalizar } from "./format";
import { cantidadStock } from "./stockReporte";

export default function FormularioConteo({
  productos,
  value,
  change,
}: {
  productos: ProductoOperativo[];
  value: LineaCarga[];
  change: (rows: LineaCarga[]) => void;
}) {
  const [search, setSearch] = useState("");
  const catalogo = productos
    .filter(
      (p) =>
        p.activo &&
        normalizar(`${p.codigo} ${p.alias} ${p.nombre}`).includes(
          normalizar(search),
        ),
    )
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  const edit = (id: number, values: Partial<LineaCarga>) =>
    change(value.map((l) => (l.producto === id ? { ...l, ...values } : l)));
  return (
    <section className="eo-count-entry">
      <h3>Conteo físico por producto</h3>
      <p className="eo-help">
        Compará el stock teórico con lo contado. Los productos ocultos por la
        búsqueda siguen incluidos. La comparación final se registra al guardar y
        no modifica el stock.
      </p>
      <label className="eo-count-product-search">
        Buscar producto
        <input
          type="search"
          aria-label="Buscar producto del conteo"
          placeholder="Código, alias o nombre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <Table
        headers={[
          "Incluir",
          "Producto",
          "Stock teórico",
          "Fardos físicos",
          "Botellas sueltas",
          "Diferencia (un.)",
        ]}
        emptyMessage="No hay productos que coincidan con la búsqueda."
        rows={catalogo.map((p) => {
          const line = value.find((l) => l.producto === p.id);
          const per = p.unidades_pack || 1;
          const diferencia = line
            ? line.packs * per + line.unidades - p.stock
            : null;
          return [
            <input
              type="checkbox"
              aria-label={`Incluir ${p.codigo}`}
              checked={!!line}
              onChange={(e) =>
                change(
                  e.target.checked
                    ? [
                        ...value,
                        {
                          producto: p.id,
                          packs: Math.floor(Math.max(0, p.stock) / per),
                          unidades: Math.max(0, p.stock) % per,
                        },
                      ]
                    : value.filter((l) => l.producto !== p.id),
                )
              }
            />,
            <span>
              <b>{p.codigo}</b> · {p.nombre}
              {!p.configurado && (
                <small>
                  Sin equivalencia configurada: registrá unidades físicas.
                </small>
              )}
            </span>,
            <span>
              {p.configurado
                ? cantidadStock(p.stock, p)
                : `${fmt(p.stock)} un.`}
              <small>{fmt(p.stock)} unidades</small>
            </span>,
            <input
              aria-label={`${p.configurado ? "Fardos físicos" : "Cantidad física (un.)"} ${p.codigo}`}
              type="number"
              min="0"
              step="1"
              disabled={!line}
              value={line?.packs ?? ""}
              onChange={(e) => edit(p.id, { packs: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget
                    .closest("tr")
                    ?.querySelector<HTMLInputElement>("td:nth-child(5) input")
                    ?.focus();
                }
              }}
            />,
            <input
              aria-label={`Botellas sueltas ${p.codigo}`}
              type="number"
              min="0"
              step="1"
              disabled={!line || !p.configurado}
              value={line?.unidades ?? ""}
              onChange={(e) => edit(p.id, { unidades: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget
                    .closest("tr")
                    ?.nextElementSibling?.querySelector<HTMLInputElement>(
                      "td:nth-child(4) input:not(:disabled)",
                    )
                    ?.focus();
                }
              }}
            />,
            diferencia === null ? (
              "No incluido"
            ) : (
              <b className={diferencia ? "eo-count-difference" : ""}>
                {diferencia > 0 ? "+" : ""}
                {fmt(diferencia)}
              </b>
            ),
          ];
        })}
      />
      <p className="eo-help">
        {value.length} productos incluidos. Enter avanza entre cantidades; el
        conteo se guarda con Confirmar operación.
      </p>
    </section>
  );
}
