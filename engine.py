import numpy as np

class PhysicsEngine:
    @staticmethod
    def solve_rk4(m, k, zeta, freq_hz, amp_mm, duration=4, fps=60):
        dt = 1.0 / fps
        t_steps = np.arange(0, duration, dt)
        omega_ext = 2 * np.pi * freq_hz
        f_ext = (amp_mm * k / 1000) 
        c_crit = 2 * np.sqrt(k * m)
        c = zeta * c_crit
        
        state = np.array([0.0, 0.0]) # [pos, vel]
        displacements = []

        def ode_system(s, t):
            x, v = s
            dvdt = (f_ext * np.sin(omega_ext * t) - c * v - k * x) / m
            return np.array([v, dvdt])

        for t in t_steps:
            k1 = ode_system(state, t)
            k2 = ode_system(state + 0.5 * dt * k1, t + 0.5 * dt)
            k3 = ode_system(state + 0.5 * dt * k2, t + 0.5 * dt)
            k4 = ode_system(state + dt * k3, t + dt)
            state += (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4)
            displacements.append(state[0])
            
        return t_steps, np.array(displacements)
