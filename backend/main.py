from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from neo4j import GraphDatabase
from typing import List, Dict, Any
from contextlib import asynccontextmanager
import os
import webbrowser
import threading
import time
import random
import math

# --- CONFIGURACIÓN PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "../frontend")

# --- CONEXIÓN NEO4J ---
NEO4J_URI = "neo4j+s://7c8925bb.databases.neo4j.io"
NEO4J_AUTH = ("neo4j", "x2NN_bHIlBkwTHJSpMYS7uPWNXutCr3kIt_M5N6YfLE")
driver = GraphDatabase.driver(NEO4J_URI, auth=NEO4J_AUTH)

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    def open_browser():
        time.sleep(1.5)
        url = "http://localhost:8000"
        print(f"🚀 Abriendo navegador en {url} ...")
        webbrowser.open(url)

    threading.Thread(target=open_browser).start()
    print("✅ Servidor iniciado correctamente.")
    yield
    driver.close()
    print("🔒 Conexión a Neo4j cerrada correctamente.")

# --- INICIALIZAR APP ---
app = FastAPI(title="Optimizador de Carga de Contenedores", lifespan=lifespan)

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS ---
class OrderRequest(BaseModel):
    product_ids: List[str] = []

class ProductItem(BaseModel):
    id: str
    name: str
    type: str
    volume: float
    dim_l: float  # Largo
    dim_w: float  # Ancho
    dim_h: float  # Alto

class ContainerResult(BaseModel):
    container_type: str
    products: List[ProductItem]
    total_volume_m3: float
    utilization_pct: float

# --- ALGORITMO GREEDY CON FACTOR DE EFICIENCIA ---
def greedy_bin_packing(products: List[Dict], container_limit_m3=76.4) -> List[Dict]:
    # FACTOR DE ESTIBA: Solo llenamos hasta el 88% para dejar espacio a la geometría de las cajas
    # Esto evita que en el 3D las cajas se salgan del techo.
    EFFICIENCY_FACTOR = 0.88 
    EFFECTIVE_LIMIT = container_limit_m3 * EFFICIENCY_FACTOR

    sorted_products = sorted(products, key=lambda x: x['volumen'], reverse=True)
    containers = []
    
    for prod in sorted_products:
        placed = False
        for cont in containers:
            # Usamos el límite efectivo (más estricto) para decidir si cabe
            if cont['current_volume'] + prod['volumen'] <= EFFECTIVE_LIMIT:
                cont['products'].append({
                    "id": prod['id'],
                    "name": prod['nombre'],
                    "type": prod['tipo_mercancia'],
                    "volume": prod['volumen'],
                    "dim_l": prod.get('largo', 0),
                    "dim_w": prod.get('ancho', 0),
                    "dim_h": prod.get('alto', 0)
                })
                cont['types'].add(prod['grupo'])
                cont['current_volume'] += prod['volumen']
                placed = True
                break
        
        if not placed:
            # Si no cabe (ni siquiera con el 88%), CREAMOS OTRO CONTENEDOR
            new_cont = {
                'products': [{
                    "id": prod['id'],
                    "name": prod['nombre'],
                    "type": prod['tipo_mercancia'],
                    "volume": prod['volumen'],
                    "dim_l": prod.get('largo', 0),
                    "dim_w": prod.get('ancho', 0),
                    "dim_h": prod.get('alto', 0)
                }],
                'types': {prod['grupo']},
                'current_volume': prod['volumen'],
                'limit': container_limit_m3
            }
            containers.append(new_cont)
    return containers

# --- ENDPOINTS ---
@app.post("/optimize", response_model=List[ContainerResult])
def optimize_load(order: OrderRequest):
    product_ids = order.product_ids
    products_data = []
    
    # CASO 1: Manual
    if len(product_ids) > 0:
        query = """
        MATCH (p:Producto)-[:PERTENECE_A]->(g:GrupoCompatibilidad)
        WHERE p.id IN $ids
        RETURN p.id as id, p.nombre as nombre, p.volumen_m3 as volumen, 
               p.tipo_mercancia as tipo_mercancia,
               g.nombre as grupo, 'Shanghai' as destino_simulado
        """
        with driver.session() as session:
            result = session.run(query, ids=product_ids)
            raw = [record.data() for record in result]
            for item in raw:
                side = item['volumen']**(1/3)
                item['largo'] = side
                item['ancho'] = side
                item['alto'] = side
                products_data.append(item)
    # CASO 2: Simulación (Cajas Realistas)
    else:
        print("🔄 Modo Simulación: Generando pallets estándar...")
        query_random = """
        MATCH (p:Producto)-[:PERTENECE_A]->(g:GrupoCompatibilidad)
        WITH p, g, rand() as r 
        ORDER BY r 
        LIMIT 300 
        RETURN p.id as id, p.nombre as nombre, p.volumen_m3 as volumen_real, 
               p.tipo_mercancia as tipo_mercancia,
               g.nombre as grupo, 'Shanghai' as destino_simulado
        """
        with driver.session() as session:
            result = session.run(query_random)
            raw_data = [record.data() for record in result]
            
            for item in raw_data:
                # 1. Volumen de pallet/caja estándar (1 a 4 m3)
                vol = round(random.uniform(1.0, 4.0), 2)
                item['volumen'] = vol
                
                # 2. Dimensiones REALISTAS (Evitar cajas gigantes o planas)
                # Base estándar de pallet (1.0m a 1.2m aprox)
                base_w = round(random.uniform(0.9, 1.4), 2)
                base_l = round(random.uniform(0.9, 1.4), 2)
                
                # Altura calculada
                height = round(vol / (base_w * base_l), 2)
                
                # Ajuste de seguridad: Si sale muy alto (> 2.2m), lo acostamos
                # (Intercambiamos altura por largo)
                if height > 2.2:
                    height, base_l = base_l, height
                
                item['largo'] = base_l
                item['ancho'] = base_w
                item['alto'] = height
                
                products_data.append(item)

    if not products_data:
        raise HTTPException(status_code=404, detail="No se encontraron productos.")

    groups = {}
    for p in products_data:
        destino = p['destino_simulado']
        pool = 'POOL_REFRIGERADO' if p['grupo'] == 'Perecible_Refrigerado' else 'POOL_SECO'
        key = (destino, pool)
        if key not in groups: groups[key] = []
        groups[key].append(p)

    final_manifest = []

    for (destino, pool), items in groups.items():
        limit = 58.0 if pool == 'POOL_REFRIGERADO' else 76.4
        base_type = "Refrigerado" if pool == 'POOL_REFRIGERADO' else "High Cube"
        
        optimized_containers = greedy_bin_packing(items, container_limit_m3=limit)
        
        for c in optimized_containers:
            tipos = list(c['types'])
            label_tipo = f"{base_type} - MIXTO" if len(tipos) > 1 else f"{base_type} - {tipos[0]}"

            final_manifest.append({
                "container_type": f"{label_tipo} -> {destino}",
                "products": c['products'],
                "total_volume_m3": round(c['current_volume'], 2),
                "utilization_pct": round((c['current_volume'] / limit) * 100, 2)
            })

    limit_result = final_manifest[:50]
    print(f"✅ Optimización: {len(limit_result)} contenedores generados.")
    return limit_result

# --- FRONTEND ---
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
async def read_root():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"error": f"Archivo index.html no encontrado en {FRONTEND_DIR}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)