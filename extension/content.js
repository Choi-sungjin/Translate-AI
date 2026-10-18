(() => {
  if (globalThis.__translateAI) return;
  globalThis.__translateAI = true;
  let settings = { inputEnabled: true, spaceInterval: 300, pageLanguage: 'ko', inputLanguage: 'en' };
  async function rpc(message) {
    let response;
    try { response = await chrome.runtime.sendMessage(message); }
    catch { throw new Error('확장 프로그램이 갱신되었습니다. 페이지를 새로고침하세요.'); }
    if (!response?.ok) throw new Error(response?.error || '번역 요청에 실패했습니다.');
    return response.data;
  }
  async function refreshSettings() { settings = await rpc({ type: 'TAI_SETTINGS' }); }
  void refreshSettings().catch(() => {});

  // A shadow root keeps the status UI separate from the page's styles and text extraction.
  let toastHost, toastRoot, toastTimer, inputNoticeUntil = 0;
  function dismissNotice() {
    clearTimeout(toastTimer); inputNoticeUntil = 0; toastHost?.remove();
    if (pageEnabled) updatePageStatus();
  }
  function notify(text, action, persistent = false, sticky = Boolean(action)) {
    if (persistent && performance.now() < inputNoticeUntil) return;
    if (!persistent) inputNoticeUntil = sticky ? Infinity : performance.now() + 30000;
    clearTimeout(toastTimer);
    if (!toastHost?.isConnected) {
      toastHost = document.createElement('div');
      toastHost.dataset.taiOwned = 'ui';
      toastHost.id = 'translate-ai-status';
      toastHost.style.cssText = 'position:fixed!important;top:16px!important;left:50%!important;transform:translateX(-50%)!important;z-index:2147483647!important;width:max-content!important;max-width:min(440px,calc(100vw - 32px))!important;';
      toastRoot = toastHost.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ':host{all:initial}.box{font:13px/1.6 system-ui,sans-serif;background:#132c29;color:#fff;padding:13px 16px;border-radius:13px;box-shadow:0 7px 30px #0003;display:flex;align-items:center;gap:12px}button{font:inherit;white-space:nowrap;cursor:pointer;border:1px solid #aac7be;background:#234b43;color:white;border-radius:7px;padding:5px 10px}button:focus-visible{outline:3px solid #d4e8a3}';
      const box = document.createElement('div'); box.className = 'box'; box.setAttribute('role', 'status');
      toastRoot.append(style, box); document.documentElement.append(toastHost);
    }
    const box = toastRoot.querySelector('.box'); box.replaceChildren();
    const label = document.createElement('span'); label.textContent = text; box.append(label);
    if (action) {
      const button = document.createElement('button'); button.textContent = action.label;
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', action.run); box.append(button);
    }
    if (!persistent) {
      const close = document.createElement('button'); close.textContent = '닫기'; close.setAttribute('aria-label', '번역 알림 닫기');
      close.addEventListener('mousedown', e => e.preventDefault());
      close.addEventListener('click', dismissNotice); box.append(close);
      if (!sticky) toastTimer = setTimeout(dismissNotice, 30000);
    }
  }

  // Page translation retains the original nodes and their event handlers.
  const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th,dt,dd,[role="paragraph"]';
  const EXCLUDED = 'script,style,noscript,pre,code,textarea,input,select,button,nav,header,footer,svg,math,[contenteditable]:not([contenteditable="false"]),[translate="no"],[data-tai-owned],.notranslate';
  let pageEnabled = false, pageEpoch = 0, pageBusy = 0, scanTimer;
  let mutationObserver, intersectionObserver;
  const entries = new Map();
  const pageQueue = [];
  function sourceText(node) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: text => text.parentElement?.closest(EXCLUDED) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const parts = []; while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
    return parts.join('').trim();
  }
  function visible(node) {
    if (node.closest('[hidden],[aria-hidden="true"]') || !node.getClientRects().length) return false;
    const style = getComputedStyle(node); return style.visibility !== 'hidden' && style.display !== 'none';
  }
  function pageStatus() {
    const list = [...entries.values()];
    return { enabled: pageEnabled, total: list.length, translated: list.filter(e => e.state === 'done').length, errors: list.filter(e => e.state === 'error').length, waiting: list.filter(e => ['queued', 'loading'].includes(e.state)).length };
  }
  function updatePageStatus() {
    if (!pageEnabled) return;
    const s = pageStatus();
    notify(`번역 ${s.translated} / ${s.total}${s.errors ? ` · 실패 ${s.errors}` : ''}${s.waiting ? ' · 처리 중' : ' · 스크롤하면 계속 번역'}`, { label: '원문 보기', run: stopPage }, true);
  }
  function enqueue(entry) {
    if (!pageEnabled || entry.state !== 'idle') return;
    entry.state = 'queued'; pageQueue.push(entry); pumpPage();
  }
  function pumpPage() {
    while (pageEnabled && pageBusy < (settings.provider === 'codex' ? 12 : 3) && pageQueue.length) {
      const entry = pageQueue.shift();
      if (!entry.node.isConnected || entries.get(entry.node) !== entry || entry.state !== 'queued') continue;
      pageBusy++; entry.state = 'loading'; const epoch = pageEpoch;
      const marker = document.createElement('span');
      marker.dataset.taiOwned = 'translation'; marker.className = 'tai-translation tai-loading';
      marker.textContent = '번역 중…'; marker.setAttribute('aria-live', 'polite');
      entry.marker = marker; entry.node.append(marker);
      rpc({ type: 'TAI_TRANSLATE', mode: 'page', text: entry.source }).then(result => {
        if (!pageEnabled || epoch !== pageEpoch || entries.get(entry.node) !== entry || !entry.node.isConnected || sourceText(entry.node) !== entry.source) return;
        marker.textContent = result.text; marker.lang = result.target; marker.className = 'tai-translation'; entry.state = 'done';
      }).catch(error => {
        if (!pageEnabled || epoch !== pageEpoch || entries.get(entry.node) !== entry) return;
        marker.className = 'tai-translation tai-error'; marker.textContent = error.message; entry.state = 'error';
      }).finally(() => { pageBusy--; updatePageStatus(); pumpPage(); });
    }
    updatePageStatus();
  }
  function scanPage() {
    if (!pageEnabled) return;
    for (const [node, entry] of entries) {
      if (!node.isConnected || sourceText(node) !== entry.source) {
        entry.marker?.remove(); intersectionObserver?.unobserve(node); entries.delete(node);
      }
    }
    const root = document.querySelector('main,article,[role="main"]') || document.body;
    if (!root) return;
    // Semantic paragraphs first; leaf divs cover simple sites lacking paragraph markup.
    const candidates = [...root.querySelectorAll(BLOCKS), ...root.querySelectorAll('div')];
    for (const node of candidates) {
      if (entries.size >= 1000) break;
      if (entries.has(node) || node.closest(EXCLUDED) || !visible(node)) continue;
      if (node.querySelector(BLOCKS)) continue;
      if (node.tagName === 'DIV' && node.querySelector('div,section,article,table,ul,ol,form')) continue;
      if ([...entries.keys()].some(other => other.contains(node) || node.contains(other))) continue;
      const source = sourceText(node);
      if (source.length < 3 || source.length > 12000 || !/\p{L}/u.test(source)) continue;
      const entry = { node, source, state: 'idle', marker: null }; entries.set(node, entry); intersectionObserver.observe(node);
    }
    updatePageStatus();
  }
  async function startPage() {
    await refreshSettings();
    if (pageEnabled) return;
    pageEnabled = true; pageEpoch++;
    intersectionObserver = new IntersectionObserver(records => {
      for (const record of records) if (record.isIntersecting) { const entry = entries.get(record.target); if (entry) enqueue(entry); }
    }, { rootMargin: '700px' });
    mutationObserver = new MutationObserver(records => {
      const relevant = records.some(record => {
        const el = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (el?.closest('[data-tai-owned]')) return false;
        if (record.type === 'childList') return [...record.addedNodes, ...record.removedNodes].some(n => !(n.nodeType === 1 && n.hasAttribute('data-tai-owned')));
        return true;
      });
      if (relevant) { clearTimeout(scanTimer); scanTimer = setTimeout(scanPage, 180); }
    });
    mutationObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
    scanPage();
  }
  function stopPage() {
    pageEnabled = false; pageEpoch++; clearTimeout(scanTimer); pageQueue.length = 0;
    mutationObserver?.disconnect(); intersectionObserver?.disconnect();
    for (const entry of entries.values()) entry.marker?.remove(); entries.clear();
    notify('원문으로 돌아왔습니다.');
  }

  // Only plain text is replaced. Lexical owns its DOM, so use its paste handler,
  // never replaceChildren on that editor or read private framework objects.
  function lexicalParagraphs(el) {
    if (el?.getAttribute('data-lexical-editor') !== 'true') return null;
    const paragraphs = [...el.childNodes];
    if (!paragraphs.length || paragraphs.some(p => p.nodeName !== 'P')) return null;
    for (const p of paragraphs) {
      for (const n of p.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) continue;
        if (n.nodeName === 'BR' && p.childNodes.length === 1) continue;
        if (n.nodeName !== 'SPAN' || n.getAttribute('data-lexical-text') !== 'true' || n.getAttribute('style') || n.getAttribute('class') || [...n.childNodes].some(c => c.nodeType !== Node.TEXT_NODE)) return null;
      }
    }
    return paragraphs;
  }
  function lexicalAdapter(el) {
    if (!lexicalParagraphs(el)) return null;
    const read = () => lexicalParagraphs(el)?.map(p => p.textContent).join('\n');
    return {
      read,
      caret: () => {
        const selection = getSelection(), paragraphs = lexicalParagraphs(el);
        if (!paragraphs || !selection?.rangeCount || !selection.isCollapsed || !el.contains(selection.anchorNode)) return -1;
        let offset = 0;
        for (const p of paragraphs) {
          if (p.contains(selection.anchorNode)) {
            const range = document.createRange(); range.selectNodeContents(p); range.setEnd(selection.anchorNode, selection.anchorOffset);
            return offset + range.toString().length;
          }
          offset += p.textContent.length + 1;
        }
        return selection.anchorNode === el && selection.anchorOffset === el.childNodes.length ? read().length : -1;
      },
      set: async (text, caret = text.length) => {
        if (!lexicalParagraphs(el)) throw new Error('편집기 내용이 바뀌어 번역을 적용하지 않았습니다.');
        const before = read();
        const range = document.createRange();
        range.setStart(el.firstChild, 0); range.setEnd(el.lastChild, el.lastChild.childNodes.length);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        // Let the editor consume selectionchange before its native input handler.
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (!focused(el) || read() !== before || !selection.rangeCount || selection.getRangeAt(0).cloneContents().textContent !== el.textContent) throw new Error('입력이 바뀌어 번역을 적용하지 않았습니다.');
        // Supply only text/plain to the editor's own paste handler. This does not
        // read or modify the system clipboard, and preserves Lexical's model.
        const data = new DataTransfer(); data.setData('text/plain', text);
        const paste = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true, composed: true });
        el.dispatchEvent(paste);
        if (!paste.defaultPrevented) throw new Error('이 편집기에서 텍스트 교체를 지원하지 않습니다.');
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (read() !== text) throw new Error('편집기가 번역문 적용을 확인하지 못했습니다. 입력 내용을 확인하세요.');
        let remaining = Math.max(0, Math.min(caret, text.length));
        for (const p of lexicalParagraphs(el)) {
          if (remaining > p.textContent.length) { remaining -= p.textContent.length + 1; continue; }
          const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const n = walker.currentNode;
            if (remaining > n.length) { remaining -= n.length; continue; }
            range.setStart(n, remaining); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange')); return;
          }
          range.selectNodeContents(p); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange')); return;
        }
      }
    };
  }
  function editableRoot(target) {
    if (!(target instanceof Element)) return null;
    if (target instanceof HTMLInputElement) return ['text', 'search'].includes(target.type) && !target.readOnly && !target.disabled ? target : null;
    if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled ? target : null;
    let node = target.closest('[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]');
    while (node?.parentElement?.isContentEditable) node = node.parentElement;
    return node && !node.closest('[data-tai-owned],[aria-readonly="true"]') ? node : null;
  }
  function adapter(el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return {
        read: () => el.value,
        caret: () => el.selectionStart === el.selectionEnd ? el.selectionStart : -1,
        set: (text, caret = text.length) => {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
          el.setSelectionRange(caret, caret);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText', data: text }));
        }
      };
    }
    if (el?.getAttribute('data-lexical-editor') === 'true') return lexicalAdapter(el);
    if (!el || [...el.childNodes].some(n => n.nodeType !== Node.TEXT_NODE)) return null;
    return {
      read: () => el.textContent,
      caret: () => {
        const selection = getSelection();
        if (!selection?.rangeCount || !selection.isCollapsed || !el.contains(selection.anchorNode)) return -1;
        const range = selection.getRangeAt(0).cloneRange(); range.selectNodeContents(el); range.setEnd(selection.anchorNode, selection.anchorOffset); return range.toString().length;
      },
      set: (text, caret = text.length) => {
        const textNode = document.createTextNode(text); el.replaceChildren(textNode);
        const range = document.createRange(); range.setStart(textNode, Math.min(caret, text.length)); range.collapse(true);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText', data: text }));
      }
    };
  }
  const revisions = new WeakMap(), jobs = new WeakMap();
  let sequence = null, composing = false;
  function bump(el) { if (el) revisions.set(el, (revisions.get(el) || 0) + 1); }
  function focused(el) { return el === document.activeElement || el.contains(document.activeElement); }
  async function translateInput(el, a) {
    if (!a || !settings.inputEnabled) return;
    const original = a.read(), caret = a.caret();
    if (!original.trim()) return;
    if (original.length > 12000) { notify('입력창 번역은 한 번에 12,000자까지 가능합니다.'); return; }
    const revision = revisions.get(el) || 0;
    const job = {}; jobs.set(el, job);
    notify('입력한 내용을 번역하고 있습니다…', null, false, true);
    try {
      const result = await rpc({ type: 'TAI_TRANSLATE', mode: 'input', text: original });
      if (jobs.get(el) !== job) return;
      if (!el.isConnected || !focused(el) || (revisions.get(el) || 0) !== revision || a.read() !== original) {
        notify('입력이 바뀌어 번역을 적용하지 않았습니다.'); return;
      }
      await a.set(result.text); const appliedRevision = revisions.get(el) || 0;
      notify('입력창을 번역했습니다.', { label: '원문 복구', run: async () => {
        if (!el.isConnected || a.read() !== result.text || (revisions.get(el) || 0) !== appliedRevision) { notify('입력이 바뀌어 원문 복구를 취소했습니다.'); return; }
        try { el.focus(); await a.set(original, Math.max(0, caret)); notify('입력 원문을 복구했습니다.'); }
        catch (error) { notify(error.message); }
      } });
    } catch (error) { if (jobs.get(el) === job) notify(error.message); }
  }
  document.addEventListener('compositionstart', () => { composing = true; sequence = null; }, true);
  document.addEventListener('compositionend', event => { composing = false; sequence = null; bump(editableRoot(event.target)); }, true);
  document.addEventListener('input', event => { bump(editableRoot(event.composedPath()[0])); }, true);
  document.addEventListener('beforeinput', event => { bump(editableRoot(event.composedPath()[0])); }, true);
  document.addEventListener('focusout', event => { sequence = null; bump(editableRoot(event.target)); }, true);
  document.addEventListener('pointerdown', () => { sequence = null; }, true);
  document.addEventListener('focusin', () => { void refreshSettings().catch(() => {}); }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== ' ' || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing || composing || event.keyCode === 229 || !settings.inputEnabled) { sequence = null; return; }
    const el = editableRoot(event.composedPath()[0]); const a = adapter(el);
    if (!a || !focused(el)) { sequence = null; return; }
    const now = performance.now(), value = a.read(), caret = a.caret();
    if (caret < 0) { sequence = null; return; }
    // Chromium's contenteditable inserts NBSP for visual space preservation.
    // Compare its representation here; restoring uses the untouched original string.
    const equivalent = (left, right) => el.isContentEditable ? left.replace(/\u00a0/g, ' ') === right.replace(/\u00a0/g, ' ') : left === right;
    if (!sequence || sequence.el !== el || now - sequence.last > settings.spaceInterval || !equivalent(value, sequence.expected) || caret !== sequence.caret) {
      sequence = { el, count: 0, base: value, start: caret, last: now, expected: value, caret };
    }
    sequence.count++; sequence.last = now;
    if (sequence.count === 3) {
      const { base, start } = sequence; sequence = null; event.preventDefault(); event.stopPropagation();
      void (async () => {
        try { await a.set(base, start); await translateInput(el, a); }
        catch (error) { notify(error.message); }
      })();
    } else {
      sequence.expected = value.slice(0, caret) + ' ' + value.slice(caret); sequence.caret = caret + 1;
    }
  }, true);
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message.type === 'TAI_PAGE_STATUS') { respond(pageStatus()); return false; }
    if (message.type === 'TAI_TOGGLE_PAGE') {
      if (pageEnabled) { stopPage(); respond({ ok: true }); }
      else startPage().then(() => respond({ ok: true }), e => { notify(e.message); respond({ ok: false, error: e.message }); });
      return true;
    }
    if (message.type === 'TAI_INPUT_NOW' && document.hasFocus()) {
      const el = editableRoot(document.activeElement), a = adapter(el);
      if (el && !a) notify('이 편집기는 서식 보존을 위해 아직 지원하지 않습니다.');
      else void translateInput(el, a);
    }
    return false;
  });
})();
