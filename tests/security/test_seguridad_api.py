"""
Pruebas basicas de seguridad para la API del carrito de TiendaUV.

Que es OWASP y por que es el estandar de la industria
-------------------------------------------------------
OWASP (Open Web Application Security Project) es una fundacion sin animo de
lucro que produce estandares, herramientas y documentacion sobre seguridad
en aplicaciones web. Su lista "API Security Top 10" es el catalogo de las
vulnerabilidades mas comunes y criticas en APIs, actualizada periodicamente
con datos reales de ataques.

La lista no es academica: es un compendio de lo que organizaciones de todo el
mundo han sufrido en sus APIs. Usarla como referencia garantiza que los tests
cubren las amenazas reales mas probables, no vulnerabilidades hipoteticas.

Por que estos tests usan TestClient directamente sin Docker ni fixture de BD
-----------------------------------------------------------------------------
La seguridad es una preocupacion de la frontera del sistema: la API misma,
su manejo de entradas, sus cabeceras de respuesta. No necesitan una PostgreSQL
real para verificar que un payload de SQL injection no causa un 500.

La API usa SQLite en memoria como fallback cuando DATABASE_URL no esta definida.
Los tests de seguridad aprovechan esto para correr sin infraestructura externa:
rapidos, sin Docker, ejecutables en cualquier maquina.

Un status 500 siempre es senal de problema de seguridad
---------------------------------------------------------
HTTP 500 (Internal Server Error) significa que el servidor tuvo un error
no manejado. En el contexto de seguridad, un 500 ante un payload malicioso
es una senal de alerta por dos razones:

1. El servidor no controlo el error: el codigo no tiene un try/except que
   maneje esa condicion. Inputs maliciosos deben producir 400/422, no 500.

2. Un 500 puede revelar informacion interna en el cuerpo de la respuesta:
   trazas de pila, nombres de archivos, versiones de frameworks, consultas
   SQL con los valores que fallaron. Un atacante usa esa informacion para
   afinar su ataque.

Regla de oro: la API nunca debe retornar 500 como respuesta a inputs del usuario.
500 es para errores de infraestructura (BD caida, disco lleno), no para datos
invalidos o maliciosos.

Que cubre cada clase de test
-----------------------------
TestInyeccion: verifica que los payloads diseñados para ser interpretados como
  comandos (SQL, JavaScript, numeros extremos) son tratados como datos inofensivos.

TestValidacionEntradas: verifica que la frontera de la API rechaza tipos de datos
  incorrectos y descarta campos no declarados en el modelo.

TestCabeceras: verifica que las respuestas HTTP no revelan informacion interna
  del servidor (versiones de software, frameworks).

TestRateLimit: verifica que el servidor no se degrada bajo carga basica. No es
  un test de rendimiento real (para eso esta Locust), sino una verificacion de
  robustez minima.
"""

from fastapi.testclient import TestClient

from src.carrito.api import app

# TestClient a nivel de modulo: se crea una sola vez y se reutiliza en todos los tests.
# No hay estado compartido entre tests porque cada test usa un sesion_id diferente.
# La BD es SQLite en memoria: empieza vacia con cada sesion de pytest.
client = TestClient(app)


