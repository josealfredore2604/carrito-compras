/**
 * Punto de entrada de la aplicacion Angular.
 *
 * bootstrapApplication reemplaza al antiguo platformBrowserDynamic().bootstrapModule(AppModule).
 * Recibe el componente raiz (AppComponent) y la configuracion de la app
 * (appConfig con routes, providers, interceptores).
 *
 * El .catch() loggea errores de inicializacion en la consola del navegador.
 * Errores tipicos: proveedor no encontrado, ruta mal configurada.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
