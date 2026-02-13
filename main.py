from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import pandas as pd
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
import os
import time
import random
import math

# --- CONFIGURACIÓN PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend") # ¡Adiós a los dos puntos!
CSV_PATH = os.path.join(BASE_DIR, "DATASET_OptiExport_Mejorado.csv")

# --- CARGA DE DATOS (REEMPLAZA A NEO4J) ---
try:
    df_db = pd.read_csv(CSV_PATH)
    print(f"✅ CSV cargado exitosamente. {len(df_db)} registros disponibles.")
except Exception as e:
    print(f"❌ Error al cargar el CSV: {e}")
    df_db = pd.DataFrame()

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ya no abrimos el navegador ni cerramos Neo4j, ideal para Railway
    print("🚀 Servidor de OptiExport iniciado correctamente en modo local (CSV).")
    yield
    print("🔒 Servidor apagado.")

app = FastAPI(title="Optimizador de Carga 3D - Rotación Activada (CSV)", lifespan=lifespan)

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE DATOS ---
class OrderRequest(BaseModel):
    product_ids: List[str] = []

class Position(BaseModel):
    x: float
    y: float
    z: float

class ProductItem(BaseModel):
    id: str
    name: str = "" 
    nombre: str = "" 
    type: str = ""
    tipo_mercancia: str = ""
    grupo: str = "" 
    volume: float = 0
    volumen: float = 0
    
    peso: float = 0 
    largo: float
    ancho: float
    alto: float
    
    rotado: bool = False 
    position: Optional[Position] = None

class ContainerResult(BaseModel):
    container_type: str
    products: List[ProductItem]
    total_volume_m3: float
    total_weight_kg: float
    utilization_pct: float
    weight_utilization_pct: float

# --- FÍSICA Y LÓGICA (INTACTA) ---

def intersect(b1, b2):
    return (
        b1['x'] < b2['x'] + b2['largo'] and b1['x'] + b1['largo'] > b2['x'] and
        b1['y'] < b2['y'] + b2['alto'] and b1['y'] + b1['alto'] > b2['y'] and
        b1['z'] < b2['z'] + b2['ancho'] and b1['z'] + b1['ancho'] > b2['z']
    )

def is_supported(new_box, packed_items):
    if new_box['y'] <= 0.01: return True

    base_area = new_box['largo'] * new_box['ancho']
    supported_area = 0.0
    y_bottom = new_box['y']
    
    for item in packed_items:
        item_top = item['position']['y'] + item['alto']
        if abs(item_top - y_bottom) < 0.01:
            overlap_x = max(0, min(item['position']['x'] + item['largo'], new_box['x'] + new_box['largo']) - max(item['position']['x'], new_box['x']))
            overlap_z = max(0, min(item['position']['z'] + item['ancho'], new_box['z'] + new_box['ancho']) - max(item['position']['z'], new_box['z']))
            supported_area += overlap_x * overlap_z

    if base_area == 0: return False
    return (supported_area / base_area) > 0.60

