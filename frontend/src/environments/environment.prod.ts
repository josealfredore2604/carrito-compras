/**
 * Entorno de produccion (Docker con nginx).
 *
 * En produccion, nginx sirve el frontend en el puerto 80 (o 4200 en docker-
 * compose) y actua como reverse proxy: /api/* → http://api:8000/*.
 * El frontend nunca habla directamente con la API: todo pasa por nginx en el
 * mismo origen, por lo que no hay problemas de CORS.
 *
 * La ruta /api es relativa al origen actual, lo que significa que funciona
 * independientemente del dominio donde se despliegue la aplicacion.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};
