# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build de la aplicacion Angular
#
# Por que multi-stage build:
# La imagen final de produccion no necesita Node.js, npm, ni el codigo fuente.
# Solo necesita los archivos estaticos generados (HTML, CSS, JS). Con un build
# multi-stage, el stage 1 hace la compilacion y el stage 2 solo copia los
# archivos resultantes. La imagen final pesa ~25MB (nginx-alpine) en vez de
# ~400MB (node con todo instalado).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copiar package.json y package-lock.json antes del codigo fuente.
# Docker cachea cada capa: si package*.json no cambio, la capa del npm ci
# se reutiliza del cache aunque el codigo fuente haya cambiado.
# Esto hace que las builds posteriores sean mucho mas rapidas.
COPY package*.json ./
RUN npm ci

# Copiar el codigo fuente despues de instalar dependencias
COPY . .

# Build de produccion: optimiza, minifica y genera hashes en los nombres
# de archivos para cache busting. El flag --configuration=production activa
# el file replacement de environment.prod.ts y las optimizaciones de Angular.
RUN npm run build -- --configuration=production

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Servir con nginx
#
# nginx:1.27-alpine es una imagen minima (~8MB). Sirve los archivos estaticos
# del build de Angular y actua como reverse proxy hacia la API.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Angular 17 con el builder "application" genera los archivos en:
# dist/<nombre-proyecto>/browser/
# El glob dist/*/browser captura el directorio sin hardcodear el nombre del proyecto.
COPY --from=build /app/dist/*/browser /usr/share/nginx/html

# Reemplazar la configuracion por defecto de nginx con la nuestra.
# La configuracion por defecto de nginx sirve archivos estaticos pero no tiene
# el fallback a index.html necesario para el routing de Angular ni el proxy a la API.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# El CMD por defecto de la imagen nginx ya ejecuta nginx en foreground.
# No es necesario sobreescribirlo.
