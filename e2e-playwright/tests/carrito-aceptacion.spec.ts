/**
 * Tests de aceptacion escritos en lenguaje de negocio (BDD sin Cucumber).
 *
 * Que es BDD (Behavior-Driven Development)
 * -----------------------------------------
 * BDD es una metodologia de desarrollo donde los criterios de aceptacion se
 * expresan en lenguaje natural que todos los stakeholders pueden entender:
 * desarrolladores, testers, product owners y clientes.
 *
 * La estructura "Dado / Cuando / Entonces" (Given / When / Then) viene del
 * formato Gherkin usado con herramientas como Cucumber o pytest-bdd. Cada parte:
 * - Dado: el estado inicial del sistema (precondicion)
 * - Cuando: la accion que realiza el usuario (evento)
 * - Entonces: el resultado esperado observable (postcondicion)
 *
 * Por que estas pruebas no usan Cucumber
 * ----------------------------------------
 * Cucumber parsea archivos .feature con sintaxis Gherkin y vincula cada paso
 * a una funcion de "step definition". Esto agrega una capa de indirection
 * util cuando los Product Owners no-tecnicos escriben los escenarios.
 *
 * En este proyecto, el mismo equipo tecnico escribe y mantiene los tests,
 * por lo que el beneficio de Cucumber (la capa de lenguaje natural separada
 * del codigo) tiene menos valor que el overhead que agrega. En su lugar,
 * usamos nombres de test en formato Given/When/Then dentro de Playwright,
 * que logra legibilidad similar sin la complejidad adicional.
 *
 * Nota: la suite tests/features/ del backend usa pytest-bdd con archivos
 * .feature reales. Comparar ambos enfoques es valioso para el aprendizaje.
 */
import { test, expect, Page } from '@playwright/test';

async function irAlCarrito(page: Page): Promise<void> {
  await page.goto('/carrito');
  await page.waitForLoadState('networkidle');
}

async function agregarProductoAlCarrito(
  page: Page,
  nombre: string,
  precio: number,
  cantidad = 1
): Promise<void> {
  await page.getByTestId('input-nombre-producto').fill(nombre);
  await page.getByTestId('input-precio-producto').fill(String(precio));
  await page.getByTestId('input-cantidad-producto').fill(String(cantidad));
  await page.getByTestId('btn-agregar-producto').click();
  await expect(page.getByTestId(`item-producto-${nombre}`)).toBeVisible();
}

