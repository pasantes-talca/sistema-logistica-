import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  crearControlDiario,
  obtenerProductosControlDiario,
  obtenerUbicacionesControlDiario,
} from "../api/logistica";

import type {
  CrearControlDiarioPayload,
  MovimientoControlDiarioEntrada,
  ProductoControlDiario,
  TipoMovimientoControlDiario,
  UbicacionControlDiario,
} from "../types/logistica";

import "./ControlDiario.css";


type ValoresCarga = Record<string, string>;


interface FilaCarga {
  clave: string;
  nombre: string;
  ubicacionId: number;
  tipoMovimiento: TipoMovimientoControlDiario;
}


interface SeccionCargaProps {
  titulo: string;
  subtitulo: string;

  productos: ProductoControlDiario[];
  filas: FilaCarga[];

  obtenerValor: (
    tipoMovimiento: TipoMovimientoControlDiario,
    ubicacionId: number,
    productoId: number
  ) => string;

  actualizarValor: (
    tipoMovimiento: TipoMovimientoControlDiario,
    ubicacionId: number,
    productoId: number,
    valor: string
  ) => void;

  obtenerTotalProducto: (
    filas: FilaCarga[],
    productoId: number
  ) => number;

  mostrarTotal?: boolean;
  etiquetaTotal?: string;
}


function crearClave(
  tipoMovimiento: TipoMovimientoControlDiario,
  ubicacionId: number,
  productoId: number
): string {
  return `${tipoMovimiento}:${ubicacionId}:${productoId}`;
}


function formatearNumero(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(valor);
}


function SeccionCarga({
  titulo,
  subtitulo,
  productos,
  filas,
  obtenerValor,
  actualizarValor,
  obtenerTotalProducto,
  mostrarTotal = true,
  etiquetaTotal = "Total",
}: SeccionCargaProps) {
  return (
    <section className="control-diario-section">

      <div className="control-diario-section-header">
        <div>
          <h2>{titulo}</h2>
          <p>{subtitulo}</p>
        </div>
      </div>


      <div className="control-diario-table-wrapper">

        <table className="control-diario-table">

          <thead>
            <tr>

              <th className="control-diario-sticky">
                Concepto
              </th>

              {productos.map((producto) => (
                <th key={producto.id}>

                  <div className="control-diario-product-header">

                    <strong>
                      {producto.sabor || producto.familia}
                    </strong>

                    <span>
                      {producto.presentacion}
                    </span>

                  </div>

                </th>
              ))}

            </tr>
          </thead>


          <tbody>

            {filas.map((fila) => (
              <tr key={fila.clave}>

                <td className="control-diario-sticky control-diario-row-name">
                  {fila.nombre}
                </td>

                {productos.map((producto) => (
                  <td key={producto.id}>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={obtenerValor(
                        fila.tipoMovimiento,
                        fila.ubicacionId,
                        producto.id
                      )}
                      onChange={(event) =>
                        actualizarValor(
                          fila.tipoMovimiento,
                          fila.ubicacionId,
                          producto.id,
                          event.target.value
                        )
                      }
                    />

                  </td>
                ))}

              </tr>
            ))}

          </tbody>


          {mostrarTotal && filas.length > 0 && (
            <tfoot>
              <tr>

                <td className="control-diario-sticky control-diario-total-label">
                  {etiquetaTotal}
                </td>

                {productos.map((producto) => (
                  <td
                    key={producto.id}
                    className="control-diario-total-value"
                  >
                    {formatearNumero(
                      obtenerTotalProducto(
                        filas,
                        producto.id
                      )
                    )}
                  </td>
                ))}

              </tr>
            </tfoot>
          )}

        </table>

      </div>

    </section>
  );
}


