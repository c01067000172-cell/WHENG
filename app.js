const cfg=window.WHENG_CONFIG||{};
const phoneTel=String(cfg.phoneTel||'').replace(/[^0-9+]/g,'');
const modal=document.getElementById('quoteModal');
const menuBtn=document.querySelector('.menu-btn');
const mobileNav=document.querySelector('.mobile-nav');

function openQuote(){modal?.classList.remove('hidden');document.body.style.overflow='hidden';setTimeout(()=>modal?.querySelector('input[name="area"]')?.focus(),30)}
function closeQuote(){modal?.classList.add('hidden');document.body.style.overflow=''}

menuBtn?.addEventListener('click',()=>{const open=mobileNav?.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(!!open))});
document.querySelectorAll('.mobile-nav a,.mobile-nav button').forEach(el=>el.addEventListener('click',()=>{mobileNav?.classList.remove('open');menuBtn?.setAttribute('aria-expanded','false')}));
document.querySelectorAll('[data-open-quote]').forEach(el=>el.addEventListener('click',openQuote));
document.querySelectorAll('[data-close-quote]').forEach(el=>el.addEventListener('click',closeQuote));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal?.classList.contains('hidden'))closeQuote()});

const phoneDialog=document.createElement('dialog');
phoneDialog.className='phone-dialog';phoneDialog.setAttribute('aria-label','상담 전화번호');
const phoneNumber=document.createElement('p');phoneNumber.textContent=cfg.phoneDisplay||'010-2239-1118';
const phoneClose=document.createElement('button');phoneClose.type='button';phoneClose.className='phone-close';phoneClose.setAttribute('aria-label','전화번호 닫기');phoneClose.textContent='×';
phoneClose.onclick=()=>phoneDialog.close();phoneDialog.append(phoneClose,phoneNumber);document.body.append(phoneDialog);
phoneDialog.addEventListener('click',e=>{if(e.target===phoneDialog){const r=phoneDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)phoneDialog.close()}});
document.querySelectorAll('a[data-phone-link]').forEach(el=>{
 el.addEventListener('click',e=>{e.preventDefault();if(!phoneDialog.open)phoneDialog.showModal()});
});
document.querySelectorAll('[data-phone-display]').forEach(el=>el.textContent=cfg.phoneDisplay||'010-2239-1118');
document.querySelectorAll('[data-service-areas]').forEach(el=>el.textContent=cfg.serviceAreas||'수원 · 화성 · 용인 · 오산 외 협의');
const mode=document.getElementById('siteMode');if(mode)mode.textContent=window.WHENG_DATA?.mode==='supabase'?'실시간 접수 운영':window.WHENG_DATA?.mode==='unavailable'?'접수 서버 연결 실패':'데모 모드';

