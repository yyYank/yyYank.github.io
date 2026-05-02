import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let loaded = false;

function canUseSharedArrayBuffer(): boolean {
  if (typeof SharedArrayBuffer === 'undefined') return false;
  if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) return false;
  return true;
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
  }
  if (!loaded) {
    const config = canUseSharedArrayBuffer()
      ? {
          coreURL: '/ffmpeg-mt-init.js',
          wasmURL: '/ffmpeg-core/ffmpeg-core.wasm',
          workerURL: '/ffmpeg-core/ffmpeg-core.worker.js',
        }
      : {
          coreURL: '/ffmpeg-st-init.js',
          wasmURL: '/ffmpeg-core-st/ffmpeg-core.wasm',
        };
    await ffmpeg.load(config);
    loaded = true;
  }
  return ffmpeg;
}
