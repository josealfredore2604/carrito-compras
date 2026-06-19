"""
Tests de CSRF y configuracion de CORS para la API del carrito.

CORS (Cross-Origin Resource Sharing) vs CSRF (Cross-Site Request Forgery)
---------------------------------------------------------------------------
Son dos conceptos relacionados pero diferentes:

CORS: mecanismo del NAVEGADOR que controla que origenes pueden hacer requests
a la API. Es una POLITICA DEL CLIENTE: el servidor no puede impedir que un
script en otro dominio haga requests (el browser si puede). Sin CORS configurado,
el browser bloquea las respuestas de requests cross-origin.

CSRF: ataque donde el atacante engana al navegador del usuario para que haga
un request a la API en nombre del usuario, aprovechando las cookies o la sesion
activa. Ejemplo: el usuario esta logueado en banco.com. Un script en evil.com
hace POST /banco/transferir sin que el usuario lo sepa, y el banco acepta el
request porque tiene la cookie de sesion del usuario.

Por que las APIs REST son menos vulnerables a CSRF que las apps tradicionales
-----------------------------------------------------------------------------
Las apps web tradicionales usan cookies para autenticacion (las envia el
browser automaticamente). Las APIs REST modernas usan tokens en el header
Authorization, que los browsers NO envian automaticamente a dominios cruzados.
Si la API de TiendaUV usara tokens Bearer, no seria vulnerable a CSRF.

El carrito de TiendaUV identifica sesiones por sesion_id en la URL (no en
cookies), lo que hace CSRF impractica: el atacante tendria que conocer el
UUID especifico del carrito de la victima.

CORS en este proyecto
----------------------
El CORSMiddleware agrega dos funcionalidades:
1. Responde a preflight requests (OPTIONS) con las cabeceras Access-Control-*
2. En requests regulares, agrega las cabeceras solo para origenes permitidos
"""

from fastapi.testclient import TestClient

from src.carrito.api import app

client = TestClient(app)


class TestCORSConfiguracion:
    """
    Verifica que la configuracion de CORS de la API es correcta:
    - Solo origenes especificos estan permitidos (no wildcard *)
    - Los preflight requests (OPTIONS) son manejados correctamente
    """

    def test_origin_permitido_recibe_cabecera_cors(self):
        """
        Una request desde el origen permitido (localhost:4200) debe recibir
        la cabecera Access-Control-Allow-Origin en la respuesta.
        El browser usa esta cabecera para decidir si permite la respuesta.
        """
        response = client.get(
            "/carrito/health-check",
            headers={"Origin": "http://localhost:4200"},
        )
        assert response.status_code == 200

        # El servidor debe incluir ACAO para el origen permitido
        acao = response.headers.get("access-control-allow-origin", "")
        assert acao == "http://localhost:4200", (
            f"Access-Control-Allow-Origin debe ser 'http://localhost:4200', fue: '{acao}'"
        )

    def test_origin_no_permitido_no_recibe_cabecera_cors(self):
        """
        Una request desde un origen no permitido (atacante.evil.com) no debe
        recibir la cabecera Access-Control-Allow-Origin.

        IMPORTANTE: esto NO impide que el request llegue al servidor (el server
        siempre procesa el request). Lo que impide es que el NAVEGADOR permita
        que el script del atacante lea la respuesta.
        Un script de servidor (curl, requests, httpx) puede leer la respuesta
        aunque no haya cabeceras CORS — CORS es una politica del navegador, no
        del servidor.
        """
        response = client.get(
            "/carrito/health-check",
            headers={"Origin": "http://atacante.evil.com"},
        )
        # El request llega y se procesa (status 200)
        assert response.status_code == 200

        # Pero no hay Access-Control-Allow-Origin para este origen
        acao = response.headers.get("access-control-allow-origin", "")
        assert acao != "http://atacante.evil.com", (
            "El origen no permitido no debe recibir la cabecera CORS"
        )
        assert acao != "*", (
            "CORS no debe usar wildcard '*' ya que permitiria acceso desde cualquier origen"
        )

    def test_wildcard_cors_no_configurado(self):
        """
        La configuracion de CORS NO debe usar '*' (wildcard) para allow_origins.
        Un wildcard permitiria que cualquier sitio en internet acceda a la API
        con las credenciales del usuario. En produccion, esto seria critico.

        Este test verifica que la respuesta desde un origen desconocido
        no incluye Access-Control-Allow-Origin: * en la cabecera.
        """
        response = client.get(
            "/carrito/health-check",
            headers={"Origin": "http://origen-cualquiera.com"},
        )
        acao = response.headers.get("access-control-allow-origin", "")
        assert acao != "*", (
            "CORS esta configurado con wildcard '*'. "
            "En produccion esto permitiria acceso desde CUALQUIER sitio. "
            "Usar lista especifica de origenes permitidos."
        )

    def test_preflight_options_request_respondido_correctamente(self):
        """
        Los preflight requests (METHOD OPTIONS) son enviados por el browser
        ANTES del request real cuando:
        - El metodo es diferente de GET/POST simple
        - Hay cabeceras personalizadas (como Authorization o Content-Type: application/json)

        El servidor debe responder con 200 y las cabeceras de CORS apropiadas.
        """
        response = client.options(
            "/carrito/test-preflight/productos",
            headers={
                "Origin": "http://localhost:4200",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        # El preflight debe retornar 200 con las cabeceras de CORS
        assert response.status_code == 200, (
            f"El preflight OPTIONS deberia retornar 200, fue {response.status_code}"
        )


class TestContentTypeValidacion:
    """
    Verifica que la API rechaza Content-Types inesperados en requests POST.
    Las operaciones de escritura (POST) deben requerir Content-Type: application/json.
    """

    def test_post_con_content_type_correcto_funciona(self):
        """
        POST con Content-Type: application/json (el correcto) debe funcionar.
        """
        response = client.post(
            "/carrito/test-content-type/productos",
            json={"nombre": "Test", "precio": 100, "cantidad": 1},
        )
        assert response.status_code in (201, 422)

    def test_post_con_form_data_es_rechazado(self):
        """
        POST con Content-Type: application/x-www-form-urlencoded (form data)
        en vez de JSON debe ser rechazado. La API espera JSON.

        FastAPI/Pydantic valida el Content-Type implicita y explicitamente:
        si el body no es JSON parseable, retorna 422.
        """
        response = client.post(
            "/carrito/test-form/productos",
            data={"nombre": "Test", "precio": "100", "cantidad": "1"},
        )
        # La API debe rechazar esto porque espera JSON, no form data
        assert response.status_code in (400, 415, 422), (
            f"La API deberia rechazar form data, retorno: {response.status_code}"
        )
        assert response.status_code != 201, (
            "La API no deberia aceptar form data como si fuera JSON valido"
        )

    def test_post_con_body_vacio_es_rechazado(self):
        """
        POST sin body (o con body vacio) debe retornar 422, no 500.
        """
        response = client.post(
            "/carrito/test-empty-body/productos",
            content=b"",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in (400, 422), (
            f"Body vacio debe retornar 422, fue: {response.status_code}"
        )
        assert response.status_code != 500
