import { leerDescripcionDesdeJira, els, elsCred } from '../sidepanel.js';
import { ENDPOINTS } from "./urls.js";
import { mask, isMasked } from './crearTest.js'
import { leng, setting_leng } from "./lang.js";

setting_leng();

async function getOpenAIModel() {
  const { openai_model } = await chrome.storage.sync.get(['openai_model']);
  return {
    model: openai_model || 'gpt-4o-mini'
  };
}

async function getGeminiModel() {
  const { gemini_model } = await chrome.storage.sync.get('gemini_model');
  return {
    model: gemini_model || 'gemini-2.5-flash'
  };
}

export async function waitForClickExecution(button) {
  return new Promise((resolve) => {
    const original = leerDescripcionDesdeJira;
    button.addEventListener('click', async function handler(e) {
      await original(e);
      resolve();
    });
    button.click();
  });
}

// == Gemini ==
export async function improveDescriptionGemini(els) {

  let issueT = els.issue.value;
  let summaryT = els.summary.value;
  let statusT = els.status.value;

  if (issueT.length < 2 || summaryT.length < 2 || statusT.length < 2) {
    Swal.fire('Upss!', leng.MSG_JIRA_ISSUE_INVALIDA, 'warning');
    return;
  }

  await waitForClickExecution(els.btnLoadDesc);

  els.improveStatus.textContent = '';
  const original = els.descOriginal.value.trim();
  if (!original) {
    Swal.fire('Upss!', leng.MSG_JIRA_ERROR_NO_DESCRIPCION, 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }

  const { gemini_token = '' } = await chrome.storage.sync.get('gemini_token');
  if (!gemini_token) {
    Swal.fire('Upss!', leng.MSG_IA_ERROR1, 'warning');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }

  Swal.fire({
    title: leng.MSG_IA_MEJORA,
    text: leng.MSG_IA_ESPERA,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  els.btnImprove.disabled = true;

  // modelo y prompt base
  const { model } = await getGeminiModel();
  try {
    // Endpoint Gemini: generateContent
    const modelo = model || 'gemini-1.5-flash';
    const apiBase = ENDPOINTS.GEMINI + `${encodeURIComponent(modelo)}:generateContent`;
    //const apiBase = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

    const { promptbase } = await chrome.storage.sync.get('promptbase');
    const hardLangHint = promptbase;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: original + hardLangHint }]   // solo el texto de la descripción
        }
      ],
      systemInstruction: promptbase
        ? { role: "system", parts: [{ text: promptbase }] }
        : undefined,
      generationConfig: {
        temperature: 1
      }
    };

    const resp = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': gemini_token,
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      document.getElementById('btn-reemplazar-desc').disabled = true;
      document.getElementById('desc-improved').value = "";
      const errText = await safeText(resp);
      // 🔎 Diferenciar según código de estado
      if (resp.status === 503) {
        Swal.fire('Gemini', leng.MSG_IA_GEMINI_ERROR1, 'error');
        return;
      } else if (resp.status === 429) {
        Swal.fire('Gemini', leng.MSG_IA_GEMINI_ERROR2, 'error');
        return;
      } else {
        Swal.fire('Gemini', leng.MSG_IA_GEMINI_ERROR3 + errText, 'error');
        return;
      }
    }

    const data = await resp.json();
    // Gemini responde en candidates[0].content.parts[].text
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const improved = parts.map(p => p.text || '').join('').trim();
    els.descImproved.value = improved || '(?)';
    els.divimprove.style = 'display:block';
    document.getElementById('robot-durmiento').style = 'display:none';
    document.getElementById("divcreatetests").style = 'display:none';
    Swal.close();
    Swal.fire(leng.EXITO_SWAL, leng.MSG_IA_MEJORA_OK, 'success');
    document.getElementById('btn-reemplazar-desc').disabled = false;
  }
  catch (e) {
    Swal.close();
    Swal.fire('Error', leng.MSG_IA_ERROR_MEJORA, 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
  }
  finally {
    els.btnImprove.disabled = false;
  }
}



