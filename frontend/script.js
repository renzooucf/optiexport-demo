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

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-menu li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const section = item.dataset.section;
            if (section === 'dashboard') showDashboard();
            else if (section === 'history') showHistory();
            else if (section === 'config') showConfiguration();
        });
    });
}

// ==================== API & PROCESSING LOGIC ====================
async function processData() {
    if (!confirm('¿Iniciar Simulación de Carga Mixta?')) return;

    const btn = document.querySelector('.process-btn');
    const originalText = btn ? btn.innerHTML : 'Procesar';
    if (btn) {
        btn.innerHTML = 'Calculando estiba...';
        btn.disabled = true;
    }

    try {
        const response = await fetch('http://localhost:8000/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_ids: SAMPLE_ORDER, preferences: filters })
        });

        if (!response.ok) throw new Error("Error conectando al servidor Python");

        const apiData = await response.json();

        const mappedContainers = apiData.map((c, index) => {
            const parts = c.container_type.split(' - ');
            const type = parts[0] || "Estándar";
            let dest = "Varios";
            if (c.container_type.includes('->')) {
                dest = c.container_type.split('->')[1].trim();
            }

            return {
                id: `C${index + 1000}`,
                type: type,
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

// ==================== DASHBOARD & PAGINATION ====================
function loadContainers(containerList) {
    containers = containerList;
    renderContainers();
    updateGlobalSummary();
}

function renderContainers() {
    containerSelector.innerHTML = '';
    if (containers.length === 0) {
        emptyContainers.style.display = 'block';
        if (paginationControls) paginationControls.style.display = 'none';
        return;
    }
    emptyContainers.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'flex';

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = containers.slice(start, end);
    const totalPages = Math.ceil(containers.length / itemsPerPage);

    const ind = document.getElementById('pageIndicator');
    if (ind) ind.textContent = `${currentPage} / ${totalPages}`;

    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    if (btnPrev) btnPrev.disabled = (currentPage === 1);
    if (btnNext) btnNext.disabled = (currentPage === totalPages);

    pageItems.forEach(container => {
        const div = document.createElement('div');
        div.className = 'container-item';
        if (selectedContainer === container.id) div.classList.add('selected');
        div.dataset.container = container.id;

        // Preview colores
        const previewColors = container.products.slice(0, 4).map(p => {
            const colorHex = (PRODUCT_COLORS[p.type] || PRODUCT_COLORS['DEFAULT']).toString(16);
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
    const allItems = document.querySelectorAll('.container-item');
    allItems.forEach(btn => btn.classList.remove('selected'));
    const selectedBtn = document.querySelector(`[data-container="${containerId}"]`);
    if (selectedBtn) selectedBtn.classList.add('selected');

    emptyDetails.style.display = 'none';
    detailsContent.style.display = 'block';
    updateContainerDetails(containerId);
}

function updateContainerDetails(containerId) {
    const container = containers.find(c => c.id === containerId);
    if (container) {
        setText('containerType', container.type);
        const names = container.products.map(p => p.name).join(', ');
        const displayText = names.length > 80 ? names.substring(0, 80) + "..." : names;
        setText('containerProducts', displayText);
        setText('containerDest', container.destination);
        setText('containerOccupancy', container.occupancy);
        setText('containerSpace', container.space);

        // 3D Stacking
        update3DView(container);
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '--';
}

function updateGlobalSummary() {
    setText('globalContainers', containers.length);
    const totalSpace = containers.reduce((sum, c) => sum + parseFloat(c.space), 0);
    setText('globalVolume', totalSpace.toFixed(2) + ' m³');
}

// ==================== VISOR 3D AVANZADO (STACKING) ====================
function init3DViewer() {
    const container = document.getElementById('viewer3D');
    if (!container) return;
    const width = container.clientWidth || 600;
    const height = 400;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    // Vista Isométrica mejorada
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
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

// --- LOGICA DE ESTIBA VISUAL (Stacking Algorithm) ---
function update3DView(containerData) {
    if (!scene) return;
    if (cubeGroup) scene.remove(cubeGroup);

    cubeGroup = new THREE.Group();

    // 1. Dimensiones Reales del Contenedor
    const is20ft = containerData.type && containerData.type.includes('20ft');
    const contL = is20ft ? 6.0 : 12.0; // 6m o 12m
    const contH = 2.6; // Alto High Cube
    const contW = 2.4; // Ancho estándar

    // 2. Dibujar Marco
    const isReefer = containerData.type && containerData.type.includes('Refrigerado');
    const frameColor = isReefer ? 0x10b981 : 0x3b82f6;

    const boxGeo = new THREE.BoxGeometry(contL, contH, contW);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    cubeGroup.add(wireframe);

    // Piso Sólido
    const floorGeo = new THREE.PlaneGeometry(contL, contW);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = -contH / 2 + 0.01;
    cubeGroup.add(floor);

    // 3. ALGORITMO VISUAL DE APILADO
    // Coordenadas iniciales (Esquina inferior trasera izquierda)
    let startX = -contL / 2;
    let startY = -contH / 2;
    let startZ = -contW / 2;

    let cursorX = startX;
    let cursorY = startY;
    let cursorZ = startZ;

    let maxRowHeight = 0;
    let maxLayerDepth = 0;

    containerData.products.forEach(prod => {
        const l = prod.dim_l || 1.0;
        const h = prod.dim_h || 1.0;
        const w = prod.dim_w || 1.0;

        // Intento de colocar en fila X
        if (cursorX + l > contL / 2) {
            // Fila llena, saltar en Z (Profundidad)
            cursorX = startX;
            cursorZ += maxLayerDepth;
            maxLayerDepth = 0; // Reset profundidad para nueva fila
        }

        // Intento de colocar en piso Z
        if (cursorZ + w > contW / 2) {
            // Piso lleno, subir nivel Y
            cursorZ = startZ;
            cursorX = startX;
            cursorY += maxRowHeight;
            maxRowHeight = 0; // Reset altura para nuevo piso
        }

        // Verificar TECHO
        if (cursorY + h > contH / 2) {
            // Si choca con el techo, NO DIBUJAR (Evita desbordamiento visual feo)
            return;
        }

        // --- DIBUJAR ---
        const boxGeo = new THREE.BoxGeometry(l - 0.05, h - 0.05, w - 0.05);
        const colorHex = PRODUCT_COLORS[prod.type] || PRODUCT_COLORS['DEFAULT'];

        const boxMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.6,
            metalness: 0.1
        });
        const boxMesh = new THREE.Mesh(boxGeo, boxMat);

        boxMesh.position.set(
            cursorX + l / 2,
            cursorY + h / 2,
            cursorZ + w / 2
        );

        const bEdges = new THREE.EdgesGeometry(boxGeo);
        const bLine = new THREE.LineSegments(bEdges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true }));
        boxMesh.add(bLine);

        cubeGroup.add(boxMesh);

        // Avanzar cursores
        cursorX += l;

        // Actualizar máximos de esta fila/capa
        if (h > maxRowHeight) maxRowHeight = h;
        if (w > maxLayerDepth) maxLayerDepth = w;
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
    location.reload();
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