import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import time

# --- PAGE CONFIG ---
st.set_page_config(page_title="Dancing Toy Simulator", layout="wide")

st.title("🕺 Dancing Dashboard Toy: Vibration Simulator")

# --- SIDEBAR CONTROLS ---
st.sidebar.header("Design Parameters")
mass = st.sidebar.slider("Toy Mass (kg)", 0.05, 0.50, 0.15, step=0.01)
k_stiffness = st.sidebar.slider("Spring Stiffness (N/m)", 10, 500, 100, step=10)
damping_ratio = st.sidebar.slider("Damping Ratio (ζ)", 0.01, 0.50, 0.10, step=0.01)

st.sidebar.header("Vehicle Input")
car_freq = st.sidebar.slider("Road Vibration Frequency (Hz)", 1, 50, 15)

# --- PHYSICS CALCULATIONS ---
wn = np.sqrt(k_stiffness / mass)
fn = wn / (2 * np.pi)
r_input = car_freq / fn

def get_magnification(r, zeta):
    return 1 / np.sqrt((1 - r**2)**2 + (2 * zeta * r)**2)

current_mf = get_magnification(r_input, damping_ratio)
input_amp = 5 
output_amp = input_amp * current_mf

# --- VISUALIZATION LAYOUT ---
col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Live Dance Floor")
    # This is the "Stable" placeholder that won't disappear
    plot_spot = st.empty()
    start_ani = st.button("▶️ Start Dancing")

with col2:
    st.subheader("System Status")
    st.metric("Natural Frequency", f"{fn:.2f} Hz")
    st.metric("Movement Gain", f"{current_mf:.2f}x")
    
    if 0.9 < r_input < 1.1:
        st.error("RESONANCE!")
    elif current_mf > 1.5:
        st.success("DANCING")
    else:
        st.info("STILL")

# --- ANIMATION LOGIC ---
# We define the figure structure ONCE outside the loop
def create_frame(y_pos):
    fig = go.Figure()
    
    # 1. The Spring (Line from base to head)
    fig.add_trace(go.Scatter(
        x=[0, 0], y=[-10, y_pos],
        mode='lines+markers',
        line=dict(color='gray', width=4, dash='dot'),
        marker=dict(symbol='diamond', size=10)
    ))
    
    # 2. The Toy Head
    fig.add_trace(go.Scatter(
        x=[0], y=[y_pos],
        mode='markers+text',
        marker=dict(size=50, color='Gold', line=dict(width=2, color='Black')),
        text=["🤩"], textfont=dict(size=25)
    ))
    
    # 3. The Dashboard Base
    fig.add_trace(go.Scatter(
        x=[-20, 20], y=[-10, -10],
        mode='lines',
        line=dict(color='black', width=6)
    ))

    fig.update_layout(
        template="plotly_white",
        xaxis=dict(range=[-40, 40], visible=False),
        yaxis=dict(range=[-60, 60], visible=False),
        showlegend=False,
        height=400,
        margin=dict(l=0, r=0, t=0, b=0)
    )
    return fig

# Initial Static State
if not start_ani:
    plot_spot.plotly_chart(create_frame(0), use_container_width=True)

# Active Animation Loop
if start_ani:
    fps = 25
    t_ani = np.linspace(0, 4, fps * 4)
    # Scale down frequency for visual clarity in the browser
    visual_freq = car_freq if car_freq < 10 else 5 + (car_freq / 10)
    displacement = output_amp * np.sin(2 * np.pi * visual_freq * t_ani)

    for y in displacement:
        # Crucial: Use a static key or no key at all within the loop to prevent re-rendering the whole page
        plot_spot.plotly_chart(create_frame(y), use_container_width=True)
        time.sleep(0.04) # Match FPS
