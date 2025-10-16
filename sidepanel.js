import {
  improveDescriptionGemini, improveDescriptionOpenAI, improveDescriptionChrome,
  waitForClickExecution, savedataIA, testOpenAIConfig
} from './js/iaworks.js';
import { testJiraConect, chachDefaultIssue } from './js/jiraworks.js'
import { ENDPOINTS } from './js/urls.js'
import { mask, isMasked, jiraRequest, crearTest } from './js/crearTest.js'
import { leng, setting_leng } from "./js/lang.js";



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

const html = {
  title_main: document.getElementById('title_main'),
  copilot: document.getElementById('copilot'),
  configuraciones: document.getElementById('configuraciones'),
  label_estado: document.getElementById('label_estado'),
  label_titulo: document.getElementById('label_titulo'),
  btnloaddesc: document.getElementById('btn-load-desc'),
  btnimprove: document.getElementById('btn-improve'),
  btncrearescenarios: document.getElementById('btn-crear-escenarios'),
  label_descripcion_original: document.getElementById('label_descrip_original'),
  label_descripcion_mejorada: document.getElementById('label_descrip_mejorada'),
  btnreemplazardesc: document.getElementById('btn-reemplazar-desc'),
  labelavisotest: document.getElementById('label_aviso_test'),
  labelavisolinks: document.getElementById('label_aviso_links'),
  labelmainissue: document.getElementById('label_mainissue'),
  crearTestEnJira: document.getElementById('crearTestEnJira'),
  labelavisodatos: document.getElementById('label_aviso_datos'),
  btnajustesia: document.getElementById('btn_ajustes_ia'),
  iaseleccion: document.getElementById('iaseleccion'),
  sel_modelo_ia: document.getElementById('sel_modelo_ia'),
  sel_mode_gemini: document.getElementById('sel_mode_gemini'),
  jira_setting_menu: document.getElementById('jira_setting_menu'),

  label_uso_jira: document.getElementById('label_uso_jira'),
  label_issuetype: document.getElementById('label_issuetype'),
  label_typelink: document.getElementById('label_typelink'),
  label_xray_ajustes: document.getElementById('label_xray_ajustes'),
  label_desc_xray: document.getElementById('label_desc_xray'),
  haka_link: document.getElementById('haka_link')

}

var orden1 = "";


