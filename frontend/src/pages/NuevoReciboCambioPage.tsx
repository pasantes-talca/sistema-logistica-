import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  guardarReciboCambio,
  obtenerConcesionarios,
  obtenerMotivosCambio,
  obtenerProductos,
} from "../api/logistica";
import type {
  CrearReciboCambioPayload,
  RespuestaGuardarReciboCambio,
} from "../types/logistica";
import {
  AccionesCarga,
  BloqueCarga,
  CargaGuiada,
  ResumenCarga,
} from "../components/ui/CargaGuiada";
import { useRevisionCarga } from "../components/ui/useRevisionCarga";
import { mensajeCarga } from "../components/ui/mensajeCarga";

interface FilaProducto {
  idLocal: number;
  productoId: string;
  cantidad: string;
  motivoId: string;
  observacion: string;
}
const vacia = (idLocal: number): FilaProducto => ({
  idLocal,
  productoId: "",
  cantidad: "",
  motivoId: "",
  observacion: "",
});
const camposOtros = [
  { campo: "pallets", nota: "pallets_observacion", titulo: "Pallets" },
  {
    campo: "pallets_descargados",
    nota: "pallets_descargados_observacion",
    titulo: "Pallets descargados",
  },
  { campo: "prensados", nota: "prensados_observacion", titulo: "Prensados" },
] as const;
const otrosVacios = {
  pallets: "",
  pallets_observacion: "",
  pallets_descargados: "",
  pallets_descargados_observacion: "",
  prensados: "",
  prensados_observacion: "",
};

