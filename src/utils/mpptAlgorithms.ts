import { 
  EnvironmentalConditions, 
  SolarPanelParams,
  MPPTResult,
  calculateCurrent,
  calculateVoc,
  findMPP,
  generateIVCurve
} from './solarModel';

export enum MPPTAlgorithm {
  PERTURB_OBSEERVE = 'P&O',
  INCREMENTAL_CONDUCTANCE = 'IncCond',
  CONSTANT_VOLTAGE = 'CV',
  FRACTIONAL_SC = 'FSCC',
}

export interface MPPTState {
  algorithm: MPPTAlgorithm;
  voltage: number;
  current: number;
  power: number;
  history: Array<{
    voltage: number;
    current: number;
    power: number;
    iteration: number;
  }>;
  iterations: number;
  converged: boolean;
  efficiency: number;
  oscillation: number;
}

// Perturb and Observe (P&O) Algorithm
export function perturbObserve(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions,
  initialVoltage: number,
  maxIterations: number = 100,
  stepSize: number = 0.1,
  tolerance: number = 0.01
): MPPTResult {
  let voltage = initialVoltage;
  let prevPower = 0;
  let prevVoltage = voltage;
  let iterations = 0;
  let converged = false;
  
  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
    const current = calculateCurrent(params, voltage, conditions);
    const power = voltage * current;
    
    // Check for convergence
    if (Math.abs(power - prevPower) < tolerance && i > 10) {
      converged = true;
      break;
    }
    
    // Perturb and observe logic
    if (power > prevPower) {
      // Continue in the same direction
      voltage += (voltage - prevVoltage) > 0 ? stepSize : -stepSize;
    } else {
      // Reverse direction
      voltage += (voltage - prevVoltage) > 0 ? -stepSize : stepSize;
    }
    
    // Clamp voltage to valid range
    const Voc = calculateVoc(params, conditions);
    voltage = Math.max(0, Math.min(Voc * 0.95, voltage));
    
    prevPower = power;
    prevVoltage = voltage - (voltage - prevVoltage);
  }
  
  const finalCurrent = calculateCurrent(params, voltage, conditions);
  const finalPower = voltage * finalCurrent;
  const maxPower = findMPP(generateIVCurve(params, conditions)).power;
  const efficiency = maxPower > 0 ? (finalPower / maxPower) * 100 : 0;
  
  return {
    voltage: parseFloat(voltage.toFixed(3)),
    current: parseFloat(finalCurrent.toFixed(3)),
    power: parseFloat(finalPower.toFixed(3)),
    efficiency: parseFloat(efficiency.toFixed(2)),
    iterations,
    converged,
  };
}

// Incremental Conductance Algorithm
export function incrementalConductance(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions,
  initialVoltage: number,
  maxIterations: number = 100,
  stepSize: number = 0.05,
  tolerance: number = 0.001
): MPPTResult {
  let voltage = initialVoltage;
  let iterations = 0;
  let converged = false;
  
  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
    const current = calculateCurrent(params, voltage, conditions);
    
    // Calculate conductances
    const dV = stepSize;
    const currentNext = calculateCurrent(params, voltage + dV, conditions);
    const dI = currentNext - current;
    
    const instantaneousCond = current / voltage;
    const incrementalCond = dI / dV;
    
    // Incremental conductance MPPT logic
    if (Math.abs(incrementalCond + instantaneousCond) < tolerance) {
      // At MPP
      converged = true;
      break;
    } else if (incrementalCond + instantaneousCond > 0) {
      // Left of MPP, increase voltage
      voltage += stepSize;
    } else {
      // Right of MPP, decrease voltage
      voltage -= stepSize;
    }
    
    // Clamp voltage to valid range
    const Voc = calculateVoc(params, conditions);
    voltage = Math.max(stepSize, Math.min(Voc * 0.95, voltage));
  }
  
  const finalCurrent = calculateCurrent(params, voltage, conditions);
  const finalPower = voltage * finalCurrent;
  const maxPower = findMPP(generateIVCurve(params, conditions)).power;
  const efficiency = maxPower > 0 ? (finalPower / maxPower) * 100 : 0;
  
  return {
    voltage: parseFloat(voltage.toFixed(3)),
    current: parseFloat(finalCurrent.toFixed(3)),
    power: parseFloat(finalPower.toFixed(3)),
    efficiency: parseFloat(efficiency.toFixed(2)),
    iterations,
    converged,
  };
}

// Constant Voltage Algorithm (simplified)
export function constantVoltage(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions,
  initialVoltage: number,
  maxIterations: number = 10,
  tolerance: number = 0.1
): MPPTResult {
  // CV uses a fixed ratio of Voc (typically 0.76 for silicon cells)
  const Voc = calculateVoc(params, conditions);
  const targetVoltage = Voc * 0.76;
  
  let voltage = initialVoltage;
  let iterations = 0;
  
  // Simple approach to target voltage
  while (iterations < maxIterations) {
    iterations++;
    if (Math.abs(voltage - targetVoltage) < tolerance) {
      break;
    }
    voltage += (targetVoltage - voltage) * 0.3;
  }
  
  voltage = targetVoltage;
  const finalCurrent = calculateCurrent(params, voltage, conditions);
  const finalPower = voltage * finalCurrent;
  const maxPower = findMPP(generateIVCurve(params, conditions)).power;
  const efficiency = maxPower > 0 ? (finalPower / maxPower) * 100 : 0;
  
  return {
    voltage: parseFloat(voltage.toFixed(3)),
    current: parseFloat(finalCurrent.toFixed(3)),
    power: parseFloat(finalPower.toFixed(3)),
    efficiency: parseFloat(efficiency.toFixed(2)),
    iterations,
    converged: true,
  };
}

