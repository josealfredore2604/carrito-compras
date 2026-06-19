"""
Tests de rate limiting y resistencia a ataques DoS para la API del carrito.

OWASP API4 — Unrestricted Resource Consumption
------------------------------------------------
Esta categoria cubre ataques donde el atacante consume recursos del servidor
de forma excesiva: CPU, memoria, conexiones de BD, I/O de disco.

Tipos de ataques cubiertos aqui:
1. Volumen de requests: 200 requests en rafaga (ampliado del original de 100)
2. Payloads gigantes: JSON con arrays de 50.000 elementos
3. Strings extremadamente largos en campos de texto

Por que estos tests NO reemplazan a Locust
-------------------------------------------
Los tests de Locust (tests/performance/) miden RENDIMIENTO: latencia, throughput,
y comportamiento bajo carga concurrente real con multiples usuarios simultaneos.

Estos tests de seguridad miden ROBUSTEZ: que el servidor no colapse ni genere
errores 500 ante condiciones adversas. Son complementarios:

- Locust: 50 usuarios, 30 segundos, mide P95 latency y error rate
- Estos tests: 1 cliente, rafagas, verifica que nunca hay 500

Limitaciones de rate limiting en la API actual
-----------------------------------------------
La API actual NO implementa rate limiting (no hay limite de requests por IP
o por sesion). En produccion, el rate limiting se implementa a nivel de:
1. Reverse proxy (nginx con limit_req_zone)
2. API Gateway (Kong, AWS API Gateway)
3. Middleware de la aplicacion (slowapi para FastAPI)

Estos tests verifican que la ausencia de rate limiting no causa inestabilidad:
el servidor debe sobrevivir la rafaga sin errores 500, aunque tarde mas de lo
normal en responder.
"""

import time

import pytest
from fastapi.testclient import TestClient

from src.carrito.api import app

client = TestClient(app)


class TestRafagaDeSolicitudes:
    """
    OWASP API4: Unrestricted Resource Consumption.
    Ampliacion del test original de 100 requests a 200 con medicion de tiempo.
    """

    def test_200_solicitudes_rapidas_no_causan_error_500(self):
        """
        200 solicitudes secuenciales no deben generar ningun error 500.
        Ampliacion del test original de 100 solicitudes.

        Si el servidor tuviera un leak de conexiones de BD, un bug en el manejo
        de sesiones, o un recurso que no se libera, podria aparecer aqui como
        errores 500 en las ultimas iteraciones cuando el recurso se agota.

        Nota: estas solicitudes son SECUENCIALES (una a la vez). Para carga
        CONCURRENTE real, los tests de Locust son la herramienta correcta.
        """
        errores_500 = 0
        tiempos = []

        inicio_total = time.time()

        for i in range(200):
            inicio_request = time.time()
            response = client.post(
                f"/carrito/rate-test-200-{i}/productos",
                json={"nombre": f"Producto{i}", "precio": 10_000, "cantidad": 1},
            )
            fin_request = time.time()
            tiempos.append(fin_request - inicio_request)

            if response.status_code == 500:
                errores_500 += 1

        fin_total = time.time()
        tiempo_total = fin_total - inicio_total

        # Calcular estadisticas
        tiempo_promedio = sum(tiempos) / len(tiempos)
        tiempo_p95 = sorted(tiempos)[int(len(tiempos) * 0.95)]

        print(f"\n📊 Estadisticas de 200 requests:")
        print(f"   Tiempo total: {tiempo_total:.2f}s")
        print(f"   Promedio por request: {tiempo_promedio * 1000:.1f}ms")
        print(f"   P95: {tiempo_p95 * 1000:.1f}ms")
        print(f"   Errores 500: {errores_500}")

        assert errores_500 == 0, (
            f"El servidor tuvo {errores_500} errores 500 en 200 requests. "
            "Posible leak de recursos (conexiones de BD, memoria, file descriptors)."
        )

    def test_rafaga_de_lecturas_no_causa_error_500(self):
        """
        200 solicitudes de lectura (GET) no deben causar errores.
        Las lecturas son mas ligeras que las escrituras, pero pueden agotar
        el pool de conexiones de BD si no se liberan correctamente.
        """
        errores_500 = 0

        for i in range(200):
            response = client.get(f"/carrito/rafaga-lectura-{i}")
            if response.status_code == 500:
                errores_500 += 1

        assert errores_500 == 0, (
            f"{errores_500} errores 500 en 200 GETs. Problema en el pool de conexiones."
        )

    def test_solicitudes_mixtas_no_causan_error_500(self):
        """
        Mezcla de GET, POST y DELETE no debe causar errores.
        Verifica que las transacciones de BD no se mezclan entre requests.
        """
        errores_500 = 0
        sesion = "test-mixto-rfaga"

        for i in range(50):
            # POST
            r1 = client.post(
                f"/carrito/{sesion}-{i}/productos",
                json={"nombre": f"Mix{i}", "precio": 1000, "cantidad": 1},
            )
            # GET
            r2 = client.get(f"/carrito/{sesion}-{i}")
            # DELETE
            r3 = client.delete(f"/carrito/{sesion}-{i}")

            for r in [r1, r2, r3]:
                if r.status_code == 500:
                    errores_500 += 1

        assert errores_500 == 0, (
            f"{errores_500} errores 500 en requests mixtos. "
            "Posible problema de transacciones o estado compartido."
        )


