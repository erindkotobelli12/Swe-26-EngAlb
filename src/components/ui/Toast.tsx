"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastItem = { id: number; tone: "success" | "error"; message: string };
type ToastApi = { success: (message: string) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Lightweight toasts: every finished action confirms itself here. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastItem["tone"], message: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-3), { id, tone, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);
  const api = useMemo<ToastApi>(() => ({ success: (m) => push("success", m), error: (m) => push("error", m) }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"} data-testid="toast" className="toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-sm shadow-pop">
            {t.tone === "success" ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-600" />}
            <span className="min-w-0 flex-1 text-body">{t.message}</span>
            <button type="button" aria-label="Dismiss" className="text-subtle hover:text-ink" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { success: () => {}, error: () => {} };
}
