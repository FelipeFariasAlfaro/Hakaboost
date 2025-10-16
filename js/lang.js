export var lenguajeDef = "es";
export var leng;

export async function setting_leng() {
    const { lenguaje } = await chrome.storage.sync.get('lenguaje');

    if (lenguaje === "es") {
        try{
            const resp = await fetch(chrome.runtime.getURL('./leng/es.json')); 
            leng = await resp.json();
        }catch(e){
            const resp = await fetch(chrome.runtime.getURL('./leng/es.json')); 
            leng = await resp.json();
        }    
    }else{
        try{
            const resp = await fetch(chrome.runtime.getURL('./leng/en.json')); 
            leng = await resp.json();
        }catch(e){
            const resp = await fetch(chrome.runtime.getURL('./leng/en.json')); 
            leng = await resp.json();
        }    
    }
}