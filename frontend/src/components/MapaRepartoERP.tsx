import { useState } from "react";
import type {
  ParadaRepartoERP,
  PuntoERP,
  RecorridoERP,
} from "../types/repartosErp";

function proyectar([lat, lon]: PuntoERP): PuntoERP {
  const sin = Math.sin((lat * Math.PI) / 180);
  return [
    (lon + 180) / 360,
    0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  ];
}
export default function MapaRepartoERP({
  paradas,
  origen,
  recorrido,
  seleccionar,
  marcarSalida,
}: {
  paradas: ParadaRepartoERP[];
  origen: PuntoERP | null;
  recorrido: RecorridoERP | null;
  seleccionar: (id: number) => void;
  marcarSalida?: (punto: PuntoERP) => void;
}) {
  const [zoomExtra, setZoomExtra] = useState(0);
  const [desplazamiento, setDesplazamiento] = useState<PuntoERP>([0, 0]);
  const [calles, setCalles] = useState(true);
  const [marcando, setMarcando] = useState(false);
  const puntos = [
    ...paradas.flatMap((p) => (p.ubicacion.punto ? [p.ubicacion.punto] : [])),
    ...(origen ? [origen] : []),
  ];
  const proyectados = (puntos.length ? puntos : [[-34, -64] as PuntoERP]).map(
    proyectar,
  );
  const xs = proyectados.map((p) => p[0]),
    ys = proyectados.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const z = Math.max(
    3,
    Math.min(
      18,
      Math.floor(
        Math.log2(
          Math.min(
            680 / (Math.max(maxX - minX, 0.0002) * 256),
            350 / (Math.max(maxY - minY, 0.0002) * 256),
          ),
        ),
      ) + zoomExtra,
    ),
  );
  const escala = 256 * 2 ** z;
  const left = ((minX + maxX) / 2) * escala - 400 + desplazamiento[0];
  const top = ((minY + maxY) / 2) * escala - 240 + desplazamiento[1];
  const pantalla = (p: PuntoERP) => {
    const [x, y] = proyectar(p);
    return [x * escala - left, y * escala - top];
  };
  const tiles = [];
  if (calles)
    for (
      let x = Math.floor(left / 256);
      x <= Math.floor((left + 800) / 256);
      x++
    ) {
      for (
        let y = Math.floor(top / 256);
        y <= Math.floor((top + 480) / 256);
        y++
      ) {
        if (x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z)
          tiles.push(
            <image
              key={`${z}-${x}-${y}`}
              href={`https://tile.openstreetmap.org/${z}/${x}/${y}.png`}
              x={x * 256 - left}
              y={y * 256 - top}
              width="256"
              height="256"
            />,
          );
      }
    }
  return (
    <div className="erp-mapa">
      <div className="erp-herramientas">
        <button
          type="button"
          aria-label="Acercar mapa"
          onClick={() => {
            setZoomExtra((v) => Math.min(8, v + 1));
            setDesplazamiento([0, 0]);
          }}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Alejar mapa"
          onClick={() => {
            setZoomExtra((v) => Math.max(-8, v - 1));
            setDesplazamiento([0, 0]);
          }}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => {
            setZoomExtra(0);
            setDesplazamiento([0, 0]);
          }}
        >
          Ajustar mapa
        </button>
        {marcarSalida && (
          <button
            type="button"
            aria-pressed={marcando}
            onClick={() => setMarcando((v) => !v)}
          >
            {marcando ? "Tocá el mapa para elegir salida" : "Marcar salida"}
          </button>
        )}
        <button
          type="button"
          aria-pressed={calles}
          onClick={() => setCalles((v) => !v)}
        >
          {calles ? "Ocultar calles" : "Mostrar calles"}
        </button>
        <button
          type="button"
          aria-label="Mover mapa al oeste"
          onClick={() => setDesplazamiento(([x, y]) => [x - 180, y])}
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Mover mapa al este"
          onClick={() => setDesplazamiento(([x, y]) => [x + 180, y])}
        >
          →
        </button>
        <button
          type="button"
          aria-label="Mover mapa al norte"
          onClick={() => setDesplazamiento(([x, y]) => [x, y - 120])}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="Mover mapa al sur"
          onClick={() => setDesplazamiento(([x, y]) => [x, y + 120])}
        >
          ↓
        </button>
      </div>
      <svg
        viewBox="0 0 800 480"
        role="img"
        aria-label="Mapa de ubicaciones de clientes y recorrido vial"
        onClick={(e) => {
          if (!marcando || !marcarSalida) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 800 + left,
            y = ((e.clientY - rect.top) / rect.height) * 480 + top;
          const lon = (x / escala) * 360 - 180;
          const lat =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / escala))) * 180) /
            Math.PI;
          marcarSalida([lat, lon]);
          setMarcando(false);
        }}
      >
        <rect width="800" height="480" fill="#e6edf2" />
        {tiles}
        {recorrido && (
          <polyline
            points={recorrido.geometria
              .map((p) => pantalla(p).join(","))
              .join(" ")}
            stroke="#1769e0"
            strokeWidth="4"
            strokeOpacity=".8"
            fill="none"
          />
        )}
        {paradas
          .filter((p) => p.ubicacion.punto)
          .map((p) => {
            const [x, y] = pantalla(p.ubicacion.punto!);
            const numero = recorrido
              ? recorrido.ids.indexOf(p.id) + 1 || p.orden
              : p.orden;
            return (
              <g
                key={p.id}
                transform={`translate(${x},${y})`}
                role="button"
                tabIndex={0}
                aria-label={`Parada ${numero}: ${p.cliente}`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  seleccionar(p.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    seleccionar(p.id);
                  }
                }}
              >
                <title>{p.cliente}</title>
                <circle
                  r="14"
                  fill={
                    p.estado === "entregado"
                      ? "#13875c"
                      : p.estado === "no_entregado"
                        ? "#c63e45"
                        : "#1454cf"
                  }
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  textAnchor="middle"
                  dy="4"
                  fill="white"
                  fontSize="12"
                  fontWeight="700"
                >
                  {numero}
                </text>
              </g>
            );
          })}
        {origen && (
          <g transform={`translate(${pantalla(origen).join(",")})`}>
            <rect
              x="-11"
              y="-11"
              width="22"
              height="22"
              rx="5"
              fill="#142d4b"
              stroke="white"
              strokeWidth="2"
            />
            <text textAnchor="middle" dy="4" fill="white" fontSize="12">
              S
            </text>
          </g>
        )}
      </svg>
      <a
        className="erp-atribucion"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
      >
        © OpenStreetMap contributors
      </a>
      <p className="erp-ayuda">
        Azul: pendiente · Verde: entregado · Rojo: no entregado · S: salida. Las
        calles consultan OpenStreetMap y revelan el área visualizada, no los
        nombres de clientes. Sin calles, los puntos siguen disponibles.
      </p>
    </div>
  );
}
