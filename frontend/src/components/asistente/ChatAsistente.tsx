import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import { preguntarAsistente } from "../../api/logistica";
import type { RespuestaAsistente } from "../../types/logistica";

interface Mensaje {
  id: number;
  tipo: "usuario" | "asistente";
  texto: string;
  datos?: RespuestaAsistente;
}

interface Props {
  saludo: string;
  sugerencias: string[];
  placeholder: string;
}

const MODULOS: Record<string, string> = {
  repartos: "Repartos",
  recargas: "Recargas",
  rechazos: "Rechazos",
  cambios: "Recibos de cambios",
  general: "Resumen general",
  rechazos_preventa: "Rechazos Preventa",
};

function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return "";
  const partes = fecha.split("-");
  if (partes.length !== 3) return fecha;
  const [year, month, day] = partes;
  return `${day}/${month}/${year}`;
}

export default function ChatAsistente({ saludo, sugerencias, placeholder }: Props) {
  const [pregunta, setPregunta] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { id: 1, tipo: "asistente", texto: saludo },
  ]);
  const finalChatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    finalChatRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes]);

  const mutation = useMutation({
    mutationFn: preguntarAsistente,
    onSuccess: (resultado) => {
      setMensajes((anteriores) => [
        ...anteriores,
        { id: Date.now(), tipo: "asistente", texto: resultado.respuesta, datos: resultado },
      ]);
    },
    onError: (error: Error) => {
      setMensajes((anteriores) => [
        ...anteriores,
        { id: Date.now(), tipo: "asistente", texto: error.message },
      ]);
    },
  });

  function enviarPregunta(texto: string) {
    const consulta = texto.trim();
    if (!consulta || mutation.isPending) return;
    setMensajes((anteriores) => [...anteriores, { id: Date.now(), tipo: "usuario", texto: consulta }]);
    setPregunta("");
    mutation.mutate(consulta);
  }

  function enviarFormulario(event: FormEvent) {
    event.preventDefault();
    enviarPregunta(pregunta);
  }

  function manejarTeclado(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      enviarPregunta(pregunta);
    }
  }

  return (
    <>
      <div className="asistente-sugerencias">
        <span>Algunas consultas que podés hacer:</span>
        <div className="asistente-sugerencias-lista">
          {sugerencias.map((sugerencia) => (
            <button
              key={sugerencia}
              type="button"
              onClick={() => enviarPregunta(sugerencia)}
              disabled={mutation.isPending}
            >
              {sugerencia}
            </button>
          ))}
        </div>
      </div>

      <div className="asistente-chat">
        {mensajes.map((mensaje) => {
          const interpretacion = mensaje.datos?.interpretacion;
          const modulo = interpretacion?.tipo ? MODULOS[interpretacion.tipo] : undefined;
          const desde = interpretacion?.desde;
          const hasta = interpretacion?.hasta;
          return (
            <div
              key={mensaje.id}
              className={mensaje.tipo === "usuario" ? "mensaje mensaje-usuario" : "mensaje mensaje-asistente"}
            >
              <div className="mensaje-autor">{mensaje.tipo === "usuario" ? "Vos" : "Asistente IA"}</div>
              <div className="mensaje-texto">{mensaje.texto}</div>
              {mensaje.datos && (modulo || desde || hasta) && (
                <div className="mensaje-contexto">
                  {modulo && <span className="mensaje-contexto-modulo">{modulo}</span>}
                  {(desde || hasta) && (
                    <span className="mensaje-contexto-periodo">
                      Período: {desde ? formatearFecha(desde) : "inicio"}
                      {" → "}
                      {hasta ? formatearFecha(hasta) : "actualidad"}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {mutation.isPending && (
          <div className="mensaje mensaje-asistente">
            <div className="mensaje-autor">Asistente IA</div>
            <div className="mensaje-texto">Consultando los datos del sistema...</div>
          </div>
        )}
        <div ref={finalChatRef} />
      </div>

      <form className="asistente-formulario" onSubmit={enviarFormulario}>
        <textarea
          value={pregunta}
          onChange={(event) => setPregunta(event.target.value)}
          onKeyDown={manejarTeclado}
          placeholder={placeholder}
          rows={3}
          disabled={mutation.isPending}
        />
        <button
          type="submit"
          className="boton-principal"
          disabled={mutation.isPending || !pregunta.trim()}
        >
          {mutation.isPending ? "Consultando..." : "Enviar"}
        </button>
      </form>

      <p className="asistente-ayuda">Enter para enviar · Shift + Enter para escribir una nueva línea</p>
    </>
  );
}
