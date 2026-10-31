export const GANBARI_STORAGE_KEY = 'otetsudai-data';

export const GANBARI_KINDS = ['otetsudai', 'naraigoto'] as const;
export type GanbariKind = (typeof GANBARI_KINDS)[number];

export interface Goal {
  target: number;
  reason?: string;
}

export interface AchievedGoal {
  kind: GanbariKind;
  target: number;
  reason?: string;
  points: number;
  achievedAt: string;
}

export interface Person {
  id: string;
  name: string;
  goals?: Partial<Record<GanbariKind, Goal>>;
  achievedGoals?: AchievedGoal[];
}

export interface GanbariRecord {
  id: string;
  personId: string;
  date: string;
  content: string;
  stamp: string;
  createdAt: string;
  kind: GanbariKind;
}

export interface GanbariData {
  people: Person[];
  records: GanbariRecord[];
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKind(value: unknown): value is GanbariKind {
  return GANBARI_KINDS.includes(value as GanbariKind);
}

function normalizeGoal(value: unknown): Goal | undefined {
  if (!isObject(value) || typeof value.target !== 'number' || value.target < 1) return undefined;
  const reason = typeof value.reason === 'string' && value.reason ? value.reason : undefined;
  return { target: value.target, ...(reason ? { reason } : {}) };
}

function normalizeAchievedGoal(value: unknown): AchievedGoal | null {
  if (
    !isObject(value)
    || !isKind(value.kind)
    || typeof value.target !== 'number'
    || typeof value.points !== 'number'
    || typeof value.achievedAt !== 'string'
  ) {
    return null;
  }
  const reason = typeof value.reason === 'string' && value.reason ? value.reason : undefined;
  return {
    kind: value.kind,
    target: value.target,
    ...(reason ? { reason } : {}),
    points: value.points,
    achievedAt: value.achievedAt,
  };
}

function normalizePerson(value: unknown): Person | null {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null;

  const storedGoals = isObject(value.goals) ? value.goals : {};
  const otetsudaiGoal = normalizeGoal(storedGoals.otetsudai)
    ?? (typeof value.goal === 'number' && value.goal >= 1
      ? {
          target: value.goal,
          ...(typeof value.goalReason === 'string' && value.goalReason
            ? { reason: value.goalReason }
            : {}),
        }
      : undefined);
  const naraigotoGoal = normalizeGoal(storedGoals.naraigoto);
  const goals = {
    ...(otetsudaiGoal ? { otetsudai: otetsudaiGoal } : {}),
    ...(naraigotoGoal ? { naraigoto: naraigotoGoal } : {}),
  };

  const achievedGoals = Array.isArray(value.achievedGoals)
    ? value.achievedGoals
      .map(normalizeAchievedGoal)
      .filter((goal): goal is AchievedGoal => goal !== null)
    : [];

  return {
    id: value.id,
    name: value.name,
    ...(Object.keys(goals).length > 0 ? { goals } : {}),
    ...(achievedGoals.length > 0 ? { achievedGoals } : {}),
  };
}

function normalizeRecord(value: unknown): GanbariRecord | null {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.personId !== 'string'
    || typeof value.date !== 'string'
    || typeof value.content !== 'string'
    || typeof value.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    personId: value.personId,
    date: value.date,
    content: value.content,
    stamp: typeof value.stamp === 'string' && value.stamp ? value.stamp : '💮',
    createdAt: value.createdAt,
    kind: isKind(value.kind) ? value.kind : 'otetsudai',
  };
}

export function normalizeGanbariData(value: unknown): GanbariData {
  if (!isObject(value)) return { people: [], records: [] };
  const people = Array.isArray(value.people)
    ? value.people.map(normalizePerson).filter((person): person is Person => person !== null)
    : [];
  const records = Array.isArray(value.records)
    ? value.records.map(normalizeRecord).filter((record): record is GanbariRecord => record !== null)
    : [];
  return { people, records };
}

export function loadGanbariData(storage: Storage): GanbariData {
  try {
    const raw = storage.getItem(GANBARI_STORAGE_KEY);
    return raw ? normalizeGanbariData(JSON.parse(raw)) : { people: [], records: [] };
  } catch {
    return { people: [], records: [] };
  }
}

export function saveGanbariData(storage: Storage, data: GanbariData): void {
  try {
    storage.setItem(GANBARI_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

export function countPoints(
  records: GanbariRecord[],
  personId: string,
  kind: GanbariKind,
  since?: string,
): number {
  return records.filter((record) =>
    record.personId === personId
    && record.kind === kind
    && (since === undefined || record.createdAt > since)).length;
}

export function lastAchievedAt(person: Person, kind: GanbariKind): string | undefined {
  return (person.achievedGoals ?? [])
    .filter((goal) => goal.kind === kind)
    .map((goal) => goal.achievedAt)
    .sort()
    .at(-1);
}

export function achieveGoal(
  person: Person,
  kind: GanbariKind,
  points: number,
  achievedAt: string,
): Person {
  const goal = person.goals?.[kind];
  if (!goal) return person;
  const { [kind]: _achieved, ...goals } = person.goals ?? {};
  return {
    ...person,
    goals: Object.keys(goals).length > 0 ? goals : undefined,
    achievedGoals: [
      ...(person.achievedGoals ?? []),
      { kind, target: goal.target, ...(goal.reason ? { reason: goal.reason } : {}), points, achievedAt },
    ],
  };
}

export function achievedGoalRecords(
  person: Person,
  records: GanbariRecord[],
  kind: GanbariKind,
  index: number,
): GanbariRecord[] {
  const goals = (person.achievedGoals ?? [])
    .filter((goal) => goal.kind === kind)
    .sort((a, b) => a.achievedAt.localeCompare(b.achievedAt));
  const goal = goals[index];
  if (!goal) return [];
  const since = goals[index - 1]?.achievedAt;
  return records
    .filter((record) =>
      record.personId === person.id
      && record.kind === kind
      && (since === undefined || record.createdAt > since)
      && record.createdAt <= goal.achievedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