// Fractional Short Circuit Current Algorithm
export function fractionalShortCircuit(
  params: SolarPanelParams,
  conditions: EnvironmentalConditions,
  initialVoltage: number,
  kFactor: number = 0.81,
  maxIterations: number = 10,
  tolerance: number = 0.1
): MPPTResult {
  // FSCC uses the relationship: Vmp ≈ k * Voc
  // where k is typically around 0.78-0.82 for silicon cells
  const Voc = calculateVoc(params, conditions);
  const targetVoltage = Voc * kFactor;
  
  let voltage = initialVoltage;
  let iterations = 0;
  
  // Simple approach to target voltage
  while (iterations < maxIterations) {
    iterations++;
    if (Math.abs(voltage - targetVoltage) < tolerance) {
      break;
    }
    voltage += (targetVoltage - voltage) * 0.3;
  }
  
  voltage = targetVoltage;
  const finalCurrent = calculateCurrent(params, voltage, conditions);
  const finalPower = voltage * finalCurrent;
  const maxPower = findMPP(generateIVCurve(params, conditions)).power;
  const efficiency = maxPower > 0 ? (finalPower / maxPower) * 100 : 0;
  
  return {
    voltage: parseFloat(voltage.toFixed(3)),
    current: parseFloat(finalCurrent.toFixed(3)),
    power: parseFloat(finalPower.toFixed(3)),
    efficiency: parseFloat(efficiency.toFixed(2)),
    iterations,
    converged: true,
  };
}

// Run MPPT algorithm
export function runMPPT(
  algorithm: MPPTAlgorithm,
  params: SolarPanelParams,
  conditions: EnvironmentalConditions,
  initialVoltage?: number
): MPPTResult {
  const Voc = calculateVoc(params, conditions);
  const startVoltage = initialVoltage ?? Voc * 0.5;
  
  switch (algorithm) {
    case MPPTAlgorithm.PERTURB_OBSEERVE:
      return perturbObserve(params, conditions, startVoltage);
    case MPPTAlgorithm.INCREMENTAL_CONDUCTANCE:
      return incrementalConductance(params, conditions, startVoltage);
    case MPPTAlgorithm.CONSTANT_VOLTAGE:
      return constantVoltage(params, conditions, startVoltage);
    case MPPTAlgorithm.FRACTIONAL_SC:
      return fractionalShortCircuit(params, conditions, startVoltage);
    default:
      return perturbObserve(params, conditions, startVoltage);
  }
}

// Simulate MPPT tracking over time with changing conditions
export function simulateMPPTTracking(
  algorithm: MPPTAlgorithm,
  params: SolarPanelParams,
  conditionsHistory: EnvironmentalConditions[],
  timeStep: number = 1
): Array<{
  time: number;
  conditions: EnvironmentalConditions;
  result: MPPTResult;
  optimalPower: number;
}> {
  const results: Array<{
    time: number;
    conditions: EnvironmentalConditions;
    result: MPPTResult;
    optimalPower: number;
  }> = [];
  
  let currentVoltage = 0;
  
  for (let i = 0; i < conditionsHistory.length; i++) {
    const conditions = conditionsHistory[i];
    const Voc = calculateVoc(params, conditions);
    
    // Use previous voltage as starting point for faster tracking
    const startVoltage = currentVoltage > 0 ? currentVoltage : Voc * 0.5;
    
    const result = runMPPT(algorithm, params, conditions, startVoltage);
    currentVoltage = result.voltage;
    
    const optimalPower = findMPP(generateIVCurve(params, conditions)).power;
    
    results.push({
      time: i * timeStep,
      conditions,
      result,
      optimalPower,
    });
  }
  
  return results;
}

// Calculate performance metrics for comparison
export function calculatePerformanceMetrics(
  simulationResults: Array<{
    time: number;
    result: MPPTResult;
    optimalPower: number;
  }>[]
): Record<string, {
  averageEfficiency: number;
  minEfficiency: number;
  maxEfficiency: number;
  averageIterations: number;
  convergenceRate: number;
}> {
  const metrics: Record<string, {
    averageEfficiency: number;
    minEfficiency: number;
    maxEfficiency: number;
    averageIterations: number;
    convergenceRate: number;
  }> = {};
  
  simulationResults.forEach((resultSet, idx) => {
    const algorithms = Object.values(MPPTAlgorithm);
    const algorithm = algorithms[idx];
    
    const efficiencies = resultSet.map(r => r.result.efficiency);
    const iterations = resultSet.map(r => r.result.iterations);
    const convergenceValues: number[] = resultSet.map(r => r.result.converged ? 1.0 : 0.0);
    
    metrics[algorithm] = {
      averageEfficiency: efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length,
      minEfficiency: Math.min(...efficiencies),
      maxEfficiency: Math.max(...efficiencies),
      averageIterations: iterations.reduce((a, b) => a + b, 0) / iterations.length,
      convergenceRate: (convergenceValues.reduce((a, b) => a + b, 0) / convergenceValues.length) * 100,
    };
  });
  
  return metrics;
}
