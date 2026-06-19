/**
 * Formulario para agregar un producto al carrito.
 *
 * Usa ReactiveFormsModule de Angular para definir el formulario con validaciones
 * declarativas. Las validaciones se ejecutan en el cliente antes de hacer
 * cualquier llamada a la API.
 *
 * Diferencia entre validacion de cliente y de servidor:
 * - Cliente (aqui): feedback inmediato sin esperar respuesta de red. Mejora
 *   la experiencia del usuario. Pero NO es una capa de seguridad: el usuario
 *   puede desactivar JavaScript o hacer requests directamente a la API.
 * - Servidor (repositorio FastAPI): la validacion real. El cliente confía en
 *   ella para casos que no puede verificar (ej. formato exacto de precios).
 *
 * Por eso el componente tambien maneja el error 422 del backend: si la
 * validacion del servidor rechaza el request a pesar de que el cliente lo
 * considero valido, el error se muestra al usuario sin perder el formulario.
 */
import {
  Component,
  EventEmitter,
  Output,
  signal,
  computed,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { inject } from '@angular/core';
import { ProductoInput } from '../../core/models/carrito.model';

@Component({
  selector: 'app-agregar-producto-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="tarjeta">
      <h2>Agregar Producto</h2>

      <!-- aria-live="polite" hace que los lectores de pantalla anuncien el error
           cuando aparece, sin interrumpir lo que estaban leyendo -->
      @if (errorBackend()) {
        <div
          class="mensaje-error"
          role="alert"
          aria-live="polite"
          data-testid="error-agregar-producto"
        >
          {{ errorBackend() }}
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="form-fila">
          <!-- Campo nombre -->
          <div class="form-grupo">
            <label for="nombre-producto">Nombre del producto</label>
            <input
              id="nombre-producto"
              type="text"
              formControlName="nombre"
              placeholder="Ej: Laptop, Camiseta…"
              autocomplete="off"
              [class.error]="campoInvalido('nombre')"
              data-testid="input-nombre-producto"
              aria-required="true"
              [attr.aria-invalid]="campoInvalido('nombre')"
            />
            @if (campoInvalido('nombre')) {
              <span class="campo-error" role="alert">El nombre es obligatorio</span>
            }
          </div>

          <!-- Campo precio -->
          <div class="form-grupo">
            <label for="precio-producto">Precio (COP)</label>
            <input
              id="precio-producto"
              type="number"
              formControlName="precio"
              placeholder="0"
              min="0.01"
              step="any"
              [class.error]="campoInvalido('precio')"
              data-testid="input-precio-producto"
              aria-required="true"
              [attr.aria-invalid]="campoInvalido('precio')"
            />
            @if (campoInvalido('precio')) {
              <span class="campo-error" role="alert">
                @if (form.get('precio')?.errors?.['required']) { El precio es obligatorio }
                @else if (form.get('precio')?.errors?.['min']) { El precio debe ser mayor a 0 }
              </span>
            }
          </div>

          <!-- Campo cantidad -->
          <div class="form-grupo">
            <label for="cantidad-producto">Cantidad</label>
            <input
              id="cantidad-producto"
              type="number"
              formControlName="cantidad"
              placeholder="1"
              min="1"
              max="99"
              step="1"
              [class.error]="campoInvalido('cantidad')"
              data-testid="input-cantidad-producto"
              aria-required="true"
              [attr.aria-invalid]="campoInvalido('cantidad')"
            />
            @if (campoInvalido('cantidad')) {
              <span class="campo-error" role="alert">
                @if (form.get('cantidad')?.errors?.['required']) { La cantidad es obligatoria }
                @else if (form.get('cantidad')?.errors?.['min']) { Mínimo 1 unidad }
                @else if (form.get('cantidad')?.errors?.['max']) { Máximo 99 unidades }
              </span>
            }
          </div>
        </div>

        <div class="acciones-carrito">
          <button
            type="submit"
            class="btn btn-primario"
            [disabled]="enviando()"
            data-testid="btn-agregar-producto"
          >
            @if (enviando()) {
              <span class="spinner" aria-hidden="true"></span>
              Agregando…
            } @else {
              + Agregar al carrito
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class AgregarProductoFormComponent {
  /**
   * EventEmitter que el componente padre (CarritoPageComponent) escucha
   * para saber cuando se ha enviado exitosamente un producto nuevo.
   * El padre actualiza el carrito completo tras recibir el evento.
   */
  @Output() productoAgregado = new EventEmitter<ProductoInput>();

  /** Comunica errores del backend al template del mismo componente. */
  @Output() errorOcurrido = new EventEmitter<string>();

  private fb = inject(FormBuilder);

  /** Signals de Angular 17 para estado reactivo sin boilerplate de BehaviorSubject */
  enviando = signal(false);
  errorBackend = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(1)]],
    precio: [null, [Validators.required, Validators.min(0.01)]],
    cantidad: [1, [Validators.required, Validators.min(1), Validators.max(99)]],
  });

  /** Retorna true solo si el campo ha sido tocado y tiene errores de validacion. */
  campoInvalido(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    // Marca todos los campos como 'touched' para que las validaciones se muestren
    this.form.markAllAsTouched();

    if (this.form.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.errorBackend.set(null);

    const producto: ProductoInput = {
      nombre: this.form.value.nombre.trim(),
      precio: Number(this.form.value.precio),
      cantidad: Number(this.form.value.cantidad),
    };

    // Emitimos el producto al componente padre. El padre es quien llama a la API
    // y notifica de vuelta si tuvo exito o error, llamando a los metodos de abajo.
    this.productoAgregado.emit(producto);
  }

  /** El padre llama este metodo tras un agregado exitoso */
  onExito(): void {
    this.enviando.set(false);
    this.errorBackend.set(null);
    this.form.reset({ nombre: '', precio: null, cantidad: 1 });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  /** El padre llama este metodo si la API rechaza el producto */
  onError(mensaje: string): void {
    this.enviando.set(false);
    this.errorBackend.set(mensaje);
    // NO reseteamos el formulario: el usuario debe poder corregir el valor
  }
}
