import { useTurnoExpedicion } from "./turnoExpedicion";
import "./TurnoExpedicionSelector.css";

export default function TurnoExpedicionSelector() {
  const { turno, setTurno } = useTurnoExpedicion();
  return (
    <label className="header-shift" title="Turno activo de Expedición">
      <span>Turno</span>
      <select
        aria-label="Turno activo"
        value={turno}
        onChange={(event) => setTurno(event.target.value === "Tarde" ? "Tarde" : "Mañana")}
      >
        <option value="Mañana">Mañana</option>
        <option value="Tarde">Tarde</option>
      </select>
    </label>
  );
}
