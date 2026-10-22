import { useCallback, useRef, useState } from "react";

export function useRevisionCarga() {
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState("");
  const titulo = useRef<HTMLHeadingElement | null>(null);
  const alerta = useRef<HTMLDivElement | null>(null);
  const lock = useRef(false);
  const tituloRef = useCallback((node: HTMLHeadingElement | null) => {
    titulo.current = node;
  }, []);
  const alertaRef = useCallback((node: HTMLDivElement | null) => {
    alerta.current = node;
  }, []);
  const enfocar = () =>
    requestAnimationFrame(() => {
      titulo.current?.focus();
      titulo.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  const mostrarError = (mensaje: string) => {
    setError(mensaje);
    requestAnimationFrame(() => alerta.current?.focus());
  };
  const revisar = () => {
    setError("");
    setRevisando(true);
    enfocar();
  };
  const corregir = () => {
    setError("");
    setRevisando(false);
    enfocar();
  };
  const intentarGuardar = () => {
    if (lock.current) return false;
    lock.current = true;
    return true;
  };
  const terminarGuardar = () => {
    lock.current = false;
  };
  return {
    revisando,
    error,
    setError,
    mostrarError,
    revisar,
    corregir,
    enfocar,
    tituloRef,
    alertaRef,
    intentarGuardar,
    terminarGuardar,
  };
}
