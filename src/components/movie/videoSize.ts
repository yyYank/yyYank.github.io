import type { VideoSize } from './movieConcatUtils';

export function readVideoSize(file: File): Promise<VideoSize> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} の解像度を取得できませんでした`));
    };
    video.src = url;
  });
}
