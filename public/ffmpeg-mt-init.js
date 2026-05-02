// ESM wrapper for the multi-threaded ffmpeg-core.js (UMD).
const text = await fetch('/ffmpeg-core/ffmpeg-core.js').then(r => r.text());
const fn = new Function(text + '\nreturn createFFmpegCore;')();
export default fn;
