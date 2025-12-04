// src/engine/ffmpegClient.ts
import { createFFmpeg, fetchFile, type FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpegInstance: FFmpeg | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = createFFmpeg({
      corePath: "/dmosh/ffmpeg-core.js", // can be adjusted; or let @ffmpeg/ffmpeg fetch its own core
      log: true,
    });
    await ffmpegInstance.load();
  }
  return ffmpegInstance;
}

export async function probeFile(file: File) {
  const ffmpeg = await getFFmpeg();
  const name = "input." + (file.name.split(".").pop() ?? "bin");
  ffmpeg.FS("writeFile", name, await fetchFile(file));

  // TODO: run ffprobe-equivalent commands and parse frame index.
  // For now, just return a stub.
  return {
    fileName: file.name,
    rawNameInFs: name,
  };
}

