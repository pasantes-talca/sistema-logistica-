import type { CeldaOriginal } from "./archivoOriginal";
export function TablaOriginal({ filas }: { filas: CeldaOriginal[][] }) {
  const cols = Math.max(1, ...filas.map((r) => r.length));
  return (
    <div className="tabla-wrapper">
      <table className="tabla-repartos">
        <tbody>
          {filas.map((r, i) => (
            <tr key={i}>
              {Array.from({ length: cols }, (_, j) => (
                <td key={j}>{String(r[j] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
