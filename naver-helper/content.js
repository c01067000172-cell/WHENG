(() => {
  const PAYLOAD_KEY = 'wheng_pending_blog_payload_v1';
  const STATUS_KEY = 'wheng_pending_blog_status_v1';
  const MAX_AGE = 10 * 60 * 1000;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function decodePayload(encoded) {
    try {
      let s = String(encoded || '').replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      const bin = atob(s);
      const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) {
      return null;
    }
  }

  async function seedPayloadFromUrl() {
    if (window.top !== window) return;
    const hash = String(location.hash || '');
    const match = hash.match(/(?:^#|&)wheng=([^&]+)/);
    if (!match) return;
    const payload = decodePayload(match[1]);
    if (!payload || !payload.title || !payload.body) return;
    payload.createdAt = Number(payload.createdAt || Date.now());
    await chrome.storage.local.set({
      [PAYLOAD_KEY]: payload,
      [STATUS_KEY]: { id: payload.createdAt, title: false, body: false, image: false }
    });
  }

  async function readState() {
    const data = await chrome.storage.local.get([PAYLOAD_KEY, STATUS_KEY]);
    const payload = data[PAYLOAD_KEY];
    const status = data[STATUS_KEY] || {};
    if (!payload || !payload.createdAt || Date.now() - Number(payload.createdAt) > MAX_AGE) return null;
    if (status.id !== payload.createdAt) {
      return { payload, status: { id: payload.createdAt, title: false, body: false, image: false } };
    }
    return { payload, status };
  }

  async function saveStatus(status) {
    await chrome.storage.local.set({ [STATUS_KEY]: status });
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  }

  function editableFrom(section) {
    if (!section) return null;
    if (section.matches?.('[contenteditable="true"]')) return section;
    return section.querySelector?.('[contenteditable="true"], .se-node') || null;
  }

  function findTitle() {
    const selectors = [
      '.se-section-documentTitle [contenteditable="true"]',
      '.se-documentTitle [contenteditable="true"]',
      '.se-section-documentTitle .se-node',
      '.se-title-text[contenteditable="true"]',
      '.se-title-text .se-node'
    ];
    for (const sel of selectors) {
      const nodes = [...document.querySelectorAll(sel)];
      const el = nodes.find(visible) || nodes[0];
      const ed = editableFrom(el);
      if (ed) return ed;
    }
    return null;
  }

  function findBody() {
    const selectors = [
      '.se-section-text [contenteditable="true"]',
      '.se-section-text .se-node',
      '.se-editable[contenteditable="true"]',
      '.se-main-container .se-text-paragraph [contenteditable="true"]',
      '.se-main-container .se-text-paragraph .se-node'
    ];
    for (const sel of selectors) {
      const nodes = [...document.querySelectorAll(sel)];
      for (const el of nodes) {
        if (el.closest?.('.se-section-documentTitle, .se-documentTitle')) continue;
        const ed = editableFrom(el);
        if (ed && visible(ed)) return ed;
      }
    }
    return null;
  }

  function replaceEditable(el, text) {
    if (!el || !text) return false;
    try {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.click?.();
      el.focus?.();

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);

      let ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch (_) {}
      if (!ok) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          composed: true,
          inputType: 'insertText',
          data: text
        }));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return String(el.innerText || el.textContent || '').trim().length > 0;
    } catch (_) {
      return false;
    }
  }

  function withSiteLink(payload) {
    const site = String(payload.siteUrl || 'https://wheng.onrender.com/').trim();
    let body = String(payload.body || '').trim();
    if (site && !body.includes(site)) body += '\n\n공식 사이트: ' + site;
    return body;
  }

  function toast(message) {
    try {
      if (window.top !== window) return;
      let box = document.getElementById('wheng-naver-helper-toast');
      if (!box) {
        box = document.createElement('div');
        box.id = 'wheng-naver-helper-toast';
        Object.assign(box.style, {
          position: 'fixed', right: '18px', bottom: '18px', zIndex: '2147483647',
          maxWidth: '420px', padding: '14px 16px', background: '#0f5132',
          color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '700',
          boxShadow: '0 10px 30px rgba(0,0,0,.25)'
        });
        document.documentElement.appendChild(box);
      }
      box.textContent = message;
      clearTimeout(box._timer);
      box._timer = setTimeout(() => box.remove(), 8000);
    } catch (_) {}
  }

  async function uploadImage(imageUrl, bodyEl) {
    if (!imageUrl) return false;
    const photoButton = [...document.querySelectorAll(
      'button.se-image-toolbar-button, button[aria-label*="사진"], button[title*="사진"]'
    )].find(visible);
    if (!photoButton) return false;

    try {
      bodyEl?.focus?.();
      bodyEl?.click?.();
      photoButton.click();
      await sleep(700);

      let input = [...document.querySelectorAll('input[type="file"]')]
        .find(el => String(el.accept || '').toLowerCase().includes('image'));
      if (!input) input = document.querySelector('input[type="file"]');
      if (!input) return false;

      const res = await fetch(imageUrl, { credentials: 'omit' });
      if (!res.ok) return false;
      const blob = await res.blob();
      const type = blob.type || 'image/png';
      const ext = type.includes('jpeg') ? 'jpg' : (type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
      const file = new File([blob], 'wheng-case.' + ext, { type });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await sleep(1800);
      const confirm = [...document.querySelectorAll('button.se-popup-button-confirm, button')]
        .find(el => visible(el) && /확인|첨부|등록/.test((el.textContent || '').trim()));
      if (confirm) confirm.click();
      return true;
    } catch (_) {
      return false;
    }
  }

  let busy = false;
  async function attemptFill() {
    if (busy) return;
    busy = true;
    try {
      const state = await readState();
      if (!state) return;
      const { payload, status } = state;
      let changed = false;

      if (!status.title) {
        const titleEl = findTitle();
        if (titleEl && replaceEditable(titleEl, String(payload.title || ''))) {
          status.title = true;
          changed = true;
        }
      }

      let bodyEl = findBody();
      if (!status.body && bodyEl) {
        if (replaceEditable(bodyEl, withSiteLink(payload))) {
          status.body = true;
          changed = true;
        }
      }

      if (status.body && !status.image && payload.imageUrl) {
        bodyEl = bodyEl || findBody();
        if (await uploadImage(String(payload.imageUrl), bodyEl)) {
          status.image = true;
          changed = true;
        }
      } else if (!payload.imageUrl && !status.image) {
        status.image = true;
        changed = true;
      }

      if (changed) await saveStatus(status);

      if (window.top === window && status.title && status.body) {
        toast(status.image
          ? 'WHENG: 제목·본문·사이트 링크·시공사진을 불러왔습니다. 확인 후 직접 발행하세요.'
          : 'WHENG: 제목·본문·사이트 링크를 불러왔습니다. 사진은 자동 첨부를 계속 시도합니다.');
      }
    } finally {
      busy = false;
    }
  }

  seedPayloadFromUrl().then(() => {
    attemptFill();
    const timer = setInterval(attemptFill, 900);
    setTimeout(() => clearInterval(timer), 30000);
  });
})();