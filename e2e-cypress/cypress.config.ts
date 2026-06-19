/**
 * Configuracion de Cypress para la suite comparativa de TiendaUV.
 *
 * Por que este proyecto tiene TANTO Playwright como Cypress
 * -----------------------------------------------------------
 * Ambas herramientas son lideres del mercado en 2024 y tienen comunidades
 * activas. El objetivo didactico de tener ambas es poder comparar:
 *
 * ARQUITECTURA:
 * - Cypress: corre DENTRO del navegador. El codigo del test tiene acceso
 *   directo al DOM y a los eventos del navegador. Esto lo hace rapido para
 *   tests de UI puros pero limita el acceso a APIs de bajo nivel.
 * - Playwright: corre FUERA del navegador y se comunica via CDP (Chrome
 *   DevTools Protocol) o el equivalente para Firefox/WebKit. Mas flexible
 *   para operaciones de red, multiples contextos, y testing mobile.
 *
 * MULTI-BROWSER:
 * - Cypress: Chromium (nativo), Firefox (en la version open source), WebKit
 *   solo en la version de pago (Cypress Cloud). Safari real no soportado.
 * - Playwright: Chromium, Firefox y WebKit (el motor de Safari) todos de
 *   forma nativa y gratuita.
 *
 * ACCESO A LA RED:
 * - Cypress: puede interceptar requests (cy.intercept()) pero con limitaciones
 *   (no puede interceptar fetches a terceros en algunos casos).
 * - Playwright: control total sobre la red via route interception y HAR recording.
 *
 * CUANDO USAR CUAL:
 * - Cypress: cuando el equipo prefiere la experiencia de debugging visual con
 *   el Cypress Test Runner y la sintaxis chainable es natural para el equipo.
 * - Playwright: cuando se necesita cross-browser real (incluyendo Safari/WebKit),
 *   acceso a multiples contextos de navegador, o una suite de CI con soporte
 *   oficial de Microsoft.
 */
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // baseUrl configurable por variable de entorno CYPRESS_BASE_URL.
    // En CI, se setea a http://localhost:4201 (docker-compose.test.yml).
    // Localmente, se puede sobreescribir con: CYPRESS_BASE_URL=http://localhost:4200 npm run cy:run
    baseUrl: process.env['CYPRESS_BASE_URL'] ?? 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    // Carpeta donde Cypress guarda los screenshots cuando falla un test
    screenshotsFolder: 'cypress/screenshots',
    // Carpeta donde Cypress guarda los videos de cada test run
    videosFolder: 'cypress/videos',
    // Tiempo de espera por defecto para que los elementos aparezcan
    defaultCommandTimeout: 10_000,
    // Tiempo de espera para las peticiones de red
    requestTimeout: 15_000,
  },
});