class TestPayloadsGigantes:
    """
    Verifica que payloads extremadamente grandes no colapsan el servidor.
    """

    def test_array_de_50000_elementos_en_body_no_causa_500(self):
        """
        Un JSON con un array de 50.000 elementos en el nombre del producto
        no debe causar error 500 ni agotar la memoria del servidor.

        Este tipo de ataque (Algorithmic Complexity Attack) funciona cuando
        el servidor hace operaciones O(n) o O(n^2) sobre el input. En este
        caso, el nombre del producto se valida como string: un array no es
        un string valido y debe retornar 422.
        """
        array_enorme = list(range(50_000))

        response = client.post(
            "/carrito/test-payload-gigante/productos",
            json={"nombre": array_enorme, "precio": 100, "cantidad": 1},
        )
        # El tipo incorrecto (array en vez de string) debe retornar 422, no 500
        assert response.status_code != 500, (
            "Un nombre de tipo array causo error 500. "
            "Pydantic debe rechazar el tipo incorrecto con 422."
        )
        assert response.status_code == 422, (
            f"Array en campo string debe retornar 422, fue: {response.status_code}"
        )

    def test_string_de_1_millon_de_caracteres(self):
        """
        Un string de 1.000.000 de caracteres en el nombre del producto.
        El servidor debe manejarlo sin colapsar: aceptarlo (201) o rechazarlo (422).
        """
        nombre_enorme = "A" * 1_000_000

        response = client.post(
            "/carrito/test-string-gigante/productos",
            json={"nombre": nombre_enorme, "precio": 100, "cantidad": 1},
        )
        assert response.status_code in (201, 422), (
            f"String de 1M chars causo respuesta inesperada: {response.status_code}"
        )
        assert response.status_code != 500

    def test_json_profundamente_anidado(self):
        """
        Un JSON con estructuras profundamente anidadas puede agotar el stack
        de llamadas del parser JSON. El servidor debe rechazarlo graciosamente.
        """
        # Construir un objeto JSON con 100 niveles de anidamiento
        objeto_anidado: dict = {}
        nivel_actual = objeto_anidado
        for _ in range(100):
            nivel_actual["hijo"] = {}
            nivel_actual = nivel_actual["hijo"]  # type: ignore
        nivel_actual["hoja"] = "valor"

        response = client.post(
            "/carrito/test-json-anidado/productos",
            json={
                "nombre": "Test anidado",
                "precio": objeto_anidado,  # tipo incorrecto, debe dar 422
                "cantidad": 1,
            },
        )
        assert response.status_code != 500
        assert response.status_code in (201, 422)

    def test_objeto_json_con_muchas_claves(self):
        """
        Un JSON con 10.000 claves no declaradas en el modelo (mass assignment
        ampliado). Pydantic v2 debe ignorarlas todas eficientemente.
        """
        payload: dict = {
            "nombre": "Test muchas claves",
            "precio": 100,
            "cantidad": 1,
        }
        # Agregar 10.000 claves extra que Pydantic debe ignorar
        for i in range(10_000):
            payload[f"campo_extra_{i}"] = f"valor_{i}"

        response = client.post(
            "/carrito/test-muchas-claves/productos",
            json=payload,
        )
        # Pydantic v2 ignora campos extra por defecto (no falla con 10.000 claves extra)
        assert response.status_code in (201, 422), (
            f"10.000 campos extra causaron respuesta inesperada: {response.status_code}"
        )
        assert response.status_code != 500

    def test_descuento_con_valor_extremadamente_grande(self):
        """
        Un descuento con valor extremadamente grande puede causar errores aritmeticos.

        Nota: 9e308 supera el rango de float64 (~1.8e308) y se convierte en inf,
        que no es JSON-serializable (ValueError del encoder Python). Por eso usamos
        1e300, que es un float64 valido pero extremadamente grande, para verificar
        que el backend lo maneja sin colapsar.
        """
        # 1e300 es representable como float64 (dentro del rango, aprox. 10^300)
        # pero tan grande que cualquier descuento "fijo" de ese valor vaciaria
        # cualquier carrito a 0. El servidor debe aceptarlo (422 por validacion
        # de negocio) o aceptarlo con el total resultante en 0.
        response = client.post(
            "/carrito/test-descuento-extremo/descuento",
            json={"tipo": "fijo", "valor": 1e300},
        )
        # Puede retornar 200 (acepta) o 422 (validacion), nunca 500
        assert response.status_code != 500


class TestPatronesDoS:
    """
    Patrones de ataque DoS (Denial of Service) que no requieren gran volumen.
    """

    def test_request_con_cabeceras_gigantes_no_causa_500(self):
        """
        Cabeceras HTTP con valores enormes no deben colapsar el servidor.
        """
        cabecera_gigante = "X" * 8_000  # 8KB de cabecera

        response = client.get(
            "/carrito/health-check",
            headers={"X-Custom-Header": cabecera_gigante},
        )
        # El servidor puede aceptar la cabecera o rechazarla, pero no debe colapsar
        assert response.status_code != 500

    def test_sesion_id_extremadamente_largo(self):
        """
        Un sesion_id de 10.000 caracteres no debe causar error 500.
        En la BD, el sesion_id es un VARCHAR sin limite configurado en el ORM.
        """
        sesion_gigante = "A" * 10_000

        response = client.get(f"/carrito/{sesion_gigante}")
        # Debe retornar un carrito vacio (200), no un error
        assert response.status_code in (200, 422, 414), (
            f"sesion_id de 10K chars causo respuesta inesperada: {response.status_code}"
        )
        assert response.status_code != 500
