import type {
  Concesionario,
  MotivoCambio,
  Producto,
} from "../../types/logistica";
import { Fragment } from "react";
import "./ReciboCambioEditable.css";

import {
  camposOtros,
  plantillaRecibo,
  type OtrosRecibo,
  type FilaProducto,
} from "./plantillaRecibo";
type CampoFila = keyof Omit<FilaProducto, "idLocal">;
type Props = {
  fecha: string;
  concesionarioId: string;
  concesionarios: Concesionario[];
  productos: Producto[];
  filas: FilaProducto[];
  otros: OtrosRecibo;
  revisando: boolean;
  cargandoDatos: boolean;
  cargandoProductos: boolean;
  motivos: (familia: string) => MotivoCambio[];
  motivoPendiente: (familia: string) => boolean;
  cambiarFecha: (valor: string) => void;
  cambiarConcesionario: (valor: string) => void;
  cambiarFija: (codigo: string, campo: CampoFila, valor: string) => void;
  cambiarFila: (id: number, campo: CampoFila, valor: string) => void;
  cambiarOtro: (campo: keyof OtrosRecibo, valor: string) => void;
  agregar: () => void;
  quitar: (id: number) => void;
};

export default function ReciboCambioEditable(props: Props) {
  const { productos, filas, otros, revisando } = props;
  const extras = filas.filter(
    (f) =>
      f.idLocal < 1000 &&
      (!revisando || f.productoId || f.cantidad || f.observacion || f.motivoId),
  );
  function celdas(
    p: Producto | undefined,
    fila: FilaProducto | undefined,
    cambiar: (campo: CampoFila, valor: string) => void,
    nombre: string,
  ) {
    return (
      <>
        <td className="rc-cantidad">
          {revisando ? (
            <output aria-label={`Cantidad ${nombre}`}>
              {fila?.cantidad || ""}
            </output>
          ) : (
            <input
              aria-label={`Cantidad ${nombre}`}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={fila?.cantidad || ""}
              disabled={!p || props.cargandoProductos}
              required={
                !!(
                  fila?.productoId &&
                  (fila.cantidad || fila.motivoId || fila.observacion.trim())
                )
              }
              onChange={(e) => cambiar("cantidad", e.target.value)}
            />
          )}
        </td>
        <td className="rc-observacion">
          {revisando ? (
            <>
              <span>{fila?.observacion || ""}</span>
            </>
          ) : (
            <>
              <input
                aria-label={`Observación ${nombre}`}
                value={fila?.observacion || ""}
                disabled={!p || props.cargandoProductos}
                onChange={(e) => cambiar("observacion", e.target.value)}
              />
            </>
          )}
        </td>
      </>
    );
  }
  return (
    <>
      <div
        className="rc-recibo"
        aria-label={
          revisando
            ? "Recibo de cambios para revisar"
            : "Recibo de cambios para completar"
        }
      >
        <div className="rc-membrete">
          <span>Rodríguez Peña 2163 - Godoy Cruz - Mza. - Tel. 4316060</span>
          <img src="/logo-talca.png" alt="Talca" />
        </div>
        <div className="rc-fecha">
          <span aria-hidden="true" />
          <label htmlFor="recibo-fecha">Fecha *</label>
          {revisando ? (
            <strong>{props.fecha.split("-").reverse().join("/")}</strong>
          ) : (
            <input
              id="recibo-fecha"
              type="date"
              required
              value={props.fecha}
              onChange={(e) => props.cambiarFecha(e.target.value)}
            />
          )}
        </div>
        <h2 className="rc-titulo">NOTA DE PEDIDO</h2>
        <div className="rc-concesionario">
          <label htmlFor="recibo-concesionario">Concesionario *</label>
          {revisando ? (
            <strong>
              {
                props.concesionarios.find(
                  (c) => String(c.id) === props.concesionarioId,
                )?.nombre
              }
            </strong>
          ) : (
            <select
              id="recibo-concesionario"
              required
              disabled={props.cargandoDatos}
              value={props.concesionarioId}
              onChange={(e) => props.cambiarConcesionario(e.target.value)}
            >
              <option value="">Elegí el concesionario</option>
              {props.concesionarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
        <div
          className="rc-tabla-scroll"
          role="region"
          aria-label="Planilla del recibo; desplazamiento horizontal en pantallas pequeñas"
          tabIndex={0}
        >
          <table className="rc-tabla">
            <caption className="rc-sr-only">
              Productos y movimientos del recibo de cambios
            </caption>
            <colgroup>
              <col className="rc-col-tam" />
              <col className="rc-col-codigo" />
              <col className="rc-col-sabor" />
              <col className="rc-col-cantidad" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">TAM</th>
                <th scope="col">COD</th>
                <th scope="col">SABOR</th>
                <th scope="col">
                  DESCARGA
                  <br />
                  CAMBIOS
                </th>
                <th scope="col">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {plantillaRecibo.map(([tam, codigo, sabor], index) => {
                const p = productos.find((p) => p.codigo.trim() === codigo);
                const fila = filas.find((f) => f.idLocal === 1000 + index);
                const nombre = `${codigo} ${sabor}`;
                return (
                  <Fragment key={codigo}>
                    {[4, 8, 12, 15].includes(index) && (
                      <tr className="rc-gap" aria-hidden="true">
                        <td colSpan={5} />
                      </tr>
                    )}
                    <tr>
                      {(index < 12 ? !!tam : true) && (
                        <th
                          scope="row"
                          rowSpan={index < 12 ? 4 : 1}
                          className="rc-tamano"
                        >
                          {tam}
                        </th>
                      )}
                      <th scope="row">{codigo}</th>
                      <td>{sabor}</td>
                      {celdas(
                        p,
                        fila,
                        (campo, valor) =>
                          props.cambiarFija(codigo, campo, valor),
                        nombre,
                      )}
                    </tr>
                  </Fragment>
                );
              })}
              {extras.length > 0 && (
                <tr className="rc-subtitulo">
                  <th colSpan={5}>Otros productos del catálogo</th>
                </tr>
              )}
              {extras.map((fila, i) => {
                const p = productos.find(
                  (p) => String(p.id) === fila.productoId,
                );
                return (
                  <tr key={fila.idLocal}>
                    <td colSpan={3}>
                      {revisando ? (
                        <strong>
                          {p?.codigo} · {p?.nombre}
                        </strong>
                      ) : (
                        <div className="rc-extra">
                          <select
                            id={`recibo-producto-${fila.idLocal}`}
                            aria-label={`Otro producto ${i + 1}`}
                            value={fila.productoId}
                            disabled={props.cargandoProductos}
                            required={
                              !!(
                                fila.cantidad ||
                                fila.observacion ||
                                fila.motivoId
                              )
                            }
                            onChange={(e) =>
                              props.cambiarFila(
                                fila.idLocal,
                                "productoId",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">Elegí otro producto</option>
                            {productos
                              .filter(
                                (p) =>
                                  !plantillaRecibo.some(
                                    ([, c]) => c === p.codigo.trim(),
                                  ),
                              )
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.codigo} · {p.nombre}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => props.quitar(fila.idLocal)}
                            aria-label={`Quitar otro producto ${i + 1}`}
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                    </td>
                    {celdas(
                      p,
                      fila,
                      (campo, valor) =>
                        props.cambiarFila(fila.idLocal, campo, valor),
                      `otro producto ${i + 1}`,
                    )}
                  </tr>
                );
              })}
              <tr className="rc-gap" aria-hidden="true">
                <td colSpan={5} />
              </tr>
              {camposOtros.map((c) => (
                <tr key={c.campo}>
                  <th scope="row">{c.codigo}</th>
                  <td colSpan={2}>
                    {c.campo === "pallets_descargados"
                      ? "Pal. Desc."
                      : `${c.titulo}.`}
                  </td>
                  <td className="rc-cantidad">
                    {revisando ? (
                      <output>{otros[c.campo] || ""}</output>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={c.titulo}
                        value={otros[c.campo]}
                        onChange={(e) =>
                          props.cambiarOtro(c.campo, e.target.value)
                        }
                      />
                    )}
                  </td>
                  <td>
                    {revisando ? (
                      otros[c.nota]
                    ) : (
                      <input
                        aria-label={`Observación de ${c.titulo.toLowerCase()}`}
                        value={otros[c.nota]}
                        onChange={(e) =>
                          props.cambiarOtro(c.nota, e.target.value)
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          className="rc-firmas"
          aria-label="Espacios de firma del documento impreso"
        >
          <div>
            <strong>Firma Expedición</strong>
            <span className="rc-sr-only">Se completa en el recibo impreso</span>
          </div>
          <div>
            <strong>Firma Distribuidor</strong>
            <span className="rc-sr-only">Se completa en el recibo impreso</span>
          </div>
        </div>
      </div>
      <div className="rc-complementos">
        <p className="rc-ayuda">
          Completá solo las casillas que correspondan. Las firmas se realizan en
          el recibo impreso.
        </p>
        {!props.cargandoProductos &&
          plantillaRecibo.some(
            ([, codigo]) => !productos.some((p) => p.codigo.trim() === codigo),
          ) && (
            <p className="rc-ayuda">
              Casillas deshabilitadas: productos no disponibles en el catálogo (
              {plantillaRecibo
                .filter(
                  ([, codigo]) =>
                    !productos.some((p) => p.codigo.trim() === codigo),
                )
                .map(([, codigo]) => codigo)
                .join(", ")}
              ).
            </p>
          )}
        {!revisando && (
          <div className="rc-agregar">
            <button
              type="button"
              id="recibo-agregar"
              className="nr-secondary"
              disabled={props.cargandoProductos}
              onClick={props.agregar}
            >
              + Agregar otro producto del catálogo
            </button>
            <small>
              Solo si el producto no figura en las filas del recibo.
            </small>
          </div>
        )}
        {revisando ? (
          <div className="rc-motivos-revision">
            {filas
              .filter((f) => f.motivoId)
              .map((f) => {
                const p = productos.find((p) => String(p.id) === f.productoId);
                return (
                  <p key={f.idLocal}>
                    Motivo {p?.codigo}:{" "}
                    {
                      props
                        .motivos(p?.familia || "")
                        .find((m) => String(m.id) === f.motivoId)?.nombre
                    }
                  </p>
                );
              })}
          </div>
        ) : (
          <details className="rc-clasificacion">
            <summary>Clasificar motivos de cambio (opcional)</summary>
            <p>
              Esta clasificación se guarda junto al recibo, sin agregar columnas
              al documento.
            </p>
            {filas.filter((f) => f.productoId).length ? (
              filas
                .filter((f) => f.productoId)
                .map((f) => {
                  const p = productos.find(
                    (p) => String(p.id) === f.productoId,
                  );
                  const fija =
                    f.idLocal >= 1000
                      ? plantillaRecibo[f.idLocal - 1000]
                      : undefined;
                  const nombre = fija
                    ? `${fija[1]} ${fija[2]}`
                    : `otro producto ${extras.findIndex((e) => e.idLocal === f.idLocal) + 1}`;
                  return (
                    <label key={f.idLocal}>
                      {p?.codigo} · {p?.nombre}
                      <select
                        aria-label={`Motivo ${nombre}`}
                        value={f.motivoId}
                        disabled={
                          !p?.familia || props.motivoPendiente(p.familia)
                        }
                        onChange={(e) =>
                          fija
                            ? props.cambiarFija(
                                fija[1],
                                "motivoId",
                                e.target.value,
                              )
                            : props.cambiarFila(
                                f.idLocal,
                                "motivoId",
                                e.target.value,
                              )
                        }
                      >
                        <option value="">Sin clasificar</option>
                        {props.motivos(p?.familia || "").map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })
            ) : (
              <p>Primero ingresá la cantidad de un producto en el recibo.</p>
            )}
          </details>
        )}
      </div>
    </>
  );
}