export default function NuevoControlDiarioPage() {
  const queryClient = useQueryClient();

  const [fecha, setFecha] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [valores, setValores] = useState<ValoresCarga>({});


  const {
    data: productos = [],
    isLoading: cargandoProductos,
  } = useQuery({
    queryKey: ["productos-control-diario"],
    queryFn: obtenerProductosControlDiario,
  });


  const {
    data: ubicaciones = [],
    isLoading: cargandoUbicaciones,
  } = useQuery({
    queryKey: ["ubicaciones-control-diario"],
    queryFn: obtenerUbicacionesControlDiario,
  });


  const plantaMendoza = useMemo(
    () =>
      ubicaciones.find(
        (ubicacion) =>
          ubicacion.nombre.toLowerCase().trim() ===
          "planta mendoza"
      ),
    [ubicaciones]
  );


  const destinosAsignacion = useMemo(() => {
    const nombres = [
      "Sharp",
      "Distribuidores Mza",
      "SMK Mza",
      "Vertelier",
      "Feria Mza",
      "San Juan",
      "San Luis",
    ];

    return nombres
      .map((nombre) =>
        ubicaciones.find(
          (ubicacion) =>
            ubicacion.nombre.toLowerCase().trim() ===
            nombre.toLowerCase().trim()
        )
      )
      .filter(
        (
          ubicacion
        ): ubicacion is UbicacionControlDiario =>
          Boolean(ubicacion)
      );
  }, [ubicaciones]);


  const depositos = useMemo(
    () =>
      ubicaciones
        .filter(
          (ubicacion) =>
            ubicacion.tipo === "DEPOSITO"
        )
        .sort(
          (a, b) =>
            a.orden - b.orden
        ),
    [ubicaciones]
  );


  const distribuidores = useMemo(
    () =>
      ubicaciones
        .filter(
          (ubicacion) =>
            ubicacion.tipo === "DISTRIBUIDOR"
        )
        .sort(
          (a, b) =>
            a.orden - b.orden
        ),
    [ubicaciones]
  );


  const filasDisponibilidad = useMemo<FilaCarga[]>(() => {
    if (!plantaMendoza) {
      return [];
    }

    return [
      {
        clave: "disponible",
        nombre: "Disponible",
        ubicacionId: plantaMendoza.id,
        tipoMovimiento: "DISPONIBLE",
      },
      {
        clave: "reserva",
        nombre: "Reserva MZA",
        ubicacionId: plantaMendoza.id,
        tipoMovimiento: "RESERVA",
      },
    ];
  }, [plantaMendoza]);


  const filasAsignacion = useMemo<FilaCarga[]>(
    () =>
      destinosAsignacion.map((ubicacion) => ({
        clave: `asignacion-${ubicacion.id}`,
        nombre: ubicacion.nombre,
        ubicacionId: ubicacion.id,
        tipoMovimiento: "ASIGNACION",
      })),
    [destinosAsignacion]
  );


  const filasDepositos = useMemo<FilaCarga[]>(
    () =>
      depositos.map((ubicacion) => ({
        clave: `deposito-${ubicacion.id}`,
        nombre: ubicacion.nombre,
        ubicacionId: ubicacion.id,
        tipoMovimiento: "STOCK_DEPOSITO",
      })),
    [depositos]
  );


  const filasDistribuidores = useMemo<FilaCarga[]>(
    () =>
      distribuidores.map((ubicacion) => ({
        clave: `distribuidor-${ubicacion.id}`,
        nombre: ubicacion.nombre,
        ubicacionId: ubicacion.id,
        tipoMovimiento: "DISTRIBUCION",
      })),
    [distribuidores]
  );


  const actualizarValor = (
    tipoMovimiento: TipoMovimientoControlDiario,
    ubicacionId: number,
    productoId: number,
    valor: string
  ) => {
    const clave = crearClave(
      tipoMovimiento,
      ubicacionId,
      productoId
    );

    setValores((anterior) => ({
      ...anterior,
      [clave]: valor,
    }));
  };


  const obtenerValor = (
    tipoMovimiento: TipoMovimientoControlDiario,
    ubicacionId: number,
    productoId: number
  ): string => {
    const clave = crearClave(
      tipoMovimiento,
      ubicacionId,
      productoId
    );

    return valores[clave] ?? "";
  };


  const obtenerTotalProducto = (
    filas: FilaCarga[],
    productoId: number
  ): number => {
    return filas.reduce(
      (acumulado, fila) => {
        const valor = Number(
          obtenerValor(
            fila.tipoMovimiento,
            fila.ubicacionId,
            productoId
          ) || 0
        );

        return acumulado + valor;
      },
      0
    );
  };


  const obtenerTotalSeccion = (
    filas: FilaCarga[]
  ): number => {
    let total = 0;

    for (const fila of filas) {
      for (const producto of productos) {
        total += Number(
          obtenerValor(
            fila.tipoMovimiento,
            fila.ubicacionId,
            producto.id
          ) || 0
        );
      }
    }

    return total;
  };


  const crearMovimientos =
    (): MovimientoControlDiarioEntrada[] => {
      const movimientos:
        MovimientoControlDiarioEntrada[] = [];

      const todasLasFilas = [
        ...filasDisponibilidad,
        ...filasAsignacion,
        ...filasDepositos,
        ...filasDistribuidores,
      ];

      for (const fila of todasLasFilas) {
        for (const producto of productos) {
          const valor = Number(
            obtenerValor(
              fila.tipoMovimiento,
              fila.ubicacionId,
              producto.id
            ) || 0
          );

          if (
            Number.isFinite(valor) &&
            valor > 0
          ) {
            movimientos.push({
              producto: producto.id,
              ubicacion: fila.ubicacionId,
              tipo_movimiento:
                fila.tipoMovimiento,
              cantidad: valor,
              observaciones: "",
            });
          }
        }
      }

      return movimientos;
    };


  const mutation = useMutation({
    mutationFn: crearControlDiario,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["controles-diarios"],
      });

      alert(
        "Control diario guardado correctamente."
      );

      setFecha("");
      setObservaciones("");
      setValores({});
    },

    onError: (error: Error) => {
      alert(error.message);
    },
  });


  const guardar = () => {
    if (!fecha) {
      alert(
        "Seleccioná la fecha del control."
      );
      return;
    }

    const movimientos = crearMovimientos();

    if (movimientos.length === 0) {
      alert(
        "Ingresá al menos un movimiento."
      );
      return;
    }

    const payload:
      CrearControlDiarioPayload = {
        fecha,
        observaciones,
        movimientos,
      };

    mutation.mutate(payload);
  };


  const cargando =
    cargandoProductos ||
    cargandoUbicaciones;


  return (
    <div className="control-diario-page">

      <div className="control-diario-header">

        <div>
          <span className="control-diario-eyebrow">
            CONTROL DIARIO DE LOGÍSTICA
          </span>

          <h1>
            Nueva carga
          </h1>

          <p>
            Registrá disponibilidad,
            asignaciones, stock de depósitos
            y distribución diaria.
          </p>
        </div>

      </div>


      <div className="control-diario-datos-card">

        <div className="control-diario-datos-grid">

          <div className="control-diario-field">

            <label>
              Fecha
            </label>

            <input
              type="date"
              value={fecha}
              onChange={(event) =>
                setFecha(
                  event.target.value
                )
              }
            />

          </div>


          <div className="control-diario-field control-diario-observaciones">

            <label>
              Observaciones
            </label>

            <input
              type="text"
              value={observaciones}
              onChange={(event) =>
                setObservaciones(
                  event.target.value
                )
              }
              placeholder="Observaciones generales del día"
            />

          </div>

        </div>

      </div>


      {cargando ? (

        <div className="control-diario-state">
          Cargando estructura del control diario...
        </div>

      ) : (

        <>

          <SeccionCarga
            titulo="Disponibilidad"
            subtitulo="Stock disponible y reserva de Mendoza."
            productos={productos}
            filas={filasDisponibilidad}
            obtenerValor={obtenerValor}
            actualizarValor={actualizarValor}
            obtenerTotalProducto={
              obtenerTotalProducto
            }
            mostrarTotal={false}
          />


          <SeccionCarga
            titulo="Asignación de mercadería"
            subtitulo="Mercadería asignada a destinos y operaciones del día."
            productos={productos}
            filas={filasAsignacion}
            obtenerValor={obtenerValor}
            actualizarValor={actualizarValor}
            obtenerTotalProducto={
              obtenerTotalProducto
            }
            etiquetaTotal="Total asignado"
          />


          <SeccionCarga
            titulo="Stock de depósitos"
            subtitulo="Existencias informadas en los depósitos."
            productos={productos}
            filas={filasDepositos}
            obtenerValor={obtenerValor}
            actualizarValor={actualizarValor}
            obtenerTotalProducto={
              obtenerTotalProducto
            }
            etiquetaTotal="Total depósitos"
          />


          <SeccionCarga
            titulo="Distribuidores Mendoza"
            subtitulo="Mercadería distribuida entre los distribuidores de Mendoza."
            productos={productos}
            filas={filasDistribuidores}
            obtenerValor={obtenerValor}
            actualizarValor={actualizarValor}
            obtenerTotalProducto={
              obtenerTotalProducto
            }
            etiquetaTotal="Total distribuido"
          />


          <div className="control-diario-footer">

            <div className="control-diario-resumen">

              <div>
                <span>
                  Asignaciones
                </span>

                <strong>
                  {formatearNumero(
                    obtenerTotalSeccion(
                      filasAsignacion
                    )
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Stock depósitos
                </span>

                <strong>
                  {formatearNumero(
                    obtenerTotalSeccion(
                      filasDepositos
                    )
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Distribución
                </span>

                <strong>
                  {formatearNumero(
                    obtenerTotalSeccion(
                      filasDistribuidores
                    )
                  )}
                </strong>
              </div>

            </div>


            <button
              type="button"
              className="control-diario-save-button"
              onClick={guardar}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? "Guardando..."
                : "Guardar control"}
            </button>

          </div>

        </>

      )}

    </div>
  );
}