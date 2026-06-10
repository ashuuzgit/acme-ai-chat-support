import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold shadow">
          S
        </div>
        <span className="text-2xl font-semibold tracking-tight text-slate-900">
          SupportAI
        </span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
