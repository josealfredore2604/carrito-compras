import { Component, Input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

/**
 * Componente de presentacion que muestra el resumen financiero del carrito.
 * Solo recibe datos por @Input y no emite eventos.
 */
@Component({
  selector: 'app-resumen-total',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="tarjeta">
      <h2>Resumen</h2>
      <!-- <hr> no es hijo valido de <dl>; la separacion visual se hace con CSS -->
      <dl class="resumen-grid">
        <dt class="resumen-etiqueta">Productos en el carrito</dt>
        <dd class="resumen-valor" data-testid="cantidad-productos">{{ cantidadProductos }}</dd>

        <dt class="resumen-etiqueta resumen-separador-top">Total sin IVA</dt>
        <dd class="resumen-valor resumen-separador-top" data-testid="total-carrito">
          {{ total | currency:'COP':'symbol-narrow':'1.0-0' }}
        </dd>

        <dt class="resumen-etiqueta">IVA (19%)</dt>
        <dd class="resumen-valor" data-testid="iva-carrito">
          {{ totalConIva - total | currency:'COP':'symbol-narrow':'1.0-0' }}
        </dd>

        <dt class="resumen-etiqueta resumen-total-final resumen-separador-top">
          <strong>Total con IVA</strong>
        </dt>
        <dd class="resumen-valor resumen-total-final resumen-separador-top" data-testid="total-con-iva">
          {{ totalConIva | currency:'COP':'symbol-narrow':'1.0-0' }}
        </dd>
      </dl>
    </div>
  `,
})
export class ResumenTotalComponent {
  @Input() total = 0;
  @Input() totalConIva = 0;
  @Input() cantidadProductos = 0;
}
