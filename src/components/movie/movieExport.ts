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

export async function encodeToMp4(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  startTime: number | null,
  duration?: number
): Promise<void> {
  const args = [
    ...(startTime !== null ? ['-ss', startTime.toFixed(3)] : []),
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
    '-movflags',
    '+faststart',
    outputName,
  ];

  if (duration !== undefined) {
    args.splice(startTime !== null ? 2 : 0, 0, '-t', duration.toFixed(3));
  }

  await ffmpeg.exec(args);
}
