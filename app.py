import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objects as go

# --- PAGE CONFIG ---
st.set_page_config(page_title="Dancing Toy Simulator", layout="wide")

st.title("🕺 Dancing Dashboard Toy: Vibration Simulator")
st.markdown("""
This dashboard simulates the motion of a non-electronic dashboard toy. 
It models the toy as a **Spring-Mass-Damper system** excited by car vibrations.
""")

# --- SIDEBAR CONTROLS ---
st.sidebar.header("Design Parameters")
mass = st.sidebar.slider("Toy Mass (kg)", 0.05, 0.50, 0.15, step=0.01)
k_stiffness = st.sidebar.slider("Spring Stiffness (N/m)", 10, 500, 100, step=10)
damping_ratio = st.sidebar.slider("Damping Ratio (ζ)", 0.01, 0.50, 0.10, step=0.01)

st.sidebar.header("Vehicle Input")
car_freq = st.sidebar.slider("Road Vibration Frequency (Hz)", 1, 50, 15)

# --- PHYSICS CALCULATIONS ---
# Natural Frequency: ωn = sqrt(k/m)
wn = np.sqrt(k_stiffness / mass)
fn = wn / (2 * np.pi)

# Frequency Ratio: r = f / fn
freq_range = np.linspace(0.1, 60, 500)
r_range = freq_range / fn
r_input = car_freq / fn

# Magnification Factor (Amplitude Ratio): 
# MF = 1 / sqrt((1-r^2)^2 + (2*zeta*r)^2)
def get_magnification(r, zeta):
    return 1 / np.sqrt((1 - r**2)**2 + (2 * zeta * r)**2)

mf_curve = get_magnification(r_range, damping_ratio)
current_mf = get_magnification(r_input, damping_ratio)

# --- VISUALIZATION ---
col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Frequency Response Analysis")
    fig = go.Figure()
    
    # Plot resonance curve
    fig.add_trace(go.Scatter(x=freq_range, y=mf_curve, name="System Response", line=dict(color='royalblue', width=3)))
    
    # Highlight current operating point
    fig.add_trace(go.Scatter(x=[car_freq], y=[current_mf], mode='markers+text', 
                             name='Current Operation', text=["Working Point"],
                             textposition="top right", marker=dict(color='red', size=12)))

    fig.update_layout(
        xaxis_title="Input Frequency (Hz)",
        yaxis_title="Amplitude Magnification (Output/Input)",
        hovermode="x unified",
        template="plotly_white"
    )
    st.plotly_chart(fig, use_container_広告=True)

with col2:
    st.subheader("Engineering Metrics")
    st.metric("Natural Frequency (fn)", f"{fn:.2f} Hz")
    st.metric("Current Gain", f"{current_mf:.2f}x")
    
    # Logic for user feedback
    if 0.9 < r_input < 1.1:
        st.error("⚠️ RESONANCE DETECTED: The toy will shake violently!")
    elif current_mf > 1.5:
        st.success("✅ GOOD DANCING: Noticeable motion achieved.")
    else:
        st.warning("💤 STATIC: Toy is barely moving. Lower stiffness or increase mass.")

# --- OSCILLATION PREVIEW (TIME DOMAIN) ---
st.divider()
st.subheader("Real-time Oscillation Preview")
t = np.linspace(0, 2, 500)
# Simple sine wave representation of steady-state response
y = current_mf * np.sin(2 * np.pi * car_freq * t)
df_time = pd.DataFrame({"Time (s)": t, "Displacement": y})
st.line_chart(df_time, x="Time (s)", y="Displacement")
