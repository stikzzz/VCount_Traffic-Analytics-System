"use client";

import { useParams, useRouter } from "next/navigation";
import { Camera, MapPin, Activity } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

export default function CameraSelection() {
  const params = useParams();
  const router = useRouter();
  const junctionId = params?.id || "Unknown";

  const cameras = [
    { id: "T44F1", name: "Stadium", status: "Active", thumb: "/thumbnail/1.jpg" },
    { id: "T44F2", name: "Jalan Perak", status: "Active", thumb: "/thumbnail/107.jpg" },
    { id: "T44F3", name: "Jalan Sg Pinang", status: "Active", thumb: "/thumbnail/172.jpg" },
    { id: "T44P1", name: "Jalan P Ramlee", status: "Active", thumb: "/thumbnail/237.jpg" },
  ];

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <div className="flex items-center gap-2 text-zinc-400 mb-2 font-mono text-sm">
          <MapPin size={16} />
          <span>{junctionId}</span>
          <span>/</span>
          <span className="text-white font-semibold">Select Feed</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Select Camera Angle
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cameras.map((cam) => (
          <div
            key={cam.id}
            onClick={() => {
              // Fire and forget the backend warming request
              fetch(`${API_BASE_URL}/detect/${cam.id}`).catch((error) => {
                console.error("Error communicating with backend:", error);
              });
              // Navigate instantly to prevent multiple clicks
              router.push(`/detection/${junctionId}/${cam.id}`);
            }}
            className="group cursor-pointer bg-zinc-900/50 border border-zinc-800/80 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(37,99,235,0.1)] rounded-2xl overflow-hidden transition-all duration-300"
          >
            {/* Camera Preview Placeholder */}
            <div className="h-48 w-full bg-zinc-950 relative flex items-center justify-center overflow-hidden">
              {cam.thumb ? (
                <img src={cam.thumb} alt={cam.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:20px_20px]" />
                  <Camera size={32} className="text-zinc-700 group-hover:scale-110 transition-transform duration-500" />
                </>
              )}

              <div className="absolute top-4 right-4 z-10 px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {cam.status}
              </div>
            </div>

            {/* Card Info */}
            <div className="p-5 border-t border-zinc-800/80 flex justify-between items-center bg-zinc-900">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <span className="text-blue-400 font-mono text-sm">[{cam.id}]</span>
                  {cam.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-blue-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
                <Activity size={16} />
                <span>View Stream &rarr;</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}