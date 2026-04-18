/**
 * VIBRASIM PRO - FINAL STABLE BUILD
 * Robot Design + Responsive Analytics
 */

const state = {
    m: 0.5, k: 200, zeta: 0.1, w: 10, f0: 10,
    t: 0, x: 0, v: 0,
    history: [], maxHistory: 200,
    fn: 0, X_amp: 0, phase: 0
};

let scene, camera, renderer, spring, robot, robotHead, leftArmGroup, rightArmGroup;
let isDragging = false, theta = 45, phi = 60, radius = 18; 
let timeChart, freqChart;

// --- 1. 3D ROBOT CONSTRUCTION ---
const init3D = () => {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    updateCamera();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Sharp rendering on laptops
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Camera Interaction
    container.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            theta -= (e.movementX || 0) * 0.5;
            phi += (e.movementY || 0) * 0.5;
            phi = Math.max(10, Math.min(85, phi)); 
            updateCamera();
        }
    });
    container.addEventListener('wheel', (e) => {
        radius += e.deltaY * 0.02;
        radius = Math.max(10, Math.min(40, radius));
        updateCamera();
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    scene.add(sun);

    robot = new THREE.Group();
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x444b59, metalness: 0.8, roughness: 0.3 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 1.5 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 2.5, 16), ironMat);
    torso.position.y = 1.25;
    torso.castShadow = true;
    robot.add(torso);

    robotHead = new THREE.Group();
    robotHead.position.y = 2.5; 
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), ironMat);
    skull.position.y = 0.8;
    robotHead.add(skull);

    const eyeGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeL = new THREE.Mesh(eyeGeo, glowMat);
    eyeL.position.set(-0.35, 0.9, 0.75);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.35;
    robotHead.add(eyeL, eyeR);
    robot.add(robotHead);

    const createArm = (side) => {
        const group = new THREE.Group();
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), ironMat);
        const bicep = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2), ironMat);
        bicep.position.y = -0.6;
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), ironMat);
        hand.position.y = -1.3;
        group.add(shoulder, bicep, hand);
        group.position.set(side * 1.3, 2.2, 0);
        return group;
    };

    leftArmGroup = createArm(-1);
    rightArmGroup = createArm(1);
    robot.add(leftArmGroup, rightArmGroup);
    scene.add(robot);

    const plat = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    plat.position.y = -5;
    plat.receiveShadow = true;
    scene.add(plat);
    updateSpring(5);
};

const updateCamera = () => {
    const p = phi * (Math.PI / 180);
    const t = theta * (Math.PI / 180);
    camera.position.set(radius * Math.sin(p) * Math.cos(t), radius * Math.cos(p), radius * Math.sin(p) * Math.sin(t));
    camera.lookAt(0, 0, 0);
};

const updateSpring = (h) => {
    if (spring) scene.remove(spring);
    const pts = [];
    for (let i = 0; i <= 100; i++) {
        const r = i / 100;
        pts.push(new THREE.Vector3(Math.cos(r * Math.PI * 16) * 0.7, (r * h) - 5, Math.sin(r * Math.PI * 16) * 0.7));
    }
    spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.08, 8, false), new THREE.MeshStandardMaterial({ color: 0x777777 }));
    scene.add(spring);
    robot.position.y = h - 5;
};

// --- 2. ANALYTICS (Fixed for Laptop Display) ---
const initCharts = () => {
    const commonOpts = {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: window.devicePixelRatio,
        animation: false,
        plugins: { legend: { display: false } }
    };

    const timeCtx = document.getElementById('timeChart').getContext('2d');
    timeChart = new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: Array(state.maxHistory).fill(''),
            datasets: [{
                data: [],
                borderColor: '#00f2ff',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                backgroundColor: 'rgba(0, 242, 255, 0.03)'
            }]
        },
        options: {
            ...commonOpts,
            scales: { y: { min: -1, max: 1, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { display: false } }
        }
    });

    const freqCtx = document.getElementById('freqChart').getContext('2d');
    freqChart = new Chart(freqCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Curve', data: [], borderColor: '#444', borderWidth: 1.5, pointRadius: 0, tension: 0.4 },
                { label: 'Point', data: [], pointBackgroundColor: '#00f2ff', pointRadius: 6, showLine: false }
            ]
        },
        options: {
            ...commonOpts,
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
        }
    });

    // Force laptop layout recalculation
    setTimeout(() => { timeChart.resize(); freqChart.resize(); }, 200);
};

const updateFreqChart = () => {
    if (!freqChart) return;
    const labels = [], data = [];
    const wn = Math.sqrt(state.k / state.m);
    const c = state.zeta * (2 * Math.sqrt(state.m * state.k));
    for (let w = 1; w < 70; w += 1) {
        labels.push(w);
        const denom = Math.sqrt(Math.pow(state.k - state.m * w**2, 2) + Math.pow(c * w, 2));
        data.push(state.f0 / denom);
    }
    freqChart.data.labels = labels;
    freqChart.data.datasets[0].data = data;
    freqChart.data.datasets[1].data = labels.map(l => l === Math.round(state.w) ? state.X_amp : null);
    freqChart.update('none');
};

// --- 3. PHYSICS ENGINE & LOOP ---
const updatePhysics = (dt) => {
    const wn = Math.sqrt(state.k / state.m);
    state.fn = wn / (2 * Math.PI);
    const c = state.zeta * (2 * Math.sqrt(state.m * state.k));
    const denom = Math.sqrt(Math.pow(state.k - state.m * state.w**2, 2) + Math.pow(c * state.w, 2));
    state.X_amp = state.f0 / denom;

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

const loop = () => {
    updatePhysics(0.016);
    const h = 5 + (state.x * 6);
    updateSpring(h);

    const phase = Math.sin(state.t * state.w);
    robotHead.rotation.x = phase * (state.X_amp * 2);
    leftArmGroup.rotation.x = -phase * (state.X_amp * 4);
    rightArmGroup.rotation.x = phase * (state.X_amp * 4);

    document.getElementById('metric-fn').innerText = `${state.fn.toFixed(2)} Hz`;
    document.getElementById('metric-amp').innerText = `${state.X_amp.toFixed(4)} m`;
    
    timeChart.data.datasets[0].data = state.history;
    timeChart.options.scales.y.min = -Math.max(0.2, state.X_amp * 2);
    timeChart.options.scales.y.max = Math.max(0.2, state.X_amp * 2);
    timeChart.update('none');

    freqChart.data.datasets[1].data = freqChart.data.labels.map(l => l === Math.round(state.w) ? state.X_amp : null);
    freqChart.update('none');

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
};

window.onload = () => {
    init3D(); initCharts(); updateFreqChart(); loop();
    const inputs = [['input-mass', 'm', 'val-mass'], ['input-stiffness', 'k', 'val-stiffness'], ['input-damping', 'zeta', 'val-damping'], ['input-freq', 'w', 'val-freq'], ['input-force', 'f0', 'val-force']];
    inputs.forEach(i => {
        document.getElementById(i[0]).addEventListener('input', (e) => {
            state[i[1]] = parseFloat(e.target.value);
            document.getElementById(i[2]).innerText = state[i[1]].toFixed(2);
            updateFreqChart();
        });
    });
};

window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    timeChart.resize(); freqChart.resize();
});
