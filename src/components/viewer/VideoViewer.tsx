// src/components/viewer/VideoViewer.tsx
import { useEditorStore } from "../../state/editorStore";

export function VideoViewer() {
  const project = useEditorStore((s) => s.project);

  return (
    <div className="flex flex-1 flex-col bg-black">
      <div className="flex-1 flex items-center justify-center">
        <div className="aspect-video w-[70%] max-w-4xl rounded-lg border border-dm-border bg-dm-panel/60 flex items-center justify-center text-xs text-slate-500">
          {project ? "Preview will appear here" : "Import a clip to begin"}
        </div>
      </div>
    </div>
  );
}

