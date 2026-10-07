import {
  Link,
} from "react-router-dom";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  obtenerRepartos,
  obtenerRechazos,
  obtenerRecibosCambio,
  obtenerUsuarioActual,
  obtenerViaticos,
} from "../api/logistica";

import {
  obtenerFleteros,
  obtenerMovimientosMaterial,
  obtenerMovimientosStock,
  obtenerOrdenesCarga,
  obtenerStockExpedicion,
} from "../api/expedicion";

import Icon, {
  type IconName,
} from "../components/ui/Icon";

import "./PanelPrincipalPage.css";


const API_URL =
  import.meta.env.VITE_API_URL
  ||
  "http://127.0.0.1:8000/api";


type ComparisonTrend =
  | "positive"
  | "negative"
  | "neutral";


type KpiComparison = {
  text: string;

  trend:
    ComparisonTrend;

  direction:
    | "up"
    | "down"
    | "equal";
};


type KpiItem = {
  label: string;
  value: number | string;
  description: string;
  icon: IconName;
  tone: string;

  comparison?:
    KpiComparison;
};


type ModuleItem = {
  title: string;
  description: string;
  icon: IconName;
  permiso: string;
  home: string;

  ultimaCarga?:
    string | null;

  ultimaCargaTexto?:
    string;

  links: {
    label: string;
    to: string;
  }[];
};


type RegistroGenerico =
  Record<string, unknown>;


const COLORES_PIE = [
  "#2f75d6",
  "#e1a13a",
  "#26a269",
  "#7a64d1",
  "#d95c5c",
  "#64748b",
];


// =========================================================
// CONSULTAS AUXILIARES
// =========================================================

async function obtenerListaDashboard(
  ruta: string
): Promise<RegistroGenerico[]> {

  const response =
    await fetch(
      `${API_URL}${ruta}`,
      {
        credentials:
          "include",
      }
    );


  if (!response.ok) {

    throw new Error(
      "No se pudo cargar información del dashboard."
    );
  }


  return response.json();
}


// =========================================================
// FECHAS
// =========================================================

function obtenerFechaRegistro(
  item: unknown
): string | null {

  if (
    !item
    ||
    typeof item !== "object"
  ) {

    return null;
  }


  const registro =
    item as RegistroGenerico;


  const camposFecha = [
    "creado_en",
    "creado",
    "created_at",
    "fecha_creacion",
    "fecha_registro",
    "fecha",
    "actualizado_en",
    "updated_at",
    "updated",
  ];


  for (
    const campo
    of camposFecha
  ) {

    const valor =
      registro[campo];


    if (
      typeof valor === "string"
      &&
      valor.trim()
    ) {

      return valor;
    }

  }


  return null;
}


function convertirFecha(
  valor: string
): Date | null {

  const esFechaSimple =
    /^\d{4}-\d{2}-\d{2}$/
      .test(
        valor
      );


  if (
    esFechaSimple
  ) {

    const [
      anio,
      mes,
      dia,
    ] =
      valor
        .split("-")
        .map(
          Number
        );


    return new Date(
      anio,
      mes - 1,
      dia,
      12,
      0,
      0
    );
  }


  const fecha =
    new Date(
      valor
    );


  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {

    return null;
  }


  return fecha;
}


function obtenerUltimaFecha(
  registros: unknown[]
): string | null {

  let ultimaFecha:
    Date | null = null;


  for (
    const registro
    of registros
  ) {

    const valor =
      obtenerFechaRegistro(
        registro
      );


    if (!valor) {
      continue;
    }


    const fecha =
      convertirFecha(
        valor
      );


    if (!fecha) {
      continue;
    }


    if (
      !ultimaFecha
      ||
      fecha >
      ultimaFecha
    ) {

      ultimaFecha =
        fecha;
    }

  }


  return ultimaFecha
    ? ultimaFecha.toISOString()
    : null;
}


function formatearUltimaCarga(
  valor:
    string
    |
    null
    |
    undefined
) {

  if (!valor) {

    return "Sin cargas registradas";
  }


  const fecha =
    new Date(
      valor
    );


  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {

    return "Sin fecha disponible";
  }


  const tieneHoraReal =
    fecha.getHours() !== 12
    ||
    fecha.getMinutes() !== 0;


  if (
    tieneHoraReal
  ) {

    return fecha.toLocaleString(
      "es-AR",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    );
  }


  return fecha.toLocaleDateString(
    "es-AR"
  );
}


// =========================================================
// COMPARACIÓN DE PERÍODOS
// =========================================================

function inicioDelDia(
  fecha: Date
) {

  const copia =
    new Date(
      fecha
    );


  copia.setHours(
    0,
    0,
    0,
    0
  );


  return copia;
}


function obtenerRangosComparacion() {

  const hoy =
    inicioDelDia(
      new Date()
    );


  const finActual =
    new Date(
      hoy
    );


  finActual.setDate(
    finActual.getDate()
    +
    1
  );


  const inicioActual =
    new Date(
      hoy
    );


  inicioActual.setDate(
    inicioActual.getDate()
    -
    6
  );


  const finAnterior =
    new Date(
      inicioActual
    );


  const inicioAnterior =
    new Date(
      inicioActual
    );


  inicioAnterior.setDate(
    inicioAnterior.getDate()
    -
    7
  );


  return {
    inicioActual,
    finActual,
    inicioAnterior,
    finAnterior,
  };
}


function registrosEnRango(
  registros: unknown[],
  desde: Date,
  hasta: Date
) {

  return registros.filter(
    registro => {

      const valor =
        obtenerFechaRegistro(
          registro
        );


      if (!valor) {
        return false;
      }


      const fecha =
        convertirFecha(
          valor
        );


      if (!fecha) {
        return false;
      }


      return (
        fecha >= desde
        &&
        fecha < hasta
      );
    }
  );
}


