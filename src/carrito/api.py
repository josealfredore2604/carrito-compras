"""
API REST para el carrito de compras de TiendaUV.
Construida con FastAPI. Usada por las pruebas de carga (Locust) y de seguridad.

Que es FastAPI y como funciona el routing
-----------------------------------------
FastAPI es un framework web de Python para construir APIs REST. Su valor
principal es que integra validacion de tipos con Pydantic y documentacion
automatica (OpenAPI/Swagger) sin configuracion adicional.

El routing funciona con decoradores: @app.get("/ruta") registra la funcion
como handler para GET /ruta. @app.post("/ruta") para POST, etc. FastAPI extrae
automaticamente los parametros de ruta ({sesion_id}), del cuerpo (JSON via
Pydantic) y de las dependencias (Depends).

Que es Pydantic y por que valida los tipos automaticamente
----------------------------------------------------------
Pydantic es una libreria de validacion de datos con anotaciones de tipo de Python.
Al heredar de BaseModel, la clase define el "schema" del request body.

Cuando FastAPI recibe un POST con JSON, usa Pydantic para:
  1. Parsear el JSON al modelo (ej. {"nombre": "Laptop", "precio": 2500000, "cantidad": 1}).
  2. Validar los tipos (nombre debe ser str, precio debe ser float, cantidad int).
  3. Si la validacion falla, retorna automaticamente 422 Unprocessable Entity
     con los detalles del error. El endpoint nunca se ejecuta.
  4. Si pasa, el endpoint recibe un objeto Python tipado, sin necesidad de
     hacer parsing manual.

Pydantic v2 (el que usa FastAPI 0.115+) descarta silenciosamente los campos
extra que no esten declarados en el modelo. Esto protege contra Mass Assignment.

Que es Depends y como funciona la inyeccion de dependencias
-----------------------------------------------------------
Depends es el sistema de inyeccion de dependencias de FastAPI. Cuando el
endpoint declara:

    def agregar_producto(db: Session = Depends(get_db)):

FastAPI llama a get_db() para obtener la sesion, la pasa al endpoint como
parametro 'db', y cuando el endpoint termina, continua ejecutando el codigo
de get_db() despues del yield (commit/rollback/close).

Beneficios de Depends:
  1. El codigo de gestion de sesion esta en un solo lugar (get_db).
  2. En tests, app.dependency_overrides reemplaza get_db con la sesion del test.
  3. Los endpoints son simples: solo reciben la sesion lista para usar.

Ejecutar:
    uv run uvicorn src.carrito.api:app --port 8000 --reload
"""

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.database.config import get_db, init_db
from src.database.repositorio import CarritoRepositorio

app = FastAPI(title="TiendaUV - Carrito API", version="1.0.0")

# ─────────────────────────────────────────────────────────────────────────────
# Middleware de CORS (Cross-Origin Resource Sharing)
#
# El navegador bloquea por defecto los requests desde un origen (protocolo +
# host + puerto) a otro distinto. El frontend Angular en localhost:4200 y la
# API en localhost:8000 son origenes diferentes; sin CORS el navegador
# rechazaria los requests en la consola antes de que lleguen al servidor.
#
# CORSMiddleware agrega las cabeceras Access-Control-Allow-* en cada respuesta.
# El navegador lee esas cabeceras y decide si permite o bloquea el request.
#
# En produccion (Docker con nginx), nginx actua como reverse proxy y todo el
# trafico pasa por el mismo origen (puerto 4200 para el frontend, que nginx
# redirige a la API en /api/). El CORS no es necesario en ese escenario, pero
# configurarlo aqui permite el desarrollo local sin proxy.
#
# allow_origins: lista de origenes permitidos. En desarrollo permitimos el
# puerto 4200 del dev server de Angular. Para el entorno de tests E2E se
# agrega tambien el puerto 4201 (docker-compose.test.yml).
# allow_methods: verbos HTTP que se permiten. Necesitamos GET, POST y DELETE.
# allow_headers: cabeceras que el cliente puede enviar. Content-Type es
# obligatorio para los POST con JSON.
# ─────────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",  # Angular dev server
        "http://localhost:4201",  # Frontend de pruebas E2E en docker-compose.test.yml
    ],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.on_event("startup")
def on_startup() -> None:
    """
    Evento que FastAPI ejecuta una vez al arrancar el servidor.

    Para PostgreSQL, las tablas no existen hasta que alguien las crea. Este
    evento garantiza que las tablas esten creadas antes de que llegue el primer
    request. En SQLite, init_db() ya se llama al importar config.py, pero no
    hace dano llamarla de nuevo (CREATE TABLE IF NOT EXISTS es idempotente).

    En produccion real, las migraciones se manejan con Alembic para tener
    control de versiones del schema. Aqui se usa init_db() por simplicidad.
    """
    # Garantiza tablas en PostgreSQL. En SQLite ya se crean al importar config.
    init_db()


# ─────────────────────────────────────────────────────────────────────────────
# Modelos Pydantic para los cuerpos de los requests
# ─────────────────────────────────────────────────────────────────────────────


class ProductoInput(BaseModel):
    """
    Schema para el cuerpo del POST /carrito/{id}/productos.

    FastAPI usa esta clase para validar el JSON del request. Si el JSON no
    tiene los campos correctos con los tipos correctos, FastAPI retorna 422.
    Campos extra en el JSON son ignorados automaticamente por Pydantic v2.
    """

    nombre: str
    precio: float
    cantidad: int


