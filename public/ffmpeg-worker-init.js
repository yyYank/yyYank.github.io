// ESM wrapper for ffmpeg-core.js
// Module workers use dynamic import() instead of importScripts().
// The UMD ffmpeg-core.js declares `var createFFmpegCore` (no export default),
// so we wrap it with new Function() to capture the variable and export it.
const text = await fetch('/ffmpeg-core/ffmpeg-core.js').then(r => r.text());
const fn = new Function(text + '\nreturn createFFmpegCore;')();
export default fn;
