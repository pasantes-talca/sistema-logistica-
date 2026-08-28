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