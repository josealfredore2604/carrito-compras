/**
 * Componente contenedor (smart component) de la pagina del carrito.
 *
 * Es el unico componente que habla con CarritoService. Los componentes hijos
 * son "dumb": reciben datos por @Input y emiten eventos por @Output.
 *
 * Responsabilidades de este componente:
 * 1. Generar y persistir el sesion_id en sessionStorage.
 * 2. Cargar el estado del carrito al inicializar y tras cada operacion.
 * 3. Coordinar las llamadas a la API y pasar el resultado a los hijos.
 * 4. Manejar el estado global de carga y errores de la pagina.
 *
 * Por que sessionStorage y no localStorage
 * -----------------------------------------
 * sessionStorage es por pestaña del navegador: cada pestaña nueva tiene su
 * propio sessionStorage limpio. localStorage persiste entre pestañas.
 * Esto garantiza que dos pestañas abiertas tengan carritos independientes,
 * lo que es util para los tests E2E de aislamiento de sesion y para simular
 * dos usuarios distintos desde el mismo navegador.
 *
 * Por que UUID v4 y no un numero secuencial
 * ------------------------------------------
 * Un UUID aleatorio es practicamente imposible de adivinar (2^122 posibles
 * valores). Un numero secuencial (1, 2, 3...) es predecible: un atacante puede
 * intentar acceder al carrito de otro usuario incrementando el ID. El UUID
 * no es un mecanismo de autenticacion (cualquiera que conozca el UUID puede
 * acceder al carrito), pero dificulta el acceso no intencional.
 */
import {
  Component,
  OnInit,
  ViewChild,
  signal,
  inject,
} from '@angular/core';
import { CarritoService } from '../../core/services/carrito.service';
import {
  DescuentoInput,
  EstadoCarrito,
  ProductoInput,
} from '../../core/models/carrito.model';
import { AgregarProductoFormComponent } from './agregar-producto-form.component';
import { ListaProductosComponent } from './lista-productos.component';
import { ResumenTotalComponent } from './resumen-total.component';
import { AplicarDescuentoComponent } from './aplicar-descuento.component';

/** Genera un UUID v4 sin dependencias externas. */
function generarUUID(): string {
  // crypto.randomUUID() esta disponible en navegadores modernos y en Node 14.17+
  // Es la forma mas segura de generar UUIDs aleatorios.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para entornos muy antiguos (SSR, IE): implementacion manual de UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

@Component({
  selector: 'app-carrito-page',
  standalone: true,
  imports: [
    AgregarProductoFormComponent,
    ListaProductosComponent,
    ResumenTotalComponent,
    AplicarDescuentoComponent,
  ],
  templateUrl: './carrito-page.component.html',
})
export class CarritoPageComponent implements OnInit {
  private carritoService = inject(CarritoService);

  // El sesion_id se genera o recupera al iniciar el componente
  sesionId = '';

  // Signals para el estado reactivo de la pagina
  carrito = signal<EstadoCarrito | null>(null);
  cargando = signal(false);
  eliminando = signal(false);
  errorPagina = signal<string | null>(null);

  // Referencias a los componentes hijos para llamar sus metodos de callback
  @ViewChild(AgregarProductoFormComponent)
  formAgregar!: AgregarProductoFormComponent;

  @ViewChild(AplicarDescuentoComponent)
  formDescuento!: AplicarDescuentoComponent;

  ngOnInit(): void {
    // Recuperar el sesion_id de sessionStorage o crear uno nuevo
    const sesionGuardada = sessionStorage.getItem('tiendauv_sesion_id');
    this.sesionId = sesionGuardada ?? generarUUID();

    if (!sesionGuardada) {
      // Primera vez: guardar para esta sesion de pestaña
      sessionStorage.setItem('tiendauv_sesion_id', this.sesionId);
    }

    this.cargarCarrito();
  }

  /** Carga el estado completo del carrito desde la API */
  cargarCarrito(): void {
    this.cargando.set(true);
    this.errorPagina.set(null);

    this.carritoService.obtenerCarrito(this.sesionId).subscribe({
      next: (estado) => {
        this.carrito.set(estado);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.errorPagina.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /** Llamado cuando el formulario de agregar emite un producto */
  onAgregarProducto(producto: ProductoInput): void {
    this.carritoService.agregarProducto(this.sesionId, producto).subscribe({
      next: () => {
        this.formAgregar.onExito();
        this.cargarCarrito(); // Recarga el carrito para mostrar el nuevo estado
      },
      error: (err: Error) => {
        this.formAgregar.onError(err.message);
      },
    });
  }

  /** Llamado cuando el usuario hace click en "Eliminar" en la lista de productos */
  onEliminarProducto(nombre: string): void {
    this.eliminando.set(true);

    this.carritoService.eliminarProducto(this.sesionId, nombre).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.cargarCarrito();
      },
      error: (err: Error) => {
        this.eliminando.set(false);
        this.errorPagina.set(err.message);
      },
    });
  }

  /** Llamado cuando el formulario de descuento emite un descuento */
  onAplicarDescuento(descuento: DescuentoInput): void {
    this.carritoService.aplicarDescuento(this.sesionId, descuento).subscribe({
      next: (respuesta) => {
        this.formDescuento.onExito(respuesta.total);
        this.cargarCarrito();
      },
      error: (err: Error) => {
        this.formDescuento.onError(err.message);
      },
    });
  }

  /** Vacia completamente el carrito */
  onVaciarCarrito(): void {
    this.cargando.set(true);

    this.carritoService.vaciarCarrito(this.sesionId).subscribe({
      next: () => {
        this.cargarCarrito();
      },
      error: (err: Error) => {
        this.errorPagina.set(err.message);
        this.cargando.set(false);
      },
    });
  }
}
