// app.js — UI for the Prompt Manager. All rules live in prompt-store.js.
// Coding standard (TECH-SPEC.md): user data is only ever written with textContent, never innerHTML.
// Classic script (no ES modules), so the app also works from file://. Loaded after prompt-store.js.
const {
  parseTagInput, createPrompt, updatePrompt, deletePrompt,
  sortByUpdated, searchPrompts, loadPrompts, savePrompts,
} = window.PromptStore;

const $ = (id) => document.getElementById(id);
const form = $('form'), titleIn = $('title'), textIn = $('text'), tagsIn = $('tags');
const errorsEl = $('errors'), statusEl = $('status'), listEl = $('list'), emptyEl = $('empty');
const searchIn = $('search'), saveBtn = $('save'), cancelBtn = $('cancel'), formTitle = $('form-title');

let storage = null;
try { storage = window.localStorage; } catch { /* storage blocked */ }

const loaded = storage ? loadPrompts(storage) : { prompts: [], warning: 'Browser storage is not available. Prompts will not be saved.' };
let prompts = loaded.prompts;
let editingId = null;

function showStatus(message, warn = false) {
  statusEl.textContent = message ?? '';
  statusEl.classList.toggle('warn', warn);
}

function showErrors(errors) {
  errorsEl.replaceChildren(...errors.map((msg) => {
    const li = document.createElement('li');
    li.textContent = msg;
    return li;
  }));
}

function persist() {
  const error = storage ? savePrompts(storage, prompts) : 'Browser storage is not available.';
  if (error) showStatus(error, true);
  return !error;
}

function resetForm() {
  editingId = null;
  form.reset();
  showErrors([]);
  formTitle.textContent = 'New prompt';
  saveBtn.textContent = 'Save prompt';
  cancelBtn.hidden = true;
}

function startEdit(prompt) {
  editingId = prompt.id;
  titleIn.value = prompt.title;
  textIn.value = prompt.text;
  tagsIn.value = prompt.tags.join(', ');
  showErrors([]);
  formTitle.textContent = 'Edit prompt';
  saveBtn.textContent = 'Save changes';
  cancelBtn.hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
  titleIn.focus();
}

async function copyText(prompt) {
  try {
    await navigator.clipboard.writeText(prompt.text);
    showStatus(`Copied “${prompt.title}” to the clipboard.`);
  } catch {
    showStatus('Copy failed. Please select the text and copy it by hand.', true);
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick, className = '') {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function render() {
  const visible = sortByUpdated(searchPrompts(prompts, searchIn.value));
  listEl.replaceChildren(...visible.map((p) => {
    const li = el('li');
    const head = el('div', 'item-head');
    head.append(el('h2', '', p.title), el('span', 'meta', `Updated ${new Date(p.updatedAt).toLocaleString()}`));
    const tags = el('div', 'tags');
    tags.append(...p.tags.map((t) => el('span', 'tag', t)));
    const actions = el('div', 'row');
    actions.append(
      button('Copy', () => copyText(p), 'primary'),
      button('Edit', () => startEdit(p)),
      button('Delete', () => {
        if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
        prompts = deletePrompt(prompts, p.id);
        if (editingId === p.id) resetForm();
        if (persist()) showStatus(`Deleted “${p.title}”.`);
        render();
      }, 'danger'),
    );
    li.append(head, el('pre', '', p.text), tags, actions);
    return li;
  }));
  emptyEl.hidden = visible.length > 0;
  emptyEl.textContent = prompts.length ? 'No prompts match your search.' : 'No prompts yet. Create your first one above.';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const draft = { title: titleIn.value, text: textIn.value, tags: parseTagInput(tagsIn.value) };
  const result = editingId ? updatePrompt(prompts, editingId, draft) : createPrompt(prompts, draft);
  if (result.errors.length) {
    showErrors(result.errors);
    return;
  }
  const wasEditing = editingId !== null;
  prompts = result.prompts;
  if (persist()) showStatus(wasEditing ? 'Changes saved.' : 'Prompt saved.');
  resetForm();
  render();
});

cancelBtn.addEventListener('click', resetForm);
searchIn.addEventListener('input', render);

if (loaded.warning) showStatus(loaded.warning, true);
render();
