import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadMock = vi.fn();

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    load = loadMock;
  },
}));

describe('getFFmpeg', () => {
  beforeEach(() => {
    vi.resetModules();
    loadMock.mockReset();
    loadMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the multi-threaded core when the page is cross-origin isolated', async () => {
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('SharedArrayBuffer', ArrayBuffer);

    const { getFFmpeg } = await import('../ffmpeg');
    await getFFmpeg();

    const config = loadMock.mock.calls[0]?.[0];
    expect(config).toMatchObject({
      coreURL: '/ffmpeg-core/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core/ffmpeg-core.wasm',
      workerURL: '/ffmpeg-core/ffmpeg-core.worker.js',
    });
  });

  it('falls back to the single-threaded core when SharedArrayBuffer is unavailable', async () => {
    vi.stubGlobal('crossOriginIsolated', false);
    // @ts-expect-error - intentionally undefining for the test
    vi.stubGlobal('SharedArrayBuffer', undefined);

    const { getFFmpeg } = await import('../ffmpeg');
    await getFFmpeg();

    const config = loadMock.mock.calls[0]?.[0];
    expect(config).toMatchObject({
      coreURL: '/ffmpeg-core-st/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core-st/ffmpeg-core.wasm',
    });
    expect(config?.workerURL).toBeUndefined();
  });
});
