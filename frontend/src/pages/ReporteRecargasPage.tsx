import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { obtenerImportaciones } from "../api/recargasHistoricas";
import { ResumenesGuardados } from "../components/repartos/RecargasHistoricas";

import { obtenerReporteRecargas } from "../api/logistica";

function fechaHoy() {
  const ahora = new Date();

  return ahora.toISOString().slice(0, 10);
}

function primerDiaMes() {
  const ahora = new Date();

  const year = ahora.getFullYear();

  const month = String(ahora.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
}

function formatearFecha(fecha: string) {
  const [year, month, day] = fecha.split("-");

  return `${day}/${month}/${year}`;
}

export default function ReporteRecargasPage() {
  const [modo, setModo] = useState<"operativo" | "resumen">("operativo");
  const historicos = useQuery({
    queryKey: ["recargas-importaciones"],
    queryFn: obtenerImportaciones,
    retry: false,
  });

  const [desde, setDesde] = useState(primerDiaMes());

  const [hasta, setHasta] = useState(fechaHoy());

  const [buscar, setBuscar] = useState(false);

  const {
    data: reporte,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["reporte-recargas", desde, hasta, buscar],

    queryFn: () => obtenerReporteRecargas(desde, hasta),

    enabled: buscar && modo === "operativo",
  });

  function generarReporte(event: React.FormEvent) {
    event.preventDefault();

    if (!desde || !hasta) {
      alert("Seleccioná ambas fechas.");

      return;
    }

    if (desde > hasta) {
      alert("La fecha desde no puede ser posterior a la fecha hasta.");

      return;
    }

    setBuscar((anterior) => !anterior);
  }

  return (
    <div className="pagina">
      <div className="contenedor-grande">
        <div className="encabezado-pagina">
          <div>
            <h1>Reporte de recargas</h1>

            <p className="subtitulo">Recargas acumuladas por empleado</p>
          </div>
        </div>

        <nav className="hr-source" aria-label="Origen de las recargas">
          <button
            type="button"
            aria-pressed={modo === "operativo"}
            onClick={() => setModo("operativo")}
          >
            Generar reporte
          </button>
          <button
            type="button"
            aria-pressed={modo === "resumen"}
            onClick={() => setModo("resumen")}
          >
            Resúmenes guardados de Drive
          </button>
        </nav>
        {modo === "resumen" && (
          <>
            {historicos.isPending && (
              <p role="status">Consultando importaciones…</p>
            )}
            {historicos.isError && (
              <p role="alert" className="hr-error">
                {historicos.error.message}
              </p>
            )}
            {historicos.data && <ResumenesGuardados lotes={historicos.data} />}
          </>
        )}
        {modo === "operativo" && (
          <>
            <form className="filtros-reporte" onSubmit={generarReporte}>
              <div className="campo">
                <label>Desde</label>

                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>

              <div className="campo">
                <label>Hasta</label>

                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>

              <button type="submit" className="boton-guardar boton-generar">
                Generar reporte
              </button>
            </form>

            {isLoading && (
              <div className="estado-vacio">Generando reporte...</div>
            )}

            {isError && (
              <div className="estado-vacio">No se pudo generar el reporte.</div>
            )}

            {reporte && !!reporte.diferencia_autorizada && (
              <p className="estado-vacio" role="note">
                Los totales autorizados de Drive difieren de la suma individual
                por empleado. Total por empleados: {reporte.total_por_empleados}
                . Diferencia autorizada: {reporte.diferencia_autorizada}. Esta
                diferencia no se distribuye automáticamente entre personas.
              </p>
            )}

            {reporte && !isLoading && (
              <>
                <div className="resumen-reporte">
                  <div>
                    <span>Período</span>

                    <strong>
                      {formatearFecha(reporte.desde)}
                      {" → "}
                      {formatearFecha(reporte.hasta)}
                    </strong>
                  </div>

                  <div>
                    <span>Repartos con recargas</span>

                    <strong>{reporte.cantidad_repartos}</strong>
                  </div>

                  <div>
                    <span>Total general</span>

                    <strong>{reporte.total_general}</strong>
                  </div>
                </div>

                {reporte.empleados.length === 0 ? (
                  <div className="estado-vacio">
                    No hay registros con recargas en el período seleccionado.
                  </div>
                ) : (
                  <div className="tabla-wrapper">
                    <table className="tabla-repartos">
                      <thead>
                        <tr>
                          <th>Legajo</th>
                          <th>Empleado</th>
                          <th>Recargas</th>
                        </tr>
                      </thead>

                      <tbody>
                        {reporte.empleados.map((empleado) => (
                          <tr key={empleado.empleado_id}>
                            <td>{empleado.legajo || "-"}</td>

                            <td>{empleado.nombre}</td>

                            <td>
                              <strong>{empleado.recargas}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
