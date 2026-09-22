export interface Empleado {
  id: number;
  legajo: string | null;
  nombre: string;
  puesto: string;
  disponible: boolean;
  activo: boolean;
}

export interface Vehiculo {
  id: number;
  patente: string;
  descripcion: string;
  tipo: string;
  activo: boolean;
}

export interface Asignacion {
  id: number;
  codigo: string;
  descripcion: string;
  activo: boolean;
  chofer_predeterminado_id: number | null;
  chofer_predeterminado_nombre: string | null;
}

export interface RepartoPersonal {
  id: number;
  empleado_id: number;
  empleado_nombre: string;
  rol: "CHOFER" | "AYUDANTE";
  orden: number;
}

export interface Reparto {
  id: number;
  fecha: string;

  vehiculo_id: number | null;
  patente: string | null;

  asignacion_id: number | null;
  asignacion_codigo: string | null;

  bultos: number;
  puntos_venta: string;

  recargas: number;
  cantidad_personas: number;
  recargas_totales: number;

  observaciones: string;

  personal: RepartoPersonal[];

  creado_en: string;
  actualizado_en: string;
}

export interface CrearRepartoPayload {
  fecha: string;
  vehiculo_id: number | null;
  asignacion_id: number | null;
  chofer_id: number;
  ayudantes_ids: number[];
  bultos: number;
  puntos_venta: string;
  observaciones: string;
}

export interface ReporteRecargasEmpleado {
  empleado_id: number;
  legajo: string | null;
  nombre: string;
  recargas: number;
}


export interface ReporteRecargas {
  desde: string;
  hasta: string;
  cantidad_repartos: number;
  empleados: ReporteRecargasEmpleado[];
  total_general: number;
}


export interface MotivoRechazo {
  id: number;
  nombre: string;
  activo: boolean;
}


export interface Rechazo {
  id: number;

  fecha: string;

  asignacion_id: number | null;
  asignacion_codigo: string | null;

  punto_venta: string;
  bultos: string;

  motivo_id: number;
  motivo_nombre: string;

  observacion: string;

  registrado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}


export interface CrearRechazoPayload {
  fecha: string;

  asignacion_id: number | null;

  punto_venta: string;
  bultos: string;

  motivo_id: number;

  observacion: string;
}


export interface EstadisticaMotivoRechazo {
  motivo_id: number;
  motivo: string;
  cantidad: number;
  porcentaje: number;
}


export interface EstadisticaAsignacionRechazo {
  asignacion_id: number | null;
  asignacion: string;
  cantidad: number;
}


export interface EstadisticasRechazos {
  desde: string;
  hasta: string;

  asignacion_id: number | null;

  total_rechazos: number;

  por_motivo: EstadisticaMotivoRechazo[];

  por_asignacion: EstadisticaAsignacionRechazo[];
}

export interface Concesionario {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  presentacion: string;
  sabor: string;
  familia: string;
  activo: boolean;
}

export interface MotivoCambio {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface DetalleReciboCambio {
  id: number;
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  producto_familia: string;
  cantidad: string;
  observacion: string;
  motivo_id: number | null;
  motivo_nombre: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface ReciboCambio {
  id: number;
  fecha: string;
  concesionario_id: number;
  concesionario_nombre: string;

  pallets: string;
  pallets_observacion: string;

  pallets_descargados: string;
  pallets_descargados_observacion: string;

  prensados: string;
  prensados_observacion: string;

  detalles: DetalleReciboCambio[];

  creado_en: string;
  actualizado_en: string;
}

export interface DetalleReciboCambioPayload {
  producto_id: number;
  cantidad: number;
  motivo_id: number | null;
  observacion: string;
}

export interface CrearReciboCambioPayload {
  fecha: string;
  concesionario_id: number;

  pallets: number;
  pallets_observacion: string;

  pallets_descargados: number;
  pallets_descargados_observacion: string;

