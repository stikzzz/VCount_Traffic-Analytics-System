"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/");
    } else {
      setIsReady(true);
    }
  }, [router]);

  if (!isReady) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center text-white">Loading...</div>; // Prevent flash of unprotected content
  }

  return <>{children}</>;
}
