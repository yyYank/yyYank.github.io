import { describe, expect, it } from 'vitest';
import {
  getNextTemplateOrder,
  moveTemplate,
  normalizeTemplates,
  reindexTemplates,
  sortTemplates,
  type Template,
} from '../transientTemplateState';

describe('transientTemplateState', () => {
  const templates: Template[] = [
    { id: 'b', name: '昼', summary: '', items: [], order: 2 },
    { id: 'a', name: '朝', summary: '', items: [], order: 1 },
    { id: 'c', name: '夜', summary: '', items: [], order: 3 },
  ];

  it('sorts by order then name', () => {
    expect(sortTemplates(templates).map((template) => template.id)).toEqual(['a', 'b', 'c']);
  });

  it('fills missing ids and order when normalizing templates', () => {
    const normalized = normalizeTemplates([
      { name: '夜', summary: '', items: [] },
      { name: '朝', summary: '', items: [], order: 5 },
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toMatchObject({ name: '夜', order: 1 });
    expect(normalized[0].id).toMatch(/^template-/);
    expect(normalized[1]).toMatchObject({ name: '朝', order: 5 });
  });

  it('returns next order based on current max', () => {
    expect(getNextTemplateOrder(templates)).toBe(4);
  });

  it('reindexes templates sequentially', () => {
    expect(reindexTemplates(sortTemplates(templates)).map((template) => template.order)).toEqual([
      1, 2, 3,
    ]);
  });

  it('moves a template up and reindexes', () => {
    expect(moveTemplate(sortTemplates(templates), 'b', 'up').map((template) => template.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(moveTemplate(sortTemplates(templates), 'b', 'up').map((template) => template.order)).toEqual([
      1, 2, 3,
    ]);
  });

  it('keeps order when move is out of bounds', () => {
    expect(moveTemplate(sortTemplates(templates), 'a', 'up').map((template) => template.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
