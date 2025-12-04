import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { EditorPage } from "./pages/EditorPage";
import { SpecPage } from "./pages/SpecPage";
import { ChangelogPage } from "./pages/ChangelogPage";
import { AboutPage } from "./pages/AboutPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<EditorPage />} />
      <Route path="/spec" element={<SpecPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
