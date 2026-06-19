/**
 * Interfaces TypeScript que modelan los contratos de la API del carrito.
 *
 * Estas interfaces replican exactamente la estructura del JSON que retorna la
 * API FastAPI. Si la API cambia, este archivo debe actualizarse para mantener
 * la coherencia. TypeScript usa estas definiciones para detectar errores de
 * tipado en tiempo de compilacion: si el componente intenta acceder a una
 * propiedad que no existe en la interfaz, el compilador reporta el error.
 *
 * Por que interfaces y no clases: las interfaces solo existen en tiempo de
 * compilacion. En el bundle de produccion no generan ningun codigo JavaScript.
 * Las clases generan codigo; las interfaces solo generan comprobaciones.
 * Para modelos de datos puros (sin metodos), las interfaces son mas eficientes.
 */

/** Representa un producto dentro del carrito. */
export interface ProductoCarrito {
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

/** Respuesta completa del GET /carrito/{sesion_id} */
export interface EstadoCarrito {
  sesion_id: string;
  productos: ProductoCarrito[];
  total: number;
  total_con_iva: number;
  cantidad_productos: number;
}

/** Cuerpo del POST /carrito/{sesion_id}/productos */
export interface ProductoInput {
  nombre: string;
  precio: number;
  cantidad: number;
}

/** Cuerpo del POST /carrito/{sesion_id}/descuento */
export interface DescuentoInput {
  tipo: 'porcentaje' | 'fijo';
  valor: number;
}

/** Respuesta de operaciones que devuelven un mensaje */
export interface MensajeRespuesta {
  mensaje: string;
}

/** Respuesta del endpoint de descuento */
export interface DescuentoRespuesta extends MensajeRespuesta {
  total: number;
}
