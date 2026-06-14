"use client";

import { useRouter } from "next/navigation";
import { MapPin, Camera, Activity, AlertCircle } from "lucide-react";

export default function JunctionSelection() {
  const router = useRouter();

  const junctions = [
    {
      id: "JlnPerakPRamlee001",
      name: "Jln Perak - Jln P.Ramlee",
      status: "online",
      cameras: 4,
      image: "/thumbnail/1.jpg",
      description: "Primary traffic flow monitoring and congestion analysis.",
    },
  ];

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
          Select Surveillance Node
        </h1>
        <p className="text-zinc-400">
          Choose a junction to view live AI inference and coordinate counting data.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {junctions.map((junction) => {
          const isOnline = junction.status === "online";
          
          return (
            <div 
              key={junction.id}
              onClick={() => isOnline && router.push(`/detection/${junction.id}`)}
              className={`relative rounded-2xl overflow-hidden border transition-all duration-300 ${
                isOnline 
                  ? "border-zinc-700/80 bg-zinc-900/50 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] cursor-pointer group" 
                  : "border-zinc-800/50 bg-zinc-950/50 opacity-60 cursor-not-allowed"
              }`}
            >
              {/* Image Header */}
              <div className="h-48 w-full relative overflow-hidden bg-zinc-900">
                <img 
                  src={junction.image} 
                  alt={junction.name}
                  className={`w-full h-full object-cover transition-transform duration-700 ${isOnline ? 'group-hover:scale-105' : 'grayscale'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
                
                {/* Status Badge */}
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md border flex items-center gap-2
                  ${isOnline ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                    junction.status === 'maintenance' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 
                    'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}
                ">
                  {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {junction.status}
                </div>
              </div>

              {/* Card Content */}
              <div className="p-6 relative z-10">
                <h3 className={`text-xl font-bold mb-2 ${isOnline ? 'text-white' : 'text-zinc-400'}`}>
                  {junction.name}
                </h3>
                <p className="text-zinc-500 text-sm mb-6 line-clamp-2">
                  {junction.description}
                </p>

                <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Camera size={16} />
                    <span>{junction.cameras} Feeds</span>
                  </div>
                  {isOnline ? (
                    <div className="flex items-center gap-2 text-blue-400 text-sm font-medium group-hover:text-blue-300 transition-colors">
                      <Activity size={16} />
                      <span>Enter Hub &rarr;</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-zinc-600 text-sm">
                      <AlertCircle size={16} />
                      <span>Unavailable</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}