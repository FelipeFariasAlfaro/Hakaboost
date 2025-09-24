import {
  improveDescriptionGemini, improveDescriptionOpenAI, improveDescriptionChrome,
  waitForClickExecution, savedataIA, testOpenAIConfig
} from './js/iaworks.js';
import { testJiraConect, chachDefaultIssue } from './js/jiraworks.js'
import { ENDPOINTS } from './js/urls.js'
import { mask, isMasked, jiraRequest, crearTest } from './js/crearTest.js'


export const els = {
  url: document.getElementById('sp-url'),
  issue: document.getElementById('sp-issue'),
  summary: document.getElementById('sp-summary'),
  status: document.getElementById('sp-status'),
  refresh: document.getElementById('sp-refresh'),
  btnCopyKey: document.getElementById('copy-key'),
  btnCopyTitle: document.getElementById('copy-title'),
  //btnOpen: document.getElementById('open-in-jira'),
  tokenInput: document.getElementById('openai-token'),
  saveTokenBtn: document.getElementById('save-token'),
  btnLoadDesc: document.getElementById('btn-load-desc'),
  btnImprove: document.getElementById('btn-improve'),
  descOriginal: document.getElementById('desc-original'),
  descImproved: document.getElementById('desc-improved'),
  improveStatus: document.getElementById('improve-status'),
  btnquestion: document.getElementById('btn-question'),
  reemplazarDesc: document.getElementById('btn-reemplazar-desc'),
  divimprove: document.getElementById('div-desc-mejorada'),
  modelSelect: document.getElementById('openai-model'),
  setprompt: document.getElementById('set-prompt'),
  btndownloadfeature: document.getElementById('btndownloadfeature'),
  cofee: document.getElementById('cofee'),
  cucumberxray: document.getElementById('cucumber_xray'),
  cleantests: document.getElementById('cleantests')
};

export const elsCred = {
  iaselect: document.getElementById('iaselect'),
  openaidata: document.getElementById('openai-data'),
  geminidata: document.getElementById('gemini-data'),
  geminiModel: document.getElementById('gemini-model'),
  geminiToken: document.getElementById('gemini-token'),
  jiraBase: document.getElementById('jira-base'),
  jiraEmail: document.getElementById('jira-email'),
  jiraToken: document.getElementById('jira-token'),
  saveJira: document.getElementById('save-jira'),
  clearJira: document.getElementById('clear-jira'),
  jiraStatus: document.getElementById('jira-status'),
  xrayClientId: document.getElementById('xray-client-id'),
  xrayClientSecret: document.getElementById('xray-client-secret'),
  saveXray: document.getElementById('save-xray'),
  clearXray: document.getElementById('clear-xray'),
  xrayStatus: document.getElementById('xray-status'),
  chkissuetype: document.getElementById('chkissuetype'),
  inpissuetype: document.getElementById('inpissuetype'),
  linkedq: document.getElementById('linked_q'),
  issueq: document.getElementById('issue_q'),
  linked: document.getElementById('linked')
};

const elsEsc = {
  btnCrear: document.getElementById('btn-crear-escenarios'),
  status: document.getElementById('crear-escenarios-status'),
  mainissue: document.getElementById('mainissue')
};

const orden1 = `You're a QA expert. You're going to improve a Jira user story..

STRICT EXIT INSTRUCTIONS
- Respond in english.
- Do not add explanations, notes or text outside the indicated sections..
- Do not use Markdown formatting except for ONE single block of code for Gherkin.
- Do not include invisible characters, emojis, or decoration.

TASKS
1) Generate clear and precise "Acceptance Criteria" from the description. Just a short numbered list (no ATDD scenarios yet).
2) From those criteria, create "BDD Scenarios" in standard Gherkin.
   - Use EXACTLY these keywords (in English, without variations):
     Feature, Scenario, Given, When, Then, And, But
   - Strict syntax: Each keyword starts a line and is followed by a colon (:) and a space where applicable (e.g. "Feature: ...", "Scenario: ...").
   - Do not insert bullets, numbers, or other symbols inside the Gherkin block.
   - Don't use Outlines or Background Scenarios, just create simple Scenarios
   - You must create at least one scenario for each of the acceptance criteria (minimum 1)`;
  


