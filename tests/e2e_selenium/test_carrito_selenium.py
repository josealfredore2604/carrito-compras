"""
Tests E2E con Selenium WebDriver para el carrito de TiendaUV.

Por que este proyecto tiene tests con Selenium
-----------------------------------------------
Selenium (2004, ahora mantenido por la W3C) es el precursor de todos los
frameworks modernos de testing de navegadores. Playwright y Cypress nacieron
como respuesta a las limitaciones de Selenium. Este archivo sirve para mostrar
en clase la evolucion historica y el contraste de experiencia de desarrollo.

DIFERENCIAS FUNDAMENTALES de Selenium vs Playwright/Cypress:

1. ESPERAS EXPLICITAS (la mayor fuente de dolor en Selenium):
   Selenium no tiene auto-waiting. Si haces driver.find_element() y el elemento
   aun no existe en el DOM (porque Angular esta renderizando), lanza
   NoSuchElementException. Debes usar WebDriverWait explicitamente.

   Playwright y Cypress esperan automaticamente a que el elemento sea
   interactuable antes de actuar. En Playwright, page.click('[data-testid=btn]')
   espera hasta 30 segundos por defecto sin codigo adicional.

2. PROTOCOLO:
   Selenium usa el protocolo WebDriver W3C: el test se comunica con un driver
   (chromedriver, geckodriver) que controla el navegador. Esta capa adicional
   agrega latencia y requiere que la version del driver sea compatible con
   la version del navegador instalado.

   webdriver-manager (la libreria que usamos aqui) resuelve la instalacion
   automatica del driver correcto, pero aun asi es mas complejo que Playwright
   que instala sus propios navegadores.

   Playwright usa CDP (Chrome DevTools Protocol) para Chrome y protocolos
   equivalentes para Firefox y WebKit. Es mas directo y rapido.

3. SETUP:
   Selenium: pip install selenium webdriver-manager
   Playwright: pip install playwright && playwright install
   Cypress: npm install cypress

4. VELOCIDAD:
   Selenium: mas lento por el protocolo WebDriver y la falta de auto-waiting
   Playwright: mas rapido gracias a CDP y auto-waiting nativo
   Cypress: comparable a Playwright para tests de UI puros

CUANDO USAR SELENIUM HOY (2024):
- Cuando necesitas soporte para navegadores muy antiguos (IE11, Safari < 12)
- Cuando el proyecto ya tiene una suite grande de tests Selenium y migrar
  seria costoso
- Para testing de aplicaciones de escritorio con extensiones Selenium
- Cuando el equipo tiene expertise profundo en Selenium y la curva de
  aprendizaje de Playwright no se justifica

PARA PROYECTOS NUEVOS: usa Playwright.
"""

import os
import time

import pytest
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait, Select

# URL del frontend: configurable por variable de entorno para CI/CD
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:4200")

# Timeout global para WebDriverWait (en segundos)
# En Playwright este valor existe pero raramente necesitas ajustarlo porque
# el auto-waiting lo maneja. En Selenium, SIEMPRE lo necesitas.
TIMEOUT = 15


def configurar_driver() -> webdriver.Chrome:
    """
    Crea y configura un WebDriver de Chrome en modo headless.

    webdriver-manager descarga automaticamente la version de chromedriver
    compatible con el Chrome instalado. Sin esto, necesitarias descargar
    manualmente el driver y mantener las versiones sincronizadas.

    En Playwright, este paso no existe: playwright install descarga los
    navegadores con sus propios drivers preempaquetados.
    """
    from webdriver_manager.chrome import ChromeDriverManager

    opciones = Options()

    # --headless=new: modo headless moderno de Chrome (no GUI, para CI/CD)
    # En Playwright: playwright.chromium.launch(headless=True) es el default.
    opciones.add_argument("--headless=new")

    # Sin estas opciones, Chrome puede fallar en entornos Docker/CI
    opciones.add_argument("--no-sandbox")
    opciones.add_argument("--disable-dev-shm-usage")
    opciones.add_argument("--disable-gpu")
    opciones.add_argument("--window-size=1280,720")

    # ChromeDriverManager().install() descarga el driver si no esta en cache
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=opciones)


