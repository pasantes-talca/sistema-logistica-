import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crearViatico, obtenerChoferes } from "../api/logistica";
import type { TipoRepartoViatico, Viatico } from "../types/logistica";
import {
  AccionesCarga,
  BloqueCarga,
  CargaGuiada,
  ResumenCarga,
} from "../components/ui/CargaGuiada";
import { useRevisionCarga } from "../components/ui/useRevisionCarga";
import { mensajeCarga } from "../components/ui/mensajeCarga";

const hoy = () => new Date().toLocaleDateString("sv-SE");
const moneda = (valor: number) =>
  valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

export default function NuevoViaticoPage() {
  const cache = useQueryClient();
  const revision = useRevisionCarga();
  const [choferId, setChoferId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [tipo, setTipo] = useState<TipoRepartoViatico>("LOCAL");
  const [valor, setValor] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [observaciones, setObservaciones] = useState("");
  const [guardado, setGuardado] = useState<Viatico | null>(null);
  const consulta = useQuery({
    queryKey: ["choferes"],
    queryFn: obtenerChoferes,
  });
  const choferes = consulta.data || [];
  const bloqueado = consulta.isPending || consulta.isError || !choferes.length;
  const valorValido =
    valor !== "" && Number.isFinite(Number(valor)) && Number(valor) >= 0;
  const cantidadValida =
    cantidad !== "" &&
    Number.isSafeInteger(Number(cantidad)) &&
    Number(cantidad) > 0;
  const total =
    valorValido && cantidadValida ? Number(valor) * Number(cantidad) : null;
  const mutation = useMutation({
    mutationFn: crearViatico,
    onSuccess: (viatico) => {
      setGuardado(viatico);
      void cache.invalidateQueries({ queryKey: ["viaticos"] });
      void cache.invalidateQueries({ queryKey: ["resumen-viaticos"] });
      revision.enfocar();
    },
    onError: (e) =>
      revision.mostrarError(
        `No se pudo guardar el viático. Los datos siguen en pantalla. ${mensajeCarga(e)}`,
      ),
    onSettled: revision.terminarGuardar,
  });
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (bloqueado || mutation.isPending || guardado) return;
    if (
      !fecha ||
      !choferId ||
      !valorValido ||
      !cantidadValida ||
      total === null ||
      !Number.isFinite(total)
    ) {
      revision.mostrarError(
        "Completá la fecha y el chofer. El valor no puede ser negativo y la cantidad de viáticos debe ser un número entero mayor a cero.",
      );
      return;
    }
    if (!revision.revisando) {
      revision.revisar();
      return;
    }
    if (!revision.intentarGuardar()) return;
    revision.setError("");
    mutation.mutate({
      chofer: Number(choferId),
      fecha,
      tipo_reparto: tipo,
      valor_viatico: Number(valor),
      cantidad_viaticos: Number(cantidad),
      observaciones: observaciones.trim(),
    });
  }
  const resumen: [string, string][] = [
    ["Fecha", fecha.split("-").reverse().join("/")],
    [
      "Chofer",
      choferes.find((c) => String(c.id) === choferId)?.nombre ||
        "Sin seleccionar",
    ],
    ["Tipo de reparto", tipo === "LOCAL" ? "Local" : "Larga distancia"],
    ["Valor de cada viático", moneda(Number(valor))],
    ["Cantidad de viáticos", cantidad],
    [
      "Monto total",
      total === null ? "Completá valor y cantidad" : moneda(total),
    ],
    ["Observaciones / Ruta", observaciones.trim() || "Sin observaciones"],
  ];
  return (
    <CargaGuiada
      titulo="Nuevo viático"
      seccion="VIÁTICOS"
      guardado={!!guardado}
      revision={revision}
    >
      {guardado ? (
        <section className="nr-card nr-success">
          <h2>Listo, el viático N.º {guardado.id} quedó registrado</h2>
          <p>El importe que sigue es el confirmado por el sistema.</p>
          <ResumenCarga
            datos={[
              ["Fecha", guardado.fecha.split("-").reverse().join("/")],
              ["Chofer", guardado.chofer_nombre],
              ["Tipo de reparto", guardado.tipo_reparto_nombre],
              ["Valor de cada viático", moneda(Number(guardado.valor_viatico))],
              ["Cantidad de viáticos", String(guardado.cantidad_viaticos)],
              ["Monto total", moneda(Number(guardado.monto_total))],
              [
                "Observaciones / Ruta",
                guardado.observaciones || "Sin observaciones",
              ],
            ]}
          />
          <div className="nr-actions">
            <button
              className="nr-primary"
              type="button"
              onClick={() => {
                setGuardado(null);
                setChoferId("");
                setFecha(hoy());
                setTipo("LOCAL");
                setValor("");
                setCantidad("1");
                setObservaciones("");
                mutation.reset();
                revision.corregir();
              }}
            >
              Cargar otro viático
            </button>
            <Link className="nr-secondary" to="/viaticos">
              Ver historial de viáticos
            </Link>
          </div>
        </section>
      ) : (
        <form
          className={revision.revisando ? "nr-review" : "nr-form"}
          onSubmit={enviar}
          aria-busy={mutation.isPending}
        >
          {consulta.isPending && (
            <p className="nr-info" role="status">
              Cargando la lista de choferes…
            </p>
          )}
          {consulta.isError && (
            <div className="nr-error" role="alert">
              <strong>No se pudo cargar la lista de choferes</strong>
              <p>
                Comprobá la conexión y volvé a intentar. No se borró lo que
                completaste.
              </p>
              <button
                type="button"
                className="nr-secondary"
                onClick={() => void consulta.refetch()}
              >
                Volver a intentar
              </button>
            </div>
          )}
          {!consulta.isPending && !consulta.isError && !choferes.length && (
            <p className="nr-error" role="alert">
              No hay choferes disponibles. Pedile al administrador que revise el
              listado.
            </p>
          )}
          {revision.revisando ? (
            <section className="nr-card">
              <h2>Resumen del viático</h2>
              <ResumenCarga datos={resumen} />
            </section>
          ) : (
            <>
              <p className="nr-required">
                Completá los campos que dicen <strong>obligatorio</strong>. El
                monto total se calcula automáticamente.
              </p>
              <BloqueCarga
                numero={1}
                titulo="¿A quién corresponde?"
                ayuda="Elegí al chofer, la fecha y el tipo de reparto."
                disabled={consulta.isPending || consulta.isError}
              >
                <div className="nr-grid">
                  <label htmlFor="viatico-fecha">
                    Fecha <span>(obligatorio)</span>
                    <input
                      id="viatico-fecha"
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                    />
                  </label>
                  <label htmlFor="viatico-chofer">
                    Chofer <span>(obligatorio)</span>
                    <select
                      id="viatico-chofer"
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
                  <label htmlFor="viatico-tipo" className="nr-wide">
                    Tipo de reparto <span>(obligatorio)</span>
                    <select
                      id="viatico-tipo"
                      aria-label="Tipo de reparto (obligatorio)"
                      required
                      value={tipo}
                      onChange={(e) => {
                        if (
                          e.target.value === "LOCAL" ||
                          e.target.value === "LARGA_DISTANCIA"
                        )
                          setTipo(e.target.value);
                      }}
                    >
                      <option value="LOCAL">Local</option>
                      <option value="LARGA_DISTANCIA">Larga distancia</option>
                    </select>
                  </label>
                </div>
              </BloqueCarga>
              <BloqueCarga
                numero={2}
                titulo="Importe y cantidad"
                ayuda="Ingresá el valor de un viático y cuántos corresponden."
              >
                <div className="nr-grid">
                  <label htmlFor="viatico-valor">
                    Valor de cada viático ($) <span>(obligatorio)</span>
                    <input
                      id="viatico-valor"
                      type="number"
                      inputMode="decimal"
                      required
                      min="0"
                      step="0.01"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      placeholder="Ejemplo: 12200"
                    />
                  </label>
                  <label htmlFor="viatico-cantidad">
                    Cantidad de viáticos <span>(obligatorio)</span>
                    <input
                      id="viatico-cantidad"
                      type="number"
                      inputMode="numeric"
                      required
                      min="1"
                      step="1"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                    />
                  </label>
                </div>
                <div className="nr-info">
                  <strong>Monto total calculado</strong>
                  <p>
                    {total === null
                      ? "Completá el valor y la cantidad para ver el total."
                      : `${moneda(Number(valor))} × ${cantidad} = ${moneda(total)}`}
                  </p>
                </div>
              </BloqueCarga>
              <BloqueCarga
                numero={3}
                titulo="Ruta o aclaraciones"
                ayuda="Este bloque es opcional. Podés dejarlo vacío si no hace falta aclarar nada."
              >
                <label htmlFor="viatico-observaciones">
                  Observaciones / Ruta <span>(opcional)</span>
                  <textarea
                    id="viatico-observaciones"
                    rows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Destino, ruta u otra aclaración"
                  />
                </label>
              </BloqueCarga>
            </>
          )}
          <AccionesCarga
            revisando={revision.revisando}
            ocupado={mutation.isPending}
            disabled={bloqueado}
            confirmar="Confirmar y guardar viático"
            corregir={revision.corregir}
          />
        </form>
      )}
    </CargaGuiada>
  );
}
