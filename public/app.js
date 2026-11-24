const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const elements = {
  globalMessage: document.querySelector('#global-message'),
  siteSubtitle: document.querySelector('#site-subtitle'),
  viewToggle: document.querySelector('#view-toggle'),
  chatView: document.querySelector('#chat-view'),
  documentsView: document.querySelector('#documents-view'),

  chatMessages: document.querySelector('#chat-messages'),
  chatForm: document.querySelector('#chat-form'),
  chatInput: document.querySelector('#chat-input'),
  chatSubmit: document.querySelector('#chat-submit'),
  chatNew: document.querySelector('#chat-new'),
  chatFeedback: document.querySelector('#chat-feedback'),

  uploadForm: document.querySelector('#upload-form'),
  dropzone: document.querySelector('#dropzone'),
  fileInput: document.querySelector('#file-input'),
  fileInfo: document.querySelector('#file-info'),
  fileName: document.querySelector('#file-name'),
  fileMeta: document.querySelector('#file-meta'),
  clearFile: document.querySelector('#clear-file'),
  uploadButton: document.querySelector('#upload-button'),
  uploadFeedback: document.querySelector('#upload-feedback'),
  uploadResult: document.querySelector('#upload-result'),
  uploadRaw: document.querySelector('#upload-raw'),
  uploadRawContent: document.querySelector('#upload-raw-content'),

  refreshDocuments: document.querySelector('#refresh-documents'),
  documentsCount: document.querySelector('#documents-count'),
  documentsList: document.querySelector('#documents-list'),
  documentsEmpty: document.querySelector('#documents-empty'),
  documentsFeedback: document.querySelector('#documents-feedback'),

  searchForm: document.querySelector('#search-form'),
  searchQuery: document.querySelector('#search-query'),
  searchTopK: document.querySelector('#search-topk'),
  searchMinScore: document.querySelector('#search-minscore'),
  searchButton: document.querySelector('#search-button'),
  searchFeedback: document.querySelector('#search-feedback'),
  searchSummary: document.querySelector('#search-summary'),
  searchResults: document.querySelector('#search-results'),
  searchRaw: document.querySelector('#search-raw'),
  searchRawContent: document.querySelector('#search-raw-content'),
};

const state = {
  file: null,
  uploading: false,
  searching: false,
  chatBusy: false,
  view: 'chat',
};

init();

function init() {
  if (window.location.protocol === 'file:') {
    showGlobalMessage(
      'Open the frontend at http://localhost:3000 after starting the API. Opening the local file prevents API calls.',
    );
  }

  bindEvents();

  const initialView =
    window.location.hash === '#documents' ? 'documents' : 'chat';
  switchView(initialView);
}

function bindEvents() {
  elements.viewToggle.addEventListener('click', () => {
    switchView(state.view === 'chat' ? 'documents' : 'chat');
  });

  elements.chatForm.addEventListener('submit', handleChatSubmit);
  elements.chatNew.addEventListener('click', resetChat);
  elements.chatMessages.addEventListener('click', handleChatClick);
  elements.chatInput.addEventListener('input', () => {
    hideFeedback(elements.chatFeedback);
  });

  elements.fileInput.addEventListener('change', () => {
    const file = elements.fileInput.files?.[0];
    if (file) {
      selectFile(file);
    }
  });

  elements.dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      elements.fileInput.click();
    }
  });

  for (const type of ['dragenter', 'dragover']) {
    elements.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add('is-dragging');
    });
  }

  for (const type of ['dragleave', 'drop']) {
    elements.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove('is-dragging');
    });
  }

  elements.dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      selectFile(file);
    }
  });

  elements.clearFile.addEventListener('click', clearFile);
  elements.uploadForm.addEventListener('submit', handleUpload);
  elements.refreshDocuments.addEventListener('click', loadDocuments);
  elements.searchForm.addEventListener('submit', handleSearch);
}