def pack_container_3d(products_to_pack, container_dims, max_weight_kg):
    cont_L = container_dims['L']
    cont_H = container_dims['H']
    cont_W = container_dims['W']
    
    packed_items = []
    current_weight = 0.0
    anchor_points = [(0.0, 0.0, 0.0)]
    remaining_products = []

    sorted_products = sorted(products_to_pack, key=lambda x: (x.get('alto', 0), x.get('volumen', 0)), reverse=True)

    for prod in sorted_products:
        orig_l = prod.get('largo', 0.5)
        orig_w = prod.get('ancho', 0.5)
        orig_h = prod.get('alto', 0.5)
        p_weight = prod.get('peso', 0)
        
        if current_weight + p_weight > max_weight_kg:
            remaining_products.append(prod)
            continue 
        
        placed = False
        anchor_points.sort(key=lambda p: (p[1], p[2], p[0]))
        best_anchor_idx = -1
        
        orientations = [
            {'l': orig_l, 'w': orig_w, 'rotado': False},
            {'l': orig_w, 'w': orig_l, 'rotado': True}
        ]
        
        if abs(orig_l - orig_w) < 0.01:
            orientations = [orientations[0]]

        for idx, (ax, ay, az) in enumerate(anchor_points):
            for orient in orientations:
                cand_l = orient['l']
                cand_w = orient['w']
                cand_h = orig_h 
                
                if (ax + cand_l <= cont_L) and (ay + cand_h <= cont_H) and (az + cand_w <= cont_W):
                    new_box = {'x': ax, 'y': ay, 'z': az, 'largo': cand_l, 'ancho': cand_w, 'alto': cand_h}

                    if not is_supported(new_box, packed_items):
                        continue 

                    collision = False
                    for existing in packed_items:
                        ex_pos = existing['position']
                        existing_box = {
                            'x': ex_pos['x'], 'y': ex_pos['y'], 'z': ex_pos['z'],
                            'largo': existing['largo'], 'ancho': existing['ancho'], 'alto': existing['alto']
                        }
                        if intersect(new_box, existing_box):
                            collision = True
                            break
                    
                    if not collision:
                        placed = True
                        prod['position'] = {'x': ax, 'y': ay, 'z': az}
                        prod['largo'] = cand_l
                        prod['ancho'] = cand_w
                        prod['alto']  = cand_h
                        prod['rotado'] = orient['rotado']
                        
                        packed_items.append(prod)
                        current_weight += p_weight
                        
                        anchor_points.append((ax + cand_l, ay, az))
                        anchor_points.append((ax, ay + cand_h, az))
                        anchor_points.append((ax, ay, az + cand_w))
                        
                        best_anchor_idx = idx
                        break 
            
            if placed: break 
        
        if placed:
            if best_anchor_idx != -1:
                anchor_points.pop(best_anchor_idx)
        else:
            remaining_products.append(prod)

    return packed_items, remaining_products

def optimize_fleet(all_products, container_dims, limit_m3, limit_kg):
    fleet = []
    pending = all_products
    
    while pending:
        packed, left_over = pack_container_3d(pending, container_dims, limit_kg)
        
        if not packed:
            print(f"⚠️ {len(pending)} productos omitidos.")
            break
            
        vol_used = sum(p.get('volumen', 0) for p in packed)
        weight_used = sum(p.get('peso', 0) for p in packed)
        
        fleet.append({
            "products": packed,
            "current_volume": vol_used,
            "current_weight": weight_used,
            "limit_vol": limit_m3,
            "limit_weight": limit_kg
        })
        pending = left_over
        
    return fleet

