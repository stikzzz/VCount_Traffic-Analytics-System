let apiBaseUrl = "http://127.0.0.1:5000";

if (typeof window !== "undefined") {
  const saved = localStorage.getItem("NEXT_PUBLIC_API_URL");
  if (saved) {
    apiBaseUrl = saved;
  } else if (process.env.NEXT_PUBLIC_API_URL) {
    apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  }
} else if (process.env.NEXT_PUBLIC_API_URL) {
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
}

export const API_BASE_URL = apiBaseUrl;