/****************  Carga todo lo básico para el complemento *********************/
document.addEventListener('DOMContentLoaded', async () => {

  const { isregister } = await chrome.storage.sync.get('isregister');
  elsCred.openaidata.style = 'display:none';
  elsCred.geminidata.style = 'display:none';

  if (!isregister || isregister === 'false') {
    validateRegister();
    return;
  } else {


    const { firstTime } = await chrome.storage.sync.get('firstTime');
    if (firstTime + '' === 'true') {
      const result = await Swal.fire({
        title: 'Welcome',
        html: 'To get started with TestHunt, check the settings section, where you can connect to OpenAI/Gemini, Jira, and XRAY (optional). You can use the "?" buttons to get additional information.',
        icon: 'info',
        confirmButtonText: 'OK',
        width: "70%"
      });
      if (result.isConfirmed) {
        await chrome.storage.sync.set({ firstTime: 'false' });
      }
    }

    //lee el <<promptbase>> del localstorage sync
    const { promptbase } = await chrome.storage.sync.get(['promptbase']);
    if (!promptbase) {
      await chrome.storage.sync.set({
        promptbase: orden1
      });
    }

    //Obtiene los datos de credenciales de jira y xray
    const cfg = await chrome.storage.sync.get([
      'jira_base', 'jira_email', 'jira_token',
      'xray_client_id', 'xray_client_secret', 'linked', 'xray'
    ]);

    /** Lectura datos para OpenAI */
    const { openai_model } = await chrome.storage.sync.get(['openai_model']);
    els.modelSelect.value = openai_model || 'gpt-4o-mini';
    const { openai_token = '' } = await chrome.storage.sync.get('openai_token');
    if (openai_token) els.tokenInput.value = mask(openai_token);

    /** Lectura datos para Google */
    const { gemini_model } = await chrome.storage.sync.get(['gemini_model']);
    elsCred.geminiModel.value = gemini_model || 'gemini-2.5-flash';
    const { gemini_token = '' } = await chrome.storage.sync.get('gemini_token');
    if (gemini_token) elsCred.geminiToken.value = mask(gemini_token);

    //setear la IA por defecto a utilizar
    const { ia_default } = await chrome.storage.sync.get(['ia_default']);
    if (ia_default === "gemini") {
      elsCred.openaidata.style = 'display:none';
      elsCred.geminidata.style = 'display:block';
      iaselect.value = "Google Gemini";

    } else if(ia_default === "openai") {
      elsCred.openaidata.style = 'display:block';
      elsCred.geminidata.style = 'display:none';
      iaselect.value = "OpenAI";
    }else if(ia_default === "chrome"){
      elsCred.openaidata.style = 'display:none';
      elsCred.geminidata.style = 'display:none';
      iaselect.value = "ChromeIA";
    }else{
      await chrome.storage.sync.set({
        ia_default: 'chrome'
      });
    }

    // NUEVOS: leer descripción y mejorar
    els.refresh.addEventListener('click', refreshFromActiveTab);
    els.btnLoadDesc.addEventListener('click', leerDescripcionDesdeJira);
    els.btnImprove.addEventListener('click', improveDescriptionIssue);
    els.reemplazarDesc.addEventListener('click', reemplazarDescripcion);
    els.btnquestion.addEventListener('click', mensajeDeAyuda);
    els.setprompt.addEventListener('click', setPrompt);
    els.saveTokenBtn.addEventListener('click', savedataIA);
    //els.cofee.addEventListener('click', cofeeMenssage);
    els.cleantests.addEventListener('click', cleanTests);
    elsCred.iaselect.addEventListener('change', changeIa);
    elsCred.chkissuetype.addEventListener('change', chachDefaultIssue);
    els.btndownloadfeature.addEventListener('click', descargarFeature);
    elsCred.linkedq.addEventListener('click', dudaslinkeds);
    elsCred.issueq.addEventListener('click', dudasIssues);


    //Setea los valores de credenciales de xray y jira en el front
    if (cfg.jira_base) elsCred.jiraBase.value = cfg.jira_base;
    if (cfg.jira_email) elsCred.jiraEmail.value = cfg.jira_email;
    if (cfg.jira_token) elsCred.jiraToken.value = mask(cfg.jira_token);
    if (cfg.xray_client_id) elsCred.xrayClientId.value = cfg.xray_client_id;
    if (cfg.xray_client_secret) elsCred.xrayClientSecret.value = mask(cfg.xray_client_secret);
    if (!cfg.xray) await chrome.storage.sync.set({ xray: 'false' });
    //solo para el issue type de test, asegura que exista Test por defecto, si no se ha actualizado manualmente
    const { issue_type } = await chrome.storage.sync.get(['issue_type']);
    elsCred.inpissuetype.value = issue_type || 'Test';


    const { linked } = await chrome.storage.sync.get('linked');
    if (!linked) {
      // Valor por defecto
      await chrome.storage.sync.set({ linked: 'Test' });
      elsCred.linked.value = 'Test';
    } else {
      elsCred.linked.value = linked;
    }



    //Botones Guardar Jira
    elsCred.saveJira.addEventListener('click', async () => {
      const base = elsCred.jiraBase.value.trim();
      const email = elsCred.jiraEmail.value.trim();
      const inpissuetype = elsCred.inpissuetype.value.trim();
      let token = elsCred.jiraToken.value.trim();
      const linked = elsCred.linked.value.trim();


      if (!base || !email || !token || !inpissuetype) {
        Swal.fire('Upss', 'You must complete all Jira data.', 'error');
        return;
      }

      if (!isValidEmail(email)) {
        Swal.fire('Upss', 'You must specify your email in a valid format.', 'error');
        return;
      }

      if (isMasked(token)) {
        token = (await chrome.storage.sync.get('jira_token')).jira_token || '';
      }
      await chrome.storage.sync.set({ jira_base: base, jira_email: email, jira_token: token, issue_type: inpissuetype, linked: linked });
      elsCred.jiraToken.value = mask(token);

      testJiraConect();

    });

    //Botones Eliminar Jira
    elsCred.clearJira.addEventListener('click', async () => {
      await chrome.storage.sync.remove(['jira_base', 'jira_email', 'jira_token']);
      elsCred.jiraBase.value = elsCred.jiraEmail.value = elsCred.jiraToken.value = '';
      Swal.fire('Todo bien!', 'Credentials successfully removed.', 'success');
    });

    //Botones Guardar Xray
    elsCred.saveXray.addEventListener('click', async () => {
      const cid = elsCred.xrayClientId.value.trim();
      let csec = elsCred.xrayClientSecret.value.trim();
      if (!cid || !csec) {
        Swal.fire('Upss', 'You must enter Client Id and Secret', 'error');
        await chrome.storage.sync.set({ xray: 'false' });
        return;
      }
      if (isMasked(csec)) {
        csec = (await chrome.storage.sync.get('xray_client_secret')).xray_client_secret || '';
      }

      let validateXray = await xrayTestData(cid, csec);
      

      if(validateXray){
        await chrome.storage.sync.set({ xray_client_id: cid, xray_client_secret: csec, xray: 'true' });
        elsCred.xrayClientSecret.value = mask(csec);
        Swal.fire('All good!', 'X-ray Data Stored Correctly', 'success');
      }else{
        Swal.fire("Something doesn't add up", "We were unable to authenticate your XRAY data, please review it.", 'error');
      }

      
    });

    //Botones Eliminar Xray
    elsCred.clearXray.addEventListener('click', async () => {
      await chrome.storage.sync.remove(['xray_client_id', 'xray_client_secret']);
      elsCred.xrayClientId.value = elsCred.xrayClientSecret.value = '';
      await chrome.storage.sync.set({ xray: 'false' });
    });

    //Botón para creear los test
    elsEsc.btnCrear.addEventListener('click', async () => {
      crearTest(els, elsCred, elsEsc);
    });

    // Carga inicial
    await refreshFromActiveTab();

  }


});

