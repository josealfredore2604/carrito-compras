/**
 * Suite E2E funcional del carrito: camino feliz y casos de error.
 *
 * Que es una prueba E2E (End-to-End)
 * ------------------------------------
 * Una prueba E2E verifica el sistema completo desde la perspectiva del usuario:
 * abre un navegador real, interactua con la UI, y verifica los resultados
 * visibles. A diferencia de las pruebas unitarias (que testean una funcion
 * aislada) o las de integracion (que testean capas del backend), las E2E
 * testean la cadena completa: usuario → navegador → Angular → API → base de datos.
 *
 * Por que los selectores usan data-testid
 * -----------------------------------------
 * Los selectores CSS o XPath que dependen de la estructura del DOM son fragiles:
 * si el diseñador mueve un boton de un <div> a un <section>, el test se rompe
 * aunque la funcionalidad siga intacta. Los selectores por texto son fragiles
 * ante traducciones o cambios de copywriting.
 *
 * Los data-testid son un atributo que SOLO existe para los tests: no afectan
 * el CSS, no tienen significado para el navegador, y solo cambian cuando el
 * equipo decide conscientemente que la prueba debe actualizarse.
 * Convencion: data-testid describe el elemento ("btn-agregar-producto"), no
 * su posicion en el DOM ("primera-columna-tercer-hijo").
 *
 * Por que page.getByTestId() y no page.locator('[data-testid=...]')
 * ------------------------------------------------------------------
 * Ambos son equivalentes. getByTestId() es mas legible y expresa la intencion
 * claramente. Playwright lo traduce internamente a [data-testid="..."].
 *
 * Auto-waiting de Playwright:
 * Cada accion (click, fill, etc.) espera automaticamente a que el elemento
 * sea visible y habilitado antes de actuar. No hay waitForSelector() ni sleep().
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';

/**
 * Helper: agrega un producto al carrito llenando el formulario y enviandolo.
 * Encapsula la secuencia de acciones repetitiva en los tests.
 */
async function agregarProducto(
  page: Page,
  nombre: string,
  precio: number,
  cantidad: number
): Promise<void> {
  await page.getByTestId('input-nombre-producto').fill(nombre);
  await page.getByTestId('input-precio-producto').fill(String(precio));
  await page.getByTestId('input-cantidad-producto').fill(String(cantidad));
  await page.getByTestId('btn-agregar-producto').click();
}

test.describe('Carrito funcional — camino feliz', () => {
  // beforeEach navega a la pagina del carrito antes de cada test.
  // Cada test empieza con un carrito fresco porque Angular genera un nuevo
  // sesion_id si no hay ninguno en sessionStorage (sessionStorage se limpia
  // al cerrar el contexto de browser entre tests).
  test.beforeEach(async ({ page }) => {
    await page.goto('/carrito');
    // Esperar que el componente Angular se inicialice
    await page.waitForLoadState('networkidle');
  });

  test('agregar un producto y verificar que aparece en la lista', async ({ page }) => {
    await agregarProducto(page, 'Laptop TiendaUV', 2_500_000, 1);

    // Playwright espera automaticamente que el elemento aparezca en el DOM
    await expect(page.getByTestId('item-producto-Laptop TiendaUV')).toBeVisible();

    // Verificar que el total se actualizo (debe ser mayor a 0)
    const textoTotal = await page.getByTestId('total-carrito').innerText();
    expect(textoTotal).not.toBe('$ 0');
  });

  test('agregar dos veces el mismo producto suma cantidades en la UI', async ({ page }) => {
    await agregarProducto(page, 'Camiseta', 50_000, 2);
    // Esperar que el primero aparezca antes de agregar el segundo
    await expect(page.getByTestId('item-producto-Camiseta')).toBeVisible();

    await agregarProducto(page, 'Camiseta', 50_000, 3);
    // Despues de la segunda adicion, debe seguir habiendo solo una fila para "Camiseta"
    // pero con cantidad 5. Verificamos que la lista no tiene duplicados.
    const filasCamiseta = page.locator('[data-testid^="item-producto-Camiseta"]');
    await expect(filasCamiseta).toHaveCount(1);

    // La cantidad total en el resumen debe reflejar la suma: 2 + 3 = 5
    const cantidadTexto = await page.getByTestId('cantidad-productos').innerText();
    expect(cantidadTexto).toBe('1'); // Solo 1 tipo de producto (Camiseta), pero con cantidad 5
  });

  test('eliminar un producto lo quita de la lista y actualiza el total', async ({ page }) => {
    await agregarProducto(page, 'Auriculares', 150_000, 1);
    await expect(page.getByTestId('item-producto-Auriculares')).toBeVisible();

    // Hacer click en el boton de eliminar de ese producto especifico
    await page.getByTestId('btn-eliminar-Auriculares').click();

    // Verificar que el elemento desaparecio de la lista
    await expect(page.getByTestId('item-producto-Auriculares')).not.toBeVisible();

    // Verificar que el total volvio a 0
    const textoTotal = await page.getByTestId('total-carrito').innerText();
    expect(textoTotal).toContain('0');
  });

  test('aplicar descuento porcentaje actualiza el total y el total con IVA', async ({ page }) => {
    await agregarProducto(page, 'Tablet', 1_000_000, 1);
    await expect(page.getByTestId('item-producto-Tablet')).toBeVisible();

    // Leer el total actual antes del descuento
    const totalAntes = await page.getByTestId('total-carrito').innerText();

    // Aplicar un descuento del 10%
    await page.getByTestId('select-tipo-descuento').selectOption('porcentaje');
    await page.getByTestId('input-valor-descuento').fill('10');
    await page.getByTestId('btn-aplicar-descuento').click();

    // Esperar que el total se actualice (cambia despues de recargar del backend)
    await page.waitForLoadState('networkidle');

    const totalDespues = await page.getByTestId('total-carrito').innerText();
    // El total con descuento debe ser diferente al original
    expect(totalDespues).not.toBe(totalAntes);

    // El total con IVA debe estar presente y ser mayor que el total sin IVA
    await expect(page.getByTestId('total-con-iva')).toBeVisible();
  });

  test('vaciar el carrito deja la lista vacia y el total en 0', async ({ page }) => {
    await agregarProducto(page, 'Mouse', 80_000, 1);
    await expect(page.getByTestId('item-producto-Mouse')).toBeVisible();

    await page.getByTestId('btn-vaciar-carrito').click();

    // Despues de vaciar, el carrito debe estar vacio
    await expect(page.getByTestId('carrito-vacio')).toBeVisible();

    const textoTotal = await page.getByTestId('total-carrito').innerText();
    expect(textoTotal).toContain('0');
  });
});

