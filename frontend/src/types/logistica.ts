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