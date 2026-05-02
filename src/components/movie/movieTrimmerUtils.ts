export function formatVideoTime(sec: number): string {
  const safe = Math.max(0, sec);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe % 1) * 1000);

  const base = [hours, minutes, seconds]
    .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, '0')))
    .join(':');

  return `${base}.${String(milliseconds).padStart(3, '0')}`;
}

export function clampTrimStart(nextStart: number, endTime: number): number {
  return Math.max(0, Math.min(nextStart, Math.max(0, endTime - 0.1)));
}

export function clampTrimEnd(nextEnd: number, startTime: number, duration: number): number {
  return Math.max(startTime + 0.1, Math.min(nextEnd, duration));
}

export function getTrimmedFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) {
    return `${filename}_trimmed`;
  }
  return `${filename.slice(0, dotIndex)}_trimmed${filename.slice(dotIndex)}`;
}
