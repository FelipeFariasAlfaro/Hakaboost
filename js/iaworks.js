import { leerDescripcionDesdeJira, els, elsCred } from '../sidepanel.js';
import { ENDPOINTS } from "./urls.js";
import { mask, isMasked } from './crearTest.js'


async function getOpenAIModel() {
  const { openai_model } = await chrome.storage.sync.get(['openai_model']);
  return {
    model: openai_model || 'gpt-4o-mini'
  };
}

async function getGeminiModel() {
  const { gemini_model } = await chrome.storage.sync.get(['gemini_model']);
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
    Swal.fire('Upss!', 'You must be on a valid JIRA issue to improve the description.', 'warning');
    return;
  }

  await waitForClickExecution(els.btnLoadDesc);

  els.improveStatus.textContent = '';
  const original = els.descOriginal.value.trim();
  if (!original) {
    els.improveStatus.textContent = 'There is no original description to improve.';
    Swal.fire('Upss!', 'Theres no description in the issue to improve. (Make sure youre not editing the description.)', 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }

  const { gemini_token = '' } = await chrome.storage.sync.get('gemini_token');
  if (!gemini_token) {
    Swal.fire('Upss!', 'You must enter the Google (Gemini) token in the configuration panel', 'warning');
    els.improveStatus.textContent = 'Falta token de Google. Guárdalo primero.';
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }

  Swal.fire({
    title: 'Improving description with AI (Gemini).',
    text: 'Please wait, depending on the AI ​​model used, this may take a while..',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  els.improveStatus.textContent = 'Improving description...';
  els.btnImprove.disabled = true;

  // modelo y prompt base
  const { google_model } = await getGeminiModel(); // ver helper más abajo
  const { promptbase } = await chrome.storage.sync.get(['promptbase']);

  try {
    // Endpoint Gemini: generateContent
    const modelo = google_model || 'gemini-1.5-flash';
    const apiBase = ENDPOINTS.GEMINI + `${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(gemini_token)}`;
    console.log("url gemini:", apiBase);
    const { promptbase } = await chrome.storage.sync.get(['promptbase']);
    const hardLangHint = promptbase;

    // Convertimos tu estructura de mensajes a la que espera Gemini
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: original + hardLangHint }]
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      document.getElementById('btn-reemplazar-desc').disabled = true;
      document.getElementById('desc-improved').value = "";
      const errText = await safeText(resp);
      // 🔎 Diferenciar según código de estado
      if (resp.status === 503) {
        Swal.fire('Gemini', 'The model used in Gemini is overloaded. Please try again later.', 'error');
        return;
      } else if (resp.status === 429) {
        Swal.fire('Gemini', 'You have exceeded the request limit (rate limit). Please wait a moment and try again.', 'error');
        return;
      } else {
        Swal.fire('Gemini', 'Theres a problem using Gemini. Please try again later.: ' + errText, 'error');
        return;
      }
    }

    const data = await resp.json();
    // Gemini responde en candidates[0].content.parts[].text
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const improved = parts.map(p => p.text || '').join('').trim();

    els.descImproved.value = improved || '(no content)';
    els.improveStatus.textContent = improved ? 'Improved description ready.' : 'Improved text did not arrive.';
    els.divimprove.style = 'display:block';
    document.getElementById('robot-durmiento').style = 'display:none';
    Swal.close();
    Swal.fire('Ready', 'The description has been improved. If you want to bring it to Jira, use the "Update Jira" button.', 'success');
    document.getElementById('btn-reemplazar-desc').disabled = false;
  }
  catch (e) {
    Swal.close();
    Swal.fire('Error', 'Error improving description', 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    els.improveStatus.textContent = `Failed to improve: ${String(e.message || e)}`;
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
    Swal.fire('Upss!', 'You must be on a valid JIRA issue to improve the description.', 'warning');
    return;
  }

  await waitForClickExecution(els.btnLoadDesc);

  els.improveStatus.textContent = '';
  const original = els.descOriginal.value.trim();
  if (!original) {
    els.improveStatus.textContent = 'There is no original description to improve.';
    Swal.fire('Upss!', 'Theres no description in the issue to improve. (Make sure youre not editing the description.)', 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }


  const { openai_token = '' } = await chrome.storage.sync.get('openai_token');
  if (!openai_token) {
    Swal.fire('Upss!', 'You must enter the OpenAI token in the configuration panel', 'warning');
    els.improveStatus.textContent = 'OpenAI token missing. Save it first..';
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }

  Swal.fire({
    title: 'Improving description with AI.',
    text: 'Please wait, depending on the AI ​​model used, this may take a while..',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading(); // icono de loading
    }
  });


  els.improveStatus.textContent = 'Improving description...';
  els.btnImprove.disabled = true;
  const { model } = await getOpenAIModel();
  const { promptbase } = await chrome.storage.sync.get(['promptbase']);

  try {
    // Puedes cambiar model/base si lo prefieres

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
          { role: 'user', content: `Improve this Jira description:\n\n${original}` }
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
    els.descImproved.value = improved || '(no content)';
    els.improveStatus.textContent = improved ? 'Improved description list.' : 'Improved text did not arrive.';
    els.divimprove.style = 'display:block';
    document.getElementById('robot-durmiento').style = 'display:none';
    //els.btnImprove.disabled = false;
    Swal.close();
    Swal.fire('Ready', 'The description has been improved. If you want to bring it to Jira, use the "Update Jira" button.', 'success');
    document.getElementById('btn-reemplazar-desc').disabled = false;
  }
  catch (e) {
    Swal.close();
    Swal.fire('Error', 'Error improving description', 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    els.improveStatus.textContent = `Failed to improve: ${String(e.message || e)}`;
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
    Swal.fire('Upss!', 'You must be on a valid JIRA issue to improve the description.', 'warning');
    return;
  }

  await waitForClickExecution(els.btnLoadDesc);

  els.improveStatus.textContent = '';
  const original = els.descOriginal.value.trim();
  if (!original) {
    els.improveStatus.textContent = 'There is no original description to improve.';
    Swal.fire('Upss!', 'There is no description in the issue to improve. (Make sure you are not editing the description.)', 'error');
    document.getElementById('btn-reemplazar-desc').disabled = true;
    document.getElementById('desc-improved').value = "";
    document.getElementById('div-desc-mejorada').style = "display:none";
    return;
  }

  Swal.fire({
    title: 'Improving description with AI.',
    text: 'Please wait, this AI may take a couple of minutes, do not close this view.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading(); // icono de loading
    }
  });

  const { promptbase } = await chrome.storage.sync.get(['promptbase']);
  // 1) comprobar disponibilidad (descarga el modelo si hace falta)
  const availability = await LanguageModel.availability();
  if (availability === 'unavailable') {
    Swal.fire('Error', 'No available model found. Check the console for more details.', 'error');
    console.log(e);
    return;
  }

  try {
    const LLM_OPTS = {
      expectedOutputLanguage: 'en',
      expectedOutputLanguages: ['en'],
      outputLanguageCode: 'en',
      // entrada (opcional pero recomendable)
      expectedInputLanguages: ['en'],
    };
    const session = await LanguageModel.create({
      ...LLM_OPTS,
      initialPrompts: [
        { role: 'system', content: 'You are an expert in software quality and testing.' }
      ]
    });

    // 3) lanzar un prompt
    const answer = await session.prompt(
      `Description: ${original} ${promptbase}`,
      { ...LLM_OPTS }
    );
    els.descImproved.value = answer || '(no content)';
    els.divimprove.style = 'display:block';
    document.getElementById('robot-durmiento').style = 'display:none';
    Swal.close();
    Swal.fire('Ready', 'The description has been improved. If you want to bring it to Jira, use the "Update Jira" button.', 'success');
    document.getElementById('btn-reemplazar-desc').disabled = false;
    session.destroy();
  } catch (e) {
    Swal.fire('Error', 'Error improving description, check console for more details.', 'error');
    console.log(e);
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
        els.improveStatus.textContent = 'Token eliminado.';
        await chrome.storage.sync.set({
          gemini_model: model
        });
        Swal.fire({
          icon: 'success',
          title: `All good`,
          text: `You have successfully deleted the token.`,
          confirmButtonText: 'OK'
        });
        await chrome.storage.sync.set({
          ia_default: 'gemini'
        });
        return;
      }

      // Si el usuario pegó el token "enmascarado", no lo pisamos
      // pero si guardamos el modelo seleccionado
      if (isMasked(val)) {
        els.improveStatus.textContent = 'Token already saved.';
        await chrome.storage.sync.set({
          gemini_model: model
        });

        Swal.fire({
          icon: 'success',
          title: `All good`,
          text: `The selected model has been successfully stored.`,
          confirmButtonText: 'OK'
        });
        await chrome.storage.sync.set({
          ia_default: 'gemini'
        });
        return;
      }
      //si no se cumplen las condiciones anteriores, guardamos el token
      // y actualizamos el modelo seleccionado
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
        title: `All good`,
        text: `AI data has been successfully stored.`,
        confirmButtonText: 'OK'
      });

    } catch (e) {
      console.log("error: ", e);
    }

    //testOpenAIConfig();
  } else if (seleccion == "OpenAI") {
    const val = els.tokenInput.value.trim();
    const model = els.modelSelect?.value || 'gpt-4o-mini';

    //Si se limpia el campo y el usuario presiona guardar
    //se elimina el token del localstorage
    //se guarda la preferencia del modelo
    if (!val) {
      await chrome.storage.sync.remove('openai_token');
      els.improveStatus.textContent = 'Deleted token.';
      await chrome.storage.sync.set({
        openai_model: model
      });
      Swal.fire({
        icon: 'success',
        title: `All good`,
        text: `You have successfully deleted the token`,
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
      els.improveStatus.textContent = 'Token already saved.';
      //para setear un posible cambio de modelo, manteniendo el token
      await chrome.storage.sync.set({
        openai_model: model
      });

      Swal.fire({
        icon: 'success',
        title: `Todo bien`,
        text: `The selected model has been successfully stored.`,
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
      title: `All good`,
      text: `AI data has been successfully stored.`,
      confirmButtonText: 'OK'
    });
    testOpenAIConfig();
  } else if (seleccion == "ChromeIA") {
    Swal.fire({
      icon: 'success',
      title: `All good`,
      text: `The selected AI has been successfully stored.`,
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
      title: `Houston we have a problem`,
      text: `The token doesn't look correct or the model isn't enabled in your OpenAI account.`,
      confirmButtonText: 'I will review'
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
      title: `All good`,
      text: `The data has been saved, your account looks correct.`,
      confirmButtonText: 'OK'
    });
  } else {
    Swal.fire({
      icon: 'error',
      title: `Houston we have a problem`,
      text: `The token doesn't look correct or the model isn't enabled in your OpenAI account.`,
      confirmButtonText: 'I will review'
    });
    document.getElementById('openai-token').value = '';
    await chrome.storage.sync.set({
      openai_token: ''
    });
  }
}
