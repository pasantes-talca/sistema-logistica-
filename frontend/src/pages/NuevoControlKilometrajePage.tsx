import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  crearControlKilometraje,
  obtenerChoferes,
  obtenerDestinosKilometraje,
} from "../api/logistica";
import type { ControlKilometraje } from "../types/logistica";
import {
  AccionesCarga,
  BloqueCarga,
  CargaGuiada,
  ResumenCarga,
} from "../components/ui/CargaGuiada";
import { useRevisionCarga } from "../components/ui/useRevisionCarga";
import { mensajeCarga } from "../components/ui/mensajeCarga";
import {
  diasPeriodo,
  instanteFecha,
  moverDia,
  resumirViajes,
  type ViajesPorFecha,
} from "../components/ui/viajesKilometraje";
import "./CargaKilometrajeGuiada.css";

const fechaTexto = (fecha: string) => fecha.split("-").reverse().join("/");
const numero = (valor: number) =>
  valor.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export default function NuevoControlKilometrajePage() {
  const cache = useQueryClient();
  const revision = useRevisionCarga();
  const [choferId, setChoferId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [diaElegido, setDiaElegido] = useState("");
  const [viajes, setViajes] = useState<ViajesPorFecha>({});
  const [observaciones, setObservaciones] = useState("");
  const [aceptaExcluidos, setAceptaExcluidos] = useState(false);
  const [guardado, setGuardado] = useState<ControlKilometraje | null>(null);
  const choferesQuery = useQuery({
    queryKey: ["choferes"],
    queryFn: obtenerChoferes,
  });
  const destinosQuery = useQuery({
    queryKey: ["destinos-kilometraje"],
    queryFn: obtenerDestinosKilometraje,
  });
  const consultas = [choferesQuery, destinosQuery];
  const cargando = consultas.some((q) => q.isPending),
    fallo = consultas.some((q) => q.isError);
  const choferes = choferesQuery.data || [],
    destinos = destinosQuery.data || [];
  const bloqueado = cargando || fallo || !choferes.length || !destinos.length;
  const dias = diasPeriodo(desde, hasta);
  const dia =
    diaElegido >= desde &&
    diaElegido <= hasta &&
    instanteFecha(diaElegido) !== null
      ? diaElegido
      : desde;
  const resumen = resumirViajes(viajes, destinos, desde, hasta);
  const diaNumero = dias ? diasPeriodo(desde, dia) : 0;
  const totalDia = resumen.registros
    .filter((r) => r.fecha === dia)
    .reduce(
      (s, r) =>
        s +
        r.cantidad_viajes *
          Number(destinos.find((d) => d.id === r.destino)?.distancia_km || 0),
      0,
    );
  const mutation = useMutation({
    mutationFn: crearControlKilometraje,
    onSuccess: (control) => {
      setGuardado(control);
      void cache.invalidateQueries({ queryKey: ["controles-kilometraje"] });
      revision.enfocar();
    },
    onError: (e) =>
      revision.mostrarError(
        `No se pudo guardar el control. Los datos siguen en pantalla. ${mensajeCarga(e)}`,
      ),
    onSettled: revision.terminarGuardar,
  });
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (mutation.isPending || guardado || bloqueado) return;
    if (!choferId || !dias) {
      revision.mostrarError(
        "Elegí un chofer y un período válido. La fecha Hasta no puede ser anterior a Desde.",
      );
      return;
    }
    if (resumen.errores.length) {
      revision.mostrarError(resumen.errores[0]);
      return;
    }
    if (!revision.revisando) {
      setAceptaExcluidos(false);
      revision.revisar();
      return;
    }
    if (resumen.excluidos && !aceptaExcluidos) {
      revision.mostrarError(
        "Confirmá que entendés que los viajes fuera del período no se incluirán, o volvé a corregir las fechas.",
      );
      return;
    }
    if (!revision.intentarGuardar()) return;
    revision.setError("");
    mutation.mutate({
      chofer: Number(choferId),
      fecha_desde: desde,
      fecha_hasta: hasta,
      observaciones,
      registros: resumen.registros,
    });
  }
  return (
    <CargaGuiada
      titulo="Nuevo control de kilometraje"
      seccion="KILOMETRAJES"
      guardado={!!guardado}
      revision={revision}
    >
      {guardado ? (
        <section className="nr-card nr-success">
          <h2>Listo, el control N.º {guardado.id} quedó registrado</h2>
          <p>El total que sigue es el confirmado por el sistema.</p>
          <ResumenCarga
            datos={[
              ["Chofer", guardado.chofer_nombre],
              [
                "Período",
                `${fechaTexto(guardado.fecha_desde)} → ${fechaTexto(guardado.fecha_hasta)}`,
              ],
              [
                "Total de kilómetros",
                `${numero(Number(guardado.total_km))} km`,
              ],
              ["Observaciones", guardado.observaciones || "Sin observaciones"],
            ]}
          />
          <div className="nr-actions">
            <button
              className="nr-primary"
              type="button"
              onClick={() => {
                setGuardado(null);
                setChoferId("");
                setDesde("");
                setHasta("");
                setDiaElegido("");
                setViajes({});
                setObservaciones("");
                setAceptaExcluidos(false);
                mutation.reset();
                revision.corregir();
              }}
            >
              Cargar otro control
            </button>
            <Link className="nr-secondary" to="/kilometrajes">
              Ver historial de kilometrajes
            </Link>
          </div>
        </section>
      ) : (
        <form
          className={revision.revisando ? "nr-review" : "nr-form"}
          onSubmit={enviar}
          aria-busy={mutation.isPending}
        >
          {cargando && (
            <p className="nr-info" role="status">
              Cargando choferes y destinos…
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
          {!cargando && !fallo && (!choferes.length || !destinos.length) && (
            <p className="nr-error" role="alert">
              Faltan choferes o destinos disponibles. Pedile al administrador
              que revise los listados.
            </p>
          )}
          {revision.revisando ? (
            <>
              <section className="nr-card">
                <h2>Resumen del control de kilometraje</h2>
                <ResumenCarga
                  datos={[
                    [
                      "Chofer",
                      choferes.find((c) => String(c.id) === choferId)?.nombre ||
                        "Sin seleccionar",
                    ],
                    ["Período", `${fechaTexto(desde)} → ${fechaTexto(hasta)}`],
                    ["Cantidad de viajes", numero(resumen.cantidadViajes)],
                    ["Total de kilómetros", `${numero(resumen.totalKm)} km`],
                    ["Observaciones", observaciones || "Sin observaciones"],
                  ]}
                />
                <h3 className="nr-km-detail-title">
                  Viajes que se van a guardar
                </h3>
                {resumen.registros.length ? (
                  <div
                    className="nr-km-review-table"
                    role="region"
                    aria-label="Detalle de viajes para revisar"
                    tabIndex={0}
                  >
                    <table>
                      <caption>
                        Los kilómetros se calculan con la distancia de cada
                        destino.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Destino</th>
                          <th scope="col">Viajes</th>
                          <th scope="col">Kilómetros</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.registros.map((r) => (
                          <tr key={`${r.fecha}-${r.destino}`}>
                            <td>{fechaTexto(r.fecha)}</td>
                            <td>
                              {destinos.find((d) => d.id === r.destino)?.nombre}
                            </td>
                            <td>{r.cantidad_viajes}</td>
                            <td>
                              {numero(
                                r.cantidad_viajes *
                                  Number(
                                    destinos.find((d) => d.id === r.destino)
                                      ?.distancia_km || 0,
                                  ),
                              )}{" "}
                              km
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="nr-warning">
                    No cargaste viajes. Si confirmás, se guardará un control con
                    cero kilómetros.
                  </p>
                )}
              </section>
              {!!resumen.excluidos && (
                <div className="nr-warning">
                  <p>
                    Hay {resumen.excluidos} registros de viajes fuera del
                    período seleccionado. No se guardarán en este control. Volvé
                    a corregir las fechas si querés incluirlos.
                  </p>
                  <label className="nr-km-checkbox">
                    <input
                      type="checkbox"
                      required
                      checked={aceptaExcluidos}
                      onChange={(e) => setAceptaExcluidos(e.target.checked)}
                    />
                    Entiendo que los viajes fuera del período no se guardarán
                  </label>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="nr-required">
                Elegí el <strong>chofer y el período</strong>. Después indicá la
                cantidad de viajes de cada día; los kilómetros se calculan
                automáticamente.
              </p>
              <BloqueCarga
                numero={1}
                titulo="Chofer y período"
                ayuda="Indicá a quién corresponde el control y qué días vas a cargar."
                disabled={cargando || fallo}
              >
                <label htmlFor="km-chofer">
                  Chofer <span>(obligatorio)</span>
                  <select
                    id="km-chofer"
                    aria-label="Chofer (obligatorio)"
                    required
                    value={choferId}
                    onChange={(e) => setChoferId(e.target.value)}
                  >
                    <option value="">Elegí al chofer</option>
                    {choferes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="nr-grid nr-km-period">
                  <label htmlFor="km-desde">
                    Desde <span>(obligatorio)</span>
                    <input
                      id="km-desde"
                      type="date"
                      required
                      value={desde}
                      onChange={(e) => {
                        setDesde(e.target.value);
                        setAceptaExcluidos(false);
                      }}
                    />
                  </label>
                  <label htmlFor="km-hasta">
                    Hasta <span>(obligatorio)</span>
                    <input
                      id="km-hasta"
                      type="date"
                      required
                      min={desde || undefined}
                      value={hasta}
                      onChange={(e) => {
                        setHasta(e.target.value);
                        setAceptaExcluidos(false);
                      }}
                    />
                  </label>
                </div>
                {desde && hasta && !dias && (
                  <p role="alert" className="nr-error">
                    Revisá las fechas. Hasta no puede ser anterior a Desde.
                  </p>
                )}
              </BloqueCarga>
              <BloqueCarga
                numero={2}
                titulo="Viajes de cada día"
                ayuda="Elegí el día y completá los viajes de cada destino. Dejá en blanco los destinos a los que no viajó."
                disabled={cargando || fallo}
              >
                {!dias ? (
                  <p className="nr-info">
                    Completá Desde y Hasta en el bloque anterior para empezar a
                    cargar viajes.
                  </p>
                ) : (
                  <>
                    <div className="nr-km-day-nav">
                      <button
                        type="button"
                        className="nr-secondary"
                        disabled={dia <= desde}
                        onClick={() => setDiaElegido(moverDia(dia, -1))}
                      >
                        ← Día anterior
                      </button>
                      <label htmlFor="km-dia">
                        Día a cargar
                        <input
                          id="km-dia"
                          type="date"
                          required
                          min={desde}
                          max={hasta}
                          value={dia}
                          onChange={(e) => {
                            if (
                              instanteFecha(e.target.value) !== null &&
                              e.target.value >= desde &&
                              e.target.value <= hasta
                            )
                              setDiaElegido(e.target.value);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="nr-secondary"
                        disabled={dia >= hasta}
                        onClick={() => setDiaElegido(moverDia(dia, 1))}
                      >
                        Día siguiente →
                      </button>
                    </div>
                    <p className="nr-info" role="status">
                      Día {diaNumero} de {dias}:{" "}
                      <strong>{fechaTexto(dia)}</strong>. Cambiar de día no
                      borra los viajes ya cargados.
                    </p>
                    <div className="nr-grid">
                      {destinos.map((d) => (
                        <div className="nr-km-destination" key={d.id}>
                          <label htmlFor={`km-viajes-${d.id}`}>
                            {d.nombre}
                            <small>
                              {numero(Number(d.distancia_km))} km por viaje
                            </small>
                            <input
                              id={`km-viajes-${d.id}`}
                              aria-label={`Viajes a ${d.nombre} el ${fechaTexto(dia)}`}
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              value={viajes[dia]?.[d.id] ?? ""}
                              onChange={(e) => {
                                const valor = e.currentTarget.value;
                                setViajes((v) => ({
                                  ...v,
                                  [dia]: { ...v[dia], [d.id]: valor },
                                }));
                              }}
                              placeholder="0"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="nr-info">
                      Total de este día: <strong>{numero(totalDia)} km</strong>
                    </p>
                  </>
                )}
                {!!resumen.excluidos && (
                  <p className="nr-warning">
                    Hay {resumen.excluidos} registros cargados fuera de estas
                    fechas. No se borraron: ampliá el período para recuperarlos.
                    Antes de guardar te pediremos confirmación si quedan afuera.
                  </p>
                )}
              </BloqueCarga>
              <BloqueCarga
                numero={3}
                titulo="Total y aclaraciones"
                ayuda="El total incluye todos los días del período, no solo el día que estás viendo."
              >
                <div className="nr-info">
                  <strong>
                    Total del período: {numero(resumen.totalKm)} km
                  </strong>
                  <p>{numero(resumen.cantidadViajes)} viajes cargados.</p>
                </div>
                <label htmlFor="km-observaciones">
                  Observaciones <span>(opcional)</span>
                  <textarea
                    id="km-observaciones"
                    rows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Aclaraciones sobre los viajes o el período"
                  />
                </label>
              </BloqueCarga>
            </>
          )}
          <AccionesCarga
            revisando={revision.revisando}
            ocupado={mutation.isPending}
            disabled={bloqueado}
            confirmar="Confirmar y guardar control"
            corregir={revision.corregir}
          />
        </form>
      )}
    </CargaGuiada>
  );
}