class DescuentoInput(BaseModel):
    """
    Schema para el cuerpo del POST /carrito/{id}/descuento.

    tipo: "porcentaje" o "fijo" (validacion de valores especificos la hace el repositorio).
    valor: el porcentaje o el monto fijo del descuento.
    """

    tipo: str
    valor: float


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/carrito/health-check")
def health_check():
    """
    Endpoint de salud del servidor.

    Por que esta ANTES de /carrito/{sesion_id} en el orden de rutas:
    FastAPI registra las rutas en el orden en que aparecen en el codigo.
    Cuando llega GET /carrito/health-check, FastAPI evalua las rutas en orden.
    Si /carrito/{sesion_id} estuviera primero, FastAPI lo matchearia con
    sesion_id="health-check" y ejecutaria obtener_carrito en vez del health check.

    Al poner el health-check primero, FastAPI lo matchea antes de intentar
    el patron con variable. Las rutas literales tienen prioridad si se definen
    antes, pero en FastAPI la prioridad real es por orden de definicion.
    """
    return {"status": "ok"}


@app.post("/carrito/{sesion_id}/productos", status_code=201)
def agregar_producto(sesion_id: str, producto: ProductoInput, db: Session = Depends(get_db)):
    """
    Agrega un producto al carrito de la sesion.

    {sesion_id} en la ruta es un parametro de path: FastAPI extrae el valor
    del URL y lo pasa a la funcion. Puede ser cualquier string.

    producto: ProductoInput es el cuerpo del request. FastAPI lo valida con
    Pydantic antes de llamar a esta funcion.

    db: Session = Depends(get_db): FastAPI llama a get_db() para obtener la
    sesion de BD y la inyecta como parametro 'db'.

    Si el repositorio lanza ValueError (precio invalido, cantidad fuera de rango),
    se convierte en un 422 HTTP con el mensaje de error en el detalle.
    """
    repo = CarritoRepositorio(db)
    try:
        repo.agregar_item(sesion_id, producto.nombre, producto.precio, producto.cantidad)
    except ValueError as exc:
        # HTTPException convierte el ValueError del repositorio en una respuesta HTTP.
        # 422 Unprocessable Entity es el codigo correcto para errores de validacion de negocio.
        raise HTTPException(status_code=422, detail=str(exc))
    return {"mensaje": f"Producto '{producto.nombre}' agregado al carrito"}


@app.get("/carrito/{sesion_id}")
def obtener_carrito(sesion_id: str, db: Session = Depends(get_db)):
    """
    Retorna el estado completo del carrito.

    Por que el endpoint GET nunca retorna 404:
    Si el carrito no existe en la BD, obtener_productos retorna [] y calcular_total
    retorna 0.0. El endpoint retorna un carrito vacio con total=0 en vez de 404.

    Esta decision de diseno simplifica el cliente: no necesita manejar el caso
    "el carrito no existe" de forma especial. Un carrito nuevo y un carrito vacio
    son equivalentes desde la perspectiva del cliente.
    """
    repo = CarritoRepositorio(db)
    productos = repo.obtener_productos(sesion_id)
    return {
        "sesion_id": sesion_id,
        "productos": productos,
        "total": repo.calcular_total(sesion_id),
        "total_con_iva": repo.calcular_total_con_iva(sesion_id),
        "cantidad_productos": len(productos),
    }


@app.post("/carrito/{sesion_id}/descuento")
def aplicar_descuento(sesion_id: str, descuento: DescuentoInput, db: Session = Depends(get_db)):
    """
    Aplica un descuento al carrito.

    Un descuento nuevo reemplaza al anterior: no se acumulan.
    Si el tipo o el valor son invalidos, el repositorio lanza ValueError
    que se convierte en 422.
    """
    repo = CarritoRepositorio(db)
    try:
        repo.aplicar_descuento(sesion_id, descuento.tipo, descuento.valor)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"mensaje": "Descuento aplicado", "total": repo.calcular_total(sesion_id)}


@app.delete("/carrito/{sesion_id}/productos/{nombre}")
def eliminar_producto(sesion_id: str, nombre: str, db: Session = Depends(get_db)):
    """
    Elimina un producto individual del carrito por su nombre.

    Por que este endpoint usa el nombre como identificador y no un ID numerico:
    El modelo de datos actual identifica productos por nombre dentro de un carrito.
    El repositorio ya implementa eliminar_item(sesion_id, nombre) siguiendo
    esta convencion. Un cambio a ID numerico requeriria modificar el modelo
    de datos y todos los endpoints existentes, lo que esta fuera del alcance.

    Si el producto no existe en el carrito, el repositorio lanza ValueError
    que se convierte en 404 Not Found (el recurso a eliminar no existe).
    """
    repo = CarritoRepositorio(db)
    try:
        repo.eliminar_item(sesion_id, nombre)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"mensaje": f"Producto '{nombre}' eliminado del carrito"}


@app.delete("/carrito/{sesion_id}")
def vaciar_carrito(sesion_id: str, db: Session = Depends(get_db)):
    """
    Vacia el carrito: elimina todos los productos y resetea el descuento.

    El carrito en si (la sesion) no se elimina de la BD. Quedar vacio es
    diferente a no existir. Llamar al GET despues del DELETE retorna
    un carrito vacio (total=0, productos=[]), no un 404.
    """
    repo = CarritoRepositorio(db)
    repo.vaciar(sesion_id)
    return {"mensaje": "Carrito vaciado"}
