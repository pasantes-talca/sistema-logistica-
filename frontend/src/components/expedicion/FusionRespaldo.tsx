import { useRef, useState } from "react";
import {
  fusionarRespaldo,
  type PreviewFusion,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";

export default function FusionRespaldo({
  online,
  actualizar,
}: {
  online: boolean;
  actualizar: () => Promise<unknown>;
}) {
  const [preview, setPreview] = useState<{
    archivo: unknown;
    informe: PreviewFusion;
  } | null>(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lock = useRef(false);
  async function ejecutar(fn: () => Promise<void>) {
    if (!online || lock.current) return;
    lock.current = true;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo fusionar el respaldo.",
      );
    } finally {
      lock.current = false;
      setOcupado(false);
    }
  }
  return (
    <section className="eo-backup-merge" aria-busy={ocupado}>
      <h3>Fusionar respaldo sin sobrescribir</h3>
      <p>
        Agrega únicamente registros faltantes de un respaldo nativo reciente de
        esta misma instalación. No suma stocks, no cambia contraseñas ni
        reemplaza registros. Si encuentra diferencias, bloquea la fusión
        completa para revisión. Los respaldos anteriores sin identificador de
        origen o de Firebase necesitan importación asistida.
      </p>
      <label>
        Seleccionar respaldo para fusionar
        <input
          type="file"
          accept=".json,application/json"
          disabled={!online || ocupado}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            setPreview(null);
            setConfirmacion("");
            if (!file) return;
            void ejecutar(async () => {
              if (file.size > 25000000)
                throw new Error(
                  "El archivo supera 25 MB; requiere fusión asistida en el servidor.",
                );
              let archivo: unknown;
              try {
                archivo = JSON.parse(await file.text());
              } catch {
                throw new Error("Seleccioná un archivo JSON válido.");
              }
              setPreview({ archivo, informe: await fusionarRespaldo(archivo) });
            });
          }}
        />
      </label>
      {preview && (
        <>
          <p>
            {Object.values(preview.informe.nuevos).reduce((s, n) => s + n, 0)}{" "}
            registros nuevos · {preview.informe.total_conflictos} conflictos.
          </p>
          <Table
            headers={["Tabla", "Registros nuevos"]}
            rows={Object.entries(preview.informe.nuevos)
              .filter(([, n]) => n > 0)
              .map(([tabla, n]) => [tabla, n])}
            emptyMessage="No hay registros nuevos."
          />
          {preview.informe.total_conflictos > 0 && (
            <>
              <p role="alert" className="eo-error">
                No se puede fusionar: existen registros distintos con la misma
                identidad. No se cambió ningún dato. Se muestran hasta 100
                conflictos.
              </p>
              <Table
                headers={["Tabla en conflicto", "ID"]}
                rows={preview.informe.conflictos.map((c) => [c.tabla, c.id])}
              />
            </>
          )}
          {preview.informe.aplicable && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ejecutar(async () => {
                  await fusionarRespaldo(
                    preview.archivo,
                    preview.informe,
                    confirmacion,
                  );
                  setPreview(null);
                  setConfirmacion("");
                  setMensaje(
                    "Fusión completada. Se conservaron los registros existentes y una copia previa.",
                  );
                  await actualizar();
                });
              }}
            >
              <label>
                Escribí FUSIONAR
                <input
                  required
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                type="submit"
                disabled={!online || ocupado || confirmacion !== "FUSIONAR"}
              >
                Confirmar fusión
              </button>
            </form>
          )}
        </>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
      {error && (
        <p role="alert" className="eo-error">
          {error}
        </p>
      )}
    </section>
  );
}
