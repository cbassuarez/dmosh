// src/components/viewer/VideoViewer.tsx
import { useEditorStore } from "../../state/editorStore";

export function VideoViewer() {
  const project = useEditorStore((s) => s.project);

  return (
    <div className="flex flex-1 flex-col bg-black">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex aspect-video w-[70%] max-w-4xl items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-xs text-slate-500">
          {project ? "Preview will appear here" : "Import a clip to begin"}
        </div>
      </div>
    </div>
  );
}
