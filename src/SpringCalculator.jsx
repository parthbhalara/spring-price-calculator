import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Info, Calculator } from 'lucide-react';

// Material properties
const MATERIALS = {
  'Steel ASTM A228': { density: 7.85, G: 79300, cost: 350 },
  'Stainless Steel 302': { density: 7.92, G: 69000, cost: 550 },
  'Chrome Silicon': { density: 7.85, G: 77200, cost: 400 },
  'Phosphor Bronze': { density: 8.8, G: 41400, cost: 600 },
  'Inconel X750': { density: 8.28, G: 79300, cost: 950 },
  'Custom': { density: 7.85, G: 79300, cost: 300 }
};

// Add InfoTooltip component
const InfoTooltip = ({ text }) => (
  <div className="group relative inline-block ml-1">
    <Info size={16} className="text-gray-400 inline" />
    <div className="opacity-0 bg-black text-white text-sm rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 w-48 text-center">
      {text}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-black"></div>
    </div>
  </div>
);

const SpringCalculator = () => {
  // Input state
  const [inputs, setInputs] = useState({
    wireD: 2.0,
    diameter: 10.0,
    diameterType: 'outer', // 'outer', 'inner', or 'mean'
    coilsTotal: 10,
    coilsActive: 8,
    freeLength: 50,
    loadHeight: 40,
    material: 'Steel ASTM A228',
    materialCost: MATERIALS['Steel ASTM A228'].cost,
    density: MATERIALS['Steel ASTM A228'].density,
    G: MATERIALS['Steel ASTM A228'].G,
    marginRatio: 0.4, // 40% margin
    overrideMargin: false,
    manualPrice: 0,
    overrideRate: false,
    manualRate: 0
  });

  // Calculation results
  const [results, setResults] = useState({
    meanD: 0,
    wireVolume: 0,
    springWeight: 0,
    rawMaterialCost: 0,
    springRate: 0,
    loadAtL1: 0,
    sellingPrice: 0
  });
  
  // Graph data
  const [graphData, setGraphData] = useState([]);
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : parseFloat(value) || (value === '0' ? 0 : value);
    
    let newInputs = { ...inputs, [name]: newValue };
    
    // Auto-update material properties when material changes
    if (name === 'material' && value !== 'Custom') {
      newInputs = {
        ...newInputs,
        density: MATERIALS[value].density,
        G: MATERIALS[value].G,
        materialCost: MATERIALS[value].cost
      };
    }
    
    setInputs(newInputs);
  };

  // Calculate mean diameter
  const calculateMeanDiameter = () => {
    const { wireD, diameter, diameterType } = inputs;
    
    if (diameterType === 'outer') {
      return diameter - wireD;
    } else if (diameterType === 'inner') {
      return diameter + wireD;
    } else {
      return diameter;
    }
  };
  
  // Validate inputs
  const validateInputs = () => {
    const errors = {};
    
    if (inputs.wireD <= 0) errors.wireD = "Wire diameter must be positive";
    if (inputs.diameter <= 0) errors.diameter = "Diameter must be positive";
    if (inputs.coilsTotal <= 0) errors.coilsTotal = "Number of coils must be positive";
    if (inputs.coilsActive <= 0 || inputs.coilsActive > inputs.coilsTotal) 
      errors.coilsActive = "Active coils must be positive and less than or equal to total coils";
    if (inputs.freeLength <= 0) errors.freeLength = "Free length must be positive";
    if (inputs.loadHeight <= 0 || inputs.loadHeight >= inputs.freeLength) 
      errors.loadHeight = "Load height must be positive and less than free length";
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Calculate all spring parameters
  const calculateResults = () => {
    if (!validateInputs()) return;
    
    const { wireD, coilsTotal, coilsActive, freeLength, loadHeight, density, G, materialCost, marginRatio,
            overrideMargin, manualPrice, overrideRate, manualRate } = inputs;
    
    // Calculate mean diameter
    const meanD = calculateMeanDiameter();
    
    // Spring index
    const C = meanD / wireD;
    
    // Wahl correction factor
    const K = (4*C-1)/(4*C-4) + 0.615/C;
    
    // Wire length (π * meanD * coilsTotal)
    const wireLength = Math.PI * meanD * coilsTotal;
    
    // Wire volume (π * (wireD/2)² * wireLength)
    const wireVolume = Math.PI * Math.pow(wireD/2, 2) * wireLength;
    
    // Spring weight in grams (volume in mm³ * density in g/cm³ / 1000)
    const springWeight = wireVolume * density / 1000;
    
    // Raw material cost (weight in kg * cost per kg)
    const rawMaterialCost = (springWeight / 1000) * materialCost;
    
    // Spring rate (G * wireD^4 / (8 * meanD^3 * coilsActive))
    let springRate = G * Math.pow(wireD, 4) / (8 * Math.pow(meanD, 3) * coilsActive);
    springRate = overrideRate ? manualRate : springRate;
    
    // Load at L1
    const deflection = freeLength - loadHeight;
    const loadAtL1 = springRate * deflection;
    
    // Selling price
    let sellingPrice;
    if (overrideMargin) {
      sellingPrice = manualPrice;
    } else {
      sellingPrice = rawMaterialCost / marginRatio;
    }
    
    // Update results
    setResults({
      meanD,
      wireVolume,
      springWeight,
      rawMaterialCost,
      springRate,
      loadAtL1,
      sellingPrice
    });
    
    // Generate graph data for load vs deflection
    const graphPoints = [];
    const maxDeflection = freeLength;
    for (let i = 0; i <= maxDeflection; i += maxDeflection / 10) {
      graphPoints.push({
        deflection: i,
        load: springRate * i
      });
    }
    setGraphData(graphPoints);
  };
  
  // Re-calculate when inputs change
  useEffect(() => {
    calculateResults();
  }, [inputs]);
  
  // Download results as CSV
  const downloadResults = () => {
    const { meanD, wireVolume, springWeight, rawMaterialCost, springRate, loadAtL1, sellingPrice } = results;
    const csvContent = `Parameter,Value,Unit
Wire Diameter,${inputs.wireD},mm
Diameter (${inputs.diameterType}),${inputs.diameter},mm
Mean Diameter,${meanD.toFixed(2)},mm
Total Coils,${inputs.coilsTotal},
Active Coils,${inputs.coilsActive},
Free Length,${inputs.freeLength},mm
Load Height,${inputs.loadHeight},mm
Material,${inputs.material},
Material Cost,${inputs.materialCost},₹/kg
Density,${inputs.density},g/cm³
Shear Modulus (G),${inputs.G},MPa
Wire Volume,${wireVolume.toFixed(2)},mm³
Spring Weight,${springWeight.toFixed(2)},g
Raw Material Cost,${rawMaterialCost.toFixed(2)},₹
Spring Rate,${springRate.toFixed(2)},N/mm
Load at L1,${loadAtL1.toFixed(2)},N
Selling Price,${sellingPrice.toFixed(2)},₹
`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'spring_calculations.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Spring Pricing & Parameter Calculator</h1>
          <p className="text-gray-600">Calculate spring parameters, costs, and view load-deflection characteristics</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Module */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                Input Parameters
                <InfoTooltip text="Enter the spring specifications and material properties" />
              </h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                {/* Geometry Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    Spring Geometry
                    <InfoTooltip text="Define the physical dimensions of your spring" />
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Wire Diameter Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Wire Diameter (mm)
                        <InfoTooltip text="The thickness of the wire used to make the spring" />
                      </label>
                      <input
                        type="number"
                        name="wireD"
                        value={inputs.wireD}
                        onChange={handleInputChange}
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          validationErrors.wireD ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {validationErrors.wireD && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.wireD}</p>
                      )}
                    </div>

                    {/* Diameter Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Diameter Type
                        <InfoTooltip text="Select the type of diameter measurement" />
                      </label>
                      <select
                        name="diameterType"
                        value={inputs.diameterType}
                        onChange={handleInputChange}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                      >
                        <option value="outer">Outer Diameter</option>
                        <option value="inner">Inner Diameter</option>
                        <option value="mean">Mean Diameter</option>
                      </select>
                    </div>

                    {/* Diameter Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {inputs.diameterType === 'outer' ? 'Outer' : inputs.diameterType === 'inner' ? 'Inner' : 'Mean'} Diameter (mm)
                        <InfoTooltip text={`The ${inputs.diameterType} diameter of the spring`} />
                      </label>
                      <input
                        type="number"
                        name="diameter"
                        value={inputs.diameter}
                        onChange={handleInputChange}
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          validationErrors.diameter ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {validationErrors.diameter && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.diameter}</p>
                      )}
                    </div>

                    {/* Total Coils */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Coils
                        <InfoTooltip text="Total number of coils in the spring" />
                      </label>
                      <input
                        type="number"
                        name="coilsTotal"
                        value={inputs.coilsTotal}
                        onChange={handleInputChange}
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          validationErrors.coilsTotal ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {validationErrors.coilsTotal && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.coilsTotal}</p>
                      )}
                    </div>

                    {/* Active Coils */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Active Coils
                        <InfoTooltip text="Number of coils that contribute to spring action" />
                      </label>
                      <input
                        type="number"
                        name="coilsActive"
                        value={inputs.coilsActive}
                        onChange={handleInputChange}
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          validationErrors.coilsActive ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {validationErrors.coilsActive && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.coilsActive}</p>
                      )}
                    </div>

                    {/* Free Length */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Free Length (mm)
                        <InfoTooltip text="Uncompressed length of the spring" />
                      </label>
                      <input
                        type="number"
                        name="freeLength"
                        value={inputs.freeLength}
                        onChange={handleInputChange}
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          validationErrors.freeLength ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {validationErrors.freeLength && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.freeLength}</p>
                      )}
                    </div>

                    {/* Load Height */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Load Height (mm)
                        <InfoTooltip text="Height of the spring under load" />
                      </label>
                      <input
                        type="number"
                        name="loadHeight"
                        value={inputs.loadHeight}
                        onChange={handleInputChange}
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          validationErrors.loadHeight ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {validationErrors.loadHeight && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.loadHeight}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Material Properties Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    Material Properties
                    <InfoTooltip text="Select material and specify its properties" />
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Material Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Material
                        <InfoTooltip text="Select the spring material" />
                      </label>
                      <select
                        name="material"
                        value={inputs.material}
                        onChange={handleInputChange}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                      >
                        {Object.keys(MATERIALS).map((mat) => (
                          <option key={mat} value={mat}>{mat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Material Cost */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Material Cost (₹/kg)
                        <InfoTooltip text="Cost of the material per kilogram" />
                      </label>
                      <input
                        type="number"
                        name="materialCost"
                        value={inputs.materialCost}
                        onChange={handleInputChange}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                      />
                    </div>

                    {/* Density */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Density (g/cm³)
                        <InfoTooltip text="Material density" />
                      </label>
                      <input
                        type="number"
                        name="density"
                        value={inputs.density}
                        onChange={handleInputChange}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                      />
                    </div>

                    {/* Shear Modulus */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Shear Modulus G (MPa)
                        <InfoTooltip text="Material shear modulus" />
                      </label>
                      <input
                        type="number"
                        name="G"
                        value={inputs.G}
                        onChange={handleInputChange}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    Pricing & Overrides
                    <InfoTooltip text="Configure pricing parameters and overrides" />
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Margin Ratio */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Margin Ratio (0-1)
                        <InfoTooltip text="Profit margin ratio" />
                      </label>
                      <input
                        type="number"
                        name="marginRatio"
                        value={inputs.marginRatio}
                        onChange={handleInputChange}
                        min="0"
                        max="1"
                        step="0.01"
                        disabled={inputs.overrideMargin}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 disabled:bg-gray-100"
                      />
                    </div>

                    {/* Override Margin Checkbox */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="overrideMargin"
                        checked={inputs.overrideMargin}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label className="ml-2 text-sm font-medium text-gray-700">
                        Override Price
                        <InfoTooltip text="Enable manual price override" />
                      </label>
                    </div>

                    {/* Manual Price */}
                    {inputs.overrideMargin && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Manual Price (₹)
                          <InfoTooltip text="Set a custom selling price" />
                        </label>
                        <input
                          type="number"
                          name="manualPrice"
                          value={inputs.manualPrice}
                          onChange={handleInputChange}
                          className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        />
                      </div>
                    )}

                    {/* Override Rate Checkbox */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="overrideRate"
                        checked={inputs.overrideRate}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label className="ml-2 text-sm font-medium text-gray-700">
                        Override Spring Rate
                        <InfoTooltip text="Enable manual spring rate override" />
                      </label>
                    </div>

                    {/* Manual Spring Rate */}
                    {inputs.overrideRate && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Manual Spring Rate (N/mm)
                          <InfoTooltip text="Set a custom spring rate" />
                        </label>
                        <input
                          type="number"
                          name="manualRate"
                          value={inputs.manualRate}
                          onChange={handleInputChange}
                          className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Calculate Button */}
                <button
                  onClick={calculateResults}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <Calculator size={20} />
                  <span>Calculate Results</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Module */}
          <div className="space-y-6">
            {/* Results Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  Results
                  <InfoTooltip text="Calculated spring parameters and costs" />
                </h2>
                <button
                  onClick={downloadResults}
                  className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg transition-colors duration-200"
                >
                  <Download size={16} />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Result Cards */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">Mean Diameter</p>
                    <p className="text-2xl font-bold text-gray-900">{results.meanD.toFixed(2)} <span className="text-sm font-normal text-gray-500">mm</span></p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">Wire Volume</p>
                    <p className="text-2xl font-bold text-gray-900">{results.wireVolume.toFixed(2)} <span className="text-sm font-normal text-gray-500">mm³</span></p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">Spring Weight</p>
                    <p className="text-2xl font-bold text-gray-900">{results.springWeight.toFixed(2)} <span className="text-sm font-normal text-gray-500">g</span></p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">Raw Material Cost</p>
                    <p className="text-2xl font-bold text-gray-900">₹{results.rawMaterialCost.toFixed(2)}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">Spring Rate (K)</p>
                    <p className="text-2xl font-bold text-gray-900">{results.springRate.toFixed(2)} <span className="text-sm font-normal text-gray-500">N/mm</span></p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">Load at Load Height</p>
                    <p className="text-2xl font-bold text-gray-900">{results.loadAtL1.toFixed(2)} <span className="text-sm font-normal text-gray-500">N</span></p>
                  </div>

                  <div className="col-span-2 bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-600">Selling Price</p>
                    <p className="text-3xl font-bold text-blue-900">₹{results.sellingPrice.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Graph Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  Load vs Deflection Curve
                  <InfoTooltip text="Visual representation of spring behavior under load" />
                </h2>
              </div>

              <div className="p-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={graphData}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="deflection"
                        label={{ value: 'Deflection (mm)', position: 'insideBottom', offset: -5 }}
                        stroke="#6B7280"
                      />
                      <YAxis
                        label={{ value: 'Load (N)', angle: -90, position: 'insideLeft' }}
                        stroke="#6B7280"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#FFF', borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}
                        formatter={(value) => [`${value.toFixed(2)} N`, 'Load']}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="load"
                        stroke="#6366F1"
                        name="Spring Load"
                        dot={false}
                        strokeWidth={3}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpringCalculator; 