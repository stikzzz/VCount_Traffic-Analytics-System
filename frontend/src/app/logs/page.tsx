"use client";

import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import { Filter, CheckCircle2, Circle, Download, ArrowUpDown, ChevronLeft, ChevronRight, List } from "lucide-react";

interface RowData {
  date: string;
  time: string;
  direction: string;
  car: number;
  motorcycle: number;
  bus: number;
  truck: number;
}

export default function LogsPage() {
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
    car: true, motorcycle: true, bus: true, truck: true
  });

  // Table Sorting & Pagination State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'time', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

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

            const dates = Array.from(new Set(parsedData.map(r => r.date)))
              .sort()
              .filter(d => {
                const [year, month, day] = d.split("-").map(Number);
                const dayOfWeek = new Date(year, month - 1, day).getDay();
                return dayOfWeek !== 0 && dayOfWeek !== 5 && dayOfWeek !== 6;
              });
            setAvailableDates(dates);
            if (dates.length > 0) {
              setSelectedDate(dates[dates.length - 1]);
            }

            setData(parsedData);
            setLoading(false);
          }
        });
      });
  }, []);

  const toggleJunction = (junction: string) => {
    const newSet = new Set(selectedJunctions);
    if (newSet.has(junction)) newSet.delete(junction);
    else newSet.add(junction);
    setSelectedJunctions(newSet);
  };

  const toggleVehicle = (type: keyof typeof selectedVehicles) => {
    setSelectedVehicles(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (row.date !== selectedDate) return false;
      if (row.time < startTime || row.time > endTime) return false;
      if (!selectedJunctions.has(row.direction)) return false;
      return true;
    });
  }, [data, selectedDate, startTime, endTime, selectedJunctions]);

  const calculateTotal = (row: RowData) => {
    let sum = 0;
    if (selectedVehicles.car) sum += row.car;
    if (selectedVehicles.motorcycle) sum += row.motorcycle;
    if (selectedVehicles.bus) sum += row.bus;
    if (selectedVehicles.truck) sum += row.truck;
    return sum;
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    const sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof RowData];
        let bVal: any = b[sortConfig.key as keyof RowData];
        if (sortConfig.key === 'total') {
            aVal = calculateTotal(a);
            bVal = calculateTotal(b);
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig, selectedVehicles]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const paginatedData = sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length]);

  const exportToCSV = () => {
    const csvData = sortedData.map(row => ({
      Date: row.date, Time: row.time, Junction: row.direction,
      Car: row.car, Motorcycle: row.motorcycle, Bus: row.bus, Truck: row.truck, Total: calculateTotal(row)
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `data_logs_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-zinc-400 font-medium animate-pulse">Loading Logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600/20 p-2 rounded-lg">
            <List className="text-blue-500" size={24} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Raw Data Logs</h1>
        </div>
        <p className="text-zinc-400">View and export detailed historical traffic logs.</p>
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

      {/* Raw Data Logs Section */}
      <div className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-2xl flex flex-col mt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-white">Detection Records</h3>
          </div>
          
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl transition-colors border border-zinc-700/50"
          >
            <Download size={16} />
            Export to CSV
          </button>
        </div>

        <div className="w-full overflow-x-auto border border-zinc-800/50 rounded-xl mb-4">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase tracking-wider font-semibold border-b border-zinc-800/50">
              <tr>
                {[
                  { key: 'date', label: 'Date' },
                  { key: 'time', label: 'Time' },
                  { key: 'direction', label: 'Junction' },
                  { key: 'car', label: 'Car' },
                  { key: 'motorcycle', label: 'Motorcycle' },
                  { key: 'bus', label: 'Bus' },
                  { key: 'truck', label: 'Truck' },
                  { key: 'total', label: 'Total' }
                ].map(({ key, label }) => (
                  <th 
                    key={key} 
                    className="p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors group"
                    onClick={() => requestSort(key)}
                  >
                    <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                      {label}
                      <ArrowUpDown size={14} className={`transition-opacity ${sortConfig?.key === key ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover:opacity-50'}`} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-sm text-zinc-300">
              {paginatedData.length > 0 ? paginatedData.map((row, i) => (
                <tr key={i} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="p-4 tabular-nums text-zinc-400 group-hover:text-zinc-300">{row.date}</td>
                  <td className="p-4 font-medium tabular-nums">{row.time}</td>
                  <td className="p-4 capitalize">{row.direction}</td>
                  <td className="p-4 tabular-nums">{row.car}</td>
                  <td className="p-4 tabular-nums">{row.motorcycle}</td>
                  <td className="p-4 tabular-nums">{row.bus}</td>
                  <td className="p-4 tabular-nums">{row.truck}</td>
                  <td className="p-4 tabular-nums font-bold text-blue-400">{calculateTotal(row)}</td>
                </tr>
              )) : (
                 <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-500">
                      No data found for the selected filters.
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <div>
            Showing <span className="font-medium text-white">{sortedData.length === 0 ? 0 : Math.min((currentPage - 1) * rowsPerPage + 1, sortedData.length)}</span> to <span className="font-medium text-white">{Math.min(currentPage * rowsPerPage, sortedData.length)}</span> of <span className="font-medium text-white">{sortedData.length}</span> entries
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || sortedData.length === 0}
              className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg font-medium min-w-[3rem] text-center">
              {currentPage}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || sortedData.length === 0}
              className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
