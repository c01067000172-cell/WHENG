(() => {
  const PAYLOAD_KEY='wheng_pending_blog_payload_v2';
  const STATUS_KEY='wheng_pending_blog_status_v2';
  const MAX_AGE=10*60*1000;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function decodePayload(encoded){
    try{
      let s=String(encoded||'').replace(/-/g,'+').replace(/_/g,'/');
      while(s.length%4)s+='=';
      const bin=atob(s);
      const bytes=Uint8Array.from(bin,ch=>ch.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }catch(_){return null;}
  }

  async function handoffFromWheng(){
    if(window.top!==window)return false;
    if(location.hostname!=='wheng.onrender.com')return false;
    if(!/\/naver-helper\.html$/i.test(location.pathname))return false;

    const match=String(location.hash||'').match(/(?:^#|&)wheng=([^&]+)/);
    if(!match)return false;

    const payload=decodePayload(match[1]);
    if(!payload||(!payload.imageUrl&&!payload.siteUrl))return false;

    payload.createdAt=Number(payload.createdAt||Date.now());
    await chrome.storage.local.set({
      [PAYLOAD_KEY]:payload,
      [STATUS_KEY]:{id:payload.createdAt,image:false,link:false}
    });
    location.replace('https://blog.naver.com/solbi081?Redirect=Write&categoryNo=0');
    return true;
  }

  async function readState(){
    const data=await chrome.storage.local.get([PAYLOAD_KEY,STATUS_KEY]);
    const payload=data[PAYLOAD_KEY];
    const status=data[STATUS_KEY]||{};
    if(!payload||!payload.createdAt)return null;
    if(Date.now()-Number(payload.createdAt)>MAX_AGE)return null;
    if(status.id!==payload.createdAt){
      return {payload,status:{id:payload.createdAt,image:false,link:false}};
    }
    return {payload,status};
  }

  async function saveStatus(status){
    await chrome.storage.local.set({[STATUS_KEY]:status});
  }

  function visible(el){
    if(!el)return false;
    const r=el.getBoundingClientRect();
    const s=getComputedStyle(el);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
  }

  function normalizeEditable(el){
    if(!el)return null;
    if(el.matches?.('[contenteditable="true"]'))return el;
    return el.querySelector?.('[contenteditable="true"]')||
           el.closest?.('[contenteditable="true"]')||
           el;
  }

  function findBody(){
    const selectors=[
      '.se-main-container .se-text-paragraph',
      '.se-component-content .se-text-paragraph',
      '.se-section-text .se-text-paragraph',
      '.se-section-text [contenteditable="true"]',
      '.se-main-container [contenteditable="true"]',
      '.se-content [contenteditable="true"]',
      '[class*="main-container"] [contenteditable="true"]'
    ];
    for(const sel of selectors){
      for(const node of document.querySelectorAll(sel)){
        if(node.closest?.('.se-documentTitle,.se-section-documentTitle'))continue;
        const el=normalizeEditable(node);
        if(el&&visible(el))return el;
      }
    }
    return null;
  }

  function focusEditable(el){
    try{
      el=normalizeEditable(el);
      el.scrollIntoView({block:'center',behavior:'instant'});
      el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
      el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      el.click?.();
      el.focus?.();
      return el;
    }catch(_){return null;}
  }

  function insertText(el,text){
    if(!el||!text)return false;
    try{
      el=focusEditable(el);
      if(!el)return false;
      const sel=window.getSelection();
      const range=document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);

      let ok=false;
      try{ok=document.execCommand('insertText',false,text);}catch(_){}
      if(!ok){
        el.textContent=(el.textContent||'')+text;
        el.dispatchEvent(new InputEvent('input',{
          bubbles:true,composed:true,inputType:'insertText',data:text
        }));
      }
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }catch(_){return false;}
  }

  function findPhotoButton(){
    const buttons=[...document.querySelectorAll('button')];
    return buttons.find(btn=>visible(btn)&&/(^|\s)사진(\s|$)/.test((btn.textContent||'').trim()))||
      buttons.find(btn=>visible(btn)&&/사진|이미지/.test(
        (btn.getAttribute('aria-label')||'')+' '+(btn.getAttribute('title')||'')
      ))||
      document.querySelector('button.se-image-toolbar-button,[class*="image"] button');
  }

  async function fileFromUrl(url){
    const res=await fetch(url,{credentials:'omit'});
    if(!res.ok)throw new Error('image fetch failed');
    const blob=await res.blob();
    const type=blob.type||'image/png';
    const ext=type.includes('jpeg')?'jpg':((type.split('/')[1]||'png').replace(/[^a-z0-9]/gi,''));
    return new File([blob],'wheng-case.'+ext,{type});
  }

  async function uploadImage(imageUrl){
    if(!imageUrl)return true;
    try{
      const file=await fileFromUrl(imageUrl);
      let input=[...document.querySelectorAll('input[type="file"]')]
        .find(el=>/image/i.test(String(el.accept||'')));

      if(!input){
        const btn=findPhotoButton();
        if(!btn)return false;
        btn.click();
        await sleep(800);
        input=[...document.querySelectorAll('input[type="file"]')]
          .find(el=>/image/i.test(String(el.accept||'')))||
          document.querySelector('input[type="file"]');
      }
      if(!input)return false;

      const dt=new DataTransfer();
      dt.items.add(file);
      input.files=dt.files;
      input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
      await sleep(2200);
      return true;
    }catch(_){return false;}
  }

  function toast(msg,error=false){
    if(window.top!==window)return;
    let box=document.getElementById('wheng-helper-toast');
    if(!box){
      box=document.createElement('div');
      box.id='wheng-helper-toast';
      Object.assign(box.style,{
        position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',
        maxWidth:'440px',padding:'14px 16px',color:'#fff',borderRadius:'8px',
        fontSize:'14px',fontWeight:'700',lineHeight:'1.5',
        boxShadow:'0 10px 30px rgba(0,0,0,.25)'
      });
      document.documentElement.appendChild(box);
    }
    box.style.background=error?'#b42318':'#0f5132';
    box.textContent=msg;
    clearTimeout(box._timer);
    box._timer=setTimeout(()=>box.remove(),7000);
  }

  let busy=false;
  async function attempt(){
    if(busy||!/\.naver\.com$/i.test(location.hostname))return;
    busy=true;
    try{
      const state=await readState();
      if(!state)return;
      const {payload,status}=state;

      if(!status.image){
        if(await uploadImage(String(payload.imageUrl||''))){
          status.image=true;
          await saveStatus(status);
          await sleep(1500);
        }else{
          return;
        }
      }

      if(status.image&&!status.link){
        const body=findBody();
        const link='공식 사이트: '+String(payload.siteUrl||'https://wheng.onrender.com/');
        if(body&&insertText(body,link)){
          status.link=true;
          await saveStatus(status);
        }
      }

      if(status.image&&status.link){
        toast('WHENG: 시공사진과 공식 사이트 링크만 넣었습니다. 나머지는 직접 작성하면 됩니다.');
      }
    }finally{
      busy=false;
    }
  }

  async function start(){
    if(await handoffFromWheng())return;
    if(!/\.naver\.com$/i.test(location.hostname))return;

    await sleep(900);
    attempt();
    const timer=setInterval(attempt,1000);
    setTimeout(()=>clearInterval(timer),30000);

    const observer=new MutationObserver(()=>attempt());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),30000);
  }

  start();
})();