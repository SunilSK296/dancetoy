/**
 * VIBRASIM PRO - FULLY FIXED
 * Includes: Orbit Cam, Robot Body, Round Head, Swing Arms, and Bode Graph
 */

const state = {
    m: 0.5, k: 200, zeta: 0.1, w: 10, f0: 10,
    t: 0, x: 0, v: 0,
    history: [], maxHistory: 200,
    fn: 0, X_amp: 0, phase: 0
};

let scene, camera, renderer, spring, robot, robotHead, leftArmGroup, rightArmGroup;
let isDragging = false, previousMousePosition = { x: 0, y: 0 };
let theta = 45, phi = 60, radius = 18; 

// --- 1. 3D SCENE & ROBOT ---
const init3D = () => {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    updateCamera();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

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

// --- 2. ANALYTICS & CHARTS ---
let timeChart, freqChart;
const initCharts = () => {
    const commonOpts = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } } };

    timeChart = new Chart(document.getElementById('timeChart'), {
        type: 'line',
        data: { labels: Array(200).fill(''), datasets: [{ data: [], borderColor: '#00f2ff', pointRadius: 0, fill: true, backgroundColor: 'rgba(0,242,255,0.05)' }] },
        options: { ...commonOpts, scales: { x: { display: false }, y: { min: -1, max: 1, grid: { color: '#222' } } } }
    });

    freqChart = new Chart(document.getElementById('freqChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'Curve', data: [], borderColor: '#444', borderWidth: 1.5, pointRadius: 0, tension: 0.4 },
            { label: 'Point', data: [], pointBackgroundColor: '#00f2ff', pointRadius: 6, showLine: false }
        ]},
        options: { ...commonOpts, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#222'