async function mensajeDeAyuda() {
  Swal.fire({
    title: 'Information',
    html: `
    <p><strong>Improve Description:</strong> Use AI to formulate an improvement option for the description in Jira. </p>
    <p><strong>Create Tests:</strong> Automatically create tests (issues) based on the current description in Jira. The description must contain 'Scenarios' in gherkin.</p>
    <p><strong>Update Jira:</strong> Update the description in Jira with the AI-enhanced version. </p>

  `,
    icon: 'info',
    confirmButtonText: 'I understand',
    width: "80%"
  });
}

//Refresca los datos del issue... o lo intenta
async function refreshFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  els.url.value = tab.url || '–';

  try {
    await ensureContentScript(tab.id);
    const data = await retry(async () => {
      return await chrome.tabs.sendMessage(tab.id, { type: 'GET_ISSUE_DATA' });
    }, {
      tries: 5,
      delay: 300
    });
    Swal.close();
    renderIssueData(data);
  } catch (e) {
    Swal.close();
    renderIssueData(null);
  }
}



// Inyecta content.js si hace falta
async function ensureContentScript(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.url || !/(atlassian\.net|jira\.com)/.test(new URL(tab.url).hostname)) {
    Swal.fire({
      title: 'Error',
      html: 'This plugin works only in Jira.',
      icon: 'error',
      confirmButtonText: 'I understand'
    });
    throw new Error('Tab no es Jira');
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING_CS' });
    return;
  } catch { }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });

  await new Promise(r => setTimeout(r, 50));
}


