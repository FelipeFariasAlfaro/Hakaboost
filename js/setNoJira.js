

document.addEventListener('DOMContentLoaded', async () => {
    const { lenguaje } = await chrome.storage.sync.get('lenguaje');
    if(lenguaje){
        if(lenguaje === 'es'){
            document.getElementById('mensaje_nojira').innerHTML = '<img src="img/mensaje_es.png" style="border: none; width: 300px; background-color: transparent; margin: 0px;"></img>';
        }else{
            document.getElementById('mensaje_nojira').innerHTML = '<img src="img/mensaje_en.png" style="border: none; width: 300px; background-color: transparent; margin: 0px;"></img>';
        }
    }else{
        document.getElementById('mensaje_nojira').innerHTML = '<img src="img/mensaje_en.png" style="border: none; width: 300px; background-color: transparent; margin: 0px;"></img>';
    }
});


