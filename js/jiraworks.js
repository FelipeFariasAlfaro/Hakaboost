import { elsCred } from '../sidepanel.js';


export async function testJiraConect()
{
    try{
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
        let temp = btoa(`${jira_email}:${jira_token}`);
        
        if (!response.ok) {
            Swal.fire({
                title: 'Error',
                html: 'We were unable to connect to Jira, please check your data and try again..',
                icon: 'error',
                confirmButtonText: 'I understand'
            });
            return;
        }

        const data = await response.json();

        let nombre =  data.displayName;
        Swal.fire({
            title: 'All good!',
            html: 'We have successfully verified the use of JIRA API for your account: '+nombre,
            icon: 'success',
            confirmButtonText: 'OK'
        });
        return;
    }catch(e){
        Swal.fire({
                title: 'Error',
                html: 'We were unable to connect to Jira, please review your data and try again.',
                icon: 'error',
                confirmButtonText: 'Entiendo'
            });
    }    
}

export async function chachDefaultIssue()
{
    if(elsCred.chkissuetype.checked){
        elsCred.inpissuetype.disabled = false;
        Swal.fire({
            title: 'Atención!',
            html: 'This allows you to change the type of task (Issue) that TestHunt creates in Jira. <br>'+
                '<strong>Just change this value to a valid Jira task name (literal).</strong>'+
                '<br>If you specify a non-existent task type, an error will occur..'+
                '<br>To save the change press the "Save Jira" button',
            icon: 'warning',
            confirmButtonText: 'I understand',
            width: "80%",
        });
        
    }
}