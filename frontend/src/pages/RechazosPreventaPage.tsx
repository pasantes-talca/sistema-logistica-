import { useState } from "react";
import type { FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  obtenerMapaRechazosPreventa,
  obtenerResumenRechazosPreventa,
  obtenerRevisionRechazosPreventa,
} from "../api/logistica";
import ChatAsistente from "../components/asistente/ChatAsistente";
import MapaCalorMendoza from "../components/rechazosPreventa/MapaCalorMendoza";
import "./RechazosPreventaPage.css";

const MOVILES = ["Quatro Sur S.A.", "Leonardo Torres Chofer"];
const INTERVALO_ACTUALIZACION_MS = 10_000;

const preguntasPreventa = [
  "¿Cuántos rechazos de preventa hubo este mes?",
  "¿Qué departamento tuvo más rechazos de preventa este mes?",
  "¿Cuál fue el motivo más frecuente de rechazos de preventa este mes?",
  "¿Qué cliente tuvo más rechazos de preventa este mes?",
  "¿Cuántos rechazos de preventa tuvo cada móvil este mes?",
];

function iso(fecha: Date) {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function rangoMesActual() {
  const hoy = new Date();
  return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy), movil: "" };
}

export default function RechazosPreventaPage() {
  const [borrador, setBorrador] = useState(rangoMesActual);
  const [filtros, setFiltros] = useState(rangoMesActual);

  const { data: geojson } = useQuery({
    queryKey: ["rechazos-preventa-mapa"],
    queryFn: obtenerMapaRechazosPreventa,
    staleTime: Infinity,
  });

  // Live updates: poll a cheap revision marker and refetch the summary only when it changes.
  const { data: revision } = useQuery({
    queryKey: ["rechazos-preventa-revision"],
    queryFn: obtenerRevisionRechazosPreventa,
    refetchInterval: INTERVALO_ACTUALIZACION_MS,
  });

  const {
    data: resumen,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["rechazos-preventa-resumen", filtros, revision?.revision],
    queryFn: () => obtenerResumenRechazosPreventa(filtros.desde, filtros.hasta, filtros.movil),
    enabled: revision !== undefined,
    placeholderData: keepPreviousData,
  });

  function aplicarFiltros(event: FormEvent) {
    event.preventDefault();
    setFiltros(borrador);
  }

  const totalMotivos = resumen?.motivos.reduce((total, m) => total + m.cantidad, 0) ?? 0;

  return (
    <div className="pagina">
      <div className="contenedor-grande">
        <div className="encabezado-pagina">
          <div>
            <h1>Rechazos Preventa</h1>
            <p className="subtitulo">
              Entregas de preventa no realizadas según Persat, por departamento de Mendoza.
            </p>
          </div>
          <span className={`preventa-en-vivo${isFetching ? " actualizando" : ""}`}>
            <i aria-hidden="true" /> {isFetching ? "Actualizando…" : "En vivo"}
          </span>
        </div>

        <form className="filtros-reporte" onSubmit={aplicarFiltros}>
          <div className="campo">
            <label htmlFor="preventa-desde">Desde</label>
            <input
              id="preventa-desde"
              type="date"
              value={borrador.desde}
              max={borrador.hasta}
              onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="preventa-hasta">Hasta</label>
            <input
              id="preventa-hasta"
              type="date"
              value={borrador.hasta}
              min={borrador.desde}
              onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="preventa-movil">Móvil</label>
            <select
              id="preventa-movil"
              value={borrador.movil}
              onChange={(e) => setBorrador({ ...borrador, movil: e.target.value })}
            >
              <option value="">Todos</option>
              {MOVILES.map((movil) => (
                <option key={movil} value={movil}>{movil}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="boton-guardar boton-generar">Aplicar</button>
        </form>

        {isError && <div className="estado-vacio">No se pudieron cargar los rechazos de preventa.</div>}
        {isLoading && <div className="estado-vacio">Cargando rechazos de preventa…</div>}

        {resumen && (
          <>
            <div className="preventa-indicadores">
              <div><span>Rechazos en el mapa</span><strong>{resumen.total_mapa}</strong></div>
              <div><span>Clientes únicos</span><strong>{resumen.clientes_unicos}</strong></div>
              {MOVILES.map((movil) => (
                <div key={movil}><span>{movil}</span><strong>{resumen.moviles[movil] ?? 0}</strong></div>
              ))}
              <div><span>Sin ubicación</span><strong>{resumen.sin_ubicacion}</strong></div>
            </div>

            <div className="preventa-grilla">
              <section className="preventa-panel">
                <h2>Mapa de calor</h2>
                {geojson ? (
                  <MapaCalorMendoza geojson={geojson} departamentos={resumen.departamentos} />
                ) : (
                  <div className="estado-vacio">Cargando mapa…</div>
                )}
              </section>

              <section className="preventa-panel">
                <h2>Motivos</h2>
                <p className="preventa-destacado">Principal: <strong>{resumen.motivo_principal}</strong></p>
                {resumen.motivos.length === 0 ? (
                  <div className="estado-vacio">Sin rechazos en el período.</div>
                ) : (
                  <ul className="preventa-motivos">
                    {resumen.motivos.map((m) => (
                      <li key={m.nombre}>
                        <div><span>{m.nombre}</span><strong>{m.cantidad}</strong></div>
                        <meter min={0} max={totalMotivos} value={m.cantidad} />
                      </li>
                    ))}
                  </ul>
                )}

                <h2>Departamentos</h2>
                <div className="tabla-wrapper">
                  <table className="tabla-repartos">
                    <thead>
                      <tr><th>Departamento</th><th>Rechazos</th><th>Clientes</th><th>Motivo principal</th></tr>
                    </thead>
                    <tbody>
                      {[...resumen.departamentos]
                        .filter((d) => d.cantidad > 0)
                        .sort((a, b) => b.cantidad - a.cantidad)
                        .map((d) => (
                          <tr key={d.nombre}>
                            <td>{d.nombre}</td><td>{d.cantidad}</td><td>{d.clientes}</td><td>{d.motivo}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="preventa-panel">
              <h2>Clientes con más rechazos</h2>
              <div className="tabla-wrapper">
                <table className="tabla-repartos">
                  <thead>
                    <tr><th>Cliente</th><th>Código</th><th>Rechazos</th><th>Departamento</th><th>Motivo principal</th></tr>
                  </thead>
                  <tbody>
                    {resumen.clientes.slice(0, 20).map((c) => (
                      <tr key={`${c.uid ?? c.nombre}-${c.departamento}`}>
                        <td>{c.nombre}</td><td>{c.uid ?? "—"}</td><td>{c.cantidad}</td>
                        <td>{c.departamento}</td><td>{c.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <section className="preventa-panel">
          <h2>Asistente IA</h2>
          <ChatAsistente
            saludo="Hola. Puedo responder sobre los rechazos de preventa: totales, departamentos, motivos, clientes y móviles."
            sugerencias={preguntasPreventa}
            placeholder="Preguntá sobre los rechazos de preventa..."
          />
        </section>
      </div>
    </div>
  );
}
