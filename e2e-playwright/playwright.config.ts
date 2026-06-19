/**
 * Configuracion de Playwright para la suite E2E de TiendaUV.
 *
 * Por que Playwright como framework principal
 * -------------------------------------------
 * Playwright fue desarrollado por Microsoft (2020) a partir de la experiencia
 * del equipo de Puppeteer. Sus ventajas principales frente a Cypress y Selenium:
 *
 * 1. Auto-waiting: Playwright espera automaticamente que los elementos sean
 *    visibles, habilitados e interactuables antes de actuar. No hay que
 *    escribir waitForSelector() ni sleep() manualmente.
 *
 * 2. Multi-browser nativo: un unico script corre en Chromium, Firefox y WebKit
 *    (Safari). Cypress requiere plugins pagos para Firefox y no soporta WebKit.
 *    Selenium requiere drivers separados para cada navegador.
 *
 * 3. Contextos de navegador aislados: browserContext crea sesiones completamente
 *    aisladas (cookies, sessionStorage, localStorage) sin abrir un navegador
 *    nuevo. Util para testear que dos usuarios no comparten estado.
 *
 * 4. Tracing y screenshots integrados: a diferencia de Selenium, Playwright
 *    captura trazas detalladas del test (acciones, red, snapshots de DOM) que
 *    se pueden explorar en un visor interactivo.
 *
 * Sobre la configuracion:
 * - baseURL: leida de FRONTEND_URL o http://localhost:4200. En CI se setea a
 *   http://localhost:4201 (puerto del frontend-test en docker-compose.test.yml).
 * - retries: en CI reintenta los tests que fallan una vez (flakiness de browser).
 *   Localmente no reintenta para que el feedback sea inmediato.
 * - trace 'on-first-retry': captura la traza completa del test solo cuando
 *   falla y se reintenta. En el primer intento exitoso, no hay overhead.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Snapshots portables entre Windows/Linux/Mac: omitir el OS del nombre del archivo.
  // Por defecto Playwright genera carrito-vacio-chromium-win32.png (solo valido en Windows).
  // Con esta plantilla genera carrito-vacio-chromium.png, usable en CI Linux y en local.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // En CI reintenta una vez: reduce falsos negativos por flakiness de red/browser
  retries: process.env['CI'] ? 2 : 0,
  // En CI el reporter HTML genera artefactos; el reporter github agrega anotaciones al PR
  reporter: process.env['CI']
    ? [['html', { outputFolder: 'playwright-report' }], ['github']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
    // Captura traza del test solo en el primer reintento para debugging
    trace: 'on-first-retry',
    // Captura screenshot solo cuando el test falla
    screenshot: 'only-on-failure',
    // Timeout para acciones individuales (click, fill, etc.)
    actionTimeout: 10_000,
    // Timeout para navegar a una URL
    navigationTimeout: 30_000,
  },
  // Timeout total de cada test
  timeout: 60_000,

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
