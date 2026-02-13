import { defineCollection, z } from 'astro:content';

const contentSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  order: z.number().optional().default(100),
  draft: z.boolean().optional().default(false),
});

const docsCollection = defineCollection({
  type: 'content',
  schema: contentSchema
});

const kotlinRevCollection = defineCollection({
  type: 'content',
  schema: contentSchema
});

export const collections = {
  docs: docsCollection,
  kotlinrev: kotlinRevCollection
};