  prensados: number;
  prensados_observacion: string;

  detalles: DetalleReciboCambioPayload[];
}

export interface RespuestaGuardarReciboCambio {
  creado: boolean;
  recibo: ReciboCambio;
}

export interface EstadisticaCambioProducto {
  producto_id: number;
  codigo: string;
  producto: string;
  familia: string;
  cantidad: number;
  porcentaje: number;
}

export interface EstadisticaCambioProductoConcesionario {
  producto_id: number;
  codigo: string;
  producto: string;
  familia: string;

  concesionario_id: number;
  concesionario: string;

  cantidad: number;
  porcentaje: number;
}

export interface EstadisticasCambios {
  desde: string;
  hasta: string;

  concesionario_id: number | null;

  modo: "todos" | "concesionario";

  cantidad_recibos: number;
  total_cantidad: number;

  por_producto: EstadisticaCambioProducto[];

  por_producto_concesionario:
    EstadisticaCambioProductoConcesionario[];
}

export interface UsuarioActual {
  autenticado?: boolean;
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  nombre_completo: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface InterpretacionAsistente {
  tipo:
    | "repartos"
    | "recargas"
    | "rechazos"
    | "cambios"
    | "general";

  accion: string;

  desde: string | null;
  hasta: string | null;

  asignacion_codigo?: string | null;
  empleado?: string | null;
  concesionario?: string | null;
  producto?: string | null;
}


export interface RespuestaAsistente {
  respuesta: string;

  interpretacion:
    InterpretacionAsistente;

  datos:
    Record<string, unknown>;
}

// =============================================
// VIÁTICOS
// =============================================

export type TipoRepartoViatico =
  | "LOCAL"
  | "LARGA_DISTANCIA";


export interface Viatico {

  id: number;

  chofer: number;

  chofer_nombre: string;

  tipo_reparto:
    TipoRepartoViatico;

  tipo_reparto_nombre:
    string;

  fecha: string;

  mes: string;

  valor_viatico: string;

  cantidad_viaticos: number;

  monto_total: string;

  observaciones: string;

  creado_en: string;

  actualizado_en: string;

}


export interface CrearViaticoPayload {

  chofer: number;

  tipo_reparto:
    TipoRepartoViatico;

  fecha: string;

  valor_viatico: number;

  cantidad_viaticos: number;

  observaciones: string;

}


export interface ResumenTipoViatico {

  cantidad: number;

  monto: number | string;

}


export interface ResumenMesViaticos {

  numero_mes: number;

  mes: string;

  local: ResumenTipoViatico;

  larga_distancia:
    ResumenTipoViatico;

  total_mes:
    number | string;

}


export interface TotalesResumenViaticos {

  local: ResumenTipoViatico;

  larga_distancia:
    ResumenTipoViatico;

  cantidad_total: number;

  monto_total:
    number | string;

}


export interface ResumenAnualViaticos {

  anio: number;

  meses:
    ResumenMesViaticos[];

  totales:
    TotalesResumenViaticos;

}

export interface DestinoKilometraje {
  id: number;
  nombre: string;
  distancia_km: string;
  activo: boolean;
}

export interface RegistroKilometraje {
  id: number;
  fecha: string;
  destino: number;
  destino_nombre: string;
  cantidad_viajes: number;
  distancia_km: string;
  kilometros: string;
  observaciones: string;
}

export interface ControlKilometraje {
  id: number;
  chofer: number;
  chofer_nombre: string;
  fecha_desde: string;
  fecha_hasta: string;
  observaciones: string;
  total_km: string;
  registros: RegistroKilometraje[];
  creado_en: string;
  actualizado_en: string;
}

export interface RegistroKilometrajeEntrada {
  fecha: string;
  destino: number;
  cantidad_viajes: number;
  observaciones?: string;
}

export interface CrearControlKilometrajePayload {
  chofer: number;
  fecha_desde: string;
  fecha_hasta: string;
  observaciones?: string;
  registros: RegistroKilometrajeEntrada[];
}

export interface EstadisticaKilometrajeChofer {
  id: number;
  nombre: string;
  kilometros: string;
}

export interface EstadisticaKilometrajeDestino {
  id: number;
  nombre: string;
  kilometros: string;
  viajes: number;
}

export interface EstadisticasKilometrajes {
  total_km: string;
  cantidad_registros: number;

