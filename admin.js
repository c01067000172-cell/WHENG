function adminNotice(message,error=false){let box=document.getElementById('actionNotice');if(!box){box=document.createElement('div');box.id='actionNotice';box.setAttribute('role','status');document.body.append(box)}box.textContent=message;box.className='action-notice'+(error?' error':'');box.hidden=false;clearTimeout(adminNotice.timer);adminNotice.timer=setTimeout(()=>box.hidden=true,7000)}
async function runAction(task){try{return await task()}catch(e){adminNotice('처리하지 못했습니다: '+(e.message||'연결을 확인하고 다시 시도해주세요.'),true)}}
window.addEventListener('unhandledrejection',e=>{adminNotice('처리하지 못했습니다: '+(e.reason?.message||'다시 시도해주세요.'),true);e.preventDefault()});
const changeMessages={saveService:'서비스 저장 완료',deleteService:'서비스 삭제 완료',saveCase:'시공사례 저장 완료',deleteCase:'시공사례 삭제 완료',updateQuote:'견적 변경 완료',deleteQuote:'견적 삭제 완료'};
for(const [name,message] of Object.entries(changeMessages)){const original=WHENG_DATA[name];WHENG_DATA[name]=async(...args)=>{adminNotice('처리 중입니다…');try{const result=await original(...args);adminNotice(message);return result}catch(e){adminNotice('처리하지 못했습니다: '+(e.message||'다시 시도해주세요.'),true);throw e}}}
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate=s=>s?new Date(s).toLocaleString('ko-KR'):'-';
const adminEmail=window.WHENG_CONFIG?.adminEmail||'admin@wheng.local';
let quotes=[],services=[],cases=[];

async function init(){
  $('#modeBadge').textContent=WHENG_DATA.mode==='supabase'?'SUPABASE LIVE':'DEMO / LOCAL';
  if(WHENG_DATA.mode==='supabase'){
    $('#demoNote').classList.add('hidden');
    $('#setupToggle').classList.remove('hidden');
    $('#loginForm [name="password"]').value='';
  }
  const session=await WHENG_DATA.getSession(); if(session) await showApp(); else showLogin();
}
function showLogin(){ $('#loginShell').classList.remove('hidden'); $('#adminApp').classList.add('hidden'); }
async function showApp(){ $('#loginShell').classList.add('hidden'); $('#adminApp').classList.remove('hidden'); await refreshAll(); }


$('#setupToggle')?.addEventListener('click',()=>$('#setupForm').classList.toggle('hidden'));
$('#setupForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const msg=$('#setupMsg'); const fd=new FormData(e.currentTarget);
  msg.textContent='관리자 계정 설정 중...'; msg.className='muted';
  try{
    const result=await WHENG_DATA.bootstrapAdmin(adminEmail,fd.get('password'),fd.get('token'));
    if(result.needsEmailConfirmation){
      msg.textContent='확인 메일을 보냈습니다. 이메일 인증 후 같은 정보로 다시 관리자 설정을 실행하세요.';
      msg.className='muted'; return;
    }
    msg.textContent='관리자 등록 완료.'; msg.className='success';
    $('#setupForm').classList.add('hidden');
    await showApp();
  }catch(err){ msg.textContent=err.message||'관리자 설정에 실패했습니다.'; msg.className='error'; }
});
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); const msg=$('#loginMsg'); const fd=new FormData(e.currentTarget); msg.textContent='로그인 확인 중...'; msg.className='muted';
  try{ await WHENG_DATA.signIn(adminEmail,fd.get('password')); if(WHENG_DATA.mode==='demo')WHENG_DATA.setDemoSession(); await showApp(); }
  catch(err){msg.textContent=err.message;msg.className='error'}
});
$('#logoutBtn').addEventListener('click',async()=>{await WHENG_DATA.signOut();showLogin()});

$$('.nav button[data-section]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.nav button').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
  $$('.section').forEach(x=>x.classList.remove('active')); $(`#section-${btn.dataset.section}`).classList.add('active');
  $('#pageTitle').textContent=btn.textContent.trim();
}));

