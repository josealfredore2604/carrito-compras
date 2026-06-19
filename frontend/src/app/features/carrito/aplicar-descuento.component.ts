import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { inject } from '@angular/core';
import { DescuentoInput } from '../../core/models/carrito.model';

/**
 * Formulario para aplicar un descuento al carrito.
 *
 * El descuento puede ser de tipo "porcentaje" (0-100%) o "fijo" (monto en COP).
 * La validacion en el cliente verifica que el valor sea positivo; el servidor
 * valida los rangos exactos (porcentaje <= 100, fijo >= 0).
 */
@Component({
  selector: 'app-aplicar-descuento',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="tarjeta">
      <h2>Aplicar Descuento</h2>

      @if (errorBackend()) {
        <div
          class="mensaje-error"
          role="alert"
          aria-live="polite"
          data-testid="error-descuento"
        >
          {{ errorBackend() }}
        </div>
      }

      @if (mensajeExito()) {
        <div
          class="mensaje-exito"
          role="status"
          aria-live="polite"
          data-testid="exito-descuento"
        >
          {{ mensajeExito() }}
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="form-fila">
          <div class="form-grupo">
            <label for="tipo-descuento">Tipo de descuento</label>
            <select
              id="tipo-descuento"
              formControlName="tipo"
              data-testid="select-tipo-descuento"
            >
              <option value="porcentaje">Porcentaje (%)</option>
              <option value="fijo">Monto fijo (COP)</option>
            </select>
          </div>

          <div class="form-grupo">
            <label for="valor-descuento">
              {{ form.get('tipo')?.value === 'porcentaje' ? 'Porcentaje (0–100)' : 'Monto (COP)' }}
            </label>
            <input
              id="valor-descuento"
              type="number"
              formControlName="valor"
              placeholder="0"
              min="0"
              step="any"
              [class.error]="campoInvalido('valor')"
              data-testid="input-valor-descuento"
              aria-required="true"
              [attr.aria-invalid]="campoInvalido('valor')"
            />
            @if (campoInvalido('valor')) {
              <span class="campo-error" role="alert">El valor debe ser mayor o igual a 0</span>
            }
          </div>
        </div>

        <div class="acciones-carrito">
          <button
            type="submit"
            class="btn btn-primario"
            [disabled]="enviando()"
            data-testid="btn-aplicar-descuento"
          >
            @if (enviando()) {
              <span class="spinner" aria-hidden="true"></span>
              Aplicando…
            } @else {
              Aplicar descuento
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class AplicarDescuentoComponent {
  @Output() descuentoAplicado = new EventEmitter<DescuentoInput>();

  private fb = inject(FormBuilder);

  enviando = signal(false);
  errorBackend = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    tipo: ['porcentaje'],
    valor: [0, [Validators.required, Validators.min(0)]],
  });

  campoInvalido(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.errorBackend.set(null);
    this.mensajeExito.set(null);

    const descuento: DescuentoInput = {
      tipo: this.form.value.tipo,
      valor: Number(this.form.value.valor),
    };

    this.descuentoAplicado.emit(descuento);
  }

  onExito(nuevoTotal: number): void {
    this.enviando.set(false);
    this.mensajeExito.set(`Descuento aplicado. Nuevo total: $${nuevoTotal.toLocaleString('es-CO')}`);
  }

  onError(mensaje: string): void {
    this.enviando.set(false);
    this.errorBackend.set(mensaje);
  }
}