class TestInyeccion:
    """
    OWASP API8 / Injection
    Los datos del usuario no deben interpretarse como comandos.

    SQL Injection: el atacante inserta SQL en un campo de datos esperando que
    el servidor lo ejecute. "Laptop'; DROP TABLE productos; --" intenta terminar
    la consulta SQL actual e inyectar un DROP TABLE.

    La API esta protegida porque SQLAlchemy usa consultas parametrizadas:
    el texto del usuario va en un parametro separado del SQL, nunca concatenado.
    El motor de BD trata el string como dato, sin importar si contiene SQL.
    """

    def test_sql_injection_en_nombre_no_causa_error_500(self):
        """
        SQL Injection en el nombre del producto.
        El sistema debe tratar el string como dato, nunca como SQL.
        Nunca debe retornar 500.
        """
        payload_malicioso = "Laptop'; DROP TABLE productos; --"

        response = client.post(
            "/carrito/test-sql/productos",
            json={"nombre": payload_malicioso, "precio": 100, "cantidad": 1},
        )

        assert response.status_code in [201, 422], f"Codigo inesperado: {response.status_code}"
        assert response.status_code != 500, (
            "ERROR DE SEGURIDAD: el payload SQL causo un error interno"
        )

    def test_xss_en_nombre_se_almacena_como_texto(self):
        """
        Cross-Site Scripting (XSS): el payload JavaScript no debe ejecutarse,
        debe guardarse y devolverse como texto plano.

        XSS en una API REST es menos directo que en HTML (la API retorna JSON,
        no HTML), pero si el nombre se mostrara en un frontend sin escapar,
        el script podria ejecutarse en el navegador del usuario.

        El test verifica que el string llega y sale identico, sin modificacion,
        lo que en el contexto de JSON significa que no fue interpretado como HTML.
        """
        payload_xss = "<script>document.cookie='stolen'</script>"

        response = client.post(
            "/carrito/test-xss/productos",
            json={"nombre": payload_xss, "precio": 100, "cantidad": 1},
        )

        if response.status_code == 201:
            r_get = client.get("/carrito/test-xss")
            productos = r_get.json()["productos"]
            nombres = [p["nombre"] for p in productos]
            assert payload_xss in nombres, (
                "El payload XSS no se almaceno como texto — posible ejecucion"
            )

    def test_integer_overflow_no_colapsa_servidor(self):
        """
        Numero extremadamente grande en el precio.
        El servidor debe manejarlo graciosamente, sin error 500.

        10^308 es un numero cercano al maximo representable por float64.
        Servidores mal implementados pueden fallar con operaciones aritmeticas
        (overflow, NaN) o al serializar el resultado. La API debe rechazarlo
        con 422 o aceptarlo, pero nunca lanzar un 500 no manejado.
        """
        numero_gigante = 10**308

        response = client.post(
            "/carrito/test-overflow/productos",
            json={"nombre": "Laptop", "precio": numero_gigante, "cantidad": 1},
        )

        assert response.status_code in [201, 422]
        assert response.status_code != 500


class TestValidacionEntradas:
    """
    OWASP API8: Security Misconfiguration
    Las entradas deben validarse estrictamente en la frontera del sistema.

    FastAPI usa Pydantic para validar el cuerpo de los requests. Si el JSON
    no coincide con el modelo (tipos incorrectos, campos obligatorios faltantes),
    Pydantic rechaza la peticion con 422 antes de que llegue al endpoint.
    Esto es validacion automatica en la frontera: el codigo de negocio nunca
    ve datos invalidos.
    """

    def test_tipos_de_datos_incorrectos_son_rechazados(self):
        """
        Un string donde se espera un numero debe retornar 422, nunca 500.
        FastAPI/Pydantic captura esto automaticamente.

        ProductoInput declara precio: float. Si el JSON trae "dos millones"
        (string), Pydantic no puede convertirlo y retorna 422 con los detalles
        del error de validacion. El endpoint agregar_producto nunca se ejecuta.
        """
        response = client.post(
            "/carrito/test-tipos/productos",
            json={"nombre": "Laptop", "precio": "dos millones", "cantidad": 1},
        )
        assert response.status_code == 422
        assert response.status_code != 500

    def test_mass_assignment_campos_extra_ignorados(self):
        """
        Mass Assignment: campos adicionales no esperados deben ignorarse.
        Pydantic v2 los descarta silenciosamente.

        Mass Assignment es una vulnerabilidad donde el atacante envia campos
        extra (como admin: true o precio: 0.01) esperando que el sistema los
        procese como si fueran campos validos del modelo. Por ejemplo, en una
        API mal implementada, enviar "descuento_forzado: 99" podria aplicar un
        descuento no autorizado.

        Pydantic v2 (que usa FastAPI) tiene mode='ignore' por defecto: los campos
        que no estan declarados en el modelo se ignoran completamente. El request
        llega con 7 campos, el modelo solo ve nombre, precio y cantidad.
        """
        response = client.post(
            "/carrito/test-mass/productos",
            json={
                "nombre": "Laptop",
                "precio": 2_500_000,
                "cantidad": 1,
                "admin": True,
                "precio_real": 0.01,
                "sesion_id": "admin-super",
                "descuento_forzado": 99,
            },
        )
        assert response.status_code == 201

    def test_payload_extremadamente_grande_no_colapsa(self):
        """
        Un nombre de 100.000 caracteres no debe provocar un error 500.
        Puede aceptarse (201) o rechazarse por validacion (422).

        Payloads enormes pueden causar problemas de memoria o tiempo de proceso.
        Un servidor bien configurado tiene limites de tamano de request
        (generalmente en el nivel del reverse proxy como nginx). La API debe
        manejar lo que llegue hasta ella sin colapsar.
        """
        nombre_enorme = "A" * 100_000

        response = client.post(
            "/carrito/test-payload/productos",
            json={"nombre": nombre_enorme, "precio": 100, "cantidad": 1},
        )

        assert response.status_code in [201, 422]
        assert response.status_code != 500


