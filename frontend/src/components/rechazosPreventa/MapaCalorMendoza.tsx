import { useMemo, useState } from "react";

import type { DepartamentoPreventa, GeoJsonMendoza } from "../../types/logistica";

interface Props {
  geojson: GeoJsonMendoza;
  departamentos: DepartamentoPreventa[];
}

const ANCHO = 520;
const ALTO = 640;
const MARGEN = 12;

function poligonos(feature: GeoJsonMendoza["features"][number]): number[][][][] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

/** Five-step intensity bucket; 0 means no rejections. */
function nivel(cantidad: number, maximo: number) {
  if (!cantidad || !maximo) return 0;
  return Math.min(5, Math.ceil((cantidad / maximo) * 5));
}

export default function MapaCalorMendoza({ geojson, departamentos }: Props) {
  const [activo, setActivo] = useState<string | null>(null);

  const porNombre = useMemo(
    () => new Map(departamentos.map((d) => [d.nombre, d])),
    [departamentos],
  );
  const maximo = Math.max(0, ...departamentos.map((d) => d.cantidad));

  const formas = useMemo(() => {
    const puntos = geojson.features.flatMap((f) => poligonos(f).flat(2));
    const lons = puntos.map((p) => p[0]);
    const lats = puntos.map((p) => p[1]);
    const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)];
    const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
    // Equirectangular projection corrected by latitude, fitted to the viewBox.
    const factorLon = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const escala = Math.min(
      (ANCHO - MARGEN * 2) / ((maxLon - minLon) * factorLon),
      (ALTO - MARGEN * 2) / (maxLat - minLat),
    );
    const proyectar = ([lon, lat]: number[]) =>
      `${(MARGEN + (lon - minLon) * factorLon * escala).toFixed(1)},${(MARGEN + (maxLat - lat) * escala).toFixed(1)}`;

    return geojson.features.map((feature) => ({
      nombre: feature.properties.nombre,
      d: poligonos(feature)
        .flatMap((poligono) => poligono.map((anillo) => `M${anillo.map(proyectar).join("L")}Z`))
        .join(""),
    }));
  }, [geojson]);

  const detalle = activo ? porNombre.get(activo) : undefined;

  return (
    <div className="mapa-preventa">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label="Mapa de calor de rechazos de preventa por departamento de Mendoza"
      >
        {formas.map((forma) => {
          const datos = porNombre.get(forma.nombre);
          return (
            <path
              key={forma.nombre}
              d={forma.d}
              fillRule="evenodd"
              className={`mapa-preventa-depto nivel-${nivel(datos?.cantidad ?? 0, maximo)}${activo === forma.nombre ? " activo" : ""}`}
              tabIndex={0}
              onMouseEnter={() => setActivo(forma.nombre)}
              onFocus={() => setActivo(forma.nombre)}
              onMouseLeave={() => setActivo(null)}
              onBlur={() => setActivo(null)}
            >
              <title>{`${forma.nombre}: ${datos?.cantidad ?? 0} rechazos`}</title>
            </path>
          );
        })}
      </svg>

      <div className="mapa-preventa-detalle" aria-live="polite">
        {detalle ? (
          <>
            <strong>{detalle.nombre}</strong>
            <span>{detalle.cantidad} rechazos · {detalle.clientes} clientes</span>
            <span>Motivo principal: {detalle.motivo}</span>
          </>
        ) : (
          <span>Pasá el cursor sobre un departamento para ver el detalle.</span>
        )}
      </div>

      <div className="mapa-preventa-leyenda" aria-hidden="true">
        <span>Menos</span>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <i key={n} className={`nivel-${n}`} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}
