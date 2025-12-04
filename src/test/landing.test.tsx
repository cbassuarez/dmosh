import { describe, it, expect } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "../pages/LandingPage";

describe("LandingPage", () => {
  it("renders hero and open app link", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/codec-level glitch editor/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open app/i })).toBeInTheDocument();
  });
});