class TestCabeceras:
    """
    OWASP API8: Security Misconfiguration
    Las cabeceras de respuesta no deben revelar informacion interna del servidor.

    Las cabeceras de respuesta HTTP son visibles para cualquier atacante con
    acceso a la red. Revelar versiones exactas de software (uvicorn/0.29.0,
    python/3.12) permite al atacante buscar CVEs (vulnerabilidades publicas)
    especificas de esas versiones y explotar las conocidas.
    """

    def test_cabecera_content_type_es_json(self):
        """El Content-Type de toda respuesta de la API debe ser application/json."""
        response = client.get("/carrito/test-headers")
        assert "application/json" in response.headers.get("content-type", "")

    def test_cabecera_server_no_revela_version(self):
        """
        La cabecera 'Server' no debe revelar versiones internas.
        Ejemplo de valor problematico: 'uvicorn/0.29.0 python/3.12'.

        En produccion, un reverse proxy (nginx) deberia interceptar y reemplazar
        esta cabecera con algo generico. Este test verifica que por lo menos
        uvicorn no filtra su version exacta.
        """
        response = client.get("/carrito/test-headers")
        server_header = response.headers.get("server", "").lower()

        assert "python/3" not in server_header, (
            f"Cabecera Server revela version de Python: {server_header}"
        )
        assert "uvicorn/0." not in server_header, (
            f"Cabecera Server revela version de uvicorn: {server_header}"
        )


