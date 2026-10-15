import { useRef, useState, type ReactNode } from "react";
import {
  type ProductoOperativo,
  type LineaCarga,
} from "../../api/expedicionOperativa";
import { fmt, normalizar } from "./format";

export function Table({
  headers,
  rows,
  footer,
  emptyMessage = "No hay registros para los filtros seleccionados.",
}: {
  headers: string[];
  rows: ReactNode[][];
  footer?: ReactNode[];
  emptyMessage?: string;
}) {
  return (
    <div className="eo-table">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length}>
                <div className="eo-empty">{emptyMessage}</div>
              </td>
            </tr>
          )}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              {footer.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
export function SearchSelect({
  label,
  options,
  value,
  onChange,
  required = true,
}: {
  label: string;
  options: { id: number; label: string }[];
  value: number;
  onChange: (id: number) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const matches = options
    .filter((o) => normalizar(o.label).includes(normalizar(query)))
    .slice(0, 20);
  return (
    <label className="eo-search">
      {label}
      <input
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={open ? query : selected?.label || ""}
        placeholder="Buscar…"
        required={required}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (matches[0]) {
              onChange(matches[0].id);
              setOpen(false);
            }
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div className="eo-options">
          {matches.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
          {!matches.length && <span>Sin coincidencias</span>}
        </div>
      )}
    </label>
  );
}
export function Lines({
  productos,
  value,
  change,
  sources,
  zero = false,
}: {
  productos: ProductoOperativo[];
  value: LineaCarga[];
  change: (rows: LineaCarga[]) => void;
  sources?: { id: number; label: string }[];
  zero?: boolean;
}) {
  const [pid, setPid] = useState(0);
  const [packs, setPacks] = useState(0);
  const [units, setUnits] = useState(0);
  const [source, setSource] = useState(sources?.[0]?.id || 0);
  const box = useRef<HTMLDivElement>(null);
  const packInput = useRef<HTMLInputElement>(null);
  const unitInput = useRef<HTMLInputElement>(null);
  const add = () => {
    if (
      !pid ||
      !Number.isInteger(packs) ||
      !Number.isInteger(units) ||
      packs < 0 ||
      units < 0 ||
      (!zero && packs + units <= 0) ||
      (sources && !source)
    )
      return;
    const rows = [...value];
    const index = rows.findIndex(
      (l) => l.producto === pid && (!sources || l.solicitado === source),
    );
    if (index >= 0)
      rows[index] = {
        ...rows[index],
        packs: rows[index].packs + packs,
        unidades: rows[index].unidades + units,
      };
    else
      rows.push({
        producto: pid,
        packs,
        unidades: units,
        ...(sources ? { solicitado: source } : {}),
      });
    rows.sort((a, b) =>
      (productos.find((p) => p.id === a.producto)?.codigo || "").localeCompare(
        productos.find((p) => p.id === b.producto)?.codigo || "",
        undefined,
        { numeric: true },
      ),
    );
    change(rows);
    setPid(0);
    setPacks(0);
    setUnits(0);
    box.current?.querySelector<HTMLInputElement>("input")?.focus();
  };
  return (
    <section className="eo-lines">
      <h3>Productos</h3>
      <div className="eo-line-entry" ref={box}>
        <SearchSelect
          label="Código, alias o nombre"
          options={productos
            .filter((p) => p.activo)
            .map((p) => ({
              id: p.id,
              label: `${p.codigo} · ${p.alias} ${p.nombre}`,
            }))}
          value={pid}
          required={false}
          onChange={(id) => {
            setPid(id);
            if (id) setTimeout(() => packInput.current?.focus(), 0);
          }}
        />
        {sources && (
          <SearchSelect
            label="Corresponde al solicitado"
            options={sources}
            value={source}
            onChange={setSource}
            required={false}
          />
        )}
        <label>
          Packs completos
          <input
            ref={packInput}
            type="number"
            min="0"
            step="1"
            value={packs}
            onChange={(e) => setPacks(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                unitInput.current?.focus();
                unitInput.current?.select();
              }
            }}
          />
        </label>
        <label>
          Botellas sueltas
          <input
            ref={unitInput}
            type="number"
            min="0"
            step="1"
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </label>
        <button type="button" onClick={add}>
          Agregar producto
        </button>
      </div>
      <p className="eo-help">
        Enter confirma el producto y vuelve al buscador. La operación se guarda
        con el botón de confirmación.
      </p>
      <Table
        emptyMessage="Agregá productos para registrar la operación."
        headers={[
          "Código / producto",
          ...(sources ? ["Solicitado"] : []),
          "Packs",
          "Unidades",
          "Equivalencia",
          "Acciones",
        ]}
        rows={value.map((l, index) => {
          const p = productos.find((p) => p.id === l.producto);
          return [
            <span>
              <b>{p?.codigo}</b> · {p?.nombre}
            </span>,
            ...(sources
              ? [sources.find((s) => s.id === l.solicitado)?.label]
              : []),
            <input
              aria-label={`Packs ${p?.nombre}`}
              type="number"
              min="0"
              step="1"
              value={l.packs}
              onChange={(e) =>
                change(
                  value.map((x, i) =>
                    i === index ? { ...x, packs: Number(e.target.value) } : x,
                  ),
                )
              }
            />,
            <input
              aria-label={`Unidades ${p?.nombre}`}
              type="number"
              min="0"
              step="1"
              value={l.unidades}
              onChange={(e) =>
                change(
                  value.map((x, i) =>
                    i === index
                      ? { ...x, unidades: Number(e.target.value) }
                      : x,
                  ),
                )
              }
            />,
            `${fmt(l.packs * (p?.unidades_pack || 1) + l.unidades)} un.`,
            <button
              type="button"
              onClick={() => change(value.filter((_, i) => i !== index))}
            >
              Quitar
            </button>,
          ];
        })}
      />
    </section>
  );
}
