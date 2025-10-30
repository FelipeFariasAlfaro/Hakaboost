

// ---------- Detección de Jira ----------
const JIRA_RE = /(\/browse\/|\/jira\/software\/c\/projects\/|\/projects\/)/i;

function isJiraUrl(url) {
  try {
    const u = new URL(url);
    const hostOk =
      /(?:^|\.)atlassian\.net$/.test(u.hostname) ||
      /(?:^|\.)jira\.com$/.test(u.hostname);
    const pathOk = JIRA_RE.test(u.pathname);
    return hostOk && pathOk;
  } catch {
    return false;
  }
}

// ---------- Side Panel on/off ----------
async function enableSidePanel(tabId) {
  await chrome.sidePanel
    .setOptions({ tabId, path: "sidepanel.html", enabled: true })
    .catch(() => { });
}

// ---------- Side Panel NO JIRA ----------
async function enableSidePaneNoJira(tabId) {
  await chrome.sidePanel
    .setOptions({ tabId, path: "nojira.html", enabled: true })
    .catch(() => { });
}

async function disableSidePanel(tabId) {
  await chrome.sidePanel
    .setOptions({ tabId, enabled: false })
    .catch(() => { });
}

// ---------- Estado por ventana ----------
/**
 * - portsByWindowId: puerto activo del sidepanel por ventana
 * - pendingCloseByWindowId: si hay un "close" pendiente (panel aún no listo)
 */
const portsByWindowId = new Map();
const pendingCloseByWindowId = new Map(); // windowId -> boolean

function markPendingClose(windowId, pending = true) {
  pendingCloseByWindowId.set(windowId, pending);
}
function hasPendingClose(windowId) {
  return pendingCloseByWindowId.get(windowId) === true;
}
function clearPendingClose(windowId) {
  pendingCloseByWindowId.delete(windowId);
}

function getWindowIdOfTab(tab) {
  return tab?.windowId ?? null;
}

// ---------- Mensajería segura ----------
function safeRuntimeSendMessage(msg) {
  try {
    chrome.runtime.sendMessage(msg, () => {
      // Absorbe el error si no hay receptor
      void chrome.runtime.lastError;
    });
  } catch (_) {}
}  

function safePortPostMessage(port, msg) {
  if (!port) return;
  try {
    port.postMessage(msg);
  } catch (_) {
    // Ignorar: puerto desconectado
  }
}

// ---------- Cerrar panel (con fallback/cola) ----------
function requestClosePanel(windowId) {
  // Evita estados zombi si no tenemos ventana
  if (windowId == null) return;

  const port = portsByWindowId.get(windowId);
  if (port) {
    // Intento por puerto con reintentos suaves (por timing del panel)
    safePortPostMessage(port, { type: "CLOSE_SIDE_PANEL" });
    setTimeout(() => safePortPostMessage(port, { type: "CLOSE_SIDE_PANEL" }), 200);
    setTimeout(() => safePortPostMessage(port, { type: "CLOSE_SIDE_PANEL" }), 600);
    clearPendingClose(windowId);
    return;
  }

  // No hay puerto aún → marcamos cierre pendiente
  markPendingClose(windowId, true);

  // Broadcast silencioso (por si el panel sí alcanza a oír runtime)
  safeRuntimeSendMessage({ type: "CLOSE_SIDE_PANEL" });
}

// ---------- Reconciliar estado por tab ----------
async function reconcileSidePanelForTab(tab) {
  if (!tab?.id || !tab?.url) return;

  const windowId = getWindowIdOfTab(tab);

  if (isJiraUrl(tab.url)) {
    
    await enableSidePanel(tab.id);
    if (windowId != null) clearPendingClose(windowId);


  } else {
    await enableSidePaneNoJira(tab.id);
    await disableSidePanel(tab.id);
  }
}

