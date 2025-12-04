// src/components/timeline/TimelineView.tsx
import { useEditorStore } from "../../state/editorStore";

export function TimelineView() {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);

  return (
    <div className="border-t border-slate-800 bg-slate-900/80">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
        <span>Timeline (codec-aware)</span>
        <span>Playhead: {selection.playheadSec.toFixed(2)}s</span>
      </div>
      <div className="h-32 border-t border-slate-800 bg-black/60 text-xs text-slate-500">
        {project ? (
          <div className="flex h-full items-center justify-center">
            Frame index + keyframe markers will render here.
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            Import a clip to generate frame index.
          </div>
        )}
      </div>
    </div>
  );
}

