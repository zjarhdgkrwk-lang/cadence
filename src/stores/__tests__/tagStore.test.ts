import { describe, beforeEach, it, expect, vi } from "vitest";
import { useTagStore } from "../tagStore";
import type { Tag } from "../../lib/types";

vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (p: string) => p }));
vi.mock("../../lib/ipc", () => ({
  listTags: vi.fn(async () => []),
  createTag: vi.fn(async (name: string, color?: string | null): Promise<Tag> => ({
    id: 99,
    name,
    color: color ?? null,
  })),
  renameTag: vi.fn(async () => {}),
  setTagColor: vi.fn(async () => {}),
  deleteTag: vi.fn(async () => {}),
  getTrackTags: vi.fn(async () => []),
  assignTags: vi.fn(async () => {}),
  bulkAssignTags: vi.fn(async () => {}),
}));

function mkTag(id: number, name: string, color: string | null = null): Tag {
  return { id, name, color };
}

describe("useTagStore", () => {
  beforeEach(() => {
    useTagStore.setState({ tags: [] });
  });

  it("createTag adds and sorts tags", async () => {
    useTagStore.setState({ tags: [mkTag(1, "Jazz"), mkTag(2, "Pop")] });
    await useTagStore.getState().createTag("Alt");
    const tags = useTagStore.getState().tags;
    expect(tags[0].name).toBe("Alt");
    expect(tags[1].name).toBe("Jazz");
    expect(tags[2].name).toBe("Pop");
  });

  it("renameTag updates name and re-sorts", async () => {
    useTagStore.setState({ tags: [mkTag(1, "A"), mkTag(2, "C")] });
    await useTagStore.getState().renameTag(1, "Z");
    const tags = useTagStore.getState().tags;
    expect(tags[0].name).toBe("C");
    expect(tags[1].name).toBe("Z");
  });

  it("setTagColor updates color only", async () => {
    useTagStore.setState({ tags: [mkTag(1, "Rock", null)] });
    await useTagStore.getState().setTagColor(1, "#ff0000");
    expect(useTagStore.getState().tags[0].color).toBe("#ff0000");
  });

  it("deleteTag removes tag by id", async () => {
    useTagStore.setState({ tags: [mkTag(1, "A"), mkTag(2, "B")] });
    await useTagStore.getState().deleteTag(1);
    const tags = useTagStore.getState().tags;
    expect(tags).toHaveLength(1);
    expect(tags[0].id).toBe(2);
  });
});
