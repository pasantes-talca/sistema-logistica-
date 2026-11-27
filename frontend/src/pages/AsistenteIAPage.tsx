import ChatAsistente from "../components/asistente/ChatAsistente";

const preguntasSugeridas = [
  "¿Cuántos repartos hubo este mes?",
  "¿Quién tuvo más recargas este mes?",
  "¿Cuál fue el motivo de rechazo más frecuente este mes?",
  "¿Qué asignación tuvo más rechazos este mes?",
  "¿Qué departamento tuvo más rechazos de preventa este mes?",
  "¿Qué concesionario tuvo más cambios este mes?",
  "¿Qué producto tuvo más cambios este mes?",
  "Dame un resumen general de Logística de este mes",
];

export default function AsistenteIAPage() {
  return (
    <div className="pagina">
      <div className="contenedor-grande">
        <div className="encabezado-pagina">
          <div>
            <h1>Asistente IA</h1>
            <p className="subtitulo">
              Consultá la información operativa de Logística utilizando lenguaje natural.
            </p>
          </div>
        </div>

        <ChatAsistente
          saludo="Hola. Soy el asistente de Logística Talca. Puedo consultar la información registrada en Repartos y Recargas, Rechazos, Rechazos Preventa y Recibos de Cambios. Podés preguntarme usando lenguaje natural."
          sugerencias={preguntasSugeridas}
          placeholder="Preguntá sobre repartos, recargas, rechazos, rechazos de preventa, cambios o sobre la operación general..."
        />
      </div>
    </div>
  );
}
