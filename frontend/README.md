# Frontend TiendaUV — Carrito de Compras

Aplicacion Angular 17 standalone (sin NgModules) que consume la API FastAPI del carrito.

## Requisitos
- Node.js 22+
- npm 10+

## Correr localmente (sin Docker)

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (incluye proxy a http://localhost:8000)
# Requiere que la API de FastAPI este corriendo en el puerto 8000
npm start
# → http://localhost:4200
```

## Correr con Docker

```bash
# Desde la raiz del proyecto carrito-compras:
docker compose up frontend --build
# → http://localhost:4200
```

## Build de produccion

```bash
npm run build
# Genera: dist/carrito-frontend/browser/
```

## Variables de entorno

| Variable       | Descripcion              | Valor por defecto |
|---------------|--------------------------|-------------------|
| `FRONTEND_URL` | URL del frontend (E2E)  | http://localhost:4200 |
