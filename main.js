/**
 * VIBRASIM PRO - CYBERPHYSICAL ENGINE (ORBIT EDITION)
 * RK4 Integration + Three.js Organic Robot Modeling
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

// --- B. THREE.JS VISUALIZER ---
let scene, camera, renderer, spring, robot, robotHead, leftArmGroup, rightArmGroup, platform;
let isDragging = false, previousMousePosition = { x: 0, y: 0 };
let theta = 45, phi = 60, radius = 20; // Camera rotation state

const init3D = () => {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    updateCameraPosition();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Camera Controls (Mouse Drag Logic)
    container.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            theta -= (e.clientX - previousMousePosition.x) * 0.5;
            phi += (e.clientY - previousMousePosition.y) * 0.5;
            phi = Math.max(10, Math.min(85, phi)); // Limit vertical tilt
            updateCameraPosition();
        }
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('wheel', (e) => {
        radius += e.deltaY * 0.05;
        radius = Math.max(10, Math.min(50, radius));
        updateCameraPosition();
    });

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(10, 20, 10);
    light.castShadow = true;
    scene.add(light);

    // Robot Assembly
    robot = new THREE.Group();
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x444b59, metalness: 0.8, roughness: 0.2 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 2 });

    // 1. Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1.5, 4, 12), ironMat);
    torso.position.y = 1.5;
    torso.castShadow = true;
    robot.add(torso);

    // 2. Round Head
    robotHead = new THREE.Group();
    robotHead.position.y = 3.2;
    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), ironMat);
    robotHead.add(headSphere);

    // Glowing Eyes
    const eyeGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeL = new THREE.Mesh(eyeGeo, glowMat);
    eyeL.position.set(-0.35, 0.1, 0.75);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.35;
    robotHead.add(eyeL, eyeR);
    robot.add(robotHead);

    // 3. Realistic Arms
    const createArm = (side) => {
        const group = new THREE.Group();
        // Shoulder
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), ironMat);
        group.add(shoulder);
        // Upper Arm
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 1.2), ironMat);
        upper.position.y = -0.6;
        group.add(upper);
        // Forearm & Hand
        const lowerGroup = new THREE.Group();
        lowerGroup.position.y = -1.2;
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 1), ironMat);
        lower.position.y = -0.5;
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), ironMat);
        hand.position.y = -1.1;
        lowerGroup.add(lower, hand);
        group.add(lowerGroup);
        
        group.position.set(side * 1.3, 2.5, 0);
        return group;
    };

    leftArmGroup = createArm(-1);
    rightArmGroup = createArm(1);
    robot.add(leftArmGroup, rightArmGroup);

    scene.add(robot);

    // Platform & Spring
    const platGeo = new THREE.BoxGeometry(10, 0.5, 10);
    platform = new THREE.Mesh(platGeo, new THREE.MeshStandardMaterial({ color: 0x111111 }));
    platform.position.y = -5;
    platform.receiveShadow = true;
    scene.add(platform);
    
    updateSpring(5);
};

const updateCameraPosition = () => {
    const p = phi * (Math.PI / 180);
    const t = theta * (Math.PI / 180);
    camera.position.x = radius * Math.sin(p) * Math.cos(t);
    camera.position.y = radius * Math.cos(p);
    camera.position.z = radius * Math.sin(p) * Math.sin(t);
    camera.lookAt(0, 0, 0);
};

const updateSpring = (h) => {
    if (spring) scene.remove(spring);
    const pts = [];
    for (let i = 0; i <= 100; i++) {
        const r = i / 100;
        pts.push(new THREE.Vector3(Math.cos(r * Math.PI * 16) * 0.7, (r * h) - 5, Math.sin(r * Math.PI * 16) * 0.7));
    }
    spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.1, 8, false), new THREE.MeshStandardMaterial({ color: 0x777777 }));
    scene.add(spring);
    robot.position.y = h - 5;
};

// --- C. CHARTS & LOOP ---
let timeChart, freqChart;
const initCharts = () => {
    const commonOpts = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { color: '#222' } } } };
    timeChart = new Chart(document.getElementById('timeChart'), { type: 'line', data: { labels: Array(250).fill(''), datasets: [{ data: [], borderColor: '#00f2ff', fill: true, backgroundColor: 'rgba(0,242,255,0.1)', tension: 0.4, pointRadius: 0 }] }, options: commonOpts });
    freqChart = new Chart(document.getElementById('freqChart'), { type: 'line', data: { labels: [], datasets: [{ data: [], borderColor: '#444' }, { data: [], pointBackgroundColor: '#00f2ff', pointRadius: 5, showLine: false }] }, options: { ...commonOpts, scales: { x: { display: true } } } });
};

const updateFreqChart = () => {
    const labels = [], data = [];
    const wn = Math.sqrt(state.k / state.m);
    for (let w = 1; w < 70; w++) {
        labels.push(w);
        const c = state.zeta * (2 * Math.sqrt(state.m * state.k));
        data.push(state.f0 / Math.sqrt(Math.pow(state.k - state.m * w * w, 2) + Math.pow(c * w, 2)));
    }
    freqChart.data.labels = labels;
    freqChart.data.datasets[0].data = data;
    freqChart.data.datasets[1].data = labels.map(l => l === Math.round(state.w) ? state.X_amp : null);
    freqChart.update();
};

const loop = () => {
    updatePhysics(0.016);
    const h = 5 + (state.x * 6);
    updateSpring(h);

    // Animation Logic
    const osc = Math.sin(state.t * state.w - (state.phase * Math.PI / 180));
    robotHead.rotation.x = osc * (state.X_amp * 1.5);
    
    // Arm swing with momentum lag
    leftArmGroup.rotation.z = 0.2 + (osc * state.X_amp * 3);
    rightArmGroup.rotation.z = -0.2 - (osc * state.X_amp * 3);
    leftArmGroup.children[2].rotation.x = osc * state.X_amp * 5; // Forearm bobble
    rightArmGroup.children[2].rotation.x = osc * state.X_amp * 5;

    // UI Updates
    document.getElementById('metric-fn').innerText = `${state.fn.toFixed(2)} Hz`;
    document.getElementById('metric-amp').innerText = `${state.X_amp.toFixed(4)} m`;
    
    const r = state.w / Math.sqrt(state.k / state.m);
    document.getElementById('resonance-alert').style.display = (r > 0.9 && r < 1.1) ? 'block' : 'none';

    timeChart.data.datasets[0].data = state.history;
    timeChart.update();

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
};

window.onload = () => {
    init3D(); initCharts(); updateFreqChart(); loop();
    const ins = [['input-mass', 'm', 'val-mass', ' kg'], ['input-stiffness', 'k', 'val-stiffness', ' N/m'], ['input-damping', 'zeta', 'val-damping', ''], ['input-freq', 'w', 'val-freq', ' rad/s'], ['input-force', 'f0', 'val-force', ' N']];
    ins.forEach(i => document.getElementById(i[0]).addEventListener('input', (e) => {
        state[i[1]] = parseFloat(e.target.value);
        document.getElementById(i[2]).innerText = state[i[1]].toFixed(2) + i[3];
        updateFreqChart();
    }));
};
