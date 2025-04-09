import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Info, Calculator, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';

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

// Add quantity analysis points
const QUANTITY_POINTS = [10, 50, 500, 1000, 5000, 10000, 20000, 50000, 100000, 200000];

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
    customMaterialName: '',
    materialCost: MATERIALS['Steel ASTM A228'].cost,
    density: MATERIALS['Steel ASTM A228'].density,
    G: MATERIALS['Steel ASTM A228'].G,
    marginRatio: 0.4, // 40% margin
    overrideMargin: false,
    manualPrice: 0,
    overrideRate: false,
    manualRate: 0,
    setupCost: 5000, // Default setup cost
    quantity: 1000, // Default quantity
    wireDTolerance: 0.02,
    odTolerance: 0.5,
    flTolerance: 1,
    coilDirection: '',
    finish: '',
    ends: '',
    otherNotes: '',
  });

  // Calculation results
  const [results, setResults] = useState({
    meanD: 0,
    od: 0,
    id: 0,
    wireVolume: 0,
    springWeight: 0,
    rawMaterialCost: 0,
    springRate: 0,
    loadAtL1: 0,
    sellingPrice: 0,
    pricePerSpring: 0,
    overallSellingPrice: 0,
    totalWireWeight: 0
  });
  
  // Graph data
  const [graphData, setGraphData] = useState([]);
  
  // Quantity analysis data
  const [quantityAnalysisData, setQuantityAnalysisData] = useState([]);
  
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
            overrideMargin, manualPrice, overrideRate, manualRate, setupCost, quantity } = inputs;
    
    // Calculate mean diameter
    const meanD = calculateMeanDiameter();
    
    // Calculate outer and inner diameters
    const od = meanD + wireD;
    const id = meanD - wireD;
    
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
    
    // Calculate price per spring
    let pricePerSpring;
    if (overrideMargin) {
      pricePerSpring = manualPrice;
    } else {
      pricePerSpring = rawMaterialCost / marginRatio;
    }
    
    // Calculate overall selling price
    const overallSellingPrice = (setupCost + (pricePerSpring * quantity)) / quantity;
    
    // Calculate total wire weight for production quantity
    const totalWireWeight = (springWeight * quantity) / 1000; // Convert to kg
    
    // Update results
    setResults({
      meanD,
      od,
      id,
      wireVolume,
      springWeight,
      rawMaterialCost,
      springRate,
      loadAtL1,
      sellingPrice: pricePerSpring,
      pricePerSpring,
      overallSellingPrice,
      totalWireWeight
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

    // Generate quantity analysis data
    const quantityPoints = QUANTITY_POINTS.map(qty => ({
      quantity: qty,
      price: (setupCost + (pricePerSpring * qty)) / qty
    }));
    setQuantityAnalysisData(quantityPoints);
  };
  
  // Re-calculate when inputs change
  useEffect(() => {
    calculateResults();
  }, [inputs]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Download results as CSV
  const downloadResults = () => {
    const { meanD, wireVolume, springWeight, rawMaterialCost, springRate, loadAtL1, sellingPrice, pricePerSpring, overallSellingPrice, totalWireWeight } = results;
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
Price per Spring,${pricePerSpring.toFixed(2)},₹
Overall Selling Price,${overallSellingPrice.toFixed(2)},₹
Total Wire Weight,${totalWireWeight.toFixed(2)},kg
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

  const downloadSpecificationsAsPDF = () => {
    const doc = new jsPDF();
    const lineHeight = 7;
    let y = 20;

    // Add title
    doc.setFontSize(16);
    doc.text('Spring Specifications Summary', 20, y);
    y += lineHeight * 2;

    // Add technical specifications
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Technical Specifications:', 20, y);
    y += lineHeight;

    doc.setFont(undefined, 'normal');
    const specs = [
      `Wire Diameter: ${inputs.wireD} ± ${inputs.wireDTolerance} mm`,
      `Outer Diameter: ${results.od} ± ${inputs.odTolerance} mm`,
      `Inner Diameter: ${results.id} mm`,
      `Mean Diameter: ${results.meanD} mm`,
      `Total Coils: ${inputs.coilsTotal}`,
      `Active Coils: ${inputs.coilsActive}`,
      `Material: ${inputs.material === 'Custom' ? (inputs.customMaterialName || 'Custom Material') : inputs.material}`,
      `Coil Direction: ${inputs.coilDirection || "Not specified"}`,
      `Finish: ${inputs.finish || "Not specified"}`,
      `Ends: ${inputs.ends || "Not specified"}`
    ];

    specs.forEach(spec => {
      doc.text(spec, 20, y);
      y += lineHeight;
    });

    if (inputs.otherNotes) {
      y += lineHeight/2;
      doc.text('Additional Notes:', 20, y);
      y += lineHeight;
      doc.text(inputs.otherNotes, 20, y);
      y += lineHeight;
    }

    // Add price analysis with table
    y += lineHeight * 2;
    doc.setFont(undefined, 'bold');
    doc.text('Price Analysis:', 20, y);
    y += lineHeight * 1.5;

    // Create table headers
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y, 160, 8, 'F');
    doc.setFont(undefined, 'bold');
    doc.text('Quantity', 25, y + 6);
    doc.text('Price per Spring', 75, y + 6);
    doc.text('Total Price', 135, y + 6);
    y += lineHeight + 3;

    // Add table rows
    doc.setFont(undefined, 'normal');
    
    // Row 1: 10 pieces
    const price10 = ((inputs.setupCost + (results.pricePerSpring * 10)) / 10).toFixed(2);
    const total10 = (inputs.setupCost + (results.pricePerSpring * 10)).toFixed(2);
    doc.text('10', 25, y + 6);
    doc.text(`Rs. ${price10}`, 75, y + 6);
    doc.text(`Rs. ${total10}`, 135, y + 6);
    doc.line(20, y + 8, 180, y + 8); // Add line after row
    y += lineHeight + 3;

    // Row 2: Production quantity
    const priceQty = results.overallSellingPrice.toFixed(2);
    const totalQty = (inputs.setupCost + (results.pricePerSpring * inputs.quantity)).toFixed(2);
    doc.text(inputs.quantity.toString(), 25, y + 6);
    doc.text(`Rs. ${priceQty}`, 75, y + 6);
    doc.text(`Rs. ${totalQty}`, 135, y + 6);
    doc.line(20, y + 8, 180, y + 8); // Add line after row

    // Add vertical lines for table
    doc.line(20, y - lineHeight - 11, 20, y + 8); // Left border
    doc.line(70, y - lineHeight - 11, 70, y + 8); // After Quantity
    doc.line(130, y - lineHeight - 11, 130, y + 8); // After Price per Spring
    doc.line(180, y - lineHeight - 11, 180, y + 8); // Right border

    // Save the PDF
    doc.save('spring_specifications.pdf');
  };

  const downloadSpecificationsAsCSV = () => {
    const csvContent = `Spring Specifications
Wire Diameter (mm),${inputs.wireD} ± ${inputs.wireDTolerance}
Outer Diameter (mm),${results.od} ± ${inputs.odTolerance}
Inner Diameter (mm),${results.id}
Mean Diameter (mm),${results.meanD}
Total Coils,${inputs.coilsTotal}
Active Coils,${inputs.coilsActive}
Material,${inputs.material === 'Custom' ? (inputs.customMaterialName || 'Custom Material') : inputs.material}
Coil Direction,${inputs.coilDirection || "Not specified"}
Finish,${inputs.finish || "Not specified"}
Ends,${inputs.ends || "Not specified"}
${inputs.otherNotes ? `Additional Notes,${inputs.otherNotes}` : ''}

Price Analysis
Quantity,Price per Spring (₹),Total Price (₹)
10,${((inputs.setupCost + (results.pricePerSpring * 10)) / 10).toFixed(2)},${(inputs.setupCost + (results.pricePerSpring * 10)).toFixed(2)}
${inputs.quantity},${results.overallSellingPrice.toFixed(2)},${(inputs.setupCost + (results.pricePerSpring * inputs.quantity)).toFixed(2)}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'spring_specifications.csv';
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
                    {/* Wire Diameter Input with Tolerance */}
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Wire Diameter Tolerance (±mm)
                          <InfoTooltip text="Allowable variation in wire diameter" />
                        </label>
                        <input
                          type="number"
                          name="wireDTolerance"
                          step="0.01"
                          value={inputs.wireDTolerance}
                          onChange={handleInputChange}
                          className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        />
                      </div>
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

                    {/* Diameter Input with Tolerance */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {inputs.diameterType === 'outer' ? 'Outer' : inputs.diameterType === 'inner' ? 'Inner' : 'Mean'} Diameter (mm)
                        <InfoTooltip text={`The ${inputs.diameterType} diameter of the spring`} />
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          name="diameter"
                          value={inputs.diameter}
                          onChange={handleInputChange}
                          className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            validationErrors.diameter ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        />
                        {inputs.diameterType === 'outer' && (
                          <div className="w-1/2">
                            <input
                              type="number"
                              name="odTolerance"
                              step="0.1"
                              value={inputs.odTolerance}
                              onChange={handleInputChange}
                              placeholder="±mm"
                              className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                            />
                          </div>
                        )}
                      </div>
                      {validationErrors.diameter && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.diameter}</p>
                      )}
                    </div>

                    {/* Free Length with Tolerance */}
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Free Length Tolerance (±mm)
                          <InfoTooltip text="Allowable variation in free length" />
                        </label>
                        <input
                          type="number"
                          name="flTolerance"
                          step="0.1"
                          value={inputs.flTolerance}
                          onChange={handleInputChange}
                          className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        />
                      </div>
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
                        <InfoTooltip text="Select the spring material or choose Custom to enter your own" />
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

                    {/* Custom Material Name - Only show when Custom is selected */}
                    {inputs.material === 'Custom' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Custom Material Name
                          <InfoTooltip text="Enter the name of your custom material" />
                        </label>
                        <input
                          type="text"
                          name="customMaterialName"
                          value={inputs.customMaterialName}
                          onChange={handleInputChange}
                          placeholder="Enter material name"
                          className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        />
                      </div>
                    )}

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
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 ${
                          inputs.material !== 'Custom' ? 'bg-gray-50' : ''
                        }`}
                        readOnly={inputs.material !== 'Custom'}
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
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 ${
                          inputs.material !== 'Custom' ? 'bg-gray-50' : ''
                        }`}
                        readOnly={inputs.material !== 'Custom'}
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
                        className={`block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 ${
                          inputs.material !== 'Custom' ? 'bg-gray-50' : ''
                        }`}
                        readOnly={inputs.material !== 'Custom'}
                      />
                    </div>
                  </div>
                </div>

                {/* Add Additional Specifications section after Material Properties */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    Additional Specifications
                    <InfoTooltip text="Specify additional spring characteristics" />
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Coil Direction
                        <InfoTooltip text="Direction of coil winding (e.g., Right Hand, Left Hand)" />
                      </label>
                      <input
                        type="text"
                        name="coilDirection"
                        value={inputs.coilDirection}
                        onChange={handleInputChange}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        placeholder="e.g., Right Hand"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Finish
                        <InfoTooltip text="Surface treatment or coating specification" />
                      </label>
                      <input
                        type="text"
                        name="finish"
                        value={inputs.finish}
                        onChange={handleInputChange}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        placeholder="e.g., Plain, Zinc Plated"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ends
                        <InfoTooltip text="End condition specification" />
                      </label>
                      <input
                        type="text"
                        name="ends"
                        value={inputs.ends}
                        onChange={handleInputChange}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        placeholder="e.g., Closed and Ground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Other Notes
                        <InfoTooltip text="Any additional specifications or requirements" />
                      </label>
                      <textarea
                        name="otherNotes"
                        value={inputs.otherNotes}
                        onChange={handleInputChange}
                        rows={3}
                        className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                        placeholder="Any additional specifications or notes"
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

                {/* Add Production Settings Section */}
                <div className="p-6 border-t border-gray-200">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        Production Settings
                        <InfoTooltip text="Configure production parameters" />
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Setup Cost */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Setup Cost (₹)
                            <InfoTooltip text="Initial setup cost for production" />
                          </label>
                          <input
                            type="number"
                            name="setupCost"
                            value={inputs.setupCost}
                            onChange={handleInputChange}
                            className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                          />
                        </div>

                        {/* Production Quantity */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Production Quantity
                            <InfoTooltip text="Number of springs to be produced" />
                          </label>
                          <input
                            type="number"
                            name="quantity"
                            value={inputs.quantity}
                            onChange={handleInputChange}
                            className="block w-full rounded-md shadow-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                          />
                        </div>
                      </div>
                    </div>
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
                    <p className="text-sm font-medium text-blue-600">Price per Spring</p>
                    <p className="text-2xl font-bold text-blue-900">₹{results.pricePerSpring.toFixed(2)}</p>
                  </div>

                  <div className="col-span-2 bg-green-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-green-600">Overall Selling Price</p>
                    <p className="text-3xl font-bold text-green-900">₹{results.overallSellingPrice.toFixed(2)}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">Total Wire Weight</p>
                    <p className="text-2xl font-bold text-gray-900">{results.totalWireWeight.toFixed(2)} <span className="text-sm font-normal text-gray-500">kg</span></p>
                    <p className="text-xs text-gray-500 mt-1">For {inputs.quantity.toLocaleString()} springs</p>
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

            {/* Price vs Quantity Analysis Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  Price vs Quantity Analysis
                  <InfoTooltip text="How the overall selling price changes with production quantity" />
                </h2>
              </div>

              <div className="p-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={quantityAnalysisData}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="quantity"
                        label={{ value: 'Production Quantity', position: 'insideBottom', offset: -5 }}
                        stroke="#6B7280"
                        type="number"
                        scale="log"
                        domain={['dataMin', 'dataMax']}
                      />
                      <YAxis
                        label={{ value: 'Price per Spring (₹)', angle: -90, position: 'insideLeft' }}
                        stroke="#6B7280"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#FFF', borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}
                        formatter={(value) => [`₹${value.toFixed(2)}`, 'Price']}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#F97316"
                        name="Price per Spring"
                        dot={true}
                        strokeWidth={3}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Specifications Summary Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  Specifications Summary
                  <InfoTooltip text="Complete spring specifications and pricing summary" />
                </h2>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  {/* Technical Specifications */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Technical Specifications</h3>
                    <div className="space-y-2 font-mono text-sm">
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Spring Wire Diameter:</span>
                        <span className="text-gray-900">{inputs.wireD} ± {inputs.wireDTolerance} mm</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Spring Outer Diameter:</span>
                        <span className="text-gray-900">{results.od} ± {inputs.odTolerance} mm</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Spring Inner Diameter:</span>
                        <span className="text-gray-900">{results.id} mm</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Spring Mean Diameter:</span>
                        <span className="text-gray-900">{results.meanD} mm</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Total Coils:</span>
                        <span className="text-gray-900">{inputs.coilsTotal}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Active Coils:</span>
                        <span className="text-gray-900">{inputs.coilsActive}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Material:</span>
                        <span className="text-gray-900">
                          {inputs.material === 'Custom' ? 
                            (inputs.customMaterialName || 'Custom Material') : 
                            inputs.material}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Coil Direction:</span>
                        <span className="text-gray-900">{inputs.coilDirection || "Not specified"}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Finish:</span>
                        <span className="text-gray-900">{inputs.finish || "Not specified"}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 py-2">
                        <span className="text-gray-600">Ends:</span>
                        <span className="text-gray-900">{inputs.ends || "Not specified"}</span>
                      </div>
                      {inputs.otherNotes && (
                        <div className="flex justify-between border-b border-gray-200 py-2">
                          <span className="text-gray-600">Additional Notes:</span>
                          <span className="text-gray-900">{inputs.otherNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Analysis Table */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Price Analysis</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price per Spring</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">10</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{((inputs.setupCost + (results.pricePerSpring * 10)) / 10).toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(inputs.setupCost + (results.pricePerSpring * 10)).toFixed(2)}</td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inputs.quantity.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{results.overallSellingPrice.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{(inputs.setupCost + (results.pricePerSpring * inputs.quantity)).toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Download Buttons */}
                  <div className="flex gap-4">
                    <button
                      onClick={downloadSpecificationsAsPDF}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <FileText size={20} />
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={downloadSpecificationsAsCSV}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <FileSpreadsheet size={20} />
                      <span>Download CSV</span>
                    </button>
                  </div>
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