# --- ENDPOINTS ---
@app.post("/optimize", response_model=List[ContainerResult])
def optimize_load(order: OrderRequest):
    start_time = time.time()
    
    if df_db.empty:
        raise HTTPException(status_code=500, detail="La base de datos (CSV) no está disponible.")

    product_ids = order.product_ids
    products_data = []
    
    # CASO 1: Manual (Filtrar por IDs del request)
    if len(product_ids) > 0:
        filtered_df = df_db[df_db['ID_Producto'].isin(product_ids)]
        
    # CASO 2: Simulación (Demo Visual Aleatoria)
    else:
        print("🔄 Modo Simulación: Generando carga variada desde CSV...")
        # Tomamos hasta X productos aleatorios para mostrar contenedores llenos
        filtered_df = df_db.sample(n=min(5000, len(df_db)))

    # Procesamos los datos extraídos del Pandas DataFrame
    for _, row in filtered_df.iterrows():
        vol = float(row['Volumen_Ocupado_m3'])
        
        # Generamos las dimensiones basándonos en el volumen para probar el algoritmo
        base_w = round(random.uniform(0.6, 1.0), 2)
        base_l = round(random.uniform(1.2, 2.0), 2)
        height = round(vol / (base_w * base_l), 2)
        if height > 2.3: height, base_l = base_l, height
        
        peso_ton = float(row['Peso_Toneladas'])
        
        products_data.append({
            "id": str(row['ID_Producto']),
            "nombre": str(row['Producto']),
            "volumen": vol,
            "largo": base_l,
            "ancho": base_w,
            "alto": height,
            "peso": peso_ton * 1000, # Convertimos Toneladas a KG
            "tipo_mercancia": str(row['Tipo_Mercancia']),
            "grupo": str(row['Grupo_Compatibilidad']),
            "destino_simulado": str(row['Puerto_Destino'])
        })

    if not products_data:
        raise HTTPException(status_code=404, detail="No se encontraron productos.")

    # Agrupamos por Destino y Grupo de Compatibilidad
    groups = {}
    for p in products_data:
        destino = p['destino_simulado']
        grupo_real = p['grupo'] 
        key = (destino, grupo_real)
        if key not in groups: groups[key] = []
        groups[key].append(p)

    final_manifest = []

    for (destino, grupo_actual), items in groups.items():
        limit_m3 = 76.0
        limit_kg = 28000.0
        
        if grupo_actual == 'Perecible_Refrigerado':
            dims = {'L': 11.58, 'W': 2.29, 'H': 2.40}
            limit_m3 = 58.0
            limit_kg = 26000.0
            base_type = "Refrigerado"
        else:
            dims = {'L': 12.03, 'W': 2.35, 'H': 2.69}
            base_type = "High Cube"
        
        fleet_result = optimize_fleet(items, container_dims=dims, limit_m3=limit_m3, limit_kg=limit_kg)
        
        for i, c in enumerate(fleet_result):
            label_tipo = f"{base_type} - {grupo_actual}"
            if c['current_weight'] >= limit_kg * 0.95: label_tipo += " (MAX PESO)"

            final_manifest.append({
                "container_type": f"{label_tipo} #{i+1} -> {destino}",
                "products": c['products'],
                "total_volume_m3": round(c['current_volume'], 2),
                "total_weight_kg": round(c['current_weight'], 2),
                "utilization_pct": round((c['current_volume'] / limit_m3) * 100, 2),
                "weight_utilization_pct": round((c['current_weight'] / limit_kg) * 100, 2)
            })

    limit_result = final_manifest[:1000]
    
    end_time = time.time()
    total_time = end_time - start_time
    
    print(f"✅ Optimización: {len(limit_result)} contenedores. Rotación OK.")
    print(f"⏱️ Tiempo de ejecución: {total_time:.4f} segundos")
    
    return limit_result

# 1. Definir la ruta correcta (ahora que main.py está en la raíz)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# 2. Montar los archivos estáticos
if os.path.exists(FRONTEND_DIR):
    # Nota: Asegúrate de que en tu index.html las rutas a scripts/css 
    # apunten a /static/...
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
async def read_root():
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    
    # --- MODO DETECTIVE CORREGIDO ---
    # (Ya no ponemos 'import os' aquí porque ya está al inicio de tu archivo)
    archivos_raiz = os.listdir(BASE_DIR)
    existe_carpeta = os.path.exists(FRONTEND_DIR)
    archivos_front = os.listdir(FRONTEND_DIR) if existe_carpeta else []
    
    return {
        "error": "No encuentro el index.html",
        "1_ruta_que_busque": index_file,
        "2_archivos_en_la_raiz": archivos_raiz,
        "3_existe_la_carpeta_frontend": existe_carpeta,
        "4_archivos_dentro_de_frontend": archivos_front
    }

if __name__ == "__main__":
    import uvicorn
    import os
    
    # Verificamos si estamos en Railway (Railway siempre inyecta la variable PORT)
    puerto_railway = os.environ.get("PORT")
    
    if puerto_railway:
        # Modo Producción (Railway)
        uvicorn.run("main:app", host="0.0.0.0", port=int(puerto_railway))
    else:
        # Modo Local (Tu computadora)
        print("💻 Corriendo en modo local. Abre http://127.0.0.1:8000")
        uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
