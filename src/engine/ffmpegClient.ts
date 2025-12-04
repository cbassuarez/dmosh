// src/engine/ffmpegClient.ts

// NOTE: This is an initial stub to keep the engine surface stable while
// we design the ffmpeg-core integration. It deliberately does NOT depend
// on @ffmpeg/ffmpeg yet, so TypeScript + CI stay happy.

export interface ProbedFileInfo {
  fileName: string;
  rawNameInFs: string;
}

/**
 * Placeholder for future ffmpeg-core loading.
 * For now, calling this is an explicit error.
 */
export async function getFFmpeg(): Promise<never> {
  throw new Error("ffmpeg-core integration is not implemented yet.");
}

/**
 * Placeholder probe that just returns the file's name.
 * Later this will:
 * - write to ffmpeg's FS
 * - run a probe command
 * - extract duration, fps, frame index, etc.
 */
export async function probeFile(file: File): Promise<ProbedFileInfo> {
  return {
    fileName: file.name,
    rawNameInFs: file.name,
  };
}
