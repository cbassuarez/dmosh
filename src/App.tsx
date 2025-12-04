// src/App.tsx
import { AppShell } from "./components/layout/AppShell";
import { Sidebar } from "./components/layout/Sidebar";
import { VideoViewer } from "./components/viewer/VideoViewer";
import { TimelineView } from "./components/timeline/TimelineView";

export default function App() {
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

