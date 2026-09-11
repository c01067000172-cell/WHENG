const cfg=window.WHENG_CONFIG||{};
document.querySelectorAll('a[data-phone-link]').forEach(el=>el.href=`tel:${cfg.phoneTel||''}`);
const mode=document.getElementById('siteMode');
if(mode)mode.textContent=window.WHENG_DATA?.mode==='supabase'?'실시간 접수 운영':'데모 모드';

const shell=document.getElementById('mockupShell');
document.querySelectorAll('[data-scroll]').forEach(btn=>btn.addEventListener('click',()=>{
  if(!shell)return;
  const ratio=Number(btn.dataset.scroll||0);
  const top=shell.getBoundingClientRect().top+window.scrollY+(shell.offsetHeight*ratio);
  window.scrollTo({top:Math.max(0,top-window.innerHeight*.18),behavior:'smooth'});
}));

const modal=document.getElementById('quoteModal');
function openQuote(){modal?.classList.remove('hidden');document.body.style.overflow='hidden'}
function closeQuote(){modal?.classList.add('hidden');document.body.style.overflow=''}
document.querySelectorAll('[data-open-quote]').forEach(el=>el.addEventListener('click',openQuote));
document.querySelectorAll('[data-close-quote]').forEach(el=>el.addEventListener('click',closeQuote));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal?.classList.contains('hidden'))closeQuote()});

const photoInput=document.querySelector('input[name="photos"]');
const photoPreview=document.getElementById('photoPreview');
photoInput?.addEventListener('change',()=>{
  const files=[...photoInput.files].slice(0,5);
  photoPreview.innerHTML='';
  files.forEach(file=>{
    const el=document.createElement('div');el.className='preview-item';
    const img=document.createElement('img');img.alt='첨부 미리보기';img.src=URL.createObjectURL(file);
    el.appendChild(img);photoPreview.appendChild(el);
  });
  if(photoInput.files.length>5)alert('사진은 최대 5장까지 접수됩니다.');
  if(files.some(f=>f.size>5*1024*1024)){
    alert('사진 한 장은 5MB 이하로 올려주세요.');photoInput.value='';photoPreview.innerHTML='';
  }
});

const form=document.getElementById('quoteForm');
form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=form.querySelector('button[type="submit"]');
  const note=document.getElementById('formNote');
  const fd=new FormData(form);
  const files=[...(photoInput?.files||[])].slice(0,5);
  const phone=String(fd.get('phone')||'').trim();
  if(files.some(f=>f.size>5*1024*1024)){note.textContent='사진 한 장의 최대 크기는 5MB입니다.';note.className='form-note error';return}
  if(!/^01\d[- ]?\d{3,4}[- ]?\d{4}$/.test(phone)){note.textContent='연락처를 확인해주세요. 예: 010-1234-5678';note.className='form-note error';return}
  btn.disabled=true;btn.textContent='접수 중...';note.className='form-note';
  try{
    await WHENG_DATA.createQuote({area:fd.get('area'),service:fd.get('service'),issue:fd.get('issue'),phone,date:fd.get('date')},files);
    note.textContent=WHENG_DATA.mode==='supabase'?'견적 요청이 정상 접수되었습니다. 확인 후 연락드리겠습니다.':'데모 접수 완료.';
    note.className='form-note success';form.reset();photoPreview.innerHTML='';btn.textContent='접수 완료';
    setTimeout(()=>{btn.textContent='무료 견적 요청하기';closeQuote()},1400);
  }catch(err){
    console.error(err);note.textContent=`접수 실패: ${err.message||'잠시 후 다시 시도해주세요.'}`;note.className='form-note error';btn.textContent='다시 접수하기';
  }finally{btn.disabled=false}
});
