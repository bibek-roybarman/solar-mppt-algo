// Solar Panel Mathematical Model
// Implements the single-diode model for photovoltaic cells

export interface SolarPanelParams {
  // Cell parameters
  Isc: number;      // Short circuit current (A)
  Voc: number;      // Open circuit voltage (V)
  Imp: number;      // Current at maximum power point (A)
  Vmp: number;      // Voltage at maximum power point (V)
  Pmax: number;     // Maximum power (W)
  // Additional parameters for modeling
  n: number;        // Diode ideality factor
  Rs: number;       // Series resistance (Ω)
  Rsh: number;      // Shunt resistance (Ω)
  // Temperature coefficients
  alphaIsc: number; // Current temperature coefficient (%/°C)
  betaVoc: number;  // Voltage temperature coefficient (%/°C)
  // Reference conditions
  Tref: number;     // Reference temperature (K)
  Gref: number;     // Reference irradiance (W/m²)
}

export interface EnvironmentalConditions {
  irradiance: number;  // Solar irradiance (W/m²)
  temperature: number; // Cell temperature (°C)
}

export interface IVPoint {
  voltage: number;
  current: number;
  power: number;
}

export interface MPPTResult {
  voltage: number;
  current: number;
  power: number;
  efficiency: number;
  iterations: number;
  converged: boolean;
}

// Default parameters for a typical 300W solar panel
export const DEFAULT_PANEL_PARAMS: SolarPanelParams = {
  Isc: 9.5,
  Voc: 40.0,
  Imp: 9.0,
  Vmp: 33.3,
  Pmax: 300,
  n: 1.3,
  Rs: 0.25,
  Rsh: 350,
  alphaIsc: 0.0005,
  betaVoc: -0.0032,
  Tref: 298.15,  // 25°C in Kelvin
  Gref: 1000,    // 1000 W/m²
};

// Calculate thermal voltage
function getThermalVoltage(T: number): number {
  const k = 1.380649e-23;  // Boltzmann constant
  const q = 1.602176634e-19; // Elementary charge
  return (k * T) / q;
}

// Calculate photocurrent based on irradiance and temperature
function calculatePhotocurrent(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions
): number {
  const G = conditions.irradiance;
  
  // Adjust for irradiance and temperature
  const Isc_adjusted = params.Isc * 
    (G / params.Gref) * 
    (1 + params.alphaIsc * (conditions.temperature - 25));
  
  return Isc_adjusted;
}

// Calculate saturation current based on temperature
function calculateSaturationCurrent(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions
): number {
  const T = conditions.temperature + 273.15;
  const Eg = 1.12; // Silicon bandgap energy (eV)
  const k = 8.617333262e-5; // Boltzmann constant in eV/K
  
  const Tref = params.Tref;
  const Io_ref = params.Isc / Math.exp(params.Voc / (params.n * getThermalVoltage(Tref)));
  
  // Temperature dependence of saturation current
  const T_ratio = Tref / T;
  const Io = Io_ref * Math.pow(T_ratio, 3) * Math.exp(
    (Eg / k) * (1/T - 1/Tref)
  );
  
  return Io;
}

// Calculate open circuit voltage at given conditions
export function calculateVoc(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions
): number {
  const T = conditions.temperature + 273.15;
  const G = conditions.irradiance;
  
  // Adjust Voc for temperature and irradiance
  const Voc_temp = params.Voc * (1 + params.betaVoc * (conditions.temperature - 25));
  const Voc_irr = Voc_temp + params.n * getThermalVoltage(T) * Math.log(G / params.Gref);
  
  return Math.max(0, Voc_irr);
}

// Calculate short circuit current at given conditions
export function calculateIsc(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions
): number {
  const G = conditions.irradiance;
  
  return params.Isc * (G / params.Gref) * (1 + params.alphaIsc * (conditions.temperature - 25));
}

// Calculate current for a given voltage using the single-diode model
export function calculateCurrent(
  params: SolarPanelParams,
  voltage: number,
  conditions: EnvironmentalConditions
): number {
  const T = conditions.temperature + 273.15;
  const Vt = params.n * getThermalVoltage(T);
  
  const Il = calculatePhotocurrent(params, conditions);
  const Io = calculateSaturationCurrent(params, conditions);
  
  // Single-diode model equation (simplified Newton-Raphson solution)
  const V_eff = voltage + params.Rs * Il;
  const diode_current = Io * (Math.exp(V_eff / Vt) - 1);
  const shunt_current = V_eff / params.Rsh;
  
  return Il - diode_current - shunt_current;
}

// Generate I-V curve points
export function generateIVCurve(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions,
  numPoints: number = 100
): IVPoint[] {
  const Voc = calculateVoc(params, conditions);
  const points: IVPoint[] = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const voltage = (i / numPoints) * Voc;
    const current = calculateCurrent(params, voltage, conditions);
    const power = voltage * Math.max(0, current);
    
    points.push({
      voltage: parseFloat(voltage.toFixed(3)),
      current: parseFloat(Math.max(0, current).toFixed(3)),
      power: parseFloat(power.toFixed(3)),
    });
  }
  
  return points;
}

// Find maximum power point from I-V curve
export function findMPP(ivCurve: IVPoint[]): IVPoint {
  let maxPowerPoint = ivCurve[0];
  
  for (const point of ivCurve) {
    if (point.power > maxPowerPoint.power) {
      maxPowerPoint = point;
    }
  }
  
  return maxPowerPoint;
}

// Calculate maximum power at given conditions
export function calculateMaxPower(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions
): number {
  const ivCurve = generateIVCurve(params, conditions);
  const mpp = findMPP(ivCurve);
  return mpp.power;
}

// Get theoretical efficiency
export function calculateTheoreticalEfficiency(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions,
  panelArea: number = 1.7 // m² for typical 300W panel
): number {
  const inputPower = conditions.irradiance * panelArea;
  const maxPower = calculateMaxPower(params, conditions);
  
  return (maxPower / inputPower) * 100;
}
