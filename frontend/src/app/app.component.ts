import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Componente raiz de la aplicacion.
 *
 * Es el punto de entrada que Angular monta en el <app-root> del index.html.
 * Su unica responsabilidad es alojar el <router-outlet> donde el Router de
 * Angular renderiza el componente correspondiente a la URL actual.
 *
 * standalone: true significa que este componente no pertenece a ningun
 * NgModule. Declara sus dependencias directamente en imports: [RouterOutlet].
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {}
