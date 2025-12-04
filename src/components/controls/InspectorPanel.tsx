// src/components/controls/InspectorPanel.tsx
import { useEditorStore } from "../../state/editorStore";

export function InspectorPanel() {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);

  return (
    <div className="space-y-4 p-3 text-xs text-slate-300">
      {!project && (
        <p className="text-slate-500">
          Load a source clip to begin building a datamosh project.
        </p>
      )}

      {project && (
        <>
          <section className="space-y-1">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Project
            </h2>
            <div className="rounded border border-dm-border bg-black/40 p-2">
              <div className="font-mono text-[0.7rem]">{project.name}</div>
              <div className="mt-1 text-[0.65rem] text-slate-500">
                {project.sources.length} source(s), {project.operations.length} operation(s)
              </div>
            </div>
          </section>

          <section className="space-y-1">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Selection
            </h2>
            <div className="rounded border border-dm-border bg-black/40 p-2 text-[0.65rem]">
              <div>Playhead: {selection.playheadSec.toFixed(2)}s</div>
              <div>Clip: {selection.selectedClipId ?? "—"}</div>
              <div>Mask: {selection.selectedMaskId ?? "—"}</div>
              <div>Operation: {selection.selectedOperationId ?? "—"}</div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

