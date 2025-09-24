// content.js — con XPath y espera asíncrona
if (!window.__jira_sidepanel_cs) {
  window.__jira_sidepanel_cs = true;

  // ===== Utils =====
  function x$(xpath, root = document) {
    const res = document.evaluate(xpath, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return res.singleNodeValue || null;
  }

  function xa$(xpath, root = document) {
    const res = document.evaluate(xpath, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const arr = [];
    for (let i = 0; i < res.snapshotLength; i++) arr.push(res.snapshotItem(i));
    return arr;
  }

  function waitFor(fn, { interval = 100, timeout = 2000 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      const id = setInterval(() => {
        try {
          const val = fn();
          if (val) { clearInterval(id); resolve(val); }
          else if (Date.now() - start >= timeout) { clearInterval(id); resolve(null); }
        } catch {
          if (Date.now() - start >= timeout) { clearInterval(id); resolve(null); }
        }
      }, interval);
    });
  }

  // ===== Issue key / summary / status =====
  function detectIssueKeySync() {
    const m = location.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/);
    if (m) return m[1];
    const sp = new URLSearchParams(location.search);
    const si = sp.get('selectedIssue');
    if (si && /^[A-Z][A-Z0-9]+-\d+$/.test(si)) return si;
    const txt = document.body?.innerText || '';
    const mm = txt.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
    return mm ? mm[1] : null;
  }

  async function readIssueDataAsync() {
    const key = detectIssueKeySync();

    const summaryEl =
      (await waitFor(() =>
        document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]') ||
        document.querySelector('h1[aria-label="Issue summary"]') ||
        document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.left"] h1')
        , { timeout: 5000 })) || null;

    const statusEl =
      (await waitFor(() => x$('//button[@data-ssr-placeholder-replace="status-button"]//span'), { timeout: 5000 })) ||
      (await waitFor(() =>
        document.querySelector('[data-testid="issue.field.status"] [data-testid="issue-field-value"]') ||
        document.querySelector('[data-test-id="issue.views.status"]')
        , { timeout: 5000 })) || null;

    return {
      key,
      summary: summaryEl ? summaryEl.textContent.trim() : null,
      status: statusEl ? statusEl.textContent.trim() : null
    };
  }


  // ===== Descripción por XPath =====
  async function readDescriptionAsync() {
    // Espera hasta 3s a que el editor exista (ajusta si necesitas)
    const root = await waitFor(() => {
      return document.evaluate(
        "//div[@class='ak-renderer-document']",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
    }, { timeout: 3000 });
    if (!root) return '';

    return serializeProseMirror(root).trim();
  }

  /* === Helpers === */

  // Convierte el DOM del editor de Jira (ProseMirror) a texto/Markdown simple
  function serializeProseMirror(root) {
    const lines = [];
    // Itera por los hijos directos; si necesitas capturar elementos más profundos,
    // la función procesa recursivamente UL/OL/LI.
    for (const node of root.childNodes) {
      const chunk = serializeNode(node);
      if (chunk) {
        // `serializeNode` devuelve string o array de líneas
        if (Array.isArray(chunk)) lines.push(...chunk);
        else lines.push(chunk);
      }
    }
    // Limpia líneas vacías repetidas y recorta espacios
    let respuesta = lines
      .map(s => s.replace(/\s+\n/g, '\n').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return respuesta;

  }

  function serializeNode(node, listContext = null) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Texto directo (respeta whitespace razonable)
      return node.nodeValue.replace(/\s+/g, ' ').trim();
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = /** @type {HTMLElement} */ (node);
    const tag = el.tagName;

    // Párrafos
    if (tag === 'P') {
      // Concatena texto de sus hijos (strong/em/code, etc. -> innerText ya resuelve)
      const text = el.innerText.replace(/\s+\n/g, '\n').trim();
      return text ? text : '';
    }

    // Listas con viñetas (Jira suele usar class="ak-ul")
    if (tag === 'UL' || el.classList.contains('ak-ul')) {
      const out = [];
      const items = Array.from(el.querySelectorAll(':scope > li'));
      for (const li of items) {
        const liText = serializeListItem(li, '-');
        if (liText) out.push(liText);
      }
      return out;
    }

    // Listas numeradas (class="ak-ol")
    if (tag === 'OL' || el.classList.contains('ak-ol')) {
      const out = [];
      const items = Array.from(el.querySelectorAll(':scope > li'));
      items.forEach((li, idx) => {
        const liText = serializeListItem(li, `${idx + 1}.`);
        if (liText) out.push(liText);
      });
      return out;
    }

    // Elementos de lista (por si llegan aquí individualmente)
    if (tag === 'LI') {
      return serializeListItem(el, listContext?.bullet || '-');
    }

    // Saltos de línea “vacíos” del editor
    if (tag === 'BR') return '';

    // Contenedores/marks (strong, em, span, div, etc.): extrae su innerText
    // Si es un contenedor como <div> con más contenido, devuelve sus líneas concatenadas.
    const blockLike = ['DIV', 'SECTION', 'ARTICLE'];
    if (blockLike.includes(tag)) {
      const sub = [];
      for (const ch of el.childNodes) {
        const c = serializeNode(ch, listContext);
        if (Array.isArray(c)) sub.push(...c);
        else if (c) sub.push(c);
      }
      return sub.length ? sub.join('\n') : '';
    }

    // Por defecto: texto plano del elemento
    const txt = el.innerText.replace(/\s+\n/g, '\n').trim();
    return txt ? txt : '';
  }

  function serializeListItem(li, bullet = '-') {
    // Un <li> puede contener <p>, <ul>/<ol> anidados.
    const lines = [];

    // Texto del ítem en sí
    const headText = Array.from(li.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'P'))
      .map(n => (n.nodeType === Node.TEXT_NODE ? n.nodeValue : n.innerText) || '')
      .join(' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (headText) lines.push(`${bullet} ${headText}`);

    // Sub-listas anidadas
    const subUls = Array.from(li.children).filter(
      el => el.tagName === 'UL' || el.classList.contains('ak-ul')
    );
    const subOls = Array.from(li.children).filter(
      el => el.tagName === 'OL' || el.classList.contains('ak-ol')
    );

    for (const ul of subUls) {
      const items = Array.from(ul.querySelectorAll(':scope > li'));
      for (const subLi of items) {
        const subText = serializeListItem(subLi, '  -'); // identa subniveles
        if (subText) lines.push(subText);
      }
    }

    for (const ol of subOls) {
      const items = Array.from(ol.querySelectorAll(':scope > li'));
      items.forEach((subLi, idx) => {
        const subText = serializeListItem(subLi, `  ${idx + 1}.`);
        if (subText) lines.push(subText);
      });
    }

    return lines.join('\n');
  }


  // ===== Mensajería =====
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'GET_ISSUE_DATA') {
      readIssueDataAsync().then(sendResponse);
      return true;
    }
    if (msg?.type === 'GET_DESCRIPTION') {
      readDescriptionAsync().then(description => sendResponse({ description }));
      return true;
    }
    // NUEVO: devolver arreglo de textos encontrados por el XPath
    if (msg?.type === 'GET_KEYS_BY_XPATH') {
      try {
        const keys = getKeysByXPath();
        sendResponse({ keys }); // e.g., ["ABC-123", "XYZ-9"] o []
      } catch (e) {
        sendResponse({ keys: [], error: String(e) });
      }
      return true;
    }

  });
}

async function getActiveTabInfo() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_TAB_INFO' }, (res) => {
        void chrome.runtime.lastError; // <— absorbe "Receiving end..."
        resolve(res || {});
      });
    } catch (_) {
      resolve({});
    }
  });
}

// En unload, el puerto puede ya no existir: hazlo seguro
window.addEventListener('unload', async () => {
  try {
    const info = await getActiveTabInfo();
    const windowId = info.windowId ?? null;
    try { port.postMessage({ type: 'BYE_FROM_PANEL', windowId }); } catch (_) { }
  } catch (_) { }
});

// ---- Buscar textos por XPath específico (Jira keys en hover-card) ----
function getKeysByXPath() {
  const xpath = "//a[contains(@data-testid,'key')]";

  const snapshot = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  const out = [];
  for (let i = 0; i < snapshot.snapshotLength; i++) {
    const node = snapshot.snapshotItem(i);
    const text = (node.textContent || "").trim();
    if (text) out.push(text);
  }

  return out; // [] si no hay resultados o si todos están vacíos
}