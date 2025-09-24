import { ENDPOINTS } from "./urls.js";

export async function crearTest(els, elsCred, elsEsc) {

    let issueT = els.issue.value;
    let summaryT = els.summary.value;
    let statusT = els.status.value;

    if (issueT.length < 2 || summaryT.length < 2 || statusT.length < 2) {
        Swal.fire('Upss!', 'You must be in a valid JIRA issue to create tests.', 'warning');
        return;
    }

    //Read the original Jira description, it is expected to have at least 1 Scenario
    await leerDescripcionDesdeJiraActualizada(els);

    let original = (els.descOriginal?.value || '').trim();

    const scenarios = parseGherkinScenarios(original);
    if (!scenarios.length) {
        //elsEsc.status.textContent = 'No encontré escenarios en Gherkin.';
        Swal.fire('Upss!', 'There are no scenarios (Scenario) in the Jira description, check if the description is in edit mode, if so, save the changes before trying this.', 'error');
        document.getElementById('divcreatetests').style = 'display:none';
        return;
    }

    //Displays the scenarios as a list
    const container = document.getElementById('seccion_testAcrear');
    setupScenarioSelectionUI(container, scenarios, elsEsc);

    //Hides the cucumberXRAY export button, in case it is enabled
    els.cucumberxray.style.display = 'none';

    //Enable the create button in Jira, and connect the listener (only once)
    const btnCrear = document.getElementById('crearTestEnJira');
    if (btnCrear) {
        btnCrear.disabled = false;

        if (!btnCrear.__listenerAttached) {
            btnCrear.__listenerAttached = true;
            btnCrear.addEventListener('click', async () => {

                Swal.fire({
                    title: 'Do you want to continue?',
                    text: 'Only the selected tests (check) linked to the main issue will be created.',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, create',
                    cancelButtonText: 'Cancel'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        const selectedScenarios = elsEsc.getSelectedScenarios();
                        if (!selectedScenarios.length) {
                            Swal.fire('Respect the laws of thermodynamics!', 'You must select at least one test to create', 'error');
                            return;
                        }

                        btnCrear.disabled = true;
                        Swal.fire({
                            icon: 'info',
                            title: 'Creating Tests in Jira',
                            text: 'Por favor espera...',
                            allowOutsideClick: false,
                            allowEscapeKey: false,
                            didOpen: () => Swal.showLoading()
                        });

                        try {
                            await crearTestEnJira(selectedScenarios, elsEsc, els, elsCred);
                        } catch (e) {
                            Swal.close();
                            console.error(e);
                            Swal.fire('Upss!', 'A problem occurred while creating the tests.', 'error');
                        } finally {
                            btnCrear.disabled = false;
                        }

                    } else {
                        Swal.fire('Upss!', 'A problem occurred while creating the tests.', 'error');
                    }
                });
            });
        }
    }
}

