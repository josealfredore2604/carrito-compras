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
      <dl class="resumen-grid">
        <dt class="resumen-etiqueta">Productos en el carrito</dt>
        <dd class="resumen-valor" data-testid="cantidad-productos">{{ cantidadProductos }}</dd>

        <hr class="resumen-separador" role="presentation" />

        <dt class="resumen-etiqueta">Total sin IVA</dt>
        <dd class="resumen-valor" data-testid="total-carrito">
          {{ total | currency:'COP':'symbol-narrow':'1.0-0' }}
        </dd>

        <dt class="resumen-etiqueta">IVA (19%)</dt>
        <dd class="resumen-valor" data-testid="iva-carrito">
          {{ totalConIva - total | currency:'COP':'symbol-narrow':'1.0-0' }}
        </dd>

        <hr class="resumen-separador" role="presentation" />

        <dt class="resumen-etiqueta resumen-total-final">
          <strong>Total con IVA</strong>
        </dt>
        <dd class="resumen-valor resumen-total-final" data-testid="total-con-iva">
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
