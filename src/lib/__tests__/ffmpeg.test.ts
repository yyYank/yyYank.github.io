import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('loads the single-threaded core', async () => {
    const { getFFmpeg } = await import('../ffmpeg');
    await getFFmpeg();

    expect(loadMock.mock.calls[0]?.[0]).toEqual({
      coreURL: '/ffmpeg-core-st/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core-st/ffmpeg-core.wasm',
    });
  });
});
