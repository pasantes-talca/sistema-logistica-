import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  crearRechazo,
  obtenerAsignaciones,
  obtenerMotivosRechazo,
} from "../api/logistica";
import type { Rechazo } from "../types/logistica";
import {
  AccionesCarga,
  BloqueCarga,
  CargaGuiada,
  ResumenCarga,
} from "../components/ui/CargaGuiada";
import { useRevisionCarga } from "../components/ui/useRevisionCarga";
import { mensajeCarga } from "../components/ui/mensajeCarga";

export default function NuevoRechazoPage() {
  const cache = useQueryClient();
  const revision = useRevisionCarga();
  const [fecha, setFecha] = useState(() =>
    new Date().toLocaleDateString("sv-SE"),
  );
  const [asignacionId, setAsignacionId] = useState("");
  const [puntoVenta, setPuntoVenta] = useState("");
  const [bultos, setBultos] = useState("");
  const [motivoId, setMotivoId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [guardado, setGuardado] = useState<Rechazo | null>(null);
  const asignacionesQuery = useQuery({
    queryKey: ["asignaciones"],
    queryFn: obtenerAsignaciones,
  });
  const motivosQuery = useQuery({
    queryKey: ["motivos-rechazo"],
    queryFn: obtenerMotivosRechazo,
  });
  const consultas = [asignacionesQuery, motivosQuery];
  const cargando = consultas.some((q) => q.isPending);
  const fallo = consultas.some((q) => q.isError);
  const asignaciones = asignacionesQuery.data || [];
  const motivos = motivosQuery.data || [];
  const sinListas =
    !cargando && !fallo && (!asignaciones.length || !motivos.length);
  const mutation = useMutation({
    mutationFn: crearRechazo,
    onSuccess: (rechazo) => {
      setGuardado(rechazo);
      void cache.invalidateQueries({ queryKey: ["rechazos"] });
      revision.enfocar();
    },
    onError: (e) =>
      revision.mostrarError(
        `No se pudo guardar el rechazo. Los datos siguen en pantalla. ${mensajeCarga(e)}`,
      ),
    onSettled: () => {
      revision.terminarGuardar();
    },
  });
  function validar() {
    if (
      !fecha ||
      !asignacionId ||
      !puntoVenta.trim() ||
      !bultos.trim() ||
      !motivoId
    ) {
      revision.mostrarError(
        "Completá la fecha, la asignación, el punto de venta, los bultos y el motivo de no entrega.",
      );
      return false;
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
      sinListas ||
      !validar()
    )
      return;
    if (!revision.revisando) {
      revision.revisar();
      return;
    }
    if (!revision.intentarGuardar()) return;
    revision.setError("");
    mutation.mutate({
      fecha,
      asignacion_id: Number(asignacionId),
      punto_venta: puntoVenta.trim(),
      bultos: bultos.trim(),
      motivo_id: Number(motivoId),
      observacion: observacion.trim(),
    });
  }
  const resumen: [string, string][] = [
    ["Fecha", fecha.split("-").reverse().join("/")],
    [
      "Asignación",
      asignaciones.find((a) => String(a.id) === asignacionId)?.codigo ||
        "Sin seleccionar",
    ],
    ["Punto de venta", puntoVenta.trim()],
    ["Bultos", bultos.trim()],
    [
      "Motivo de no entrega",
      motivos.find((m) => String(m.id) === motivoId)?.nombre ||
        "Sin seleccionar",
    ],
    ["Observación", observacion.trim() || "Sin observaciones"],
  ];
  return (
    <CargaGuiada
      titulo="Nuevo rechazo"
      seccion="RECHAZOS · ENTREGA NO REALIZADA"
      guardado={!!guardado}
      revision={revision}
    >
      {guardado ? (
        <section className="nr-card nr-success">
          <h2>Listo, el rechazo N.º {guardado.id} quedó registrado</h2>
          <p>La entrega no realizada ya aparece en el historial.</p>
          <ResumenCarga datos={resumen} />
          <div className="nr-actions">
            <button
              className="nr-primary"
              type="button"
              onClick={() => {
                setGuardado(null);
                setPuntoVenta("");
                setBultos("");
                setMotivoId("");
                setObservacion("");
                mutation.reset();
                revision.corregir();
              }}
            >
              Cargar otro rechazo
            </button>
            <Link className="nr-secondary" to="/rechazos">
              Ver historial de rechazos
            </Link>
          </div>
        </section>
      ) : (
        <form
          className={revision.revisando ? "nr-review" : "nr-form"}
          onSubmit={enviar}
          aria-busy={mutation.isPending}
        >
          {revision.revisando ? (
            <section className="nr-card">
              <h2>Resumen del rechazo</h2>
              <ResumenCarga datos={resumen} />
            </section>
          ) : (
            <>
              <p className="nr-required">
                Completá los campos que dicen <strong>obligatorio</strong>. La
                observación es opcional.
              </p>
              {cargando && (
                <p className="nr-info" role="status">
                  Cargando asignaciones y motivos…
                </p>
              )}
              {fallo && (
                <div className="nr-error" role="alert">
                  <strong>No se pudieron cargar las listas</strong>
                  <p>
                    Comprobá la conexión y volvé a intentar. No se borró lo que
                    completaste.
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
              {sinListas && (
                <p className="nr-error" role="alert">
                  Faltan asignaciones o motivos disponibles. Pedile al
                  administrador que revise los listados.
                </p>
              )}
              <BloqueCarga
                numero={1}
                titulo="Datos de la entrega"
                ayuda="Indicá cuándo y en qué reparto ocurrió."
                disabled={cargando || fallo}
              >
                <div className="nr-grid">
                  <label htmlFor="rechazo-fecha">
                    Fecha <span>(obligatorio)</span>
                    <input
                      id="rechazo-fecha"
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                    />
                  </label>
                  <label htmlFor="rechazo-asignacion">
                    Asignación <span>(obligatorio)</span>
                    <select
                      id="rechazo-asignacion"
                      aria-label="Asignación (obligatorio)"
                      required
                      value={asignacionId}
                      onChange={(e) => setAsignacionId(e.target.value)}
                    >
                      <option value="">Elegí una asignación</option>
                      {asignaciones.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.codigo}
                          {a.descripcion ? ` · ${a.descripcion}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </BloqueCarga>
              <BloqueCarga
                numero={2}
                titulo="¿Dónde y cuánto no se entregó?"
                ayuda="Identificá el punto de venta y los bultos rechazados."
                disabled={cargando || fallo}
              >
                <div className="nr-grid">
                  <label htmlFor="rechazo-punto">
                    Punto de venta <span>(obligatorio)</span>
                    <input
                      id="rechazo-punto"
                      required
                      maxLength={250}
                      value={puntoVenta}
                      onChange={(e) => setPuntoVenta(e.target.value)}
                      placeholder="Ejemplo: Vea 34"
                    />
                  </label>
                  <label htmlFor="rechazo-bultos">
                    Bultos <span>(obligatorio)</span>
                    <input
                      id="rechazo-bultos"
                      required
                      maxLength={100}
                      value={bultos}
                      onChange={(e) => setBultos(e.target.value)}
                      placeholder="Ejemplo: 54"
                    />
                  </label>
                </div>
              </BloqueCarga>
              <BloqueCarga
                numero={3}
                titulo="¿Por qué no se entregó?"
                ayuda="Elegí el motivo y, si hace falta, agregá una aclaración."
                disabled={cargando || fallo}
              >
                <label htmlFor="rechazo-motivo">
                  Motivo de no entrega <span>(obligatorio)</span>
                  <select
                    id="rechazo-motivo"
                    aria-label="Motivo de no entrega (obligatorio)"
                    required
                    value={motivoId}
                    onChange={(e) => setMotivoId(e.target.value)}
                  >
                    <option value="">Elegí el motivo</option>
                    {motivos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <details className="nr-notes">
                  <summary>Agregar una observación (opcional)</summary>
                  <label htmlFor="rechazo-observacion">
                    Observación
                    <textarea
                      id="rechazo-observacion"
                      rows={3}
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                      placeholder="Escribí acá si hay algo que aclarar."
                    />
                  </label>
                </details>
              </BloqueCarga>
            </>
          )}
          <AccionesCarga
            revisando={revision.revisando}
            ocupado={mutation.isPending}
            disabled={cargando || fallo || sinListas}
            corregir={revision.corregir}
            confirmar="Confirmar y guardar rechazo"
          />
        </form>
      )}
    </CargaGuiada>
  );
}
