import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Save, FileText, Download } from 'lucide-react';
import './App.css';

// Material properties
const MATERIALS = {
  'Steel ASTM A228': { density: 7.85, G: 79300, cost: 350 },
  'Stainless Steel 302': { density: 7.92, G: 69000, cost: 550 },
  'Chrome Silicon': { density: 7.85, G: 77200, cost: 400 },
  'Phosphor Bronze': { density: 8.8, G: 41400, cost: 600 },
  'Inconel X750': { density: 8.28, G: 79300, cost: 950 },
  'Custom': { density: 7.85, G: 79300, cost: 300 }
};

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
    <div className="flex flex-col p-4 max-w-6xl mx-auto bg-gray-50 rounded-lg shadow">
      <h1 className="text-2xl font-bold text-center mb-6">Spring Pricing & Parameter Calculator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Module */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Input Parameters</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Geometry Inputs */}
            <div className="col-span-2">
              <h3 className="font-medium text-gray-700 mb-2">Spring Geometry</h3>
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Wire Diameter (mm)</label>
              <input
                type="number"
                name="wireD"
                value={inputs.wireD}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 ${validationErrors.wireD ? 'border-red-500' : 'border-gray-300'}`}
              />
              {validationErrors.wireD && <p className="text-red-500 text-xs mt-1">{validationErrors.wireD}</p>}
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Diameter Type</label>
              <select
                name="diameterType"
                value={inputs.diameterType}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
              >
                <option value="outer">Outer Diameter</option>
                <option value="inner">Inner Diameter</option>
                <option value="mean">Mean Diameter</option>
              </select>
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">{inputs.diameterType === 'outer' ? 'Outer' : inputs.diameterType === 'inner' ? 'Inner' : 'Mean'} Diameter (mm)</label>
              <input
                type="number"
                name="diameter"
                value={inputs.diameter}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 ${validationErrors.diameter ? 'border-red-500' : 'border-gray-300'}`}
              />
              {validationErrors.diameter && <p className="text-red-500 text-xs mt-1">{validationErrors.diameter}</p>}
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Total Coils</label>
              <input
                type="number"
                name="coilsTotal"
                value={inputs.coilsTotal}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 ${validationErrors.coilsTotal ? 'border-red-500' : 'border-gray-300'}`}
              />
              {validationErrors.coilsTotal && <p className="text-red-500 text-xs mt-1">{validationErrors.coilsTotal}</p>}
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Active Coils</label>
              <input
                type="number"
                name="coilsActive"
                value={inputs.coilsActive}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 ${validationErrors.coilsActive ? 'border-red-500' : 'border-gray-300'}`}
              />
              {validationErrors.coilsActive && <p className="text-red-500 text-xs mt-1">{validationErrors.coilsActive}</p>}
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Free Length (mm)</label>
              <input
                type="number"
                name="freeLength"
                value={inputs.freeLength}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 ${validationErrors.freeLength ? 'border-red-500' : 'border-gray-300'}`}
              />
              {validationErrors.freeLength && <p className="text-red-500 text-xs mt-1">{validationErrors.freeLength}</p>}
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Load Height (mm)</label>
              <input
                type="number"
                name="loadHeight"
                value={inputs.loadHeight}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 ${validationErrors.loadHeight ? 'border-red-500' : 'border-gray-300'}`}
              />
              {validationErrors.loadHeight && <p className="text-red-500 text-xs mt-1">{validationErrors.loadHeight}</p>}
            </div>
            
            {/* Material Properties */}
            <div className="col-span-2 mt-4">
              <h3 className="font-medium text-gray-700 mb-2">Material Properties</h3>
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Material</label>
              <select
                name="material"
                value={inputs.material}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
              >
                {Object.keys(MATERIALS).map((mat) => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Material Cost (₹/kg)</label>
              <input
                type="number"
                name="materialCost"
                value={inputs.materialCost}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
              />
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Density (g/cm³)</label>
              <input
                type="number"
                name="density"
                value={inputs.density}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
              />
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Shear Modulus G (MPa)</label>
              <input
                type="number"
                name="G"
                value={inputs.G}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
              />
            </div>
            
            {/* Pricing Overrides */}
            <div className="col-span-2 mt-4">
              <h3 className="font-medium text-gray-700 mb-2">Pricing & Overrides</h3>
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Margin Ratio (0-1)</label>
              <input
                type="number"
                name="marginRatio"
                value={inputs.marginRatio}
                onChange={handleInputChange}
                min="0"
                max="1"
                step="0.01"
                disabled={inputs.overrideMargin}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
              />
            </div>
            
            <div className="mb-2 flex items-center">
              <input
                type="checkbox"
                name="overrideMargin"
                checked={inputs.overrideMargin}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 rounded mr-2"
              />
              <label className="text-sm font-medium text-gray-700">Override Price</label>
            </div>
            
            {inputs.overrideMargin && (
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">Manual Price (₹)</label>
                <input
                  type="number"
                  name="manualPrice"
                  value={inputs.manualPrice}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
                />
              </div>
            )}
            
            <div className="mb-2 flex items-center">
              <input
                type="checkbox"
                name="overrideRate"
                checked={inputs.overrideRate}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 rounded mr-2"
              />
              <label className="text-sm font-medium text-gray-700">Override Spring Rate</label>
            </div>
            
            {inputs.overrideRate && (
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">Manual Spring Rate (N/mm)</label>
                <input
                  type="number"
                  name="manualRate"
                  value={inputs.manualRate}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
                />
              </div>
            )}
            
            <div className="col-span-2 mt-4">
              <button
                onClick={calculateResults}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
              >
                Calculate
              </button>
            </div>
          </div>
        </div>
        
        {/* Output Module */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Results</h2>
            <button
              onClick={downloadResults}
              className="flex items-center bg-green-500 hover:bg-green-600 text-white font-medium py-1 px-3 rounded text-sm"
            >
              <Download size={16} className="mr-1" /> Export Results
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Mean Diameter</p>
              <p className="text-lg font-semibold">{results.meanD.toFixed(2)} mm</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Wire Volume</p>
              <p className="text-lg font-semibold">{results.wireVolume.toFixed(2)} mm³</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Spring Weight</p>
              <p className="text-lg font-semibold">{results.springWeight.toFixed(2)} g</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Raw Material Cost</p>
              <p className="text-lg font-semibold">₹{results.rawMaterialCost.toFixed(2)}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Spring Rate (K)</p>
              <p className="text-lg font-semibold">{results.springRate.toFixed(2)} N/mm</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Load at Load Height</p>
              <p className="text-lg font-semibold">{results.loadAtL1.toFixed(2)} N</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Selling Price</p>
              <p className="text-lg font-semibold">₹{results.sellingPrice.toFixed(2)}</p>
            </div>
          </div>
          
          {/* Load vs Deflection Graph */}
          <div className="mt-6">
            <h3 className="font-medium text-gray-700 mb-2">Load vs Deflection Curve</h3>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={graphData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="deflection" 
                    label={{ value: 'Deflection (mm)', position: 'insideBottom', offset: -5 }} 
                  />
                  <YAxis 
                    label={{ value: 'Load (N)', angle: -90, position: 'insideLeft' }} 
                  />
                  <Tooltip formatter={(value) => [`${value.toFixed(2)} N`, 'Load']} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="load" 
                    stroke="#2563eb" 
                    name="Spring Load" 
                    dot={false} 
                    strokeWidth={2} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpringCalculator; 