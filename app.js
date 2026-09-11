const cfg=window.WHENG_CONFIG||{};
const phoneTel=String(cfg.phoneTel||'').replace(/[^0-9+]/g,'');
const modal=document.getElementById('quoteModal');
const menuBtn=document.querySelector('.menu-btn');
const mobileNav=document.querySelector('.mobile-nav');

function openQuote(){modal?.classList.remove('hidden');document.body.style.overflow='hidden';setTimeout(()=>modal?.querySelector('input[name="area"]')?.focus(),30)}
function closeQuote(){modal?.classList.add('hidden');document.body.style.overflow=''}

menuBtn?.addEventListener('click',()=>mobileNav?.classList.toggle('open'));
document.querySelectorAll('.mobile-nav a,.mobile-nav button').forEach(el=>el.addEventListener('click',()=>mobileNav?.classList.remove('open')));
document.querySelectorAll('[data-open-quote]').forEach(el=>el.addEventListener('click',openQuote));
document.querySelectorAll('[data-close-quote]').forEach(el=>el.addEventListener('click',closeQuote));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal?.classList.contains('hidden'))closeQuote()});

document.querySelectorAll('a[data-phone-link]').forEach(el=>{
  if(phoneTel&&phoneTel!=='01000000000') el.href=`tel:${phoneTel}`;
  else{
    el.href='#quote';
    el.addEventListener('click',e=>{e.preventDefault();openQuote();const note=document.getElementById('formNote');if(note){note.textContent='전화번호 등록 전입니다. 견적을 남겨주시면 확인 후 연락드리겠습니다.';note.className='form-note'}})
  }
});
document.querySelectorAll('[data-phone-display]').forEach(el=>el.textContent=cfg.phoneDisplay||'010-0000-0000');
document.querySelectorAll('[data-service-areas]').forEach(el=>el.textContent=cfg.serviceAreas||'수원 · 화성 · 용인 · 오산 외 협의');
const mode=document.getElementById('siteMode');if(mode)mode.textContent=window.WHENG_DATA?.mode==='supabase'?'실시간 접수 운영':'데모 모드';

function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function renderCases(){
  const grid=document.getElementById('caseGrid');if(!grid||!window.WHENG_DATA)return;
  try{
    const rows=await WHENG_DATA.getCases();
    if(!rows?.length)return;
    grid.innerHTML=rows.slice(0,4).map(x=>`<article class="case-card"><div class="case-placeholder" ${x.image_url?`style="background-image:url('${esc(x.image_url)}')"`:''}>${x.image_url?'':'🛠️'}</div><b>${esc(x.title)}</b><span>AFTER</span></article>`).join('');
  }catch(e){console.error('시공사례 로드 실패',e)}
}
renderCases();

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
    note.textContent=WHENG_DATA.mode==='supabase'?'견적 요청이 정상 접수되었습니다. 확인 후 연락드리겠습니다.':'데모 접수 완료.';note.className='form-note success';form.reset();photoPreview.innerHTML='';btn.textContent='접수 완료';setTimeout(()=>{btn.textContent='무료 견적 요청하기';closeQuote()},1400)
  }catch(err){console.error(err);note.textContent=`접수 실패: ${err.message||'잠시 후 다시 시도해주세요.'}`;note.className='form-note error';btn.textContent='다시 접수하기'}finally{btn.disabled=false}
});