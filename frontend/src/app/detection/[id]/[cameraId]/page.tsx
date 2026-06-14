"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { API_BASE_URL } from "@/lib/config";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  Camera,
  CarFront,
  Truck,
  Bus,
  Motorbike,
  Activity,
  Cpu,
  ArrowLeft,
  Video,
  Eye,
  EyeOff,
  LayoutGrid,
  TrendingUp,
  Info,
  Flame
} from "lucide-react";

interface ForecastInterval {
  time: string;
  car_forecast: number;
  motorcycle_forecast: number;
  bus_forecast: number;
  truck_forecast: number;
  is_forecast: boolean;
}

interface HistoryInterval {
  time: string;
  car: number;
  motorcycle: number;
  bus: number;
  truck: number;
  is_forecast: boolean;
}

interface ForecastData {
  forecast_time: string;
  counts: {
    car: number;
    truck: number;
    bus: number;
    motorcycle: number;
  };
  history: HistoryInterval[];
  forecast: ForecastInterval[];
}

export default function SingleCameraDashboard() {
  const params = useParams();
  const router = useRouter();
  const junctionId = params?.id as string;
  const cameraId = params?.cameraId as string;

  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState({ fps: 24, latency: 42 });
  const [counts, setCounts] = useState({ car: 0, truck: 0, bus: 0, motorcycle: 0 });
  const [videoTime, setVideoTime] = useState("00:00:00");
  const [videoDate, setVideoDate] = useState("");
  const [intervalStart, setIntervalStart] = useState("00:00:00");
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"stacked" | "grid">("stacked");
  const [visibleLines, setVisibleLines] = useState({
    car: true,
    truck: true,
    bus: true,
    motorcycle: true
  });

  const toggleLine = (dataKey: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  // Hard-coded default virtual lines mapped by Camera ID (Multiple Lanes)
  const DEFAULT_LINES: Record<string, Array<{ id: string, x1: number, y1: number, x2: number, y2: number }>> = {
    "T44F1": [
      { id: "Lane 1", x1: 0.35, y1: 0.7, x2: 0.5, y2: 0.80 },
      { id: "Lane 2", x1: 0.5, y1: 0.8, x2: 0.65, y2: 0.9 },
      { id: "Lane 3", x1: 0.8, y1: 0.6, x2: 1.0, y2: 0.5 }
    ],
    "T44F2": [
      { id: "Lane 1", x1: 0.45, y1: 0.7, x2: 0.55, y2: 0.85 },
      { id: "Lane 2", x1: 0.49, y1: 0.65, x2: 0.57, y2: 0.6 },
      { id: "Lane 3", x1: 0.57, y1: 0.6, x2: 0.7, y2: 0.62 }
    ],
    "T44F3": [
      { id: "Inner Turn", x1: 0.5, y1: 0.7, x2: 0.62, y2: 0.58 },
      { id: "Outer Turn", x1: 0.62, y1: 0.58, x2: 0.7, y2: 0.5 },
      { id: "Lane 3", x1: 0.7, y1: 0.5, x2: 0.75, y2: 0.45 }
    ],
    "T44P1": [
      { id: "Main Road", x1: 0.45, y1: 0.7, x2: 0.58, y2: 0.76 },
      { id: "Left Lane", x1: 0.58, y1: 0.76, x2: 0.71, y2: 0.82 },
    ],
  };

  const [lines, setLines] = useState<Array<{ id: string, x1: number, y1: number, x2: number, y2: number }>>(
    DEFAULT_LINES[cameraId] || []
  );
  // const [isDrawing, setIsDrawing] = useState(false);
  const [showLine, setShowLine] = useState(true);

  // Send default lines to backend immediately on mount
  /*
  useEffect(() => {
    if (lines.length > 0) {
      fetch(`${API_BASE_URL}/set_line/${cameraId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lines.map(l => ({ ...l, show: showLine })))
      }).catch(err => console.error("Failed to initialize default lines", err));
    }
  }, [cameraId, showLine]);
  */

  // Poll backend for stats and video time
  useEffect(() => {
    let currentVideoDate = "";
    let currentIntervalStart = "00:00:00";

    const intervalId = setInterval(async () => {
      try {
        // 1. Fetch live metrics and current video time
        const res = await fetch(`${API_BASE_URL}/detect/${cameraId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.fps !== undefined && data.latency !== undefined) {
            setMetrics({ fps: data.fps, latency: data.latency });
          }
          if (data.video_time) {
            setVideoTime(data.video_time);

            // Calculate the 15-minute interval start
            // e.g. 12:18:30 -> 12:15:00
            const [h, m, s] = data.video_time.split(":").map(Number);
            const startM = Math.floor(m / 15) * 15;
            const formattedStart = `${String(h).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`;

            if (formattedStart !== currentIntervalStart) {
              setIntervalStart(formattedStart);
              currentIntervalStart = formattedStart;
            }
          }
          if (data.video_date) {
            setVideoDate(data.video_date);
            currentVideoDate = data.video_date;
          }
          setIsConnected(true);

          if (currentVideoDate && data.video_time) {
            const tsRes = await fetch(`${API_BASE_URL}/timeseries/${cameraId}?date=${currentVideoDate}&time=${data.video_time}`);
            if (tsRes.ok) {
              const tsData = await tsRes.json();
              setTimeseries(tsData);
            }

            // Fetch live forecast
            const forecastRes = await fetch(`${API_BASE_URL}/forecast/${cameraId}?date=${currentVideoDate}&time=${data.video_time}`);
            if (forecastRes.ok) {
              const forecastData = await forecastRes.json();
              if (forecastData.counts) {
                setForecast(forecastData);
                setForecastError(null);
              }
            } else {
              const errorData = await forecastRes.json().catch(() => ({}));
              setForecastError(errorData.error || "Failed to fetch forecast");
            }
          }
        }

        // 2. Fetch database counts for the current interval AND date
        if (currentVideoDate && currentIntervalStart) {
          const countsRes = await fetch(`${API_BASE_URL}/counts/${cameraId}?since=${currentIntervalStart}&date=${currentVideoDate}`);
          if (countsRes.ok) {
            const countsData = await countsRes.json();
            if (countsData.counts) {
              setCounts(countsData.counts);
            }
          }
        }
      } catch (err) {
        setIsConnected(false);
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [cameraId]);

  /*
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Only capture primary button (left click or touch)
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // When drawing manually, we set a single temporary lane for now
    setLines([{ id: "Custom Lane", x1: x, y1: y, x2: x, y2: y }]);
    setIsDrawing(true);
    // Capture pointer so it keeps tracking even if mouse leaves SVG temporarily
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || lines.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (Math.max(0, Math.min(e.clientX - rect.left, rect.width))) / rect.width;
    const y = (Math.max(0, Math.min(e.clientY - rect.top, rect.height))) / rect.height;
    setLines(prev => prev.length > 0 ? [{ ...prev[0], x2: x, y2: y }] : []);
  };

  const handlePointerUp = async (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (lines.length > 0) {
      try {
        await fetch(`${API_BASE_URL}/set_line/${cameraId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lines.map(l => ({ ...l, show: showLine })))
        });
      } catch (err) {
        console.error("Failed to set virtual lines", err);
      }
    }
  };
  */

  const chartData = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return [];

    // Copy the existing timeseries
    const data = [...timeseries];

    if (forecast && forecast.counts) {
      const carForecastRate = Number((forecast.counts.car / 15).toFixed(2));
      const truckForecastRate = Number((forecast.counts.truck / 15).toFixed(2));
      const busForecastRate = Number((forecast.counts.bus / 15).toFixed(2));
      const motorcycleForecastRate = Number((forecast.counts.motorcycle / 15).toFixed(2));

      // Populate the forecast rate for all points in the 15-minute interval block
      for (let i = 0; i < data.length; i++) {
        data[i] = {
          ...data[i],
          car_forecast: carForecastRate,
          truck_forecast: truckForecastRate,
          bus_forecast: busForecastRate,
          motorcycle_forecast: motorcycleForecastRate,
        };
      }
    }

    return data;
  }, [timeseries, forecast]);

  const forecastTimeline = useMemo(() => {
    if (!forecast || !forecast.history || !forecast.forecast) return [];

    const history: any[] = [...forecast.history];
    const forecastPoints: any[] = [...forecast.forecast];

    if (history.length > 0 && forecastPoints.length > 0) {
      // Merge the last history point and first forecast point
      const lastHistIndex = history.length - 1;
      history[lastHistIndex] = {
        ...history[lastHistIndex],
        car_forecast: forecastPoints[0].car_forecast,
        motorcycle_forecast: forecastPoints[0].motorcycle_forecast,
        bus_forecast: forecastPoints[0].bus_forecast,
        truck_forecast: forecastPoints[0].truck_forecast,
      };

      // Concat the rest of the forecast points (skipping index 0)
      return [...history, ...forecastPoints.slice(1)];
    }

    return [...history, ...forecastPoints];
  }, [forecast]);

  // Sum up all vehicle categories for each 15-minute forecast block
  const forecastBlocks = useMemo(() => {
    if (!forecast || !forecast.forecast) return [];
    return forecast.forecast.map((item) => {
      const car = item.car_forecast || 0;
      const motorcycle = item.motorcycle_forecast || 0;
      const bus = item.bus_forecast || 0;
      const truck = item.truck_forecast || 0;
      const total = car + motorcycle + bus + truck;
      return {
        ...item,
        car,
        motorcycle,
        bus,
        truck,
        total
      };
    });
  }, [forecast]);

  // Find the peak interval block from the forecast (excluding the seed "Now" block at index 0)
  const peakForecastBlock = useMemo(() => {
    if (forecastBlocks.length === 0) return null;
    // forecastBlocks[0] represents current "Now" interval. We evaluate the future predictions (index 1 to 8)
    const candidates = forecastBlocks.length > 1 ? forecastBlocks.slice(1) : forecastBlocks;
    let peak = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].total > peak.total) {
        peak = candidates[i];
      }
    }
    return peak;
  }, [forecastBlocks]);

  // Get the most recent actual data point for KPI calculations
  const lastActual = useMemo(() => {
    if (!forecastTimeline || forecastTimeline.length === 0) return null;
    const actuals = forecastTimeline.filter(d => d.is_forecast === false);
    return actuals[actuals.length - 1] || null;
  }, [forecastTimeline]);

  const totalActualFlow = useMemo(() => {
    if (!lastActual) return 0;
    return (lastActual.car || 0) + (lastActual.truck || 0) + (lastActual.bus || 0) + (lastActual.motorcycle || 0);
  }, [lastActual]);

  return (
    <div className="min-h-screen p-4 lg:p-8 w-full max-w-[1600px] mx-auto bg-zinc-950 text-zinc-100 font-sans">
      <header className="mb-6 border-b border-zinc-800/80 pb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Back to Junction
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs mb-2 uppercase tracking-wider">
              <span>Node: {junctionId}</span>
              <span>/</span>
              <span className="text-blue-400">Feed: {cameraId}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <Camera className="text-blue-500" />
              Live Inference Stream
            </h1>
            {/* <p className="text-zinc-400 text-sm mt-2 font-medium">Draw a line on the video to start counting vehicles crossing it in a specific direction.</p> */}
            <p className="text-zinc-400 text-sm mt-2 font-medium">Real-time AI vehicle detection and counting.</p>
          </div>

          <div className="flex items-center gap-3">
            {/*
            <button
              onClick={() => setShowLine(!showLine)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
            >
              {showLine ? <EyeOff size={16} /> : <Eye size={16} />}
              {showLine ? "Hide Line" : "Show Line"}
            </button>
            */}

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold tracking-wider ${isConnected
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              {isConnected ? "YOLOv8 ACTIVE" : "BACKEND DISCONNECTED"}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT COLUMN: Main Video Feed */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">

            {/* relative container to hold img + svg overlay */}
            <div className="w-full aspect-video bg-zinc-950 relative flex items-center justify-center overflow-hidden">
              <img
                src={`${API_BASE_URL}/video_feed/${cameraId}`}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                alt="Live Feed"
              />

              {/*
              <svg
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                /*
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                * /
              >
                {showLine && lines.map((l, idx) => (
                  <g key={l.id || idx}>
                    <line
                      x1={`${l.x1 * 100}%`} y1={`${l.y1 * 100}%`}
                      x2={`${l.x2 * 100}%`} y2={`${l.y2 * 100}%`}
                      stroke="#3b82f6" strokeWidth="3"
                      strokeDasharray="8 4"
                    />
                    <circle cx={`${l.x1 * 100}%`} cy={`${l.y1 * 100}%`} r="6" fill="#3b82f6" />
                    <circle cx={`${l.x2 * 100}%`} cy={`${l.y2 * 100}%`} r="6" fill="#14b8a6" />
                    <text
                      x={`${l.x1 * 100}%`} y={`${l.y1 * 100 - 2}%`}
                      fill="#3b82f6" fontSize="12" fontWeight="bold" className="pointer-events-none select-none font-mono"
                    >
                      {l.id}
                    </text>
                  </g>
                ))}
              </svg>
              */}

              {!isConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-10 text-zinc-500">
                  <Video size={48} className="mb-4 opacity-50" />
                  <p className="font-mono text-sm">Attempting to connect to Python stream...</p>
                </div>
              )}
            </div>

            <div className="bg-zinc-950 px-4 py-3 flex justify-between items-center text-xs font-mono text-zinc-400 border-t border-zinc-800/80">
              <span className="flex items-center gap-2"><Activity size={14} className="text-blue-500" /> RESOLUTION: 1080p</span>
              <span className="flex items-center gap-2"><Cpu size={14} className="text-purple-500" /> INFERENCE: {metrics.latency}ms</span>
              <span className="flex items-center gap-2">FPS: {metrics.fps}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider text-zinc-400">Total vehicle counted since : {intervalStart}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50 flex flex-col items-center justify-center">
                <CarFront size={20} className="text-blue-400 mb-1" />
                <span className="text-2xl font-bold text-white">{counts.car || 0}</span>
                <span className="text-[10px] text-zinc-500 uppercase">Cars</span>
              </div>
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50 flex flex-col items-center justify-center">
                <Truck size={20} className="text-emerald-400 mb-1" />
                <span className="text-2xl font-bold text-white">{counts.truck || 0}</span>
                <span className="text-[10px] text-zinc-500 uppercase">Trucks</span>
              </div>
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50 flex flex-col items-center justify-center">
                <Bus size={20} className="text-purple-400 mb-1" />
                <span className="text-2xl font-bold text-white">{counts.bus || 0}</span>
                <span className="text-[10px] text-zinc-500 uppercase">Buses</span>
              </div>
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50 flex flex-col items-center justify-center">
                <Motorbike size={20} className="text-amber-400 mb-1" />
                <span className="text-2xl font-bold text-white">{counts.motorcycle || 0}</span>
                <span className="text-[10px] text-zinc-500 uppercase">Motors</span>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* Live Line Graph Panel */}
      <div className="mt-6 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
        {/* Header and Toggle Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-4 gap-4">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-blue-500" />
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Live Flow & Predictive Analytics</h2>
              <p className="text-[10px] text-zinc-500 font-mono">2-HOUR LSTM FORECAST TIMELINE</p>
            </div>
          </div>

          {/* Toggle Controls */}
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800/80 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("stacked")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "stacked" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
            >
              <Activity size={14} /> Area Flow
            </button>
            <button
              onClick={() => setActiveTab("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "grid" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
            >
              <LayoutGrid size={14} /> Sparklines
            </button>
          </div>
        </div>

        {/* High Level KPI Metrics Row */}
        {lastActual && (
          <div className={`grid grid-cols-2 ${peakForecastBlock ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/50`}>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-500" /> Total Current Rate
              </span>
              <p className="text-xl font-bold text-white font-mono mt-1">{totalActualFlow} <span className="text-xs text-zinc-500 font-normal">v/15-min</span></p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Car Ratio</span>
              <p className="text-xl font-bold text-blue-400 font-mono mt-1">
                {totalActualFlow ? Math.round(((lastActual.car || 0) / totalActualFlow) * 100) : 0}%
              </p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Heavy Vehicle %</span>
              <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
                {totalActualFlow ? Math.round((((lastActual.truck || 0) + (lastActual.bus || 0)) / totalActualFlow) * 100) : 0}%
              </p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Forecast Horizon</span>
              <p className="text-xl font-bold text-purple-400 font-mono mt-1 flex items-center gap-1">
                {forecast ? "2 HOURS" : "PENDING"}
              </p>
            </div>
            {peakForecastBlock && (
              <div className="col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-zinc-800/80 pt-2 md:pt-0 md:pl-4">
                <span className="text-[10px] text-amber-500 uppercase font-bold tracking-wide flex items-center gap-1">
                  <Flame size={12} className="text-amber-500 fill-amber-500 animate-pulse" /> Predicted Peak
                </span>
                <p className="text-xl font-bold text-white font-mono mt-1 flex items-baseline gap-1">
                  {peakForecastBlock.total}
                  <span className="text-xs text-zinc-500 font-normal">v/15m</span>
                  <span className="text-xs text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded font-sans ml-1 font-bold">
                    @{peakForecastBlock.time}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main Graph Content */}
        <div className="w-full h-[320px] mt-2">
          {activeTab === "stacked" ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {/* Actual gradients (Solid, desaturated) */}
                  <linearGradient id="colorCar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorTruck" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorMotor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>

                  {/* Forecast gradients (Highly transparent matching colors for distinct predictive shading) */}
                  <linearGradient id="colorCarForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorTruckForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBusForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorMotorForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />

                {peakForecastBlock && (
                  <ReferenceLine
                    x={peakForecastBlock.time}
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `Peak (${peakForecastBlock.total}v)`,
                      position: "top",
                      fill: "#c084fc",
                      fontSize: 10,
                      fontWeight: "bold",
                      className: "font-mono"
                    }}
                  />
                )}

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const activePayload = payload.filter((p: any) => p.value !== undefined);
                      return (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 shadow-2xl font-sans text-xs">
                          <p className="font-semibold text-zinc-300 border-b border-zinc-800 pb-1.5 mb-2 flex justify-between gap-4">
                            <span>Time range: {label}</span>
                            <span className="text-zinc-500 font-normal font-sans">v/15-min</span>
                          </p>
                          <div className="space-y-1">
                            {activePayload.map((p: any) => (
                              <div key={p.name} className="flex items-center justify-between gap-6 font-sans">
                                <span className="flex items-center gap-1.5 text-zinc-400">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.stroke || p.fill }} />
                                  {p.name}:
                                </span>
                                <span className="font-bold text-white font-mono">{p.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Unstacked Actual Areas (Left Side - plotted individually from baseline) */}
                <Area type="monotone" dataKey="car" name="Cars (Actual)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCar)" connectNulls />
                <Area type="monotone" dataKey="motorcycle" name="Motors (Actual)" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorMotor)" connectNulls />
                <Area type="monotone" dataKey="bus" name="Buses (Actual)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorBus)" connectNulls />
                <Area type="monotone" dataKey="truck" name="Trucks (Actual)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorTruck)" connectNulls />

                {/* Unstacked Shaded Forecast Areas (Right Side - using respective vehicle colors with dashed styling) */}
                <Area type="monotone" dataKey="car_forecast" name="Cars (Forecast)" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorCarForecast)" connectNulls />
                <Area type="monotone" dataKey="motorcycle_forecast" name="Motors (Forecast)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorMotorForecast)" connectNulls />
                <Area type="monotone" dataKey="bus_forecast" name="Buses (Forecast)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorBusForecast)" connectNulls />
                <Area type="monotone" dataKey="truck_forecast" name="Trucks (Forecast)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorTruckForecast)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            /* Sparklines Grid View (2x2 Grid) */
            <div className="grid grid-cols-2 gap-4 h-full">
              {[
                { key: "car", name: "Cars", color: "#3b82f6" },
                { key: "motorcycle", name: "Motors", color: "#f59e0b" },
                { key: "bus", name: "Buses", color: "#10b981" },
                { key: "truck", name: "Trucks", color: "#ef4444" },
              ].map(item => (
                <div key={item.key} className="bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-3 flex flex-col h-[140px] justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{item.name}</span>
                    <span className="text-base font-bold text-white font-mono">
                      {lastActual ? lastActual[item.key] || 0 : 0} <span className="text-[9px] font-normal text-zinc-500 font-sans">v/15-min</span>
                    </span>
                  </div>

                  <div className="w-full h-[70px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecastTimeline} margin={{ top: 2, right: 2, left: -25, bottom: 2 }}>
                        <XAxis dataKey="time" hide />
                        <YAxis hide />
                        <Line type="monotone" dataKey={item.key} stroke={item.color} strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey={`${item.key}_forecast`} stroke={item.color} strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Legend Banner */}
        <div className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 text-[10px] text-zinc-400">
          <Info size={14} className="text-blue-400 shrink-0" />
          <span className="leading-relaxed font-sans">
            <strong>LSTM Shaded Forecast:</strong> To the right of <strong>Now</strong>, the shaded area represents the 2-hour predictive forecast window generated by the LSTM model (rendered with distinct dashed borders and transparent shaded fills plotted directly from the baseline).
          </span>
        </div>
      </div>
    </div>
  );
}