async function crearTestEnJira(scenarios, elsEsc, els, elsCred) {

    const storyKey = (els.issue?.value || '').trim();
    if (!/^[A-Z][A-Z0-9]+-\d+$/.test(storyKey)) {
        Swal.fire('Upss!', 'We couldnt find the Jira IssueKey, you must be on a valid Jira issue.', 'warning');
        return;
    }

    const projectKey = storyKey.split('-')[0];
    const cfg = await chrome.storage.sync.get(['jira_base', 'jira_email', 'jira_token', 'issue_type']);
    let { jira_base, jira_email, jira_token, issue_type } = cfg;

    if (!issue_type) issue_type = elsCred.inpissuetype.value.trim();
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
        Swal.fire('Upss!', 'To use this feature you must enter your Jira credentials.', 'error');
        return;
    }

    try {
        const created = [];
        var xrayToken = "";
        if (await isXrayinUse()) {
            const { xray_client_id, xray_client_secret } = await chrome.storage.sync.get([
                'xray_client_id',
                'xray_client_secret'
            ]);

            if (!xray_client_id || !xray_client_secret) {
                throw new Error('Xray Cloud credentials (client_id / client_secret) are missing if you want to use this functionality.');
            }
            xrayToken = await xrayAuthenticate(xray_client_id, xray_client_secret);
        }

        const selectedScenarios = elsEsc.getSelectedScenarios();
        if (!selectedScenarios.length) {
            Swal.fire('No selection', 'No scenarios selected.', 'info');
            return;
        }

        // 🔹 crear issues y setear Test Type

        var mensajeCompleto = "";

        for (const sc of selectedScenarios) {
            elsEsc.status.textContent = `Creating Test: "${sc.name}"...`;
            const testKey = await jiraCreateTestIssue({
                jira_base, jira_email, jira_token, projectKey, scenario: sc, storyKey
            });

            if (testKey === "0") {
                throw new Error('Error creating issue. The task type may not be available in Jira. Check your settings.');
            } else if (testKey === "400") {
                throw new Error('Error creating issue (400). Check that the issue type exists in your project.');
            } else if (testKey === "401") {
                throw new Error('You do not have permission to create issues in Jira via the REST API.');
            } else if (testKey === "402") {
                throw new Error('Review your connection details for the Jira API.');
            }

            if (testKey && testKey.length > 3) {
                created.push({ key: testKey, type: sc.type });
                mensajeCompleto = mensajeCompleto + "The test has been created <strong>" + testKey + "</strong>";
                if (isXrayinUse()) {
                    const descriptionText =
                        `Scenario: ${sc.name}\n` +
                        sc.body.split(/\r?\n/).slice(1).join('\n');
                    ("The scenario is: " + descriptionText);

                    try {
                        // 🔹 setear tipo de test en Xray Cloud
                        var confirmacion = await xraySetTestTypeCloud({
                            token: xrayToken,
                            testKey,
                            testType: sc.type // "Manual" | "Cucumber"
                        });

                        if (confirmacion) {
                            mensajeCompleto = mensajeCompleto + ",  has been modified as " + sc.type + " test, ";
                        }

                        if (confirmacion && sc.type === 'Cucumber') {
                            await xrayUpdateGherkinSmart({ token: xrayToken, idOrKey: testKey, gherkin: descriptionText });
                            mensajeCompleto = mensajeCompleto + ",  the gherkin has been added.";
                        }

                    }
                    catch (e) {
                        console.warn(`Test Type could not be set (Xray) for ${testKey}`, e);
                    }
                    mensajeCompleto = mensajeCompleto + "<br>"
                }

            }
        }

        // 🔹 vincular a la historia
        const createdKeys = created.map(c => c.key);
        elsEsc.status.textContent = `Linking ${createdKeys.length} test(s)...`;

        //para setear el issue principal desde la seleccion del front
        const issueSelectodInFront = document.getElementById('mainissue').value;

        //obtener el link type seleccionado
        const { linked } = await chrome.storage.sync.get('linked');
        for (const tk of createdKeys) {
            await jiraLinkIssues({ jira_base, jira_email, jira_token, inward: issueSelectodInFront, outward: tk, linkType: linked })
                || await jiraLinkIssues({ jira_base, jira_email, jira_token, inward: issueSelectodInFront, outward: tk, linkType: 'Relates' });
        }

        elsEsc.status.textContent = `Done. The test(s) have been created and linked.: ${createdKeys.join(', ')}`;

        Swal.fire({
            title: 'Excellent',
            html: mensajeCompleto + '<br><br>All issues have been linked to the selected task, refresh the issue to see the changes.',
            icon: 'success',
            confirmButtonText: 'OK',
            width: "80%"
        });

        if (await isXrayinUse()) {
            els.cucumberxray.style = "";
            els.cucumberxray.addEventListener('click', async () => {
                await exportCucumberByKey(issueSelectodInFront);
            });
        } else {
            els.cucumberxray.style.display = "none";
        }
    } catch (e) {
        Swal.fire({ title: 'Error', html: e.message, icon: 'error', confirmButtonText: 'I understand' });
    }
}



