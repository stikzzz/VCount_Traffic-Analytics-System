"use client";

import React, { useState, useEffect } from "react";
import { X, Wifi, WifiOff, Loader2, Check, AlertCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ServerConfigModal({ isOpen, onClose }: ServerConfigModalProps) {
  const [apiUrl, setApiUrl] = useState("http://127.0.0.1:5000");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Load current setting on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("NEXT_PUBLIC_API_URL");
      if (saved) {
        setApiUrl(saved);
      } else if (process.env.NEXT_PUBLIC_API_URL) {
        setApiUrl(process.env.NEXT_PUBLIC_API_URL);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const testConnection = async (urlToTest: string) => {
    setTestStatus("testing");
    setErrorMessage("");
    setLatency(null);

    // Clean URL trailing slash
    const cleanedUrl = urlToTest.replace(/\/$/, "");
    const startTime = performance.now();

    try {
      // Setup a timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(`${cleanedUrl}/cameras`, {
        method: "GET",
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" }
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const endTime = performance.now();
        setLatency(Math.round(endTime - startTime));
        setTestStatus("success");
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      setTestStatus("error");
      if (err.name === "AbortError") {
        setErrorMessage("Connection timed out (5s limit)");
      } else {
        setErrorMessage(err.message || "Failed to connect to local server");
      }
    }
  };

  const handleSave = () => {
    if (typeof window !== "undefined") {
      const cleanedUrl = apiUrl.trim().replace(/\/$/, "");
      localStorage.setItem("NEXT_PUBLIC_API_URL", cleanedUrl);
      
      // Reload to apply the new configurations across the entire app
      window.location.reload();
    }
  };

  const handleReset = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("NEXT_PUBLIC_API_URL");
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark backdrop blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal box */}
      <div className="relative w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden z-10 transition-all select-none">
        
        {/* Glow decorative effect */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-cyan-500/10 blur-[60px] rounded-full pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5 border-b border-zinc-850 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600/15 p-2 rounded-lg text-blue-500 border border-blue-500/10">
              <Wifi size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Server Connection
              </h3>
              <p className="text-xs text-zinc-400">Configure local hosting backend</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white bg-zinc-850/50 hover:bg-zinc-850 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400">Backend API URL</label>
            <div className="relative group">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => {
                  setApiUrl(e.target.value);
                  setTestStatus("idle");
                  setLatency(null);
                  setErrorMessage("");
                }}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 px-4 text-sm text-zinc-100 placeholder-zinc-650 outline-none transition-all"
                placeholder="http://127.0.0.1:5000"
              />
            </div>
          </div>

          {/* Test Status Indicator Panel */}
          <div className="bg-zinc-950/50 border border-zinc-850/50 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Connection Status
              </span>
              
              {/* Pulse status indicator */}
              <div className="flex items-center gap-1.5">
                {testStatus === "idle" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-zinc-650" />
                    <span className="text-xs font-medium text-zinc-400">Untested</span>
                  </>
                )}
                {testStatus === "testing" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Testing...
                    </span>
                  </>
                )}
                {testStatus === "success" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-medium text-emerald-400">Connected</span>
                  </>
                )}
                {testStatus === "error" && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                    <span className="text-xs font-medium text-red-400">Offline</span>
                  </>
                )}
              </div>
            </div>

            {/* Sub-info / details */}
            <div className="text-xs">
              {testStatus === "idle" && (
                <p className="text-zinc-500">Test the URL to check connection before saving.</p>
              )}
              {testStatus === "testing" && (
                <p className="text-zinc-500">Pinging server endpoints...</p>
              )}
              {testStatus === "success" && latency !== null && (
                <div className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
                  <Check size={14} />
                  <span>Success! Response received in {latency}ms</span>
                </div>
              )}
              {testStatus === "error" && (
                <div className="flex items-start gap-1.5 text-red-400/90 font-medium leading-relaxed">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col gap-2 mt-6">
          <div className="flex gap-2">
            <button
              onClick={() => testConnection(apiUrl)}
              disabled={testStatus === "testing"}
              className="flex-1 bg-zinc-800 hover:bg-zinc-750 disabled:bg-zinc-850/50 text-white font-bold py-2.5 rounded-xl text-sm transition-all border border-zinc-700/50 cursor-pointer flex items-center justify-center gap-2"
            >
              {testStatus === "testing" && <Loader2 size={14} className="animate-spin" />}
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={testStatus === "testing"}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_16px_rgba(37,99,235,0.3)] cursor-pointer"
            >
              Save & Apply
            </button>
          </div>

          <button
            onClick={handleReset}
            disabled={testStatus === "testing"}
            className="w-full text-zinc-500 hover:text-zinc-350 text-xs py-1.5 rounded-lg transition-colors cursor-pointer text-center font-medium"
          >
            Reset to Default URL
          </button>
        </div>

      </div>
    </div>
  );
}
