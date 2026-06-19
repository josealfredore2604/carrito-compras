/**
 * Configuracion principal de la aplicacion Angular standalone.
 *
 * En Angular 17 sin NgModules, la configuracion de providers (servicios globales,
 * configuracion de rutas, interceptores HTTP) se hace en este archivo.
 * bootstrapApplication() en main.ts recibe este objeto de configuracion.
 *
 * Por que ya no existe AppModule
 * --------------------------------
 * Los NgModules fueron introducidos en Angular 2 para organizar la aplicacion.
 * Con el tiempo se volvieron verbosos y dificiles de entender para principiantes.
 * Angular 14 introdujo Standalone Components que no requieren NgModule: cada
 * componente declara sus propias dependencias con imports: [].
 * Angular 17 hace esto el default recomendado.
 *
 * Por que provideHttpClient() y no HttpClientModule
 * ---------------------------------------------------
 * HttpClientModule es el enfoque antiguo de NgModule. provideHttpClient() es
 * la forma moderna que funciona con standalone. withInterceptors() agrega
 * los interceptores como funciones puras (functional interceptors), la forma
 * recomendada en Angular 17 en vez de clases que implementan HttpInterceptor.
 *
 * Que hace withFetch()
 * ----------------------
 * Por defecto, HttpClient usa XMLHttpRequest. withFetch() le dice que use la
 * API Fetch nativa del navegador en su lugar. Fetch es mas moderna y permite
 * funcionalidades como streaming. En este proyecto no es estrictamente
 * necesario pero es la forma mas moderna.
 */
import { ApplicationConfig } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { routes } from './app.routes';

/**
 * Interceptor funcional de errores HTTP.
 *
 * Un interceptor es un middleware HTTP del cliente: se ejecuta en cada request
 * (hacia afuera) y cada response (de vuelta). Este interceptor solo actua en
 * las respuestas de error (catchError) para transformar los objetos de error
 * HTTP de Angular en mensajes legibles para el usuario.
 *
 * Por que transformar los errores aqui y no en cada componente:
 * Si cada componente hace su propio manejo de errores, hay codigo duplicado
 * y riesgo de inconsistencia en los mensajes. El interceptor centraliza la
 * logica: los componentes reciben siempre un Error con mensaje ya formateado.
 */
export const errorInterceptor = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let mensaje: string;

      if (error.status === 0) {
        // status 0: sin respuesta del servidor (red caida, CORS rechazado, timeout)
        mensaje = 'No se puede conectar con el servidor. Verifica que la API esté corriendo.';
      } else if (error.status === 404) {
        mensaje = error.error?.detail || 'Recurso no encontrado.';
      } else if (error.status === 422) {
        // 422 Unprocessable Entity: validacion de negocio del backend
        // La API retorna el mensaje de error en error.detail (string o array)
        const detail = error.error?.detail;
        if (typeof detail === 'string') {
          mensaje = detail;
        } else if (Array.isArray(detail)) {
          // Pydantic retorna un array de objetos de error de validacion
          mensaje = detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(', ');
        } else {
          mensaje = 'Datos inválidos. Verifica los campos del formulario.';
        }
      } else if (error.status >= 500) {
        mensaje = `Error interno del servidor (${error.status}). Intenta de nuevo más tarde.`;
      } else {
        mensaje = `Error ${error.status}: ${error.statusText}`;
      }

      // throwError retorna un Observable que emite inmediatamente el error.
      // Los componentes que subscriben al Observable recibiran este Error
      // en el callback de error (subscribe({ error: e => ... })).
      return throwError(() => new Error(mensaje));
    })
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor])),
  ],
};