// --- Parser robusto de escenarios en Gherkin ---
function parseGherkinScenarios(text) 
{
    const norm = (text || '').replace(/\r/g, '').replace(/\u00A0/g, ' ');
    const lines = norm.split('\n');
    const scenarios = [];
    let current = null;
    const startRe = /^\s*(?:(Scenario\s+Outline|Esquema\s+del\s+escenario|Scenario|Escenario))\s*:\s*(.+)\s*$/i;
    const stepRe = /^\s*(?:Given|When|Then|And|But|Dado|Cuando|Entonces|Y|Pero)\b/i;

    for (const raw of lines) {
        const line = raw.replace(/\s+$/, ''); // trim right
        const m = line.match(startRe);

        if (m) {
            if (current) scenarios.push(current);

            const rawKeyword = m[1].trim();
            const rawName = m[2].trim();
            const cleanName = rawName.replace(/['"]/g, '');
            const isOutline = /outline|esquema\s+del\s+escenario/i.test(rawKeyword);
            const header = isOutline ? 'Scenario Outline' : 'Scenario';

            current = {
                name: cleanName || 'Untitled scenario',
                body: `${header}: ${cleanName}\n`
            };
        } else if (current) {
            current.body += (line.length ? line : '') + '\n';
        }
    }

    if (current) scenarios.push(current);

    const headerRe = startRe; 
    return scenarios
        .map(s => ({ name: s.name, body: s.body.trim() }))
        .filter(s => s.body && (headerRe.test(s.body.split('\n')[0]) || stepRe.test(s.body)));
}




async function jiraCreateTestIssue({
    jira_base,
    jira_email,
    jira_token,
    projectKey,
    scenario,
    storyKey,
}) {

    var tipoScenario = "Scenario:";
    if (scenario.body.includes('Examples')) {
        tipoScenario = "Scenario Outline:"
    }

    var descriptionText =
        `Self-created scenario for ${storyKey}\n\n` +
        `${tipoScenario} ${scenario.name}\n` +
        scenario.body.split(/\r?\n/).slice(1).join('\n');

    descriptionText = descriptionText.replaceAll('`', '');
    descriptionText = descriptionText + '\n\n Created by Hakaboost - Hakalab.com'

    const { issue_type } = await chrome.storage.sync.get(['issue_type']);
    let tipoIssue = issue_type || 'Test';

    const fieldsADF = {
        project: { key: projectKey },
        summary: `${scenario.name}`,
        issuetype: { name: tipoIssue },
        description: toAdfText(descriptionText)
    };

    try {
        const data = await jiraRequest({
            jira_base, jira_email, jira_token,
            path: '/rest/api/3/issue',
            method: 'POST',
            body: { fields: fieldsADF }
        });

        if (data.status === 201) { //si es correcto retorna el key del issue
            return data.body.key;
        }
        else if (data.status === 400) { //si el tipo de issue no existe, responde 400 y intentamos crear uno del tipo tarea
            Swal.fire('Upss', 'The specified issue type does not appear to exist in the project, the issue will be created as a Task.', 'info');
            const fieldsFallback = {
                ...fieldsADF,
                issuetype: { name: 'Task' }
            };
            const data2 = await jiraRequest({
                jira_base, jira_email, jira_token,
                path: '/rest/api/3/issue',
                method: 'POST',
                body: { fields: fieldsFallback }
            });
            if (!data2.body || !data2.body.key) {
                return "400";
            }
            return data2.body.key;

        } else if (data.status === 401) { 
            return "401"
        } else if (data.status >= 402) { 
            return "402"
        }
        return data.body.key;
    } catch (e) {
        return 0;
    }
}

/**
 * Crea un issue tipo "Test" con el escenario Gherkin en la descripción (ADF).
 * Devuelve la clave del issue creado (p.ej. "Haka-1234").
*/
function toAdfText(text) {
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


/**
 * Enlaza HU -> Test usando el tipo cuyo inward es "is tested by".
 * Es decir, en la HU verás la sección "is tested by".
 */

async function jiraLinkIssues({ jira_base, jira_email, jira_token, inward, outward }) {

    let typeLink = "Test";
    const { linked } = await chrome.storage.sync.get('linked');
    if (linked) {
        typeLink = linked;
    }

    typeLink = typeLink.trim();

    try {
        const data = await jiraRequest({
            jira_base, jira_email, jira_token,
            path: '/rest/api/3/issueLink',
            method: 'POST',
            body: {
                type: { name: typeLink },
                inwardIssue: { key: outward }, // HU
                outwardIssue: { key: inward } // Test
            }
        });
        if (data.status > 399) {
            const data2 = await jiraRequest({
                jira_base, jira_email, jira_token,
                path: '/rest/api/3/issueLink',
                method: 'POST',
                body: {
                    type: { name: "Relates" }, 
                    inwardIssue: { key: outward }, // HU
                    outwardIssue: { key: inward } // Test
                }
            });
            if (data.status >= 400) {
                throw new Error("Error linking issues, you will have to do it manually.");
            }
        }
        return true;
    } catch (e) {
        Swal.fire({
            title: 'Error',
            html: e.message,
            icon: 'error',
            confirmButtonText: 'I understand'
        });
        return false;
    }
}



//helpers jira xray
export function mask(token) {
    if (!token) return '';
    if (token.length <= 8) return '••••' + token.slice(-2);
    return token.slice(0, 4) + '••••' + token.slice(-4);
}

export function isMasked(v) {
    return v.includes('••••');
}

// ==== Jira REST helpers (versión robusta) ====
function b64(str) {
    try { return btoa(str); } catch { return Buffer.from(str).toString('base64'); }
}

export async function jiraRequest({ jira_base, jira_email, jira_token, path, method = 'GET', body = null }) {
    const url = `${jira_base.replace(/\/+$/, '')}${path}`;
    const headers = {
        'Accept': 'application/json',
        'Authorization': 'Basic ' + b64(`${jira_email}:${jira_token}`)
    };
    if (body) headers['Content-Type'] = 'application/json';
    const resp = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });

    // Leemos siempre el cuerpo (puede ser JSON o texto)
    const text = await resp.text().catch(() => '');
    let parsed;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = text || null;
    }

    return {
        status: resp.status,
        body: parsed
    };
}

