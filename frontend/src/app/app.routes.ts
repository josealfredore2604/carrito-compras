import { Routes } from '@angular/router';

/**
 * Rutas de la aplicacion.
 *
 * La ruta '' redirige a /carrito. La ruta /carrito carga el componente de
 * la pagina del carrito. loadComponent usa lazy loading: el bundle del
 * componente se descarga solo cuando el usuario navega a esa ruta, no al
 * cargar la app. Para una app pequeña la diferencia es minima, pero es el
 * patron recomendado con Angular standalone porque permite optimizaciones
 * automaticas de code splitting en el build.
 *
 * pathMatch: 'full' en la ruta '' garantiza que la redireccion solo ocurre
 * cuando la URL es exactamente '' y no cuando es un prefijo de otra ruta.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'carrito',
    pathMatch: 'full',
  },
  {
    path: 'carrito',
    loadComponent: () =>
      import('./features/carrito/carrito-page.component').then(
        (m) => m.CarritoPageComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'carrito',
  },
];
