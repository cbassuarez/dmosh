// src/engine/operations.ts
import type { DmoshProject } from "./projectTypes";

export interface CompileResult {
  // In future: this might be a serializable command graph
  // we feed to ffmpeg-core or the CLI engine.
  ok: boolean;
  errors: string[];
}

export function compileProjectToCommandGraph(project: DmoshProject): CompileResult {
  const errors: string[] = [];

  if (project.operations.length === 0) {
    errors.push("No operations defined in project.");
  }

  // TODO: validate ranges, mask references, curves, etc.

  return {
    ok: errors.length === 0,
    errors,
  };
}

