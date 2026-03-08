import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let loaded = false;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
  }
  if (!loaded) {
    await ffmpeg.load({
      coreURL: '/ffmpeg-worker-init.js',
      wasmURL: '/ffmpeg-core/ffmpeg-core.wasm',
    });
    loaded = true;
  }
  return ffmpeg;
}
