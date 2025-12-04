import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Sidebar } from "../components/layout/Sidebar";
import { VideoViewer } from "../components/viewer/VideoViewer";
import { TimelineView } from "../components/timeline/TimelineView";

const MIN_WIDTH = 1024;

export function EditorPage() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      setIsSupported(window.innerWidth >= MIN_WIDTH);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isSupported === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-xs text-slate-400">
        Checking viewport…
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 text-center text-sm text-slate-300">
        <div className="max-w-sm space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Desktop only</div>
          <p>
            The dmosh editor is designed for desktop screens. Please open this page on a larger display to work with the codec-aware timeline and masks.
          </p>
          <a
            href="/dmosh/"
            className="text-xs text-teal-300 underline underline-offset-2 hover:text-teal-200"
          >
            Back to landing page
          </a>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      sidebar={<Sidebar />}
      main={
        <div className="flex h-full flex-col">
          <VideoViewer />
          <TimelineView />
        </div>
      }
    />
  );
}
