import Sidebar from "@/components/sidebar";
import { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";

export default function ExportLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      {/* We add print:bg-white so the whole screen background prints cleanly */}
      <div className="flex h-screen w-full bg-zinc-950 print:bg-white text-zinc-100 font-sans overflow-hidden selection:bg-blue-500/30">
        
        {/* Sidebar Navigation - Fixed on the left, hidden during print */}
        <div className="print:hidden h-full">
          <Sidebar />
        </div>

        {/* Main Content Area - Scrollable */}
        {/* We use print:overflow-visible so the browser can paginate long reports */}
        <main className="flex-1 overflow-y-auto print:overflow-visible relative bg-zinc-950 print:bg-white">
          {/* Subtle background glow for the workspace */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none print:hidden" />
          
          <div className="relative z-10 w-full h-full lg:p-8 max-w-[1600px] mx-auto print:p-0">
            {children}
          </div>
        </main>

      </div>
    </AuthGuard>
  );
}