function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
const caseDialog=document.createElement('dialog');caseDialog.className='case-dialog';caseDialog.setAttribute('aria-label','시공사례 상세');document.body.append(caseDialog);
function safeImage(value){try{const u=new URL(value,location.href);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
function showCase(row){
 const image=safeImage(row.image_url);caseDialog.innerHTML=`<button type="button" class="case-close" aria-label="닫기">×</button><h2>${esc(row.title)}</h2><p>${esc([row.area,row.category].filter(Boolean).join(' · '))}</p>${image?`<img src="${esc(image)}" alt="${esc(row.title)}">`:''}<p class="case-summary">${esc(row.summary||'상세 설명을 준비 중입니다.')}</p><button type="button" class="btn btn-primary case-quote">이 작업 견적 문의</button>`;
 caseDialog.querySelector('.case-close').onclick=()=>caseDialog.close();caseDialog.querySelector('.case-quote').onclick=()=>{caseDialog.close();openQuote()};caseDialog.showModal();
}
caseDialog.addEventListener('click',e=>{if(e.target===caseDialog){const r=caseDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)caseDialog.close()}});
async function renderCases(){
 const grid=document.getElementById('caseGrid');if(!grid)return;grid.textContent='시공사례를 불러오는 중입니다.';
 try{const rows=await WHENG_DATA.getCases();grid.replaceChildren();if(!rows?.length){grid.textContent='등록된 시공사례가 없습니다.';return}
 rows.forEach(row=>{const card=document.createElement('button');card.type='button';card.className='case-card case-button';const image=safeImage(row.image_url);card.innerHTML=`${image?`<img class="case-thumb" src="${esc(image)}" alt="" loading="lazy">`:'<div class="case-placeholder">사진 준비 중</div>'}<b>${esc(row.title)}</b><span>상세 보기</span>`;card.onclick=()=>showCase(row);grid.append(card)});
 }catch(e){grid.textContent='시공사례를 불러오지 못했습니다. ';const retry=document.createElement('button');retry.textContent='다시 불러오기';retry.onclick=renderCases;grid.append(retry)}
}
renderCases();
function selectService(name){
 openQuote();const select=document.querySelector('[name="service"]');
 if(![...select.options].some(o=>o.value===name))select.add(new Option(name,name));
 select.value=name;
}
async function renderServices(){
 const grid=document.querySelector('.service-grid');if(!grid)return;
 try{
  const rows=await WHENG_DATA.getServices();const select=document.querySelector('[name="service"]');const previous=select.value;
  select.replaceChildren(new Option('선택',''));grid.replaceChildren();
  for(const row of rows){
   select.add(new Option(row.name,row.name));
   const button=document.createElement('button');button.type='button';button.className='service-button';
   button.innerHTML=`<div class="service-icon" aria-hidden="true">🔧</div><h3>${esc(row.name)}</h3><p class="service-description">${esc(row.description||'')}</p><strong class="service-price">${esc(row.price_text||'상담 후 안내')}</strong>`;
   button.onclick=()=>selectService(row.name);grid.append(button);
  }
  if(!rows.some(row=>row.name==='기타'))select.add(new Option('기타','기타'));
  if([...select.options].some(o=>o.value===previous))select.value=previous;
  if(!rows.length)grid.textContent='서비스 안내를 준비 중입니다. 전화 또는 견적으로 문의해주세요.';
 }catch(e){
  grid.replaceChildren();const message=document.createElement('p');message.textContent='서비스 안내를 불러오지 못했습니다.';
  const retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.onclick=renderServices;grid.append(message,retry);
 }
}
renderServices();

const photoInput=document.querySelector('input[name="photos"]');
const photoPreview=document.getElementById('photoPreview');
photoInput?.addEventListener('change',()=>{
  const files=[...photoInput.files].slice(0,5);photoPreview.innerHTML='';
  files.forEach(file=>{const el=document.createElement('div');el.className='preview-item';const img=document.createElement('img');img.alt='첨부 미리보기';img.src=URL.createObjectURL(file);img.onload=()=>URL.revokeObjectURL(img.src);el.appendChild(img);photoPreview.appendChild(el)});
  if(photoInput.files.length>5)alert('사진은 최대 5장까지 접수됩니다.');
  if(files.some(f=>f.size>5*1024*1024)){alert('사진 한 장은 5MB 이하로 올려주세요.');photoInput.value='';photoPreview.innerHTML=''}
});

const form=document.getElementById('quoteForm');
form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=form.querySelector('button[type="submit"]');const note=document.getElementById('formNote');const fd=new FormData(form);const files=[...(photoInput?.files||[])].slice(0,5);const phone=String(fd.get('phone')||'').trim();
  if(files.some(f=>f.size>5*1024*1024)){note.textContent='사진 한 장의 최대 크기는 5MB입니다.';note.className='form-note error';return}
  if(!/^01\d[- ]?\d{3,4}[- ]?\d{4}$/.test(phone)){note.textContent='연락처를 확인해주세요. 예: 010-1234-5678';note.className='form-note error';return}
  btn.disabled=true;btn.textContent='접수 중...';note.className='form-note';
  try{
    await WHENG_DATA.createQuote({area:fd.get('area'),service:fd.get('service'),issue:fd.get('issue'),phone,date:fd.get('date')},files);
    note.textContent=WHENG_DATA.mode==='supabase'?'견적 요청이 정상 접수되었습니다. 확인 후 연락드리겠습니다.':'데모 접수 완료.';note.className='form-note success';form.reset();photoPreview.innerHTML='';btn.textContent='무료 견적 요청하기';
  }catch(err){console.error(err);note.textContent=`접수 실패: ${err.message||'잠시 후 다시 시도해주세요.'}`;note.className='form-note error';btn.textContent='다시 접수하기'}finally{btn.disabled=false}
});
if(cfg.kakaoUrl){
 try{const url=new URL(cfg.kakaoUrl);if(url.protocol==='https:'&&url.hostname==='pf.kakao.com')document.querySelectorAll('[data-kakao-link]').forEach(link=>link.href=url.href)}catch(_){}
}
