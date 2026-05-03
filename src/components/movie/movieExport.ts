import type { FFmpeg, FileData } from '@ffmpeg/ffmpeg';

export function toUint8Array(data: FileData): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export async function readOutputBlob(ffmpeg: FFmpeg, outputName: string, type: string): Promise<Blob> {
  const data = await ffmpeg.readFile(outputName);
  return new Blob([toUint8Array(data)], { type });
}

export async function writeInputFile(ffmpeg: FFmpeg, inputName: string, fileData: Uint8Array): Promise<void> {
  await ffmpeg.writeFile(inputName, fileData);
}

export async function streamCopyTrim(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  startTime: number,
  duration: number
): Promise<void> {
  await ffmpeg.exec([
    '-ss',
    startTime.toFixed(3),
    '-t',
    duration.toFixed(3),
    '-i',
    inputName,
    '-c',
    'copy',
    outputName,
  ]);
}

export async function encodeToMp4(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  onProgress?: (ratio: number) => void
): Promise<void> {
  const handler = onProgress
    ? ({ progress }: { progress: number }) => onProgress(progress)
    : null;
  if (handler) ffmpeg.on('progress', handler);
  try {
    await ffmpeg.exec([
      '-i',
      inputName,
      '-map',
      '0:v:0?',
      '-map',
      '0:a:0?',
      '-c:v',
      'mpeg4',
      '-c:a',
      'aac',
      outputName,
    ]);
  } finally {
    if (handler) ffmpeg.off('progress', handler);
  }
}
