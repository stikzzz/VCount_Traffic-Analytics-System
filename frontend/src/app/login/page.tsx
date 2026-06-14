"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, User, ArrowRight, Car, Loader2 } from "lucide-react";
import { setAuthData } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";

export default function VehicleDesignAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const body = isLogin
      ? { email, password }
      : { email, password, full_name: fullName };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      if (isLogin) {
        // Handle Login Success
        setAuthData(data.token, data.role, data.email, data.full_name || "");

        if (data.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/detection');
        }
      } else {
        // Handle Registration Success
        setSuccessMessage(data.message || "Registration successful! Waiting for approval.");
        setIsLogin(true); // Switch to login after registration
        setPassword(""); // Clear password
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/30">

      {/* Left Column - Visual/Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-[60%] relative overflow-hidden bg-zinc-900 border-r border-zinc-800/50">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{
            backgroundImage: "url('/image.png')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 to-transparent" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Car size={24} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-widest uppercase text-white">
              VCount <span className="text-blue-500">Studio</span>
            </span>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-white leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                AI-Powered <br />
              </span>
              Vehicle Detection System. <br />
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Accurate vehicle detection and counting powered by Ultralytics.
            </p>
          </div>

          <div className="text-sm text-zinc-600 font-medium">
            © {new Date().getFullYear()} VCount Systems
          </div>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Car size={20} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-widest uppercase text-white">
              VCount <span className="text-blue-500">Studio</span>
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-3xl font-bold mb-2 text-white">
              {isLogin ? "Welcome back" : "Request account access"}
            </h2>
            <p className="text-zinc-400">
              {isLogin
                ? "Enter your credentials to access your workspace."
                : "Fill in the form to request access to the platform."}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-lg mb-4 text-sm text-center">
              {successMessage}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>

            {/* Conditional Name Field for Sign Up */}
            <div className={`space-y-2 overflow-hidden transition-all duration-300 ease-in-out ${isLogin ? 'max-h-0 opacity-0 mb-0' : 'max-h-24 opacity-100 mb-2'}`}>
              <label className="text-sm font-medium text-zinc-400">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={18} className="text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  disabled={loading}
                  className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 focus:bg-zinc-900 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 pl-11 pr-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all"
                  placeholder="Full Name"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Email / Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 focus:bg-zinc-900 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 pl-11 pr-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all"
                  placeholder="Email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-zinc-400">Password</label>

              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 focus:bg-zinc-900 focus:ring-1 focus:ring-blue-500 rounded-xl py-3 pl-11 pr-4 text-zinc-100 placeholder-zinc-600 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-8 group disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                isLogin ? "Sign In" : "Register"
              )}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          {/* Toggle State */}
          <div className="mt-8 text-center">
            <p className="text-zinc-400 text-sm">
              {isLogin ? "Don't have an account to access?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setSuccessMessage("");
                }}
                disabled={loading}
                className="text-white hover:text-blue-400 font-medium transition-colors underline decoration-zinc-700 underline-offset-4"
              >
                {isLogin ? "Request Access" : "Log in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}