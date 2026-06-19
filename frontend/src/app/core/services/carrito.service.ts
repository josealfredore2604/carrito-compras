/**
 * Servicio HTTP para comunicarse con la API del carrito (FastAPI).
 *
 * Por que un servicio separado y no llamar HttpClient directamente en los componentes
 * -----------------------------------------------------------------------------------
 * 1. Un unico punto de cambio: si la URL base de la API cambia, solo hay que
 *    actualizarla aqui, no en cada componente.
 * 2. Testeable en aislamiento: se puede hacer mock de CarritoService en los
 *    tests de componentes sin tocar HttpClient.
 * 3. La logica de transformacion de errores esta centralizada aqui (via
 *    el interceptor de errores registrado en app.config.ts).
 *
 * Por que Injectable({ providedIn: 'root' })
 * -------------------------------------------
 * Crea una instancia singleton disponible en toda la aplicacion sin necesidad
 * de declararlo en ningun modulo ni componente. Angular 17 con standalone
 * components usa este patron: la inyeccion de dependencias funciona a nivel
 * de la aplicacion, no de un modulo NgModule.
 *
 * Por que Observable y no Promise
 * --------------------------------
 * Los Observables de RxJS permiten cancelar requests en vuelo (unsubscribe),
 * encadenar transformaciones (pipe, map, catchError) sin callbacks anidados,
 * y compartir streams entre multiples suscriptores. Para una sola llamada
 * HTTP que solo se usa una vez, las diferencias son minimas, pero el ecosistema
 * de Angular esta optimizado para RxJS y los componentes pueden usar la pipe
 * async de Angular directamente con Observables.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DescuentoInput,
  DescuentoRespuesta,
  EstadoCarrito,
  MensajeRespuesta,
  ProductoInput,
} from '../models/carrito.model';

@Injectable({ providedIn: 'root' })
export class CarritoService {
  // inject() es la forma moderna de Angular 14+ para inyectar dependencias
  // fuera del constructor. Equivalente a declarar en el constructor pero mas
  // conciso y compatible con las funciones de Angular 17 (toSignal, etc.)
  private readonly http = inject(HttpClient);

  // La URL base se toma del entorno: en desarrollo usa /api (proxiado por el
  // dev server de Angular a http://localhost:8000). En produccion usa /api
  // (proxiado por nginx a http://api:8000 dentro de Docker).
  private readonly baseUrl = environment.apiUrl;

  /**
   * Obtiene el estado completo del carrito.
   * Corresponde a GET /carrito/{sesion_id}
   */
  obtenerCarrito(sesionId: string): Observable<EstadoCarrito> {
    return this.http.get<EstadoCarrito>(`${this.baseUrl}/carrito/${sesionId}`);
  }

  /**
   * Agrega un producto al carrito.
   * Corresponde a POST /carrito/{sesion_id}/productos
   * Puede retornar 422 si el precio es <= 0 o la cantidad esta fuera de rango.
   */
  agregarProducto(sesionId: string, producto: ProductoInput): Observable<MensajeRespuesta> {
    return this.http.post<MensajeRespuesta>(
      `${this.baseUrl}/carrito/${sesionId}/productos`,
      producto
    );
  }

  /**
   * Elimina un producto individual del carrito por nombre.
   * Corresponde a DELETE /carrito/{sesion_id}/productos/{nombre}
   * Puede retornar 404 si el producto no existe en el carrito.
   */
  eliminarProducto(sesionId: string, nombre: string): Observable<MensajeRespuesta> {
    // encodeURIComponent protege nombres con espacios o caracteres especiales
    return this.http.delete<MensajeRespuesta>(
      `${this.baseUrl}/carrito/${sesionId}/productos/${encodeURIComponent(nombre)}`
    );
  }

  /**
   * Aplica un descuento (porcentaje o monto fijo) al carrito.
   * Corresponde a POST /carrito/{sesion_id}/descuento
   */
  aplicarDescuento(sesionId: string, descuento: DescuentoInput): Observable<DescuentoRespuesta> {
    return this.http.post<DescuentoRespuesta>(
      `${this.baseUrl}/carrito/${sesionId}/descuento`,
      descuento
    );
  }

  /**
   * Vacia completamente el carrito (todos los productos y descuento).
   * Corresponde a DELETE /carrito/{sesion_id}
   */
  vaciarCarrito(sesionId: string): Observable<MensajeRespuesta> {
    return this.http.delete<MensajeRespuesta>(`${this.baseUrl}/carrito/${sesionId}`);
  }
}