//Lee la descripción de jira
export async function leerDescripcionDesdeJira() {
  els.improveStatus.textContent = 'Reading page description...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    Swal.fire({
      title: 'Error',
      html: 'Unable to read the page description. You must be in a Jira issue..',
      icon: 'error',
      confirmButtonText: 'I understand'
    });
    return;
  }

  //Helper para pedir la descripción
  const askForDescription = async () => {
    return await chrome.tabs.sendMessage(tab.id, { type: 'GET_DESCRIPTION' });
  };
  const resp = await askForDescription();

  try {
    const text = (resp && resp.description) ? resp.description.trim() : '';
    els.descOriginal.value = text;
    return;
  } catch (e1) {
    Swal.fire({
      title: 'Error',
      html: 'Unable to read the page description. You must be in a Jira issue.',
      icon: 'error',
      confirmButtonText: 'I understand'
    });
  }
}

//Verifica que la pagina donde está el usuario sea la issue de jira
//donde se creó la mejora, si es correcto la inyecta mediante API Rest
async function reemplazarDescripcion() {

  Swal.fire({
    title: 'Checking...',
    text: 'We are checking that everything is working correctly, please wait....',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading(); // icono de loading
    }
  });

  await refreshFromActiveTab();
  const issueT = els.issue.value.toLowerCase();
  const statusT = els.status.value.toLowerCase();
  const summaryT = els.summary.value.toLowerCase();
  const urlT = els.url.value.toLowerCase();

  if (!urlT.includes(issueT)) {
    Swal.close();
    Swal.fire({
      title: 'Error in the Matrix',
      text: 'It looks like you created this improved description in another issue. You cant update the current page. Well clean everything up.',
      icon: 'error',
      confirmButtonText: 'I understand'
    });
    els.descImproved.value = '';
    els.reemplazarDesc.disabled = true;
    els.divimprove.style = 'display:none';
    return;
  }

  // 1) Validar datos mínimos
  const improved = (els.descImproved?.value || '').trim();
  if (!improved) {
    Swal.close();
    Swal.fire({
      title: 'not so fast',
      text: 'You must first generate an improved description from the "Improve Desc." button.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    els.improveStatus.textContent = 'There is no enhanced description to submit.';
    return;
  }

  const storyKey = (els.issue?.value || '').trim();
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(storyKey)) {
    els.improveStatus.textContent = 'The issue key was not detected.';
    return;
  }

  // 2) Resolver credenciales Jira
  const cfg = await chrome.storage.sync.get(['jira_base', 'jira_email', 'jira_token']);
  let { jira_base, jira_email, jira_token } = cfg;

  if (!jira_base) jira_base = elsCred.jiraBase.value.trim();
  if (!jira_email) jira_email = elsCred.jiraEmail.value.trim();
  if (!jira_token) {
    const raw = elsCred.jiraToken.value.trim();
    if (!isMasked(raw)) {
      jira_token = raw;
      await chrome.storage.sync.set({ jira_token });
    } else {
      jira_token = (await chrome.storage.sync.get('jira_token')).jira_token || '';
    }
  }

  if (!jira_base || !jira_email || !jira_token) {
    Swal.close();
    Swal.fire({
      title: 'Jira credentials are missing',
      text: 'You must first configure your Jira credentials in the configuration panel.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    return;
  }

  try {
    Swal.close();
    Swal.fire({
      title: 'In progress...',
      text: "Please wait, we're updating the description in Jira...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    els.improveStatus.textContent = 'Updating description in Jira...';

    // 3) Convertir el texto a ADF
    const adf = toAdfTextCompl(improved);

    // 4) PUT
    await jiraRequest({
      jira_base, jira_email, jira_token,
      path: `/rest/api/3/issue/${encodeURIComponent(storyKey)}`,
      method: 'PUT',
      body: { fields: { description: adf } }
    });

    Swal.fire({
      title: 'All good!',
      html: 'The description in Jira has been updated. <strong>To see the changes you must refresh the page.</strong>',
      icon: 'success',
      confirmButtonText: 'OK'
    });

    // 5) (Opcional) refrescar lo que muestra el panel desde la pestaña activa
    // para ver el cambio reflejado
  } catch (e) {
    console.error(e);
    Swal.fire({
      title: 'Houston, we have a problem.',
      text: "The description in Jira hasn't been updated. Are your credentials correct?",
      icon: 'error',
      confirmButtonText: 'OK'
    });
  }
}

async function setPrompt() {
  var { promptbase } = await chrome.storage.sync.get(['promptbase']);
  if(promptbase.trim().toLowerCase() === orden1.trim().toLowerCase())
  {
    promptbase = "";
  }

  const { value: text, isConfirmed, isDenied } = await Swal.fire({
    title: "Prompt configuration",
    html: `
      <p style="margin: 10px 0 15px 0; font-size:13px;">
        Here you can add a custom Prompt, <strong>if you do</strong> This will be used instead of our original logic. Similarly, you can return to the original prompt at any time using the button. "Load Original"
      </p>
    `,
    input: "textarea",
    inputValue: promptbase || "",
    width: "80%",
    showCancelButton: true,
    confirmButtonText: "Save Changes",
    denyButtonText: "Load Original",
    cancelButtonText: "Cancel",
    showDenyButton: true
  });

  if (isConfirmed && text.length > 10) {
    //Guardar nuevo prompt
    await chrome.storage.sync.set({ promptbase: text });
    Swal.fire({
      icon: "success",
      title: "Prompt updated",
      text: "The new prompt has been saved successfully. If it doesn't work, try returning to the original prompt."
    });
  } else if (isConfirmed && text.length <= 10) {
    Swal.fire({
      icon: "error",
      title: "Skynet Activated!",
      text: "You must store minimally valid text as a prompt. We won't store this prompt to avoid upsetting the AI."
    });
  }
  else if (isDenied) {
    // Cargar prompt original (puedes cambiar el string según necesites)
    const promptOriginal = orden1;
    await chrome.storage.sync.set({ promptbase: promptOriginal });
    Swal.fire({
      icon: "info",
      title: "Prompt restored",
      text: "The original prompt has been loaded."
    });
  }
}


async function changeIa() {
  var seleccion = elsCred.iaselect.value;
  if (seleccion == "Google Gemini") {
    elsCred.openaidata.style = 'display:none';
    elsCred.geminidata.style = 'display:block';
  } else if (seleccion == "OpenAI"){
    elsCred.openaidata.style = 'display:block';
    elsCred.geminidata.style = 'display:none';
  }else{
    elsCred.openaidata.style = 'display:none';
    elsCred.geminidata.style = 'display:none';
  }
}


async function improveDescriptionIssue() {

  const { ia_default = '' } = await chrome.storage.sync.get('ia_default');
  if (ia_default === 'gemini') {
    await improveDescriptionGemini(els);
  }
  else if (ia_default === 'openia'){
    await improveDescriptionOpenAI(els);
  }else if(ia_default === 'chrome'){
    await improveDescriptionChrome(els);
  }


}

/**********************************************/
/****************** HELPERS *******************/
/**********************************************/

//Reintentos para leer los datos de la issue en jira
// El "delay" es en milisegundos.
async function retry(fn, { tries, delay } = {}) {
  Swal.fire({
    title: 'Starting machines!',
    text: "We're trying to read data from Jira. Please wait.",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading(); // icono de loading
    }
  });
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fn(); // si vino vacío, seguimos intentando 
      if (!res || (!res.key && !res.summary && !res.status)) {
        lastErr = new Error('Incomplete response');
        Swal.close();
      } else {
        return res;
        Swal.close();
      }
    } catch (e) {
      lastErr = e;
      Swal.close();
    }
    await new Promise(r => setTimeout(r, delay));
    Swal.close();
  } throw lastErr || new Error('retry agotado');
}


//Renderiza (o setea) los valores del issue en los imputs de jira
function renderIssueData(data) {
  if (!data) {
    els.issue.value = '–';
    els.summary.value = '–';
    els.status.value = '–';

    Swal.fire({
      title: 'Error in the Matrix',
      html: 'To use TestHunt correctly the browser must be in a valid task',
      icon: 'info',
      confirmButtonText: 'OK',
      width: "80%"
    });
    return;
  }

  els.issue.value = data.key || '–';
  els.summary.value = data.summary || '–';
  els.status.value = data.status || '–';

  if (!data?.status || !data?.summary) {
    Swal.fire({
      title: 'Error in the Matrix',
      html: 'To use TestHunt correctly the browser must be in a valid task.',
      icon: 'info',
      confirmButtonText: 'OK',
      width: "80%"
    });
  }

}

//Normaliza el texto que se actualizará en la HU
function toAdfTextCompl(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const parts = p.split(/\n/);
      const content = [];
      parts.forEach((line, idx) => {
        if (line.length) content.push({ type: 'text', text: line });
        if (idx < parts.length - 1) content.push({ type: 'hardBreak' });
      });
      return { type: 'paragraph', content: content.length ? content : [{ type: 'text', text: '' }] };
    });

  return {
    type: 'doc',
    version: 1,
    content: paragraphs.length ? paragraphs : [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
  };
}

