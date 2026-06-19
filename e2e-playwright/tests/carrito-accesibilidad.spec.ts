/**
 * Tests de accesibilidad con axe-core y Playwright.
 *
 * Que es axe-core
 * -----------------
 * axe-core es el motor de analisis de accesibilidad mas usado en la industria.
 * Desarrollado por Deque Systems, puede detectar automaticamente el ~30-40%
 * de los problemas de accesibilidad de una pagina. El 60-70% restante requiere
 * pruebas manuales con usuarios reales con discapacidades.
 *
 * WCAG (Web Content Accessibility Guidelines)
 * --------------------------------------------
 * WCAG define tres niveles de conformidad:
 * - Nivel A: requisitos basicos (sin los cuales la pagina es inutilizable)
 * - Nivel AA: requisitos estandar (requeridos por ley en muchos paises)
 * - Nivel AAA: requisitos avanzados (aspiracional)
 *
 * Estos tests verifican nivel AA, que es el estandar comun en aplicaciones
 * web comerciales y academicas.
 *
 * Que categorias de violaciones detecta axe-core:
 * - critical: bloquea completamente el acceso a usuarios con discapacidades
 * - serious: causa grandes dificultades de acceso
 * - moderate: causa algunas dificultades
 * - minor: problemas menores de experiencia
 *
 * Estos tests fallan si hay violaciones "critical" o "serious".
 * Las violaciones "moderate" y "minor" se reportan como advertencias en los logs
 * pero no fallan el test (para que el pipeline no se bloquee por detalles menores
 * mientras se trabaja en mejorar progresivamente la accesibilidad).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accesibilidad de la pagina del carrito', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/carrito');
    await page.waitForLoadState('networkidle');
  });

  test('la pagina principal no tiene violaciones criticas ni serias', async ({ page }) => {
    // AxeBuilder analiza el DOM actual e identifica violaciones de WCAG.
    // withTags(['wcag2a', 'wcag2aa']) limita el analisis a los criterios de nivel A y AA.
    // disableRules excluye reglas que generan falsos positivos en SPAs o que
    // son responsabilidad de la capa de hosting (como region landmarks en algunas SPAs).
    const resultados = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Filtrar solo violaciones criticas y serias (las que realmente bloquean el acceso)
    const violacionesCriticasYSerias = resultados.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    // Si hay violaciones, mostrar detalles en el mensaje de error del test
    if (violacionesCriticasYSerias.length > 0) {
      const detalles = violacionesCriticasYSerias
        .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} elemento/s)`)
        .join('\n');
      expect(violacionesCriticasYSerias.length, `Violaciones de accesibilidad encontradas:\n${detalles}`).toBe(0);
    }

    // Reportar advertencias (moderate/minor) en el log pero no fallar el test
    const advertencias = resultados.violations.filter(
      (v) => v.impact === 'moderate' || v.impact === 'minor'
    );
    if (advertencias.length > 0) {
      console.warn(`⚠️ Advertencias de accesibilidad (no bloquean el test):`);
      advertencias.forEach((v) => {
        console.warn(`  [${v.impact}] ${v.id}: ${v.description}`);
      });
    }
  });

  test('todos los inputs del formulario de agregar tienen label asociado', async ({ page }) => {
    // Verificar que cada input tiene un label con for="<id>" correspondiente.
    // Los inputs sin label son inaccesibles para lectores de pantalla.

    const inputs = [
      { id: 'nombre-producto', label: 'Nombre del producto' },
      { id: 'precio-producto', label: 'Precio' },
      { id: 'cantidad-producto', label: 'Cantidad' },
    ];

    for (const { id, label } of inputs) {
      // Verificar que el input con ese id existe
      await expect(page.locator(`#${id}`)).toBeVisible();

      // Verificar que hay un label cuyo for apunta a ese id
      const labelElement = page.locator(`label[for="${id}"]`);
      await expect(labelElement).toBeVisible();

      // Verificar que el texto del label es descriptivo (contiene las palabras clave)
      const textoLabel = await labelElement.innerText();
      expect(textoLabel.toLowerCase()).toContain(label.split(' ')[0].toLowerCase());
    }
  });

  test('la navegacion completa del flujo de agregar es posible solo con teclado', async ({
    page,
  }) => {
    // Tab order: los elementos interactivos deben ser alcanzables en orden logico
    // solo usando la tecla Tab, sin necesidad de mouse.

    // Enfocar el primer campo presionando Tab
    await page.keyboard.press('Tab');

    // El primer campo de formulario deberia tener el foco
    // Verificar que algun input del formulario tiene foco
    const elementoEnfocado = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));

    // Tab hasta el campo de nombre (puede requerir varios Tabs dependiendo de la estructura)
    // Buscar el input de nombre y verificar que es alcanzable
    let intentos = 0;
    while (intentos < 10) {
      const focusTestId = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid')
      );
      if (focusTestId === 'input-nombre-producto') break;
      await page.keyboard.press('Tab');
      intentos++;
    }

    // Llenar el campo con teclado
    await page.keyboard.type('Teclado Test');

    // Verificar que el valor fue ingresado
    const valor = await page.getByTestId('input-nombre-producto').inputValue();
    expect(valor).toBe('Teclado Test');

    // Continuar con Tab al siguiente campo
    await page.keyboard.press('Tab');
    await page.keyboard.type('99000');

    // Tab al campo de cantidad
    await page.keyboard.press('Tab');
    await page.keyboard.type('1');

    // Tab hasta el boton de submit y activarlo con Enter
    let intentosBtn = 0;
    while (intentosBtn < 5) {
      const focusTestId = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid')
      );
      if (focusTestId === 'btn-agregar-producto') break;
      await page.keyboard.press('Tab');
      intentosBtn++;
    }

    await page.keyboard.press('Enter');

    // Si el producto se agrego, aparecera en la lista
    await expect(page.getByTestId('item-producto-Teclado Test')).toBeVisible({ timeout: 10_000 });
  });
});