test.describe('Como cliente quiero gestionar mi carrito de compras', () => {
  test.beforeEach(async ({ page }) => {
    await irAlCarrito(page);
  });

  // ─── Escenario 1: Agregar un producto ────────────────────────────────────
  test(
    'Dado que tengo el carrito vacío, cuando agrego un producto, entonces lo veo en mi lista con su precio y cantidad',
    async ({ page }) => {
      // DADO: el carrito esta vacio
      await expect(page.getByTestId('carrito-vacio')).toBeVisible();

      // CUANDO: agrego un producto
      await agregarProductoAlCarrito(page, 'Teclado Mecanico', 350_000, 1);

      // ENTONCES: el producto aparece en la lista con nombre y precio
      const fila = page.getByTestId('item-producto-Teclado Mecanico');
      await expect(fila).toBeVisible();
      await expect(fila).toContainText('Teclado Mecanico');
      await expect(fila).toContainText('350');

      // Y el carrito ya no muestra el mensaje de vacio
      await expect(page.getByTestId('carrito-vacio')).not.toBeVisible();
    }
  );

  // ─── Escenario 2: Descuento porcentual ───────────────────────────────────
  test(
    'Dado que tengo productos en el carrito, cuando aplico un descuento del 20%, entonces el total se reduce correctamente',
    async ({ page }) => {
      // DADO: hay productos en el carrito
      await agregarProductoAlCarrito(page, 'Camara', 1_000_000, 1);

      // Capturar el total antes del descuento
      const totalAntes = await page.getByTestId('total-carrito').innerText();

      // CUANDO: aplico un descuento del 20%
      await page.getByTestId('select-tipo-descuento').selectOption('porcentaje');
      await page.getByTestId('input-valor-descuento').fill('20');
      await page.getByTestId('btn-aplicar-descuento').click();
      await page.waitForLoadState('networkidle');

      // ENTONCES: el total se reduce (no es igual al anterior)
      const totalDespues = await page.getByTestId('total-carrito').innerText();
      expect(totalDespues).not.toBe(totalAntes);

      // Y el mensaje de exito del descuento es visible
      await expect(page.getByTestId('exito-descuento')).toBeVisible();
    }
  );

  // ─── Escenario 3: Eliminar producto ──────────────────────────────────────
  test(
    'Dado que tengo dos productos en el carrito, cuando elimino uno, entonces solo queda el otro en la lista',
    async ({ page }) => {
      // DADO: hay dos productos en el carrito
      await agregarProductoAlCarrito(page, 'Libro Angular', 80_000, 1);
      await agregarProductoAlCarrito(page, 'Libro Python', 75_000, 1);

      await expect(page.getByTestId('cantidad-productos')).toContainText('2');

      // CUANDO: elimino un producto
      await page.getByTestId('btn-eliminar-Libro Angular').click();

      // ENTONCES: el producto eliminado ya no esta en la lista
      await expect(page.getByTestId('item-producto-Libro Angular')).not.toBeVisible();

      // Y el otro producto sigue en la lista
      await expect(page.getByTestId('item-producto-Libro Python')).toBeVisible();

      // Y la cantidad de productos es 1
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('cantidad-productos')).toContainText('1');
    }
  );

  // ─── Escenario 4: Vaciar carrito ─────────────────────────────────────────
  test(
    'Dado que tengo varios productos, cuando vacio el carrito, entonces la lista queda vacía y el total es cero',
    async ({ page }) => {
      // DADO: hay multiples productos en el carrito
      await agregarProductoAlCarrito(page, 'Monitor', 800_000, 1);
      await agregarProductoAlCarrito(page, 'Webcam', 200_000, 2);

      // CUANDO: vacio el carrito
      await page.getByTestId('btn-vaciar-carrito').click();
      await page.waitForLoadState('networkidle');

      // ENTONCES: la lista muestra el mensaje de carrito vacio
      await expect(page.getByTestId('carrito-vacio')).toBeVisible();

      // Y el total es 0
      const textoTotal = await page.getByTestId('total-carrito').innerText();
      expect(textoTotal).toContain('0');

      // Y el total con IVA es 0
      const textoTotalIva = await page.getByTestId('total-con-iva').innerText();
      expect(textoTotalIva).toContain('0');
    }
  );

  // ─── Escenario 5: Total con IVA ──────────────────────────────────────────
  test(
    'Dado que agrego un producto de precio conocido, cuando veo el resumen, entonces el total con IVA es exactamente el 19% mas',
    async ({ page }) => {
      // DADO: agrego un producto con precio exacto
      await agregarProductoAlCarrito(page, 'Silla', 1_000_000, 1);
      await page.waitForLoadState('networkidle');

      // ENTONCES: el total sin IVA es 1.000.000
      const totalSinIva = await page.getByTestId('total-carrito').innerText();
      expect(totalSinIva).toContain('1.000.000');

      // Y el total con IVA es 1.190.000 (1.000.000 * 1.19)
      const totalConIva = await page.getByTestId('total-con-iva').innerText();
      expect(totalConIva).toContain('1.190.000');
    }
  );

  // ─── Escenario 6: Descuento fijo ─────────────────────────────────────────
  test(
    'Dado que tengo un producto en el carrito, cuando aplico un descuento fijo de 50000, entonces el total disminuye exactamente en ese monto',
    async ({ page }) => {
      // DADO: producto de precio 200.000
      await agregarProductoAlCarrito(page, 'Audífonos', 200_000, 1);
      await page.waitForLoadState('networkidle');

      // CUANDO: aplico descuento fijo de 50.000
      await page.getByTestId('select-tipo-descuento').selectOption('fijo');
      await page.getByTestId('input-valor-descuento').fill('50000');
      await page.getByTestId('btn-aplicar-descuento').click();
      await page.waitForLoadState('networkidle');

      // ENTONCES: el total es 150.000 (200.000 - 50.000)
      const totalDespues = await page.getByTestId('total-carrito').innerText();
      expect(totalDespues).toContain('150.000');
    }
  );
});
