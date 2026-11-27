import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  guardarReciboCambio,
  obtenerConcesionarios,
  obtenerMotivosCambio,
  obtenerProductos,
} from "../api/logistica";
import type {
  CrearReciboCambioPayload,
  RespuestaGuardarReciboCambio,
} from "../types/logistica";
import {
  AccionesCarga,
  CargaGuiada,
  ResumenCarga,
} from "../components/ui/CargaGuiada";
import { useRevisionCarga } from "../components/ui/useRevisionCarga";
import { mensajeCarga } from "../components/ui/mensajeCarga";
import { destinatariosRecibo, errorDestinatariosRecibo } from "../components/cambios/destinatariosRecibo";

import ReciboCambioEditable from "../components/cambios/ReciboCambioEditable";
import {
  camposOtros,
  plantillaRecibo,
  type FilaProducto,
} from "../components/cambios/plantillaRecibo";

const vacia = (idLocal: number): FilaProducto => ({
  idLocal,
  productoId: "",
  cantidad: "",
  motivoId: "",
  observacion: "",
});
const otrosVacios = {
  pallets: "",
  pallets_observacion: "",
  pallets_descargados: "",
  pallets_descargados_observacion: "",
  prensados: "",
  prensados_observacion: "",
};

export default function NuevoReciboCambioPage() {
  const cache = useQueryClient();
  const revision = useRevisionCarga();
  const [fecha, setFecha] = useState(() =>
    new Date().toLocaleDateString("sv-SE"),
  );
  const [concesionarioId, setConcesionarioId] = useState("");
  const [otros, setOtros] = useState(otrosVacios);
  const [correos, setCorreos] = useState("");
  const [filas, setFilas] = useState<FilaProducto[]>([]);
  const siguiente = useRef(-1);
  const [guardado, setGuardado] = useState<RespuestaGuardarReciboCambio | null>(
    null,
  );
  const concesionariosQuery = useQuery({
    queryKey: ["concesionarios"],
    queryFn: obtenerConcesionarios,
  });
  const productosQuery = useQuery({
    queryKey: ["productos"],
    queryFn: obtenerProductos,
  });
  const concesionarios = concesionariosQuery.data || [];
  const productos = productosQuery.data || [];
  const producto = (id: string) => productos.find((p) => String(p.id) === id);
  const familias = [
    ...new Set(productos.map((p) => p.familia || "").filter(Boolean)),
  ];
  const consultasMotivos = useQueries({
    queries: familias.map((familia) => ({
      queryKey: ["motivos-cambio", familia],
      queryFn: () => obtenerMotivosCambio(familia),
    })),
  });
  const motivos = (familia: string) =>
    consultasMotivos[familias.indexOf(familia)]?.data || [];
  const consultas = [concesionariosQuery, productosQuery, ...consultasMotivos];
  const cargando = consultas.some((q) => q.isPending);
  const fallo = consultas.some((q) => q.isError);
  const sinConcesionarios =
    !concesionariosQuery.isPending &&
    !concesionariosQuery.isError &&
    !concesionarios.length;
  const filasConDatos = filas.filter(
    (f) => f.productoId || f.cantidad || f.motivoId || f.observacion.trim(),
  );
  const mutation = useMutation({
    mutationFn: guardarReciboCambio,
    onSuccess: (respuesta) => {
      setGuardado(respuesta);
      void cache.invalidateQueries({ queryKey: ["recibos-cambio"] });
      revision.enfocar();
    },
    onError: (e) =>
      revision.mostrarError(
        `No se pudo guardar el recibo. Los datos siguen en pantalla. ${mensajeCarga(e)}`,
      ),
    onSettled: () => {
      revision.terminarGuardar();
    },
  });
  function cambiar(
    id: number,
    campo: keyof Omit<FilaProducto, "idLocal">,
    valor: string,
  ) {
    setFilas((actuales) =>
      actuales.map((f) =>
        f.idLocal === id
          ? {
              ...f,
              [campo]: valor,
              ...(campo === "productoId" ? { motivoId: "" } : {}),
            }
          : f,
      ),
    );
  }
  function validar() {
    const errorCorreos = errorDestinatariosRecibo(correos);
    if (errorCorreos) {
      revision.mostrarError(errorCorreos);
      return false;
    }
    if (!fecha || !concesionarioId) {
      revision.mostrarError("Completá la fecha y el concesionario.");
      return false;
    }
    for (const f of filasConDatos) {
      const posicion = filas.findIndex((x) => x.idLocal === f.idLocal) + 1;
      if (
        !producto(f.productoId) ||
        !f.cantidad ||
        !Number.isFinite(Number(f.cantidad)) ||
        Number(f.cantidad) <= 0
      ) {
        revision.mostrarError(
          `En el producto ${posicion}, elegí un producto e ingresá una cantidad mayor a cero. Si no corresponde, borrá los datos de esa fila para dejarla completamente vacía.`,
        );
        return false;
      }
      if (
        f.motivoId &&
        !motivos(producto(f.productoId)?.familia || "").some(
          (m) => String(m.id) === f.motivoId,
        )
      ) {
        revision.mostrarError(
          `Revisá el motivo del producto ${posicion}. Debe corresponder al producto seleccionado.`,
        );
        return false;
      }
    }
    for (const c of camposOtros) {
      if (
        !Number.isFinite(Number(otros[c.campo] || 0)) ||
        Number(otros[c.campo] || 0) < 0
      ) {
        revision.mostrarError(
          `${c.titulo}: ingresá una cantidad válida, sin números negativos.`,
        );
        return false;
      }
    }
    return true;
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (
      mutation.isPending ||
      guardado ||
      cargando ||
      fallo ||
      sinConcesionarios ||
      !validar()
    )
      return;
    if (!revision.revisando) {
      revision.revisar();
      return;
    }
    const payload: CrearReciboCambioPayload = {
      ...(destinatariosRecibo(correos).length ? {destinatarios_email: destinatariosRecibo(correos)} : {}),
      fecha,
      concesionario_id: Number(concesionarioId),
      pallets: Number(otros.pallets || 0),
      pallets_observacion: otros.pallets_observacion.trim(),
      pallets_descargados: Number(otros.pallets_descargados || 0),
      pallets_descargados_observacion:
        otros.pallets_descargados_observacion.trim(),
      prensados: Number(otros.prensados || 0),
      prensados_observacion: otros.prensados_observacion.trim(),
      detalles: filasConDatos.map((f) => ({
        producto_id: Number(f.productoId),
        cantidad: Number(f.cantidad),
        motivo_id: f.motivoId ? Number(f.motivoId) : null,
        observacion: f.observacion.trim(),
      })),
    };
    if (!revision.intentarGuardar()) return;
    revision.setError("");
    mutation.mutate(payload);
  }
  const advertencia =
    "Si ya existe un recibo para esta fecha y concesionario, esta carga se suma al recibo existente. No reemplaza lo cargado anteriormente.";
  return (
    <CargaGuiada
      titulo="Nuevo recibo de cambios"
      ayuda="Completá directamente las casillas del recibo. Después podrás revisarlo antes de guardar."
      seccion="RECIBOS DE CAMBIOS"
      guardado={!!guardado}
      revision={revision}
    >
      {guardado ? (
        <section className="nr-card nr-success">
          <h2>
            {guardado.creado
              ? "Listo, se creó el recibo"
              : "Listo, la carga se agregó al recibo existente"}{" "}
            N.º {guardado.recibo.id}
          </h2>
          <p>
            {guardado.creado
              ? "El recibo ya aparece en el historial."
              : "Se conservaron las cargas anteriores. Los valores que siguen son los totales actuales del recibo."}
          </p>
          {guardado.email_enviado === true && <p className="nr-info" role="status">El servidor de correo aceptó el envío del PDF a: {guardado.email_destinatarios?.join(", ") || "el correo habitual configurado"}.</p>}
          {guardado.email_enviado === false && <p className="nr-warning" role="alert">{guardado.email_error || "El recibo quedó guardado, pero el PDF no se pudo enviar. No repitas la carga; consultá al administrador."}</p>}
          <ResumenCarga
            datos={[
              ["Fecha", guardado.recibo.fecha.split("-").reverse().join("/")],
              ["Concesionario", guardado.recibo.concesionario_nombre],
              ...camposOtros.map(
                (c) => [c.titulo, guardado.recibo[c.campo]] as [string, string],
              ),
            ]}
          />
          <div className="nr-receipt-summary">
            <h3>Productos del recibo guardado</h3>
            {guardado.recibo.detalles.length ? (
              guardado.recibo.detalles.map((d) => (
                <article key={d.id}>
                  <h3>
                    {d.producto_codigo} · {d.producto_nombre}
                  </h3>
                  <ResumenCarga
                    datos={[
                      ["Cantidad", d.cantidad],
                      ["Motivo", d.motivo_nombre || "Sin clasificar"],
                      ["Observación", d.observacion || "Sin observaciones"],
                    ]}
                  />
                </article>
              ))
            ) : (
              <p>Sin productos: se registraron los otros datos del recibo.</p>
            )}
          </div>
          <div className="nr-actions">
            <button
              className="nr-primary"
              type="button"
              onClick={() => {
                setGuardado(null);
                setOtros(otrosVacios);
                setCorreos("");
                setFilas([]);
                mutation.reset();
                revision.corregir();
              }}
            >
              Cargar otro recibo
            </button>
            <Link className="nr-secondary" to="/cambios">
              Ver historial de recibos
            </Link>
          </div>
        </section>
      ) : (
        <form
          onSubmit={enviar}
          className={revision.revisando ? "nr-review" : "nr-form"}
          aria-busy={mutation.isPending}
        >
          {cargando && (
            <p className="nr-info" role="status">
              Cargando las listas necesarias…
            </p>
          )}
          {fallo && (
            <div className="nr-error" role="alert">
              <strong>No se pudieron cargar las listas</strong>
              <p>
                Comprobá la conexión y volvé a intentar. Tus datos siguen en
                pantalla.
              </p>
              <button
                type="button"
                className="nr-secondary"
                onClick={() =>
                  void Promise.all(consultas.map((q) => q.refetch()))
                }
              >
                Volver a intentar
              </button>
            </div>
          )}
          {sinConcesionarios && (
            <p className="nr-error" role="alert">
              No hay concesionarios disponibles. Pedile al administrador que
              revise el listado.
            </p>
          )}
          <ReciboCambioEditable
            fecha={fecha}
            concesionarioId={concesionarioId}
            concesionarios={concesionarios}
            productos={productos}
            filas={filas}
            otros={otros}
            revisando={revision.revisando}
            cargandoDatos={
              concesionariosQuery.isPending || concesionariosQuery.isError
            }
            cargandoProductos={
              productosQuery.isPending || productosQuery.isError
            }
            motivos={motivos}
            motivoPendiente={(familia) => {
              const q = consultasMotivos[familias.indexOf(familia)];
              return !!(q?.isPending || q?.isError);
            }}
            cambiarFecha={setFecha}
            cambiarConcesionario={setConcesionarioId}
            cambiarFila={cambiar}
            cambiarFija={(codigo, campo, valor) => {
              const index = plantillaRecibo.findIndex(([, c]) => c === codigo);
              const p = productos.find((p) => p.codigo.trim() === codigo);
              if (!p || index < 0) return;
              const idLocal = 1000 + index;
              setFilas((actuales) => {
                const fila = actuales.find((f) => f.idLocal === idLocal) || {
                  ...vacia(idLocal),
                  productoId: String(p.id),
                };
                const nueva = { ...fila, [campo]: valor };
                const resto = actuales.filter((f) => f.idLocal !== idLocal);
                return nueva.cantidad ||
                  nueva.motivoId ||
                  nueva.observacion.trim()
                  ? [...resto, nueva]
                  : resto;
              });
            }}
            cambiarOtro={(campo, valor) =>
              setOtros((v) => ({ ...v, [campo]: valor }))
            }
            agregar={() => {
              const idLocal = siguiente.current--;
              setFilas((v) => [...v, vacia(idLocal)]);
              requestAnimationFrame(() =>
                document.getElementById(`recibo-producto-${idLocal}`)?.focus(),
              );
            }}
            quitar={(idLocal) =>
              setFilas((v) => v.filter((f) => f.idLocal !== idLocal))
            }
          />
          <p className="nr-warning">{advertencia}</p>
          <section className="nr-card" aria-labelledby="recibo-correo-titulo">
            <h2 id="recibo-correo-titulo">Enviar el PDF por correo</h2>
            <label htmlFor="recibo-destinatarios">Correos destinatarios <span>(opcional)</span></label>
            <textarea id="recibo-destinatarios" rows={3} inputMode="email" spellCheck={false}
              autoCapitalize="none" autoComplete="off" value={correos} disabled={mutation.isPending}
              aria-describedby="recibo-correo-ayuda" placeholder="nombre@empresa.com; otro@empresa.com"
              onChange={e => setCorreos(e.target.value)} />
            <p id="recibo-correo-ayuda">Separá las direcciones con coma, punto y coma o salto de línea. Máximo 20 correos. Si indicás correos, el PDF se enviará solo a esa lista; si dejás el campo vacío, se usará el correo habitual configurado.</p>
            {revision.revisando && <p>Destinatarios del envío: <strong>{destinatariosRecibo(correos).join(", ") || "Correo habitual configurado"}</strong>. El PDF se envía recién al confirmar y guardar.</p>}
          </section>
          <AccionesCarga
            revisando={revision.revisando}
            ocupado={mutation.isPending}
            disabled={cargando || fallo || sinConcesionarios}
            corregir={revision.corregir}
            confirmar="Confirmar y guardar recibo"
          />
        </form>
      )}
    </CargaGuiada>
  );
}
