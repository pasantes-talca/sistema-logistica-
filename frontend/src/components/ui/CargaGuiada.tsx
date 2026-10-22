import type { ReactNode } from "react";
import type { useRevisionCarga } from "./useRevisionCarga";
import "../../pages/NuevoRepartoPage.css";
import "./CargaGuiada.css";

export function CargaGuiada({
  titulo,
  seccion,
  guardado,
  revision: { tituloRef, alertaRef, revisando, error },
  children,
}: {
  titulo: string;
  seccion: string;
  guardado: boolean;
  revision: ReturnType<typeof useRevisionCarga>;
  children: ReactNode;
}) {
  return (
    <div className="pagina nr-page">
      <div className="nr-container">
        <header className="nr-header">
          <span className="nr-kicker">{seccion}</span>
          <h1 ref={tituloRef} tabIndex={-1}>
            {guardado
              ? "Carga guardada"
              : revisando
                ? "Revisá antes de guardar"
                : titulo}
          </h1>
          <p>
            {guardado
              ? "La carga se completó correctamente. No hace falta volver a enviarla."
              : revisando
                ? "Comprobá estos datos. Si está todo bien, confirmá al final."
                : "Completá los bloques en orden. Después vas a poder revisar los datos antes de guardarlos."}
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
          <div className="nr-error" role="alert" ref={alertaRef} tabIndex={-1}>
            <strong>Revisá lo siguiente</strong>
            <p>{error}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function BloqueCarga({
  numero,
  titulo,
  ayuda,
  disabled,
  children,
}: {
  numero: number;
  titulo: string;
  ayuda: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="nr-card" disabled={disabled}>
      <legend>
        <span className="nr-number" aria-hidden="true">
          {numero}
        </span>{" "}
        {titulo}
      </legend>
      <p>{ayuda}</p>
      {children}
    </fieldset>
  );
}

export function ResumenCarga({ datos }: { datos: [string, ReactNode][] }) {
  return (
    <dl className="nr-summary">
      {datos.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AccionesCarga({
  revisando,
  ocupado,
  disabled,
  confirmar,
  corregir,
}: {
  revisando: boolean;
  ocupado?: boolean;
  disabled?: boolean;
  confirmar: string;
  corregir: () => void;
}) {
  return (
    <div className="nr-savebar">
      <p>
        {revisando ? (
          "Si hay un dato incorrecto, volvé a corregirlo. No se pierde lo cargado."
        ) : (
          <>
            <strong>Último paso:</strong> revisá la carga antes de guardarla.
          </>
        )}
      </p>
      <div className="nr-actions">
        {revisando && (
          <button
            className="nr-secondary"
            type="button"
            onClick={corregir}
            disabled={ocupado}
          >
            Volver a corregir
          </button>
        )}
        <button
          className="nr-primary"
          type="submit"
          disabled={disabled || ocupado}
        >
          {ocupado
            ? "Guardando… esperá un momento"
            : revisando
              ? confirmar
              : "Revisar la carga →"}
        </button>
      </div>
    </div>
  );
}
