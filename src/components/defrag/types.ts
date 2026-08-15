/* 仕様書「2. データモデル」の型。保存形式(defrag:v6)と1対1に保つ */

export interface Pos { x: number; y: number; r: number }
export interface Child { id: string; text: string; createdAt: number }
export interface CardItem {
  id: string; kind: "card"; text: string; createdAt: number;
  topicId: string | null; color?: string; pos?: Pos;
}
export interface BundleItem {
  id: string; kind: "bundle"; title: string; createdAt: number;
  topicId: string | null; children: Child[]; color?: string; pos?: Pos;
}
export type Item = CardItem | BundleItem;
export type ItemPatch = Partial<Omit<CardItem, "id" | "kind">> & Partial<Omit<BundleItem, "id" | "kind">>;
export interface Topic { id: string; title: string; parentId: string | null; createdAt: number }
export type FolderRow = { type: "folder"; id: string; topic: Topic; title: string; depth: number; parent: string | null };
export type ItemRow = { type: "item"; id: string; item: Item; depth: number; parent: string | null };
export type Row = FolderRow | ItemRow;
export interface Frag { id: string; ownerId: string; text: string; createdAt: number; topicId: string | null }
export interface Persisted {
  items: Item[]; topics: Topic[]; expanded: Record<string, boolean>; here: string;
}
