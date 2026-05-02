// ESM wrapper for the single-threaded UMD ffmpeg-core.js.
const text = await fetch('/ffmpeg-core-st/ffmpeg-core.js').then(r => r.text());
const fn = new Function(text + '\nreturn createFFmpegCore;')();
export default fn;