def esperar_elemento(driver: webdriver.Chrome, selector_css: str, timeout: int = TIMEOUT):
    """
    Espera explicita hasta que el elemento sea visible.

    En Playwright, este codigo no existe: page.click('[data-testid=...]')
    ya espera automaticamente. En Selenium, cada interaccion necesita su
    propio wait o corre el riesgo de NoSuchElementException.

    expected_conditions.visibility_of_element_located verifica:
    1. El elemento existe en el DOM (no lanza NoSuchElementException).
    2. El elemento tiene display != none y visibility != hidden.
    3. El elemento tiene dimensiones mayores a 0.

    Si el timeout expira, lanza TimeoutException.
    """
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, selector_css))
    )


def esperar_clickable(driver: webdriver.Chrome, selector_css: str, timeout: int = TIMEOUT):
    """Espera hasta que el elemento sea visible Y habilitado (clickable)."""
    return WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, selector_css))
    )


def sel(test_id: str) -> str:
    """Shorthand para construir un selector CSS de data-testid."""
    return f'[data-testid="{test_id}"]'


class TestCarritoSelenium:
    """
    Tests E2E del carrito usando Selenium WebDriver.

    Por que setup_method y teardown_method en vez de pytest fixtures:
    - setup_method corre antes de CADA metodo de test.
    - teardown_method corre despues de CADA metodo, pase o falle el test.

    En pytest con Selenium, el patron es tener el driver como atributo de la clase
    y abrirlo/cerrarlo en setup/teardown. El fixture equivalente se ve en conftest.py.

    En Playwright con Python (pytest-playwright), los fixtures 'page' y 'browser'
    estan preconfigurados: no necesitas escribir setup/teardown.
    """

    def setup_method(self):
        """Crea un driver nuevo antes de cada test."""
        self.driver = configurar_driver()
        self.wait = WebDriverWait(self.driver, TIMEOUT)

    def teardown_method(self):
        """
        Cierra el navegador despues de cada test, pase o falle.
        En Playwright y Cypress, el ciclo de vida del navegador es manejado
        automaticamente por el framework.
        """
        if hasattr(self, "driver") and self.driver:
            self.driver.quit()

    def navegar_al_carrito(self):
        """Navega a la pagina del carrito y espera que cargue."""
        self.driver.get(f"{FRONTEND_URL}/carrito")
        # Esperar que Angular termine de inicializar (el boton de agregar es un buen indicador)
        esperar_clickable(self.driver, sel("btn-agregar-producto"))

    def agregar_producto(self, nombre: str, precio: float, cantidad: int = 1):
        """
        Helper que llena el formulario y agrega un producto.

        Comparar con Playwright:
          await page.getByTestId('input-nombre-producto').fill(nombre)
          await page.getByTestId('btn-agregar-producto').click()

        En Selenium, necesitamos:
        1. Esperar que el elemento sea interactuable (esperar_clickable)
        2. Limpiar el campo antes de escribir (clear())
        3. Escribir con send_keys()
        4. Hacer click explicitamente

        Todo lo que Playwright hace implicitamente, Selenium requiere codigo explicito.
        """
        input_nombre = esperar_clickable(self.driver, sel("input-nombre-producto"))
        input_nombre.clear()
        input_nombre.send_keys(nombre)

        input_precio = self.driver.find_element(By.CSS_SELECTOR, sel("input-precio-producto"))
        input_precio.clear()
        input_precio.send_keys(str(precio))

        input_cantidad = self.driver.find_element(By.CSS_SELECTOR, sel("input-cantidad-producto"))
        input_cantidad.clear()
        input_cantidad.send_keys(str(cantidad))

        btn = esperar_clickable(self.driver, sel("btn-agregar-producto"))
        btn.click()

        # ESPERA EXPLICITA: esperar que el producto aparezca en la lista.
        # En Playwright: await expect(page.getByTestId('item-producto-...')).toBeVisible()
        # hace esto internamente. En Selenium, necesitamos el WebDriverWait.
        self.wait.until(
            EC.visibility_of_element_located(
                (By.CSS_SELECTOR, f'[data-testid="item-producto-{nombre}"]')
            )
        )

    def test_agregar_producto_aparece_en_lista(self):
        """Test 1: agregar un producto y verificar que aparece en la lista."""
        self.navegar_al_carrito()

        self.agregar_producto("Laptop Selenium", 2_500_000, 1)

        # Verificar que el producto esta en la lista
        fila = self.driver.find_element(By.CSS_SELECTOR, sel("item-producto-Laptop Selenium"))
        assert fila.is_displayed(), "El producto deberia ser visible en la lista"
        assert "Laptop Selenium" in fila.text, "El nombre del producto debe aparecer en la fila"

    def test_aplicar_descuento_actualiza_total(self):
        """
        Test 2: aplicar un descuento y verificar que el total cambia.

        Nota: En Selenium, leer el texto de un elemento requiere .text.
        En Playwright: await element.innerText() o await element.textContent()
        """
        self.navegar_al_carrito()

        self.agregar_producto("Camara Selenium", 1_000_000, 1)

        # Leer el total antes del descuento
        total_element = esperar_elemento(self.driver, sel("total-carrito"))
        total_antes = total_element.text

        # Seleccionar tipo de descuento y valor
        # In Selenium, para <select> se usa la clase Select
        select_tipo = Select(self.driver.find_element(By.CSS_SELECTOR, sel("select-tipo-descuento")))
        select_tipo.select_by_value("porcentaje")

        input_valor = self.driver.find_element(By.CSS_SELECTOR, sel("input-valor-descuento"))
        input_valor.clear()
        input_valor.send_keys("10")

        btn_descuento = esperar_clickable(self.driver, sel("btn-aplicar-descuento"))
        btn_descuento.click()

        # Esperar que el total cambie (espera explicita necesaria en Selenium)
        try:
            self.wait.until(
                lambda d: d.find_element(
                    By.CSS_SELECTOR, sel("total-carrito")
                ).text != total_antes
            )
        except TimeoutException:
            pytest.fail("El total no cambio despues de aplicar el descuento")

        total_despues = self.driver.find_element(By.CSS_SELECTOR, sel("total-carrito")).text
        assert total_despues != total_antes, "El total deberia cambiar tras aplicar el descuento"

    def test_vaciar_carrito_deja_lista_vacia(self):
        """
        Test 3: vaciar el carrito y verificar que queda vacio.

        En Playwright: await expect(page.getByTestId('carrito-vacio')).toBeVisible()
        reintenta automaticamente hasta que el elemento aparece o el timeout expira.

        En Selenium: necesitamos WebDriverWait.until(EC.visibility_of_element_located(...))
        para el mismo efecto.
        """
        self.navegar_al_carrito()

        self.agregar_producto("Producto Vaciar", 50_000, 1)

        # Hacer click en vaciar
        btn_vaciar = esperar_clickable(self.driver, sel("btn-vaciar-carrito"))
        btn_vaciar.click()

        # Esperar que el mensaje de carrito vacio aparezca
        try:
            mensaje_vacio = esperar_elemento(self.driver, sel("carrito-vacio"))
            assert mensaje_vacio.is_displayed(), "El mensaje de carrito vacio debe ser visible"
        except TimeoutException:
            pytest.fail("El mensaje de carrito vacio no aparecio despues de vaciar")

        # Verificar que el total es 0
        total = self.driver.find_element(By.CSS_SELECTOR, sel("total-carrito")).text
        assert "0" in total, f"El total deberia ser 0 despues de vaciar, fue: {total}"
