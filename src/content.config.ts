import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const contentSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  order: z.number().optional().default(100),
  draft: z.boolean().optional().default(false),
});

const docsCollection = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
  schema: contentSchema,
});

const kotlinRevCollection = defineCollection({
  loader: glob({ base: './src/content/kotlinrev', pattern: '**/*.{md,mdx}' }),
  schema: contentSchema,
});

export const collections = {
  docs: docsCollection,
  kotlinrev: kotlinRevCollection,
};
