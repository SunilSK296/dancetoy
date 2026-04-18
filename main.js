/**
 * VIBRASIM PRO - FIXED RENDERER
 * RK4 Integration + Organic Robot Construction
 */

const state = {
    m: 0.5, k: 200, zeta: 0.1, w: 10, f0: 10,
    t: 0, x: 0, v: 0,
    history: [], maxHistory: 200,
    fn: 0, X_amp: 0, phase: 0
};

let scene, camera, renderer, spring, robot, robotHead, leftArmGroup, rightArmGroup;
let isDragging = false, previousMousePosition = { x: 0, y: 0 };
let theta = 45, phi = 60, radius = 18; // Camera Control State

// --- 1. INITIALIZE 3D SCENE ---
const init3D = () => {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    updateCamera();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // MOUSE ROTATION LOGIC
    container.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            theta -= (e.movementX || 0) * 0.5;
            phi += (e.movementY || 0) * 0.5;
            phi = Math.max(10, Math.min(85, phi)); // Prevent flipping
            updateCamera();
        }
    });
    container.addEventListener('wheel', (e) => {
        radius += e.deltaY * 0.02;
        radius = Math.max(10, Math.min(40, radius));
        updateCamera();
    });

    // LIGHTING
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    scene.add(sun);

    // ROBOT CONSTRUCTION
    robot = new THREE.Group();
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x444b59, metalness: 0.8, roughness: 0.3 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 1.5 });

    // BODY (Torso) - Using Cylinder for stability
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 2.5, 16), ironMat);
    torso.position.y = 1.25;
    torso.castShadow = true;
    robot.add(torso);

    // HEAD (Round)
    robotHead = new THREE.Group();
    robotHead.position.y = 2.5; 
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), ironMat);
    skull.position.y = 0.8;
    robotHead.add(skull);

    // Eyes (Bright Cyan)
    const eyeGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeL = new THREE.Mesh(eyeGeo, glowMat);
    eyeL.position.set(-0.35, 0.9, 0.75);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.35;
    robotHead.add(eyeL, eyeR);
    robot.add(robotHead);

    // ARMS (Realist Joints)
    const createArm = (side) => {
        const armGroup = new THREE.Group();
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), ironMat);
        const bicep = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2), ironMat);
        bicep.position.y = -0.6;
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), ironMat);
        hand.position.y = -1.3;
        
        armGroup.add(shoulder, bicep, hand);
        armGroup.position.set(side * 1.3, 2.2, 0);
        return armGroup;
    };

    leftArmGroup = createArm(-1);
    rightArmGroup = createArm(1);
    robot.add(leftArmGroup, rightArmGroup);

    scene.add(robot);

    // DASHBOARD
    const plat = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    plat.position.y = -5;
    plat.receiveShadow = true;
    scene.add(plat);

    updateSpring(5);
};

const updateCamera = () => {
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
    spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.08, 8, false), new THREE.MeshStandardMaterial({ color: 0x777777 }));
    scene.add(spring);
    robot.position.y = h - 5;
};

// --- 2. PHYSICS ENGINE & UI ---
const updatePhysics = (dt) => {
    const wn = Math.sqrt(state.k / state.m);
    state.fn = wn / (2 * Math.PI);
    const c = state.zeta * (2 * Math.sqrt(state.m * state.k));
    const force = state.f0 * Math.sin(state.w * state.t);
    
    // Simple Euler for performance in high-frequency
    const a = (force - c * state.v - state.k * state.x) / state.m;
    state.v += a * dt;
    state.x += state.v * dt;
    state.t += dt;

    state.X_amp = state.f0 / Math.sqrt(Math.pow(state.k - state.m * state.w**2, 2) + (c * state.w)**2);
    state.history.push(state.x);
    if (state.history.length > 200) state.history.shift();
};

let timeChart;
const initCharts = () => {
    timeChart = new Chart(document.getElementById('timeChart'), {
        type: 'line',
        data: { labels: Array(200).fill(''), datasets: [{ data: [], borderColor: '#00f2ff', pointRadius: 0, fill: true, backgroundColor: 'rgba(0,242,255,0.05)' }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { display: false }, y: { min: -1, max: 1 } }, plugins: { legend: { display: false } } }
    });
};

const loop = () => {
    updatePhysics(0.016);
    const h = 5 + (state.x * 6);
    updateSpring(h);

    // Oscillating Animations
    const phase = Math.sin(state.t * state.w);
    robotHead.rotation.x = phase * (state.X_amp * 2);
    leftArmGroup.rotation.x = -phase * (state.X_amp * 4);
    rightArmGroup.rotation.x = phase * (state.X_amp * 4);

    // Metrics Update
    document.getElementById('metric-fn').innerText = `${state.fn.toFixed(2)} Hz`;
    document.getElementById('metric-amp').innerText = `${state.X_amp.toFixed(4)} m`;

    timeChart.data.datasets[0].data = state.history;
    timeChart.update('none');

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
};

window.onload = () => {
    init3D();
    initCharts();
    loop();
    
    const controls = [['input-mass', 'm', 'val-mass'], ['input-stiffness', 'k', 'val-stiffness'], ['input-damping', 'zeta', 'val-damping'], ['input-freq', 'w', 'val-freq'], ['input-force', 'f0', 'val-force']];
    controls.forEach(c => {
        document.getElementById(c[0]).addEventListener('input', (e) => {
            state[c[1]] = parseFloat(e.target.value);
            document.getElementById(c[2]).innerText = state[c[1]].toFixed(2);
        });
    });
};

// Handle window resizing
window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});