/****************  Carga todo lo básico para el complemento *********************/
document.addEventListener('DOMContentLoaded', async () => {

  //seteo del lenguaje
  await setting_leng();

  orden1 = leng.PROMPT_ORG;
  

  await setHTMLLeng(html, leng);

  const { isregister } = await chrome.storage.sync.get('isregister');

   elsCred.openaidata.style = 'display:none';
   elsCred.geminidata.style = 'display:none';

  if (!isregister || isregister === 'false') { //inicia el registro

    Swal.fire({
      title: 'Selecciona tu idioma / Select your language',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Español',
      denyButtonText: 'English',
      cancelButtonText: 'Cerrar',
      allowOutsideClick: true,
      allowEscapeKey: true
    }).then(async (result) => {
      if (result.isConfirmed) {
        await chrome.storage.sync.set({ lenguaje: 'es' });
        validateRegister('es');
      } else if (result.isDenied) {
        await chrome.storage.sync.set({ lenguaje: 'en' });
        validateRegister('en');
      } else {
        return;
      }
  });

  }
  else {
    const { firstTime } = await chrome.storage.sync.get('firstTime');
    if (firstTime + '' === 'true') { //esta registrado y es el primer ingreso
      const result = await Swal.fire({
        title: leng.Bienvenido,
        html: leng.MSG_BIENVENIDA,
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
    els.cofee.addEventListener('click', cofeeMenssage);
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
        Swal.fire('Upss', leng.MSG_JIRA_ERROR1, 'error');
        return;
      }

      if (!isValidEmail(email)) {
        Swal.fire('Upss', leng.MSG_MAIL_ERROR1, 'error');
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
      Swal.fire(leng.EXITO_SWAL, leng.EXITO_DELETE_CRED, 'success');
    });

    //Botones Guardar Xray
    elsCred.saveXray.addEventListener('click', async () => {
      const cid = elsCred.xrayClientId.value.trim();
      let csec = elsCred.xrayClientSecret.value.trim();
      if (!cid || !csec) {
        Swal.fire('Upss', leng.MSG_XRAY_ERROR1, 'error');
        await chrome.storage.sync.set({ xray: 'false' });
        return;
      }
      if (isMasked(csec)) {
        csec = (await chrome.storage.sync.get('xray_client_secret')).xray_client_secret || '';
      }

      let validateXray = await xrayTestData(cid, csec);


      if (validateXray) {
        await chrome.storage.sync.set({ xray_client_id: cid, xray_client_secret: csec, xray: 'true' });
        elsCred.xrayClientSecret.value = mask(csec);
        Swal.fire(leng.EXITO_SWAL, leng.EXITO_XRAY_SAVE, 'success');
      } else {
        Swal.fire(leng.MSG_ERROR_SWAL, leng.MSG_XRAY_ERROR2, 'error');
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
    title: leng.INFORMACION,
    html: leng.MSG_AYUDA1,
    icon: 'info',
    confirmButtonText: leng.BTN_ENTIENDO,
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
      html: leng.MSG_ERROR_ONLYJIRA,
      icon: 'error',
      confirmButtonText: leng.BTN_ENTIENDO
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    Swal.fire({
      title: 'Error',
      html: leng.MSG_JIRA_ERROR2,
      icon: 'error',
      confirmButtonText: leng.BTN_ENTIENDO
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
      html: leng.MSG_JIRA_ERROR2,
      icon: 'error',
      confirmButtonText: leng.BTN_ENTIENDO
    });
  }
}

//Verifica que la pagina donde está el usuario sea la issue de jira
//donde se creó la mejora, si es correcto la inyecta mediante API Rest
async function reemplazarDescripcion() {

  Swal.fire({
    title: leng.COMPROBANDO,
    text: leng.MSG_ESPERA,
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
      title: leng.MSG_ERROR_SWAL2,
      text: leng.MSG_JIRA_ERROR3,
      icon: 'error',
      confirmButtonText: leng.BTN_ENTIENDO
    });
    els.descImproved.value = '';
    els.reemplazarDesc.disabled = true;
    els.divimprove.style = 'display:none';
    return;
  }

  const improved = (els.descImproved?.value || '').trim();
  if (!improved) {
    Swal.close();
    Swal.fire({
      title: leng.MSG_ERROR_SWAL3,
      text: leng.MSG_JIRA_ERROR4,
      icon: 'error',
      confirmButtonText: 'OK'
    });
    return;
  }

  const storyKey = (els.issue?.value || '').trim();
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(storyKey)) {
    Swal.close();
    Swal.fire({
      title: leng.MSG_ERROR_SWAL,
      text: leng.MSG_JIRA_ERROR5,
      icon: 'error',
      confirmButtonText: 'OK'
    });
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
      title: leng.MSG_JIRA_NOCRED,
      text: leng.MSG_JIRA_NOCRED2,
      icon: 'error',
      confirmButtonText: 'OK'
    });
    return;
  }

  try {
    Swal.close();
    Swal.fire({
      title: leng.EN_CURSO,
      text: leng.MSG_JIRA_ENCURSO,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const adf = toAdfTextCompl(improved);

    await jiraRequest({
      jira_base, jira_email, jira_token,
      path: `/rest/api/3/issue/${encodeURIComponent(storyKey)}`,
      method: 'PUT',
      body: { fields: { description: adf } }
    });

    Swal.fire({
      title: leng.EXITO_SWAL,
      html: leng.MSG_JIRA_EXITO,
      icon: 'success',
      confirmButtonText: 'OK'
    });

  } catch (e) {
    console.error(e);
    Swal.fire({
      title: leng.MSG_ERROR_SWAL,
      text: leng.MSG_JIRA_ERRORCRED,
      icon: 'error',
      confirmButtonText: 'OK'
    });
  }
}

async function setPrompt() {
  var { promptbase } = await chrome.storage.sync.get(['promptbase']);
  if (promptbase.trim().toLowerCase() === orden1.trim().toLowerCase()) {
    promptbase = "";
  }

  const { value: text, isConfirmed, isDenied } = await Swal.fire({
    title: leng.PROMP_TITULO,
    html: leng.PROMP_EXPLI,
    input: "textarea",
    inputValue: promptbase || "",
    width: "80%",
    showCancelButton: true,
    confirmButtonText: leng.BTN_GRD_CAMBIO,
    denyButtonText: leng.BTN_CRG_ORIGINAL,
    cancelButtonText: leng.BTN_CANCELAR,
    showDenyButton: true
  });

  if (isConfirmed && text.length > 10) {
    //Guardar nuevo prompt
    await chrome.storage.sync.set({ promptbase: text });
    Swal.fire({
      icon: "success",
      title: leng.PROMP_ACTUALIZADO,
      text: leng.PROMP_MSG_EXITO
    });
  } else if (isConfirmed && text.length <= 10) {
    Swal.fire({
      icon: "error",
      title: leng.MSG_ERROR_SWAL,
      text: leng.PROMP_MSG_ERROR
    });
  }
  else if (isDenied) {
    // Cargar prompt original (puedes cambiar el string según necesites)
    const promptOriginal = orden1;
    await chrome.storage.sync.set({ promptbase: promptOriginal });
    Swal.fire({
      icon: "info",
      title: leng.EXITO_SWAL,
      text: leng.PROMP_MSG_REST
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
  else if (ia_default === 'openai') {
    console.log("Modelo OpenAI");
    await improveDescriptionOpenAI(els);
  }else if(ia_default === 'chrome'){
    await improveDescriptionChrome(els);
  }
}

/**********************************************/
/****************** HELPERS *******************/
/**********************************************/

//Reintentos para leer los datos de la issue en jira
async function retry(fn, { tries, delay } = {}) {
  Swal.fire({
    title: leng.COMPROBANDO,
    text: leng.MSG_JIRA_LEYENDO,
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
        lastErr = new Error('Respuesta incompleta');
        Swal.close();
      } else {
        return res;
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
      title: leng.MSG_ERROR_SWAL2,
      html: leng.MSG_JIRA_ONLY,
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
      title: leng.MSG_ERROR_SWAL2,
      html: leng.MSG_JIRA_ONLY,
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
    title: leng.INFORMACION,
    html: leng.MSG_JIRA_INFO_LINK,
    icon: 'info',
    confirmButtonText: 'OK',
    width: "80%"
  });
}

async function dudasIssues() {
  Swal.fire({
    title: leng.INFORMACION,
    html: leng.MSG_JIRA_INFO_CREATE,
    icon: 'info',
    confirmButtonText: 'OK',
    width: "80%"
  });
}

async function cofeeMenssage() {
  Swal.fire({
    title: leng.COFFEE_TITULO + ' ☕',
    html: leng.COFFEE_MSG,
    imageUrl: '/img/cafe.png',
    imageWidth: 128,
    imageHeight: 128,
    imageAlt: 'Café icon',
    showCancelButton: true,
    showConfirmButton: false,                 // activa un segundo botón
    confirmButtonText: 'OK',
    cancelButtonText: leng.COFFEE_BTN,    // texto del botón extra
    width: "80%"
  }).then((result) => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      // abrir en nueva pestaña
      window.open(ENDPOINTS.COFFE, '_blank');
    }
  });

}

async function validateRegister() {

  //seteo del lenguaje
  await setting_leng();

  const result = await Swal.fire({
    title: leng.Bienvenido,
    html: `
      <div class="container-fluid">
        <div class="row">
          <div class="col-10 offset-1">
            <p>${leng.REGISTER_1} <br>
            ${leng.REGISTER_2} 💙</p>
          </div>
        </div>
        <div class="row">
          <div class="col-10 offset-1">
            <input id="swal-nombre" class="form-control mt-2" placeholder="${leng.REGISTER_3}">
          </div>
          <div class="col-10 offset-1">
            <input id="swal-email" type="email" class="form-control mt-2" placeholder="Email">
          </div>
          <div class="col-10 offset-1">
            <input id="swal-empresa" class="form-control mt-2" placeholder="${leng.REGISTER_4}">
          </div>
        </div>
      </div>  
      `,
    width: '80%',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: leng.REGISTER_5,
    cancelButtonText: leng.BTN_CANCELAR,
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
        Swal.showValidationMessage(leng.REGISTER_ERROR);
        return false;
      }

      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regex.test(email)) {
        Swal.showValidationMessage(leng.REGISTER_ERROR2);
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
        title: leng.EXITO_SWAL,
        html: leng.REGISTER_COMPLETE,
        icon: 'success',
        confirmButtonText: leng.BTN_ENTIENDO,
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
        title: leng.MSG_ERROR_SWAL2,
        html: leng.REGISTER_ERROR_3,
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
    Producto: 'HakaBoost'
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

async function setHTMLLeng(html, leng) {
  html.title_main.innerHTML = leng.HTML_MAIN_TITLE;
  html.copilot.innerHTML = leng.HTML_MAIN_COPILOTO;
  html.configuraciones.innerHTML = leng.HTML_MAIN_CONFIGURACIONES;
  html.label_estado.innerHTML = leng.HTML_LABEL_ESTADO;
  html.label_titulo.innerHTML = leng.HTML_LABEL_TITULO;
  html.btnloaddesc.innerHTML = leng.HTML_BTN_LEERDESCRIPCION;
  html.btnimprove.innerHTML = leng.HTML_BTN_MEJORARDESCRIPCION;
  html.btncrearescenarios.innerHTML = leng.HTML_BTN_CREARTEST;
  html.label_descripcion_original.innerHTML = leng.HTML_LABEL_DESCR_ORIGINAL;
  html.label_descripcion_mejorada.innerHTML = leng.HTML_LABEL_DESCR_MEJORADA;
  html.btnreemplazardesc.innerHTML = leng.HTML_LABEL_MEJORAR_JIRA;
  html.labelavisotest.innerHTML = leng.HTML_LABEL_AVISO_TESTACREAR
  html.labelavisolinks.innerHTML = leng.HTML_LAVEL_AVISO_LINK
  html.labelmainissue.innerHTML = leng.HTML_LABEL_AVISO_MAIN
  html.crearTestEnJira.innerHTML = leng.HTML_BTN_CREARJIRA;
  html.labelavisodatos.innerHTML = leng.HTML_LABEL_AVISODATOS;
  html.btnajustesia.innerHTML = leng.HTML_LABEL_AJUSTES_IA;
  html.iaseleccion.innerHTML = leng.HTML_LABEL_IASELECCION;
  html.sel_modelo_ia.innerHTML = leng.HTML_LABEL_SELECCIONMODELO;
  html.sel_mode_gemini.innerHTML = leng.HTML_LABEL_SELECCIONMODELOGEM;
  html.jira_setting_menu.innerHTML = leng.HTML_LABEL_AJUSTESIA;
  html.label_xray_ajustes.innerHTML = leng.HTML_LABEL_XRAYTITLE;
  html.label_desc_xray.innerHTML = leng.HMLT_LABEL_XRAY_DESCRIP;
  html.haka_link.innerHTML = leng.HTML_LABEL_HAKA;
}

