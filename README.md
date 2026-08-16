# MPPT Algorithm Simulator

A comprehensive web-based simulation and comparison tool for Maximum Power Point Tracking (MPPT) algorithms used in solar photovoltaic systems. This application models solar panel characteristics and compares the performance of different MPPT algorithms under varying environmental conditions.

![MPPT Simulator](https://img.shields.io/badge/MPPT-Simulator-blue)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7.3-646cff)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8)

## Features

### 🌞 Solar Panel Modeling
- **Single-Diode Model**: Accurate mathematical modeling of photovoltaic cells
- **I-V Characteristic Curves**: Real-time visualization of Current-Voltage relationships
- **P-V Characteristic Curves**: Power-Voltage curves with maximum power point marking
- **Environmental Adaptation**: Models respond to changes in irradiance and temperature

### 🔄 MPPT Algorithms Implemented

1. **Perturb and Observe (P&O)**
   - Most widely used in commercial applications
   - Simple implementation with good performance
   - May oscillate around MPP under steady conditions

2. **Incremental Conductance (IncCond)**
   - More accurate than P&O algorithm
   - Better performance under rapidly changing conditions
   - No steady-state oscillation at MPP

3. **Constant Voltage (CV)**
   - Fastest tracking speed
   - Assumes fixed Vmp/Voc ratio (~0.76 for silicon)
   - Simple backup or initial tracking method

4. **Fractional Short-Circuit Current (FSCC)**
   - Uses Impp ≈ k × Isc relationship
   - Requires periodic Isc measurement
   - Good accuracy under constant temperature

### 📊 Real-time Visualization
- Interactive I-V and P-V characteristic curves
- Algorithm efficiency comparison charts
- Power tracking over time simulations
- Detailed performance metrics tables

### 🎛️ Interactive Controls
- Solar irradiance adjustment (200-1200 W/m²)
- Cell temperature control (-10 to 80°C)
- Algorithm selection and comparison
- Dynamic simulation with changing conditions

## Installation

### Prerequisites
- Node.js 18+ and npm
- Modern web browser with ES6+ support

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd mppt-simulator

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

### Basic Operation

1. **Set Environmental Conditions**
   - Use the irradiance slider to adjust solar intensity
   - Adjust temperature to simulate different operating conditions
   - Observe real-time changes in I-V and P-V curves

2. **Select MPPT Algorithms**
   - Click on algorithm cards to select/deselect
   - Compare performance metrics side by side
   - View efficiency, power output, and convergence status

3. **Analyze Results**
   - Check the performance comparison table
   - Review efficiency bar charts
   - Examine voltage, current, and power readings

### Running Simulations

1. Click "Run Simulation" to start dynamic testing
2. The simulator will run 20 time steps with varying conditions
3. View power and efficiency tracking over time
4. Compare algorithm performance metrics:
   - Average efficiency
   - Minimum/Maximum efficiency
   - Average iterations to converge
   - Convergence rate

### Understanding the Curves

#### I-V Curve (Current-Voltage)
- Shows how current decreases as voltage increases
- Short-circuit current (Isc) at V=0
- Open-circuit voltage (Voc) at I=0
- Maximum power point (MPP) marked in orange

#### P-V Curve (Power-Voltage)
- Shows power output at each voltage point
- Peak represents the maximum power point
- Used to verify MPPT algorithm accuracy

## Technical Details

### Solar Panel Model

The application uses the **single-diode model** for photovoltaic cells:

```
I = I_L - I_0 × (exp((V + I×R_s) / (n×V_t)) - 1) - (V + I×R_s) / R_sh

Where:
- I_L: Photocurrent (depends on irradiance and temperature)
- I_0: Reverse saturation current
- R_s: Series resistance
- R_sh: Shunt resistance
- n: Diode ideality factor
- V_t: Thermal voltage (k×T/q)
```

### Default Panel Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| P_max | 300 W | Maximum power rating |
| V_oc | 40.0 V | Open-circuit voltage |
| I_sc | 9.5 A | Short-circuit current |
| V_mp | 33.3 V | Voltage at MPP |
| I_mp | 9.0 A | Current at MPP |
| R_s | 0.25 Ω | Series resistance |
| R_sh | 350 Ω | Shunt resistance |
| α_Isc | 0.0005 /°C | Current temp. coefficient |
| β_Voc | -0.0032 /°C | Voltage temp. coefficient |

### Algorithm Comparison

| Algorithm | Speed | Accuracy | Complexity | Best For |
|-----------|-------|----------|------------|----------|
| P&O | Medium | Good | Low | General use |
| IncCond | Medium | Excellent | Medium | Rapid changes |
| CV | Fast | Fair | Very Low | Simple systems |
| FSCC | Fast | Good | Medium | Stable temperature |

## Project Structure

```
mppt-simulator/
├── src/
│   ├── utils/
│   │   ├── solarModel.ts      # Solar panel mathematical model
│   │   └── mpptAlgorithms.ts  # MPPT algorithm implementations
│   ├── App.tsx                # Main application component
│   ├── main.tsx               # Application entry point
│   └── index.css              # Global styles
├── index.html                 # HTML template
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
└── README.md                  # This file
```

## Technologies Used

- **React 19** - UI component library
- **TypeScript 5.9** - Type-safe development
- **Vite 7.3** - Build tool and dev server
- **Tailwind CSS 4.1** - Utility-first styling
- **Recharts** - Data visualization charts
- **Lucide React** - Beautiful icons

## Performance Metrics

The simulator tracks and displays:

- **Efficiency**: (Actual Power / Theoretical Max Power) × 100%
- **Convergence**: Whether algorithm reached stable MPP
- **Iterations**: Number of steps to reach MPP
- **Oscillation**: Stability around MPP point

## Use Cases

### Education
- Learn about MPPT algorithm principles
- Visualize solar panel characteristics
- Understand environmental effects on PV systems

### Research
- Compare algorithm performance
- Test under various conditions
- Analyze convergence behavior

### System Design
- Select appropriate MPPT algorithm
- Estimate expected efficiency
- Plan for environmental variations

## Limitations

- Single panel model (not array simulation)
- Ideal environmental conditions (no shading)
- Simplified temperature model
- No partial shading scenarios

## Future Enhancements

- [ ] Partial shading simulation
- [ ] PV array configuration support
- [ ] More advanced algorithms (Fuzzy Logic, Neural Networks)
- [ ] Export simulation data
- [ ] Custom panel parameter input
- [ ] Real-time hardware integration

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is open source and available for educational and research purposes.

## References

1. Esram, T., & Chapman, P. L. (2007). Comparison of Photovoltaic Array Maximum Power Point Tracking Techniques.
2. Femia, N., et al. (2005). Optimization of Perturb and Observe Maximum Power Point Tracking Method.
3. Sera, D., et al. (2013). Photovoltaic Module Modeling Using the Single-Diode Model.

## Acknowledgments

Built with modern web technologies for the solar energy research and education community.

---

**Note**: This simulator is for educational and research purposes. Real-world MPPT implementations should be validated with actual hardware testing.
