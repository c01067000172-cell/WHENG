const menuBtn=document.querySelector('.menu-btn');
const mobileNav=document.querySelector('.mobile-nav');
menuBtn?.addEventListener('click',()=>mobileNav.classList.toggle('open'));
document.querySelectorAll('.mobile-nav a').forEach(a=>a.addEventListener('click',()=>mobileNav.classList.remove('open')));

function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function iconFor(name=''){ if(name.includes('변기'))return'🚽'; if(name.includes('누수'))return'💧'; if(name.includes('분배기'))return'🧰'; if(name.includes('배관'))return'🔧'; if(name.includes('수전'))return'🚿'; if(name.includes('출장'))return'🛠️'; return'🏠'; }

async function renderServices(){
  const grid=document.getElementById('serviceGrid');
  const price=document.getElementById('priceList');
  if(!grid||!price)return;
  try{
    const rows=await WHENG_DATA.getServices();
    grid.innerHTML=rows.slice(0,6).map(x=>`<article class="service-card"><div class="icon">${iconFor(x.name)}</div><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><strong>${esc(x.price_text)}</strong></article>`).join('');
    price.innerHTML=rows.map(x=>`<div><span>${esc(x.name)}</span><b>${esc(x.price_text)}</b></div>`).join('');
  }catch(e){ console.error(e); }
}
async function renderCases(){
  const grid=document.getElementById('caseGrid'); if(!grid)return;
  try{
    const rows=await WHENG_DATA.getCases();
    grid.innerHTML=rows.slice(0,6).map((x,i)=>`<article class="case-card"><div class="case-photo ${x.image_url?'':'photo-'+['a','b','c'][i%3]}" ${x.image_url?`style="background-image:linear-gradient(0deg,rgba(16,24,32,.15),rgba(16,24,32,.15)),url('${esc(x.image_url)}')"`:''}><span>WHENG WORK</span></div><div class="case-body"><small>${esc(x.area)} · ${esc(x.category)}</small><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p></div></article>`).join('') || '<p>등록된 시공사례가 없습니다.</p>';
  }catch(e){ console.error(e); }
}

const photoInput=document.querySelector('input[name="photos"]');
const photoPreview=document.getElementById('photoPreview');
photoInput?.addEventListener('change',()=>{
  const files=[...photoInput.files].slice(0,5);
  photoPreview.innerHTML='';
  files.forEach(file=>{
    const el=document.createElement('div'); el.className='preview-item';
    const img=document.createElement('img'); img.alt='첨부 미리보기'; img.src=URL.createObjectURL(file);
    el.appendChild(img); photoPreview.appendChild(el);
  });
  if(photoInput.files.length>5){ alert('사진은 최대 5장까지 접수됩니다.'); }
  if(files.some(f=>f.size>5*1024*1024)){ alert('사진 한 장은 5MB 이하로 올려주세요.'); photoInput.value=''; photoPreview.innerHTML=''; }
});

const form=document.getElementById('quoteForm');
form?.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const btn=form.querySelector('button[type="submit"]'); const note=document.getElementById('formNote');
  const fd=new FormData(form); const files=[...(photoInput?.files||[])].slice(0,5);
  if(files.some(f=>f.size>5*1024*1024)){ note.textContent='사진 한 장의 최대 크기는 5MB입니다.'; note.className='form-note error'; return; }
  if(!/^01\d[- ]?\d{3,4}[- ]?\d{4}$/.test(String(fd.get('phone')).trim())){ note.textContent='연락처를 확인해주세요. 예: 010-1234-5678'; note.className='form-note error'; return; }
  btn.disabled=true; btn.textContent='접수 중...'; note.className='form-note';
  try{
    await WHENG_DATA.createQuote({area:fd.get('area'),service:fd.get('service'),issue:fd.get('issue'),phone:fd.get('phone'),date:fd.get('date')},files);
    note.textContent=WHENG_DATA.mode==='supabase'?'견적 요청이 정상 접수되었습니다. 확인 후 연락드리겠습니다.':'데모 접수 완료. 관리자 화면에서 즉시 확인할 수 있습니다.';
    note.className='form-note success'; form.reset(); photoPreview.innerHTML=''; btn.textContent='접수 완료';
    setTimeout(()=>btn.textContent='무료 견적 요청하기',1800);
  }catch(err){ console.error(err); note.textContent=`접수 실패: ${err.message||'잠시 후 다시 시도해주세요.'}`; note.className='form-note error'; btn.textContent='다시 접수하기'; }
  finally{btn.disabled=false;}
});

function applyConfig(){
  const cfg=window.WHENG_CONFIG||{};
  document.querySelectorAll('[data-phone-display]').forEach(el=>el.textContent=cfg.phoneDisplay||'010-0000-0000');
  document.querySelectorAll('a[data-phone-link]').forEach(el=>el.href=`tel:${cfg.phoneTel||''}`);
  document.querySelectorAll('[data-service-areas]').forEach(el=>el.textContent=cfg.serviceAreas||'수원 · 화성 · 용인 · 오산 외 협의');
  const mode=document.getElementById('siteMode'); if(mode) mode.textContent=WHENG_DATA.mode==='supabase'?'실시간 접수 운영':'데모 모드';
}

applyConfig(); renderServices(); renderCases();
