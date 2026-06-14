import Sidebar from "@/components/sidebar";
import { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";

export default function LogsLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden selection:bg-blue-500/30">
        
        {/* Sidebar Navigation - Fixed on the left */}
        <Sidebar />

        {/* Main Content Area - Scrollable */}
        <main className="flex-1 overflow-y-auto relative bg-zinc-950">
          {/* Subtle background glow for the workspace */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 w-full h-full p-8 lg:p-12 max-w-7xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </AuthGuard>
  );
}
