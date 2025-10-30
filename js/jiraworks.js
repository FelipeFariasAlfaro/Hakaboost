import { elsCred } from '../sidepanel.js';
import { leng, setting_leng } from "./lang.js";

setting_leng();

export async function testJiraConect() {
    try {
        const { jira_base } = await chrome.storage.sync.get(['jira_base']);
        const { jira_email } = await chrome.storage.sync.get(['jira_email']);
        const { jira_token } = await chrome.storage.sync.get(['jira_token']);
        const response = await fetch(`${jira_base}/rest/api/3/myself`, {
            method: "GET",
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
            headers: {
                "Authorization": "Basic " + btoa(`${jira_email}:${jira_token}`),
                "Accept": "application/json",
                "Cache-Control": "no-store"
            }
        });

        if (!response.ok) {
            Swal.fire({
                title: leng.MSG_ERROR_SWAL2,
                html: leng.MSG_JIRA_ERROR6,
                icon: 'error',
                confirmButtonText: leng.BTN_ENTIENDO
            });
            return;
        }

        const data = await response.json();

        let nombre = data.displayName;
        Swal.fire({
            title: leng.EXITO_SWAL,
            html: leng.MSG_JIRA_EXITO_CONN + nombre,
            icon: 'success',
            confirmButtonText: 'OK'
        });
        return;
    } catch (e) {
        Swal.fire({
            title: leng.MSG_ERROR_SWAL,
            html: leng.MSG_JIRA_ERROR6,
            icon: 'error',
            confirmButtonText: leng.BTN_ENTIENDO
        });
    }
}

export async function chachDefaultIssue() {
    if (elsCred.chkissuetype.checked) {
        elsCred.inpissuetype.disabled = false;
        Swal.fire({
            title: leng.INFORMACION,
            html: leng.MSG_JIRA_CHANGE_TYPE,
            icon: 'warning',
            confirmButtonText: leng.BTN_ENTIENDO,
            width: "80%",
        });

    }
}