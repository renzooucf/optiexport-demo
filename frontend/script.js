// ==================== DASHBOARD TEMPLATE ====================
// Guardamos el HTML del Dashboard en una constante para restaurarlo al volver de Análisis
const dashboardHTML = `
    <aside class="sidebar-left">
        <div class="card">
            <h2 class="card-title">Contenedores</h2>
            <div class="container-selector" id="containerSelector"></div>
            <div class="pagination-controls" id="paginationControls" style="display: none;">
                <button id="btnPrev" onclick="changePage(-1)" title="Anterior">❮</button>
                <span id="pageIndicator" class="page-indicator">-- / --</span>
                <button id="btnNext" onclick="changePage(1)" title="Siguiente">❯</button>
            </div>
            <div class="empty-state" id="emptyContainers">No hay contenedores optimizados</div>
        </div>

        <div class="card" id="containerDetails">
            <h2 class="card-title">Detalles del Contenedor</h2>
            <div class="empty-state" id="emptyDetails">Selecciona un contenedor para ver sus detalles</div>
            <div id="detailsContent" style="display: none;">
                <div class="detail-item"><span class="detail-label">Tipo de Contenedor</span><span class="detail-value" id="containerType">--</span></div>
                <div class="detail-item"><span class="detail-label">Destino</span><span class="detail-value" id="containerDest">--</span></div>
                <div class="detail-item"><span class="detail-label">Productos Incluidos</span><span class="detail-value" id="containerProducts">--</span></div>
            </div>
        </div>

        <div class="card">
            <h2 class="card-title">Resumen Global</h2>
            <div class="summary-grid">
                <div class="stat-item"><span class="stat-label">Contenedores usados</span><span class="stat-value" id="globalContainers">--</span></div>
                <div class="stat-item"><span class="stat-label">Volumen Total</span><span class="stat-value" id="globalVolume">--</span></div>
            </div>
        </div>
    </aside>

    <main class="viewer-container">
        <div class="card viewer-card">
            <h2 class="card-title">Visualización 3D</h2>
            <div class="viewer-content">
                <div id="viewerPlaceholder">
                    <div class="viewer-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                    </div>
                    <h3 class="viewer-title">Visualización 3D</h3>
                    <p class="viewer-subtitle">Procesa los datos para ver el gemelo digital.</p>
                    <button class="process-btn" onclick="processData()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Procesar Optimización
                    </button>
                </div>
                <div id="viewer3D" style="display: none;"></div>
            </div>
        </div>
    </main>

    <aside class="sidebar-right">
        <div class="card">
            <h2 class="card-title">Estadísticas del Contenedor</h2>
            <div class="stat-item"><span class="stat-label">Ocupación del contenedor</span><span class="stat-value" id="containerOccupancy">--</span></div>
            <div class="stat-item"><span class="stat-label">Espacio utilizado</span><span class="stat-value" id="containerSpace">-- m³</span></div>
        </div>
        <div class="card">
            <h2 class="card-title">Alertas y Compatibilidad</h2>
            <div class="alert-content" id="alertBox">
                <div class="alert-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p class="alert-text">Sistema listo. Sin alertas.</p>
            </div>
        </div>
    </aside>
`;

// ==================== STATE MANAGEMENT ====================
let selectedContainer = null;
let containers = [];
let currentSection = 'dashboard';
let currentPage = 1;
const itemsPerPage = 7;

let processingHistory = [
    { id: 1, date: '2025-11-15 10:30', containers: 3, boxes: 156, status: 'Completado' }
];
let filters = {
    fragile: true, stackable: true, perishable: true, hazardous: false,
    temperature: false, humidity: false, ventilation: false,
    maxweight: true, maxvolume: true, mincost: false
};

const SAMPLE_ORDER = [];

let scene, camera, renderer, cubeGroup, controls;
let animationId;

// Mapeo de colores según el tipo de mercancía
const PRODUCT_COLORS = {
    'AGROPECUARIO': 0x10b981,
    'MINERO': 0x64748b,
    'TEXTIL': 0x8b5cf6,
    'QUIMICO': 0xf59e0b,
    'PESQUERO': 0x06b6d4,
    'DEFAULT': 0x3b82f6
};

