"use client";

import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";
import { FileText, Table as TableIcon, FileDown, Eye, Calendar, Printer } from "lucide-react";

interface RowData {
  date: string;
  time: string;
  direction: string;
  car: number;
  motorcycle: number;
  bus: number;
  truck: number;
}

const LIGHT_COLORS = {
  Car: "#2563eb", // Blue-600
  Motorcycle: "#d97706", // Amber-600
  Bus: "#059669", // Emerald-600
  Truck: "#dc2626" // Red-600
};

export default function ExportReportsPage() {
  const [data, setData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);

  // Export State
  const [exportFormat, setExportFormat] = useState<"CSV" | "PDF">("PDF");
  const [analyticsTypes, setAnalyticsTypes] = useState<Set<string>>(new Set(["Total Count by Junction"]));
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // CSV Preview Pagination
  const rowsPerPage = 15;

  const toggleAnalyticsType = (type: string) => {
    const newSet = new Set(analyticsTypes);
    if (newSet.has(type)) {
      if (newSet.size > 1) newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setAnalyticsTypes(newSet);
  };

  useEffect(() => {
    fetch("/data/ground_truth.csv")
      .then(res => res.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsedData: RowData[] = results.data.map((row: any) => ({
              date: row.date || "",
              time: row.time || "",
              direction: row.direction || "",
              car: parseFloat(row.car) || 0,
              motorcycle: parseFloat(row.motorcycle) || 0,
              bus: parseFloat(row.bus) || 0,
              truck: parseFloat(row.truck) || 0
            })).filter(r => r.date && r.time && r.direction);

            const dates = Array.from(new Set(parsedData.map(r => r.date)))
              .sort()
              .filter(d => {
                const [year, month, day] = d.split("-").map(Number);
                const dayOfWeek = new Date(year, month - 1, day).getDay();
                return dayOfWeek !== 0 && dayOfWeek !== 5 && dayOfWeek !== 6;
              });
            setAvailableDates(dates);
            if (dates.length > 0) setSelectedDate(dates[dates.length - 1]);

            setData(parsedData);
            setLoading(false);
          }
        });
      });
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(row => row.date === selectedDate);
  }, [data, selectedDate]);

  const calculateTotal = (row: RowData) => row.car + row.motorcycle + row.bus + row.truck;

  // CSV Exporter
  const handleExportCSV = () => {
    const csvData = filteredData.map(row => ({
      Date: row.date,
      Time: row.time,
      Junction: row.direction,
      Car: row.car,
      Motorcycle: row.motorcycle,
      Bus: row.bus,
      Truck: row.truck,
      Total: calculateTotal(row)
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `vcount_export_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Exporter (Trigger Print)
  const handleExportPDF = () => {
    window.print();
  };

  const handleGenerate = () => {
    if (exportFormat === "CSV") handleExportCSV();
    else handleExportPDF();
  };

  // --- Derived Data ---
  const barChartData = useMemo(() => {
    const junctions = ["Stadium", "JalanPerak", "JalanPRamlee", "JalanPenang"];
    return junctions.map(j => {
      const rows = filteredData.filter(r => r.direction === j);
      const totalCount = rows.reduce((acc, row) => acc + calculateTotal(row), 0);
      return { junction: j, "Total Count": totalCount };
    });
  }, [filteredData]);

  const lineChartData = useMemo(() => {
    const timesMap = new Map<string, number>();
    filteredData.forEach(row => {
      const current = timesMap.get(row.time) || 0;
      timesMap.set(row.time, current + calculateTotal(row));
    });
    return Array.from(timesMap.entries())
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredData]);

  const pieChartData = useMemo(() => {
    let carSum = 0, motoSum = 0, busSum = 0, truckSum = 0;
    filteredData.forEach(row => {
      carSum += row.car; motoSum += row.motorcycle; busSum += row.bus; truckSum += row.truck;
    });
    return [
      { name: "Car", value: carSum, fill: LIGHT_COLORS.Car },
      { name: "Motorcycle", value: motoSum, fill: LIGHT_COLORS.Motorcycle },
      { name: "Bus", value: busSum, fill: LIGHT_COLORS.Bus },
      { name: "Truck", value: truckSum, fill: LIGHT_COLORS.Truck }
    ].filter(item => item.value > 0);
  }, [filteredData]);


  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // --- Render Individual Chart Components ---
  const renderItem = (itemType: string, isPrintMode: boolean = false) => {
    const PrintSafeWrapper = ({ children }: { children: React.ReactElement }) => (
      isPrintMode ? (
        <div style={{ width: '100%', height: '280px' }}>
          {React.cloneElement(children as React.ReactElement<any>, { width: 650, height: 280, isAnimationActive: false })}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      )
    );

    if (itemType === "Raw Data Logs") {
      return (
        <div className="w-full">
          <h4 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Raw Data Logs</h4>
          <table className="w-full text-left border-collapse text-sm text-gray-700">
            <thead className="bg-gray-100 text-gray-900 border-b-2 border-gray-300">
              <tr>
                <th className="p-2 font-semibold">Time</th>
                <th className="p-2 font-semibold">Junction</th>
                <th className="p-2 font-semibold text-blue-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.slice(0, 10).map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-2">{row.time}</td>
                  <td className="p-2 capitalize">{row.direction}</td>
                  <td className="p-2 font-bold">{calculateTotal(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length > 10 && (
            <div className="mt-2 text-gray-500 text-xs italic">
              {`Showing 10 of ${filteredData.length} records for preview brevity.`}
            </div>
          )}
        </div>
      );
    }
    if (itemType === "Total Count by Junction") {
      return (
        <div className="w-full h-[320px]">
          <h4 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Total Count by Junction</h4>
          <PrintSafeWrapper>
            <BarChart data={barChartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="junction" stroke="#374151" fontSize={14} tickLine={false} axisLine={true} />
              <YAxis stroke="#374151" fontSize={14} tickLine={false} axisLine={true} />
              <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d1d5db', borderRadius: '4px', color: '#111827' }} />
              <Bar dataKey="Total Count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </PrintSafeWrapper>
        </div>
      );
    }
    if (itemType === "Vehicle Class Distribution") {
      return (
        <div className="w-full h-[320px]">
          <h4 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Vehicle Class Distribution</h4>
          <PrintSafeWrapper>
            <PieChart>
              <Pie
                data={pieChartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120}
                paddingAngle={2} dataKey="value" stroke="#ffffff" strokeWidth={2}
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d1d5db', borderRadius: '4px', color: '#111827' }} />
              <Legend verticalAlign="bottom" height={40} wrapperStyle={{ fontSize: '15px', paddingTop: '20px', color: '#374151' }} />
            </PieChart>
          </PrintSafeWrapper>
        </div>
      );
    }
    if (itemType === "Vehicle Flow Over Time") {
      return (
        <div className="w-full h-[320px]">
          <h4 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Vehicle Flow Over Time</h4>
          <PrintSafeWrapper>
            <AreaChart data={lineChartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="time" stroke="#374151" fontSize={14} tickLine={false} axisLine={true} />
              <YAxis stroke="#374151" fontSize={14} tickLine={false} axisLine={true} />
              <RechartsTooltip cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d1d5db', borderRadius: '4px', color: '#111827' }} />
              <Area type="monotone" dataKey="count" name="Vehicles" stroke="#059669" strokeWidth={4} fill="url(#colorFlow)" />
            </AreaChart>
          </PrintSafeWrapper>
        </div>
      );
    }
    return null;
  };

  const renderCSVPreview = () => {
    const displayData = filteredData.slice(0, rowsPerPage);
    return (
      <div className="mt-8">
        <table className="w-full text-left border-collapse text-sm text-gray-700">
          <thead className="bg-gray-100 text-gray-900 border-b-2 border-gray-300">
            <tr>
              <th className="p-3 font-semibold">Date</th>
              <th className="p-3 font-semibold">Time</th>
              <th className="p-3 font-semibold">Junction</th>
              <th className="p-3 font-semibold">Car</th>
              <th className="p-3 font-semibold">Motorcycle</th>
              <th className="p-3 font-semibold">Bus</th>
              <th className="p-3 font-semibold">Truck</th>
              <th className="p-3 font-semibold text-blue-700">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="p-3">{row.date}</td>
                <td className="p-3">{row.time}</td>
                <td className="p-3 capitalize">{row.direction}</td>
                <td className="p-3">{row.car}</td>
                <td className="p-3">{row.motorcycle}</td>
                <td className="p-3">{row.bus}</td>
                <td className="p-3">{row.truck}</td>
                <td className="p-3 font-bold">{calculateTotal(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredData.length > rowsPerPage && (
          <div className="mt-4 text-center text-gray-500 text-xs italic">
            {`Showing ${rowsPerPage} of ${filteredData.length} records. The full export will contain all rows.`}
          </div>
        )}
      </div>
    );
  };

  // Group items into pages of 2
  const pages: string[][] = [];
  if (exportFormat === "PDF") {
    const arr = Array.from(analyticsTypes);
    for (let i = 0; i < arr.length; i += 2) {
      pages.push(arr.slice(i, i + 2));
    }
  }

  const renderPages = (isPrintMode: boolean) => pages.map((pageItems, pageIndex) => (
    <div key={pageIndex} className={`w-full max-w-[210mm] h-[297mm] bg-white text-gray-900 p-10 lg:p-16 flex flex-col shrink-0 relative ${!isPrintMode ? 'shadow-2xl' : 'mx-auto'}`} style={isPrintMode ? { pageBreakAfter: 'always', breakAfter: 'page' } : {}}>
      {pageIndex === 0 ? (
        <div className="border-b-2 border-gray-200 pb-8 mb-8 flex items-end justify-between shrink-0">
          <div>
            <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight mb-2 uppercase">VCount</h1>
            <h2 className="text-xl font-medium text-gray-500 tracking-wide uppercase">Intelligent Traffic Analysis</h2>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-1">Generated Date</p>
            <p className="text-lg font-bold text-gray-800">{new Date().toLocaleDateString()}</p>
            <p className="text-sm font-bold text-gray-500 uppercase mt-2">Data Source: {selectedDate}</p>
          </div>
        </div>
      ) : (
        <div className="border-b border-gray-200 pb-4 mb-8 flex items-end justify-between shrink-0">
          <h1 className="text-xl font-bold text-blue-600 tracking-tight uppercase">VCount Analytics</h1>
          <p className="text-xs font-bold text-gray-500 uppercase">Page {pageIndex + 1}</p>
        </div>
      )}

      {pageIndex === 0 && (
        <div className="mb-8 shrink-0">
          <h3 className="text-2xl font-bold text-gray-800">Comprehensive Traffic Analytics</h3>
          <p className="text-gray-500 mt-2 text-sm max-w-2xl">
            Visual documentation of detected traffic behavior, broken down dynamically based on historical inference calculations.
          </p>
        </div>
      )}

      <div className="flex-1 w-full flex flex-col gap-12">
        {pageItems.map(item => <div key={item}>{renderItem(item, isPrintMode)}</div>)}
      </div>

      <div className="absolute bottom-10 left-16 right-16 pt-6 border-t border-gray-200 flex justify-end text-xs font-semibold uppercase shrink-0">
        <span className="text-blue-500 tracking-widest">vcount.app</span>
      </div>
    </div>
  ));

  return (
    <>
      <style>{`
        @media print {
          html, body, #__next {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* WEB UI (Hidden during print) */}
      <div className="print:hidden flex flex-col lg:flex-row h-full min-h-screen lg:min-h-0 bg-zinc-950 font-sans overflow-hidden text-zinc-100">

        {/* LEFT: Preview Panel */}
        <div className="flex-1 lg:h-full bg-zinc-900/40 p-4 lg:p-8 flex flex-col items-center gap-8 overflow-auto custom-scrollbar">

          {exportFormat === "CSV" ? (
            <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-gray-900 shadow-2xl p-10 lg:p-16 flex flex-col shrink-0">
              <div className="border-b-2 border-gray-200 pb-8 mb-8 flex items-end justify-between">
                <div>
                  <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight mb-2 uppercase">VCount</h1>
                  <h2 className="text-xl font-medium text-gray-500 tracking-wide uppercase">Intelligent Traffic Analysis</h2>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-1">Generated Date</p>
                  <p className="text-lg font-bold text-gray-800">{new Date().toLocaleDateString()}</p>
                  <p className="text-sm font-bold text-gray-500 uppercase mt-2">Data Source: {selectedDate}</p>
                </div>
              </div>
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-gray-800">Raw Data Logs Export</h3>
                <p className="text-gray-500 mt-2 text-sm max-w-2xl">
                  This report contains the raw numerical tracking data across all junctions for the specified operational window.
                </p>
              </div>
              <div className="flex-1 w-full">
                {renderCSVPreview()}
              </div>
              <div className="mt-16 pt-8 border-t border-gray-200 flex justify-end text-xs font-semibold uppercase">
                <span className="text-blue-500">vcount.app</span>
              </div>
            </div>
          ) : renderPages(false)}

        </div>

        {/* RIGHT: Confguration Controls */}
        <div className="w-full lg:w-[400px] bg-zinc-950 border-l border-zinc-800/50 p-6 lg:p-8 flex flex-col overflow-y-auto shrink-0">

          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Eye size={20} className="text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Live Formatter</h2>
          </div>

          <div className="space-y-8">
            {/* 1. Date Selector */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14} /> Date
              </label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {availableDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* 2. Format Selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Export Format</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFormat("CSV")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${exportFormat === "CSV" ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}
                >
                  <TableIcon size={24} className={`mb-2 ${exportFormat === "CSV" ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <span className={`text-sm font-bold ${exportFormat === "CSV" ? 'text-blue-400' : 'text-zinc-400'}`}>CSV Data</span>
                </button>
                <button
                  onClick={() => setExportFormat("PDF")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${exportFormat === "PDF" ? 'border-red-500 bg-red-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}
                >
                  <FileText size={24} className={`mb-2 ${exportFormat === "PDF" ? 'text-red-400' : 'text-zinc-500'}`} />
                  <span className={`text-sm font-bold ${exportFormat === "PDF" ? 'text-red-400' : 'text-zinc-400'}`}>PDF Document</span>
                </button>
              </div>
            </div>

            {/* 3. Sub-Configuration based on Format */}
            <div className="p-5 bg-zinc-900/30 border border-zinc-800/40 rounded-xl min-h-[140px]">
              {exportFormat === "CSV" ? (
                <div className="flex flex-col h-full justify-center text-center">

                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Analytics Composition</label>
                  <div className="flex flex-col gap-2">
                    {[
                      "Total Count by Junction",
                      "Vehicle Class Distribution",
                      "Vehicle Flow Over Time",
                      "Raw Data Logs"
                    ].map(type => (
                      <label key={type} className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors border border-transparent hover:border-zinc-700/50">
                        <input
                          type="checkbox"
                          value={type}
                          checked={analyticsTypes.has(type)}
                          onChange={() => toggleAnalyticsType(type)}
                          className="w-4 h-4 text-blue-500 bg-zinc-900 border-zinc-700 rounded focus:ring-blue-500 focus:ring-offset-zinc-950"
                        />
                        <span className="text-sm font-medium text-zinc-300">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="mt-auto pt-8">
            <button
              onClick={handleGenerate}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold text-sm tracking-wide shadow-lg transition-all
                  ${exportFormat === "CSV" ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : 'bg-green-600 hover:bg-green-500 shadow-green-900/20'}
               `}
            >
              {exportFormat === "CSV" ? <FileDown size={18} /> : <Printer size={18} />}
              {exportFormat === "CSV" ? "DOWNLOAD SPREADSHEET" : "PRINT PDF REPORT"}
            </button>
          </div>
        </div>
      </div>

      {/* PRINT UI (Rendered off-screen with explicit dimensions so SVGs preemptively paint, eliminating missing chart bugs and preventing scrollbar issues) */}
      <div className="absolute top-[-9999px] left-0 w-[210mm] opacity-0 print:opacity-100 print:relative print:top-0 print:left-0 text-black bg-white m-0 p-0 overflow-visible z-[-50] pointer-events-none">
        {exportFormat === "PDF" && renderPages(true)}
      </div>
    </>
  );
}
