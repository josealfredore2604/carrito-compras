/**
 * Suite E2E comparativa con Cypress para el carrito de TiendaUV.
 *
 * Esta suite cubre los MISMOS 4 escenarios principales de Playwright, pero con
 * la sintaxis de Cypress. El objetivo es que en clase se puedan comparar ambas
 * herramientas lado a lado:
 *
 * DIFERENCIAS CLAVE DE SINTAXIS:
 *
 * 1. Asincronia:
 *    Playwright: await page.click('...')  (async/await explícito)
 *    Cypress:    cy.click('...')           (chainable, la async es implicita)
 *
 *    En Cypress, los comandos se encolan y ejecutan en orden, pero el codigo
 *    en si no es async/await. Esto puede confundir a principiantes: si
 *    intentas:
 *      const texto = cy.get('[data-testid=total]').text() // NO funciona
 *    En su lugar debes usar:
 *      cy.get('[data-testid=total]').invoke('text').then(texto => { ... })
 *
 * 2. Assertions:
 *    Playwright: await expect(locator).toBeVisible()
 *    Cypress:    cy.get(selector).should('be.visible')
 *
 *    Cypress usa la libreria Chai para assertions, con la sintaxis 'be.visible',
 *    'have.text', 'not.exist', etc. Playwright usa su propia API de assertions.
 *
 * 3. Selectores:
 *    Playwright: page.getByTestId('btn')  (metodo dedicado)
 *    Cypress:    cy.getByTestId('btn')    (custom command que definimos en commands.ts)
 *
 *    Playwright tiene metodos semanticos (getByRole, getByLabel, getByText).
 *    Cypress usa cy.get() con selectores CSS; los custom commands compensan.
 *
 * 4. Setup de estado:
 *    Playwright: beforeEach navega via page.goto()
 *    Cypress:    beforeEach con cy.visit() (equivalente)
 */
describe('Carrito de compras — Suite Cypress', () => {
  beforeEach(() => {
    // cy.visit() navega a la URL relativa a la baseUrl configurada.
    // Cypress espera automaticamente que la pagina cargue antes de continuar.
    cy.visit('/carrito');
    // Esperar que Angular termine de inicializarse (la carga inicial puede tardar)
    // cy.waitForAngular() no existe en vanilla Cypress; usamos un selector estable.
    cy.getByTestId('btn-agregar-producto').should('be.visible');
  });

  // ─── Test 1: Agregar un producto ─────────────────────────────────────────
  it('debería agregar un producto y mostrarlo en la lista', () => {
    // cy.agregarProducto es nuestro custom command definido en commands.ts
    cy.agregarProducto('Laptop Cypress', 2_500_000, 1);

    // Assertion: el producto debe aparecer en la lista despues de agregarlo.
    // Cypress reintenta automaticamente hasta que la condicion sea verdadera
    // o hasta que expire el defaultCommandTimeout (10s configurado).
    cy.getByTestId('item-producto-Laptop Cypress').should('be.visible');

    // El total debe ser mayor a 0 (no verificamos el valor exacto porque
    // puede variar con el formato de moneda)
    cy.getByTestId('total-carrito').should('not.contain', '$ 0');
  });

  // ─── Test 2: Precio inválido muestra error ────────────────────────────────
  it('debería mostrar error al agregar un producto con precio negativo', () => {
    // Intentar agregar con precio invalido
    cy.getByTestId('input-nombre-producto').type('Producto Invalido');
    cy.getByTestId('input-precio-producto').type('-100');
    cy.getByTestId('input-cantidad-producto').type('1');
    cy.getByTestId('btn-agregar-producto').click();

    // El mensaje de error del campo debe aparecer (validacion del cliente)
    // o el mensaje de error del backend
    cy.get('.campo-error, [data-testid="error-agregar-producto"]').should('be.visible');

    // El producto NO debe aparecer en la lista
    cy.getByTestId('lista-productos').within(() => {
      cy.contains('Producto Invalido').should('not.exist');
    });
  });

  // ─── Test 3: Aplicar descuento actualiza el total ─────────────────────────
  it('debería actualizar el total al aplicar un descuento porcentual', () => {
    // Agregar un producto para tener algo que descontar
    cy.agregarProducto('Monitor 4K', 1_500_000, 1);
    cy.getByTestId('item-producto-Monitor 4K').should('be.visible');

    // Capturar el total antes del descuento
    cy.getByTestId('total-carrito').invoke('text').then((totalAntes) => {
      // Aplicar descuento del 25%
      cy.getByTestId('select-tipo-descuento').select('porcentaje');
      cy.getByTestId('input-valor-descuento').clear().type('25');
      cy.getByTestId('btn-aplicar-descuento').click();

      // Esperar que el total cambie comparando con el valor anterior
      // Cypress reintenta la assertion hasta que cambie o expire el timeout
      cy.getByTestId('total-carrito').invoke('text').should('not.equal', totalAntes);
    });
  });

  // ─── Test 4: Vaciar el carrito ────────────────────────────────────────────
  it('debería dejar la lista vacía al vaciar el carrito', () => {
    // Agregar un par de productos
    cy.agregarProducto('Teclado', 150_000, 1);
    cy.agregarProducto('Mouse Inalambrico', 120_000, 2);

    cy.getByTestId('item-producto-Teclado').should('be.visible');
    cy.getByTestId('item-producto-Mouse Inalambrico').should('be.visible');

    // Vaciar el carrito
    cy.getByTestId('btn-vaciar-carrito').click();

    // Verificar que el mensaje de carrito vacio aparece
    cy.getByTestId('carrito-vacio').should('be.visible');

    // Y que los productos ya no estan
    cy.getByTestId('lista-productos').within(() => {
      cy.contains('Teclado').should('not.exist');
    });

    // El total debe ser 0
    cy.getByTestId('total-carrito').invoke('text').should('include', '0');
  });
});