class TestEndpointsNuevos:
    """
    Cobertura de los endpoints agregados en esta iteracion del proyecto.

    health-check, vaciar carrito, y eliminar producto individual son endpoints
    que tambien tienen implicaciones de seguridad:
    - health-check: no debe revelar informacion interna del servidor.
    - vaciar: operacion destructiva que debe responder correctamente.
    - eliminar producto: debe retornar 404 si el recurso no existe, no 500.
      Un 500 aqui revelaria detalles internos del servidor al atacante.
    """

    def test_health_check_retorna_ok(self):
        """
        El endpoint de salud debe retornar 200 con {"status": "ok"}.
        No debe revelar versiones, rutas internas ni detalles de infraestructura.
        """
        response = client.get("/carrito/health-check")
        assert response.status_code == 200
        data = response.json()
        assert data == {"status": "ok"}, f"Respuesta inesperada del health-check: {data}"

    def test_vaciar_carrito_retorna_200(self):
        """
        DELETE /carrito/{sesion_id} debe vaciar el carrito y retornar 200.
        Verificar que una operacion destructiva no genera 500.
        """
        sesion = "test-vaciar-api"
        client.post(
            f"/carrito/{sesion}/productos",
            json={"nombre": "Laptop", "precio": 100_000, "cantidad": 1},
        )
        response = client.delete(f"/carrito/{sesion}")
        assert response.status_code == 200
        assert response.status_code != 500

    def test_eliminar_producto_individual_retorna_200(self):
        """
        DELETE /carrito/{sesion_id}/productos/{nombre} debe eliminar el producto
        y retornar 200. Es el endpoint nuevo agregado para el flujo del frontend.
        """
        sesion = "test-delete-producto"
        client.post(
            f"/carrito/{sesion}/productos",
            json={"nombre": "Laptop", "precio": 100_000, "cantidad": 1},
        )
        response = client.delete(f"/carrito/{sesion}/productos/Laptop")
        assert response.status_code == 200
        assert response.status_code != 500

    def test_eliminar_producto_inexistente_retorna_404_no_500(self):
        """
        Intentar eliminar un producto que no existe debe retornar 404, no 500.

        OWASP API1: un servidor que retorna 500 ante un recurso inexistente puede
        revelar detalles del error interno (traza de pila, query SQL) en el cuerpo
        de la respuesta. El 404 correcto indica que el sistema maneja el error
        de forma controlada.
        """
        response = client.delete("/carrito/sesion-vacia/productos/ProductoQueNoExiste")
        assert response.status_code == 404, (
            f"Recurso inexistente debe ser 404, fue: {response.status_code}"
        )
        assert response.status_code != 500

    def test_precio_invalido_retorna_422_no_500(self):
        """
        Un precio negativo debe ser rechazado con 422, no con 500.
        La validacion de negocio debe capturarse y convertirse en respuesta HTTP.
        """
        response = client.post(
            "/carrito/test-precio-negativo/productos",
            json={"nombre": "Laptop", "precio": -1, "cantidad": 1},
        )
        assert response.status_code == 422
        assert response.status_code != 500

    def test_descuento_tipo_invalido_retorna_422_no_500(self):
        """
        Un tipo de descuento invalido debe retornar 422, no 500.
        Verifica que el bloque except ValueError del endpoint funciona correctamente.
        """
        sesion = "test-descuento-invalido"
        client.post(
            f"/carrito/{sesion}/productos",
            json={"nombre": "Laptop", "precio": 100_000, "cantidad": 1},
        )
        response = client.post(
            f"/carrito/{sesion}/descuento",
            json={"tipo": "tipo_invalido", "valor": 10},
        )
        assert response.status_code == 422
        assert response.status_code != 500


class TestRateLimit:
    """
    OWASP API4: Unrestricted Resource Consumption
    El servidor no debe colapsar bajo carga basica sostenida.

    Esta no es una prueba de rendimiento real (para eso esta Locust con 50
    usuarios concurrentes durante 30 segundos). Es una verificacion de robustez
    minima: 100 requests secuenciales no deberian generar ningun error 500.

    Si el servidor tuviera un leak de memoria, un bug en el manejo de sesiones
    de BD, o algun recurso que no se libera correctamente, podria aparecer
    aqui como errores 500 en las ultimas iteraciones cuando el recurso se agota.
    """

    def test_100_solicitudes_rapidas_no_causan_error_500(self):
        """
        100 solicitudes seguidas no deben generar ningun error 500.
        Un sistema robusto maneja esto sin inmutarse.
        """
        errores_500 = 0

        for i in range(100):
            response = client.post(
                # URL unica por iteracion para evitar que el mismo sesion_id
                # acumule items y posiblemente active validaciones de limite
                f"/carrito/rate-test-{i}/productos",
                json={"nombre": f"Producto{i}", "precio": 10_000, "cantidad": 1},
            )
            if response.status_code == 500:
                errores_500 += 1

        assert errores_500 == 0, f"El servidor tuvo {errores_500} errores 500 bajo carga basica"