export default function NuevoReciboCambioPage() {
  const cache = useQueryClient();
  const revision = useRevisionCarga();
  const [fecha, setFecha] = useState(() =>
    new Date().toLocaleDateString("sv-SE"),
  );
  const [concesionarioId, setConcesionarioId] = useState("");
  const [otros, setOtros] = useState(otrosVacios);
  const [filas, setFilas] = useState<FilaProducto[]>([vacia(1)]);
  const siguiente = useRef(2);
  const [guardado, setGuardado] = useState<RespuestaGuardarReciboCambio | null>(
    null,
  );
  const concesionariosQuery = useQuery({
    queryKey: ["concesionarios"],
    queryFn: obtenerConcesionarios,
  });
  const productosQuery = useQuery({
    queryKey: ["productos"],
    queryFn: obtenerProductos,
  });
  const concesionarios = concesionariosQuery.data || [];
  const productos = productosQuery.data || [];
  const producto = (id: string) => productos.find((p) => String(p.id) === id);
  const familias = [
    ...new Set(
      filas.map((f) => producto(f.productoId)?.familia || "").filter(Boolean),
    ),
  ];
  const consultasMotivos = useQueries({
    queries: familias.map((familia) => ({
      queryKey: ["motivos-cambio", familia],
      queryFn: () => obtenerMotivosCambio(familia),
    })),
  });
  const motivos = (familia: string) =>
    consultasMotivos[familias.indexOf(familia)]?.data || [];
  const consultas = [concesionariosQuery, productosQuery, ...consultasMotivos];
  const cargando = consultas.some((q) => q.isPending);
  const fallo = consultas.some((q) => q.isError);
  const sinConcesionarios =
    !concesionariosQuery.isPending &&
    !concesionariosQuery.isError &&
    !concesionarios.length;
  const concesionario =
    concesionarios.find((c) => String(c.id) === concesionarioId)?.nombre ||
    "Sin seleccionar";
  const filasConDatos = filas.filter(
    (f) => f.productoId || f.cantidad || f.motivoId || f.observacion.trim(),
  );
  const mutation = useMutation({
    mutationFn: guardarReciboCambio,
    onSuccess: (respuesta) => {
      setGuardado(respuesta);
      void cache.invalidateQueries({ queryKey: ["recibos-cambio"] });
      revision.enfocar();
    },
    onError: (e) =>
      revision.mostrarError(
        `No se pudo guardar el recibo. Los datos siguen en pantalla. ${mensajeCarga(e)}`,
      ),
    onSettled: () => {
      revision.terminarGuardar();
    },
  });
  function cambiar(
    id: number,
    campo: keyof Omit<FilaProducto, "idLocal">,
    valor: string,
  ) {
    setFilas((actuales) =>
      actuales.map((f) =>
        f.idLocal === id
          ? {
              ...f,
              [campo]: valor,
              ...(campo === "productoId" ? { motivoId: "" } : {}),
            }
          : f,
      ),
    );
  }
  function validar() {
    if (!fecha || !concesionarioId) {
      revision.mostrarError("Completá la fecha y el concesionario.");
      return false;
    }
    for (const f of filasConDatos) {
      const posicion = filas.findIndex((x) => x.idLocal === f.idLocal) + 1;
      if (
        !producto(f.productoId) ||
        !f.cantidad ||
        !Number.isFinite(Number(f.cantidad)) ||
        Number(f.cantidad) <= 0
      ) {
        revision.mostrarError(
          `En el producto ${posicion}, elegí un producto e ingresá una cantidad mayor a cero. Si no corresponde, usá Quitar producto o dejá la tarjeta completamente vacía.`,
        );
        return false;
      }
      if (
        f.motivoId &&
        !motivos(producto(f.productoId)?.familia || "").some(
          (m) => String(m.id) === f.motivoId,
        )
      ) {
        revision.mostrarError(
          `Revisá el motivo del producto ${posicion}. Debe corresponder al producto seleccionado.`,
        );
        return false;
      }
    }
    for (const c of camposOtros) {
      if (
        !Number.isFinite(Number(otros[c.campo] || 0)) ||
        Number(otros[c.campo] || 0) < 0
      ) {
        revision.mostrarError(
          `${c.titulo}: ingresá una cantidad válida, sin números negativos.`,
        );
        return false;
      }
    }
    return true;
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (
      mutation.isPending ||
      guardado ||
      cargando ||
      fallo ||
      sinConcesionarios ||
      !validar()
    )
      return;
    if (!revision.revisando) {
      revision.revisar();
      return;
    }
    const payload: CrearReciboCambioPayload = {
      fecha,
      concesionario_id: Number(concesionarioId),
      pallets: Number(otros.pallets || 0),
      pallets_observacion: otros.pallets_observacion.trim(),
      pallets_descargados: Number(otros.pallets_descargados || 0),
      pallets_descargados_observacion:
        otros.pallets_descargados_observacion.trim(),
      prensados: Number(otros.prensados || 0),
      prensados_observacion: otros.prensados_observacion.trim(),
      detalles: filasConDatos.map((f) => ({
        producto_id: Number(f.productoId),
        cantidad: Number(f.cantidad),
        motivo_id: f.motivoId ? Number(f.motivoId) : null,
        observacion: f.observacion.trim(),
      })),
    };
    if (!revision.intentarGuardar()) return;
    revision.setError("");
    mutation.mutate(payload);
  }
  const datos: [string, string][] = [
    ["Fecha", fecha.split("-").reverse().join("/")],
    ["Concesionario", concesionario],
  ];
  const advertencia =
    "Si ya existe un recibo para esta fecha y concesionario, esta carga se suma al recibo existente. No reemplaza lo cargado anteriormente.";
  return (
    <CargaGuiada
      titulo="Nuevo recibo de cambios"
      seccion="RECIBOS DE CAMBIOS"
      guardado={!!guardado}
      revision={revision}
    >
      {guardado ? (
        <section className="nr-card nr-success">
          <h2>
            {guardado.creado
              ? "Listo, se creó el recibo"
              : "Listo, la carga se agregó al recibo existente"}{" "}
            N.º {guardado.recibo.id}
          </h2>
          <p>
            {guardado.creado
              ? "El recibo ya aparece en el historial."
              : "Se conservaron las cargas anteriores. Los valores que siguen son los totales actuales del recibo."}
          </p>
          <ResumenCarga
            datos={[
              ["Fecha", guardado.recibo.fecha.split("-").reverse().join("/")],
              ["Concesionario", guardado.recibo.concesionario_nombre],
              ...camposOtros.map(
                (c) => [c.titulo, guardado.recibo[c.campo]] as [string, string],
              ),
            ]}
          />
          <div className="nr-receipt-summary">
            <h3>Productos del recibo guardado</h3>
            {guardado.recibo.detalles.length ? (
              guardado.recibo.detalles.map((d) => (
                <article key={d.id}>
                  <h3>
                    {d.producto_codigo} · {d.producto_nombre}
                  </h3>
                  <ResumenCarga
                    datos={[
                      ["Cantidad", d.cantidad],
                      ["Motivo", d.motivo_nombre || "Sin clasificar"],
                      ["Observación", d.observacion || "Sin observaciones"],
                    ]}
                  />
                </article>
              ))
            ) : (
              <p>Sin productos: se registraron los otros datos del recibo.</p>
            )}
          </div>
          <div className="nr-actions">
            <button
              className="nr-primary"
              type="button"
              onClick={() => {
                setGuardado(null);
                setOtros(otrosVacios);
                setFilas([vacia(siguiente.current++)]);
                mutation.reset();
                revision.corregir();
              }}
            >
              Cargar otro recibo
            </button>
            <Link className="nr-secondary" to="/cambios">
              Ver historial de recibos
            </Link>
          </div>
        </section>
      ) : (
        <form
          onSubmit={enviar}
          className={revision.revisando ? "nr-review" : "nr-form"}
          aria-busy={mutation.isPending}
        >
          {revision.revisando ? (
            <>
              <section className="nr-card">
                <h2>Resumen de la nueva carga</h2>
                <ResumenCarga datos={datos} />
                <div className="nr-receipt-summary">
                  <h3>Productos que vas a agregar</h3>
                  {filasConDatos.length ? (
                    filasConDatos.map((f, i) => (
                      <article key={f.idLocal}>
                        <h3>
                          Producto {i + 1}: {producto(f.productoId)?.codigo} ·{" "}
                          {producto(f.productoId)?.nombre}
                        </h3>
                        <ResumenCarga
                          datos={[
                            ["Cantidad", f.cantidad],
                            [
                              "Motivo",
                              motivos(
                                producto(f.productoId)?.familia || "",
                              ).find((m) => String(m.id) === f.motivoId)
                                ?.nombre || "Sin clasificar",
                            ],
                            [
                              "Observación",
                              f.observacion.trim() || "Sin observaciones",
                            ],
                          ]}
                        />
                      </article>
                    ))
                  ) : (
                    <p>No se agregarán productos.</p>
                  )}
                </div>
                <div className="nr-receipt-summary">
                  <h3>Otros movimientos que vas a agregar</h3>
                  <ResumenCarga
                    datos={camposOtros.flatMap(
                      (c) =>
                        [
                          [c.titulo, otros[c.campo] || "0"],
                          [
                            `Observación de ${c.titulo.toLowerCase()}`,
                            otros[c.nota].trim() || "Sin observaciones",
                          ],
                        ] as [string, string][],
                    )}
                  />
                </div>
              </section>
              <p className="nr-warning">{advertencia}</p>
            </>
          ) : (
            <>
              <p className="nr-required">
                La <strong>fecha</strong> y el <strong>concesionario</strong>{" "}
                son obligatorios. Agregá los productos o los otros movimientos
                que correspondan.
              </p>
              {cargando && (
                <p className="nr-info" role="status">
                  Cargando las listas necesarias…
                </p>
              )}
              {fallo && (
                <div className="nr-error" role="alert">
                  <strong>No se pudieron cargar las listas</strong>
                  <p>
                    Comprobá la conexión y volvé a intentar. Tus datos siguen en
                    pantalla.
                  </p>
                  <button
                    className="nr-secondary"
                    type="button"
                    onClick={() =>
                      void Promise.all(consultas.map((q) => q.refetch()))
                    }
                  >
                    Volver a intentar
                  </button>
                </div>
              )}
              {sinConcesionarios && (
                <p className="nr-error" role="alert">
                  No hay concesionarios disponibles. Pedile al administrador que
                  revise el listado.
                </p>
              )}
              <BloqueCarga
                numero={1}
                titulo="Datos del recibo"
                ayuda="Indicá la fecha y a quién corresponde la carga."
                disabled={
                  concesionariosQuery.isPending || concesionariosQuery.isError
                }
              >
                <div className="nr-grid">
                  <label htmlFor="recibo-fecha">
                    Fecha <span>(obligatorio)</span>
                    <input
                      id="recibo-fecha"
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                    />
                  </label>
                  <label htmlFor="recibo-concesionario">
                    Concesionario <span>(obligatorio)</span>
                    <select
                      id="recibo-concesionario"
                      aria-label="Concesionario (obligatorio)"
                      required
                      value={concesionarioId}
                      onChange={(e) => setConcesionarioId(e.target.value)}
                    >
                      <option value="">Elegí el concesionario</option>
                      {concesionarios.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </BloqueCarga>
              <BloqueCarga
                numero={2}
                titulo="Productos a cambiar"
                ayuda="Completá una tarjeta por producto. Si solo registrás pallets o prensados, podés dejar este bloque vacío."
                disabled={productosQuery.isPending || productosQuery.isError}
              >
                {!productos.length &&
                  !productosQuery.isPending &&
                  !productosQuery.isError && (
                    <p className="nr-info">
                      No hay productos disponibles. Podés registrar los otros
                      movimientos; para agregar productos, consultá al
                      administrador.
                    </p>
                  )}
                {filas.map((f, i) => {
                  const p = producto(f.productoId);
                  const query =
                    consultasMotivos[familias.indexOf(p?.familia || "")];
                  return (
                    <section
                      className="nr-product"
                      key={f.idLocal}
                      aria-labelledby={`recibo-producto-titulo-${f.idLocal}`}
                    >
                      <div className="nr-product-heading">
                        <h3 id={`recibo-producto-titulo-${f.idLocal}`}>
                          Producto {i + 1}
                        </h3>
                        {filas.length > 1 && (
                          <button
                            className="nr-remove"
                            type="button"
                            aria-label={`Quitar producto ${i + 1}`}
                            onClick={() => {
                              setFilas((v) =>
                                v.filter((x) => x.idLocal !== f.idLocal),
                              );
                              requestAnimationFrame(() =>
                                document
                                  .getElementById("recibo-agregar")
                                  ?.focus(),
                              );
                            }}
                          >
                            Quitar producto
                          </button>
                        )}
                      </div>
                      <div className="nr-grid">
                        <label htmlFor={`recibo-producto-${f.idLocal}`}>
                          Producto
                          <select
                            id={`recibo-producto-${f.idLocal}`}
                            aria-label={`Producto ${i + 1}`}
                            value={f.productoId}
                            required={
                              !!(
                                f.cantidad ||
                                f.motivoId ||
                                f.observacion.trim()
                              )
                            }
                            onChange={(e) =>
                              cambiar(f.idLocal, "productoId", e.target.value)
                            }
                          >
                            <option value="">Elegí el producto</option>
                            {productos.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.codigo} · {x.nombre}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label htmlFor={`recibo-cantidad-${f.idLocal}`}>
                          Cantidad{" "}
                          <span>(obligatoria si elegís un producto)</span>
                          <input
                            id={`recibo-cantidad-${f.idLocal}`}
                            aria-label={`Cantidad del producto ${i + 1}`}
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            step="0.01"
                            required={!!f.productoId}
                            value={f.cantidad}
                            onChange={(e) =>
                              cambiar(f.idLocal, "cantidad", e.target.value)
                            }
                            placeholder="Ejemplo: 12"
                          />
                        </label>
                        <label htmlFor={`recibo-motivo-${f.idLocal}`}>
                          Motivo <span>(opcional)</span>
                          <select
                            id={`recibo-motivo-${f.idLocal}`}
                            aria-label={`Motivo del producto ${i + 1}`}
                            disabled={
                              !p?.familia || query?.isPending || query?.isError
                            }
                            value={f.motivoId}
                            onChange={(e) =>
                              cambiar(f.idLocal, "motivoId", e.target.value)
                            }
                          >
                            <option value="">Sin clasificar</option>
                            {motivos(p?.familia || "").map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nombre}
                              </option>
                            ))}
                          </select>
                          <small>
                            Primero elegí el producto para ver sus motivos.
                          </small>
                        </label>
                        <label htmlFor={`recibo-observacion-${f.idLocal}`}>
                          Observación del producto <span>(opcional)</span>
                          <input
                            id={`recibo-observacion-${f.idLocal}`}
                            aria-label={`Observación del producto ${i + 1}`}
                            value={f.observacion}
                            onChange={(e) =>
                              cambiar(f.idLocal, "observacion", e.target.value)
                            }
                            placeholder="Solo si hay algo que aclarar"
                          />
                        </label>
                      </div>
                    </section>
                  );
                })}
                <button
                  id="recibo-agregar"
                  className="nr-secondary"
                  type="button"
                  disabled={!productos.length}
                  onClick={() => {
                    const id = siguiente.current++;
                    setFilas((v) => [...v, vacia(id)]);
                    requestAnimationFrame(() =>
                      document.getElementById(`recibo-producto-${id}`)?.focus(),
                    );
                  }}
                >
                  + Agregar otro producto
                </button>
              </BloqueCarga>
              <BloqueCarga
                numero={3}
                titulo="Pallets y prensados"
                ayuda="Completá solo los movimientos que correspondan. Los campos vacíos se guardan como cero."
              >
                {camposOtros.map((c) => (
                  <section className="nr-other" key={c.campo}>
                    <label htmlFor={`recibo-${c.campo}`}>
                      {c.titulo} <span>(opcional)</span>
                      <input
                        id={`recibo-${c.campo}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={otros[c.campo]}
                        onChange={(e) => {
                          const valor = e.currentTarget.value;
                          setOtros((v) => ({ ...v, [c.campo]: valor }));
                        }}
                        placeholder="0"
                      />
                    </label>
                    <details className="nr-notes">
                      <summary>
                        Agregar observación de {c.titulo.toLowerCase()}{" "}
                        (opcional)
                      </summary>
                      <label htmlFor={`recibo-${c.nota}`}>
                        Observación de {c.titulo.toLowerCase()}
                        <textarea
                          id={`recibo-${c.nota}`}
                          rows={2}
                          value={otros[c.nota]}
                          onChange={(e) => {
                            const valor = e.currentTarget.value;
                            setOtros((v) => ({ ...v, [c.nota]: valor }));
                          }}
                        />
                      </label>
                    </details>
                  </section>
                ))}
              </BloqueCarga>
            </>
          )}
          <AccionesCarga
            revisando={revision.revisando}
            ocupado={mutation.isPending}
            disabled={cargando || fallo || sinConcesionarios}
            corregir={revision.corregir}
            confirmar="Confirmar y guardar recibo"
          />
        </form>
      )}
    </CargaGuiada>
  );
}
