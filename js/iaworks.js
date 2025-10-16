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
      Swal.showLoading(); // icono de loading
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
    //els.btnImprove.disabled = false;
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

  Swal.fire({
    title: leng.MSG_IA_MEJORA_CHROME,
    text: leng.MSG_IACHROME_WAIT,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading(); // icono de loading
    }
  });

  const { promptbase } = await chrome.storage.sync.get(['promptbase']);
  // 1) comprobar disponibilidad (descarga el modelo si hace falta)
  /*const availability = await LanguageModel.availability();
  if (availability === 'unavailable') {
    Swal.fire('Error', leng.MSG_CHROMEIA_NOT, 'error');
    console.log(e);
    return;
  }*/

  try {
  const LLM_OPTS = {
    // ajusta los idiomas según tu Description (puede ser 'en','es' o 'ja')
    expectedInputs: [{ type: 'text', languages: ['es'] }],   // system + user input langs
    expectedOutputs: [{ type: 'text', languages: ['es'] }], // output lang(s) esperadas
    initialPrompts: [{ role: 'system', content: leng.MSG_FIST_INSTRUCTION }]
  };

  // 1) verificar disponibilidad PASANDO LAS MISMAS OPCIONES
  const availability = await LanguageModel.availability(LLM_OPTS);
  console.log('LanguageModel availability:', availability);
  // si devuelve 'downloadable' -> el usuario debe interactuar para permitir la descarga
  if (availability === 'unavailable') {
    Swal.fire('Error', leng.MSG_CHROMEIA_NOT, 'error');
    console.log(e);
    return;
  }

  // 2) crear sesión con las mismas opciones
  const session = await LanguageModel.create(LLM_OPTS);

  // 3) llamar a prompt PASANDO DE NUEVO LAS MISMAS OPCIONES (muy importante)
  const userMessage = `${leng.DESCRIPTION}: ${original} ${promptbase}`;
  const answer = await session.prompt(
    [{ role: 'user', content: userMessage }],
    LLM_OPTS
  );

  console.log('answer:', answer);
  // tu UI
  els.descImproved.value = answer || '(no content)';
  els.divimprove.style = 'display:block';
  document.getElementById('robot-durmiento').style = 'display:none';
  document.getElementById("divcreatetests").style = 'display:none';
  Swal.close();
  Swal.fire(leng.EXITO_SWAL, leng.MSG_IA_MEJORA_OK, 'success');
  document.getElementById('btn-reemplazar-desc').disabled = false;
  session.destroy();
} catch (e) {
  // imprime todo para depuración: nombre, mensaje y stack
  console.error('LM error', e?.name, e?.message, e?.stack);
  Swal.fire('Error', leng.MSG_IA_ERROR_MEJORA, 'error');
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
