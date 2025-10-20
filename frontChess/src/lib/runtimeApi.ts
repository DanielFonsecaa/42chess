export function getApiBaseUrl() {
  // runtime-injected global takes precedence, then Vite build-time env, then localhost fallback
  // window.__API_URL__ is injected by the container entrypoint at runtime
  let runtime: string | undefined;
  if (typeof window !== "undefined") {
    const w = window as unknown as { __API_URL__?: string };
    runtime = w.__API_URL__;
  }
  const buildTime = import.meta.env.VITE_API_URL;
  return runtime || buildTime || "http://localhost:3000";
}
