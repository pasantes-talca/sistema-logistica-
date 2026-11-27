export type PuntoERP = [number, number];
export interface DetalleDocumentoRepartoERP {
  id: number;
  codigo: string;
  descripcion: string;
  cantidad: string | null;
  cantidad_bultos: string | null;
  cantidad_unidades: string | null;
  precio: string | null;
}
export interface DocumentoRepartoERP {
  id: number;
  tipo: string;
  tipo_comprobante: string;
  nro_comprobante: string;
  monto: string | null;
  detalles: DetalleDocumentoRepartoERP[];
}
export interface MedioERP {
  medio: "efectivo" | "transferencia" | "cheque";
  importe: string;
  referencia?: string;
  banco?: string;
  numero_cheque?: string;
  fecha_pago?: string;
}
export interface CobroERP {
  id: number;
  importe: string;
  medios: MedioERP[];
  creado_en: string;
  anulado_en: string | null;
  motivo_anulacion: string;
  actor_nombre: string;
}
export interface ParadaRepartoERP {
  id: number;
  cliente: string;
  codigo_cliente: string;
  orden: number;
  orden_real: number | null;
  estado: string;
  observaciones_entrega: string;
  importe_a_cobrar: string;
  importe_referencia: string;
  cobrado_local: string;
  saldo: string;
  documentos: DocumentoRepartoERP[];
  cobros: CobroERP[];
  ubicacion: {
    estado: string;
    punto: PuntoERP | null;
    nombre?: string;
    actualizado_en?: string;
  };
}
export interface ResumenERP {
  cantidad_paradas: number;
  entregadas: number;
  a_cobrar: string;
  cobrado_local: string;
  saldo: string;
}
export interface RepartoERPLista {
  cod_reparto: number;
  nro_comprobante: string | null;
  ruta: string;
  almacen: string;
  chofer: string;
  transporte: string;
  camion: string;
  estado: number | null;
  monto_total: string | null;
  cod_jerarquia: number | null;
  importado: boolean;
  resumen: ResumenERP | null;
}
export interface UnidadERP {
  id: number;
  dominio: string;
  descripcion: string;
  capacidad: number;
  activo: boolean;
}
export interface RecorridoERP {
  ids: number[];
  origen: PuntoERP;
  regreso: boolean;
  geometria: PuntoERP[];
  distancia: number;
  segundos: number;
  distancia_anterior?: number;
  segundos_anteriores?: number;
  firma?: string | null;
}
export interface RepartoERPDetalle extends RepartoERPLista {
  version_operativa: number;
  paradas: ParadaRepartoERP[];
  resumen: ResumenERP;
  usuario_asignado: number | null;
  usuario_asignado_nombre: string;
  unidad: number | null;
  unidad_detalle: UnidadERP | null;
  bultos: string | null;
  carga_completa: boolean;
  ocupacion: string | null;
  origen: PuntoERP | null;
  recorrido_guardado: Partial<RecorridoERP>;
  eventos: {
    id: number;
    accion: string;
    usuario: string;
    creado_en: string;
    datos: Record<string, unknown>;
  }[];
}
export interface CatalogosERP {
  usuarios: { id: number; nombre: string }[];
  unidades: UnidadERP[];
  permisos: string[];
  clientes_persat: number;
}
export interface ListadoERP {
  results: RepartoERPLista[];
  fecha: string;
  advertencia: string;
  permisos: string[];
}
