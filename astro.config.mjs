import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from 'tailwindcss';

export default defineConfig({
  site: 'https://yyyank.github.io',
  integrations: [
    react(),
    mdx()
  ],
  output: 'static',
  redirects: {
    '/random_pass/': '/toolkit/?tab=random-pass',
    '/count/': '/toolkit/?tab=count',
    '/img_paste/': '/toolkit/?tab=img-paste',
    '/sounds/': '/toolkit/?tab=audio',
    '/movie/': '/toolkit/?tab=movie',
    '/ocr/': '/toolkit/?tab=ocr',
  },
  build: {
    assets: 'assets'
  },
  vite: {
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    worker: {
      format: 'iife',
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  }
});
