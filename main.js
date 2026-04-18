/**
 * VIBRASIM PRO - CYBERPHYSICAL ENGINE
 * RK4 Integration + Three.js Procedural Rendering
 */

// --- GLOBAL STATE ---
const state = {
    m: 0.5, k: 200, zeta: 0.1, w: 10, f0: 10,
    t: 0, x: 0, v: 0,
    history: [], maxHistory: 250,
    fn: 0, X_amp: 0, phase: 0
};

// --- A. PHYSICS ENGINE (Runge-Kutta 4th Order) ---
const updatePhysics = (dt) => {
    const wn = Math.sqrt(state.k / state.m);
    state.fn = wn / (2 * Math.PI);
    
    const c = state.zeta * (2 * Math.sqrt(state.m * state.k));
    const denom = Math.sqrt(Math.pow(state.k - state.m * Math.pow(state.w, 2), 2) + Math.pow(c * state.w, 2));
    state.X_amp = state.f0 / denom;
    state.phase = Math.atan2(c * state.w, state.k - state.m * Math.pow(state.w, 2)) * (180 / Math.PI);

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

// --- B. THREE.JS VISUALIZER (Robot Construction) ---
let scene, camera, renderer, spring, robot, robotHead, platform;

const init3D = () => {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(14, 6, 14);
    camera.lookAt(0, 1, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(5, 15, 8);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.SpotLight(0x00f2ff, 0.6);
    rimLight.position.set(-10, 5, -10);
    scene.add(rimLight);

    // Platform
    const platGeo = new THREE.BoxGeometry(8, 0.6, 8);
    const platMat = new THREE.MeshPhongMaterial({ color: 0x11131a });
    platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = -5;
    platform.receiveShadow = true;
    scene.add(platform);

    // Robot Toy
    robot = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333a4d, metalness: 0.7, roughness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x00f2ff, metalness: 0.9, emissive: 0x00f2ff, emissiveIntensity: 0.3 });

    // Robot Body
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 2.5, 6), bodyMat);
    bodyMesh.position.y = 1.25;
    bodyMesh.castShadow = true;
    robot.add(bodyMesh);

    // Robot Head Assembly
    robotHead = new THREE.Group();
    robotHead.position.y = 2.5;
    const headMain = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), bodyMat);
    headMain.position.y = 1.0;
    headMain.castShadow = true;
    robotHead.add(headMain);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const eyeR = new THREE.Mesh(eyeGeo, new THREE.MeshStandardMaterial({color: 0x000000}));
    eyeR.position.set(0.4, 1.1, 0.82);
    robotHead.add(eyeR);
    const eyeL = eyeR.clone();
    eyeL.position.x = -0.4;
    robotHead.add(eyeL);

    robot.add(robotHead);
    scene.add(robot);
    updateSpring(5);
};

const updateSpring = (height) => {
    if (spring) scene.remove(spring);
    const points = [];
    const coils = 10;
    const radius = 0.6;
    for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const angle = t * Math.PI * 2 * coils;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, (t * height) - 5, Math.sin(angle) * radius));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    spring = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 0.08, 12, false), new THREE.MeshPhongMaterial({ color: 0x4a5161 }));
    spring.castShadow = true;
    scene.add(spring);
    robot.position.y = height - 5; 
};

// --- C. CHARTS ---
let timeChart, freqChart;
const initCharts = () => {
    const timeCtx = document.getElementById('timeChart').getContext('2d');
    timeChart = new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: Array(state.maxHistory).fill(''),
            datasets: [{
                label: 'Pos',
                data: [],
                borderColor: '#00f2ff',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(0, 242, 255, 0.03)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: { y: { min: -1, max: 1, grid: { color: 'rgba(255,255,255,0.02)' } }, x: { display: false } },
            plugins: { legend: { display: false } }
        }
    });

    const freqCtx = document.getElementById('freqChart').getContext('2d');
    freqChart = new Chart(freqCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{ label: 'Curve', data: [], borderColor: '#444', borderWidth: 1.5, pointRadius: 0, tension: 0.4 },
                       { label: 'Point', data: [], borderColor: '#00f2ff', pointBackgroundColor: '#00f2ff', pointRadius: 6, showLine: false }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.02)' } }, x: { grid: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });
};

const updateFreqChart = () => {
    const labels = [], data = [];
    const wn = Math.sqrt(state.k / state.m);
    const c = state.zeta * (2 * Math.sqrt(state.m * state.k));
    for (let w = 1; w < 70; w += 1) {
        labels.push(w);
        const denom = Math.sqrt(Math.pow(state.k - state.m * Math.pow(w, 2), 2) + Math.pow(c * w, 2));
        data.push(state.f0 / denom);
    }
    freqChart.data.labels = labels;
    freqChart.data.datasets[0].data = data;
    freqChart.data.datasets[1].data = labels.map(l => l === Math.round(state.w) ? state.X_amp : null);
    freqChart.update('none');
};

// --- D. ORCHESTRATION ---
const bindInputs = () => {
    const inputs = [{ id: 'input-mass', key: 'm', label: 'val-mass', unit: ' kg' },
                    { id: 'input-stiffness', key: 'k', label: 'val-stiffness', unit: ' N/m' },
                    { id: 'input-damping', key: 'zeta', label: 'val-damping', unit: '' },
                    { id: 'input-freq', key: 'w', label: 'val-freq', unit: ' rad/s' },
                    { id: 'input-force', key: 'f0', label: 'val-force', unit: ' N' }];
    inputs.forEach(input => {
        document.getElementById(input.id).addEventListener('input', (e) => {
            state[input.key] = parseFloat(e.target.value);
            document.getElementById(input.label).innerText = `${state[input.key].toFixed(input.key === 'zeta' ? 2 : 1)}${input.unit}`;
            updateFreqChart();
        });
    });
};

const resetSystem = () => {
    state.x = 0; state.v = 0; state.t = 0; state.history = [];
    gsap.from(".glass", { opacity: 0, y: 15, stagger: 0.05 });
};

const loop = () => {
    updatePhysics(0.016); 
    const dynamicHeight = 5 + (state.x * 6);
    updateSpring(dynamicHeight);

    const r = state.w / (Math.sqrt(state.k / state.m));
    const headLag = Math.sin(state.t * state.w - (state.phase * Math.PI / 180));
    robotHead.rotation.x = headLag * (state.X_amp * 1.5); 

    document.getElementById('metric-fn').innerText = `${state.fn.toFixed(2)} Hz`;
    document.getElementById('metric-amp').innerText = `${state.X_amp.toFixed(4)} m`;
    document.getElementById('status-phase').innerText = `${(-state.phase).toFixed(1)} °`;

    const isResonant = r > 0.88 && r < 1.12;
    document.getElementById('resonance-alert').style.display = isResonant ? 'block' : 'none';
    document.getElementById('canvas-container').className = isResonant ? 'flex-1 glass rounded-3xl relative overflow-hidden resonance-glow' : 'flex-1 glass rounded-3xl relative overflow-hidden border border-white/5';

    timeChart.data.datasets[0].data = state.history;
    timeChart.options.scales.y.min = -Math.max(0.2, state.X_amp * 2.2);
    timeChart.options.scales.y.max = Math.max(0.2, state.X_amp * 2.2);
    timeChart.update('none');

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
};

window.onload = () => {
    init3D(); initCharts(); bindInputs(); updateFreqChart();
    resetSystem(); loop();
    window.addEventListener('resize', () => {
        const container = document.getElementById('canvas-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
};
