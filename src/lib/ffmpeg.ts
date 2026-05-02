import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let loaded = false;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
  }
  if (!loaded) {
    await ffmpeg.load({
      coreURL: '/ffmpeg-core-st/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core-st/ffmpeg-core.wasm',
    });
    loaded = true;
  }
  return ffmpeg;
}
