import { defineCollection, z } from 'astro:content';

const docsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().optional().default(100),
    draft: z.boolean().optional().default(false),
  })
});

export const collections = {
  docs: docsCollection
};