// ---------- Debounce para onUpdated ----------
const reconcileTimers = new Map(); // tabId -> timeoutId
function debounceReconcile(tab, wait = 150) {
  if (!tab?.id) return;
  const prev = reconcileTimers.get(tab.id);
  if (prev) clearTimeout(prev);
  const id = setTimeout(() => {
    reconcileTimers.delete(tab.id);
    reconcileSidePanelForTab(tab).catch((e) =>
      console.error("reconcileSidePanelForTab error:", e)
    );
  }, wait);
  reconcileTimers.set(tab.id, id);
}

// ---------- Listeners ----------
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete" || typeof changeInfo.url === "string") {
      debounceReconcile(tab);
    }
  } catch (e) {
    console.error("onUpdated error:", e);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await reconcileSidePanelForTab(tab);
  } catch (e) {
    console.error("onActivated error:", e);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    await reconcileSidePanelForTab(tab);
  } catch (e) {
    console.error("onFocusChanged error:", e);
  }
});

// Limpieza de estado al cerrar una ventana
chrome.windows.onRemoved.addListener((windowId) => {
  try {
    portsByWindowId.delete(windowId);
    pendingCloseByWindowId.delete(windowId);
  } catch (e) {
    console.error("onRemoved error:", e);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  try {
    if (command !== "toggle-sidepanel") return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab?.url) return;

    if (isJiraUrl(tab.url)) {
      await enableSidePanel(tab.id);
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
      } catch (_) { }
    } else {
      await disableSidePanel(tab.id);
      requestClosePanel(tab.windowId);
    }
  } catch (e) {
    console.error("onCommand error:", e);
  }
});

// Comportamiento del icono de acción
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (e) {
    console.error("onInstalled error:", e);
  }
});

// Mensajes ad-hoc
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg?.type === "GET_TAB_INFO") {
      chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => {
          sendResponse({
            url: tab?.url || null,
            tabId: tab?.id || null,
            windowId: tab?.windowId || null,
          });
        })
        .catch(() => sendResponse({ url: null, tabId: null, windowId: null }));
      return true; // respuesta asíncrona
    }
  } catch (e) {
    console.error("onMessage error:", e);
  }
});

// Handshake de puertos desde el sidepanel
chrome.runtime.onConnect.addListener((port) => {
  try {
    if (port.name !== "sidepanel-port") return;

    port.onMessage.addListener((m) => {
      try {
        if (m?.type === "HELLO_FROM_PANEL" && typeof m.windowId === "number") {
          portsByWindowId.set(m.windowId, port);

          // Si había un cierre pendiente, lo aplicamos inmediatamente
          if (hasPendingClose(m.windowId)) {
            safePortPostMessage(port, { type: "CLOSE_SIDE_PANEL" });
            setTimeout(
              () => safePortPostMessage(port, { type: "CLOSE_SIDE_PANEL" }),
              150
            );
            clearPendingClose(m.windowId);
          }
        }
        if (m?.type === "BYE_FROM_PANEL" && typeof m.windowId === "number") {
          portsByWindowId.delete(m.windowId);
          clearPendingClose(m.windowId);
        }
      } catch (e) {
        console.error("port.onMessage error:", e);
      }
    });

    port.onDisconnect.addListener(() => {
      try {
        // Eliminamos cualquier referencia a ese puerto
        for (const [winId, p] of portsByWindowId.entries()) {
          if (p === port) {
            portsByWindowId.delete(winId);
            break;
          }
        }
      } catch (e) {
        console.error("port.onDisconnect error:", e);
      }
    });
  } catch (e) {
    console.error("onConnect error:", e);
  }
});


chrome.runtime.onMessage.addListener((msg, sender) => {
  try {
    if (msg?.type === "CLOSE_PANEL") {
      const windowId = sender?.tab?.windowId ?? null;
      if (windowId != null) {
        requestClosePanel(windowId);
      } else {
        // En side panel sender.tab es undefined → cerrar todos los conocidos
        for (const [winId] of portsByWindowId.entries()) {
          requestClosePanel(winId);
        }
      }
    }
  } catch (e) {
    console.error("onMessage CLOSE_PANEL error:", e);
  }
});