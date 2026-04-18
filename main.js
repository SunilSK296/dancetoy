/**
 * VIBRASIM PRO - CORE ARCHITECTURE
 * Engineering Digital Twin for Damped Harmonic Oscillators
 */

// --- CONFIGURATION & STATE ---
const state = {
    m: 0.5,
    k: 200,
    zeta: 0.1,
    w: 10,
    f0: 10,
    t: 0,
    x: 0,
    v: 0,
    history: [],
    maxHistory: 200,
    fn: 0,
    X_amp: 0
};

// --- PHYSICS ENGINE ---
const updatePhysics = (dt) => {
    // Analytical Solutions for Metrics
    const wn = Math.sqrt(state.k / state.m);
    state.fn = wn / (2 * Math.PI);
    
    // Forced Vibration Amplitude: X = F0 / sqrt((k - mw^2)^2 + (cw)^2)
    const c = state.zeta * (2 * Math.sqrt(state.m * state.k));
    const denom = Math.sqrt(Math.pow(state.k - state.m * Math.pow(state.w, 2), 2) + Math.pow(c * state.w, 2));
    state.X_amp = state.f0 / denom;

    // Numerical Integration (RK4) for Real-time Motion
    const accel = (t, x, v) => {
        const force = state.f0 * Math.sin(state.w * t);
        return (force - c * v - state.k * x) / state.m;
    };

    const k1x = state.v;
    const k1v = accel(state.t, state.x, state.v);

    const k2x = state.v + 0.5 * dt * k1v;
    const k2v = accel(state.t + 0.5 * dt, state.x + 0.5 * dt * k1x, state.v + 0.5 * dt * k1v);

    const k3x = state.v + 0.5 * dt * k2v;
    const k3v = accel(state.t + 0.5 * dt, state.x + 0.5 * dt * k2x, state.v + 0.5 * dt * k2v);

    const k4x = state.v + dt * k3v;
    const k4v = accel(state.t + dt, state.x + dt * k3x, state.v + dt * k3v);

    state.x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    state.v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    state.t += dt;

    state.history.push(state.x);
    if (state.history.length > state.maxHistory) state.history.shift();
};

// --- THREE.JS VISUALIZER ---
let scene, camera, renderer, spring, head, platform;
const init3D = () => {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const spot = new THREE.SpotLight(0x00f2ff, 1);
    spot.position.set(10, 20, 10);
    spot.castShadow = true;
    scene.add(spot);

    // Platform
    const platGeo = new THREE.BoxGeometry(6, 0.5, 6);
    const platMat = new THREE.MeshPhongMaterial({ color: 0x151921 });
    platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = -4;
    platform.receiveShadow = true;
    scene.add(platform);

    // Toy Head
    const headGeo = new THREE.SphereGeometry(1, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({ 
        color: 0x00f2ff, 
        metalness: 0.8, 
        roughness: 0.2,
        emissive: 0x00f2ff,
        emissiveIntensity: 0.2
    });
    head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = true;
    scene.add(head);

    // Spring (Helix)
    updateSpring(4); // Initial

    camera.position.set(12, 5, 12);
    camera.lookAt(0, 0, 0);
};

const updateSpring = (height) => {
    if (spring) scene.remove(spring);
    
    const points = [];
    const coils = 12;
    const radius = 0.5;
    for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const angle = t * Math.PI * 2 * coils;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (t * height) - 4;
        points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 100, 0.05, 8, false);
    const material = new THREE.MeshPhongMaterial({ color: 0x444b59 });
    spring = new THREE.Mesh(geometry, material);
    scene.add(spring);
    head.position.y = height - 4;
};

