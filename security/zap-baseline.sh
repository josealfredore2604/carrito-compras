#!/bin/bash
# =============================================================================
# OWASP ZAP Baseline Scan automatizado para TiendaUV
#
# Que es OWASP ZAP
# -----------------
# ZAP (Zed Attack Proxy) es la herramienta de seguridad de aplicaciones web
# mas usada del mundo, desarrollada por OWASP. Es un DAST (Dynamic Application
# Security Testing) tool: analiza la aplicacion CORRIENDO (no el codigo fuente).
#
# Diferencia entre SAST y DAST:
# SAST (Static Analysis): analiza el codigo fuente sin ejecutar la app.
#   Herramientas: bandit (Python), SonarQube, CodeQL.
#   Detecta: variables sin sanitizar, uso de funciones peligrosas, patrones de
#   inyeccion en el codigo.
#   Limitacion: no puede detectar vulnerabilidades que dependen del comportamiento
#   en tiempo de ejecucion (configuraciones de servidor, interacciones complejas).
#
# DAST (Dynamic Analysis): analiza la app corriendo haciendo requests reales.
#   Herramientas: OWASP ZAP, Burp Suite, Nikto.
#   Detecta: cabeceras de seguridad ausentes, configuracion de CORS, XSS reflejado,
#   informacion sensible en respuestas, redirecciones inseguras.
#   Limitacion: no ve el codigo fuente; solo lo que la app expone externamente.
#
# El Baseline Scan de ZAP
# -------------------------
# zap-baseline.py es el script mas simple de ZAP: hace un crawl pasivo de la
# aplicacion (sigue links, analiza respuestas) sin ataques activos. Es seguro
# correr en produccion porque no envia payloads maliciosos.
#
# zap-full-scan.py hace ataques activos (mas detallado pero mas peligroso).
# Solo debe correrse en ambientes de test aislados.
#
# Como usar este script
# ----------------------
# Prerrequisito: Docker instalado y la API corriendo.
#
#   # Correr localmente contra la API de desarrollo:
#   docker compose up api -d
#   ./security/zap-baseline.sh
#
#   # Correr contra un ambiente especifico:
#   TARGET_URL=http://mi-api.ejemplo.com ./security/zap-baseline.sh
#
# Los reportes se guardan en reports/ (creado automaticamente si no existe).
# =============================================================================

set -euo pipefail

TARGET_URL="${TARGET_URL:-http://localhost:8000}"
REPORTS_DIR="$(dirname "$0")/../reports"

# Crear el directorio de reportes si no existe
mkdir -p "$REPORTS_DIR"

echo "🔍 Iniciando OWASP ZAP Baseline Scan..."
echo "   Target: $TARGET_URL"
echo "   Reportes en: $REPORTS_DIR"
echo ""

# docker run --rm: el contenedor se elimina al terminar (no deja basura)
# -v $(pwd)/reports:/zap/wrk/:rw: monta la carpeta de reportes dentro del contenedor
# --network host (Linux) o la red por defecto: permite que ZAP acceda a localhost
#
# En Linux, --network host es necesario para que ZAP dentro del contenedor
# pueda acceder a http://localhost:8000 (que corre fuera del contenedor).
# En Docker Desktop (Mac/Windows), host.docker.internal funciona en vez de localhost.
#
# -t TARGET_URL: la URL a escanear
# -r zap_report.html: reporte en formato HTML
# -J zap_report.json: reporte en formato JSON (para parsing automatico en CI)
# -I: NO falla si hay alertas de riesgo "Informational" (reduce ruido)
# -l WARN: el nivel minimo de alerta que se reporta (WARN, INFO, IGNORE)
#
# El scan retorna:
#   0 = sin alertas de alta o media prioridad
#   1 = advertencias de media prioridad
#   2 = alertas de alta prioridad (vulnerabilidades reales)
#   3 = error del scan

# Detectar el OS para configurar la red correctamente
if [[ "$(uname)" == "Linux" ]]; then
    NETWORK_FLAG="--network host"
    EFFECTIVE_TARGET="$TARGET_URL"
else
    # En Mac/Windows, Docker Desktop expone el host como host.docker.internal
    NETWORK_FLAG=""
    EFFECTIVE_TARGET="${TARGET_URL/localhost/host.docker.internal}"
fi

echo "📡 Conectando a: $EFFECTIVE_TARGET"

docker run --rm \
    ${NETWORK_FLAG} \
    -v "$(realpath "$REPORTS_DIR"):/zap/wrk/:rw" \
    ghcr.io/zaproxy/zaproxy:stable \
    zap-baseline.py \
    -t "$EFFECTIVE_TARGET" \
    -r "zap_report.html" \
    -J "zap_report.json" \
    -I \
    -l WARN \
    2>&1 || EXIT_CODE=$?

# EXIT_CODE 0 o 1 son aceptables (0=limpio, 1=advertencias menores)
# EXIT_CODE 2 = vulnerabilidades de alta prioridad (deberia investigarse)
# EXIT_CODE 3 = error del scan (problema de configuracion)
EXIT_CODE="${EXIT_CODE:-0}"

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
    echo "✅ ZAP Scan completado: sin alertas de alta o media prioridad"
elif [ "$EXIT_CODE" -eq 1 ]; then
    echo "⚠️  ZAP Scan completado: hay advertencias de prioridad media"
    echo "   Ver reporte en: $REPORTS_DIR/zap_report.html"
elif [ "$EXIT_CODE" -eq 2 ]; then
    echo "🚨 ZAP Scan encontro alertas de ALTA prioridad"
    echo "   Ver reporte en: $REPORTS_DIR/zap_report.html"
    echo "   Revisar y remediar antes de desplegar a produccion"
else
    echo "❌ Error en el ZAP Scan (codigo $EXIT_CODE)"
fi

echo ""
echo "📄 Reportes generados:"
ls -lh "$REPORTS_DIR"/zap_report.* 2>/dev/null || echo "   (no se generaron reportes)"

# En el pipeline de CI, usamos continue-on-error: true porque ZAP puede generar
# falsos positivos. El reporte queda como artefacto para revision manual.
exit "$EXIT_CODE"
