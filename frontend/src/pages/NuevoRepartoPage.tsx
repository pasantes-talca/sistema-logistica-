import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  crearReparto,
  obtenerAsignaciones,
  obtenerAyudantes,
  obtenerChoferes,
  obtenerVehiculos,
} from "../api/logistica";
import type { Reparto } from "../types/logistica";
import "./NuevoRepartoPage.css";

const fechaActual = () => new Date().toLocaleDateString("sv-SE");
const numero = (value: number) => value.toLocaleString("es-AR");

export default function NuevoRepartoPage() {
  const cache = useQueryClient();
  const [fecha, setFecha] = useState(fechaActual);
  const [vehiculoId, setVehiculoId] = useState("");
  const [asignacionId, setAsignacionId] = useState("");
  const [choferId, setChoferId] = useState("");
  const [ayudantesIds, setAyudantesIds] = useState<string[]>([]);
  const [bultos, setBultos] = useState("");
  const [puntosVenta, setPuntosVenta] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [guardado, setGuardado] = useState<Reparto | null>(null);
  const [error, setError] = useState("");
  const [avisoChofer, setAvisoChofer] = useState("");
  const titulo = useRef<HTMLHeadingElement>(null);
  const alerta = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const choferesQuery = useQuery({
    queryKey: ["choferes"],
    queryFn: obtenerChoferes,
  });
  const ayudantesQuery = useQuery({
    queryKey: ["ayudantes"],
    queryFn: obtenerAyudantes,
  });
  const vehiculosQuery = useQuery({
    queryKey: ["vehiculos"],
    queryFn: obtenerVehiculos,
  });
  const asignacionesQuery = useQuery({
    queryKey: ["asignaciones"],
    queryFn: obtenerAsignaciones,
  });
  const consultas = [
    choferesQuery,
    ayudantesQuery,
    vehiculosQuery,
    asignacionesQuery,
  ];
  const cargando = consultas.some((q) => q.isPending);
  const falloConsulta = consultas.some((q) => q.isError);
  const choferes = choferesQuery.data || [];
  const ayudantes = ayudantesQuery.data || [];
  const vehiculos = vehiculosQuery.data || [];
  const asignaciones = asignacionesQuery.data || [];
  const ayudantesElegidos = ayudantesIds.filter(Boolean);
  const nombreChofer =
    choferes.find((c) => String(c.id) === choferId)?.nombre ||
    "Sin seleccionar";
  const patente =
    vehiculos.find((v) => String(v.id) === vehiculoId)?.patente ||
    "Sin indicar";
  const asignacion =
    asignaciones.find((a) => String(a.id) === asignacionId)?.codigo ||
    "Sin indicar";
  const enfocarTitulo = () =>
    requestAnimationFrame(() => {
      titulo.current?.focus();
      titulo.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  const mostrarError = (texto: string) => {
    setError(texto);
    requestAnimationFrame(() => alerta.current?.focus());
  };
  const guardar = useMutation({
    mutationFn: crearReparto,
    onSuccess: (reparto) => {
      setGuardado(reparto);
      void cache.invalidateQueries({ queryKey: ["repartos"] });
      enfocarTitulo();
    },
    onError: (e) =>
      mostrarError(
        `No se pudo guardar el reparto. Los datos siguen en pantalla. ${e.message}`,
      ),
    onSettled: () => {
      lock.current = false;
    },
  });

  function cambiarAsignacion(id: string) {
    setAsignacionId(id);
    const asignada = asignaciones.find((a) => String(a.id) === id);
    const predeterminado = choferes.find(
      (c) => c.id === asignada?.chofer_predeterminado_id,
    );
    if (predeterminado) {
      setChoferId(String(predeterminado.id));
      setAvisoChofer(
        `Se seleccionó a ${predeterminado.nombre} por la asignación. Podés cambiarlo si hace falta.`,
      );
    } else setAvisoChofer("");
  }

  function validar(): boolean {
    if (!fecha || !vehiculoId || !asignacionId || !choferId || bultos === "") {
      mostrarError(
        "Completá la fecha, la patente, la asignación, el chofer y la cantidad de bultos.",
      );
      return false;
    }
    if (!Number.isInteger(Number(bultos)) || Number(bultos) < 0) {
      mostrarError(
        "Ingresá una cantidad de bultos entera, sin números negativos.",
      );
      return false;
    }
    if (ayudantesIds.some((id) => !id)) {
      mostrarError(
        "Seleccioná cada ayudante agregado o usá Quitar si no participa.",
      );
      return false;
    }
    if (
      ayudantesElegidos.includes(choferId) ||
      new Set(ayudantesElegidos).size !== ayudantesElegidos.length
    ) {
      mostrarError(
        "Cada persona debe aparecer una sola vez: el chofer no puede figurar también como ayudante.",
      );
      return false;
    }
    return true;
  }

  function revisar(event: FormEvent) {
    event.preventDefault();
    if (cargando || falloConsulta || !validar()) return;
    setError("");
    setRevisando(true);
    enfocarTitulo();
  }

  function confirmar(event: FormEvent) {
    event.preventDefault();
    if (
      lock.current ||
      guardar.isPending ||
      guardado ||
      !revisando ||
      !validar()
    )
      return;
    lock.current = true;
    setError("");
    guardar.mutate({
      fecha,
      vehiculo_id: Number(vehiculoId),
      asignacion_id: Number(asignacionId),
      chofer_id: Number(choferId),
      ayudantes_ids: ayudantesElegidos.map(Number),
      bultos: Number(bultos),
      puntos_venta: puntosVenta,
      observaciones,
    });
  }

  function nuevo() {
    setVehiculoId("");
    setAsignacionId("");
    setChoferId("");
    setAyudantesIds([]);
    setBultos("");
    setPuntosVenta("");
    setObservaciones("");
    setError("");
    setAvisoChofer("");
    setRevisando(false);
    setGuardado(null);
    guardar.reset();
    enfocarTitulo();
  }

  return (
    <div className="pagina nr-page">
      <div className="nr-container">
        <header className="nr-header">
          <span className="nr-kicker">REPARTOS Y RECARGAS</span>
          <h1 ref={titulo} tabIndex={-1}>
            {guardado
              ? "Reparto guardado"
              : revisando
                ? "Revisá antes de guardar"
                : "Nuevo reparto"}
          </h1>
          <p>
            {guardado
              ? "La carga se completó correctamente. No hace falta volver a enviarla."
              : revisando
                ? "Comprobá estos datos. Si está todo bien, confirmá al final."
                : "Completá los tres bloques. Después vas a poder revisar los datos antes de guardarlos."}
          </p>
          {!guardado && (
            <ol className="nr-progress" aria-label="Etapas de la carga">
              <li
                aria-current={!revisando ? "step" : undefined}
                className={!revisando ? "active" : ""}
              >
                <span aria-hidden="true">1</span>Completar datos
              </li>
              <li
                aria-current={revisando ? "step" : undefined}
                className={revisando ? "active" : ""}
              >
                <span aria-hidden="true">2</span>Revisar y guardar
              </li>
            </ol>
          )}
        </header>
        {error && (
          <div ref={alerta} className="nr-error" role="alert" tabIndex={-1}>
            <strong>Revisá lo siguiente</strong>
            <p>{error}</p>
          </div>
        )}
        {guardado ? (
          <section
            className="nr-card nr-success"
            aria-labelledby="nr-success-title"
          >
            <h2 id="nr-success-title">
              Listo, el reparto N.º {guardado.id} quedó registrado
            </h2>
            <p>Las recargas fueron calculadas por el sistema.</p>
            <dl className="nr-summary">
              <div>
                <dt>Bultos registrados</dt>
                <dd>{numero(guardado.bultos)}</dd>
              </div>
              <div>
                <dt>Recargas por persona</dt>
                <dd>{numero(guardado.recargas)}</dd>
              </div>
              <div>
                <dt>Recargas totales</dt>
                <dd>{numero(guardado.recargas_totales)}</dd>
              </div>
            </dl>
            <div className="nr-actions">
              <button type="button" className="nr-primary" onClick={nuevo}>
                Cargar otro reparto
              </button>
              <Link to="/repartos" className="nr-secondary">
                Ver historial de repartos
              </Link>
            </div>
          </section>
        ) : revisando ? (
          <form
            onSubmit={confirmar}
            className="nr-review"
            aria-busy={guardar.isPending}
          >
            <section className="nr-card" aria-labelledby="nr-review-title">
              <h2 id="nr-review-title">Resumen del reparto</h2>
              <dl className="nr-summary">
                {[
                  ["Fecha", fecha.split("-").reverse().join("/")],
                  ["Patente", patente],
                  ["Asignación", asignacion],
                  ["Chofer", nombreChofer],
                  [
                    "Ayudantes",
                    ayudantesElegidos
                      .map(
                        (id) =>
                          ayudantes.find((a) => String(a.id) === id)?.nombre,
                      )
                      .join(", ") || "Sin ayudantes",
                  ],
                  ["Cantidad de bultos", numero(Number(bultos))],
                  ["Puntos de venta", puntosVenta || "Sin indicar"],
                  ["Observaciones", observaciones || "Sin observaciones"],
                ].map(([label, valor]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="nr-savebar">
              <p>Las recargas se calcularán automáticamente al guardar.</p>
              <div className="nr-actions">
                <button
                  type="button"
                  className="nr-secondary"
                  disabled={guardar.isPending}
                  onClick={() => {
                    setRevisando(false);
                    setError("");
                    enfocarTitulo();
                  }}
                >
                  Volver a corregir
                </button>
                <button
                  type="submit"
                  className="nr-primary"
                  disabled={guardar.isPending}
                >
                  {guardar.isPending
                    ? "Guardando… esperá un momento"
                    : "Confirmar y guardar reparto"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <>
            {cargando && (
              <p role="status" className="nr-info">
                Cargando las listas de vehículos y personal…
              </p>
            )}
            {falloConsulta && (
              <div role="alert" className="nr-error">
                <strong>No se pudieron cargar las listas</strong>
                <p>
                  Comprobá la conexión y volvé a intentar. No se borró lo que ya
                  completaste.
                </p>
                <button
                  type="button"
                  className="nr-secondary"
                  onClick={() =>
                    void Promise.all(consultas.map((q) => q.refetch()))
                  }
                >
                  Volver a intentar
                </button>
              </div>
            )}
            <form onSubmit={revisar} className="nr-form">
              <p className="nr-required">
                Los campos que dicen <strong>obligatorio</strong> deben
                completarse. Los demás son opcionales.
              </p>
              <fieldset
                className="nr-card"
                disabled={cargando || falloConsulta}
              >
                <legend>
                  <span className="nr-number" aria-hidden="true">
                    1
                  </span>{" "}
                  Datos del viaje
                </legend>
                <p>Indicá cuándo se hizo el reparto y el vehículo utilizado.</p>
                <div className="nr-grid">
                  <label htmlFor="nr-fecha">
                    Fecha del reparto <span>(obligatorio)</span>
                    <input
                      id="nr-fecha"
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </label>
                  <label htmlFor="nr-patente">
                    Patente <span>(obligatorio)</span>
                    <select
                      id="nr-patente"
                      required
                      value={vehiculoId}
                      onChange={(e) => setVehiculoId(e.target.value)}
                    >
                      <option value="">Elegí un vehículo</option>
                      {vehiculos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.patente}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor="nr-asignacion" className="nr-wide">
                    Asignación <span>(obligatorio)</span>
                    <select
                      id="nr-asignacion"
                      aria-label="Asignación (obligatorio)"
                      required
                      value={asignacionId}
                      aria-describedby="nr-asignacion-help"
                      onChange={(e) => cambiarAsignacion(e.target.value)}
                    >
                      <option value="">Elegí una asignación</option>
                      {asignaciones.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.codigo}
                          {a.descripcion ? ` · ${a.descripcion}` : ""}
                        </option>
                      ))}
                    </select>
                    <small id="nr-asignacion-help">
                      Si tiene un chofer asignado, se completará en el bloque
                      siguiente.
                    </small>
                  </label>
                </div>
              </fieldset>
              <fieldset
                className="nr-card"
                disabled={cargando || falloConsulta}
              >
                <legend>
                  <span className="nr-number" aria-hidden="true">
                    2
                  </span>{" "}
                  ¿Quiénes participaron?
                </legend>
                <p>
                  Elegí al chofer y agregá a los ayudantes que lo acompañaron.
                </p>
                <label htmlFor="nr-chofer">
                  Chofer <span>(obligatorio)</span>
                  <select
                    id="nr-chofer"
                    aria-label="Chofer (obligatorio)"
                    required
                    value={choferId}
                    onChange={(e) => {
                      setChoferId(e.target.value);
                      setAvisoChofer("");
                    }}
                  >
                    <option value="">Elegí al chofer</option>
                    {choferes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                {avisoChofer && (
                  <p className="nr-info" role="status">
                    {avisoChofer}
                  </p>
                )}
                {!choferes.length && !cargando && !falloConsulta && (
                  <p role="alert" className="nr-error">
                    No hay choferes disponibles. Pedile al administrador que
                    revise el listado.
                  </p>
                )}
                <div className="nr-helpers">
                  <h3>
                    Ayudantes <span>(opcional)</span>
                  </h3>
                  {!ayudantesIds.length && (
                    <p>
                      No agregaste ayudantes. Si el chofer fue solo, dejalo así.
                    </p>
                  )}
                  {ayudantesIds.map((id, i) => (
                    <div className="nr-helper" key={i}>
                      <label htmlFor={`nr-ayudante-${i}`}>
                        Ayudante {i + 1}
                        <select
                          id={`nr-ayudante-${i}`}
                          aria-label={`Ayudante ${i + 1}`}
                          required
                          value={id}
                          onChange={(e) => {
                            const elegido = e.currentTarget.value;
                            setAyudantesIds((v) =>
                              v.map((value, index) =>
                                index === i ? elegido : value,
                              ),
                            );
                          }}
                        >
                          <option value="">Elegí un ayudante</option>
                          {ayudantes
                            .filter((a) => String(a.id) !== choferId)
                            .map((a) => (
                              <option
                                key={a.id}
                                value={a.id}
                                disabled={ayudantesIds.some(
                                  (value, index) =>
                                    index !== i && value === String(a.id),
                                )}
                              >
                                {a.nombre}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="nr-remove"
                        aria-label={`Quitar ayudante ${i + 1}`}
                        onClick={() => {
                          setAyudantesIds((v) =>
                            v.filter((_, index) => index !== i),
                          );
                          requestAnimationFrame(() =>
                            document.getElementById("nr-add-helper")?.focus(),
                          );
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    id="nr-add-helper"
                    type="button"
                    className="nr-secondary"
                    disabled={
                      !ayudantes.some(
                        (a) =>
                          String(a.id) !== choferId &&
                          !ayudantesIds.includes(String(a.id)),
                      ) || ayudantesIds.includes("")
                    }
                    onClick={() => {
                      const index = ayudantesIds.length;
                      setAyudantesIds((v) => [...v, ""]);
                      requestAnimationFrame(() =>
                        document
                          .getElementById(`nr-ayudante-${index}`)
                          ?.focus(),
                      );
                    }}
                  >
                    + Agregar ayudante
                  </button>
                </div>
              </fieldset>
              <fieldset
                className="nr-card"
                disabled={cargando || falloConsulta}
              >
                <legend>
                  <span className="nr-number" aria-hidden="true">
                    3
                  </span>{" "}
                  Cantidades del reparto
                </legend>
                <p>
                  Ingresá los bultos. El sistema se encarga de calcular las
                  recargas.
                </p>
                <div className="nr-grid">
                  <label htmlFor="nr-bultos">
                    Cantidad de bultos <span>(obligatorio)</span>
                    <input
                      id="nr-bultos"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      required
                      value={bultos}
                      onChange={(e) => setBultos(e.target.value)}
                      placeholder="Ejemplo: 350"
                    />
                  </label>
                  <label htmlFor="nr-puntos">
                    Puntos de venta <span>(opcional)</span>
                    <input
                      id="nr-puntos"
                      type="text"
                      value={puntosVenta}
                      onChange={(e) => setPuntosVenta(e.target.value)}
                    />
                  </label>
                </div>
                <details className="nr-notes">
                  <summary>Agregar una observación (opcional)</summary>
                  <label htmlFor="nr-observaciones">
                    Observaciones
                    <textarea
                      id="nr-observaciones"
                      rows={3}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Escribí acá si hay algo que aclarar sobre este reparto."
                    />
                  </label>
                </details>
              </fieldset>
              <div className="nr-savebar">
                <p>
                  <strong>Último paso:</strong> revisá la carga antes de
                  guardarla.
                </p>
                <button
                  type="submit"
                  className="nr-primary"
                  disabled={cargando || falloConsulta || !choferes.length}
                >
                  Revisar reparto →
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
