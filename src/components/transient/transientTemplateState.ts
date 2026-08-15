import { createId, type Template } from './transientNoteState';

export type { Template } from './transientNoteState';

export function sortTemplates(templates: Template[]): Template[] {
  return [...templates].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a.name.localeCompare(b.name, 'ja');
  });
}

export function normalizeTemplates(templates: Partial<Template>[]): Template[] {
  return sortTemplates(
    templates.map((template, index) => ({
      id: template.id ?? createId('template'),
      name: template.name ?? '',
      summary: template.summary ?? '',
      items: template.items ?? [],
      order:
        typeof template.order === 'number' && Number.isFinite(template.order)
          ? template.order
          : index + 1,
      cycle:
        template.cycle === 'weekly' || template.cycle === 'monthly' ? template.cycle : 'daily',
    }))
  );
}

export function getNextTemplateOrder(templates: Template[]): number {
  return templates.reduce((maxOrder, template) => Math.max(maxOrder, template.order), 0) + 1;
}

export const CYCLE_DEFAULT_TEMPLATES: Omit<Template, 'order'>[] = [
  {
    id: 'weekly-routine',
    name: '毎週のルーティン',
    summary: '今週やることを忘れないための確認用',
    items: ['今週の振り返りをした'],
    cycle: 'weekly',
  },
  {
    id: 'monthly-routine',
    name: '毎月のルーティン',
    summary: '今月やることを忘れないための確認用',
    items: ['ブログを書いた'],
    cycle: 'monthly',
  },
];

export function ensureCycleTemplates(templates: Template[]): Template[] {
  let result = sortTemplates(templates);
  for (const defaults of CYCLE_DEFAULT_TEMPLATES) {
    if (!result.some((template) => template.id === defaults.id)) {
      result = [...result, { ...defaults, order: getNextTemplateOrder(result) }];
    }
  }
  return result;
}

export function reindexTemplates(templates: Template[]): Template[] {
  return templates.map((template, index) => ({
    ...template,
    order: index + 1,
  }));
}

export function moveTemplate(
  templates: Template[],
  templateId: string,
  direction: 'up' | 'down'
): Template[] {
  const sortedTemplates = sortTemplates(templates);
  const currentIndex = sortedTemplates.findIndex((template) => template.id === templateId);
  if (currentIndex === -1) {
    return sortedTemplates;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= sortedTemplates.length) {
    return sortedTemplates;
  }

  const reorderedTemplates = [...sortedTemplates];
  const [movedTemplate] = reorderedTemplates.splice(currentIndex, 1);
  reorderedTemplates.splice(targetIndex, 0, movedTemplate);
  return reindexTemplates(reorderedTemplates);
}