async function refreshAll(){
  [quotes,services,cases]=await Promise.all([WHENG_DATA.getQuotes(),WHENG_DATA.getServices(true),WHENG_DATA.getCases(true)]);
  renderDashboard(); renderQuotes(); renderServices(); renderCases(); renderSystem();
}
function renderDashboard(){
  const count=s=>quotes.filter(x=>x.status===s).length;
  $('#statToday').textContent=quotes.filter(x=>new Date(x.created_at).toDateString()===new Date().toDateString()).length;
  $('#statNew').textContent=count('신규'); $('#statBooked').textContent=count('예약완료'); $('#statDone').textContent=count('시공완료');
  $('#recentQuotes').innerHTML=quoteRows(quotes.slice(0,6));
}
function quoteRows(rows){
  if(!rows.length)return '<tr><td colspan="7"><div class="empty">아직 접수된 견적이 없습니다.</div></td></tr>';
  return rows.map(q=>`<tr><td>${esc(q.area)}</td><td>${esc(q.service_key)}</td><td>${esc(q.phone)}</td><td><span class="status ${esc(q.status)}">${esc(q.status)}</span></td><td>${esc(q.preferred_date||'-')}</td><td>${fmtDate(q.created_at)}</td><td><button class="btn btn-light" onclick="openQuote('${q.id}')">보기</button></td></tr>`).join('');
}
function renderQuotes(){
  const status=$('#quoteStatusFilter').value; const term=$('#quoteSearch').value.trim().toLowerCase();
  const rows=quotes.filter(q=>(!status||q.status===status)&&(!term||[q.area,q.service_key,q.phone,q.issue].join(' ').toLowerCase().includes(term)));
  $('#quoteRows').innerHTML=quoteRows(rows);
}
$('#quoteStatusFilter').addEventListener('change',renderQuotes); $('#quoteSearch').addEventListener('input',renderQuotes);

window.openQuote=async id=>{
  const q=quotes.find(x=>x.id===id); if(!q)return;
  $('#drawerTitle').textContent=`${q.area} · ${q.service_key}`;
  $('#drawerBody').innerHTML=`<div class="detail-grid"><div class="detail"><small>연락처</small><b>${esc(q.phone)}</b></div><div class="detail"><small>희망 방문일</small><b>${esc(q.preferred_date||'-')}</b></div><div class="detail"><small>접수일</small><b>${fmtDate(q.created_at)}</b></div><div class="detail"><small>상태</small><select id="detailStatus"><option>신규</option><option>상담중</option><option>예약완료</option><option>시공완료</option><option>취소</option></select></div></div><h3>증상</h3><div class="issue-box">${esc(q.issue)}</div><label class="field">관리자 메모<textarea id="detailNote" rows="4">${esc(q.admin_note||'')}</textarea></label><div id="photoArea"></div><div class="toolbar"><button class="btn btn-primary" id="saveQuoteBtn">저장</button><a class="btn btn-dark" href="tel:${esc(q.phone.replace(/[^0-9]/g,''))}">전화하기</a><button class="btn btn-danger" id="deleteQuoteBtn">삭제</button></div>`;
  $('#detailStatus').value=q.status;
  $('#drawer').classList.remove('hidden');
  $('#saveQuoteBtn').onclick=async()=>{await WHENG_DATA.updateQuote(id,{status:$('#detailStatus').value,admin_note:$('#detailNote').value});closeDrawer();await refreshAll();};
  $('#deleteQuoteBtn').onclick=async()=>{if(confirm('이 견적을 삭제할까요?')){await WHENG_DATA.deleteQuote(id);closeDrawer();await refreshAll();}};
  if(WHENG_DATA.mode==='supabase'){
    try{const photos=await WHENG_DATA.getQuotePhotos(id); if(photos.length){const urls=[];for(const p of photos)urls.push(await WHENG_DATA.getPhotoSignedUrl(p.storage_path)); $('#photoArea').innerHTML=`<h3>첨부사진</h3><div class="photos">${urls.map(u=>`<a href="${u}" target="_blank"><img src="${u}" alt="견적 사진"></a>`).join('')}</div>`}}catch(e){$('#photoArea').textContent='첨부사진을 불러오지 못했습니다.'}
  }
  $('#drawer').classList.remove('hidden');
};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});
document.getElementById('drawer').addEventListener('click',e=>{if(e.target.id==='drawer')closeDrawer()});
function closeDrawer(){$('#drawer').classList.add('hidden')} $('#drawerClose').onclick=closeDrawer;

