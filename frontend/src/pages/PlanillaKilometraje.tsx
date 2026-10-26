import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  actualizarPlanillaKilometraje,
  buscarPlanillaKilometraje,
  crearControlKilometraje,
  descargarPlanillaKilometraje,
  finalizarPlanillaKilometraje,
  obtenerChoferes,
  obtenerControlKilometraje,
  obtenerDestinosKilometraje,
} from "../api/logistica";
import type {
  ControlKilometraje,
  DestinoKilometraje,
} from "../types/logistica";
import {
  diasPeriodo,
  moverDia,
  resumirViajes,
  type ViajesPorFecha,
} from "../components/ui/viajesKilometraje";
import { mensajeCarga } from "../components/ui/mensajeCarga";
import "./PlanillaKilometraje.css";

const numero = (valor: number) =>
  valor.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const fechaTexto = (fecha: string) => fecha.split("-").reverse().join("/");
type Seleccion = {
  chofer: number;
  nombre: string;
  desde: string;
  hasta: string;
};

export default function PlanillaKilometraje() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const choferes = useQuery({
    queryKey: ["choferes"],
    queryFn: obtenerChoferes,
  });
  const destinos = useQuery({
    queryKey: ["destinos-kilometraje"],
    queryFn: obtenerDestinosKilometraje,
  });
  const detalle = useQuery({
    queryKey: ["control-kilometraje", Number(id)],
    queryFn: () => obtenerControlKilometraje(Number(id)),
    enabled: !!id && Number.isSafeInteger(Number(id)),
  });
  const [error, setError] = useState("");
  const buscar = useMutation({
    mutationFn: async (s: Seleccion) => ({
      s,
      control: await buscarPlanillaKilometraje(s.chofer, s.desde, s.hasta),
    }),
    onSuccess: ({ s, control }) =>
      control ? navegar(`/kilometrajes/${control.id}`) : setSeleccion(s),
    onError: (e) => setError(mensajeCarga(e)),
  });
  const control = id ? detalle.data : undefined;
  return (
    <main className="pk-page">
      <header className="pk-header">
        <div>
          <span>CONTROL DE KILOMETRAJE</span>
          <h1>Planilla de kilometraje</h1>
          <p>
            Elegí el chofer y el período. Completá la cantidad de viajes en cada
            casillero.
          </p>
        </div>
        <Link className="pk-button" to="/kilometrajes">
          Ver planillas guardadas
        </Link>
      </header>
      {!id && !seleccion && (
        <form
          className="pk-selectores"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (buscar.isPending) return;
            const datos = new FormData(e.currentTarget),
              chofer = Number(datos.get("chofer"));
            const desde = String(datos.get("desde")),
              hasta = String(datos.get("hasta"));
            if (!diasPeriodo(desde, hasta) || diasPeriodo(desde, hasta) > 366) {
              setError("Elegí un período válido, de hasta 366 días.");
              return;
            }
            setError("");
            buscar.mutate({
              chofer,
              nombre: choferes.data?.find((c) => c.id === chofer)?.nombre || "",
              desde,
              hasta,
            });
          }}
        >
          <label>
            Chofer
            <select
              name="chofer"
              aria-label="Chofer"
              required
              disabled={choferes.isPending || buscar.isPending}
            >
              <option value="">Seleccionar chofer</option>
              {choferes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              name="desde"
              aria-label="Desde"
              required
              disabled={buscar.isPending}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              name="hasta"
              aria-label="Hasta"
              required
              disabled={buscar.isPending}
            />
          </label>
          <button
            className="pk-button pk-primary"
            disabled={
              buscar.isPending ||
              !choferes.data?.length ||
              !destinos.data?.length
            }
          >
            {buscar.isPending ? "Buscando…" : "Abrir planilla"}
          </button>
          <p>
            Si ya existe una planilla para ese chofer y ese período, se abrirá
            la misma para continuar.
          </p>
        </form>
      )}
      {error && (
        <p role="alert" className="pk-error">
          {error}
        </p>
      )}
      {(choferes.isError || destinos.isError || (id && detalle.isError)) && (
        <div className="pk-error" role="alert">
          No se pudieron cargar los datos.{" "}
          <button
            onClick={() => {
              void choferes.refetch();
              void destinos.refetch();
              if (id) void detalle.refetch();
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {!id &&
        !destinos.isPending &&
        !destinos.isError &&
        !destinos.data?.length && (
          <p className="pk-error">
            No hay destinos configurados. Consultá al administrador.
          </p>
        )}
      {id && detalle.isPending && (
        <p role="status">Cargando la planilla guardada…</p>
      )}
      {((id && control) || (!id && seleccion && destinos.data?.length)) && (
        <Editor
          key={control ? String(control.id) : JSON.stringify(seleccion)}
          control={control}
          seleccion={
            control
              ? {
                  chofer: control.chofer,
                  nombre: control.chofer_nombre,
                  desde: control.fecha_desde,
                  hasta: control.fecha_hasta,
                }
              : seleccion!
          }
          destinos={
            control?.columnas?.length ? control.columnas : destinos.data || []
          }
        />
      )}
    </main>
  );
}

function Editor({
  control: inicial,
  seleccion,
  destinos,
}: {
  control?: ControlKilometraje;
  seleccion: Seleccion;
  destinos: DestinoKilometraje[];
}) {
  const [control, setControl] = useState(inicial);
  const cache = useQueryClient(),
    navegar = useNavigate();
  const [viajes, setViajes] = useState<ViajesPorFecha>(() => {
    const valores: ViajesPorFecha = {};
    for (const r of control?.registros || [])
      (valores[r.fecha] ||= {})[r.destino] = String(r.cantidad_viajes);
    return valores;
  });
  const [observaciones, setObservaciones] = useState(
    control?.observaciones || "",
  );
  const [motivo, setMotivo] = useState("");
  const [sucio, setSucio] = useState(false),
    [editando, setEditando] = useState(control?.estado !== "FINALIZADA");
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false),
    [descargando, setDescargando] = useState(false);
  const bloqueo = useRef(false);
  useEffect(() => {
    const salir = (e: BeforeUnloadEvent) => {
      if (sucio) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", salir);
    return () => window.removeEventListener("beforeunload", salir);
  }, [sucio]);
  const columnas = control?.columnas?.length ? control.columnas : destinos;
  const resumen = resumirViajes(
    viajes,
    columnas,
    seleccion.desde,
    seleccion.hasta,
  );
  const distancia = (fecha: string, destino: number) =>
    Number(
      control?.registros.find((r) => r.fecha === fecha && r.destino === destino)
        ?.distancia_km ??
        columnas.find((d) => d.id === destino)?.distancia_km ??
        0,
    );
  const totalKm = resumen.registros.reduce(
    (s, r) => s + r.cantidad_viajes * distancia(r.fecha, r.destino),
    0,
  );
  const cantidadDias = diasPeriodo(seleccion.desde, seleccion.hasta);
  const dias =
    cantidadDias <= 366
      ? Array.from({ length: cantidadDias }, (_, i) =>
          moverDia(seleccion.desde, i),
        )
      : [];
  const ocupadoEnvio = control?.envio_estado === "ENVIANDO";
  const guardar = useMutation({
    mutationFn: async () => {
      const datos = {
        chofer: seleccion.chofer,
        fecha_desde: seleccion.desde,
        fecha_hasta: seleccion.hasta,
        observaciones,
        registros: resumen.registros.map((r) => ({
          ...r,
          observaciones:
            control?.registros.find(
              (a) => a.fecha === r.fecha && a.destino === r.destino,
            )?.observaciones || "",
        })),
      };
      return control
        ? actualizarPlanillaKilometraje(control.id, {
            ...datos,
            version: control.version,
            motivo_correccion: motivo,
          })
        : crearControlKilometraje(datos);
    },
    onSuccess: (c) => {
      setSucio(false);
      setControl(c);
      setMotivo("");
      cache.setQueryData(["control-kilometraje", c.id], c);
      void cache.invalidateQueries({ queryKey: ["controles-kilometraje"] });
      navegar(`/kilometrajes/${c.id}`, { replace: !control });
    },
    onError: (e) =>
      setError(
        `No se guardó la planilla. Tus datos siguen en pantalla. ${mensajeCarga(e)}`,
      ),
    onSettled: () => {
      bloqueo.current = false;
    },
  });
  const enviar = useMutation({
    mutationFn: () =>
      finalizarPlanillaKilometraje(control!.id, control!.version),
    onSuccess: (c) => {
      setControl(c);
      setEditando(false);
      cache.setQueryData(["control-kilometraje", c.id], c);
      void cache.invalidateQueries({ queryKey: ["controles-kilometraje"] });
    },
    onError: async (e) => {
      setError(mensajeCarga(e));
      if (control) {
        try {
          setControl(await obtenerControlKilometraje(control.id));
        } catch {
          /* Conserva el error y los datos guardados. */
        }
      }
    },
    onSettled: () => {
      setConfirmar(false);
      bloqueo.current = false;
    },
  });
  const ocupado =
    guardar.isPending || enviar.isPending || ocupadoEnvio || descargando;
  const soloLectura = !editando || ocupado;
  const totales = columnas.map((d) =>
    resumen.registros
      .filter((r) => r.destino === d.id)
      .reduce(
        (s, r) => s + r.cantidad_viajes * distancia(r.fecha, r.destino),
        0,
      ),
  );
  async function descargar(formato: "xlsx" | "pdf") {
    if (!control || ocupado) return;
    setDescargando(true);
    setError("");
    try {
      await descargarPlanillaKilometraje(control.id, formato);
    } catch (e) {
      setError(e instanceof Error ? mensajeCarga(e) : "No se pudo descargar.");
    } finally {
      setDescargando(false);
    }
  }
  return (
    <section className="pk-editor">
      <div className="pk-info">
        <strong>
          {control ? `Planilla N.º ${control.id}` : "Planilla nueva"} ·{" "}
          {seleccion.nombre}
        </strong>
        <span>
          {fechaTexto(seleccion.desde)} al {fechaTexto(seleccion.hasta)}
        </span>
        <span>
          {sucio
            ? "Cambios sin guardar"
            : control
              ? `${control.estado === "FINALIZADA" ? "Finalizada" : "Borrador guardado"} · versión ${control.version}`
              : "Todavía no guardada"}
        </span>
      </div>
      {control?.envio_estado === "ENVIADO" && (
        <p className="pk-success" role="status">
          El servidor de correo aceptó el envío del Excel y el PDF a
          pasantes@talca.com.ar
          {control.enviado_en
            ? ` el ${new Date(control.enviado_en).toLocaleString("es-AR")}`
            : ""}
          .
        </p>
      )}
      {control?.error_envio && (
        <p className="pk-error" role="alert">
          {control.error_envio}
        </p>
      )}
      {ocupadoEnvio && (
        <p className="pk-error">
          El envío está en curso o pendiente de verificar. No se permite editar
          ni reenviar hasta verificarlo con el administrador.{" "}
          <button
            onClick={() => {
              if (control)
                void obtenerControlKilometraje(control.id)
                  .then(setControl)
                  .catch(() => setError("No se pudo actualizar el estado."));
            }}
          >
            Actualizar estado
          </button>
        </p>
      )}
      {control?.estado === "FINALIZADA" && !editando && !ocupadoEnvio && (
        <button className="pk-button" onClick={() => setEditando(true)}>
          Editar esta planilla
        </button>
      )}
      <p className="pk-ayuda">
        Cada casillero indica la cantidad de viajes, no los kilómetros. Los
        domingos están resaltados y también se pueden completar. Deslizá la
        barra para ver todos los destinos.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (ocupado || bloqueo.current) return;
          if (!dias.length || !destinos.length) {
            setError("Revisá el período y los destinos.");
            return;
          }
          if (resumen.errores.length) {
            setError(resumen.errores[0]);
            return;
          }
          if (control && !motivo.trim()) {
            setError("Indicá el motivo de la modificación.");
            return;
          }
          bloqueo.current = true;
          guardar.mutate();
        }}
      >
        <div
          className="pk-scroll"
          role="region"
          aria-label="Planilla de viajes con desplazamiento horizontal"
          tabIndex={0}
        >
          <table className="pk-tabla">
            <caption>
              CONTROL DE KILOMETRAJE REPARTO · {seleccion.nombre} ·{" "}
              {fechaTexto(seleccion.desde)} al {fechaTexto(seleccion.hasta)}
            </caption>
            <thead>
              <tr>
                <th scope="col">DESTINO</th>
                {columnas.map((d) => (
                  <th scope="col" key={d.id}>
                    {d.nombre}
                  </th>
                ))}
              </tr>
              <tr>
                <th scope="row">DISTANCIA</th>
                {columnas.map((d) => (
                  <td key={d.id}>{numero(Number(d.distancia_km))} km</td>
                ))}
              </tr>
              <tr>
                <th scope="col">DÍA</th>
                {columnas.map((d) => (
                  <td key={d.id}>
                    <span className="pk-sr">Cantidad de viajes</span>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.map((fecha) => (
                <tr
                  key={fecha}
                  className={
                    new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0
                      ? "pk-domingo"
                      : ""
                  }
                >
                  <th scope="row" title={fechaTexto(fecha)}>
                    {Number(fecha.slice(8))}
                    <small>{fecha.slice(5, 7)}</small>
                  </th>
                  {columnas.map((d) => (
                    <td key={d.id}>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1"
                        max="2147483647"
                        aria-label={`${fechaTexto(fecha)} · ${d.nombre} · viajes`}
                        value={viajes[fecha]?.[d.id] || ""}
                        disabled={soloLectura}
                        onKeyDown={(e) => {
                          if (!["Enter", "ArrowDown", "ArrowUp"].includes(e.key)) return;
                          e.preventDefault();
                          const fila = e.currentTarget.closest("tr");
                          const anterior = e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey);
                          const siguiente = anterior ? fila?.previousElementSibling : fila?.nextElementSibling;
                          const campo = siguiente?.querySelectorAll<HTMLInputElement>("input")[columnas.findIndex(c => c.id === d.id)];
                          campo?.focus();
                          campo?.select();
                        }}
                        onChange={(e) => {
                          const valor = e.target.value;
                          setViajes((v) => ({
                            ...v,
                            [fecha]: { ...v[fecha], [d.id]: valor },
                          }));
                          setSucio(true);
                          setConfirmar(false);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">TOTAL KMS</th>
                {totales.map((total, i) => (
                  <td key={columnas[i].id}>{numero(total)} km</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="pk-total">
          <strong>TOTAL KILÓMETROS RECORRIDOS EN EL PERÍODO:</strong>
          <output>{numero(totalKm)} km</output>
        </div>
        <label className="pk-observaciones">
          Observaciones (opcional)
          <textarea
            value={observaciones}
            disabled={soloLectura}
            maxLength={5000}
            onChange={(e) => {
              setObservaciones(e.target.value);
              setSucio(true);
              setConfirmar(false);
            }}
          />
        </label>
        {control && editando && (
          <label className="pk-observaciones">
            Motivo de la modificación *
            <input
              value={motivo}
              required
              maxLength={2000}
              disabled={ocupado}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por ejemplo: agregar los viajes de hoy"
            />
          </label>
        )}
        {control?.estado === "FINALIZADA" && editando && (
          <p>
            Si guardás cambios, vuelve a ser un borrador. El correo anterior no
            se modifica; al finalizar otra vez se enviará la versión corregida.
          </p>
        )}
        {error && (
          <p className="pk-error" role="alert">
            {error}
          </p>
        )}
        <div className="pk-acciones">
          {editando && (
            <button
              className="pk-button pk-primary"
              disabled={ocupado || (!sucio && !!control)}
            >
              {guardar.isPending ? "Guardando…" : "Guardar borrador"}
            </button>
          )}
          {control && (
            <>
              <button
                type="button"
                className="pk-button"
                disabled={ocupado || sucio}
                onClick={() => void descargar("xlsx")}
              >
                Descargar Excel
              </button>
              <button
                type="button"
                className="pk-button"
                disabled={ocupado || sucio}
                onClick={() => void descargar("pdf")}
              >
                Descargar PDF
              </button>
              {control.envio_estado !== "ENVIADO" && (
                <button
                  type="button"
                  className="pk-button pk-finalizar"
                  disabled={ocupado || sucio}
                  onClick={() => {
                    setError("");
                    setConfirmar(true);
                  }}
                >
                  Finalizar y enviar
                </button>
              )}
            </>
          )}
        </div>
        {sucio && control && (
          <p>
            Guardá el borrador antes de descargar o finalizar: se utilizan los
            datos guardados.
          </p>
        )}
      </form>
      {confirmar && (
        <section className="pk-confirmar" aria-label="Confirmar envío">
          <h2>¿Finalizar y enviar esta planilla?</h2>
          <p>
            Se enviarán el Excel y el PDF de <strong>{seleccion.nombre}</strong>
            , período {fechaTexto(seleccion.desde)} al{" "}
            {fechaTexto(seleccion.hasta)}, a{" "}
            <strong>pasantes@talca.com.ar</strong>.
          </p>
          <p>
            Total guardado: {numero(Number(control?.total_km || 0))} km. Si
            falla el envío, la planilla permanece guardada.
          </p>
          {control?.envio_estado === "ERROR" && (
            <p>
              Antes de reintentar, verificá que el mensaje anterior no haya
              llegado para evitar duplicados.
            </p>
          )}
          <div className="pk-acciones">
            <button
              className="pk-button"
              disabled={ocupado}
              onClick={() => setConfirmar(false)}
            >
              Cancelar
            </button>
            <button
              className="pk-button pk-finalizar"
              disabled={ocupado || sucio}
              onClick={() => {
                if (bloqueo.current || ocupado || sucio) return;
                bloqueo.current = true;
                enviar.mutate();
              }}
            >
              {enviar.isPending ? "Enviando…" : "Sí, finalizar y enviar"}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
