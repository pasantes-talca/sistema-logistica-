import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  plantillaRecibo,
  camposOtros,
} from "../src/components/cambios/plantillaRecibo.ts";

test("Las filas de carga respetan los códigos y el orden del recibo PDF", () => {
  const pdf = readFileSync(
    new URL("../../backend/cambios/pdf.py", import.meta.url),
    "utf8",
  );
  const plantilla = pdf.slice(
    pdf.indexOf("PRODUCTOS_PLANTILLA ="),
    pdf.indexOf("def generar_pdf_recibo_cambio"),
  );
  const codigos = [...plantilla.matchAll(/"codigo":\s*"([^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.equal(codigos.length, 17);
  assert.deepEqual(
    plantillaRecibo.map(([, codigo]) => codigo),
    codigos,
  );
  assert.equal(new Set(codigos).size, codigos.length);
});

test("Pallets y prensados conservan sus campos de la API", () => {
  assert.deepEqual(
    camposOtros.map((c) => [c.campo, c.nota]),
    [
      ["pallets", "pallets_observacion"],
      ["pallets_descargados", "pallets_descargados_observacion"],
      ["prensados", "prensados_observacion"],
    ],
  );
});
