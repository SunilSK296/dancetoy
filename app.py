import streamlit as st
import numpy as np
import plotly.graph_objects as go
from engine import PhysicsEngine

st.set_page_config(page_title="VibraPro 3D Digital Twin", layout="wide")

# Custom Premium CSS
st.markdown("""
    <style>
    .main { background-color: #050505; color: #ffffff; }
    div[data-testid="stMetricValue"] { color: #00f2ff; font-family: 'Courier New', monospace; }
    section[data-testid="stSidebar"] { background-color: #0a0a0a; border-right: 1px solid #333; }
    </style>
    """, unsafe_content_with_html=True)

# --- SIDEBAR CONTROLS ---
with st.sidebar:
    st.title("🛡️ VIBRAPRO 3.0")
    st.caption("Industrial 3D Dynamics Simulator")
    
    st.header("⚙️ Mechanics")
    m = st.number_input("Mass (kg)", 0.05, 2.0, 0.25)
    k = st.number_input("Stiffness (N/m)", 50, 2000, 450)
    zeta = st.slider("Damping Ratio", 0.01, 0.8, 0.1)
    
    st.header("🛣️ Environment")
    f_road = st.slider("Road Frequency (Hz)", 1, 60, 15)
    amp_in = st.number_input("Input Amp (mm)", 1, 20, 5)

# --- PHYSICS PROCESSING ---
t, y_data = PhysicsEngine.solve_rk4(m, k, zeta, f_road, amp_in)
max_swing = np.max(np.abs(y_data)) * 1000 # to mm

# --- 3D RENDERING COMPONENT (Three.js) ---
# We inject a high-level 3D scene directly into the dashboard
vis_amp = min(max_swing * 0.15, 6) # Scaled for 3D world space
anim_speed = 1 / (f_road/4) if f_road > 4 else 1 / f_road

three_js_code = f"""
<div id="container" style="width: 100%; height: 500px; background: #000; border-radius: 15px;"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / 500, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({{ antialias: true, alpha: true }});
    renderer.setSize(window.innerWidth, 500);
    document.getElementById('container').appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x00f2ff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Geometry: Metallic Base
    const baseGeo = new THREE.BoxGeometry(10, 0.5, 10);
    const baseMat = new THREE.MeshStandardMaterial({{ color: 0x333333, metalness: 0.8 }});
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -5;
    scene.add(base);

    // Geometry: The Head (Premium Gloss Sphere)
    const headGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({{ color: 0x00f2ff, metalness: 0.9, roughness: 0.1 }});
    const head = new THREE.Mesh(headGeo, headMat);
    scene.add(head);

    // Geometry: Spring (Tube Geometry)
    function createSpring(height) {{
        const points = [];
        for (let i = 0; i <= 100; i++) {{
            const t = i / 100;
            const angle = 10 * Math.PI * t;
            points.push(new THREE.Vector3(Math.cos(angle)*0.8, (t * height) - 5, Math.sin(angle)*0.8));
        }}
        const curve = new THREE.CatmullRomCurve3(points);
        return new THREE.TubeGeometry(curve, 64, 0.1, 8, false);
    }}
    
    let springGeo = createSpring(5);
    const springMat = new THREE.MeshStandardMaterial({{ color: 0x888888, metalness: 1 }});
    let spring = new THREE.Mesh(springGeo, springMat);
    scene.add(spring);

    camera.position.z = 20;
    camera.position.y = 2;

    let time = 0;
    function animate() {{
        requestAnimationFrame(animate);
        time += 0.05;
        
        // Physics-driven oscillation
        const dynamicY = Math.sin(time * {6.28 / anim_speed}) * {vis_amp};
        head.position.y = dynamicY;
        head.position.x = dynamicY * 0.5; // Swaying effect

        // Re-draw spring to stretch
        scene.remove(spring);
        springGeo = createSpring(5 + dynamicY);
        spring = new THREE.Mesh(springGeo, springMat);
        scene.add(spring);

        renderer.render(scene, camera);
    }}
    animate();
</script>
"""

# --- UI LAYOUT ---
c1, c2 = st.columns([2, 1])

with c1:
    st.subheader("🌐 Real-time 3D Prototype")
    st.components.v1.html(three_js_code, height=520)
    
with c2:
    st.subheader("📊 Analytics")
    st.metric("Natural Frequency", f"{((1/(2*np.pi))*np.sqrt(k/m)):.2f} Hz")
    st.metric("Resonance Gain", f"{(max_swing/amp_in):.2f}x")
    
    # Motion Graph
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=t[:200], y=y_data[:200]*1000, line=dict(color='#00f2ff')))
    fig.update_layout(template="plotly_dark", height=250, margin=dict(l=0,r=0,b=0,t=0),
                      xaxis=dict(showgrid=False), yaxis=dict(showgrid=False))
    st.plotly_chart(fig, use_container_width=True)

st.markdown("---")
st.caption("VibraPro Digital Twin v3.0 | RK4 Solver | Three.js WebGL Rendering")