function renderServices(){
  $('#serviceRows').innerHTML=services.map(x=>`<tr><td>${x.sort_order}</td><td>${esc(x.name)}</td><td>${esc(x.description)}</td><td><b>${esc(x.price_text)}</b></td><td>${x.active?'노출':'숨김'}</td><td><div class="row-actions"><button onclick="editService('${x.id}')">수정</button><button onclick="removeService('${x.id}')">삭제</button></div></td></tr>`).join('');
}
$('#newServiceBtn').onclick=()=>editService();
window.editService=id=>{
  const x=services.find(v=>v.id===id)||{id:'',name:'',description:'',price_text:'',sort_order:100,active:true};
  $('#drawerTitle').textContent=id?'서비스 수정':'서비스 추가';
  $('#drawerBody').innerHTML=`<div class="editor-grid"><label class="field">서비스명<input id="svcName" value="${esc(x.name)}"></label><label class="field">표시 순서<input id="svcOrder" type="number" value="${x.sort_order}"></label></div><label class="field">설명<input id="svcDesc" value="${esc(x.description)}"></label><label class="field">가격 표시<input id="svcPrice" value="${esc(x.price_text)}"></label><label class="field">노출<select id="svcActive"><option value="true">노출</option><option value="false">숨김</option></select></label><button class="btn btn-primary full" id="svcSave">저장</button>`;
  $('#svcActive').value=String(x.active!==false); $('#svcSave').onclick=async()=>{await WHENG_DATA.saveService({id:x.id||undefined,name:$('#svcName').value,description:$('#svcDesc').value,price_text:$('#svcPrice').value,sort_order:$('#svcOrder').value,active:$('#svcActive').value==='true'});closeDrawer();await refreshAll()}; $('#drawer').classList.remove('hidden');
};
window.removeService=async id=>{if(confirm('삭제할까요?')){await WHENG_DATA.deleteService(id);await refreshAll()}};

