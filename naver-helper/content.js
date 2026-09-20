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

  async function handoffFromWheng() {
    if (window.top !== window) return false;
    if (location.hostname !== 'wheng.onrender.com') return false;
    if (!/\/naver-helper\.html$/i.test(location.pathname)) return false;

    const hash = String(location.hash || '');
    const match = hash.match(/(?:^#|&)wheng=([^&]+)/);
    if (!match) return false;

    const payload = decodePayload(match[1]);
    if (!payload || !payload.title || !payload.body) return false;

    payload.createdAt = Number(payload.createdAt || Date.now());
    await chrome.storage.local.set({
      [PAYLOAD_KEY]: payload,
      [STATUS_KEY]: {
        id: payload.createdAt,
        title: false,
        body: false,
        image: false
      }
    });

    location.replace('https://blog.naver.com/solbi081?Redirect=Write&categoryNo=0');
    return true;
  }

  async function readState() {
    const data = await chrome.storage.local.get([PAYLOAD_KEY, STATUS_KEY]);
    const payload = data[PAYLOAD_KEY];
    const status = data[STATUS_KEY] || {};
    if (!payload || !payload.createdAt) return null;
    if (Date.now() - Number(payload.createdAt) > MAX_AGE) return null;

    if (status.id !== payload.createdAt) {
      return {
        payload,
        status: {
          id: payload.createdAt,
          title: false,
          body: false,
          image: false
        }
      };
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
    return r.width > 0 &&
      r.height > 0 &&
      s.display !== 'none' &&
      s.visibility !== 'hidden';
  }

  function normalizeEditable(el) {
    if (!el) return null;
    if (el.matches?.('[contenteditable="true"]')) return el;

    const child = el.querySelector?.('[contenteditable="true"]');
    if (child) return child;

    const parent = el.closest?.('[contenteditable="true"]');
    if (parent) return parent;

    return el;
  }

  function findTitle() {
    const selectors = [
      '.se-title-text',
      '.se-documentTitle .se-title-text',
      '.se-section-documentTitle .se-title-text',
      '.se-documentTitle [contenteditable="true"]',
      '.se-section-documentTitle [contenteditable="true"]',
      '[class*="documentTitle"] [contenteditable="true"]',
      '[class*="title"] [contenteditable="true"]'
    ];

    for (const sel of selectors) {
      const nodes = [...document.querySelectorAll(sel)];
      const node = nodes.find(visible) || nodes[0];
      if (node) return normalizeEditable(node);
    }
    return null;
  }

  function findBody() {
    const selectors = [
      '.se-main-container .se-text-paragraph',
      '.se-component-content .se-text-paragraph',
      '.se-section-text .se-text-paragraph',
      '.se-section-text [contenteditable="true"]',
      '.se-main-container [contenteditable="true"]',
      '.se-content [contenteditable="true"]',
      '[class*="main-container"] [contenteditable="true"]',
      '[class*="content"] [contenteditable="true"]'
    ];

    for (const sel of selectors) {
      const nodes = [...document.querySelectorAll(sel)];
      for (const node of nodes) {
        if (node.closest?.('.se-documentTitle, .se-section-documentTitle')) continue;
        const el = normalizeEditable(node);
        if (el && visible(el)) return el;
      }
    }
    return null;
  }

  function focusEditable(el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.click?.();
      el.focus?.();
      return true;
    } catch (_) {
      return false;
    }
  }

  function replaceEditable(el, text) {
    if (!el || !text) return false;
    try {
      el = normalizeEditable(el);
      if (!focusEditable(el)) return false;

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);

      let ok = false;
      try {
        ok = document.execCommand('insertText', false, text);
      } catch (_) {}

      if (!ok) {
        try {
          document.execCommand('delete', false, null);
          ok = document.execCommand('insertText', false, text);
        } catch (_) {}
      }

      if (!ok) {
        el.textContent = text;
        try {
          el.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            composed: true,
            inputType: 'insertText',
            data: text
          }));
        } catch (_) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      el.dispatchEvent(new Event('change', { bubbles: true }));

      const current = String(el.innerText || el.textContent || '').trim();
      return current.length > 0;
    } catch (_) {
      return false;
    }
  }

  function withSiteLink(payload) {
    const site = String(payload.siteUrl || 'https://wheng.onrender.com/').trim();
    let body = String(payload.body || '').trim();
    if (site && !body.includes(site)) {
      body += '\n\n공식 사이트: ' + site;
    }
    return body;
  }

  function toast(message, error = false) {
    try {
      if (window.top !== window) return;
      let box = document.getElementById('wheng-naver-helper-toast');
      if (!box) {
        box = document.createElement('div');
        box.id = 'wheng-naver-helper-toast';
        Object.assign(box.style, {
          position: 'fixed',
          right: '18px',
          bottom: '18px',
          zIndex: '2147483647',
          maxWidth: '460px',
          padding: '14px 16px',
          color: '#fff',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '700',
          lineHeight: '1.5',
          boxShadow: '0 10px 30px rgba(0,0,0,.25)'
        });
        document.documentElement.appendChild(box);
      }
      box.style.background = error ? '#b42318' : '#0f5132';
      box.textContent = message;
      clearTimeout(box._timer);
      box._timer = setTimeout(() => box.remove(), 9000);
    } catch (_) {}
  }

  function findPhotoButton() {
    const buttons = [...document.querySelectorAll('button')];

    const exact = buttons.find(btn =>
      visible(btn) &&
      /(^|\s)사진(\s|$)/.test((btn.textContent || '').trim())
    );
    if (exact) return exact;

    const attr = buttons.find(btn =>
      visible(btn) &&
      /사진|이미지/.test(
        [
          btn.getAttribute('aria-label') || '',
          btn.getAttribute('title') || ''
        ].join(' ')
      )
    );
    if (attr) return attr;

    return document.querySelector(
      'button.se-image-toolbar-button, [class*="image"] button'
    );
  }

  async function fileFromUrl(imageUrl) {
    const res = await fetch(imageUrl, { credentials: 'omit' });
    if (!res.ok) throw new Error('image fetch failed');
    const blob = await res.blob();
    const type = blob.type || 'image/png';
    const ext = type.includes('jpeg')
      ? 'jpg'
      : (type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
    return new File([blob], 'wheng-case.' + ext, { type });
  }

  async function uploadImage(imageUrl, bodyEl) {
    if (!imageUrl) return false;

    try {
      const file = await fileFromUrl(imageUrl);

      bodyEl?.click?.();
      bodyEl?.focus?.();

      let input = [...document.querySelectorAll('input[type="file"]')]
        .find(el => /image/i.test(String(el.accept || '')));

      if (!input) {
        const photoButton = findPhotoButton();
        if (!photoButton) return false;
        photoButton.click();
        await sleep(900);

        input = [...document.querySelectorAll('input[type="file"]')]
          .find(el => /image/i.test(String(el.accept || '')))
          || document.querySelector('input[type="file"]');
      }

      if (!input) return false;

      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', {
        bubbles: true,
        composed: true
      }));

      await sleep(2200);

      const confirm = [...document.querySelectorAll('button')]
        .find(el =>
          visible(el) &&
          /^(확인|첨부|등록|완료)$/.test((el.textContent || '').trim())
        );

      if (confirm) confirm.click();
      return true;
    } catch (_) {
      return false;
    }
  }

  let busy = false;
  let lastProgressAt = Date.now();

  async function attemptFill() {
    if (busy) return;
    if (!/\.naver\.com$/i.test(location.hostname)) return;

    busy = true;
    try {
      const state = await readState();
      if (!state) return;

      const { payload, status } = state;
      let changed = false;

      // 1) 제목부터 확실히 입력
      if (!status.title) {
        const titleEl = findTitle();
        if (titleEl && replaceEditable(titleEl, String(payload.title || ''))) {
          status.title = true;
          changed = true;
          lastProgressAt = Date.now();
          await saveStatus(status);
          await sleep(500);
        }
      }

      // 2) 사진을 먼저 올립니다.
      // 네이버 SmartEditor ONE은 사진 첨부 시 최초 빈 본문 컴포넌트를
      // 이미지 컴포넌트로 바꾸는 경우가 있어, 본문을 먼저 넣으면 사라질 수 있습니다.
      if (status.title && !status.image) {
        if (payload.imageUrl) {
          const anchorBody = findBody();
          if (await uploadImage(String(payload.imageUrl), anchorBody)) {
            status.image = true;
            changed = true;
            lastProgressAt = Date.now();
            await saveStatus(status);
            await sleep(1800);
          }
        } else {
          status.image = true;
          changed = true;
          await saveStatus(status);
        }
      }

      // 3) 사진이 자리 잡은 뒤 새 텍스트 영역을 찾아 본문 전체 입력
      if (status.title && status.image && !status.body) {
        const bodyEl = findBody();
        if (bodyEl && replaceEditable(bodyEl, withSiteLink(payload))) {
          status.body = true;
          changed = true;
          lastProgressAt = Date.now();
          await saveStatus(status);
        }
      }

      if (changed) await saveStatus(status);

      if (window.top === window && status.title && status.image && status.body) {
        toast('WHENG: 제목·시공사진·본문·사이트 링크까지 한 번에 입력했습니다. 내용 확인 후 직접 발행하세요.');
      } else if (
        window.top === window &&
        Date.now() - lastProgressAt > 14000
      ) {
        const missing = [
          !status.title ? '제목' : '',
          !status.image ? '사진' : '',
          !status.body ? '본문' : ''
        ].filter(Boolean).join('·');
        toast(
          'WHENG: '+missing+' 입력을 다시 시도 중입니다. 5~10초만 기다려주세요.',
          true
        );
        lastProgressAt = Date.now();
      }
    } finally {
      busy = false;
    }
  }

  async function start() {
    const handedOff = await handoffFromWheng();
    if (handedOff) return;

    if (!/\.naver\.com$/i.test(location.hostname)) return;

    await sleep(900);
    attemptFill();

    const timer = setInterval(attemptFill, 900);
    setTimeout(() => clearInterval(timer), 45000);

    const observer = new MutationObserver(() => {
      attemptFill();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    setTimeout(() => observer.disconnect(), 45000);
  }

  start();
})();