async function leerDescripcionDesdeJiraActualizada(els) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        Swal.fire('Upss!', 'There is no active Jira tab', 'error');
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
        Swal.fire('Upss!', 'Error reading the description.', 'error');
    }
}

// --- helpers para selección de Tests a crear---
function scenarioId(sc, idx) {
    return `${idx}::${sc.name}::${sc.body?.length || 0}`;
}

async function setupScenarioSelectionUI(containerEl, scenarios, elsEsc) {
    document.getElementById('robot-durmiento').style = 'display:none';
    document.getElementById('divcreatetests').style = 'display:block';
    let issue = document.getElementById('sp-issue').value;
    let listadoIssues = '';

    const issues_linkedinmain = await fetchKeysByXPathFromTab();
    if (issues_linkedinmain.length > 0) {
        for (const issue of issues_linkedinmain) {
            listadoIssues = listadoIssues + '<option value="' + issue + '">' + issue + '</option>';
        }
    }
    mainissue.innerHTML = '<option value="' + issue + '">' + issue + ' (Actual)</option>' + listadoIssues;
    containerEl.innerHTML = '';
    elsEsc.renderedScenarios = scenarios;
    elsEsc.selectedScenarioIds = new Set();
    elsEsc.sidToIndex = new Map();

    var selectforXrayType = "";
    if (await isXrayinUse()) {
        selectforXrayType = '<select class="form-select sc-type" style="max-width:130px">' +
            '<option value="Manual" selected>Manual</option>' +
            '<option value="Cucumber">Cucumber</option>' +
            '</select>';
    }

    scenarios.forEach((sc, idx) => {
        const sid = scenarioId(sc, idx);
        elsEsc.selectedScenarioIds.add(sid);
        elsEsc.sidToIndex.set(sid, idx);

        const row = document.createElement('div');
        row.className = 'col-12';
        row.innerHTML = `
      <div class="input-group input-group-sm mb-1" data-scid="${sid}">
        <div class="input-group-text">
          <input type="checkbox" class="form-check-input sc-check" data-scid="${sid}" checked>
        </div>
        <input type="text" class="form-control form-control-sm sc-name" value="${sc.name ?? ''}" readonly>
        `+ selectforXrayType + `
      </div>
    `;
        containerEl.appendChild(row);
    });

    if (!containerEl.__scListenerAttached) {
        containerEl.__scListenerAttached = true;
        containerEl.addEventListener('change', (e) => {
            const chk = e.target;
            if (!(chk instanceof HTMLInputElement)) return;
            if (!chk.classList.contains('sc-check')) return;

            const id = chk.dataset.scid;
            if (!id) return;

            const set = elsEsc.selectedScenarioIds;
            chk.checked ? set.add(id) : set.delete(id);
        });
    }

    elsEsc.getSelectedScenarios = function () {
        const result = [];
        const groups = containerEl.querySelectorAll('.input-group');
        groups.forEach(group => {
            const chk = group.querySelector('.sc-check');

            if (!chk || !(chk instanceof HTMLInputElement) || !chk.checked) {
                return;
            }

            const sid = group.getAttribute('data-scid');
            if (!sid) { return };

            const idx = elsEsc.sidToIndex.get(sid);
            if (idx == null) { return };

            const base = elsEsc.renderedScenarios[idx];
            const nameInput = group.querySelector('.sc-name');
            const typeSelect = group.querySelector('.sc-type');

            const name = (nameInput instanceof HTMLInputElement ? nameInput.value : (base.name ?? '')).trim();
            const type = (typeSelect instanceof HTMLSelectElement ? typeSelect.value : 'Manual');
            result.push({ ...base, name, type, _sid: sid });
        });
        return result;
    };
}


