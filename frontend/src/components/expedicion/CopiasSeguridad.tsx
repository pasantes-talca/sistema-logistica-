import { useRef, useState } from "react";
import {
  exportarRespaldo,
  importarRespaldo,
  listarRespaldos,
  type ExpedicionOperativa,
} from "../../api/expedicionOperativa";

type Preview = {
  archivo: unknown;
  revision: number;
  cantidades: Record<string, number>;
};
export default function CopiasSeguridad({
  data,
  online,
  abierto,
  cambiarAbierto,
  descargar,
  revisar,
}: {
  data: ExpedicionOperativa;
  online: boolean;
  abierto: boolean;
  cambiarAbierto: (v: boolean) => void;
  descargar: (nombre: string, contenido: string) => void;
  revisar: (p: Preview) => void;
}) {
  const [copias, setCopias] = useState<
    { id: number; fecha: string; motivo: string }[] | null
  >(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const fecha = () => new Date().toLocaleDateString("sv-SE");
  async function ejecutar(accion: () => Promise<void>) {
    if (lock.current || !online) return;
    lock.current = true;
    setOcupado(true);
    setError("");
    try {
      await accion();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo completar la operación. Intentá nuevamente.",
      );
    } finally {
      lock.current = false;
      setOcupado(false);
    }
  }
  return (
    <details
      id="eo-config-backups"
      className="eo-config-panel eo-config-backups"
      open={abierto}
      onToggle={(e) => cambiarAbierto(e.currentTarget.open)}
    >
      <summary>
        Copias de seguridad <span>Descarga y revisión de respaldos</span>
      </summary>
      <div className="eo-config-backup-content" aria-busy={ocupado}>
        <h2>Resguardo de Expedición</h2>
        <p className="eo-config-caption">
          El informe JSON contiene la información visible de esta sección. No es
          un respaldo restaurable.
        </p>
        <div className="eo-actions">
          <button
            type="button"
            onClick={() =>
              descargar(
                `expedicion-${fecha()}.json`,
                JSON.stringify(
                  {
                    app: "Logística Talca",
                    version: 1,
                    fecha: new Date().toISOString(),
                    datos: data,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            Descargar informe JSON
          </button>
        </div>
        {data.superusuario ? (
          <>
            <h3>Copias completas y restauración</h3>
            <p className="eo-config-caption">
              La copia completa no incluye contraseñas. Al importar se revisa el
              archivo primero: la restauración requiere confirmar con RESTAURAR
              y conserva una copia previa del servidor.
            </p>
            <div className="eo-actions">
              <button
                type="button"
                disabled={!online || ocupado}
                onClick={() =>
                  void ejecutar(async () =>
                    descargar(
                      `respaldo-expedicion-${fecha()}.json`,
                      JSON.stringify(await exportarRespaldo()),
                    ),
                  )
                }
              >
                Descargar respaldo restaurable
              </button>
              <button
                type="button"
                disabled={!online || ocupado}
                onClick={() =>
                  void ejecutar(async () => setCopias(await listarRespaldos()))
                }
              >
                Ver copias previas del servidor
              </button>
            </div>
            <label className="eo-config-file">
              Seleccionar respaldo para revisar
              <input
                type="file"
                accept=".json,application/json"
                disabled={!online || ocupado}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void ejecutar(async () => {
                    if (file.size > 2000000)
                      throw new Error(
                        "El archivo supera 2 MB; requiere restauración asistida en el servidor.",
                      );
                    let archivo: unknown;
                    try {
                      archivo = JSON.parse(await file.text());
                    } catch {
                      throw new Error(
                        "El archivo no contiene un JSON válido. Seleccioná un respaldo exportado del sistema.",
                      );
                    }
                    const preview = await importarRespaldo(archivo);
                    revisar({ archivo, ...preview });
                  });
                }}
              />
            </label>
            {ocupado && <p role="status">Procesando solicitud…</p>}
            {copias !== null && (
              <div className="eo-config-previous">
                <h3>Copias previas del servidor</h3>
                {!copias.length ? (
                  <p>No hay copias previas guardadas en el servidor.</p>
                ) : (
                  <ul className="eo-config-list">
                    {copias.map((b) => (
                      <li key={b.id}>
                        <div>
                          <strong>
                            {new Date(b.fecha).toLocaleString("es-AR")}
                          </strong>
                          <small>{b.motivo}</small>
                        </div>
                        <button
                          type="button"
                          disabled={!online || ocupado}
                          aria-label={`Descargar copia ${b.id}`}
                          onClick={() =>
                            void ejecutar(async () =>
                              descargar(
                                `respaldo-previo-${b.id}.json`,
                                JSON.stringify(await exportarRespaldo(b.id)),
                              ),
                            )
                          }
                        >
                          Descargar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="eo-config-caption">
            La descarga de copias completas y la restauración requieren un
            superusuario. Podés descargar el informe JSON para consulta.
          </p>
        )}
        {error && (
          <p role="alert" className="eo-error">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