function crearComparacionCantidad(
  actual: number,
  anterior: number,
  mejorCuandoSube:
    boolean = true
): KpiComparison {

  if (
    actual === anterior
  ) {

    return {
      text:
        "Sin cambios vs. 7 días anteriores",

      trend:
        "neutral",

      direction:
        "equal",
    };
  }


  const subio =
    actual > anterior;


  let trend:
    ComparisonTrend;


  if (
    mejorCuandoSube
  ) {

    trend =
      subio
        ? "positive"
        : "negative";

  } else {

    trend =
      subio
        ? "negative"
        : "positive";
  }


  if (
    anterior === 0
  ) {

    return {
      text:
        `${subio ? "+" : ""}${actual - anterior} vs. 7 días anteriores`,

      trend,

      direction:
        subio
          ? "up"
          : "down",
    };
  }


  const variacion =
    (
      (
        actual
        -
        anterior
      )
      /
      anterior
    )
    *
    100;


  const porcentaje =
    Math.abs(
      variacion
    ).toLocaleString(
      "es-AR",
      {
        maximumFractionDigits:
          1,
      }
    );


  return {
    text:
      `${porcentaje}% vs. 7 días anteriores`,

    trend,

    direction:
      subio
        ? "up"
        : "down",
  };
}


function crearComparacionPorcentaje(
  actual: number,
  anterior: number,
  mejorCuandoSube:
    boolean = true
): KpiComparison {

  const diferencia =
    actual
    -
    anterior;


  if (
    diferencia === 0
  ) {

    return {
      text:
        "Sin cambios vs. 7 días anteriores",

      trend:
        "neutral",

      direction:
        "equal",
    };
  }


  const subio =
    diferencia > 0;


  let trend:
    ComparisonTrend;


  if (
    mejorCuandoSube
  ) {

    trend =
      subio
        ? "positive"
        : "negative";

  } else {

    trend =
      subio
        ? "negative"
        : "positive";
  }


  return {
    text:
      `${Math.abs(
        diferencia
      ).toLocaleString(
        "es-AR",
        {
          maximumFractionDigits:
            1,
        }
      )} pp vs. 7 días anteriores`,

    trend,

    direction:
      subio
        ? "up"
        : "down",
  };
}


// =========================================================
// ESTADOS DE EXPEDICIÓN
// =========================================================

function nombreEstadoOrden(
  estado: string
) {

  const nombres:
    Record<string, string> = {

      RECIBIDA:
        "Recibidas",

      CARGA_INICIADA:
        "Carga iniciada",

      PARCIAL:
        "Parciales",

      COMPLETA:
        "Completas",

      COMPLETA_CON_CAMBIO:
        "Completas con cambio",

      PENDIENTE_CONTROL:
        "Pendientes control",

    };


  return (
    nombres[estado]
    ??
    estado
  );
}


function estaCompleta(
  orden: {
    estado: string;
  }
) {

  return (
    orden.estado ===
      "COMPLETA"
    ||
    orden.estado ===
      "COMPLETA_CON_CAMBIO"
  );
}


// =========================================================
// COMPONENTE ÚLTIMA CARGA
// =========================================================

function UltimaCarga({
  fecha,
  texto,
}: {
  fecha?:
    string | null;

  texto?:
    string;
}) {

  return (

    <div className="dashboard-module-last-update">

      <div className="dashboard-module-last-icon">

        <Icon
          name="history"
          size={14}
        />

      </div>


      <div>

        <span>
          Última carga
        </span>

        <strong>

          {
            texto
            ??
            formatearUltimaCarga(
              fecha
            )
          }

        </strong>

      </div>

    </div>

  );
}


// =========================================================
// COMPONENTE KPI
// =========================================================

function KpiCard({
  kpi,
}: {
  kpi: KpiItem;
}) {

  return (

    <div className="dashboard-kpi-card">

      <div
        className={
          `dashboard-kpi-icon ${kpi.tone}`
        }
      >

        <Icon
          name={
            kpi.icon
          }
        />

      </div>


      <div>

        <span>
          {
            kpi.label
          }
        </span>


        <strong>
          {
            kpi.value
          }
        </strong>


        <small>
          {
            kpi.description
          }
        </small>


        {
          kpi.comparison
          &&
          (

            <div
              className={
                `dashboard-kpi-comparison ${kpi.comparison.trend}`
              }
            >

              <span className="dashboard-kpi-arrow">

                {
                  kpi.comparison.direction ===
                    "up"
                    ? "↑"
                    : kpi.comparison.direction ===
                        "down"
                      ? "↓"
                      : "—"
                }

              </span>


              <span>
                {
                  kpi.comparison.text
                }
              </span>

            </div>

          )
        }

      </div>

    </div>

  );
}


// =========================================================
// PANEL
// =========================================================