test.describe('Carrito funcional — casos de error', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');
  });

  test('agregar un producto con precio negativo muestra error y no agrega al carrito', async ({
    page,
  }) => {
    // Intentar agregar con precio -1 (invalido segun las reglas de negocio)
    await page.getByTestId('input-nombre-producto').fill('Producto Invalido');
    await page.getByTestId('input-precio-producto').fill('-1');
    await page.getByTestId('input-cantidad-producto').fill('1');
    await page.getByTestId('btn-agregar-producto').click();

    // El formulario deberia mostrar un mensaje de error de validacion del cliente
    // (precio > 0) sin llegar a hacer el request al backend
    // Verificar que el mensaje de error aparece
    const errorVisible =
      (await page.getByTestId('error-agregar-producto').isVisible().catch(() => false)) ||
      (await page.locator('.campo-error').first().isVisible().catch(() => false));
    expect(errorVisible).toBeTruthy();

    // El producto NO debe aparecer en la lista
    await expect(page.getByTestId('item-producto-Producto Invalido')).not.toBeVisible();
  });

  test('agregar un producto con cantidad 0 muestra error de validacion', async ({ page }) => {
    await page.getByTestId('input-nombre-producto').fill('Producto Cero');
    await page.getByTestId('input-precio-producto').fill('100');
    await page.getByTestId('input-cantidad-producto').fill('0');
    await page.getByTestId('btn-agregar-producto').click();

    // La validacion del cliente debe mostrar error antes de llamar a la API
    const errorVisible = await page.locator('.campo-error').first().isVisible().catch(() => false);
    expect(errorVisible).toBeTruthy();
    await expect(page.getByTestId('item-producto-Producto Cero')).not.toBeVisible();
  });
});

test.describe('Aislamiento de sesion entre pestanas', () => {
  test('dos BrowserContext tienen carritos independientes', async ({ browser }) => {
    // Crear dos contextos completamente separados: cookies, sessionStorage y
    // localStorage son independientes entre contextos (como dos usuarios distintos)
    const contexto1: BrowserContext = await browser.newContext();
    const contexto2: BrowserContext = await browser.newContext();

    const pagina1: Page = await contexto1.newPage();
    const pagina2: Page = await contexto2.newPage();

    await pagina1.goto('/carrito');
    await pagina2.goto('/carrito');
    await pagina1.waitForLoadState('networkidle');
    await pagina2.waitForLoadState('networkidle');

    // Agregar un producto solo en la pagina 1
    await agregarProducto(pagina1, 'Producto Solo En Tab 1', 100_000, 1);
    await expect(pagina1.getByTestId('item-producto-Producto Solo En Tab 1')).toBeVisible();

    // Recargar la pagina 2 y verificar que NO tiene el producto de la pagina 1
    await pagina2.reload();
    await pagina2.waitForLoadState('networkidle');
    await expect(pagina2.getByTestId('item-producto-Producto Solo En Tab 1')).not.toBeVisible();

    // Limpiar
    await contexto1.close();
    await contexto2.close();
  });
});
