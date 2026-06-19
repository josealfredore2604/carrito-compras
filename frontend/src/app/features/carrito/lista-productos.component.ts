/**
 * Componente de presentacion pura: muestra la lista de productos del carrito.
 *
 * Es un "dumb component" (componente tonto): no tiene logica de negocio ni
 * llama a servicios. Solo recibe datos por @Input() y emite eventos por
 * @Output(). Esto facilita el testing y la reutilizacion.
 *
 * La logica de negocio (llamar a la API para eliminar, recargar el carrito)
 * esta en el componente contenedor (CarritoPageComponent).
 */
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProductoCarrito } from '../../core/models/carrito.model';

@Component({
  selector: 'app-lista-productos',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="tarjeta">
      <h2>Productos en el carrito</h2>

      <div data-testid="lista-productos">
        @if (productos.length === 0) {
          <p class="carrito-vacio" data-testid="carrito-vacio">
            El carrito está vacío. Agrega tu primer producto arriba.
          </p>
        } @else {
          <table class="lista-productos-tabla" role="table" aria-label="Productos en el carrito">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Precio unit.</th>
                <th scope="col">Cant.</th>
                <th scope="col">Subtotal</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (producto of productos; track producto.nombre) {
                <tr
                  [attr.data-testid]="'item-producto-' + producto.nombre"
                  [attr.aria-label]="'Producto: ' + producto.nombre"
                >
                  <td>{{ producto.nombre }}</td>
                  <td>{{ producto.precio | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td>{{ producto.cantidad }}</td>
                  <td>{{ producto.subtotal | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-peligro"
                      (click)="onEliminar(producto.nombre)"
                      [disabled]="eliminando"
                      [attr.data-testid]="'btn-eliminar-' + producto.nombre"
                      [attr.aria-label]="'Eliminar ' + producto.nombre + ' del carrito'"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
  styles: [`
    /* Clase de accesibilidad: visible para lectores de pantalla, oculto visualmente */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `],
})
export class ListaProductosComponent {
  @Input() productos: ProductoCarrito[] = [];

  /**
   * Cuando el usuario hace click en "Eliminar", este componente emite el
   * nombre del producto. El padre (CarritoPageComponent) llama a la API
   * y actualiza la lista si tiene exito.
   */
  @Output() eliminarProducto = new EventEmitter<string>();

  /** El padre pone esto en true mientras llama a la API de eliminar */
  @Input() eliminando = false;

  onEliminar(nombre: string): void {
    this.eliminarProducto.emit(nombre);
  }
}
