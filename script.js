const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = 400;
canvas.height = 500;

// Inputs
const mass = document.getElementById("mass");
const k = document.getElementById("k");
const c = document.getElementById("c");
const freq = document.getElementById("freq");

const info = document.getElementById("info");

let t = 0;

function animate() {
    requestAnimationFrame(animate);

    let m = parseFloat(mass.value);
    let stiffness = parseFloat(k.value);
    let damping = parseFloat(c.value);
    let f = parseFloat(freq.value);

    let omega = 2 * Math.PI * f;

    // Natural frequency
    let fn = (1/(2*Math.PI)) * Math.sqrt(stiffness/m);

    // Amplitude
    let A = 1 / Math.sqrt((stiffness - m*omega*omega)**2 + (damping*omega)**2);

    let x = A * Math.sin(omega * t);

    t += 0.05;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Base
    ctx.fillRect(150, 420, 100, 20);

    // Spring (zig-zag)
    let startY = 420;
    let endY = 250 + x * 50;

    let coils = 10;
    let step = (startY - endY) / coils;

    ctx.beginPath();
    for (let i = 0; i < coils; i++) {
        let xPos = (i % 2 === 0) ? 180 : 220;
        ctx.lineTo(xPos, startY - i * step);
    }
    ctx.stroke();

    // Body
    ctx.fillRect(180, endY - 40, 40, 50);

    // Head
    ctx.beginPath();
    ctx.arc(200, endY - 70, 20, 0, Math.PI * 2);
    ctx.fill();

    // Face
    ctx.fillStyle = "black";
    ctx.fillRect(192, endY - 75, 4, 4);
    ctx.fillRect(204, endY - 75, 4, 4);

    ctx.beginPath();
    ctx.arc(200, endY - 65, 8, 0, Math.PI);
    ctx.stroke();

    // Info
    info.innerHTML = `
        Natural Frequency: ${fn.toFixed(2)} Hz <br>
        Amplitude: ${A.toFixed(3)} <br>
        ${Math.abs(fn - f) < 2 ? "🔥 Resonance!" : "⚠️ Not in resonance"}
    `;
}

animate();
