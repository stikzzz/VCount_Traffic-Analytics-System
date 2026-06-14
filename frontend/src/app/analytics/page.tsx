"use client";

import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";
import { BarChart3, Filter, CheckCircle2, Circle } from "lucide-react";

interface RowData {
  date: string;
  time: string;
  direction: string;
  car: number;
  motorcycle: number;
  bus: number;
  truck: number;
}

const COLORS = {
  Car: "#3b82f6", // Blue
  Motorcycle: "#f59e0b", // Amber
  Bus: "#10b981", // Emerald
  Truck: "#ef4444" // Red
};

export default function AnalyticsPage() {
  const [data, setData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const [startTime, setStartTime] = useState<string>("07:00");
  const [endTime, setEndTime] = useState<string>("19:00");

  const [selectedJunctions, setSelectedJunctions] = useState<Set<string>>(new Set([
    "Stadium", "JalanPerak", "JalanPRamlee", "JalanPenang"
  ]));

  const [selectedVehicles, setSelectedVehicles] = useState({
    car: true,
    motorcycle: true,
    bus: true,
    truck: true
  });

  // Line styling options
  const [lineStyle, setLineStyle] = useState<"monotone" | "linear" | "step">("monotone");

  // Load and Parse CSV
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

            // Find unique dates and filter out Friday (5), Saturday (6), and Sunday (0)
            const dates = Array.from(new Set(parsedData.map(r => r.date)))
              .sort()
              .filter(d => {
                const [year, month, day] = d.split("-").map(Number);
                const dayOfWeek = new Date(year, month - 1, day).getDay();
                return dayOfWeek !== 0 && dayOfWeek !== 5 && dayOfWeek !== 6;
              });
            setAvailableDates(dates);
            if (dates.length > 0) {
              setSelectedDate(dates[dates.length - 1]); // Set Latest Date
            }

            setData(parsedData);
            setLoading(false);
          }
        });
      });
  }, []);

  // Handlers for Filters
  const toggleJunction = (junction: string) => {
    const newSet = new Set(selectedJunctions);
    if (newSet.has(junction)) {
      newSet.delete(junction);
    } else {
      newSet.add(junction);
    }
    setSelectedJunctions(newSet);
  };

  const toggleVehicle = (type: keyof typeof selectedVehicles) => {
    setSelectedVehicles(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (row.date !== selectedDate) return false;
      if (row.time < startTime || row.time > endTime) return false;
      if (!selectedJunctions.has(row.direction)) return false;
      return true;
    });
  }, [data, selectedDate, startTime, endTime, selectedJunctions]);

  // Derived Data for Charts
  const calculateTotal = (row: RowData) => {
    let sum = 0;
    if (selectedVehicles.car) sum += row.car;
    if (selectedVehicles.motorcycle) sum += row.motorcycle;
    if (selectedVehicles.bus) sum += row.bus;
    if (selectedVehicles.truck) sum += row.truck;
    return sum;
  };

  // 1. Bar Chart Data (Counts across Junctions)
  const barChartData = useMemo(() => {
    const junctions = ["Stadium", "JalanPerak", "JalanPRamlee", "JalanPenang"];
    return junctions.map(j => {
      const rows = filteredData.filter(r => r.direction === j);
      const totalCount = rows.reduce((acc, row) => acc + calculateTotal(row), 0);
      return { junction: j, "Total Count": totalCount };
    }).filter(item => selectedJunctions.has(item.junction));
  }, [filteredData, selectedVehicles, selectedJunctions]);

  // 2. Line Chart Data (Flow over Time)
  const lineChartData = useMemo(() => {
    const timesMap = new Map<string, number>();
    filteredData.forEach(row => {
      const current = timesMap.get(row.time) || 0;
      timesMap.set(row.time, current + calculateTotal(row));
    });

    return Array.from(timesMap.entries())
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredData, selectedVehicles]);

  const morningData = useMemo(() => lineChartData.filter(d => d.time >= "07:00" && d.time <= "09:00"), [lineChartData]);
  const afternoonData = useMemo(() => lineChartData.filter(d => d.time >= "12:00" && d.time <= "14:00"), [lineChartData]);
  const eveningData = useMemo(() => lineChartData.filter(d => d.time >= "17:00" && d.time <= "19:00"), [lineChartData]);

  // 3. Pie Chart Data (Vehicle Type Distribution)
  const pieChartData = useMemo(() => {
    let carSum = 0, motoSum = 0, busSum = 0, truckSum = 0;

    filteredData.forEach(row => {
      if (selectedVehicles.car) carSum += row.car;
      if (selectedVehicles.motorcycle) motoSum += row.motorcycle;
      if (selectedVehicles.bus) busSum += row.bus;
      if (selectedVehicles.truck) truckSum += row.truck;
    });

    return [
      { name: "Car", value: carSum, fill: COLORS.Car },
      { name: "Motorcycle", value: motoSum, fill: COLORS.Motorcycle },
      { name: "Bus", value: busSum, fill: COLORS.Bus },
      { name: "Truck", value: truckSum, fill: COLORS.Truck }
    ].filter(item => item.value > 0);
  }, [filteredData, selectedVehicles]);

  const renderFlowChart = (title: string, dataSet: { time: string; count: number }[], colorHex: string, id: string) => (
    <div className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-2xl flex flex-col min-h-[350px]">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dataSet} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`colorCount-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorHex} stopOpacity={0.4} />
                <stop offset="95%" stopColor={colorHex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="time" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
            <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
            <RechartsTooltip
              cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }}
              contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
            />
            <Area
              type={lineStyle}
              dataKey="count"
              name="Vehicles"
              stroke={colorHex}
              strokeWidth={3}
              fill={`url(#colorCount-${id})`}
              activeDot={{ r: 6, fill: colorHex, stroke: '#09090b', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-zinc-400 font-medium animate-pulse">Loading CSV Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600/20 p-2 rounded-lg">
            <BarChart3 className="text-blue-500" size={24} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Analytics & Insights
          </h1>
        </div>
        <p className="text-zinc-400">
          Analyze historical traffic flow patterns, peak hours, and vehicle classifications.
        </p>
      </header>

      {/* Constraints & Filters Bar */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 text-white font-medium mb-5 pb-4 border-b border-zinc-800/50">
          <Filter size={18} className="text-zinc-400" />
          <h2>Data Configurations</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Date Select */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Historical Date</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              {availableDates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* 2. Time Range */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Time Range</label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              />
              <span className="text-zinc-600">-</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              />
            </div>
          </div>

          {/* 3. Junction Select & 4. Vehicle Classes */}
          <div className="lg:col-span-2 flex flex-col sm:flex-row justify-end gap-12 xl:gap-20">
            {/* 3. Junction Select */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Junctions</label>
              <div className="flex flex-col gap-2 pt-1">
                {["Stadium", "JalanPerak", "JalanPRamlee", "JalanPenang"].map(j => {
                  const active = selectedJunctions.has(j);
                  return (
                    <div
                      key={j}
                      onClick={() => toggleJunction(j)}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      {active ? <CheckCircle2 className="text-blue-500" size={18} /> : <Circle className="text-zinc-600 group-hover:text-zinc-400" size={18} />}
                      <span className={`text-sm ${active ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{j}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 4. Vehicle Classes */}
            <div className="space-y-2 w-40">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vehicle Types</label>
              <div className="flex flex-col gap-2 pt-1">
                {Object.entries(selectedVehicles).map(([type, active]) => (
                  <div
                    key={type}
                    onClick={() => toggleVehicle(type as keyof typeof selectedVehicles)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    {active ? <CheckCircle2 className="text-emerald-500" size={18} /> : <Circle className="text-zinc-600 group-hover:text-zinc-400" size={18} />}
                    <span className={`text-sm capitalize ${active ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Total Vehicles by Junction */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-2xl flex flex-col min-h-[400px]">
          <h3 className="text-lg font-bold text-white mb-6">Total Count by Junction</h3>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="junction" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip
                  cursor={{ fill: '#27272a', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                />
                <Bar dataKey="Total Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Classes Distribution */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-2xl flex flex-col min-h-[400px]">
          <h3 className="text-lg font-bold text-white mb-6">Vehicle Class Distribution</h3>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Full Width Line/Area Charts (Split into Time Zones) */}
        <div className="lg:col-span-2 mt-2 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/30 border border-zinc-800/50 p-5 rounded-2xl">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Time Period Analysis</h3>
              <p className="text-sm text-zinc-400 mt-1">Breakdown of specific peak hours and time frames</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500 font-medium uppercase tracking-wider hidden sm:block"></span>
              <select
                value={lineStyle}
                onChange={(e) => setLineStyle(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              >
                <option value="monotone">Smooth Curve</option>
                <option value="linear">Straight Lines</option>
                <option value="step">Stepped Lines</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {renderFlowChart("Morning Flow (07:00 - 09:00)", morningData, "#f59e0b", "morning")}
            {renderFlowChart("Afternoon Flow (12:00 - 14:00)", afternoonData, "#3b82f6", "afternoon")}
            {renderFlowChart("Evening Flow (17:00 - 19:00)", eveningData, "#10b981", "evening")}
          </div>
        </div>

      </div>
    </div>
  );
}
