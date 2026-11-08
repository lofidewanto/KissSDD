// prompt-store.js — domain logic for the Prompt Manager.
// Pure functions, no DOM access. See TECH-SPEC.md and docs/user-story-plan/001-manage-prompts.md.
// A classic script (not an ES module), so the app also works when index.html is opened
// straight from disk (file://). It publishes one global: PromptStore.

(function () {
  'use strict';

  const STORAGE_KEY = 'kisssdd.prompts.v1';

  const LIMITS = Object.freeze({
    titleMax: 100,
    textMax: 10000,
    tagsMax: 5,
    tagMax: 20,
  });

  const TAG_PATTERN = /^[a-z0-9-]+$/;

  /** Trim, lowercase, drop empty values and duplicates. Order is kept. */
  function normalizeTags(tags) {
    const seen = new Set();
    const result = [];
    for (const raw of tags ?? []) {
      const tag = String(raw).trim().toLowerCase();
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        result.push(tag);
      }
    }
    return result;
  }

  /** Turn "AI, Java  ,review" into ["ai", "java", "review"]. */
  function parseTagInput(input) {
    return normalizeTags(String(input ?? '').split(','));
  }

  /**
   * Check a prompt draft against the business rules (BR-1 … BR-4).
   * Returns a list of error messages; an empty list means the draft is valid.
   * `ignoreId` excludes the prompt being edited from the uniqueness check.
   */
  function validatePrompt(draft, prompts, ignoreId = null) {
    const errors = [];
    const title = String(draft.title ?? '').trim();
    const text = String(draft.text ?? '');
    const tags = normalizeTags(draft.tags);

    if (!title) errors.push('Title is required.');
    else if (title.length > LIMITS.titleMax) errors.push(`Title must be at most ${LIMITS.titleMax} characters.`);
    else {
      const taken = prompts.some(
        (p) => p.id !== ignoreId && p.title.toLowerCase() === title.toLowerCase(),
      );
      if (taken) errors.push('A prompt with this title already exists.');
    }

    if (!text.trim()) errors.push('Prompt text is required.');
    else if (text.length > LIMITS.textMax) errors.push(`Prompt text must be at most ${LIMITS.textMax} characters.`);

    if (tags.length > LIMITS.tagsMax) errors.push(`At most ${LIMITS.tagsMax} tags are allowed.`);
    for (const tag of tags) {
      if (tag.length > LIMITS.tagMax || !TAG_PATTERN.test(tag)) {
        errors.push(`Invalid tag "${tag}": use 1–${LIMITS.tagMax} characters a–z, 0–9 or "-".`);
      }
    }
    return errors;
  }

  function newId() {
    return globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  /** Returns { prompts, errors }. On errors the list is returned unchanged. */
  function createPrompt(prompts, draft, now = new Date()) {
    const errors = validatePrompt(draft, prompts);
    if (errors.length) return { prompts, errors };
    const stamp = now.toISOString();
    const prompt = {
      id: newId(),
      title: draft.title.trim(),
      text: draft.text,
      tags: normalizeTags(draft.tags),
      createdAt: stamp,
      updatedAt: stamp,
    };
    return { prompts: [...prompts, prompt], errors: [] };
  }

  /**
   * Returns { prompts, errors }. createdAt stays, updatedAt changes.
   * The edited prompt moves to the end, so the list order is always the order of change.
   */
  function updatePrompt(prompts, id, draft, now = new Date()) {
    const current = prompts.find((p) => p.id === id);
    if (!current) return { prompts, errors: ['Prompt not found.'] };
    const errors = validatePrompt(draft, prompts, id);
    if (errors.length) return { prompts, errors };
    const updated = {
      ...current,
      title: draft.title.trim(),
      text: draft.text,
      tags: normalizeTags(draft.tags),
      updatedAt: now.toISOString(),
    };
    return { prompts: [...prompts.filter((p) => p.id !== id), updated], errors: [] };
  }

  function deletePrompt(prompts, id) {
    return prompts.filter((p) => p.id !== id);
  }

  /**
   * Newest change first (AC-2). Two changes in the same millisecond have the same
   * updatedAt; then the one later in the list (the newer one) comes first.
   */
  function sortByUpdated(prompts) {
    return prompts
      .map((prompt, index) => ({ prompt, index }))
      .sort((a, b) => b.prompt.updatedAt.localeCompare(a.prompt.updatedAt) || b.index - a.index)
      .map(({ prompt }) => prompt);
  }

  /** Case-insensitive search in title, text and tags (AC-3). Empty query returns everything. */
  function searchPrompts(prompts, query) {
    const q = String(query ?? '').trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.text.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q)),
    );
  }

  /**
   * Read prompts from storage. Corrupt or missing data gives an empty list
   * plus a warning, never an exception (review finding R-4).
   */
  function loadPrompts(storage) {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { prompts: [], warning: null };
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error('not an array');
      return { prompts: data, warning: null };
    } catch {
      return { prompts: [], warning: 'Saved prompts could not be read and were ignored.' };
    }
  }

  /** Returns null on success or an error message, e.g. when storage is full (review finding R-3). */
  function savePrompts(storage, prompts) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(prompts));
      return null;
    } catch {
      return 'Could not save: browser storage is full or not available.';
    }
  }

  globalThis.PromptStore = Object.freeze({
    STORAGE_KEY,
    LIMITS,
    normalizeTags,
    parseTagInput,
    validatePrompt,
    createPrompt,
    updatePrompt,
    deletePrompt,
    sortByUpdated,
    searchPrompts,
    loadPrompts,
    savePrompts,
  });
})();
