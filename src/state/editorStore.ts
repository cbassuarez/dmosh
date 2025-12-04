// src/state/editorStore.ts
import { create } from "zustand";
import type { DmoshProject } from "../engine/projectTypes";

export interface SelectionState {
  selectedOperationId?: string;
  selectedMaskId?: string;
  selectedClipId?: string;
  playheadSec: number;
}

interface EditorState {
  project: DmoshProject | null;
  selection: SelectionState;
  setProject(project: DmoshProject): void;
  updateSelection(partial: Partial<SelectionState>): void;
}

export const useEditorStore = create<EditorState>((set) => ({
  project: null,
  selection: {
    playheadSec: 0,
  },
  setProject(project) {
    set({
      project,
      selection: { playheadSec: 0 },
    });
  },
  updateSelection(partial) {
    set((state) => ({
      selection: {
        ...state.selection,
        ...partial,
      },
    }));
  },
}));