  mejor_chofer: EstadisticaKilometrajeChofer | null;

  mejor_destino: EstadisticaKilometrajeDestino | null;

  por_chofer: EstadisticaKilometrajeChofer[];

  por_destino: EstadisticaKilometrajeDestino[];
}

export interface ProductoControlDiario {
  id: number;
  familia: string;
  sabor: string;
  presentacion: string;
  nombre: string;
  orden: number;
  activo: boolean;
}


export interface UbicacionControlDiario {
  id: number;
  nombre: string;
  tipo:
    | "PLANTA"
    | "DEPOSITO"
    | "DISTRIBUIDOR"
    | "DESTINO"
    | "OTRO";
  tipo_nombre: string;
  orden: number;
  activo: boolean;
}


export type TipoMovimientoControlDiario =
  | "DISPONIBLE"
  | "RESERVA"
  | "ASIGNACION"
  | "STOCK_DEPOSITO"
  | "DISTRIBUCION"
  | "PENDIENTE"
  | "AJUSTE";


export interface MovimientoControlDiario {
  id: number;

  producto: number;
  producto_nombre: string;

  ubicacion: number;
  ubicacion_nombre: string;

  tipo_movimiento:
    TipoMovimientoControlDiario;

  tipo_movimiento_nombre: string;

  cantidad: string;

  observaciones: string;

  creado_en: string;
  actualizado_en: string;
}


export interface ControlDiario {
  id: number;

  fecha: string;

  observaciones: string;

  creado_por: number | null;
  creado_por_nombre: string | null;

  creado_en: string;
  actualizado_en: string;

  movimientos:
    MovimientoControlDiario[];
}


export interface MovimientoControlDiarioEntrada {
  producto: number;

  ubicacion: number;

  tipo_movimiento:
    TipoMovimientoControlDiario;

  cantidad: number | string;

  observaciones?: string;
}


export interface CrearControlDiarioPayload {
  fecha: string;

  observaciones?: string;

  movimientos:
    MovimientoControlDiarioEntrada[];
}


export interface ResumenProductoControlDiario {
  producto_id: number;
  producto_nombre: string;

  disponible: string;
  reserva: string;
  asignacion: string;
  stock_deposito: string;
  distribucion: string;
  pendiente: string;
  ajuste: string;
}


export interface ResumenControlDiario {
  control_id: number;

  fecha: string;

  resumen:
    ResumenProductoControlDiario[];
}

export interface EstadisticaControlDiarioTipo {
  tipo_movimiento: string;
  total: string;
}


export interface EstadisticaControlDiarioProducto {
  producto_id: number;
  producto__nombre: string;
  total: string;
}


export interface EstadisticaControlDiarioDistribuidor {
  ubicacion_id: number;
  ubicacion__nombre: string;
  total: string;
}


export interface EstadisticaControlDiarioFecha {
  control__fecha: string;
  total: string;
}


export interface EstadisticasControlDiario {
  total_movimientos: number;

  total_cantidad: string;

  producto_principal:
    EstadisticaControlDiarioProducto
    | null;

  distribuidor_principal:
    EstadisticaControlDiarioDistribuidor
    | null;

  por_tipo:
    EstadisticaControlDiarioTipo[];

  por_producto:
    EstadisticaControlDiarioProducto[];

  por_distribuidor:
    EstadisticaControlDiarioDistribuidor[];

  por_fecha:
    EstadisticaControlDiarioFecha[];
}