export default function PanelPrincipalPage() {

  // =======================================================
  // USUARIO
  // =======================================================

  const {
    data: usuario,
    isLoading:
      cargandoUsuario,
  } = useQuery({

    queryKey: [
      "usuario-actual",
    ],

    queryFn:
      obtenerUsuarioActual,

    retry:
      false,

  });


  const nombre =
    usuario?.nombre_completo
    ||
    usuario?.username
    ||
    "Usuario";


  const esSuperusuario =
    usuario?.es_superusuario
    ??
    false;


  const grupos =
    usuario?.grupos
    ??
    [];


  function tienePermiso(
    permiso: string
  ) {

    if (
      esSuperusuario
    ) {

      return true;
    }


    return grupos.includes(
      permiso
    );
  }


  // =======================================================
  // PERMISOS
  // =======================================================

  const puedeRepartos =
    tienePermiso(
      "REPARTOS"
    );


  const puedeRechazos =
    tienePermiso(
      "RECHAZOS"
    );


  const puedeCambios =
    tienePermiso(
      "CAMBIOS"
    );


  const puedeViaticos =
    tienePermiso(
      "VIATICOS"
    );


  const puedeKilometrajes =
    tienePermiso(
      "KILOMETRAJES"
    );


  const puedeControlDiario =
    tienePermiso(
      "CONTROL_DIARIO"
    );


  const puedeExpedicion =
    tienePermiso(
      "EXPEDICION"
    );


  const puedeStockPallets =
    esSuperusuario
    ||
    grupos.includes(
      "CAMBIOS"
    );


  const puedeVerLogistica =
    puedeRepartos
    ||
    puedeRechazos
    ||
    puedeCambios
    ||
    puedeViaticos
    ||
    puedeKilometrajes
    ||
    puedeControlDiario
    ||
    puedeStockPallets;


  // =======================================================
  // LOGÍSTICA
  // =======================================================

  const {
    data: repartos = [],
    isLoading:
      cargandoRepartos,
  } = useQuery({

    queryKey: [
      "repartos",
    ],

    queryFn:
      obtenerRepartos,

    enabled:
      puedeRepartos,

  });


  const {
    data: rechazos = [],
    isLoading:
      cargandoRechazos,
  } = useQuery({

    queryKey: [
      "rechazos",
    ],

    queryFn:
      obtenerRechazos,

    enabled:
      puedeRechazos,

  });


  const {
    data: recibos = [],
    isLoading:
      cargandoRecibos,
  } = useQuery({

    queryKey: [
      "recibos-cambio",
    ],

    queryFn:
      obtenerRecibosCambio,

    enabled:
      puedeCambios,

  });


  const {
    data: viaticos = [],
    isLoading:
      cargandoViaticos,
  } = useQuery({

    queryKey: [
      "viaticos",
    ],

    queryFn:
      obtenerViaticos,

    enabled:
      puedeViaticos,

  });


  const {
    data:
      kilometrajes = [],
  } = useQuery({

    queryKey: [
      "dashboard-kilometrajes",
    ],

    queryFn:
      () =>
        obtenerListaDashboard(
          "/kilometrajes/"
        ),

    enabled:
      puedeKilometrajes,

    retry:
      false,

  });


  const {
    data:
      controlesDiarios = [],
  } = useQuery({

    queryKey: [
      "controles-diarios",
    ],

    queryFn:
      () =>
        obtenerListaDashboard(
          "/control-diario/"
        ),

    enabled:
      puedeControlDiario,

    retry:
      false,

  });


  // =======================================================
  // EXPEDICIÓN
  // =======================================================

  const {
    data: ordenes = [],
    isLoading:
      cargandoOrdenes,
  } = useQuery({

    queryKey: [
      "expedicion-ordenes",
    ],

    queryFn:
      obtenerOrdenesCarga,

    enabled:
      puedeExpedicion,

  });


  const {
    data: stock = [],
    isLoading:
      cargandoStock,
  } = useQuery({

    queryKey: [
      "expedicion-stock",
    ],

    queryFn:
      obtenerStockExpedicion,

    enabled:
      puedeExpedicion,

  });


  const {
    data:
      movimientosStock = [],
  } = useQuery({

    queryKey: [
      "expedicion-movimientos-stock",
    ],

    queryFn:
      obtenerMovimientosStock,

    enabled:
      puedeExpedicion,

  });


  const {
    data: fleteros = [],
    isLoading:
      cargandoFleteros,
  } = useQuery({

    queryKey: [
      "expedicion-fleteros",
    ],

    queryFn:
      obtenerFleteros,

    enabled:
      puedeExpedicion,

  });


  const {
    data:
      materiales = [],
  } = useQuery({

    queryKey: [
      "expedicion-materiales",
    ],

    queryFn:
      obtenerMovimientosMaterial,

    enabled:
      puedeExpedicion,

  });


  // =======================================================
  // ÚLTIMAS CARGAS
  // =======================================================

  const ultimaCargaRepartos =
    obtenerUltimaFecha(
      repartos
    );


  const ultimaCargaRechazos =
    obtenerUltimaFecha(
      rechazos
    );


  const ultimaCargaCambios =
    obtenerUltimaFecha(
      recibos
    );


  const ultimaCargaViaticos =
    obtenerUltimaFecha(
      viaticos
    );


  const ultimaCargaKilometrajes =
    obtenerUltimaFecha(
      kilometrajes
    );


  const ultimaCargaControlDiario =
    obtenerUltimaFecha(
      controlesDiarios
    );


  const ultimaCargaOrdenes =
    obtenerUltimaFecha(
      ordenes
    );


  const ultimaCargaStock =
    obtenerUltimaFecha(
      movimientosStock
    );


  const ultimaCargaMovimientos =
    obtenerUltimaFecha(
      movimientosStock
    );


  const ultimaCargaFleteros =
    obtenerUltimaFecha(
      fleteros
    );


  const ultimaCargaMateriales =
    obtenerUltimaFecha(
      materiales
    );


  // =======================================================
  // RANGOS COMPARATIVOS
  // =======================================================

  const {
    inicioActual,
    finActual,
    inicioAnterior,
    finAnterior,
  } =
    obtenerRangosComparacion();


  // =======================================================
  // LOGÍSTICA - COMPARACIONES
  // =======================================================

  const repartosActuales =
    registrosEnRango(
      repartos,
      inicioActual,
      finActual
    );


  const repartosAnteriores =
    registrosEnRango(
      repartos,
      inicioAnterior,
      finAnterior
    );


  const rechazosActuales =
    registrosEnRango(
      rechazos,
      inicioActual,
      finActual
    );


  const rechazosAnteriores =
    registrosEnRango(
      rechazos,
      inicioAnterior,
      finAnterior
    );


  const cambiosActuales =
    registrosEnRango(
      recibos,
      inicioActual,
      finActual
    );


  const cambiosAnteriores =
    registrosEnRango(
      recibos,
      inicioAnterior,
      finAnterior
    );


  const viaticosActuales =
    registrosEnRango(
      viaticos,
      inicioActual,
      finActual
    );


  const viaticosAnteriores =
    registrosEnRango(
      viaticos,
      inicioAnterior,
      finAnterior
    );


  // =======================================================
  // EXPEDICIÓN - COMPARACIONES
  // =======================================================

  const ordenesActuales =
    registrosEnRango(
      ordenes,
      inicioActual,
      finActual
    );


  const ordenesAnteriores =
    registrosEnRango(
      ordenes,
      inicioAnterior,
      finAnterior
    );


  const ordenesCompletadasActuales =
    ordenesActuales.filter(
      orden =>
        estaCompleta(
          orden as {
            estado: string;
          }
        )
    );


  const ordenesCompletadasAnteriores =
    ordenesAnteriores.filter(
      orden =>
        estaCompleta(
          orden as {
            estado: string;
          }
        )
    );


  const porcentajeCompletadasActual =
    ordenesActuales.length === 0
      ? 0
      : (
          ordenesCompletadasActuales.length
          /
          ordenesActuales.length
        )
        *
        100;


  const porcentajeCompletadasAnterior =
    ordenesAnteriores.length === 0
      ? 0
      : (
          ordenesCompletadasAnteriores.length
          /
          ordenesAnteriores.length
        )
        *
        100;


  const ordenesPendientesActuales =
    ordenesActuales.filter(
      orden =>
        !estaCompleta(
          orden as {
            estado: string;
          }
        )
    );


  const ordenesPendientesAnteriores =
    ordenesAnteriores.filter(
      orden =>
        !estaCompleta(
          orden as {
            estado: string;
          }
        )
    );


  // =======================================================
  // CÁLCULOS EXPEDICIÓN
  // =======================================================

  const productosSinStock =
    stock.filter(
      item =>
        Number(
          item.cantidad_unidades
        ) <= 0
    );


  const fleterosActivos =
    fleteros.filter(
      fletero =>
        fletero.activo
    );


  // =======================================================
  // GRÁFICO LOGÍSTICA
  // =======================================================

  const actividadLogistica = [

    {
      nombre:
        "Repartos",

      cantidad:
        puedeRepartos
          ? repartosActuales.length
          : 0,
    },

    {
      nombre:
        "Rechazos",

      cantidad:
        puedeRechazos
          ? rechazosActuales.length
          : 0,
    },

    {
      nombre:
        "Cambios",

      cantidad:
        puedeCambios
          ? cambiosActuales.length
          : 0,
    },

    {
      nombre:
        "Viáticos",

      cantidad:
        puedeViaticos
          ? viaticosActuales.length
          : 0,
    },

  ].filter(
    item =>
      item.cantidad > 0
  );


  // =======================================================
  // ÓRDENES POR ESTADO
  // =======================================================

  const mapaEstados:
    Record<string, number> = {};


  for (
    const orden
    of ordenesActuales
  ) {

    const estado =
      (
        orden as {
          estado: string;
        }
      ).estado;


    mapaEstados[
      estado
    ] =
      (
        mapaEstados[
          estado
        ]
        ??
        0
      )
      +
      1;

  }


  const ordenesPorEstado =
    Object.entries(
      mapaEstados
    ).map(
      (
        [
          estado,
          cantidad,
        ]
      ) => ({

        nombre:
          nombreEstadoOrden(
            estado
          ),

        cantidad,

      })
    );


  // =======================================================
  // STOCK POR PRODUCTO
  // =======================================================

  const stockPorProducto =
    stock
      .map(
        item => ({

          producto:
            `${item.codigo} - ${item.producto}`,

          cantidad:
            Number(
              item.cantidad_unidades
            ),

        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.cantidad
          -
          a.cantidad
      )
      .slice(
        0,
        10
      );

  const stockMaximo =
    Math.max(
      ...stockPorProducto.map(
        item => item.cantidad
      ),
      1
    );


  // =======================================================
  // ENTRADAS / SALIDAS
  // =======================================================

  const movimientosActuales =
    registrosEnRango(
      movimientosStock,
      inicioActual,
      finActual
    );


  const totalEntradas =
    movimientosActuales
      .filter(
        movimiento =>
          (
            movimiento as {
              direccion: string;
            }
          ).direccion
          ===
          "ENTRADA"
      )
      .reduce<number>(
        (
          total,
          movimiento
        ) =>
          total
          +
          Number(
            (
              movimiento as {
                cantidad:
                  number | string;
              }
            ).cantidad
          ),
        0
      );


  const totalSalidas =
    movimientosActuales
      .filter(
        movimiento =>
          (
            movimiento as {
              direccion: string;
            }
          ).direccion
          ===
          "SALIDA"
      )
      .reduce<number>(
        (
          total,
          movimiento
        ) =>
          total
          +
          Number(
            (
              movimiento as {
                cantidad:
                  number | string;
              }
            ).cantidad
          ),
        0
      );


  const entradasSalidas = [

    {
      nombre:
        "Entradas",

      cantidad:
        totalEntradas,
    },

    {
      nombre:
        "Salidas",

      cantidad:
        totalSalidas,
    },

  ];


  // =======================================================
  // PALLETS Y CHAPADUR
  // =======================================================

  const materialesActuales =
    registrosEnRango(
      materiales,
      inicioActual,
      finActual
    );


  const totalPalletsSalida =
    materialesActuales.reduce<number>(
      (
        total,
        item
      ) =>
        total
        +
        Number(
          (
            item as {
              pallets_salida:
                number | string;
            }
          ).pallets_salida
          ??
          0
        ),
      0
    );


  const totalPalletsEntrada =
    materialesActuales.reduce<number>(
      (
        total,
        item
      ) =>
        total
        +
        Number(
          (
            item as {
              pallets_entrada:
                number | string;
            }
          ).pallets_entrada
          ??
          0
        ),
      0
    );


  const totalChapadurSalida =
    materialesActuales.reduce<number>(
      (
        total,
        item
      ) =>
        total
        +
        Number(
          (
            item as {
              chapadur_salida:
                number | string;
            }
          ).chapadur_salida
          ??
          0
        ),
      0
    );


  const totalChapadurEntrada =
    materialesActuales.reduce<number>(
      (
        total,
        item
      ) =>
        total
        +
        Number(
          (
            item as {
              chapadur_entrada:
                number | string;
            }
          ).chapadur_entrada
          ??
          0
        ),
      0
    );


  const materialesGrafico = [

    {
      material:
        "Pallets",

      salidas:
        totalPalletsSalida,

      entradas:
        totalPalletsEntrada,
    },

    {
      material:
        "Chapadur",

      salidas:
        totalChapadurSalida,

      entradas:
        totalChapadurEntrada,
    },

  ];


  // =======================================================
  // KPIS LOGÍSTICA
  // =======================================================

  const kpisLogistica:
    KpiItem[] = [];


  if (
    puedeRepartos
  ) {

    kpisLogistica.push({

      label:
        "Repartos",

      value:
        cargandoRepartos
          ? "—"
          : repartosActuales.length,

      description:
        "Últimos 7 días",

      icon:
        "truck",

      tone:
        "blue",

      comparison:
        cargandoRepartos
          ? undefined
          : crearComparacionCantidad(
              repartosActuales.length,
              repartosAnteriores.length,
              true
            ),

    });
  }


  if (
    puedeRechazos
  ) {

    kpisLogistica.push({

      label:
        "Rechazos",

      value:
        cargandoRechazos
          ? "—"
          : rechazosActuales.length,

      description:
        "Últimos 7 días",

      icon:
        "alert",

      tone:
        "amber",

      comparison:
        cargandoRechazos
          ? undefined
          : crearComparacionCantidad(
              rechazosActuales.length,
              rechazosAnteriores.length,
              false
            ),

    });
  }


  if (
    puedeCambios
  ) {

    kpisLogistica.push({

      label:
        "Cambios",

      value:
        cargandoRecibos
          ? "—"
          : cambiosActuales.length,

      description:
        "Últimos 7 días",

      icon:
        "boxes",

      tone:
        "green",

      comparison:
        cargandoRecibos
          ? undefined
          : crearComparacionCantidad(
              cambiosActuales.length,
              cambiosAnteriores.length,
              true
            ),

    });
  }


  if (
    puedeViaticos
  ) {

    kpisLogistica.push({

      label:
        "Viáticos",

      value:
        cargandoViaticos
          ? "—"
          : viaticosActuales.length,

      description:
        "Últimos 7 días",

      icon:
        "activity",

      tone:
        "navy",

      comparison:
        cargandoViaticos
          ? undefined
          : crearComparacionCantidad(
              viaticosActuales.length,
              viaticosAnteriores.length,
              true
            ),

    });
  }


  // =======================================================
  // KPIS EXPEDICIÓN
  // =======================================================

  const kpisExpedicion:
    KpiItem[] = [

      {
        label:
          "Órdenes",

        value:
          cargandoOrdenes
            ? "—"
            : ordenesActuales.length,

        description:
          "Últimos 7 días",

        icon:
          "truck",

        tone:
          "blue",

        comparison:
          cargandoOrdenes
            ? undefined
            : crearComparacionCantidad(
                ordenesActuales.length,
                ordenesAnteriores.length,
                true
              ),
      },


      {
        label:
          "Órdenes completadas",

        value:
          cargandoOrdenes
            ? "—"
            : `${porcentajeCompletadasActual.toLocaleString(
                "es-AR",
                {
                  maximumFractionDigits:
                    1,
                }
              )}%`,

        description:
          "Tasa de finalización",

        icon:
          "activity",

        tone:
          "green",

        comparison:
          cargandoOrdenes
            ? undefined
            : crearComparacionPorcentaje(
                porcentajeCompletadasActual,
                porcentajeCompletadasAnterior,
                true
              ),
      },


      {
        label:
          "Pendientes",

        value:
          cargandoOrdenes
            ? "—"
            : ordenesPendientesActuales.length,

        description:
          "Últimos 7 días",

        icon:
          "history",

        tone:
          "amber",

        comparison:
          cargandoOrdenes
            ? undefined
            : crearComparacionCantidad(
                ordenesPendientesActuales.length,
                ordenesPendientesAnteriores.length,
                false
              ),
      },


      {
        label:
          "Productos",

        value:
          cargandoStock
            ? "—"
            : stock.length,

        description:
          "Con control de stock",

        icon:
          "boxes",

        tone:
          "green",
      },


      {
        label:
          "Sin stock",

        value:
          cargandoStock
            ? "—"
            : productosSinStock.length,

        description:
          "Requieren atención",

        icon:
          "alert",

        tone:
          "red",
      },


      {
        label:
          "Fleteros",

        value:
          cargandoFleteros
            ? "—"
            : fleterosActivos.length,

        description:
          "Activos",

        icon:
          "truck",

        tone:
          "navy",
      },

    ];


  // =======================================================
  // MÓDULOS LOGÍSTICA
  // =======================================================

  const modulosLogistica:
    ModuleItem[] = [

      {
        title:
          "Repartos y recargas",

        description:
          (
            "Planificá salidas, asigná personal "
            +
            "y consultá las recargas."
          ),

        icon:
          "truck",

        permiso:
          "REPARTOS",

        home:
          "/repartos/inicio",

        ultimaCarga:
          ultimaCargaRepartos,

        links: [
          {
            label:
              "Nuevo reparto",

            to:
              "/repartos/nuevo",
          },
          {
            label:
              "Historial",

            to:
              "/repartos",
          },
        ],
      },


      {
        title:
          "Rechazos",

        description:
          (
            "Registrá entregas no concretadas "
            +
            "y analizá sus motivos."
          ),

        icon:
          "alert",

        permiso:
          "RECHAZOS",

        home:
          "/rechazos/inicio",

        ultimaCarga:
          ultimaCargaRechazos,

        links: [
          {
            label:
              "Nuevo rechazo",

            to:
              "/rechazos/nuevo",
          },
          {
            label:
              "Estadísticas",

            to:
              "/rechazos/estadisticas",
          },
        ],
      },


      {
        title:
          "Recibos de cambios",

        description:
          (
            "Controlá devoluciones, productos "
            +
            "y movimientos."
          ),

        icon:
          "boxes",

        permiso:
          "CAMBIOS",

        home:
          "/cambios/inicio",

        ultimaCarga:
          ultimaCargaCambios,

        links: [
          {
            label:
              "Nuevo recibo",

            to:
              "/cambios/nuevo",
          },
          {
            label:
              "Historial",

            to:
              "/cambios",
          },
        ],
      },


      {
        title:
          "Viáticos",

        description:
          (
            "Registrá y consultá viáticos "
            +
            "locales y de larga distancia."
          ),

        icon:
          "activity",

        permiso:
          "VIATICOS",

        home:
          "/viaticos/inicio",

        ultimaCarga:
          ultimaCargaViaticos,

        links: [
          {
            label:
              "Nuevo registro",

            to:
              "/viaticos/nuevo",
          },
          {
            label:
              "Resumen",

            to:
              "/viaticos/resumen",
          },
        ],
      },


      {
        title:
          "Kilometrajes",

        description:
          (
            "Control de kilómetros recorridos "
            +
            "por chofer y destino."
          ),

        icon:
          "truck",

        permiso:
          "KILOMETRAJES",

        home:
          "/kilometrajes/inicio",

        ultimaCarga:
          ultimaCargaKilometrajes,

        links: [
          {
            label:
              "Nuevo control",

            to:
              "/kilometrajes/nuevo",
          },
          {
            label:
              "Historial",

            to:
              "/kilometrajes",
          },
        ],
      },


      {
        title:
          "Control diario",

        description:
          (
            "Disponibilidad, asignaciones, "
            +
            "depósitos y distribución."
          ),

        icon:
          "boxes",

        permiso:
          "CONTROL_DIARIO",

        home:
          "/control-diario/inicio",

        ultimaCarga:
          ultimaCargaControlDiario,

        links: [
          {
            label:
              "Nueva carga",

            to:
              "/control-diario/nuevo",
          },
          {
            label:
              "Historial",

            to:
              "/control-diario",
          },
        ],
      },

    ];


  const modulosLogisticaVisibles =
    modulosLogistica.filter(
      modulo =>
        tienePermiso(
          modulo.permiso
        )
    );


  // =======================================================
  // MÓDULOS EXPEDICIÓN
  // =======================================================

  const modulosExpedicion:
    ModuleItem[] = [

      {
        title:
          "Órdenes de carga",

        description:
          (
            "Gestión de órdenes, productos "
            +
            "solicitados y entregas."
          ),

        icon:
          "truck",

        permiso:
          "EXPEDICION",

        home:
          "/expedicion/ordenes",

        ultimaCarga:
          ultimaCargaOrdenes,

        links: [
          {
            label:
              "Nueva orden",

            to:
              "/expedicion/ordenes/nueva",
          },
          {
            label:
              "Ver órdenes",

            to:
              "/expedicion/ordenes",
          },
        ],
      },


      {
        title:
          "Stock",

        description:
          (
            "Existencias, ingresos, salidas "
            +
            "y ajustes de productos."
          ),

        icon:
          "boxes",

        permiso:
          "EXPEDICION",

        home:
          "/expedicion/stock",

        ultimaCarga:
          ultimaCargaStock,

        links: [
          {
            label:
              "Ver stock",

            to:
              "/expedicion/stock",
          },
        ],
      },


      {
        title:
          "Movimientos",

        description:
          (
            "Historial completo de "
            +
            "movimientos de mercadería."
          ),

        icon:
          "history",

        permiso:
          "EXPEDICION",

        home:
          "/expedicion/movimientos",

        ultimaCarga:
          ultimaCargaMovimientos,

        links: [
          {
            label:
              "Ver movimientos",

            to:
              "/expedicion/movimientos",
          },
        ],
      },


      {
        title:
          "Fleteros",

        description:
          (
            "Administración de fleteros "
            +
            "disponibles para carga."
          ),

        icon:
          "truck",

        permiso:
          "EXPEDICION",

        home:
          "/expedicion/fleteros",

        ultimaCarga:
          ultimaCargaFleteros,

        links: [
          {
            label:
              "Administrar",

            to:
              "/expedicion/fleteros",
          },
        ],
      },


      {
        title:
          "Pallets y chapadur",

        description:
          (
            "Salidas, devoluciones y "
            +
            "saldos de materiales."
          ),

        icon:
          "boxes",

        permiso:
          "EXPEDICION",

        home:
          "/expedicion/materiales",

        ultimaCarga:
          ultimaCargaMateriales,

        links: [
          {
            label:
              "Ver materiales",

            to:
              "/expedicion/materiales",
          },
        ],
      },

    ];


  // =======================================================
  // CARGANDO
  // =======================================================

  if (
    cargandoUsuario
  ) {

    return (

      <div className="pagina">

        <div className="dashboard-container">

          Cargando panel...

        </div>

      </div>

    );
  }


  // =======================================================
  // RENDER
  // =======================================================

  return (

    <div className="pagina panel-principal-page">

      <div className="dashboard-container">


        {/* ===================================== */}
        {/* HERO */}
        {/* ===================================== */}

        <div className="panel-hero">

          <div>

            <div className="badge-panel">

              <Icon
                name="activity"
                size={16}
              />

              Panel operativo Talca

            </div>


            <h1>
              Bienvenido, {nombre}
            </h1>


            <p>
              Vista general de Logística
              y Expedición con indicadores,
              comparaciones, gráficos
              y actividad reciente.
            </p>

          </div>


          <div className="panel-hero-status">

            <span />

            <div>

              <strong>
                Plataforma disponible
              </strong>

              <small>
                Comparación: últimos 7 días
              </small>

            </div>

          </div>

        </div>


        {/* ================================================= */}
        {/* LOGÍSTICA */}
        {/* ================================================= */}

        {
          puedeVerLogistica
          &&
          (

            <section className="dashboard-area">

              <div className="dashboard-area-header">

                <div>

                  <span>
                    ÁREA OPERATIVA
                  </span>

                  <h2>
                    Logística
                  </h2>

                  <p>
                    Comparación de los últimos
                    7 días contra los 7 días
                    anteriores.
                  </p>

                </div>

              </div>


              {/* KPIS */}

              {
                kpisLogistica.length > 0
                &&
                (

                  <div className="dashboard-kpi-grid">

                    {
                      kpisLogistica.map(
                        kpi => (

                          <KpiCard
                            key={
                              kpi.label
                            }
                            kpi={
                              kpi
                            }
                          />

                        )
                      )
                    }

                  </div>

                )
              }


              {/* GRÁFICOS */}

              <div className="dashboard-chart-grid">


                <article className="dashboard-chart-card">

                  <div className="chart-heading">

                    <div>

                      <span>
                        ÚLTIMOS 7 DÍAS
                      </span>

                      <h3>
                        Registros por módulo
                      </h3>

                    </div>

                  </div>


                  <div className="chart-container">

                    {
                      actividadLogistica.length === 0
                        ? (

                            <div className="chart-empty">
                              Sin registros en este período
                            </div>

                          )
                        : (

                            <ResponsiveContainer
                              width="100%"
                              height="100%"
                            >

                              <BarChart
                                data={
                                  actividadLogistica
                                }
                              >

                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  vertical={false}
                                />

                                <XAxis
                                  dataKey="nombre"
                                />

                                <YAxis
                                  allowDecimals={false}
                                />

                                <Tooltip />

                                <Bar
                                  dataKey="cantidad"
                                  fill="#3678da"
                                  radius={[
                                    7,
                                    7,
                                    0,
                                    0,
                                  ]}
                                />

                              </BarChart>

                            </ResponsiveContainer>

                          )
                    }

                  </div>

                </article>


                <article className="dashboard-chart-card">

                  <div className="chart-heading">

                    <div>

                      <span>
                        DISTRIBUCIÓN
                      </span>

                      <h3>
                        Participación por módulo
                      </h3>

                    </div>

                  </div>


                  <div className="chart-container">

                    {
                      actividadLogistica.length === 0
                        ? (

                            <div className="chart-empty">
                              Sin registros en este período
                            </div>

                          )
                        : (

                            <ResponsiveContainer
                              width="100%"
                              height="100%"
                            >

                              <PieChart>

                                <Pie
                                  data={
                                    actividadLogistica
                                  }
                                  dataKey="cantidad"
                                  nameKey="nombre"
                                  innerRadius={60}
                                  outerRadius={95}
                                  paddingAngle={3}
                                >

                                  {
                                    actividadLogistica.map(
                                      (
                                        _,
                                        index
                                      ) => (

                                        <Cell
                                          key={
                                            index
                                          }
                                          fill={
                                            COLORES_PIE[
                                              index
                                              %
                                              COLORES_PIE.length
                                            ]
                                          }
                                        />

                                      )
                                    )
                                  }

                                </Pie>

                                <Tooltip />

                                <Legend />

                              </PieChart>

                            </ResponsiveContainer>

                          )
                    }

                  </div>

                </article>

              </div>


              {/* MÓDULOS */}

              <div className="dashboard-module-grid">

                {
                  modulosLogisticaVisibles.map(
                    modulo => (

                      <article
                        className="dashboard-module-card"
                        key={
                          modulo.title
                        }
                      >

                        <div className="dashboard-module-top">

                          <div>

                            <Icon
                              name={
                                modulo.icon
                              }
                            />

                          </div>


                          <span>
                            Logística
                          </span>

                        </div>


                        <h3>
                          {
                            modulo.title
                          }
                        </h3>


                        <p>
                          {
                            modulo.description
                          }
                        </p>


                        <div className="dashboard-module-links">

                          {
                            modulo.links.map(
                              link => (

                                <Link
                                  key={
                                    link.to
                                  }
                                  to={
                                    link.to
                                  }
                                >

                                  {
                                    link.label
                                  }

                                </Link>

                              )
                            )
                          }

                        </div>


                        <UltimaCarga
                          fecha={
                            modulo.ultimaCarga
                          }
                        />


                        <Link
                          to={
                            modulo.home
                          }
                          className="dashboard-module-enter"
                        >

                          Ingresar

                          <Icon
                            name="chevron"
                            size={15}
                          />

                        </Link>

                      </article>

                    )
                  )
                }


                {
                  puedeStockPallets
                  &&
                  (

                    <article className="dashboard-module-card">

                      <div className="dashboard-module-top">

                        <div>

                          <Icon
                            name="boxes"
                          />

                        </div>


                        <span>
                          Externo
                        </span>

                      </div>


                      <h3>
                        Stock de pallets
                      </h3>


                      <p>
                        Sistema externo de control
                        de stock de pallets.
                      </p>


                      <div className="dashboard-module-links">

                        <span className="dashboard-external-label">
                          Aplicación independiente
                        </span>

                      </div>


                      <UltimaCarga
                        texto="Sistema externo"
                      />


                      <a
                        href="http://10.242.4.13:8000/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dashboard-module-enter"
                      >

                        Abrir sistema

                        <Icon
                          name="chevron"
                          size={15}
                        />

                      </a>

                    </article>

                  )
                }

              </div>

            </section>

          )
        }


        {/* ================================================= */}
        {/* EXPEDICIÓN */}
        {/* ================================================= */}

        {
          puedeExpedicion
          &&
          (

            <section className="dashboard-area expedicion-area">

              <div className="dashboard-area-header">

                <div>

                  <span>
                    ÁREA OPERATIVA
                  </span>

                  <h2>
                    Expedición
                  </h2>

                  <p>
                    Comparación de órdenes y
                    actividad de los últimos
                    7 días.
                  </p>

                </div>


                <Link
                  to="/expedicion/inicio"
                  className="dashboard-area-link"
                >

                  Ver módulo completo

                  <Icon
                    name="chevron"
                    size={15}
                  />

                </Link>

              </div>


              {/* KPIS */}

              <div className="dashboard-kpi-grid">

                {
                  kpisExpedicion.map(
                    kpi => (

                      <KpiCard
                        key={
                          kpi.label
                        }
                        kpi={
                          kpi
                        }
                      />

                    )
                  )
                }

              </div>


              {/* GRÁFICOS */}

              <div className="dashboard-chart-grid">


                <article className="dashboard-chart-card">

                  <div className="chart-heading">

                    <div>

                      <span>
                        ÚLTIMOS 7 DÍAS
                      </span>

                      <h3>
                        Órdenes por estado
                      </h3>

                    </div>

                  </div>


                  <div className="chart-container">

                    {
                      ordenesPorEstado.length === 0
                        ? (

                            <div className="chart-empty">
                              Sin órdenes en este período
                            </div>

                          )
                        : (

                            <ResponsiveContainer
                              width="100%"
                              height="100%"
                            >

                              <PieChart>

                                <Pie
                                  data={
                                    ordenesPorEstado
                                  }
                                  dataKey="cantidad"
                                  nameKey="nombre"
                                  innerRadius={60}
                                  outerRadius={95}
                                  paddingAngle={3}
                                >

                                  {
                                    ordenesPorEstado.map(
                                      (
                                        _,
                                        index
                                      ) => (

                                        <Cell
                                          key={
                                            index
                                          }
                                          fill={
                                            COLORES_PIE[
                                              index
                                              %
                                              COLORES_PIE.length
                                            ]
                                          }
                                        />

                                      )
                                    )
                                  }

                                </Pie>

                                <Tooltip />

                                <Legend />

                              </PieChart>

                            </ResponsiveContainer>

                          )
                    }

                  </div>

                </article>


                <article className="dashboard-chart-card">

                  <div className="chart-heading">

                    <div>

                      <span>
                        STOCK ACTUAL
                      </span>

                      <h3>
                        Stock por producto
                      </h3>

                    </div>

                  </div>


                  <div className="stock-ranking-container">

                    {
                      stockPorProducto.length === 0
                        ? (

                            <div className="chart-empty">
                              Sin stock registrado
                            </div>

                          )
                        : (

                            <div className="stock-ranking">
                              {stockPorProducto.map((item, index) => (
                                <div className="stock-ranking-row" key={item.producto}>
                                  <span className="stock-ranking-position">{index + 1}</span>
                                  <div className="stock-ranking-content">
                                    <div className="stock-ranking-label">
                                      <strong>{item.producto}</strong>
                                      <span>{item.cantidad.toLocaleString("es-AR")}</span>
                                    </div>
                                    <div className="stock-ranking-track">
                                      <span style={{ width: `${Math.max((item.cantidad / stockMaximo) * 100, 2)}%` }} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                          )
                    }

                  </div>

                </article>

              </div>


              <div className="dashboard-chart-grid">


                <article className="dashboard-chart-card">

                  <div className="chart-heading">

                    <div>

                      <span>
                        ÚLTIMOS 7 DÍAS
                      </span>

                      <h3>
                        Entradas vs salidas
                      </h3>

                    </div>

                  </div>


                  <div className="chart-container">

                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >

                      <BarChart
                        data={
                          entradasSalidas
                        }
                      >

                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="nombre"
                        />

                        <YAxis />

                        <Tooltip />

                        <Bar
                          dataKey="cantidad"
                          fill="#2f75d6"
                          radius={[
                            7,
                            7,
                            0,
                            0,
                          ]}
                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                </article>


                <article className="dashboard-chart-card">

                  <div className="chart-heading">

                    <div>

                      <span>
                        ÚLTIMOS 7 DÍAS
                      </span>

                      <h3>
                        Pallets y chapadur
                      </h3>

                    </div>

                  </div>


                  <div className="chart-container">

                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >

                      <BarChart
                        data={
                          materialesGrafico
                        }
                      >

                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="material"
                        />

                        <YAxis />

                        <Tooltip />

                        <Legend />

                        <Bar
                          dataKey="salidas"
                          name="Salidas"
                          fill="#3678da"
                          radius={[
                            6,
                            6,
                            0,
                            0,
                          ]}
                        />

                        <Bar
                          dataKey="entradas"
                          name="Devoluciones"
                          fill="#20a36d"
                          radius={[
                            6,
                            6,
                            0,
                            0,
                          ]}
                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                </article>

              </div>


              {/* TARJETAS EXPEDICIÓN */}

              <div className="dashboard-module-grid">

                {
                  modulosExpedicion.map(
                    modulo => (

                      <article
                        className="
                          dashboard-module-card
                          dashboard-expedicion-card
                        "
                        key={
                          modulo.title
                        }
                      >

                        <div className="dashboard-module-top">

                          <div>

                            <Icon
                              name={
                                modulo.icon
                              }
                            />

                          </div>


                          <span>
                            Expedición
                          </span>

                        </div>


                        <h3>
                          {
                            modulo.title
                          }
                        </h3>


                        <p>
                          {
                            modulo.description
                          }
                        </p>


                        <div className="dashboard-module-links">

                          {
                            modulo.links.map(
                              link => (

                                <Link
                                  key={
                                    link.to
                                  }
                                  to={
                                    link.to
                                  }
                                >

                                  {
                                    link.label
                                  }

                                </Link>

                              )
                            )
                          }

                        </div>


                        <UltimaCarga
                          fecha={
                            modulo.ultimaCarga
                          }
                        />


                        <Link
                          to={
                            modulo.home
                          }
                          className="dashboard-module-enter"
                        >

                          Ingresar

                          <Icon
                            name="chevron"
                            size={15}
                          />

                        </Link>

                      </article>

                    )
                  )
                }

              </div>

            </section>

          )
        }

      </div>

    </div>

  );
}
