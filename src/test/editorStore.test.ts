// src/test/editorStore.test.ts
import { describe, it, expect } from "vitest";
import { useEditorStore } from "../state/editorStore";
import type { DmoshProject } from "../engine/projectTypes";

describe("editorStore", () => {
  it("sets project and resets selection", () => {
    const project: DmoshProject = {
      version: "0.1.0",
      id: "test",
      name: "Test Project",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sources: [],
      clips: [],
      masks: [],
      curves: [],
      operations: [],
      renderSettings: {
        codecProfile: "web",
        resolutionStrategy: "original",
      },
    };

    const { setProject, selection } = useEditorStore.getState();
    expect(selection.playheadSec).toBe(0);

    setProject(project);

    const state = useEditorStore.getState();
    expect(state.project?.name).toBe("Test Project");
    expect(state.selection.playheadSec).toBe(0);
  });
});

