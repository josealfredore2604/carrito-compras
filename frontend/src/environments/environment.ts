/**
 * Entorno de desarrollo local.
 *
 * El dev server de Angular (ng serve) se ejecuta en el puerto 4200.
 * El proxy.conf.json redirige /api/* → http://localhost:8000/* para evitar
 * problemas de CORS durante el desarrollo. Por eso la apiUrl usa /api:
 * el propio dev server hace el proxy, no el navegador directamente.
 *
 * Durante el build de produccion (ng build --configuration=production),
 * Angular CLI reemplaza este archivo con environment.prod.ts. En desarrollo
 * este archivo es el que se usa.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
};