/*********************************************************/
/*  HELPERS PARA LA ESCUCHA DEL NAVEGADOR Y LOS MENSAJES */
/*********************************************************/

//Puerto persistente con el background
const port = chrome.runtime.connect({ name: 'sidepanel-port' });

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'URL_CHANGED') {
    refreshFromActiveTab();
  }
});

// --- Utilidades seguras ---
function safePortPostMessage(port, msg) {
  if (!port) return;
  try { port.postMessage(msg); } catch (_) { }
}

function getActiveTabInfo() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_TAB_INFO' }, (res) => {
        // Absorbe "Receiving end does not exist" si no hay receptor
        void chrome.runtime.lastError;
        resolve(res || {});
      });
    } catch (_) {
      resolve({});
    }
  });
}

// 2) Al cargar, handshake y autocierre defensivo si no es Jira
(async () => {
  const info = await getActiveTabInfo();
  const windowId =
    info.windowId ?? (await new Promise((r) => chrome.windows.getCurrent(w => r(w.id))));
  safePortPostMessage(port, { type: 'HELLO_FROM_PANEL', windowId });

  if (!isJiraUrl(info.url || '')) {
    safeClose();
  }
})();

// 3) Escucha mensajes tanto por puerto como por broadcast
port.onMessage.addListener((msg) => {
  if (msg?.type === 'CLOSE_SIDE_PANEL') {
    safeClose();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'CLOSE_SIDE_PANEL') {
    safeClose();
  }
});

