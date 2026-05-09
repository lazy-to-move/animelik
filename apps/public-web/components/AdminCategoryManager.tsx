"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AdminCategoryItem = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string | Date;
  animeCount: number;
  taggedAnimeCount: number;
};

type AdminCategoryManagerProps = {
  items: AdminCategoryItem[];
};

type FormState = {
  name: string;
  slug: string;
  description: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export function AdminCategoryManager({ items }: AdminCategoryManagerProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );

  const editingCategory = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items],
  );
  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleIds.includes(id)));
  }, [visibleIds]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
  }

  function startEdit(item: AdminCategoryItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? "",
    });
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
  }

  async function readJson(response: Response) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      category?: AdminCategoryItem;
    };
    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }
    return payload;
  }

  async function runAction(actionKey: string, task: () => Promise<string>) {
    setBusyKey(actionKey);
    setMessage(null);
    try {
      const result = await task();
      setMessage({ tone: "success", text: result });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  function toggleSelection(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleAllVisible() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const actionKey = editingCategory ? `save-${editingCategory.id}` : "create-category";
    await runAction(actionKey, async () => {
      const response = await fetch(
        editingCategory ? `/api/admin/categories/${editingCategory.id}` : "/api/admin/categories",
        {
          method: editingCategory ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      await readJson(response);
      const resultText = editingCategory
        ? `${form.name} was updated successfully.`
        : `${form.name} was created successfully.`;
      cancelEdit();
      return resultText;
    });
  }

  return (
    <div className="admin-panels">
      <section className="panel watch-copy-panel">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{editingCategory ? "Edit category" : "Create category"}</h2>
          {editingCategory ? (
            <button type="button" className="button compact" onClick={cancelEdit}>
              Cancel
            </button>
          ) : (
            <button type="button" className="button compact" onClick={startCreate}>
              New category
            </button>
          )}
        </div>
        {message ? (
          <div className={`watch-sync-note ${message.tone}`}>{message.text}</div>
        ) : null}
        <form className="admin-inline-form" onSubmit={submitForm}>
          <label className="watchlist-field">
            <span>Name</span>
            <input
              aria-label="Category name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Action"
              required
            />
          </label>
          <label className="watchlist-field">
            <span>Slug</span>
            <input
              aria-label="Category slug"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              placeholder="action"
              required
            />
          </label>
          <label className="watchlist-field">
            <span>Description</span>
            <textarea
              aria-label="Category description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Optional description"
            />
          </label>
          <button type="submit" className="button primary" disabled={busyKey !== null}>
            {busyKey === (editingCategory ? `save-${editingCategory.id}` : "create-category")
              ? editingCategory
                ? "Saving..."
                : "Creating..."
              : editingCategory
                ? "Save category"
                : "Create category"}
          </button>
        </form>
      </section>

      <section className="panel watch-copy-panel">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Categories</h2>
          <span className="muted">{items.length} total</span>
        </div>
        <div className="admin-action-row" style={{ marginTop: 0, marginBottom: 16 }}>
          <label className="admin-checkbox-row">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
            <span>Select all visible</span>
          </label>
          <span className="muted">{selectedIds.length} selected</span>
          <button
            type="button"
            className="button compact danger"
            disabled={selectedIds.length === 0 || busyKey !== null}
            onClick={() => {
              if (!window.confirm(`Delete ${selectedIds.length} selected category record(s)?`)) return;
              void runAction("bulk-delete-categories", async () => {
                const response = await fetch("/api/admin/categories/bulk-delete", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ ids: selectedIds }),
                });
                await readJson(response);
                setSelectedIds([]);
                if (editingId && selectedIds.includes(editingId)) {
                  cancelEdit();
                }
                return `${selectedIds.length} category record(s) were deleted successfully.`;
              });
            }}
          >
            {busyKey === "bulk-delete-categories" ? "Deleting..." : "Delete selected"}
          </button>
        </div>
        <div className="admin-list">
          {items.length === 0 ? (
            <div className="admin-list-empty muted">No categories matched this filter.</div>
          ) : (
            items.map((item) => {
              const deleteKey = `delete-category-${item.id}`;
              return (
                <article key={item.id} className="admin-list-item">
                  <div className="admin-list-row">
                    <div className="row" style={{ alignItems: "flex-start", justifyContent: "flex-start", gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        aria-label={`Select ${item.name}`}
                        style={{ marginTop: 4 }}
                      />
                      <strong>{item.name}</strong>
                    </div>
                    <span className="pill">/{item.slug}</span>
                  </div>
                  <div className="admin-list-meta muted">
                    Primary anime: {item.animeCount}
                    {" | "}
                    Genre links: {item.taggedAnimeCount}
                    {" | "}
                    Added: {formatDate(item.createdAt)}
                  </div>
                  {item.description ? (
                    <div className="admin-list-meta muted">{item.description}</div>
                  ) : null}
                  <div className="admin-action-row">
                    <button type="button" className="button compact" onClick={() => startEdit(item)}>
                      Edit category
                    </button>
                    <button
                      type="button"
                      className="button compact danger"
                      disabled={busyKey !== null}
                      onClick={() => {
                        if (!window.confirm(`Delete category ${item.name}?`)) return;
                        void runAction(deleteKey, async () => {
                          const response = await fetch(`/api/admin/categories/${item.id}`, {
                            method: "DELETE",
                            credentials: "same-origin",
                          });
                          await readJson(response);
                          if (editingId === item.id) {
                            cancelEdit();
                          }
                          return `${item.name} was deleted successfully.`;
                        });
                      }}
                    >
                      {busyKey === deleteKey ? "Deleting..." : "Delete category"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