// --- CHARTS ---
let timeChart, freqChart;
const initCharts = () => {
    const timeCtx = document.getElementById('timeChart').getContext('2d');
    timeChart = new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: Array(state.maxHistory).fill(''),
            datasets: [{
                label: 'Displacement (m)',
                data: [],
                borderColor: '#00f2ff',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(0, 242, 255, 0.05)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { min: -1, max: 1, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } },
                x: { display: false }
            },
            plugins: { legend: { display: false } }
        }
    });

    const freqCtx = document.getElementById('freqChart').getContext('2d');
    freqChart = new Chart(freqCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Amplitude Response',
                data: [],
                borderColor: '#666',
                borderWidth: 1,
                pointRadius: 0,
                tension: 0.4
            }, {
                label: 'Operating Point',
                data: [],
                borderColor: '#00f2ff',
                pointBackgroundColor: '#00f2ff',
                pointRadius: 5,
                showLine: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } },
                x: { title: { display: true, text: 'ω (rad/s)', color: '#666' }, ticks: { color: '#666' } }
            },
            plugins: { legend: { display: false } }
        }
    });
};

const updateFreqChart = () => {
    const labels = [];
    const data = [];
    const wn = Math.sqrt(state.k / state.m);
    const c = state.zeta * (2 * Math.sqrt(state.m * state.k));
    
    for (let w = 1; w < 60; w += 1) {
        labels.push(w);
        const denom = Math.sqrt(Math.pow(state.k - state.m * Math.pow(w, 2), 2) + Math.pow(c * w, 2));
        data.push(state.f0 / denom);
    }
    
    freqChart.data.labels = labels;
    freqChart.data.datasets[0].data = data;
    freqChart.data.datasets[1].data = labels.map(l => l === Math.round(state.w) ? state.X_amp : null);
    freqChart.update('none');
};

// --- INTERACTIVITY ---
const bindInputs = () => {
    const inputs = [
        { id: 'input-mass', key: 'm', label: 'val-mass', unit: 'kg' },
        { id: 'input-stiffness', key: 'k', label: 'val-stiffness', unit: 'N/m' },
        { id: 'input-damping', key: 'zeta', label: 'val-damping', unit: '' },
        { id: 'input-freq', key: 'w', label: 'val-freq', unit: 'rad/s' },
        { id: 'input-force', key: 'f0', label: 'val-force', unit: 'N' }
    ];

    inputs.forEach(input => {
        const el = document.getElementById(input.id);
        el.addEventListener('input', (e) => {
            state[input.key] = parseFloat(e.target.value);
            document.getElementById(input.label).innerText = `${state[input.key]}${input.unit}`;
            updateFreqChart();
        });
    });
};

const resetSystem = () => {
    state.x = 0;
    state.v = 0;
    state.t = 0;
    state.history = [];
    gsap.from(".glass", { opacity: 0, y: 20, stagger: 0.1 });
};

// --- MAIN LOOP ---
const loop = () => {
    updatePhysics(0.016); // 60fps approx
    
    // Update Visuals
    const dynamicHeight = 4 + (state.x * 5); // Scale for visibility
    updateSpring(dynamicHeight);

    // Update UI Metrics
    document.getElementById('metric-fn').innerText = `${state.fn.toFixed(2)} Hz`;
    document.getElementById('metric-amp').innerText = `${state.X_amp.toFixed(4)} m`;

    // Resonance Check
    const r = state.w / (Math.sqrt(state.k / state.m));
    const isResonant = r > 0.9 && r < 1.1;
    const alert = document.getElementById('resonance-alert');
    const container = document.getElementById('canvas-container');
    
    if (isResonant) {
        alert.style.display = 'block';
        container.classList.add('resonance-glow', 'border-red-500');
        document.getElementById('status-stability').innerText = 'CRITICAL';
        document.getElementById('status-stability').className = 'text-xs font-bold text-red-500 uppercase';
    } else {
        alert.style.display = 'none';
        container.classList.remove('resonance-glow', 'border-red-500');
        document.getElementById('status-stability').innerText = 'NOMINAL';
        document.getElementById('status-stability').className = 'text-xs font-bold text-green-400 uppercase';
    }

    // Chart Updates
    timeChart.data.datasets[0].data = state.history;
    timeChart.options.scales.y.min = -Math.max(0.5, state.X_amp * 2);
    timeChart.options.scales.y.max = Math.max(0.5, state.X_amp * 2);
    timeChart.update('none');

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
};

// --- INIT ---
window.onload = () => {
    init3D();
    initCharts();
    bindInputs();
    updateFreqChart();
    loop();

    // Responsive Fix
    window.addEventListener('resize', () => {
        const container = document.getElementById('canvas-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
};
