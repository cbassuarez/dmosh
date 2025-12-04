// src/components/layout/Sidebar.tsx
import { InspectorPanel } from "../controls/InspectorPanel";

export function Sidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Inspector
      </div>
      <div className="flex-1 overflow-auto">
        <InspectorPanel />
      </div>
    </div>
  );
}

