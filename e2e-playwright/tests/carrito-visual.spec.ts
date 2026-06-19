/**
 * Tests de smoke visual con capturas de pantalla.
 *
 * Que es una prueba de regresion visual
 * ----------------------------------------
 * Una prueba de regresion visual captura el aspecto de la pagina en un momento
 * dado ("golden screenshot" o "snapshot de referencia") y en ejecuciones
 * posteriores compara el resultado actual con ese snapshot. Si hay diferencias
 * visuales (el color de un boton cambio, un componente se desplazo), el test falla.
 *
 * Por que estos tests NO son regresion visual estricta
 * -----------------------------------------------------
 * La regresion visual estricta es util cuando el equipo tiene un proceso de
 * aprobacion de cambios visuales. En este proyecto educativo, los tests visuales
 * sirven como EVIDENCIA y DOCUMENTACION: capturan como se ve la app en cada
 * ejecucion del pipeline y las imagenes quedan como artefactos del workflow.
 *
 * maxDiffPixelRatio: 0.05 permite hasta un 5% de diferencia entre pixeles.
 * Esto tolera diferencias menores de renderizado entre sistemas operativos y
 * versiones de navegador (anti-aliasing, subpixel rendering).
 *
 * Para regresion visual real, se usaria maxDiffPixelRatio: 0 o incluso
 * herramientas especializadas como Percy o Chromatic (integradas con Storybook).
 *
 * Los archivos .png de referencia se guardan en:
 *   e2e-playwright/tests/carrito-visual.spec.ts-snapshots/
 *
 * La primera vez que se corre, Playwright crea los snapshots de referencia.
 * Las siguientes veces, compara contra ellos.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke visual del carrito', () => {
  test('captura screenshot de la pagina inicial (carrito vacio)', async ({ page }) => {
    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');

    // Esperar que el indicador de carga desaparezca
    await page.getByTestId('loading-indicator').waitFor({ state: 'detached' }).catch(() => {});

    // Captura de pantalla como evidencia
    // maxDiffPixelRatio: 0.05 = tolera hasta 5% de diferencia pixel a pixel
    await expect(page).toHaveScreenshot('carrito-vacio.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('captura screenshot del carrito con productos agregados', async ({ page }) => {
    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');

    // Agregar algunos productos para tener un estado representativo
    await page.getByTestId('input-nombre-producto').fill('Laptop');
    await page.getByTestId('input-precio-producto').fill('2500000');
    await page.getByTestId('input-cantidad-producto').fill('1');
    await page.getByTestId('btn-agregar-producto').click();
    await expect(page.getByTestId('item-producto-Laptop')).toBeVisible();

    await page.getByTestId('input-nombre-producto').fill('Mouse');
    await page.getByTestId('input-precio-producto').fill('80000');
    await page.getByTestId('input-cantidad-producto').fill('2');
    await page.getByTestId('btn-agregar-producto').click();
    await expect(page.getByTestId('item-producto-Mouse')).toBeVisible();

    // Esperar que todos los totales se actualicen
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('carrito-con-productos.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('captura screenshot del carrito con descuento aplicado', async ({ page }) => {
    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');

    // Agregar producto y aplicar descuento
    await page.getByTestId('input-nombre-producto').fill('Tablet');
    await page.getByTestId('input-precio-producto').fill('1000000');
    await page.getByTestId('input-cantidad-producto').fill('1');
    await page.getByTestId('btn-agregar-producto').click();
    await expect(page.getByTestId('item-producto-Tablet')).toBeVisible();

    await page.getByTestId('select-tipo-descuento').selectOption('porcentaje');
    await page.getByTestId('input-valor-descuento').fill('15');
    await page.getByTestId('btn-aplicar-descuento').click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('carrito-con-descuento.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