function renderCases(){
  $('#caseRows').innerHTML=cases.map(x=>`<tr><td>${x.sort_order}</td><td>${esc(x.area)}</td><td>${esc(x.category)}</td><td><b>${esc(x.title)}</b><br><small>${esc(x.summary)}</small></td><td>${x.active?'노출':'숨김'}</td><td><div class="row-actions"><button onclick="editCase('${x.id}')">수정</button><button onclick="removeCase('${x.id}')">삭제</button></div></td></tr>`).join('');
}
// Build copy only from the selected existing case; never use private quote data.
function promotionDraft(x){
  const title=String(x.title||'').trim();
  const area=String(x.area||'').trim();
  const heading=(area&&!title.includes(area)?area+' ':'')+title;
  return [heading,String(x.summary||'').trim(),'사랑을실은설비공 · WHENG',new URL('index.html#cases',location.href).href].filter(Boolean).join('\n\n');
}
function addPromotionButtons(){
  document.querySelectorAll('#caseRows tr').forEach((row,i)=>{
    const x=cases[i];if(!x||!x.active||row.querySelector('[data-promotion]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.promotion='true';button.textContent='홍보 초안';
    button.addEventListener('click',()=>{
      $('#drawerTitle').textContent='홍보 초안 · 게시 전 검토';
      const body=$('#drawerBody');body.replaceChildren();
      const note=document.createElement('p');note.textContent='등록된 공개 시공사례만 사용한 초안입니다. 고객 개인정보·사진 사용 동의를 확인하세요. 외부 채널에는 아직 게시하지 않았습니다.';
      const label=document.createElement('label');label.className='field';label.textContent='홍보 문구';
      const text=document.createElement('textarea');text.rows=10;text.value=promotionDraft(x);label.append(text);
      const copy=document.createElement('button');copy.className='btn btn-primary';copy.textContent='검토한 문구 복사';
      copy.onclick=async()=>{try{await navigator.clipboard.writeText(text.value);adminNotice('복사했습니다. 외부 게시 여부는 해당 채널에서 확인하세요.')}catch{ text.focus();text.select();adminNotice('자동 복사를 사용할 수 없습니다. 선택된 문구를 복사해주세요.',true)}};
      body.append(note,label,copy);$('#drawer').classList.remove('hidden');
    });
    row.querySelector('.row-actions')?.append(button);
  });
}
new MutationObserver(addPromotionButtons).observe(document.getElementById('caseRows'),{childList:true});
$('#newCaseBtn').onclick=()=>editCase();
window.editCase=id=>{
  const x=cases.find(v=>v.id===id)||{id:'',title:'',area:'',category:'',summary:'',image_url:'',sort_order:100,active:true};
  $('#drawerTitle').textContent=id?'시공사례 수정':'시공사례 추가';
  $('#drawerBody').innerHTML=`<div class="editor-grid"><label class="field">지역<input id="caseArea" value="${esc(x.area)}"></label><label class="field">분류<input id="caseCategory" value="${esc(x.category)}"></label></div><label class="field">제목<input id="caseTitle" value="${esc(x.title)}"></label><label class="field">설명<textarea id="caseSummary" rows="4">${esc(x.summary)}</textarea></label><label class="field">시공 사진<input id="caseImageFile" type="file" accept="image/*"><small class="muted">사진을 선택하면 업로드 후 사이트에 바로 반영됩니다.</small></label><label class="field">기존/외부 사진 URL<input id="caseImage" value="${esc(x.image_url||'')}" placeholder="사진 업로드 시 자동 입력"></label><div class="editor-grid"><label class="field">표시 순서<input id="caseOrder" type="number" value="${x.sort_order}"></label><label class="field">노출<select id="caseActive"><option value="true">노출</option><option value="false">숨김</option></select></label></div><button class="btn btn-primary full" id="caseSave">저장</button>`;
  $('#caseActive').value=String(x.active!==false); $('#caseSave').onclick=async()=>{const id=x.id||crypto.randomUUID(); const file=$('#caseImageFile').files[0]; let imageUrl=$('#caseImage').value; if(file){$('#caseSave').textContent='사진 업로드 중...'; imageUrl=await WHENG_DATA.uploadCaseImage(file,id);} await WHENG_DATA.saveCase({id,area:$('#caseArea').value,category:$('#caseCategory').value,title:$('#caseTitle').value,summary:$('#caseSummary').value,image_url:imageUrl,sort_order:$('#caseOrder').value,active:$('#caseActive').value==='true'});closeDrawer();await refreshAll()}; $('#drawer').classList.remove('hidden');
};
window.removeCase=async id=>{if(confirm('삭제할까요?')){await WHENG_DATA.deleteCase(id);await refreshAll()}};

function renderSystem(){
  $('#systemMode').textContent=WHENG_DATA.mode==='supabase'?'서버 데이터 조회 완료':'로컬 데모 저장소 사용 중';
  $('#systemConfig').textContent=WHENG_DATA.mode==='supabase'?'마지막 조회: '+new Date().toLocaleString('ko-KR'):'WHENG 전용 Supabase URL·Publishable Key를 config.js에 입력하면 실시간 DB로 전환됩니다.';
}
$('#refreshBtn').onclick=()=>runAction(async()=>{adminNotice('불러오는 중입니다…');await refreshAll();adminNotice('최신 내용으로 새로고침했습니다.')});
init().catch(()=>{showLogin();$('#loginMsg').textContent='로그인 상태를 확인하지 못했습니다. 다시 로그인해주세요.';$('#loginMsg').className='error';});

// Prevent duplicate saves; restore the button even when an upload or save fails.
document.getElementById('drawerBody').addEventListener('click',async event=>{
 const button=event.target.closest('#svcSave,#caseSave,#saveQuoteBtn');
 if(!button)return;
 event.stopImmediatePropagation();
 if(button.disabled)return;
 const handler=button.onclick;if(!handler)return;
 const label=button.textContent;button.disabled=true;
 try{
  if(button.id==='svcSave'&&!document.getElementById('svcName').value.trim())throw new Error('서비스명을 입력해주세요.');
  if(button.id==='caseSave'&&!document.getElementById('caseTitle').value.trim())throw new Error('시공사례 제목을 입력해주세요.');
  button.textContent='저장 중…';await handler();
 }catch(error){adminNotice(error.message||'저장하지 못했습니다. 다시 시도해주세요.',true);}
 finally{button.disabled=false;button.textContent=label;}
},true);