async function jiraEnsureXrayTestTypeFieldId({ jira_base, jira_email, jira_token }) {
    const { xray_test_type_field_id } = await chrome.storage.sync.get(['xray_test_type_field_id']);
    if (xray_test_type_field_id) return xray_test_type_field_id;

    const data = await jiraRequest({
        jira_base, jira_email, jira_token,
        path: '/rest/api/3/field',
        method: 'GET'
    });

    if (!data || data.status !== 200 || !Array.isArray(data.body)) {
        throw new Error('Could not get list of fields to locate "Test Type".');
    }

    const field = data.body.find(f =>
        typeof f?.name === 'string' && /test\s*type/i.test(f.name)
    );

    if (!field?.id) throw new Error('I didnt find the "Test Type" field in your Jira (Xray).');

    await chrome.storage.sync.set({ xray_test_type_field_id: field.id });
    return field.id;
}


async function xrayAuthenticate(clientId, clientSecret) {
    const resp = await fetch(ENDPOINTS.XRAY_AUTH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
    });
    if (!resp.ok) throw new Error(`Xray auth failed (${resp.status})`);
    // La API devuelve un string plano con el token (a veces con comillas)
    const raw = await resp.text();
    const token = raw.replace(/^"+|"+$/g, "");
    if (!token) throw new Error("Xray auth: token vacío");
    return token;
}

async function xraySetTestTypeCloud({ token, testKey, testType = 'Manual' }) {

    const allowed = ['Manual', 'Cucumber', 'Generic'];
    const finalType = (typeof testType === 'string' && allowed.includes(testType.trim())) ? testType.trim() : 'Manual';

    // credenciales Jira para resolver issueId
    const cfg = await chrome.storage.sync.get(['jira_base', 'jira_email', 'jira_token']);
    const { jira_base, jira_email, jira_token } = cfg || {};
    if (!jira_base || !jira_email || !jira_token) {
        throw new Error('[xraySetTestTypeCloud] Faltan jira_base / jira_email / jira_token en storage');
    }
    const b64 = s => (typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s).toString('base64'));

    const issueUrl = `${jira_base.replace(/\/+$/, '')}/rest/api/3/issue/${encodeURIComponent(testKey)}?fields=id`;
    const issueResp = await fetch(issueUrl, {
        headers: { 'Accept': 'application/json', 'Authorization': 'Basic ' + b64(`${jira_email}:${jira_token}`) }
    });
    const issueText = await issueResp.text().catch(() => '');
    if (!issueResp.ok) throw new Error(`[xraySetTestTypeCloud] No pude obtener issueId de ${testKey}: ${issueResp.status} ${issueText}`);
    let issueId; try { issueId = JSON.parse(issueText)?.id; } catch { }
    if (!issueId) throw new Error('[xraySetTestTypeCloud] Jira no devolvió "id"');

    const gqlEndpoint = ENDPOINTS.XRAY_GRAPH;
    const query = `
    mutation ($issueId: String!, $testType: UpdateTestTypeInput!) {
      updateTestType(issueId: $issueId, testType: $testType) {
        issueId
        testType { name kind }
      }
    }
  `;
    const variables = { issueId, testType: { name: finalType } };

    const gqlResp = await fetch(gqlEndpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });

    const gqlText = await gqlResp.text().catch(() => '');

    let gqlJson = null; try { gqlJson = gqlText ? JSON.parse(gqlText) : null; } catch { }
    if (!gqlResp.ok || (gqlJson && Array.isArray(gqlJson.errors) && gqlJson.errors.length)) {
        throw new Error(`[xraySetTestTypeCloud] updateTestType falló (${gqlResp.status}): ${gqlText}`);
    }

    return true;
}


async function getIssueIdFromKey({ jira_base, jira_email, jira_token, key }) {
    const url = `${jira_base.replace(/\/+$/, '')}/rest/api/3/issue/${encodeURIComponent(key)}?fields=id`;
    const resp = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Basic ' + b64(`${jira_email}:${jira_token}`)
        }
    });
    const text = await resp.text().catch(() => '');
    if (!resp.ok) throw new Error(`[getIssueIdFromKey] No pude obtener issueId de ${key}: ${resp.status} ${text}`);
    let id; try { id = JSON.parse(text)?.id; } catch { }
    if (!id) throw new Error('[getIssueIdFromKey] Jira no devolvió "id".');
    return id;
}