// == ChatGPT ==
export async function improveDescriptionOpenAI(els) {

  let issueT = els.issue.value;
  let summaryT = els.summary.value;
  let statusT = els.status.value;

  if (issueT.length < 2 || summaryT.length < 2 || statusT.length < 2) {
    Swal.fire('Upss!', leng.MSG_JIRA_ISSUE_INVALIDA, 'warning');
    return;
  }

  await waitForClickExecution(els.btnLoadDesc);

  els.improveStatus.textContent = '';
  const original = els.descOriginal.value.trim();
  if (!original) {
    Swal.fire('Upss!', leng.MSG_JIRA_ERROR_NO_DESCRIPCION, 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }


  const { openai_token = '' } = await chrome.storage.sync.get('openai_token');
  if (!openai_token) {
    Swal.fire('Upss!', leng.MSG_IA_OPENAI_ERROR1, 'warning');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }

  Swal.fire({
    title: leng.MSG_IA_MEJORA_OPENAI,
    text: leng.MSG_IA_ESPERA,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  els.btnImprove.disabled = true;
  const { model } = await getOpenAIModel();
  const { promptbase } = await chrome.storage.sync.get(['promptbase']);

  try {
    const apiBase = ENDPOINTS.OPENAI_CHAT;
    const modelo = model;
    const resp = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openai_token}`
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          {
            role: 'system',
            content: promptbase
          },
          { role: 'user', content: `${leng.MSG_IA_PREPROMT}\n\n${original}` }
        ],
        temperature: 1
      })
    });

    if (!resp.ok) {
      document.getElementById('btn-reemplazar-desc').disabled = true;
      document.getElementById('desc-improved').value = "";
      const errText = await safeText(resp);
      throw new Error(`HTTP ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const improved = data?.choices?.[0]?.message?.content?.trim() || '';
    els.descImproved.value = improved || '(?)';
    els.divimprove.style = 'display:block';
    document.getElementById('robot-durmiento').style = 'display:none';
    document.getElementById("divcreatetests").style = 'display:none';
    Swal.close();
    Swal.fire(leng.EXITO_SWAL, leng.MSG_IA_MEJORA_OK, 'success');
    document.getElementById('btn-reemplazar-desc').disabled = false;
  }
  catch (e) {
    Swal.close();
    Swal.fire('Error', leng.MSG_IA_ERROR_MEJORA, 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = 'display:none';
  }
  finally {
    els.btnImprove.disabled = false;
  }
}

export async function improveDescriptionChrome(els) {
  // validaciones iniciales
  let issueT = els.issue.value;
  let summaryT = els.summary.value;
  let statusT = els.status.value;

  if (issueT.length < 2 || summaryT.length < 2 || statusT.length < 2) {
    Swal.fire('Upss!', leng.MSG_JIRA_ISSUE_INVALIDA, 'warning');
    return;
  }

  await waitForClickExecution(els.btnLoadDesc);

  els.improveStatus.textContent = '';
  const original = els.descOriginal.value.trim();
  if (!original) {
    Swal.fire('Upss!', leng.MSG_JIRA_ERROR_NO_DESCRIPCION, 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }

  // Obtener config/strings
  const { promptbase } = await chrome.storage.sync.get(['promptbase']);
  const { lenguaje } = await chrome.storage.sync.get(['lenguaje']);

  const LLM_OPTS = {
    expectedInputs: [{ type: 'text', languages: [lenguaje] }],
    expectedOutputs: [{ type: 'text', languages: [lenguaje] }],
    initialPrompts: [{ role: 'system', content: leng.MSG_FIST_INSTRUCTION }]
  };

  // helpers UI
  let modalShown = false;
  let modalType = null; // 'spinner' | 'download'
  function showSpinnerModal() {
    modalShown = true; modalType = 'spinner';
    Swal.fire({
      title: leng.MSG_IA_MEJORA_CHROME,
      text: leng.MSG_IACHROME_WAIT,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => { Swal.showLoading(); }
    });
  }
  function showDownloadModal(initialText = leng.DOWNLOAD) {
    modalShown = true; modalType = 'download';
    Swal.fire({
      title: leng.PREPARE_IA,
      html: `
        <div style="text-align:left">
          <div id="ia-progress-text">${initialText}</div>
          <div style="margin-top:8px">
            <div style="background:#eee;border-radius:6px;overflow:hidden">
              <div id="ia-progress-bar" style="width:0%;height:12px;transition:width 300ms ease"></div>
            </div>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#666">
            ${leng.MSG_INTERNO_DOWNLOAD}
          </div>
        </div>
      `,
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false
    });
  }
  function updateDownloadProgress(pct, text) {
    const container = Swal.getHtmlContainer();
    if (!container) return;
    const bar = container.querySelector('#ia-progress-bar');
    const txt = container.querySelector('#ia-progress-text');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (txt && text) txt.textContent = text;
  }
  function closeModal() {
    try { Swal.close(); } catch (err) { /* ignore */ }
    modalShown = false; modalType = null;
  }

  let session = null;

  try {
    // 1) consultamos disponibilidad y DECIDIMOS modal en base a eso
    const availability = await LanguageModel.availability(LLM_OPTS);
    console.log('LanguageModel availability:', availability);


    const alreadyAvailable = (availability === 'available');

    // mostrar *solo* el modal que corresponda
    if (alreadyAvailable) {
      showSpinnerModal();
    } else {
      showDownloadModal(leng.AVISO_DESCARGA);
    }

    // 2) crear session pasando monitor (si viene downloadprogress lo usaremos para actualizar la barra)
    session = await LanguageModel.create({
      ...LLM_OPTS,
      monitor: (m) => {
        try {
          const attach = (handler) => {
            if (typeof m.addEventListener === 'function') m.addEventListener('downloadprogress', handler);
            else if (typeof m.on === 'function') m.on('downloadprogress', handler);
          };
          attach((e) => {
            // parse defensivo del evento
            let pct = null;
            try {
              if (typeof e.loaded === 'number' && typeof e.total === 'number' && e.total > 0) {
                pct = Math.round((e.loaded / e.total) * 100);
              } else if (typeof e.loaded === 'number' && e.loaded <= 1) {
                pct = Math.round(e.loaded * 100);
              } else if (typeof e.loaded === 'number') {
                pct = Math.round(e.loaded);
              } else if (e?.detail && typeof e.detail.progress === 'number') {
                pct = Math.round(e.detail.progress * 100);
              }
            } catch (err) {
              console.warn('parse progress err', err);
            }

            // Si estamos en el flujo "download", actualizamos la barra. Si no, logueamos.
            if (modalType === 'download') {
              if (pct !== null) updateDownloadProgress(pct, `${leng.AVANCE} ${pct}%`);
              else updateDownloadProgress(0, leng.DOWNLOAD_WAIT);
            } else {
              console.log('downloadprogress recibido pero modal no es de descarga', e);
            }
          });
        } catch (monitorErr) {
          console.warn('Monitor setup err', monitorErr);
        }
      }
    });

    // 3) create() completó -> prompt
    const userMessage = `${leng.DESCRIPTION}: ${original} ${promptbase}`;
    const answer = await session.prompt([{ role: 'user', content: userMessage }], LLM_OPTS);

    // 4) cerramos modal (spinner o download) y seguimos con UX normal
    closeModal();

    els.descImproved.value = answer || '(no content)';
    els.divimprove.style = 'display:block';
    document.getElementById('robot-durmiento').style = 'display:none';
    document.getElementById("divcreatetests").style = 'display:none';
    Swal.fire(leng.EXITO_SWAL, leng.MSG_IA_MEJORA_OK, 'success');

    await chrome.storage.sync.set({ uselocal: true });
    document.getElementById('btn-reemplazar-desc').disabled = false;

  } catch (e) {
    console.error('LM error', e?.name, e?.message, e?.stack);
    // DETECCIÓN ESPECIAL: dispositivo no elegible -> avisar al usuario y ofrecer fallback
    const msg = (e && e.message) ? e.message : '';
    const ineligible = /not.*eligible|not.*elegible|device.*not.*eligible|not.*eligible.*for.*on-?device/i.test(msg);

    // cerramos cualquier modal previo
    closeModal();

    if (ineligible) {
      // mensaje específico y opción de fallback a modelo remoto
      Swal.fire({
        title: leng.NOCOMPATIBLE,
        html: `
          ${leng.MSG_NOCOMPATIBLE}
        `,
        icon: 'error',
        confirmButtonText: leng.BTN_ENTIENDO,
      });
    } else {
      // manejo genérico de errores
      Swal.fire('Error', leng.MSG_IA_ERROR_MEJORA, 'error');
    }
  } finally {
    try { if (session && typeof session.destroy === 'function') session.destroy(); }
    catch (err) { console.warn('Error destroying session', err); }
  }
}






export async function savedataIA() {

  var seleccion = elsCred.iaselect.value;
  if (seleccion == "Google Gemini") {
    try {
      const val = elsCred.geminiToken.value.trim();
      const model = elsCred.geminiModel?.value || 'gemini-2.0-flash';

      if (!val) {
        await chrome.storage.sync.remove('gemini_token');
        await chrome.storage.sync.set({
          gemini_model: model
        });
        Swal.fire({
          icon: 'success',
          title: leng.EXITO_SWAL,
          text: leng.MSG_IA_ELIMINA_TOKEN,
          confirmButtonText: 'OK'
        });
        await chrome.storage.sync.set({
          ia_default: 'gemini'
        });
        return;
      }

      if (isMasked(val)) {
        await chrome.storage.sync.set({
          gemini_model: model
        });

        Swal.fire({
          icon: 'success',
          title: leng.EXITO_SWAL,
          text: leng.MSG_IA_MODEL_OK,
          confirmButtonText: 'OK'
        });
        await chrome.storage.sync.set({
          ia_default: 'gemini'
        });
        return;
      }
      await chrome.storage.sync.set({
        gemini_token: val,
        gemini_model: model
      });
      elsCred.geminiToken.value = mask(val);
      await chrome.storage.sync.set({
        ia_default: 'gemini'
      });
      Swal.fire({
        icon: 'success',
        title: leng.EXITO_SWAL,
        text: leng.MSG_IA_DATA_OK,
        confirmButtonText: 'OK'
      });

    } catch (e) {
      console.log("Error guardando el token: ", e);
    }
  } else if (seleccion == "OpenAI") {
    const val = els.tokenInput.value.trim();
    const model = els.modelSelect?.value || 'gpt-4o-mini';

    //Si se limpia el campo y el usuario presiona guardar
    //se elimina el token del localstorage
    //se guarda la preferencia del modelo
    if (!val) {
      await chrome.storage.sync.remove('openai_token');
      await chrome.storage.sync.set({
        openai_model: model
      });
      Swal.fire({
        icon: 'success',
        title: leng.EXITO_SWAL,
        text: leng.MSG_IA_ELIMINA_TOKEN,
        confirmButtonText: 'OK'
      });
      await chrome.storage.sync.set({
        ia_default: 'openai'
      });
      return;
    }

    // Si el usuario pegó el token "enmascarado", no lo pisamos
    // pero si guardamos el modelo seleccionado
    if (isMasked(val)) {
      //para setear un posible cambio de modelo, manteniendo el token
      await chrome.storage.sync.set({
        openai_model: model
      });

      Swal.fire({
        icon: 'success',
        title: leng.EXITO_SWAL,
        text: leng.MSG_IA_MODEL_OK,
        confirmButtonText: 'OK'
      });
      await chrome.storage.sync.set({
        ia_default: 'openai'
      });
      return;
    }

    //si no se cumplen las condiciones anteriores, guardamos el token
    // y actualizamos el modelo seleccionado
    await chrome.storage.sync.set({
      openai_token: val,
      openai_model: model
    });
    els.tokenInput.value = mask(val);
    await chrome.storage.sync.set({
      ia_default: 'openai'
    });
    Swal.fire({
      icon: 'success',
      title: leng.EXITO_SWAL,
      text: leng.MSG_IA_DATA_OK,
      confirmButtonText: 'OK'
    });
    testOpenAIConfig();
  } else if (seleccion == "ChromeIA") {
    Swal.fire({
      icon: 'success',
      title: leng.EXITO_SWAL,
      text: leng.MSG_IA_MODEL_OK,
      confirmButtonText: 'OK'
    });
    await chrome.storage.sync.set({
      ia_default: 'chrome'
    });


  }
}

export async function testOpenAIConfig() {
  const { openai_token, openai_model } = await chrome.storage.sync.get(['openai_token', 'openai_model']);

  const resp = await fetch(ENDPOINTS.OPENAI_MODELS, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${openai_token}`
    }
  });

  if (!resp.ok) {
    Swal.fire({
      icon: 'error',
      title: leng.MSG_ERROR_SWAL,
      text: leng.MSG_IA_OPENAI_ERROR_TOKEN,
      confirmButtonText: leng.BTN_ENTIENDO
    });
    document.getElementById('openai-token').value = '';
    await chrome.storage.sync.set({
      openai_token: ''
    });
    return;
  }

  const data = await resp.json();
  const exists = data.data.some(m => m.id === openai_model);

  if (exists) {
    Swal.fire({
      icon: 'success',
      title: leng.EXITO_SWAL,
      text: leng.MSG_IA_GUARDADO_OK,
      confirmButtonText: 'OK'
    });
  } else {
    Swal.fire({
      icon: 'error',
      title: leng.MSG_ERROR_SWAL,
      text: leng.MSG_IA_OPENAI_ERROR_TOKEN,
      confirmButtonText: leng.BTN_ENTIENDO
    });
    document.getElementById('openai-token').value = '';
    await chrome.storage.sync.set({
      openai_token: ''
    });
  }
}
