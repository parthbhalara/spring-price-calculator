import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, HeadingLevel, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// Company constants
const COMPANY_INFO = {
    name: 'ARVAT SPRINGTECH LLP',
    phone: '+91 7600800472',
    email: 'info@arvatspringtech.com',
    website: 'www.arvatspringtech.com',
    address: 'Ground Floor, Godown No 60, Sunshine Industrial Hub - 1,\nNear Navapura Railway Crossing, Behind Pushkar Estate,\nChangodar, Ahmedabad-382213',
    gst: '24ACGFA3396M1Z2'
};

const QuotationGenerator = ({ springData, results }) => {
    const [companyInfo, setCompanyInfo] = useState({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        quotationNumber: '',
        quotationDate: new Date().toISOString().split('T')[0],
        validityPeriod: '',
        paymentTerms: '50% advance, 50% before dispatch',
        deliveryTime: ''
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCompanyInfo(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const generatePDF = () => {
        const doc = new jsPDF({
            format: 'a4',
            unit: 'mm'
        });
        
        // Add title and company details
        doc.setFontSize(16);
        doc.text(COMPANY_INFO.name, 105, 15, { align: 'center' });
        
        // Add company contact details
        doc.setFontSize(9);
        doc.text([
            `Phone: ${COMPANY_INFO.phone}`,
            `Email: ${COMPANY_INFO.email}`,
            `Website: ${COMPANY_INFO.website}`,
            `GST: ${COMPANY_INFO.gst}`
        ], 105, 25, { align: 'center' });
        
        // Add company address
        doc.text(COMPANY_INFO.address.split('\n'), 105, 40, { align: 'center' });
        
        // Add horizontal line
        doc.setDrawColor(200);
        doc.line(15, 55, 195, 55);
        
        // Format date as DD/MM/YYYY
        const formattedDate = companyInfo.quotationDate ? 
            new Date(companyInfo.quotationDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) : 
            new Date().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        
        // Add quotation details
        doc.setFontSize(11);
        doc.text(`Quotation No: ${companyInfo.quotationNumber || 'Not Specified'}`, 15, 65);
        doc.text(`Date: ${formattedDate}`, 15, 72);
        
        // Add client details
        doc.text('To:', 15, 82);
        doc.text([
            companyInfo.companyName,
            companyInfo.address,
            `Attn: ${companyInfo.contactPerson}`,
            `Email: ${companyInfo.email}`,
            `Phone: ${companyInfo.phone}`
        ], 25, 89);
        
        // Add spring specifications
        doc.setFontSize(12);
        doc.text('Spring Specifications', 15, 115);
        
        const specRows = [
            ['Wire Diameter', `${springData.wireD} mm`, 'Outer Diameter', `${results.od?.toFixed(2)} mm`],
            ['Free Length', `${springData.freeLength} mm`, 'Total Coils', springData.coilsTotal],
            ['Material', `${springData.material}${springData.materialRemark ? ` (${springData.materialRemark})` : ''}`, 'Finish', springData.finish || 'Standard'],
            ['End Type', springData.ends || 'Standard', 'Coil Direction', springData.coilDirection || 'Not specified']
        ];
        
        autoTable(doc, {
            startY: 120,
            head: [['Parameter', 'Value', 'Parameter', 'Value']],
            body: specRows,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: { 
                0: { cellWidth: 45 }, 
                1: { cellWidth: 45 }, 
                2: { cellWidth: 45 }, 
                3: { cellWidth: 45 } 
            },
            headStyles: { fillColor: [70, 70, 70] }
        });
        
        // Add pricing details
        doc.setFontSize(12);
        doc.text('Pricing Details', 15, doc.lastAutoTable.finalY + 10);
        
        const priceRows = [
            ['Quantity', springData.quantity.toString()],
            ['Overall Selling Price', `Rs. ${results.overallSellingPrice?.toFixed(2)}`]
        ];
        
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 15,
            head: [['Description', 'Value']],
            body: priceRows,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: { 
                0: { cellWidth: 90 }, 
                1: { cellWidth: 70 }
            },
            headStyles: { fillColor: [70, 70, 70] }
        });
        
        // Add terms and conditions
        doc.setFontSize(12);
        doc.text('Terms & Conditions', 15, doc.lastAutoTable.finalY + 10);
        doc.setFontSize(9);
        const terms = [
            companyInfo.validityPeriod ? `1. Validity: ${companyInfo.validityPeriod}` : null,
            `2. Payment Terms: ${companyInfo.paymentTerms}`,
            companyInfo.deliveryTime ? `3. Delivery Time: ${companyInfo.deliveryTime}` : null,
            '4. Prices are exclusive of GST',
            '5. Specifications are subject to manufacturing tolerances'
        ].filter(term => term !== null);
        
        doc.text(terms, 15, doc.lastAutoTable.finalY + 17);
        
        // Add footer with company details
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(
                `${COMPANY_INFO.name} | GST: ${COMPANY_INFO.gst} | ${COMPANY_INFO.phone} | ${COMPANY_INFO.email}`,
                105,
                285,
                { align: 'center' }
            );
            // Add page numbers
            doc.text(
                `Page ${i} of ${pageCount}`,
                195,
                285,
                { align: 'right' }
            );
        }
        
        // Save the PDF
        doc.save(`Quotation_${companyInfo.quotationNumber || 'Draft'}.pdf`);
    };

    const generateCSV = () => {
        const rows = [
            ['Quotation Details'],
            ['Quotation Number', companyInfo.quotationNumber || 'Not Specified'],
            ['Date', companyInfo.quotationDate || new Date().toLocaleDateString()],
            [],
            ['Company Details'],
            ['Company Name', COMPANY_INFO.name],
            ['Phone', COMPANY_INFO.phone],
            ['Email', COMPANY_INFO.email],
            ['Website', COMPANY_INFO.website],
            ['GST', COMPANY_INFO.gst],
            ['Address', COMPANY_INFO.address.replace(/\n/g, ' ')],
            [],
            ['Client Details'],
            ['Company Name', companyInfo.companyName],
            ['Contact Person', companyInfo.contactPerson],
            ['Email', companyInfo.email],
            ['Phone', companyInfo.phone],
            ['Address', companyInfo.address],
            [],
            ['Spring Specifications'],
            ['Wire Diameter', `${springData.wireD} mm`],
            ['Outer Diameter', `${results.od?.toFixed(2)} mm`],
            ['Free Length', `${springData.freeLength} mm`],
            ['Total Coils', springData.coilsTotal],
            ['Material', springData.material],
            ['Spring Rate', `${results.springRate?.toFixed(2)} N/mm`],
            ['Finish', springData.finish || 'Standard'],
            ['End Type', springData.ends || 'Standard'],
            [],
            ['Pricing Details'],
            ['Quantity', springData.quantity],
            ['Price per Spring', `Rs. ${results.pricePerSpring?.toFixed(2)}`],
            ['Overall Selling Price', `Rs. ${results.overallSellingPrice?.toFixed(2)}`],
            ['Total Amount', `Rs. ${(results.overallSellingPrice * springData.quantity)?.toFixed(2)}`],
            [],
            ['Terms & Conditions'],
            ['Validity', companyInfo.validityPeriod],
            ['Payment Terms', companyInfo.paymentTerms],
            ['Delivery Time', companyInfo.deliveryTime],
            ['Note 1', 'Prices are exclusive of GST'],
            ['Note 2', 'Specifications are subject to manufacturing tolerances']
        ];

        const csvContent = rows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `Quotation_${companyInfo.quotationNumber || 'Draft'}.csv`);
    };

    const generateWord = async () => {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // Company Header
                    new Paragraph({
                        text: COMPANY_INFO.name,
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Phone: ${COMPANY_INFO.phone} | ` }),
                            new TextRun({ text: `Email: ${COMPANY_INFO.email} | ` }),
                            new TextRun({ text: `Website: ${COMPANY_INFO.website}` }),
                        ],
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: COMPANY_INFO.address.replace(/\n/g, ', '),
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: `GST: ${COMPANY_INFO.gst}`,
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({ text: '' }),

                    // Quotation Details
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Quotation No: ', bold: true }),
                            new TextRun(companyInfo.quotationNumber || 'Not Specified'),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Date: ', bold: true }),
                            new TextRun(companyInfo.quotationDate || new Date().toLocaleDateString()),
                        ],
                    }),
                    new Paragraph({ text: '' }),

                    // Client Details
                    new Paragraph({ text: 'To:', bold: true }),
                    new Paragraph({ text: companyInfo.companyName }),
                    new Paragraph({ text: companyInfo.address }),
                    new Paragraph({ text: `Attn: ${companyInfo.contactPerson}` }),
                    new Paragraph({ text: `Email: ${companyInfo.email}` }),
                    new Paragraph({ text: `Phone: ${companyInfo.phone}` }),
                    new Paragraph({ text: '' }),

                    // Spring Specifications
                    new Paragraph({
                        text: 'Spring Specifications',
                        heading: HeadingLevel.HEADING_2,
                    }),
                    new Table({
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: 'Parameter' })] }),
                                    new TableCell({ children: [new Paragraph({ text: 'Value' })] }),
                                    new TableCell({ children: [new Paragraph({ text: 'Parameter' })] }),
                                    new TableCell({ children: [new Paragraph({ text: 'Value' })] }),
                                ],
                            }),
                            // Add specification rows
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: 'Wire Diameter' })] }),
                                    new TableCell({ children: [new Paragraph({ text: `${springData.wireD} mm` })] }),
                                    new TableCell({ children: [new Paragraph({ text: 'Outer Diameter' })] }),
                                    new TableCell({ children: [new Paragraph({ text: `${results.od?.toFixed(2)} mm` })] }),
                                ],
                            }),
                            // Add more specification rows...
                        ],
                    }),
                    new Paragraph({ text: '' }),

                    // Pricing Details
                    new Paragraph({
                        text: 'Pricing Details',
                        heading: HeadingLevel.HEADING_2,
                    }),
                    new Table({
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: 'Description' })] }),
                                    new TableCell({ children: [new Paragraph({ text: 'Value' })] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: 'Quantity' })] }),
                                    new TableCell({ children: [new Paragraph({ text: springData.quantity.toString() })] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: 'Price per Spring' })] }),
                                    new TableCell({ children: [new Paragraph({ text: `Rs. ${results.pricePerSpring?.toFixed(2)}` })] }),
                                ],
                            }),
                        ],
                    }),
                    new Paragraph({ text: '' }),

                    // Terms and Conditions
                    new Paragraph({
                        text: 'Terms & Conditions',
                        heading: HeadingLevel.HEADING_2,
                    }),
                    new Paragraph({ text: `1. Validity: ${companyInfo.validityPeriod}` }),
                    new Paragraph({ text: `2. Payment Terms: ${companyInfo.paymentTerms}` }),
                    new Paragraph({ text: `3. Delivery Time: ${companyInfo.deliveryTime}` }),
                    new Paragraph({ text: '4. Prices are exclusive of GST' }),
                    new Paragraph({ text: '5. Specifications are subject to manufacturing tolerances' }),
                ],
            }],
        });

        const buffer = await Packer.toBlob(doc);
        saveAs(buffer, `Quotation_${companyInfo.quotationNumber || 'Draft'}.docx`);
    };

    const generateExcelWithFormulas = () => {
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        
        // Prepare data arrays for the worksheet
        const headers = [
            'Input Parameters', '', 'Calculated Results', '',
            'Material Properties', '', 'Performance Parameters', ''
        ];
        
        // Input parameters
        const inputData = [
            ['Parameter', 'Value', 'Parameter', 'Value', 'Parameter', 'Value', 'Parameter', 'Value'],
            ['Wire Diameter (mm)', springData.wireD, 'Mean Diameter (mm)', results.meanD, 'Material', springData.material, 'Spring Rate (N/mm)', results.springRate],
            ['Outer Diameter (mm)', results.od, 'Inner Diameter (mm)', results.id, 'Density (g/cm³)', springData.density, 'Natural Frequency (Hz)', results.naturalFrequency],
            ['Free Length (mm)', springData.freeLength, 'Solid Length (mm)', results.solidLength, 'Shear Modulus (MPa)', springData.G, 'Maximum Deflection (mm)', results.maxDeflection],
            ['Total Coils', springData.coilsTotal, 'Spring Index', results.springIndex, 'Elastic Modulus (MPa)', results.elasticModulus, 'Energy Stored (N·mm)', results.energyStored],
            ['Active Coils', springData.coilsActive, 'Wire Volume (mm³)', results.wireVolume, 'Ultimate Tensile Strength (MPa)', springData.UTS, 'Buckling Risk Ratio', results.bucklingRiskRatio],
            ['Load Height (mm)', springData.loadHeight, 'Spring Weight (g)', results.springWeight, '', '', 'Stress Ratio (%)', results.stressRatio * 100],
            ['Setup Cost (Rs.)', springData.setupCost, 'Raw Material Cost (Rs.)', results.rawMaterialCost, '', '', '', ''],
            ['Quantity', springData.quantity, 'Price per Spring (Rs.)', results.pricePerSpring, '', '', '', ''],
            ['', '', 'Overall Price (Rs.)', results.overallSellingPrice, '', '', '', ''],
            ['', '', 'Total Wire Weight (kg)', results.totalWireWeight, '', '', '', '']
        ];

        // Add formulas
        const formulaData = [
            ['Formulas and Calculations:', ''],
            ['Mean Diameter (D)', '=Wire_Diameter + Outer_Diameter/2'],
            ['Inner Diameter (Di)', '=Outer_Diameter - 2*Wire_Diameter'],
            ['Spring Index (C)', '=Mean_Diameter/Wire_Diameter'],
            ['Wire Volume', '=PI()*POW(Wire_Diameter/2, 2)*PI()*Mean_Diameter*Total_Coils'],
            ['Spring Weight', '=Wire_Volume*Density/1000'],
            ['Spring Rate (k)', '=Shear_Modulus*POW(Wire_Diameter,4)/(8*POW(Mean_Diameter,3)*Active_Coils)'],
            ['Load at L1', '=Spring_Rate*(Free_Length-Load_Height)'],
            ['Raw Material Cost', '=(Spring_Weight/1000)*Material_Cost'],
            ['Price per Spring', '=IF(Override_Margin,Manual_Price,Raw_Material_Cost/Margin_Ratio)'],
            ['Overall Price', '=(Setup_Cost + Price_per_Spring*Quantity)/Quantity']
        ];

        // Create the main data worksheet
        const ws = XLSX.utils.aoa_to_sheet([headers, ...inputData]);
        
        // Create the formulas worksheet
        const wsFormulas = XLSX.utils.aoa_to_sheet(formulaData);

        // Add styling
        ws['!cols'] = [
            {wch: 20}, {wch: 15}, {wch: 20}, {wch: 15},
            {wch: 20}, {wch: 15}, {wch: 20}, {wch: 15}
        ];

        // Add the worksheets to the workbook
        XLSX.utils.book_append_sheet(wb, ws, "Spring Calculator");
        XLSX.utils.book_append_sheet(wb, wsFormulas, "Formulas");

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Spring_Calculator_${companyInfo.quotationNumber || 'Template'}.xlsx`);
    };

    return (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Generate Quotation</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quotation Number
                    </label>
                    <input
                        type="text"
                        name="quotationNumber"
                        value={companyInfo.quotationNumber}
                        onChange={handleInputChange}
                        placeholder="Enter quotation number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quotation Date
                    </label>
                    <input
                        type="date"
                        name="quotationDate"
                        value={companyInfo.quotationDate}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name
                    </label>
                    <input
                        type="text"
                        name="companyName"
                        value={companyInfo.companyName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Person
                    </label>
                    <input
                        type="text"
                        name="contactPerson"
                        value={companyInfo.contactPerson}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        name="email"
                        value={companyInfo.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                    </label>
                    <input
                        type="tel"
                        name="phone"
                        value={companyInfo.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address
                    </label>
                    <textarea
                        name="address"
                        value={companyInfo.address}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Validity Period
                    </label>
                    <input
                        type="text"
                        name="validityPeriod"
                        value={companyInfo.validityPeriod}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery Time
                    </label>
                    <input
                        type="text"
                        name="deliveryTime"
                        value={companyInfo.deliveryTime}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Terms
                    </label>
                    <input
                        type="text"
                        name="paymentTerms"
                        value={companyInfo.paymentTerms}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <button
                    onClick={generatePDF}
                    className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                    Download PDF
                </button>
                <button
                    onClick={generateCSV}
                    className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                    Download CSV
                </button>
                <button
                    onClick={generateWord}
                    className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Download Word
                </button>
                <button
                    onClick={generateExcelWithFormulas}
                    className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                    Download Excel Template
                </button>
            </div>
        </div>
    );
};

export default QuotationGenerator; 