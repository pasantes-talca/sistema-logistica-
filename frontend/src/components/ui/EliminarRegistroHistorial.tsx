import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { eliminarRegistroHistorial } from "../../api/logistica";
import { useEliminarHistorial } from "./useEliminarHistorial";
import { mensajeCarga } from "./mensajeCarga";
import "./EliminarRegistroHistorial.css";

type Datos = {
  tipo:
    | "viaticos"
    | "kilometrajes"
    | "repartos"
    | "rechazos"
    | "cambios/recibos"
    | "control-diario";
  id: number;
  descripcion: string;
  actualizado: string;
  version?: number;
  enviado?: boolean;
  enviando?: boolean;
};

export default function EliminarRegistroHistorial(props: Datos) {
  const admin = useEliminarHistorial();
  const [elegido, setElegido] = useState<Datos | null>(null);
  if (!admin) return null;
  return (
    <>
      <button
        type="button"
        className="historial-eliminar"
        disabled={props.enviando || !props.actualizado}
        title={
          props.enviando
            ? "No se puede eliminar mientras el envío está en curso o pendiente de verificar."
            : "Eliminar este registro"
        }
        aria-label={`Eliminar ${props.descripcion}`}
        onClick={() => setElegido({ ...props })}
      >
        Eliminar
      </button>
      {elegido &&
        createPortal(
          <Confirmacion {...elegido} cerrar={() => setElegido(null)} />,
          document.body,
        )}
    </>
  );
}

function Confirmacion({ cerrar, ...props }: Datos & { cerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const bloqueo = useRef(false);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const cache = useQueryClient();
  const mutacion = useMutation({
    mutationFn: () =>
      eliminarRegistroHistorial(props.tipo, props.id, {
        confirmar: true,
        motivo: motivo.trim(),
        actualizado_en: props.actualizado,
        ...(props.version ? { version: props.version } : {}),
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({
        predicate: (q) =>
          /viatic|kilometraj|auditoria|repart|recarga|rechaz|recibo|cambio|control|estadistica/.test(
            String(q.queryKey[0]),
          ),
      });
      cerrar();
    },
    onSettled: () => {
      bloqueo.current = false;
    },
  });
  useEffect(() => {
    const d = dialogo.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!confirmado || !motivo.trim() || mutacion.isPending || bloqueo.current)
      return;
    bloqueo.current = true;
    mutacion.mutate();
  }
  return (
    <dialog
      className="historial-eliminar-dialogo"
      ref={dialogo}
      aria-labelledby="eliminar-historial-titulo"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const campos = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
          ),
        ];
        if (!campos.length) {
          e.preventDefault();
          e.currentTarget.focus();
          return;
        }
        if (e.shiftKey && document.activeElement === campos[0]) {
          e.preventDefault();
          campos.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === campos.at(-1)) {
          e.preventDefault();
          campos[0].focus();
        }
      }}
      aria-describedby="eliminar-historial-descripcion"
      onCancel={(e) => {
        e.preventDefault();
        if (!mutacion.isPending) cerrar();
      }}
    >
      <form onSubmit={enviar}>
        <span className="historial-eliminar-etiqueta">SOLO ADMINISTRADOR</span>
        <h2 id="eliminar-historial-titulo">¿Eliminar este registro?</h2>
        <p id="eliminar-historial-descripcion">
          <strong>{props.descripcion}</strong>
        </p>
        <p>
          Se eliminará definitivamente del historial y dejará de formar parte de
          los totales y estadísticas. Esta acción no se puede deshacer desde el
          sistema.
        </p>
        {props.tipo === "kilometrajes" && (
          <p>
            También se borrarán los viajes de esta planilla.
            {props.enviado
              ? " Los Excel, PDF y correos ya enviados no se pueden retirar."
              : " Los archivos ya descargados no se eliminan."}
          </p>
        )}
        {props.tipo === "repartos" && (
          <p>
            También se eliminarán sus asignaciones de personal y recargas del
            reporte del sistema.
          </p>
        )}
        {props.tipo === "cambios/recibos" && (
          <p>
            Se borrará el recibo completo con todos sus productos y cantidades
            acumuladas. Los archivos descargados y correos enviados no se
            retiran.
          </p>
        )}
        {props.tipo === "rechazos" && (
          <p>
            La eliminación no modifica el archivo de origen en Google Drive.
          </p>
        )}
        {props.tipo === "control-diario" && (
          <p>También se borrarán todas las filas de esta carga diaria.</p>
        )}
        <label>
          Motivo de la eliminación *
          <textarea
            autoFocus
            required
            maxLength={2000}
            value={motivo}
            disabled={mutacion.isPending}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por ejemplo: carga de prueba o registro duplicado"
          />
        </label>
        <label className="historial-eliminar-confirmacion">
          <input
            type="checkbox"
            checked={confirmado}
            disabled={mutacion.isPending}
            onChange={(e) => setConfirmado(e.target.checked)}
          />
          Entiendo que la eliminación es definitiva.
        </label>
        <p className="historial-eliminar-nota">
          Quedará registrada en auditoría con tu usuario y el motivo indicado.
        </p>
        {mutacion.isError && (
          <p className="historial-eliminar-error" role="alert">
            {mensajeCarga(mutacion.error)}
          </p>
        )}
        <div className="historial-eliminar-acciones">
          <button type="button" disabled={mutacion.isPending} onClick={cerrar}>
            Cancelar
          </button>
          <button
            className="historial-eliminar"
            disabled={mutacion.isPending || !confirmado || !motivo.trim()}
          >
            {mutacion.isPending ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
