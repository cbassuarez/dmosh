import { describe, it, expect } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { EditorPage } from "../pages/EditorPage";

describe("EditorPage viewport gating", () => {
  it("shows gating message on small viewport", () => {
    const originalInnerWidth = window.innerWidth;
    // @ts-expect-error overwrite for test
    window.innerWidth = 800;

    render(
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route path="/app" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Desktop only/i)).toBeInTheDocument();

    // @ts-expect-error reset after test
    window.innerWidth = originalInnerWidth;
  });
});
