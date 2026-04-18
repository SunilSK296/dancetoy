const canvas = document.getElementById("toyCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 400;
canvas.height = 500;

// Inputs
const mSlider = document.getElementById("mass");
const kSlider = document.getElementById("k");
const cSlider = document.getElementById("c");
const fSlider = document.getElementById("freq");

const fnBox = document.getElementById("fnBox");
const ampBox = document.getElementById("ampBox");
const statusBox = document.getElementById("status");

// Charts
const freqChart = new Chart(document.getElementById("freqChart"), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Amplitude', data: [] }] },
});

const timeChart = new Chart(document.getElementById("timeChart"), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Displacement', data: [] }] },
});

let t = 0;

function updatePhysics() {

    let m = parseFloat(mSlider.value);
    let k = parseFloat(kSlider.value);
    let c = parseFloat(cSlider.value);
    let f = parseFloat(fSlider.value);

    let omega = 2 * Math.PI * f;

    let fn = (1/(2*Math.PI)) * Math.sqrt(k/m);

    let A = 1 / Math.sqrt((k - m*omega**2)**2 + (c*omega)**2);

    fnBox.innerHTML = `Natural Frequency: ${fn.toFixed(2)} Hz`;
    ampBox.innerHTML = `Amplitude: ${A.toFixed(3)}`;

    if (Math.abs(fn - f) < 2) {
        statusBox.innerHTML = "🔥 Resonance!";
    } else {
        statusBox.innerHTML = "⚠️ Not in resonance";
    }

    return {A, omega, fn};
}

// Frequency Graph
function updateFreqGraph(m, k, c) {

    let freqs = [];
    let amps = [];

    for (let f = 1; f <= 30; f++) {
        let omega = 2*Math.PI*f;
        let A = 1 / Math.sqrt((k - m*omega**2)**2 + (c*omega)**2);
        freqs.push(f);
        amps.push(A);
    }

    freqChart.data.labels = freqs;
    freqChart.data.datasets[0].data = amps;
    freqChart.update();
}

// Time Graph
function updateTimeGraph(A, omega) {

    let tVals = [];
    let xVals = [];

    for (let i = 0; i < 100; i++) {
        let tt = i * 0.05;
        tVals.push(tt);
        xVals.push(A * Math.sin(omega * tt));
    }

    timeChart.data.labels = tVals;
    timeChart.data.datasets[0].data = xVals;
    timeChart.update();
}

// Animation
function draw(A, omega) {

    ctx.clearRect(0,0,canvas.width,canvas.height);

    let x = A * Math.sin(omega * t) * 100;

    // Base
    ctx.fillStyle = "#555";
    ctx.fillRect(150, 450, 100, 20);

    let baseY = 450;
    let topY = 300 + x;

    // Spring
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
        let xPos = (i % 2 === 0) ? 180 : 220;
        let yPos = baseY - i * ((baseY - topY)/12);
        ctx.lineTo(xPos, yPos);
    }
    ctx.strokeStyle = "white";
    ctx.stroke();

    // Body
    ctx.fillStyle = "#00d4ff";
    ctx.fillRect(180, topY - 50, 40, 50);

    // Head
    ctx.beginPath();
    ctx.arc(200, topY - 70, 20, 0, Math.PI*2);
    ctx.fillStyle = "#ffd166";
    ctx.fill();

    // Eyes
    ctx.fillStyle = "black";
    ctx.fillRect(193, topY - 75, 4, 4);
    ctx.fillRect(203, topY - 75, 4, 4);

    // Smile
    ctx.beginPath();
    ctx.arc(200, topY - 65, 8, 0, Math.PI);
    ctx.stroke();

    t += 0.05;
}

function loop() {

    let m = parseFloat(mSlider.value);
    let k = parseFloat(kSlider.value);
    let c = parseFloat(cSlider.value);

    let {A, omega, fn} = updatePhysics();

    draw(A, omega);

    updateFreqGraph(m, k, c);
    updateTimeGraph(A, omega);

    requestAnimationFrame(loop);
}

loop();
