const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// LIGHT
const light = new THREE.PointLight(0xffffff,1);
light.position.set(5,5,5);
scene.add(light);

// BASE
const base = new THREE.Mesh(
new THREE.BoxGeometry(2,0.2,2),
new THREE.MeshStandardMaterial({color:0x444444})
);
base.position.y = -2;
scene.add(base);

// SPRING (simplified)
const spring = new THREE.Mesh(
new THREE.CylinderGeometry(0.1,0.1,2,32),
new THREE.MeshStandardMaterial({color:0xaaaaaa})
);
scene.add(spring);

// HEAD
const head = new THREE.Mesh(
new THREE.SphereGeometry(0.5,32,32),
new THREE.MeshStandardMaterial({color:0xffd166})
);
scene.add(head);

let t = 0;

function compute() {
let m = document.getElementById("m").value;
let k = document.getElementById("k").value;
let c = document.getElementById("c").value;
let f = document.getElementById("f").value;

let omega = 2*Math.PI*f;

let A = 1/Math.sqrt((k-m*omega*omega)**2 + (c*omega)**2);

return {A, omega};
}

function animate() {
requestAnimationFrame(animate);

let {A, omega} = compute();

let y = Math.sin(omega*t) * A * 2;

head.position.y = y;
spring.scale.y = 1 + y;

t += 0.03;

renderer.render(scene, camera);
}

animate();
