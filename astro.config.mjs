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