// 4) Cierre seguro con pequeños reintentos
let closing = false;
function safeClose() {
  if (closing) return;
  closing = true;
  try { window.close(); } catch { }
  setTimeout(() => { try { window.close(); } catch { } }, 120);
  setTimeout(() => { try { window.close(); } catch { } }, 400);
}

// 5) Helper local para validar URL (igual que en background)
function isJiraUrl(url) {
  try {
    const u = new URL(url);
    const hostOk = /(?:^|\.)atlassian\.net$/.test(u.hostname) || /(?:^|\.)jira\.com$/.test(u.hostname);
    const pathOk = /(\/browse\/|\/jira\/software\/c\/projects\/|\/projects\/)/i.test(u.pathname);
    return hostOk && pathOk;
  } catch {
    return false;
  }
}

// 6) Si el panel vuelve a ser visible en una pestaña no-Jira, ciérrate
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    const info = await getActiveTabInfo();
    if (!isJiraUrl(info.url || '')) {
      safeClose();
    }
  }
});

// 7) Antes de descargar, avisa al background para limpiar el puerto
window.addEventListener('unload', async () => {
  try {
    const info = await getActiveTabInfo();
    const windowId = info.windowId ?? null;
    safePortPostMessage(port, { type: 'BYE_FROM_PANEL', windowId });
  } catch (_) { }
});


