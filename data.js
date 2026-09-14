(function(){
  const cfg = window.WHENG_CONFIG || {};
  const hasRemote = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase?.createClient);
  const remote = hasRemote ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;

  const KEY = 'wheng_demo_data_v2';
  const now = () => new Date().toISOString();
  const uid = () => crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const defaults = {
    services: [
      {id:'svc-visit', sort_order:10, name:'기본 출장·현장 점검', description:'현장 상태 확인 및 기본 점검', price_text:'50,000원~', active:true},
      {id:'svc-faucet', sort_order:20, name:'싱크대·세면대 수전', description:'노후 수전, 누수, 흔들림, 수압 이상', price_text:'사진 확인 후 안내', active:true},
      {id:'svc-toilet', sort_order:30, name:'양변기 수리·교체', description:'필밸브, 부속, 누수, 흔들림, 교체', price_text:'현장 조건별 안내', active:true},
      {id:'svc-leak', sort_order:40, name:'단순 누수 보수', description:'세면대, 싱크대, 연결부 누수', price_text:'80,000원~', active:true},
      {id:'svc-toilet-leak', sort_order:50, name:'변기 주변 누수', description:'실리콘, 정심, 연결부 등 점검', price_text:'120,000원~', active:true},
      {id:'svc-boiler', sort_order:60, name:'보일러 분배기', description:'밸브, 구동기, 제어기, 분배기 이상', price_text:'사진/현장 확인', active:true},
      {id:'svc-pipe', sort_order:70, name:'배수·배관', description:'트랩, 호스, 노후 배관, 연결부 문제', price_text:'현장 견적', active:true},
      {id:'svc-remodel', sort_order:80, name:'부분 설비공사', description:'주방·욕실 위치 변경 및 설비 보수', price_text:'현장 견적', active:true}
    ],
    cases: [
      {id:'case-1', title:'싱크대 수전 교체', area:'수원', category:'수전', summary:'노후 수전 누수 및 본체 흔들림 확인 후 교체', image_url:'', active:true, sort_order:10, created_at:now()},
      {id:'case-2', title:'보일러 분배기 점검', area:'화성', category:'난방', summary:'구동기 및 밸브 작동 상태 확인 후 불량 부품 교체', image_url:'', active:true, sort_order:20, created_at:now()},
      {id:'case-3', title:'양변기 누수 보수', area:'용인', category:'욕실', summary:'내부 부속 및 연결부 점검 후 누수 원인 보수', image_url:'', active:true, sort_order:30, created_at:now()}
    ],
    quotes: []
  };

  function loadLocal(){
    try{
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      return parsed || structuredClone(defaults);
    }catch(_){ return structuredClone(defaults); }
  }
  function saveLocal(data){ localStorage.setItem(KEY, JSON.stringify(data)); }
  function mutateLocal(fn){ const data = loadLocal(); const result = fn(data); saveLocal(data); return result; }

  async function getServices(includeInactive=false){
    if(remote){
      let q = remote.from('wheng_services').select('*').order('sort_order');
      if(!includeInactive) q = q.eq('active', true);
      const {data,error}=await q; if(error) throw error; return data;
    }
    return loadLocal().services.filter(x=>includeInactive || x.active).sort((a,b)=>a.sort_order-b.sort_order);
  }

  async function getCases(includeInactive=false){
    if(remote){
      let q = remote.from('wheng_cases').select('*').order('sort_order').order('created_at',{ascending:false});
      if(!includeInactive) q = q.eq('active', true);
      const {data,error}=await q; if(error) throw error; return data;
    }
    return loadLocal().cases.filter(x=>includeInactive || x.active).sort((a,b)=>a.sort_order-b.sort_order);
  }

  async function createQuote(payload, files=[]){
    const quoteId = uid();
    const quote = {
      id: quoteId,
      area: payload.area.trim(),
      service_key: payload.service,
      issue: payload.issue.trim(),
      phone: payload.phone.trim(),
      preferred_date: payload.date || null,
      privacy_agreed: true,
      status: '신규',
      admin_note: '',
      created_at: now()
    };

    if(remote){
      const {error} = await remote.from('wheng_quotes').insert({
        id: quote.id, area: quote.area, service_key: quote.service_key, issue: quote.issue,
        phone: quote.phone, preferred_date: quote.preferred_date, privacy_agreed: true
      });
      if(error) throw error;

      for(const file of files.slice(0,5)){
        const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
        const photoId=uid();
        const path=`incoming/${quoteId}/${photoId}.${ext}`;
        const {error:upErr}=await remote.storage.from('wheng-quotes').upload(path,file,{contentType:file.type||'image/jpeg',upsert:false});
        if(upErr) throw upErr;
        const {error:rowErr}=await remote.from('wheng_quote_photos').insert({id:photoId,quote_id:quoteId,storage_path:path});
        if(rowErr) throw rowErr;
      }
      return quote;
    }

    mutateLocal(data=>{
      quote.photo_names=files.slice(0,5).map(f=>f.name);
      data.quotes.unshift(quote);
    });
    return quote;
  }

  async function signIn(email,password){
    if(!remote){
      if(email==='admin@wheng.local' && password==='1234') return {user:{email}};
      throw new Error('데모 로그인: admin@wheng.local / 1234');
    }
    const {data,error}=await remote.auth.signInWithPassword({email,password}); if(error) throw error;
    const {data:adminRow,error:adminErr}=await remote.from('wheng_admins').select('user_id').eq('user_id',data.user.id).maybeSingle();
    if(adminErr || !adminRow){ await remote.auth.signOut(); throw new Error('WHENG 관리자 권한이 없습니다.'); }
    return data;
  }

  async function bootstrapAdmin(email,password,token){
    if(!remote) throw new Error('Supabase 연결 후 사용할 수 있습니다.');
    const response=await fetch(`${cfg.supabaseUrl}/functions/v1/wheng-bootstrap-admin`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':cfg.supabasePublishableKey},
      body:JSON.stringify({email,password,token})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.error||'관리자 생성에 실패했습니다.');
    const {data,error}=await remote.auth.signInWithPassword({email,password});
    if(error) throw error;
    return {needsEmailConfirmation:false,user:data.user};
  }

  async function signOut(){ if(remote) await remote.auth.signOut(); sessionStorage.removeItem('wheng_demo_admin'); }
  async function getSession(){
    if(!remote){ return sessionStorage.getItem('wheng_demo_admin') ? {user:{email:'admin@wheng.local'}} : null; }
    const {data,error}=await remote.auth.getSession(); if(error) throw error;
    const session=data.session; if(!session) return null;
    const {data:adminRow,error:adminErr}=await remote.from('wheng_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();
    if(adminErr || !adminRow) return null;
    return session;
  }
  function setDemoSession(){ sessionStorage.setItem('wheng_demo_admin','1'); }

  async function getQuotes(){
    if(remote){ const {data,error}=await remote.from('wheng_quotes').select('*').order('created_at',{ascending:false}); if(error) throw error; return data; }
    return loadLocal().quotes;
  }
  async function updateQuote(id, patch){
    if(remote){ const {error}=await remote.from('wheng_quotes').update(patch).eq('id',id); if(error) throw error; return; }
    mutateLocal(data=>{ const row=data.quotes.find(x=>x.id===id); if(row) Object.assign(row,patch,{updated_at:now()}); });
  }
  async function deleteQuote(id){
    if(remote){ const {error}=await remote.from('wheng_quotes').delete().eq('id',id); if(error) throw error; return; }
    mutateLocal(data=>{ data.quotes=data.quotes.filter(x=>x.id!==id); });
  }
  async function saveService(row){
    if(remote){
      const clean={id:row.id||uid(),name:row.name,description:row.description||'',price_text:row.price_text||'',active:row.active!==false,sort_order:Number(row.sort_order)||100};
      const {error}=await remote.from('wheng_services').upsert(clean); if(error) throw error; return clean;
    }
    return mutateLocal(data=>{ const clean={...row,id:row.id||uid(),sort_order:Number(row.sort_order)||100}; const i=data.services.findIndex(x=>x.id===clean.id); if(i>=0)data.services[i]=clean;else data.services.push(clean); return clean; });
  }
  async function deleteService(id){
    if(remote){ const {error}=await remote.from('wheng_services').delete().eq('id',id); if(error) throw error; return; }
    mutateLocal(data=>{data.services=data.services.filter(x=>x.id!==id)});
  }
  async function saveCase(row){
    const clean={id:row.id||uid(),title:row.title,area:row.area||'',category:row.category||'',summary:row.summary||'',image_url:row.image_url||'',active:row.active!==false,sort_order:Number(row.sort_order)||100};
    if(remote){ const {error}=await remote.from('wheng_cases').upsert(clean); if(error) throw error; return clean; }
    return mutateLocal(data=>{ const i=data.cases.findIndex(x=>x.id===clean.id); if(i>=0)data.cases[i]={...data.cases[i],...clean};else data.cases.push({...clean,created_at:now()}); return clean; });
  }
  async function deleteCase(id){
    if(remote){ const {error}=await remote.from('wheng_cases').delete().eq('id',id); if(error) throw error; return; }
    mutateLocal(data=>{data.cases=data.cases.filter(x=>x.id!==id)});
  }

  async function uploadCaseImage(file,caseId){
    if(!file) return '';
    if(remote){
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
      const path=`cases/${caseId}/${uid()}.${ext}`;
      const {error}=await remote.storage.from('wheng-public').upload(path,file,{contentType:file.type||'image/jpeg',upsert:false});
      if(error) throw error;
      return remote.storage.from('wheng-public').getPublicUrl(path).data.publicUrl;
    }
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
  }

  async function getPhotoSignedUrl(path){
    if(!remote) return null;
    const {data,error}=await remote.storage.from('wheng-quotes').createSignedUrl(path,300); if(error) throw error; return data.signedUrl;
  }
  async function getQuotePhotos(quoteId){
    if(!remote) return [];
    const {data,error}=await remote.from('wheng_quote_photos').select('*').eq('quote_id',quoteId); if(error) throw error; return data;
  }

  window.WHENG_DATA={mode:remote?'supabase':'demo',remote,getServices,getCases,createQuote,signIn,bootstrapAdmin,signOut,getSession,setDemoSession,getQuotes,updateQuote,deleteQuote,saveService,deleteService,saveCase,deleteCase,getPhotoSignedUrl,getQuotePhotos,uploadCaseImage};
  // A configured production site must never report browser-only demo submissions as received.
  if((cfg.supabaseUrl || cfg.supabasePublishableKey) && !remote){
    window.WHENG_DATA.mode='unavailable';
    for(const [name,value] of Object.entries(window.WHENG_DATA)){
      if(typeof value==='function')window.WHENG_DATA[name]=async()=>{throw new Error('접수 서버에 연결하지 못했습니다. 새로고침하거나 010-2239-1118로 전화해주세요.');};
    }
  }

})();