function switchView(view) {
  const documents = view === 'documents';
  state.view = view;

  elements.chatView.hidden = documents;
  elements.documentsView.hidden = !documents;
  elements.viewToggle.textContent = documents ? 'Back to chat' : 'Documents';
  elements.siteSubtitle.textContent = documents
    ? 'Upload, inspect and search the documents used by the chat.'
    : 'Answers come only from your documents, with the passages they cite.';

  try {
    window.history.replaceState(null, '', documents ? '#documents' : '#chat');
  } catch {
    // History can fail on file://; navigation still works.
  }

  if (documents) {
    loadDocuments();
  }

  updateNewChatState();
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                       */
/* -------------------------------------------------------------------------- */

async function handleChatSubmit(event) {
  event.preventDefault();

  if (state.chatBusy) {
    return;
  }

  const question = elements.chatInput.value.trim();

  if (!question) {
    showFeedback(
      elements.chatFeedback,
      'error',
      'Type a question before sending.',
    );
    elements.chatInput.focus();
    return;
  }

  hideFeedback(elements.chatFeedback);
  elements.chatInput.value = '';
  appendUserMessage(question);
  const loading = appendLoadingMessage();
  setChatBusy(true);
  scrollChat();

  try {
    const data = await apiRequest('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    loading.replaceWith(createAssistantMessage(question, data));
  } catch (error) {
    loading.replaceWith(
      createChatErrorMessage(question, getErrorMessage(error)),
    );
  } finally {
    setChatBusy(false);
    scrollChat();
    elements.chatInput.focus();
  }
}

function setChatBusy(busy) {
  state.chatBusy = busy;
  elements.chatSubmit.disabled = busy;
  elements.chatInput.disabled = busy;
  elements.chatSubmit.textContent = busy ? 'Asking…' : 'Ask';
  updateNewChatState();
}

function resetChat() {
  if (state.chatBusy) {
    return;
  }

  elements.chatMessages.replaceChildren();
  elements.chatInput.value = '';
  hideFeedback(elements.chatFeedback);
  updateNewChatState();
  elements.chatInput.focus();
}

function updateNewChatState() {
  elements.chatNew.disabled =
    state.chatBusy || elements.chatMessages.children.length === 0;
}

function appendUserMessage(question) {
  const message = document.createElement('div');
  message.className = 'message message--user';

  const bubble = document.createElement('div');
  bubble.className = 'message__bubble';
  bubble.textContent = question;

  message.append(bubble);
  elements.chatMessages.append(message);
  updateNewChatState();
}

function appendLoadingMessage() {
  const message = document.createElement('div');
  message.className = 'message message--assistant';

  const panel = document.createElement('div');
  panel.className = 'assistant-panel assistant-panel--loading';

  const dots = document.createElement('span');
  dots.className = 'loading-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index += 1) {
    dots.append(document.createElement('span'));
  }

  const label = document.createElement('span');
  label.textContent = 'Searching the documents…';

  panel.append(dots, label);
  message.append(panel);
  elements.chatMessages.append(message);

  return message;
}

function createAssistantMessage(question, data) {
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const message = document.createElement('div');
  message.className = 'message message--assistant';

  const panel = document.createElement('div');
  panel.className = 'assistant-panel';

  const search = document.createElement('p');
  search.className = 'message__search';
  search.textContent = `Searched: “${question}” (${formatSourceCount(
    sources.length,
  )})`;

  const answer = document.createElement('div');
  answer.className = 'message__answer';
  renderAnswer(answer, String(data?.answer ?? ''), sources.length);

  panel.append(search, answer);

  if (sources.length > 0) {
    panel.append(renderSources(sources));
  }

  message.append(panel);
  return message;
}

function formatSourceCount(count) {
  if (count === 0) {
    return 'no passages';
  }

  return count === 1 ? '1 passage' : `${count} passages`;
}

function createChatErrorMessage(question, message) {
  const formatted = formatChatError(message);
  const article = document.createElement('div');
  article.className = 'message message--assistant';

  const panel = document.createElement('div');
  panel.className = 'assistant-panel assistant-panel--error';

  const search = document.createElement('p');
  search.className = 'message__search';
  search.textContent = `Searched: “${question}”`;

  const title = document.createElement('p');
  title.className = 'chat-error__title';
  title.textContent = formatted.title;

  const text = document.createElement('p');
  text.className = 'chat-error__text';
  text.textContent = formatted.text;

  panel.append(search, title, text);

  if (formatted.hint) {
    const hint = document.createElement('p');
    hint.className = 'chat-error__hint';
    hint.textContent = formatted.hint;
    panel.append(hint);
  }

  article.append(panel);
  return article;
}

function formatChatError(message) {
  if (message.includes('LLM provider is not configured')) {
    return {
      title: 'Chat is not configured yet.',
      text: 'Search found context, but generation could not run.',
      hint: 'Set LLM_API_KEY in .env and restart the API.',
    };
  }

  if (message.includes('LLM provider is unavailable')) {
    return {
      title: 'The LLM provider is unavailable.',
      text: 'Could not connect to DeepSeek.',
      hint: 'Check the connection and try again.',
    };
  }

  if (message.includes('LLM provider returned an error')) {
    return {
      title: 'The LLM provider returned an error.',
      text: message,
      hint: 'Check LLM_API_KEY, LLM_BASE_URL and LLM_MODEL in .env.',
    };
  }

  if (message.includes('Could not connect to the API')) {
    return {
      title: 'API unavailable.',
      text: message,
      hint: 'Make sure the API is running at http://localhost:3000.',
    };
  }

  return {
    title: 'Could not answer.',
    text: message,
    hint: null,
  };
}

function renderAnswer(container, answer, sourceCount) {
  container.replaceChildren();

  if (!answer.trim()) {
    container.textContent = 'No answer.';
    return;
  }

  const lines = answer.replace(/\r\n?/g, '\n').split('\n');
  let paragraph = null;
  let list = null;
  let listType = null;

  const flushParagraph = () => {
    if (paragraph) {
      container.append(paragraph);
      paragraph = null;
    }
  };

  const flushList = () => {
    if (list) {
      container.append(list);
      list = null;
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const title = document.createElement('h3');
      appendInline(title, heading[1], sourceCount);
      container.append(title);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();

      if (!list || listType !== 'ul') {
        flushList();
        list = document.createElement('ul');
        listType = 'ul';
      }

      const item = document.createElement('li');
      appendInline(item, bullet[1], sourceCount);
      list.append(item);
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();

      if (!list || listType !== 'ol') {
        flushList();
        list = document.createElement('ol');
        listType = 'ol';
      }

      const item = document.createElement('li');
      appendInline(item, numbered[1], sourceCount);
      list.append(item);
      continue;
    }

    flushList();

    if (!paragraph) {
      paragraph = document.createElement('p');
    } else {
      paragraph.append(document.createElement('br'));
    }

    appendInline(paragraph, line, sourceCount);
  }

  flushParagraph();
  flushList();
}

function appendInline(parent, text, sourceCount) {
  const pattern = /(\*\*[^*]+\*\*|\[\d+\])/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) {
      parent.append(
        document.createTextNode(text.slice(lastIndex, match.index)),
      );
    }

    const token = match[0];

    if (token.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else {
      const number = Number(token.slice(1, -1));

      if (number >= 1 && number <= sourceCount) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'citation';
        button.dataset.citation = String(number);
        button.textContent = token;
        button.title = `Go to source ${number}`;
        parent.append(button);
      } else {
        const missing = document.createElement('span');
        missing.className = 'citation citation--missing';
        missing.textContent = token;
        missing.title = 'Source not retrieved';
        parent.append(missing);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parent.append(document.createTextNode(text.slice(lastIndex)));
  }
}

function renderSources(sources) {
  const section = document.createElement('section');
  section.className = 'sources';

  const list = document.createElement('ol');
  list.className = 'source-list';

  sources.forEach((source, index) => {
    const item = document.createElement('li');
    item.className = 'source';
    item.dataset.sourceIndex = String(index + 1);

    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'source__link';
    link.textContent = `${source.filename} | passage ${source.chunkIndex}`;
    link.title = `Open quoted passage · score ${formatScore(source.score)}`;

    const ref = document.createElement('span');
    ref.className = 'source__ref';
    ref.textContent = `[${source.filename}#${source.chunkIndex}]`;

    const details = document.createElement('details');
    details.className = 'source__passage';

    const summary = document.createElement('summary');
    summary.textContent = 'Quoted passage';

    const content = document.createElement('pre');
    content.textContent =
      typeof source.content === 'string' && source.content.trim()
        ? source.content
        : 'Passage unavailable.';

    details.append(summary, content);
    item.append(link, ref, details);
    list.append(item);
  });

  section.append(list);
  return section;
}

function handleChatClick(event) {
  const target =
    event.target instanceof Element ? event.target.closest('.citation') : null;

  if (target && !target.classList.contains('citation--missing')) {
    const panel = target.closest('.assistant-panel');

    if (panel) {
      activateSource(panel, target.dataset.citation);
    }

    return;
  }

  const sourceLink =
    event.target instanceof Element
      ? event.target.closest('.source__link')
      : null;

  if (!sourceLink) {
    return;
  }

  const source = sourceLink.closest('.source');

  if (!source) {
    return;
  }

  const details = source.querySelector('details');
  if (details) {
    details.open = !details.open;
  }

  highlightSource(source);
}

function activateSource(panel, index) {
  const source = panel.querySelector(`.source[data-source-index="${index}"]`);

  if (!source) {
    return;
  }

  const details = source.querySelector('details');
  if (details) {
    details.open = true;
  }

  source.scrollIntoView({ behavior: 'smooth', block: 'center' });
  highlightSource(source);
}

function highlightSource(source) {
  source.classList.add('source--highlight');
  window.setTimeout(() => {
    source.classList.remove('source--highlight');
  }, 1800);
}

function scrollChat() {
  window.requestAnimationFrame(() => {
    const lastMessage = elements.chatMessages.lastElementChild;
    if (lastMessage) {
      lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

function selectFile(file) {
  const extension = getExtension(file.name);

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    showFeedback(
      elements.uploadFeedback,
      'error',
      'Unsupported format. Use .txt, .md or .markdown.',
    );
    clearFile();
    return;
  }

  if (file.size > MAX_FILE_BYTES) {
    showFeedback(
      elements.uploadFeedback,
      'error',
      'The file exceeds the 5 MB limit.',
    );
    clearFile();
    return;
  }

  if (file.size === 0) {
    showFeedback(elements.uploadFeedback, 'error', 'The file is empty.');
    clearFile();
    return;
  }

  state.file = file;
  elements.fileName.textContent = file.name;
  elements.fileMeta.textContent = `${formatBytes(file.size)} · ${extension
    .slice(1)
    .toUpperCase()}`;
  elements.fileInfo.hidden = false;
  elements.dropzone.hidden = true;
  elements.uploadButton.disabled = false;
  elements.uploadResult.hidden = true;
  elements.uploadRaw.hidden = true;
  hideFeedback(elements.uploadFeedback);
}

function clearFile() {
  state.file = null;
  elements.fileInput.value = '';
  elements.fileInfo.hidden = true;
  elements.fileName.textContent = '';
  elements.fileMeta.textContent = '';
  elements.dropzone.hidden = false;
  elements.uploadButton.disabled = true;
}

async function handleUpload(event) {
  event.preventDefault();

  if (state.uploading) {
    return;
  }

  if (!state.file) {
    showFeedback(
      elements.uploadFeedback,
      'error',
      'Select a file before uploading.',
    );
    return;
  }

  state.uploading = true;
  elements.uploadButton.disabled = true;
  elements.uploadButton.textContent = 'Uploading and generating embeddings…';
  elements.clearFile.disabled = true;
  hideFeedback(elements.uploadFeedback);
  elements.uploadResult.hidden = true;
  elements.uploadRaw.hidden = true;

  const formData = new FormData();
  formData.append('file', state.file);

  try {
    const result = await apiRequest('/documents', {
      method: 'POST',
      body: formData,
    });

    showFeedback(
      elements.uploadFeedback,
      'success',
      'Document saved and indexed successfully.',
    );
    renderUploadResult(result);
    clearFile();
    await loadDocuments();
  } catch (error) {
    showFeedback(elements.uploadFeedback, 'error', getErrorMessage(error));
  } finally {
    state.uploading = false;
    elements.clearFile.disabled = false;
    elements.uploadButton.textContent = 'Upload and generate embeddings';
    elements.uploadButton.disabled = !state.file;
  }
}

function renderUploadResult(data) {
  elements.uploadResult.replaceChildren();

  const title = document.createElement('strong');
  title.textContent = 'Document persisted';

  const chips = document.createElement('div');
  chips.className = 'chips';
  addChip(chips, `${data.chunks} ${data.chunks === 1 ? 'chunk' : 'chunks'}`);
  addChip(chips, `${data.characters} characters`);
  addChip(chips, data.mimeType);
  addChip(chips, formatDate(data.createdAt));

  const meta = document.createElement('p');
  meta.textContent = `${data.filename} · id ${data.id}`;

  elements.uploadResult.append(title, chips, meta);
  elements.uploadResult.hidden = false;

  elements.uploadRawContent.textContent = JSON.stringify(data, null, 2);
  elements.uploadRaw.hidden = false;
}

async function loadDocuments() {
  elements.refreshDocuments.disabled = true;
  hideFeedback(elements.documentsFeedback);

  try {
    const documents = await apiRequest('/documents');

    if (!Array.isArray(documents)) {
      throw new Error('Unexpected API response.');
    }

    renderDocuments(documents);
  } catch (error) {
    elements.documentsCount.textContent = '—';
    showFeedback(elements.documentsFeedback, 'error', getErrorMessage(error));
  } finally {
    elements.refreshDocuments.disabled = false;
  }
}

function renderDocuments(documents) {
  elements.documentsList.replaceChildren();
  elements.documentsCount.textContent =
    documents.length === 1 ? '1 document' : `${documents.length} documents`;
  elements.documentsEmpty.hidden = documents.length > 0;

  for (const documentData of documents) {
    const item = document.createElement('li');
    item.className = 'document-row';

    const badge = document.createElement('span');
    badge.className = 'doc-badge';
    badge.textContent =
      getExtension(documentData.filename).slice(1).toUpperCase() || 'DOC';

    const main = document.createElement('div');
    main.className = 'document-row__main';

    const name = document.createElement('strong');
    name.textContent = documentData.filename;

    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = documentData.mimeType;

    main.append(name, meta);

    const time = document.createElement('time');
    time.className = 'document-row__time';
    time.dateTime = documentData.createdAt;
    time.textContent = formatDate(documentData.createdAt);

    item.append(badge, main, time);
    elements.documentsList.append(item);
  }
}

async function handleSearch(event) {
  event.preventDefault();

  if (state.searching) {
    return;
  }

  const query = elements.searchQuery.value.trim();

  if (!query) {
    showFeedback(elements.searchFeedback, 'error', 'Type a query to search.');
    return;
  }

  const topK = Number(elements.searchTopK.value);

  if (!Number.isInteger(topK) || topK < 1 || topK > 50) {
    showFeedback(
      elements.searchFeedback,
      'error',
      'top-k must be an integer between 1 and 50.',
    );
    return;
  }

  const minScore = Number(elements.searchMinScore.value);

  if (!Number.isFinite(minScore) || minScore < -1 || minScore > 1) {
    showFeedback(
      elements.searchFeedback,
      'error',
      'min score must be between -1 and 1.',
    );
    return;
  }

  state.searching = true;
  elements.searchButton.disabled = true;
  elements.searchButton.textContent = 'Searching…';
  hideFeedback(elements.searchFeedback);
  elements.searchSummary.hidden = true;
  elements.searchResults.replaceChildren();
  elements.searchRaw.hidden = true;

  try {
    const data = await apiRequest('/retrieval/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, topK, minScore }),
    });

    renderSearchResults(data, query);
  } catch (error) {
    showFeedback(elements.searchFeedback, 'error', getErrorMessage(error));
  } finally {
    state.searching = false;
    elements.searchButton.disabled = false;
    elements.searchButton.textContent = 'Search';
  }
}

function renderSearchResults(data, query) {
  const results = Array.isArray(data?.results) ? data.results : [];

  elements.searchSummary.textContent = `${results.length} ${
    results.length === 1 ? 'result' : 'results'
  } for “${query}”.`;
  elements.searchSummary.hidden = false;

  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';

    const title = document.createElement('strong');
    title.textContent = 'No chunks passed the threshold.';

    const hint = document.createElement('span');
    hint.textContent =
      'Try a query closer to the content or lower min score to 0.';

    empty.append(title, hint);
    elements.searchResults.append(empty);
  } else {
    results.forEach((result, index) => {
      elements.searchResults.append(createSearchResult(result, index));
    });
  }

  elements.searchRawContent.textContent = JSON.stringify(data, null, 2);
  elements.searchRaw.hidden = false;
}

function createSearchResult(result, index) {
  const article = document.createElement('article');
  article.className = 'result';

  const header = document.createElement('header');
  header.className = 'result__header';

  const rank = document.createElement('span');
  rank.className = 'result__rank';
  rank.textContent = `#${index + 1}`;

  const file = document.createElement('span');
  file.className = 'result__file';
  file.textContent = result.filename;

  const meta = document.createElement('span');
  meta.className = 'result__meta';
  meta.textContent = `passage ${result.chunkIndex}`;

  const score = document.createElement('span');
  score.className = 'result__score';
  score.textContent = formatScore(result.score);

  header.append(rank, file, meta, score);

  const preview = document.createElement('p');
  preview.className = 'result__preview';
  preview.textContent = truncate(result.content, 280);

  article.append(header, preview);

  if (typeof result.content === 'string' && result.content.length > 280) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'View full content';

    const pre = document.createElement('pre');
    pre.textContent = result.content;

    details.append(summary, pre);
    article.append(details);
  }

  return article;
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(
      'Could not connect to the API. Make sure it is running at http://localhost:3000.',
    );
  }

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(' · ')
      : payload?.message || `Error ${response.status}`;

    throw new Error(message);
  }

  return payload;
}

function showFeedback(element, type, message) {
  element.className = `feedback feedback--${type}`;
  element.textContent = message;
  element.hidden = false;
}

function hideFeedback(element) {
  element.hidden = true;
  element.textContent = '';
  element.className = 'feedback';
}

function showGlobalMessage(message) {
  elements.globalMessage.textContent = message;
  elements.globalMessage.hidden = false;
}

function addChip(container, text) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = text;
  container.append(chip);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Unexpected error.';
}

function getExtension(name) {
  if (typeof name !== 'string') {
    return '';
  }

  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value ?? '')
    : dateFormatter.format(date);
}

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(4) : '—';
}

function truncate(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.length > maxLength
    ? `${value.slice(0, maxLength).trimEnd()}…`
    : value;
}
