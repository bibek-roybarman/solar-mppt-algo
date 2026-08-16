import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import {
  Sun,
  Thermometer,
  Zap,
  TrendingUp,
  Activity,
  Clock,
  Target,
  Settings,
  Play,
  RotateCcw,
  Info,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  SolarPanelParams,
  EnvironmentalConditions,
  DEFAULT_PANEL_PARAMS,
  generateIVCurve,
  findMPP,
  calculateMaxPower,
} from './utils/solarModel';
import {
  MPPTAlgorithm,
  runMPPT,
  simulateMPPTTracking,
  calculatePerformanceMetrics,
} from './utils/mpptAlgorithms';

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg border border-slate-700">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(3)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Slider Component
const Slider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
  icon: Icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  unit: string;
  icon: any;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-700">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-indigo-600">
        {value} {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
    />
  </div>
);

// Stat Card Component
const StatCard = ({
  label,
  value,
  unit,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: number;
  unit: string;
  icon: any;
  color: string;
  trend?: number;
}) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-900">
          {value.toFixed(2)}
          <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>
        </p>
        {trend !== undefined && (
          <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </p>
        )}
      </div>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

// Algorithm Performance Card
const AlgorithmCard = ({
  algorithm,
  result,
  isSelected,
  onClick,
}: {
  algorithm: MPPTAlgorithm;
  result: MPPTResult;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
      isSelected
        ? 'border-indigo-500 bg-indigo-50'
        : 'border-slate-200 bg-white hover:border-slate-300'
    }`}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="font-semibold text-slate-900">{algorithm}</span>
      {isSelected && (
        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
          Selected
        </span>
      )}
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <span className="text-slate-500">Efficiency:</span>
        <span className="ml-1 font-semibold text-green-600">{result.efficiency.toFixed(2)}%</span>
      </div>
      <div>
        <span className="text-slate-500">Iterations:</span>
        <span className="ml-1 font-semibold">{result.iterations}</span>
      </div>
      <div>
        <span className="text-slate-500">Power:</span>
        <span className="ml-1 font-semibold">{result.power.toFixed(2)} W</span>
      </div>
      <div>
        <span className="text-slate-500">Converged:</span>
        <span className="ml-1 font-semibold">{result.converged ? '✓' : '✗'}</span>
      </div>
    </div>
  </button>
);

interface MPPTResult {
  voltage: number;
  current: number;
  power: number;
  efficiency: number;
  iterations: number;
  converged: boolean;
}

export default function App() {
  // Environmental conditions state
  const [irradiance, setIrradiance] = useState(1000);
  const [temperature, setTemperature] = useState(25);
  const [panelParams] = useState<SolarPanelParams>(DEFAULT_PANEL_PARAMS);

  // Simulation state
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<MPPTAlgorithm[]>([
    MPPTAlgorithm.PERTURB_OBSEERVE,
    MPPTAlgorithm.INCREMENTAL_CONDUCTANCE,
    MPPTAlgorithm.CONSTANT_VOLTAGE,
    MPPTAlgorithm.FRACTIONAL_SC,
  ]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Generate I-V curve based on current conditions
  const ivCurve = useMemo(() => {
    const conditions: EnvironmentalConditions = { irradiance, temperature };
    return generateIVCurve(panelParams, conditions, 100);
  }, [irradiance, temperature, panelParams]);

  // Find MPP from curve
  const mpp = useMemo(() => findMPP(ivCurve), [ivCurve]);

  // Run MPPT for all selected algorithms
  const algorithmResults = useMemo(() => {
    const conditions: EnvironmentalConditions = { irradiance, temperature };
    const results: Record<MPPTAlgorithm, MPPTResult> = {} as any;

    selectedAlgorithms.forEach((algo) => {
      results[algo] = runMPPT(algo, panelParams, conditions);
    });

    return results;
  }, [irradiance, temperature, selectedAlgorithms, panelParams]);

  // Generate simulation scenarios
  const simulationScenarios = useMemo(() => {
    const scenarios: EnvironmentalConditions[] = [];
    const steps = 20;

    // Scenario 1: Varying irradiance (morning to noon to evening)
    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      const irradianceProfile = 200 + 800 * Math.sin(progress * Math.PI);
      scenarios.push({
        irradiance: irradianceProfile,
        temperature: 20 + 10 * progress,
      });
    }

    // Scenario 2: Rapid irradiance changes (cloudy day)
    for (let i = 0; i < steps; i++) {
      const baseIrradiance = 600 + 400 * Math.sin(i * 0.5);
      const noise = (Math.random() - 0.5) * 200;
      scenarios.push({
        irradiance: Math.max(200, Math.min(1000, baseIrradiance + noise)),
        temperature: 25 + (Math.random() - 0.5) * 5,
      });
    }

    return scenarios;
  }, []);

  // Run simulation
  const [simulationResults, setSimulationResults] = useState<
    Record<MPPTAlgorithm, any[]>
  >({} as any);

  useEffect(() => {
    if (isSimulating) {
      const results: Record<MPPTAlgorithm, any[]> = {} as any;
      selectedAlgorithms.forEach((algo) => {
        results[algo] = simulateMPPTTracking(algo, panelParams, simulationScenarios, 1);
      });
      setSimulationResults(results);
      setIsSimulating(false);
    }
  }, [isSimulating]);

  // Toggle algorithm selection
  const toggleAlgorithm = (algorithm: MPPTAlgorithm) => {
    setSelectedAlgorithms((prev) =>
      prev.includes(algorithm)
        ? prev.filter((a) => a !== algorithm)
        : [...prev, algorithm]
    );
  };

  // Reset to defaults
  const resetSettings = () => {
    setIrradiance(1000);
    setTemperature(25);
    setSelectedAlgorithms([
      MPPTAlgorithm.PERTURB_OBSEERVE,
      MPPTAlgorithm.INCREMENTAL_CONDUCTANCE,
      MPPTAlgorithm.CONSTANT_VOLTAGE,
      MPPTAlgorithm.FRACTIONAL_SC,
    ]);
  };

  // Prepare chart data
  const ivChartData = useMemo(() => {
    return ivCurve.map((point, idx) => ({
      ...point,
      index: idx,
    }));
  }, [ivCurve]);

  // Prepare simulation comparison data
  const simulationComparisonData = useMemo(() => {
    if (!simulationResults[MPPTAlgorithm.PERTURB_OBSEERVE]?.length) return [];

    const maxTime = Math.max(
      ...selectedAlgorithms.map(
        (algo) => simulationResults[algo]?.length || 0
      )
    );

    const data = [];
    for (let i = 0; i < maxTime; i++) {
      const entry: any = { time: i };
      selectedAlgorithms.forEach((algo) => {
        const result = simulationResults[algo]?.[i];
        if (result) {
          entry[`${algo} Power`] = result.result.power;
          entry[`${algo} Efficiency`] = result.result.efficiency;
          entry[`${algo} Optimal`] = result.optimalPower;
        }
      });
      data.push(entry);
    }
    return data;
  }, [simulationResults, selectedAlgorithms]);

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    if (!simulationResults[MPPTAlgorithm.PERTURB_OBSEERVE]?.length) return null;

    const resultsArray = selectedAlgorithms.map(
      (algo) =>
        simulationResults[algo]?.map((r) => ({
          time: r.time,
          result: r.result,
          optimalPower: r.optimalPower,
        })) || []
    );

    return calculatePerformanceMetrics(resultsArray);
  }, [simulationResults, selectedAlgorithms]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                <Sun className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  MPPT Algorithm Simulator
                </h1>
                <p className="text-sm text-slate-500">
                  Solar Panel Maximum Power Point Tracking Comparison
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetSettings}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Reset Settings"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Environmental Controls */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Environmental Conditions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Slider
                label="Solar Irradiance"
                value={irradiance}
                min={200}
                max={1200}
                step={50}
                onChange={setIrradiance}
                unit="W/m²"
                icon={Sun}
              />
              <Slider
                label="Cell Temperature"
                value={temperature}
                min={-10}
                max={80}
                step={1}
                onChange={setTemperature}
                unit="°C"
                icon={Thermometer}
              />
            </div>
          </div>
        </section>

        {/* Real-time Metrics */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Maximum Power"
              value={mpp.power}
              unit="W"
              icon={Zap}
              color="bg-amber-500"
            />
            <StatCard
              label="Optimal Voltage"
              value={mpp.voltage}
              unit="V"
              icon={Target}
              color="bg-blue-500"
            />
            <StatCard
              label="Optimal Current"
              value={mpp.current}
              unit="A"
              icon={Activity}
              color="bg-green-500"
            />
            <StatCard
              label="Theoretical Efficiency"
              value={calculateMaxPower(panelParams, { irradiance, temperature }) / (irradiance * 1.7) * 100}
              unit="%"
              icon={TrendingUp}
              color="bg-purple-500"
            />
          </div>
        </section>

        {/* I-V and P-V Characteristic Curves */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <LineChartIcon className="w-5 h-5" />
              I-V and P-V Characteristic Curves
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* I-V Curve */}
              <div className="h-80">
                <h3 className="text-sm font-medium text-slate-600 mb-2">
                  Current-Voltage (I-V) Curve
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ivChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="voltage"
                      label={{
                        value: 'Voltage (V)',
                        position: 'bottom',
                        offset: 0,
                      }}
                      stroke="#64748b"
                    />
                    <YAxis
                      label={{
                        value: 'Current (A)',
                        angle: -90,
                        position: 'insideLeft',
                      }}
                      stroke="#64748b"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="current"
                      name="Current"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                    {/* Mark MPP */}
                    <Line
                      type="monotone"
                      data={ivCurve.filter((p) => Math.abs(p.power - mpp.power) < 0.1)}
                      dataKey="current"
                      name="MPP"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#f59e0b' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* P-V Curve */}
              <div className="h-80">
                <h3 className="text-sm font-medium text-slate-600 mb-2">
                  Power-Voltage (P-V) Curve
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ivChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="voltage"
                      label={{
                        value: 'Voltage (V)',
                        position: 'bottom',
                        offset: 0,
                      }}
                      stroke="#64748b"
                    />
                    <YAxis
                      label={{
                        value: 'Power (W)',
                        angle: -90,
                        position: 'insideLeft',
                      }}
                      stroke="#64748b"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="power"
                      name="Power"
                      stroke="#10b981"
                      fill="url(#powerGradient)"
                      strokeWidth={2}
                    />
                    <defs>
                      <linearGradient
                        id="powerGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {/* Mark MPP */}
                    <Line
                      type="monotone"
                      data={ivCurve.filter((p) => Math.abs(p.power - mpp.power) < 0.1)}
                      dataKey="power"
                      name="MPP"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ r: 6, fill: '#f59e0b' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* MPPT Algorithm Selection */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              MPPT Algorithms
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.values(MPPTAlgorithm).map((algo) => (
                <AlgorithmCard
                  key={algo}
                  algorithm={algo}
                  result={algorithmResults[algo]}
                  isSelected={selectedAlgorithms.includes(algo)}
                  onClick={() => toggleAlgorithm(algo)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Algorithm Comparison Results */}
        {selectedAlgorithms.length > 0 && (
          <section className="mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Algorithm Performance Comparison
              </h2>

              {/* Efficiency Bar Chart */}
              <div className="h-80 mb-6">
                <h3 className="text-sm font-medium text-slate-600 mb-2">
                  Efficiency Comparison (%)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={selectedAlgorithms.map((algo) => ({
                      algorithm: algo,
                      efficiency: algorithmResults[algo]?.efficiency || 0,
                      power: algorithmResults[algo]?.power || 0,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="algorithm"
                      stroke="#64748b"
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis
                      label={{
                        value: 'Efficiency (%)',
                        angle: -90,
                        position: 'insideLeft',
                      }}
                      stroke="#64748b"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg border border-slate-700">
                              <p className="font-semibold mb-2">{data.algorithm}</p>
                              <p className="text-green-400">
                                Efficiency: {data.efficiency.toFixed(2)}%
                              </p>
                              <p className="text-amber-400">
                                Power: {data.power.toFixed(2)} W
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="efficiency"
                      name="Efficiency"
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Detailed Metrics Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">
                        Algorithm
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">
                        Voltage (V)
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">
                        Current (A)
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">
                        Power (W)
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">
                        Efficiency (%)
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">
                        Iterations
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">
                        Converged
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAlgorithms.map((algo) => {
                      const result = algorithmResults[algo];
                      return (
                        <tr
                          key={algo}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 font-medium text-slate-900">
                            {algo}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {result.voltage.toFixed(3)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {result.current.toFixed(3)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600">
                            {result.power.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`px-2 py-1 rounded-full text-sm font-medium ${
                                result.efficiency >= 99
                                  ? 'bg-green-100 text-green-700'
                                  : result.efficiency >= 95
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {result.efficiency.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {result.iterations}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {result.converged ? (
                              <span className="text-green-500">✓</span>
                            ) : (
                              <span className="text-red-500">✗</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Simulation Section */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Dynamic Simulation
              </h2>
              <button
                onClick={() => setIsSimulating(true)}
                disabled={isSimulating}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSimulating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Simulation
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Simulate MPPT algorithm performance under varying environmental
              conditions (20 time steps with changing irradiance and temperature).
            </p>

            {performanceMetrics && (
              <>
                {/* Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {selectedAlgorithms.map((algo) => {
                    const metrics = performanceMetrics[algo];
                    return (
                      <div
                        key={algo}
                        className="bg-slate-50 rounded-xl p-4 border border-slate-200"
                      >
                        <h3 className="font-semibold text-slate-900 mb-3">
                          {algo}
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Avg Efficiency:</span>
                            <span className="font-semibold text-green-600">
                              {metrics?.averageEfficiency.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Min Efficiency:</span>
                            <span className="font-semibold">
                              {metrics?.minEfficiency.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Max Efficiency:</span>
                            <span className="font-semibold">
                              {metrics?.maxEfficiency.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Avg Iterations:</span>
                            <span className="font-semibold">
                              {metrics?.averageIterations.toFixed(1)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Convergence:</span>
                            <span className="font-semibold text-blue-600">
                              {metrics?.convergenceRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Power Tracking Over Time */}
                <div className="h-96 mb-6">
                  <h3 className="text-sm font-medium text-slate-600 mb-2">
                    Power Tracking Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simulationComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="time"
                        label={{
                          value: 'Time Step',
                          position: 'bottom',
                          offset: 0,
                        }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{
                          value: 'Power (W)',
                          angle: -90,
                          position: 'insideLeft',
                        }}
                        stroke="#64748b"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {selectedAlgorithms.map((algo, idx) => (
                        <Line
                          key={algo}
                          type="monotone"
                          dataKey={`${algo} Power`}
                          name={`${algo} Power`}
                          stroke={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][idx % 4]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Efficiency Over Time */}
                <div className="h-96">
                  <h3 className="text-sm font-medium text-slate-600 mb-2">
                    Efficiency Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simulationComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="time"
                        label={{
                          value: 'Time Step',
                          position: 'bottom',
                          offset: 0,
                        }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{
                          value: 'Efficiency (%)',
                          angle: -90,
                          position: 'insideLeft',
                        }}
                        stroke="#64748b"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {selectedAlgorithms.map((algo, idx) => (
                        <Line
                          key={algo}
                          type="monotone"
                          dataKey={`${algo} Efficiency`}
                          name={`${algo} Efficiency`}
                          stroke={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][idx % 4]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Algorithm Information */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Algorithm Descriptions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Perturb and Observe (P&O)
                  </h3>
                  <p className="text-sm text-slate-600">
                    The most widely used MPPT algorithm. It perturbs the operating
                    voltage by a small step and observes the resulting change in
                    power. If power increases, the perturbation continues in the same
                    direction. Simple to implement but can oscillate around MPP.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Incremental Conductance (IncCond)
                  </h3>
                  <p className="text-sm text-slate-600">
                    Based on the principle that at MPP, dP/dV = 0, which means
                    dI/dV = -I/V. More accurate than P&O and can track MPP under
                    rapidly changing conditions without oscillation. Requires more
                    computational resources.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Constant Voltage (CV)
                  </h3>
                  <p className="text-sm text-slate-600">
                    Assumes that the voltage at MPP is a constant fraction of the
                    open-circuit voltage (typically ~0.76 for silicon cells). Very
                    simple and fast, but doesn't adapt well to temperature changes.
                    Often used as a backup or initial tracking method.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Fractional Short-Circuit Current (FSCC)
                  </h3>
                  <p className="text-sm text-slate-600">
                    Uses the relationship that MPP current is a constant fraction of
                    the short-circuit current (typically ~0.81). Requires periodic
                    measurement of Isc by momentarily shorting the panel. Simple
                    implementation with good accuracy under constant temperature.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-slate-500 py-8">
          <p>
            MPPT Algorithm Simulator • Solar Panel Characteristic Modeling &
            Performance Comparison
          </p>
        </footer>
      </main>
    </div>
  );
}
