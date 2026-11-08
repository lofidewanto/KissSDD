// Run with: npm test (in docs/example/app)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './prompt-store.js'; // classic script: publishes globalThis.PromptStore

const {
  STORAGE_KEY, normalizeTags, parseTagInput, validatePrompt, createPrompt, updatePrompt,
  deletePrompt, sortByUpdated, searchPrompts, loadPrompts, savePrompts,
} = globalThis.PromptStore;

const draft = (over = {}) => ({ title: 'Code review', text: 'Review this diff for bugs.', tags: ['review'], ...over });

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    data,
  };
}

test('AC-1: create a prompt with title, text and tags', () => {
  const { prompts, errors } = createPrompt([], draft());
  assert.deepEqual(errors, []);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].title, 'Code review');
  assert.deepEqual(prompts[0].tags, ['review']);
  assert.equal(prompts[0].createdAt, prompts[0].updatedAt);
});

test('BR-1: title is required and at most 100 characters', () => {
  assert.match(validatePrompt(draft({ title: '   ' }), [])[0], /required/);
  assert.match(validatePrompt(draft({ title: 'x'.repeat(101) }), [])[0], /at most 100/);
  assert.deepEqual(validatePrompt(draft({ title: 'x'.repeat(100) }), []), []);
});

test('BR-1: title is unique, case-insensitive', () => {
  const { prompts } = createPrompt([], draft());
  assert.match(validatePrompt(draft({ title: 'CODE REVIEW' }), prompts)[0], /already exists/);
});

test('BR-2: text is required and at most 10,000 characters', () => {
  assert.match(validatePrompt(draft({ text: '  ' }), [])[0], /required/);
  assert.match(validatePrompt(draft({ text: 'x'.repeat(10001) }), [])[0], /at most 10000/);
});

test('BR-3: at most 5 tags, each 1–20 characters a–z, 0–9 or "-"', () => {
  assert.match(validatePrompt(draft({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }), [])[0], /At most 5/);
  assert.match(validatePrompt(draft({ tags: ['no spaces'] }), [])[0], /Invalid tag/);
  assert.match(validatePrompt(draft({ tags: ['x'.repeat(21)] }), [])[0], /Invalid tag/);
  assert.deepEqual(validatePrompt(draft({ tags: ['java', 'spring-boot', 'v2'] }), []), []);
});

test('R-2: tags are trimmed, lowercased and de-duplicated', () => {
  assert.deepEqual(normalizeTags([' AI', 'ai', 'Java ', '']), ['ai', 'java']);
  assert.deepEqual(parseTagInput('AI, Java  ,review,'), ['ai', 'java', 'review']);
});

test('AC-2: list is sorted by last update, newest first', () => {
  let { prompts } = createPrompt([], draft({ title: 'Old' }), new Date('2026-01-01'));
  ({ prompts } = createPrompt(prompts, draft({ title: 'New' }), new Date('2026-02-01')));
  assert.deepEqual(sortByUpdated(prompts).map((p) => p.title), ['New', 'Old']);
});

test('AC-2: prompts saved in the same millisecond are still newest first', () => {
  const sameTime = new Date('2026-01-01');
  let { prompts } = createPrompt([], draft({ title: 'A' }), sameTime);
  ({ prompts } = createPrompt(prompts, draft({ title: 'B' }), sameTime));
  ({ prompts } = createPrompt(prompts, draft({ title: 'C' }), sameTime));
  assert.deepEqual(sortByUpdated(prompts).map((p) => p.title), ['C', 'B', 'A']);
});

test('AC-2/AC-4: an edited prompt moves to the top, even in the same millisecond', () => {
  const sameTime = new Date('2026-01-01');
  let { prompts } = createPrompt([], draft({ title: 'A' }), sameTime);
  ({ prompts } = createPrompt(prompts, draft({ title: 'B' }), sameTime));
  ({ prompts } = updatePrompt(prompts, prompts[0].id, draft({ title: 'A', text: 'changed' }), sameTime));
  assert.deepEqual(sortByUpdated(prompts).map((p) => p.title), ['A', 'B']);
});

test('AC-3: search matches title, text and tags, case-insensitive', () => {
  let { prompts } = createPrompt([], draft({ title: 'Unit tests', text: 'Write JUnit tests', tags: ['java'] }));
  ({ prompts } = createPrompt(prompts, draft({ title: 'Summary', text: 'Summarize this', tags: ['writing'] })));
  assert.deepEqual(searchPrompts(prompts, 'UNIT').map((p) => p.title), ['Unit tests']);
  assert.deepEqual(searchPrompts(prompts, 'summarize').map((p) => p.title), ['Summary']);
  assert.deepEqual(searchPrompts(prompts, 'writing').map((p) => p.title), ['Summary']);
  assert.equal(searchPrompts(prompts, '  ').length, 2);
});

test('AC-4: edit keeps createdAt and changes updatedAt', () => {
  const { prompts } = createPrompt([], draft(), new Date('2026-01-01'));
  const id = prompts[0].id;
  const result = updatePrompt(prompts, id, draft({ text: 'New text' }), new Date('2026-03-01'));
  assert.deepEqual(result.errors, []);
  assert.equal(result.prompts[0].text, 'New text');
  assert.equal(result.prompts[0].createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(result.prompts[0].updatedAt, '2026-03-01T00:00:00.000Z');
});

test('R-1: editing a prompt may keep its own title', () => {
  const { prompts } = createPrompt([], draft());
  assert.deepEqual(updatePrompt(prompts, prompts[0].id, draft({ title: 'code review' })).errors, []);
});

test('AC-5: delete removes only the chosen prompt', () => {
  let { prompts } = createPrompt([], draft({ title: 'A' }));
  ({ prompts } = createPrompt(prompts, draft({ title: 'B' })));
  assert.deepEqual(deletePrompt(prompts, prompts[0].id).map((p) => p.title), ['B']);
});

test('AC-7: prompts survive a reload (save, then load)', () => {
  const storage = memoryStorage();
  const { prompts } = createPrompt([], draft());
  assert.equal(savePrompts(storage, prompts), null);
  assert.deepEqual(loadPrompts(storage), { prompts, warning: null });
});

test('R-3: a full storage gives an error message, not an exception', () => {
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.match(savePrompts(full, []), /storage is full/);
});

test('R-4: corrupt saved data gives an empty list and a warning', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
  const { prompts, warning } = loadPrompts(storage);
  assert.deepEqual(prompts, []);
  assert.match(warning, /could not be read/);
});