// ==================== DOM ELEMENTS ====================
const containerSelector = document.getElementById('containerSelector');
const emptyDetails = document.getElementById('emptyDetails');
const detailsContent = document.getElementById('detailsContent');
const emptyContainers = document.getElementById('emptyContainers');
const mainContainer = document.getElementById('mainContainer');
const paginationControls = document.getElementById('paginationControls');

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    init3DViewer();

    if (emptyDetails) emptyDetails.style.display = 'block';
    if (detailsContent) detailsContent.style.display = 'none';
    if (emptyContainers) emptyContainers.style.display = 'block';
});

// Busca esta función en tu código actual y actualízala
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-menu li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const section = item.dataset.section;

            if (section === 'dashboard') showDashboard();
            else if (section === 'analytics') showAnalytics(); // <--- NUEVO
            else if (section === 'history') showHistory();
            else if (section === 'config') showConfiguration();
        });
    });
}

// ==================== API & PROCESSING LOGIC ====================
async function processData() {
    if (!confirm('¿Iniciar Simulación de Carga 3D?')) return;

    const btn = document.querySelector('.process-btn');
    const originalText = btn ? btn.innerHTML : 'Procesar';
    if (btn) {
        btn.innerHTML = 'Optimizando...';
        btn.disabled = true;
    }

    try {
        // CAMBIO AQUÍ: Quitamos el http://localhost:8000
        const response = await fetch('/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_ids: SAMPLE_ORDER, preferences: filters })
        });

        if (!response.ok) throw new Error("Error conectando al servidor Python");

        const apiData = await response.json();

        const mappedContainers = apiData.map((c, index) => {
            // Parsear nombre para sacar destino
            const parts = c.container_type.split('->');
            const typeInfo = parts[0] || "Estándar";
            const dest = parts[1] ? parts[1].trim() : "Varios";

            return {
                id: `C${index + 1000}`,
                type: typeInfo.trim(),
                destination: dest,
                products: c.products,
                boxes: c.products.length,
                occupancy: `${c.utilization_pct}%`,
                space: `${c.total_volume_m3} m³`,
                raw_occupancy: c.utilization_pct
            };
        });

        currentPage = 1;
        loadContainers(mappedContainers);

        // Guardar en historial
        processingHistory.unshift({
            id: processingHistory.length + 1,
            date: new Date().toISOString().slice(0, 16).replace('T', ' '),
            containers: mappedContainers.length,
            boxes: mappedContainers.reduce((a, b) => a + b.boxes, 0),
            status: 'Exitoso'
        });

        document.getElementById('viewerPlaceholder').style.display = 'none';
        document.getElementById('viewer3D').style.display = 'block';

        if (mappedContainers.length > 0) selectContainer(mappedContainers[0].id);
        setTimeout(() => { onWindowResize(); }, 100);

    } catch (error) {
        console.error(error);
        alert('Error: ' + error.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}


// ==================== ANALYTICS LOGIC (TODO EN UNO) ====================

let charts = {}; // Referencias a los gráficos para poder actualizarlos

// ------------------------------------------------------
// 1. DEFINICIÓN DE ESTILOS CSS (Inyectados dinámicamente)
// ------------------------------------------------------
const analyticsStyles = `
    /* Contenedor Principal */
    .analytics-container { 
        padding: 2rem; 
        background-color: #F3F7FF; 
        height: 100%; 
        overflow-y: auto; 
        font-family: 'Inter', sans-serif; 
    }
    
    /* Cabecera */
    .analytics-header { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        margin-bottom: 2rem; 
    }
    .analytics-header h2 { 
        font-size: 1.75rem; 
        color: #1f2937; 
        font-weight: 700; 
        margin: 0; 
    }

    /* Tarjetas KPI */
    .kpi-row { 
        display: grid; 
        grid-template-columns: repeat(4, 1fr); 
        gap: 1.5rem; 
        margin-bottom: 2rem; 
    }
    .kpi-card { 
        background: white; 
        padding: 1.5rem; 
        border-radius: 12px; 
        border: 1px solid #E1E8F5; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.03); 
        border-left: 5px solid #1A73E8; 
        display: flex; 
        flex-direction: column; 
        transition: transform 0.2s;
    }
    .kpi-card:hover { transform: translateY(-3px); }
    .kpi-card.success { border-left-color: #10b981; }
    .kpi-card.warning { border-left-color: #f59e0b; }
    .kpi-card.purple { border-left-color: #8b5cf6; }
    
    .kpi-title { font-size: 0.85rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 2rem; font-weight: 800; color: #1f2937; margin: 0.5rem 0; }
    .kpi-sub { font-size: 0.85rem; color: #9ca3af; }

    /* Gráficos */
    .analytics-grid { 
        display: grid; 
        grid-template-columns: repeat(2, 1fr); 
        gap: 2rem; 
        margin-bottom: 2rem;
    }
    .chart-card { 
        background: white; 
        padding: 1.5rem; 
        border-radius: 12px; 
        border: 1px solid #E1E8F5; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.03); 
        height: 420px; 
        display: flex; 
        flex-direction: column; 
    }
    .chart-card h3 { margin: 0 0 1.5rem 0; color: #374151; font-size: 1.1rem; font-weight: 600; }
    .chart-wrapper { flex: 1; position: relative; width: 100%; min-height: 0; }

    /* Estado Vacío */
    .empty-state-analytics { display: flex; justify-content: center; align-items: center; height: 100%; }
    .empty-box { text-align: center; padding: 3rem; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }

    /* Responsive */
    @media (max-width: 1100px) { 
        .kpi-row { grid-template-columns: 1fr 1fr; } 
        .analytics-grid { grid-template-columns: 1fr; } 
    }
    @media (max-width: 600px) { 
        .kpi-row { grid-template-columns: 1fr; } 
        .analytics-container { padding: 1rem; }
    }
`;

function injectAnalyticsStyles() {
    if (!document.getElementById('analytics-dynamic-css')) {
        const styleSheet = document.createElement("style");
        styleSheet.id = 'analytics-dynamic-css';
        styleSheet.innerText = analyticsStyles;
        document.head.appendChild(styleSheet);
    }
}

// ------------------------------------------------------
// 2. FUNCIÓN EXCEL (ESTO ES LO QUE TE FALTABA)
// ------------------------------------------------------
function exportToExcel() {
    if (!containers || containers.length === 0) {
        alert("⚠️ No hay datos para exportar.");
        return;
    }

    const rows = [];
    containers.forEach(container => {
        const productsSummary = {};
        container.products.forEach(p => {
            const id = p.id || 'N/A';
            if (!productsSummary[id]) {
                productsSummary[id] = { ...p, count: 0, totalWeight: 0, totalVol: 0 };
            }
            productsSummary[id].count += 1;
            productsSummary[id].totalWeight += (p.peso || 0);
            productsSummary[id].totalVol += (p.volumen || 0);
        });

        Object.values(productsSummary).forEach(p => {
            rows.push({
                "Contenedor": container.id,
                "Tipo": container.type,
                "Destino": container.destination,
                "ID Prod": p.id,
                "Producto": p.nombre || p.name,
                "Grupo": p.tipo_mercancia || p.type,
                "Cantidad": p.count,
                "Peso Total (kg)": p.totalWeight.toFixed(2),
                "Volumen Total (m³)": p.totalVol.toFixed(2),
                "Rotado": p.rotado ? "SI" : "NO"
            });
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const wscols = [{ wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Packing List");
    XLSX.writeFile(workbook, `Packing_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ------------------------------------------------------
// 3. FUNCIÓN PRINCIPAL: MOSTRAR ANÁLISIS
// ------------------------------------------------------
function showAnalytics() {
    currentSection = 'analytics';
    injectAnalyticsStyles();

    if (!containers || containers.length === 0) {
        mainContainer.innerHTML = `
            <div style="grid-column: 1 / -1;" class="analytics-container">
                <div class="empty-state-analytics">
                    <div class="empty-box">
                        <div style="margin: 0 auto 1.5rem; width: 60px; height: 60px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" width="30" height="30"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <h2 style="font-size: 1.5rem; color: #374151; margin-bottom: 1rem;">Sin datos</h2>
                        <button onclick="document.querySelector('[data-section=dashboard]').click()" class="btn-primary">Ir al Dashboard</button>
                    </div>
                </div>
            </div>`;
        return;
    }

    // Cálculos
    const totalVolume = containers.reduce((acc, c) => acc + parseFloat(c.space), 0).toFixed(2);
    const avgOccupancy = (containers.reduce((acc, c) => acc + c.raw_occupancy, 0) / containers.length).toFixed(1);
    const totalBoxes = containers.reduce((acc, c) => acc + c.boxes, 0);
    let rotatedCount = 0;
    let typeDistribution = {};

    containers.forEach(c => {
        c.products.forEach(p => {
            if (p.rotado) rotatedCount++;
            const type = p.tipo_mercancia || p.type || 'General';
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        });
    });

    // HTML ACTUALIZADO: El botón ahora llama a exportToExcel()
    mainContainer.innerHTML = `
        <div style="grid-column: 1 / -1;" class="analytics-container">
            <div class="analytics-header">
                <h2>Tablero de Eficiencia</h2>
    <div style="display: flex; gap: 10px;">
        <button class="btn-primary" onclick="exportToExcel()" style="background: #10b981; border:none; display: flex; align-items: center; gap: 0.5rem;">
            📄 Descargar Excel
        </button>
    
    </div>
            </div>

            <div class="kpi-row">
                <div class="kpi-card">
                    <div class="kpi-title">Volumen Total</div>
                    <div class="kpi-value">${totalVolume} <span style="font-size:1.2rem">m³</span></div>
                    <div class="kpi-sub">En ${containers.length} contenedores</div>
                </div>
                <div class="kpi-card success">
                    <div class="kpi-title">Eficiencia Media</div>
                    <div class="kpi-value">${avgOccupancy}<span style="font-size:1.2rem">%</span></div>
                    <div class="kpi-sub">Ocupación de espacio</div>
                </div>
                <div class="kpi-card purple">
                    <div class="kpi-title">Unidades</div>
                    <div class="kpi-value">${totalBoxes}</div>
                    <div class="kpi-sub">Cajas despachadas</div>
                </div>
                <div class="kpi-card warning">
                    <div class="kpi-title">Rotaciones</div>
                    <div class="kpi-value">${rotatedCount}</div>
                    <div class="kpi-sub">Optimizadas por giro</div>
                </div>
            </div>

            <div class="analytics-grid">
                <div class="chart-card">
                    <h3>Distribución por Tipo</h3>
                    <div class="chart-wrapper"><canvas id="chartTypes"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3>Ocupación por Contenedor</h3>
                    <div class="chart-wrapper"><canvas id="chartOccupancy"></canvas></div>
                </div>
            </div>
        </div>
    `;

    renderCharts(typeDistribution, containers);
}

function renderCharts(typeData, containersData) {
    // Dona
    const ctxTypes = document.getElementById('chartTypes').getContext('2d');
    const labels = Object.keys(typeData);
    const dataValues = Object.values(typeData);
    const bgColors = labels.map(l => (PRODUCT_COLORS[l] ? '#' + PRODUCT_COLORS[l].toString(16) : '#3b82f6'));

    if (charts.types) charts.types.destroy();
    charts.types = new Chart(ctxTypes, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    // Barras
    const ctxOcc = document.getElementById('chartOccupancy').getContext('2d');
    const occValues = containersData.map(c => c.raw_occupancy);

    if (charts.occupancy) charts.occupancy.destroy();
    charts.occupancy = new Chart(ctxOcc, {
        type: 'bar',
        data: {
            labels: containersData.map(c => c.id),
            datasets: [{
                label: '%',
                data: occValues,
                backgroundColor: occValues.map(v => v > 90 ? '#10b981' : (v > 75 ? '#3b82f6' : '#f59e0b')),
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
    });
}

function exportToExcel() {
    if (!containers || containers.length === 0) {
        alert("⚠️ No hay datos para exportar.");
        return;
    }

    const rows = [];
    containers.forEach(container => {
        const productsSummary = {};

        // Agrupar productos
        container.products.forEach(p => {
            const id = p.id || 'N/A';
            if (!productsSummary[id]) {
                productsSummary[id] = { ...p, count: 0, totalWeight: 0, totalVol: 0 };
            }
            productsSummary[id].count += 1;
            productsSummary[id].totalWeight += (p.peso || 0);
            productsSummary[id].totalVol += (p.volumen || 0);
        });

        // Crear filas
        Object.values(productsSummary).forEach(p => {
            rows.push({
                "Contenedor": container.id,
                "Destino": container.destination,
                "Producto": p.nombre || p.name,
                "Tipo": p.tipo_mercancia || p.type,
                "Cantidad": p.count,
                "Peso Total (kg)": p.totalWeight.toFixed(2),
                "Volumen Total (m³)": p.totalVol.toFixed(2),
                "Rotado": p.rotado ? "SI" : "NO"
            });
        });
    });

    // Crear y descargar
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Packing List");
    XLSX.writeFile(workbook, `Packing_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ==================== DASHBOARD & PAGINATION ====================
function loadContainers(containerList) {
    containers = containerList;
    renderContainers();
    updateGlobalSummary();
}

function renderContainers() {
    // BUSCAMOS LOS ELEMENTOS FRESCOS EN EL DOM
    const containerSelector = document.getElementById('containerSelector');
    const emptyContainers = document.getElementById('emptyContainers');
    const paginationControls = document.getElementById('paginationControls');

    // Si por alguna razón el HTML aún no está listo, salimos para no dar error
    if (!containerSelector) return;

    containerSelector.innerHTML = '';

    if (containers.length === 0) {
        if (emptyContainers) emptyContainers.style.display = 'block';
        if (paginationControls) paginationControls.style.display = 'none';
        return;
    }

    if (emptyContainers) emptyContainers.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'flex';

    // Lógica de paginación
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = containers.slice(start, end);
    const totalPages = Math.ceil(containers.length / itemsPerPage);

    // Actualizar indicador de página
    const ind = document.getElementById('pageIndicator');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');

    if (ind) ind.textContent = `${currentPage} / ${totalPages}`;
    if (btnPrev) btnPrev.disabled = (currentPage === 1);
    if (btnNext) btnNext.disabled = (currentPage === totalPages);

    // Crear los botones de la lista
    pageItems.forEach(container => {
        const div = document.createElement('div');
        div.className = 'container-item';
        if (selectedContainer === container.id) div.classList.add('selected');
        div.dataset.container = container.id;

        // Pintar cuadritos de colores
        const previewColors = container.products.slice(0, 4).map(p => {
            const typeKey = p.tipo_mercancia || p.type;
            const colorHex = (PRODUCT_COLORS[typeKey] || PRODUCT_COLORS['DEFAULT']).toString(16);
            return `<span style="width:8px;height:8px;border-radius:2px;background-color:#${colorHex};display:inline-block;margin-right:2px;"></span>`;
        }).join('');

        div.innerHTML = `
            <div>
                <div class="container-info-main">Contenedor ${container.id}</div>
                <div class="container-info-sub">${container.type} ${previewColors}</div>
            </div>
            <div style="text-align:right">
                <div class="container-info-main">${container.occupancy}</div>
                <div class="container-info-sub">${container.boxes} cajas</div>
            </div>
        `;
        div.addEventListener('click', () => selectContainer(container.id));
        containerSelector.appendChild(div);
    });
}

function changePage(delta) {
    const totalPages = Math.ceil(containers.length / itemsPerPage);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderContainers();
    }
}

function selectContainer(containerId) {
    selectedContainer = containerId;

    // Resaltar el seleccionado en la lista
    const allItems = document.querySelectorAll('.container-item');
    allItems.forEach(btn => btn.classList.remove('selected'));

    const selectedBtn = document.querySelector(`[data-container="${containerId}"]`);
    if (selectedBtn) selectedBtn.classList.add('selected');

    // Mostrar/Ocultar paneles de detalles
    const emptyDetails = document.getElementById('emptyDetails');
    const detailsContent = document.getElementById('detailsContent');

    if (emptyDetails) emptyDetails.style.display = 'none';
    if (detailsContent) detailsContent.style.display = 'block';

    // Llenar los textos y dibujar el 3D
    updateContainerDetails(containerId);
}

function updateContainerDetails(containerId) {
    const container = containers.find(c => c.id === containerId);
    if (container) {
        setText('containerType', container.type);

        // CORRECCIÓN: Usamos p.nombre || p.name
        const names = container.products.map(p => p.nombre || p.name).join(', ');
        const displayText = names.length > 80 ? names.substring(0, 80) + "..." : names;

        setText('containerProducts', displayText);
        setText('containerDest', container.destination);
        setText('containerOccupancy', container.occupancy);
        setText('containerSpace', container.space);

        // Renderizar 3D con coordenadas reales
        update3DView(container);
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '--';
}

function updateGlobalSummary() {
    const elContainers = document.getElementById('globalContainers');
    const elVolume = document.getElementById('globalVolume');

    if (elContainers) elContainers.textContent = containers.length;

    if (elVolume) {
        const totalSpace = containers.reduce((sum, c) => sum + parseFloat(c.space), 0);
        elVolume.textContent = totalSpace.toFixed(2) + ' m³';
    }
}

// ==================== VISOR 3D (Three.js) ====================
function init3DViewer() {
    const container = document.getElementById('viewer3D');
    if (!container) return;
    const width = container.clientWidth || 600;
    const height = 400;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    // Cámara Isométrica
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(20, 15, 20);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
    }

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xeef2ff, 0.5);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    animate();
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    const container = document.getElementById('viewer3D');
    if (container && camera && renderer) {
        const width = container.clientWidth;
        const height = container.clientHeight || 400;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// ==================== RENDERING DE ESTIBA (COORDINATE BASED) ====================
function update3DView(containerData) {
    if (!scene) return;
    if (cubeGroup) scene.remove(cubeGroup);

    cubeGroup = new THREE.Group();

    // 1. Dimensiones (Sincronizadas con Python)
    const contL = 12.0;
    const contH = 2.68;
    const contW = 2.35;

    // 2. Dibujar Marco (Wireframe)
    const boxGeo = new THREE.BoxGeometry(contL, contH, contW);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    cubeGroup.add(wireframe);

    // Piso
    const floorGeo = new THREE.PlaneGeometry(contL, contW);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = -contH / 2 + 0.01;
    cubeGroup.add(floor);

    // 3. DIBUJAR PRODUCTOS (Usando coordenadas XYZ del Backend)
    const offsetX = -contL / 2;
    const offsetY = -contH / 2;
    const offsetZ = -contW / 2;

    containerData.products.forEach((prod, index) => {
        if (!prod.position) return;

        const { x, y, z } = prod.position;

        // CORRECCIÓN: Aseguramos leer 'largo', 'ancho', 'alto'
        const l = prod.largo || 1.0;
        const h = prod.alto || 1.0;
        const w = prod.ancho || 1.0;

        // CORRECCIÓN: Color basado en 'tipo_mercancia'
        const typeKey = prod.tipo_mercancia || prod.type;
        const colorHex = PRODUCT_COLORS[typeKey] || PRODUCT_COLORS['DEFAULT'];

        const boxGeometry = new THREE.BoxGeometry(l - 0.05, h - 0.05, w - 0.05);
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.5,
            metalness: 0.1
        });

        const mesh = new THREE.Mesh(boxGeometry, boxMaterial);

        mesh.position.set(
            x + (l / 2) + offsetX,
            y + (h / 2) + offsetY,
            z + (w / 2) + offsetZ
        );

        // Bordes
        const bEdges = new THREE.EdgesGeometry(boxGeometry);
        const bLine = new THREE.LineSegments(bEdges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.25, transparent: true }));
        mesh.add(bLine);

        // ANIMACIÓN SIMPLE: Aparecer con delay
        mesh.scale.set(0, 0, 0);
        setTimeout(() => {
            // Animación manual simple
            let s = 0;
            const grow = setInterval(() => {
                s += 0.1;
                if (s >= 1) {
                    s = 1;
                    clearInterval(grow);
                }
                mesh.scale.set(s, s, s);
            }, 16);
        }, index * 20); // Delay de 20ms entre cada caja

        cubeGroup.add(mesh);
    });

    scene.add(cubeGroup);
}

// ==================== CONFIG & HISTORY ====================
function showConfiguration() {
    currentSection = 'config';
    mainContainer.innerHTML = getConfigHTML();
}

function showDashboard() {
    currentSection = 'dashboard';

    // 1. Restaurar el esqueleto HTML (La variable dashboardHTML que definimos antes)
    mainContainer.innerHTML = dashboardHTML;

    // 2. Reiniciar el motor 3D (necesario porque el div se creó de nuevo)
    init3DViewer();

    // 3. ¿Tenemos datos en memoria? ¡Píntalos de nuevo!
    if (containers && containers.length > 0) {
        // Ocultamos el mensaje de bienvenida
        const placeholder = document.getElementById('viewerPlaceholder');
        const viewer = document.getElementById('viewer3D');
        if (placeholder) placeholder.style.display = 'none';
        if (viewer) viewer.style.display = 'block';

        // ¡AQUÍ ESTÁ LA CLAVE! Volvemos a llenar la lista con los datos guardados
        loadContainers(containers);

        // Volvemos a seleccionar el contenedor que estabas viendo
        const idToSelect = selectedContainer || containers[0].id;

        // Un pequeño respiro de 50ms para asegurar que el HTML ya existe
        setTimeout(() => {
            selectContainer(idToSelect);
            onWindowResize(); // Ajustar cámara 3D
        }, 50);
    }
}

function showHistory() {
    currentSection = 'history';
    mainContainer.innerHTML = getHistoryHTML();
}
function getConfigHTML() {
    return `<div style="grid-column:1/-1"><div class="card"><h2 class="card-title">Configuración</h2><div style="padding:20px;background:#f9fafb;border-radius:8px"><pre>${JSON.stringify(filters, null, 2)}</pre></div><div style="margin-top:20px;text-align:right"><button onclick="showDashboard()" class="btn-secondary">Volver</button></div></div></div>`;
}
function getHistoryHTML() {
    const rows = processingHistory.map(i => `<tr><td>#${i.id}</td><td>${i.date}</td><td>${i.containers}</td><td>${i.boxes}</td><td>${i.status}</td></tr>`).join('');
    return `<div style="grid-column:1/-1"><div class="card"><h2 class="card-title">Historial</h2><table class="history-table"><thead><tr><th>ID</th><th>Fecha</th><th>Contenedores</th><th>Cajas</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table><button onclick="showDashboard()" class="btn-secondary" style="margin-top:20px">Volver</button></div></div>`;
}

// ==================== INTERACCIÓN (RAYCASTER) ====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const viewerContainer = document.getElementById('viewer3D');
let hoveredObj = null;

viewerContainer.addEventListener('mousemove', (event) => {
    // Calcular posición del mouse normalizada (-1 a +1)
    const rect = viewerContainer.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Buscar intersecciones solo con las cajas (cubeGroup.children)
    // Nota: cubeGroup.children incluye las mallas y los wireframes. 
    // Filtramos solo las mallas (Mesh)
    const intersects = raycaster.intersectObjects(cubeGroup.children.filter(o => o.isMesh), false);

    if (intersects.length > 0) {
        // Encontramos una caja
        document.body.style.cursor = 'pointer';
        const obj = intersects[0].object;

        if (hoveredObj !== obj) {
            // Restaurar el anterior
            if (hoveredObj) hoveredObj.material.emissive.setHex(0x000000);

            // Iluminar el nuevo
            hoveredObj = obj;
            hoveredObj.material.emissive.setHex(0x333333); // Brillo suave al pasar mouse
        }
    } else {
        document.body.style.cursor = 'default';
        if (hoveredObj) {
            hoveredObj.material.emissive.setHex(0x000000);
            hoveredObj = null;
        }
    }
});
