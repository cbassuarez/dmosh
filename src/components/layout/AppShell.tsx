// src/components/layout/AppShell.tsx
import { ReactNode } from "react";
import { TopBar } from "./TopBar";

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
}

export function AppShell({ sidebar, main }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-dm-bg text-slate-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden border-t border-dm-border">
        <aside className="w-72 shrink-0 border-r border-dm-border bg-dm-panel">
          {sidebar}
        </aside>
        <main className="flex-1 overflow-hidden">{main}</main>
      </div>
    </div>
  );
}

