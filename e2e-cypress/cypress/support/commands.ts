/**
 * Custom commands de Cypress para el carrito de TiendaUV.
 *
 * Que son los custom commands de Cypress
 * ----------------------------------------
 * Cypress.Commands.add() agrega comandos al objeto 'cy', el objeto global
 * de Cypress. Los custom commands son como funciones de utilidad que
 * encapsulan secuencias de acciones repetitivas.
 *
 * Diferencia con los helpers de Playwright:
 * En Playwright, los helpers son funciones TypeScript normales que reciben
 * el objeto 'page' como parametro:
 *   async function agregarProducto(page: Page, ...) { ... }
 *
 * En Cypress, los custom commands se integran en la cadena de comandos:
 *   cy.agregarProducto('Laptop', 2500000, 1)
 *
 * La ventaja del enfoque de Cypress: el custom command participa en el sistema
 * de retries y assertions de Cypress, y se muestra en el command log del
 * Cypress Test Runner. La desventaja: requiere extender el tipo 'Chainable'
 * en TypeScript para que el autocompletado funcione.
 *
 * Comparacion de sintaxis:
 *
 * Playwright:
 *   await agregarProducto(page, 'Laptop', 2500000, 1);
 *   await expect(page.getByTestId('item-producto-Laptop')).toBeVisible();
 *
 * Cypress:
 *   cy.agregarProducto('Laptop', 2500000, 1);
 *   cy.getByTestId('item-producto-Laptop').should('be.visible');
 *
 * Ambos logran lo mismo; la eleccion es cuestin de preferencia del equipo.
 */

// Extender el namespace de Cypress para que TypeScript reconozca los custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      agregarProducto(nombre: string, precio: number, cantidad: number): Chainable<void>;
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}

/**
 * Encapsula la secuencia de llenar el formulario y hacer click en agregar.
 * Reutilizable en todos los tests que necesiten agregar un producto.
 */
Cypress.Commands.add('agregarProducto', (nombre: string, precio: number, cantidad: number) => {
  cy.getByTestId('input-nombre-producto').clear().type(nombre);
  cy.getByTestId('input-precio-producto').clear().type(String(precio));
  cy.getByTestId('input-cantidad-producto').clear().type(String(cantidad));
  cy.getByTestId('btn-agregar-producto').click();
});

/**
 * Shorthand para seleccionar elementos por data-testid.
 * Equivalente a cy.get('[data-testid="..."]') pero mas legible.
 */
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

export {};