async function xrayUpdateGherkinSmart({ token, idOrKey, gherkin }) {

    var cleanedGherkin = gherkin
        .split(/\r?\n/)
        // 1. Remove the stage title line
        .filter(line => !/^\s*(Scenario(?: Outline)?:|Escenario)/i.test(line))
        // 2. Removes extra empty lines
        .filter(line => line.trim() !== '')
        // 3. Normalizes indentation: removes spaces at the beginning of each line
        .map(line => line.trimStart())
        .join('\n')
        .trim();
    cleanedGherkin = cleanedGherkin.replaceAll('`', '');

    if (!cleanedGherkin) {
        throw new Error('[xrayUpdateGherkinSmart] After cleaning, the gherkin was empty (did it only have the stage title?).');
    }

    if (!token) throw new Error('[xrayUpdateGherkinSmart] Token missing (Bearer Xray)');
    if (!idOrKey) throw new Error('[xrayUpdateGherkinSmart] Missing idOrKey');
    if (!gherkin || !gherkin.trim()) throw new Error('[xrayUpdateGherkinSmart] gherkin void');

    // If it looks like a key (has a dash), resolve to issueId with Jira REST using saved credentials
    let issueId = idOrKey;
    if (/-/.test(idOrKey)) {
        const cfg = await chrome.storage.sync.get(['jira_base', 'jira_email', 'jira_token']);
        const { jira_base, jira_email, jira_token } = cfg || {};
        if (!jira_base || !jira_email || !jira_token) {
            throw new Error('[xrayUpdateGherkinSmart] jira_base / jira_email / jira_token are missing from storage to resolve the key.');
        }
        issueId = await getIssueIdFromKey({ jira_base, jira_email, jira_token, key: idOrKey });
    }


    // Mutación GraphQL de Xray 
    const query = `
    mutation UpdateGherkin($issueId: String!, $def: String!) {
      updateGherkinTestDefinition(issueId: $issueId, gherkin: $def) {
        issueId
        testType { name }
      }
    }
  `;
    const variables = { issueId, def: cleanedGherkin };

    const resp = await fetch(ENDPOINTS.XRAY_GRAPH, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.trim().replace(/^"+|"+$/g, '')}`, // por si viene con comillas
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
    });

    const text = await resp.text().catch(() => '');

    let json = null; try { json = text ? JSON.parse(text) : null; } catch { }
    if (!resp.ok || (json && Array.isArray(json.errors) && json.errors.length)) {
        const msg = json?.errors?.map(e => e.message).join(' | ') || text || `HTTP ${resp.status}`;
        // Tip común: si aquí dice "Test is not a Cucumber test", primero cambia el tipo a Cucumber y reintenta.
        throw new Error(`[xrayUpdateGherkinSmart] updateGherkinTestDefinition falló: ${msg}`);
    }

    return { status: resp.status, body: json?.data?.updateGherkinTestDefinition };
}

async function isXrayinUse() {
    const { xray } = await chrome.storage.sync.get('xray');
    if (xray + '' === 'true') {
        return true;
    } else {
        return false;
    }
}


async function fetchKeysByXPathFromTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return [];

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_KEYS_BY_XPATH' }, (resp) => {
            void chrome.runtime.lastError;
            resolve(resp?.keys || []);
        });
    });
}

async function exportCucumberByKey(issueKey) {
    const BASE = ENDPOINTS.XRAY;

    const { xray_client_id, xray_client_secret } = await chrome.storage.sync.get([
        'xray_client_id',
        'xray_client_secret'
    ]);

    if (!xray_client_id || !xray_client_secret) {
        throw new Error('Xray Cloud credentials are missing (client_id / client_secret)');
    }

    // 🔹 autenticar en Xray una sola vez
    const xrayToken = await xrayAuthenticate(xray_client_id, xray_client_secret);


    // 2) Hacer export por key
    const expUrl = `${BASE}/api/v1/export/cucumber?keys=${encodeURIComponent(issueKey)}`;
    const resp = await fetch(expUrl, { headers: { Authorization: `Bearer ${xrayToken}` } });
    if (!resp.ok) throw new Error(`Error exporting feature: ${resp.status} ${resp.statusText}`);
    const blob = await resp.blob();

    // 3) Guardar el ZIP localmente
    const blobUrl = URL.createObjectURL(blob);
    const filename = `${issueKey}.feature.zip`;

    await chrome.downloads.download({ url: blobUrl, filename, saveAs: true });
    URL.revokeObjectURL(blobUrl);
}

