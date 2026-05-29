import { create } from "zustand";
import type { Tag } from "../lib/types";
import {
  listTags,
  createTag as ipcCreate,
  renameTag as ipcRename,
  setTagColor as ipcSetColor,
  deleteTag as ipcDelete,
  getTrackTags as ipcGetTrackTags,
  assignTags as ipcAssign,
  bulkAssignTags as ipcBulkAssign,
} from "../lib/ipc";

interface TagState {
  tags: Tag[];

  // ── Actions ──────────────────────────────────────────────────────────────
  loadTags: () => Promise<void>;
  createTag: (name: string, color?: string | null) => Promise<Tag>;
  renameTag: (id: number, name: string) => Promise<void>;
  setTagColor: (id: number, color: string | null) => Promise<void>;
  deleteTag: (id: number) => Promise<void>;
  getTrackTags: (trackId: number) => Promise<Tag[]>;
  assignTags: (trackId: number, tagIds: number[]) => Promise<void>;
  bulkAssignTags: (trackIds: number[], tagIds: number[]) => Promise<void>;
}

export const useTagStore = create<TagState>((set) => ({
  tags: [],

  async loadTags() {
    const tags = await listTags();
    set({ tags });
  },

  async createTag(name, color) {
    const tag = await ipcCreate(name, color);
    set((s) => ({ tags: [...s.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }));
    return tag;
  },

  async renameTag(id, name) {
    await ipcRename(id, name);
    set((s) => ({
      tags: s.tags
        .map((t) => (t.id === id ? { ...t, name } : t))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },

  async setTagColor(id, color) {
    await ipcSetColor(id, color);
    set((s) => ({
      tags: s.tags.map((t) => (t.id === id ? { ...t, color } : t)),
    }));
  },

  async deleteTag(id) {
    await ipcDelete(id);
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
  },

  async getTrackTags(trackId) {
    return ipcGetTrackTags(trackId);
  },

  async assignTags(trackId, tagIds) {
    await ipcAssign(trackId, tagIds);
  },

  async bulkAssignTags(trackIds, tagIds) {
    await ipcBulkAssign(trackIds, tagIds);
  },
}));
