// src/components/layout/AppShell.tsx
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
}

export function AppShell({ sidebar, main }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden border-t border-slate-800">
        <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/80">
          {sidebar}
        </aside>
        <main className="flex-1 overflow-hidden">{main}</main>
      </div>
    </div>
  );
}