//helper para la validación de mail

export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const e = email.trim();
  if (!e) return false;

  const basic = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*$/;
  if (!basic.test(e)) return false;

  const [, domain] = e.split("@");
  const parts = domain.split(".");
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1];
  if (tld.length < 2 || tld.length > 63) return false;

  if (e.includes("..")) return false;
  if (parts.some(p => p.length === 0 || p.startsWith("-") || p.endsWith("-"))) return false;

  return true;
}

async function descargarFeature() {

  const issue = els.issue.value;
  await downloadFeatureFromTextarea(issue);
}

// Descarga el contenido del textarea como un archivo .feature
function downloadFeatureFromTextarea(filename) {
  const ta = document.getElementById('desc-improved');
  if (!ta) throw new Error(`No se encontró textarea con id "${textareaId}"`);

  // 1) Contenido normalizado (saltos de línea y fin de archivo)
  let text = String(ta.value || "").replace(/\r\n?/g, "\n");
  if (!text.endsWith("\n")) text += "\n";

  // 2) Determinar nombre
  let name = filename;
  if (!name) {
    // Intenta extraer el título después de "Feature:" (soporta español común)
    const m = text.match(/^\s*(?:#.*\n\s*)*(?:Feature|Característica|Caracteristica|Funcionalidad)\s*:\s*(.+)$/mi);
    const title = m ? m[1].trim() : "";
    const slug = (title || "feature")
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "") // quita acentos
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    name = (slug || "feature") + ".feature";
  } else if (!name.toLowerCase().endsWith(".feature")) {
    name += ".feature";
  }

  // 3) Descargar
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function dudaslinkeds() {
  Swal.fire({
    title: 'Important',
    html: 'To link the issues as <strong>Test (tests, is tested by)</strong> (to the main task) You must have this type of link available in your project,' +
      ' Plugins like XRAY create this link by default. <br>If this type of link fails, we will automatically link' +
      ' the tests created as <strong>Relates</strong>.',
    icon: 'info',
    confirmButtonText: 'OK',
    width: "80%"
  });
}

async function dudasIssues() {
  Swal.fire({
    title: 'Important',
    html: 'By default we will try to create the issues for the test scenarios as issues of type <strong>Test</strong>. <br> ' +
      '<strong>If your project does not have this type of issue, please specify another one</strong>. In case of error, we will create the scenarios as a Task (issue Task).',
    icon: 'info',
    confirmButtonText: 'OK',
    width: "80%"
  });
}

async function cofeeMenssage() {
  Swal.fire({
    title: 'Invitale un café al dev.',
    html: '¿TestHunt te es útil? invitale un café al dev para aliviar el insomnio.',
    imageUrl: '/img/cafe.png',
    imageWidth: 128,
    imageHeight: 128,
    imageAlt: 'Matrix icon',
    confirmButtonText: 'OK',
    width: "80%"
  });

}

async function validateRegister() {
  const result = await Swal.fire({
    title: 'Welcome',
    html: `
      <div class="container-fluid">
        <div class="row">
          <div class="col-10 offset-1">
            <p>To continue, we need some data. <br>
            This is just to get to know our users — no spam, we promise. 💙</p>
          </div>
        </div>
        <div class="row">
          <div class="col-10 offset-1">
            <input id="swal-nombre" class="form-control mt-2" placeholder="Nombre">
          </div>
          <div class="col-10 offset-1">
            <input id="swal-email" type="email" class="form-control mt-2" placeholder="Email">
          </div>
          <div class="col-10 offset-1">
            <input id="swal-empresa" class="form-control mt-2" placeholder="Empresa">
          </div>
        </div>
      </div>  
      `,
    width: '80%',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Register',
    cancelButtonText: 'Cancel',
    backdrop: `
    rgba(0,0,0,0.4) 
    left top 
    no-repeat
  `,
    preConfirm: () => {
      const nombre = document.getElementById('swal-nombre').value.trim();
      const email = document.getElementById('swal-email').value.trim();
      const empresa = document.getElementById('swal-empresa').value.trim();

      if (!nombre || !email || !empresa) {
        Swal.showValidationMessage('All fields are required.');
        return false;
      }

      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regex.test(email)) {
        Swal.showValidationMessage('You must enter a valid email address.');
        return false;
      }


      return { nombre, email, empresa };
    }
  });

  if (result.isConfirmed && result.value) {
    const { nombre, email, empresa } = result.value;
    const respAPI = await Api_conection(nombre, email, empresa);

    if (respAPI) {
      const result = await Swal.fire({
        title: 'All good',
        html: 'Complete registration. <br>To finish you must close and reopen HakaBoots (we will try to do it automatically). Si no ocurre, por favor cierralo.',
        icon: 'success',
        confirmButtonText: 'Excellent!',
        width: '70%'
      });
      if (result.isConfirmed) {
        await chrome.storage.sync.set({ isregister: 'true' });
        await chrome.storage.sync.set({ firstTime: 'true' });
        chrome.runtime.sendMessage({ type: "GET_TAB_INFO" }, (info) => {
          chrome.runtime.sendMessage({ type: "CLOSE_PANEL", windowId: info?.windowId ?? null });
        });
      }

    } else {
      const result = await Swal.fire({
        title: 'Error in the Matrix',
        html: 'We are having trouble connecting to our headquarters., Please try again. (If you have a VPN, it might be a good time to disable it while you log in).',
        icon: 'error',
        confirmButtonText: 'OK',
        width: "80%"
      });
      if (result.isConfirmed) {
        chrome.runtime.sendMessage({ type: "GET_TAB_INFO" }, (info) => {
          chrome.runtime.sendMessage({ type: "CLOSE_PANEL", windowId: info?.windowId ?? null });
        });
      }
    }
  } else {
    chrome.runtime.sendMessage({ type: "GET_TAB_INFO" }, (info) => {
      chrome.runtime.sendMessage({ type: "CLOSE_PANEL", windowId: info?.windowId ?? null });
    });
    return false;
  }


}

async function Api_conection(name, mail, business) {
  const url = 'https://xwofremzuhcvhxfgyjdd.supabase.co/rest/v1/Users';
  const acceptTerm = _gT();
  const data = {
    Nombre: name,
    Email: mail,
    Cargo: 'No Informa',
    Empresa: business,
    Producto: 'TestHunt'
  };
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': acceptTerm,
      'Authorization': 'Bearer ' + acceptTerm
    },
    body: JSON.stringify(data)
  };

  try {
    const response = await fetch(url, options);

    if (response.status === 201) {
      return true;
    }

    return false;

  } catch (error) {
    return false;
  }
}

function _gT() {
  const _e = 'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW5oM2IyWnlaVzE2ZFdoamRtaDRabWQ1YW1Sa0lpd2ljbTlzWlNJNkluTmxjblpwWTJWZmNtOXNaU0lzSW1saGRDSTZNVGMwTkRRd01ETTROeXdpWlhod0lqb3lNRFU1T1RjMk16ZzNmUS5TTElVSi1zdUhBSGFmZ1h2T2dITXd1UHo1YU41enFaYjFCc1cwODRxbWQ4Cg==';
  return atob(_e);
}

async function xrayTestData(clientId, clientSecret) {
  try {
    const resp = await fetch(ENDPOINTS.XRAY_AUTH, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
    });

    if (!resp.ok) {
      return false; // 401, 403, 500, etc.
    }

    const raw = await resp.text();
    const token = raw.replace(/^"+|"+$/g, "").trim();
    return Boolean(token); // true si hay token válido, false si viene vacío
  } catch {
    return false; // errores de red, timeout, etc.
  }
}

async function cleanTests() {

  document.getElementById('divcreatetests').style = 'display:none';
  
}

