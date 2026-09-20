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
function configuredNaverBlogId(){return String(window.WHENG_CONFIG?.naverBlogId||'').trim();}
function configuredNaverBlogUrl(){return String(window.WHENG_CONFIG?.naverBlogUrl||('https://blog.naver.com/'+configuredNaverBlogId())).trim();}
function naverShareUrl(title){
  const target=new URL('index.html#cases',location.href).href;
  return 'https://blog.naver.com/openapi/share?'+new URLSearchParams({
    url:target,
    title:String(title||'')
  }).toString();
}
function naverBlogHomeUrl(){
  return configuredNaverBlogUrl();
}
function whengSiteUrl(){
  return String(window.WHENG_CONFIG?.siteUrl||'https://wheng.onrender.com/').trim();
}
function encodeWhengPayload(value){
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function isConfiguredNaverPostUrl(value){
  const id=configuredNaverBlogId().toLowerCase();
  if(!id)return true;
  let u;try{u=new URL(value)}catch{return false}
  if(u.protocol!=='https:'||!/(^|\.)blog\.naver\.com$/.test(u.hostname))return false;
  const parts=u.pathname.split('/').filter(Boolean).map(x=>x.toLowerCase());
  const queryId=String(u.searchParams.get('blogId')||'').toLowerCase();
  return parts[0]===id||queryId===id;
}
function addPromotionButtons(){
  document.querySelectorAll('#caseRows tr').forEach((row,i)=>{
    const x=cases[i];if(!x||!x.active||row.querySelector('[data-promotion]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.promotion='true';
    button.textContent=x.blog_status==='published'?'블로그 게시완료':'네이버 블로그';
    button.addEventListener('click',()=>{
      const draft=WHENG_DATA.blogDraftForCase(x);
      $('#drawerTitle').textContent='네이버 블로그 · 시공사례 등록';
      const body=$('#drawerBody');body.replaceChildren();

      const note=document.createElement('p');
      note.textContent='대상 블로그는 '+(configuredNaverBlogId()||'미설정')+' 입니다. 네이버 공유창의 내용 입력은 500자 제한이 있어 긴 시공 설명이 잘릴 수 있으므로, 이제 공유창 대신 전체 본문을 복사한 뒤 '+configuredNaverBlogId()+' 블로그의 일반 글쓰기에서 붙여넣는 방식으로 사용합니다.';
      body.append(note);
      const targetBlog=document.createElement('a');targetBlog.className='btn btn-light full';targetBlog.target='_blank';targetBlog.rel='noopener noreferrer';targetBlog.href=configuredNaverBlogUrl();targetBlog.textContent='지정 블로그 확인 · '+(configuredNaverBlogId()||'네이버 블로그');body.append(targetBlog);

      const titleLabel=document.createElement('label');titleLabel.className='field';titleLabel.textContent='블로그 제목';
      const titleInput=document.createElement('input');titleInput.value=x.blog_title||draft.blog_title;titleLabel.append(titleInput);body.append(titleLabel);

      const textLabel=document.createElement('label');textLabel.className='field';textLabel.textContent='블로그 본문';
      const text=document.createElement('textarea');text.rows=14;
      let preparedBody=x.blog_body||draft.blog_body;
      if(!preparedBody.includes(whengSiteUrl())) preparedBody=preparedBody.trim()+'\n\n공식 사이트: '+whengSiteUrl();
      text.value=preparedBody;textLabel.append(text);body.append(textLabel);

      if(x.image_url){
        const imageLink=document.createElement('a');imageLink.className='btn btn-light';imageLink.target='_blank';imageLink.rel='noopener noreferrer';
        imageLink.href=x.image_url;imageLink.textContent='시공 사진 열기';body.append(imageLink);
      }

      const accountCheck=document.createElement('a');accountCheck.className='btn btn-light full';accountCheck.target='_blank';accountCheck.rel='noopener noreferrer';
      accountCheck.href=naverBlogHomeUrl();accountCheck.textContent='1. solbi081 블로그 확인';body.append(accountCheck);
      const warning=document.createElement('div');warning.className='notice';warning.textContent='WHENG 네이버 도우미가 설치되어 있으면 아래 버튼 한 번으로 제목·본문·공식 사이트 링크·시공 사진을 네이버 글쓰기 화면에 자동으로 불러옵니다. 도우미가 없을 때도 본문은 클립보드에 복사됩니다.';body.append(warning);

      const copyTitle=document.createElement('button');copyTitle.className='btn btn-light full';copyTitle.type='button';copyTitle.textContent='2. 제목 복사';
      copyTitle.onclick=async()=>{try{await navigator.clipboard.writeText(titleInput.value);adminNotice('블로그 제목을 복사했습니다.')}catch{titleInput.focus();titleInput.select();adminNotice('제목을 선택했습니다. Ctrl+C로 복사해주세요.',true)}};
      body.append(copyTitle);

      const publish=document.createElement('button');publish.className='btn btn-primary full';publish.type='button';
      publish.textContent='3. 제목·본문·링크·사진 준비 + 네이버 글쓰기';
      publish.onclick=async()=>{
        const payload={
          v:1,
          title:titleInput.value.trim(),
          body:text.value.trim(),
          siteUrl:whengSiteUrl(),
          imageUrl:String(x.image_url||'').trim(),
          caseId:String(x.id||''),
          createdAt:Date.now()
        };
        const helperUrl=new URL('naver-helper.html',location.href);
        helperUrl.hash='wheng='+encodeWhengPayload(payload);
        // WHENG 도우미 페이지가 확장 프로그램에 payload를 안전하게 넘긴 뒤 네이버 글쓰기로 이동합니다.
        const opened=window.open(helperUrl.href,'_blank');
        let copied=false;
        try{
          await navigator.clipboard.writeText(payload.body);
          copied=true;
        }catch{
          text.focus();text.select();
        }
        try{await WHENG_DATA.updateCaseBlog(x.id,{blog_title:payload.title,blog_body:payload.body,blog_status:'ready',blog_url:x.blog_url||''});x.blog_status='ready';x.blog_title=payload.title;x.blog_body=payload.body;}catch(e){adminNotice('블로그 초안 상태 저장 실패: '+(e.message||e),true)}
        if(!opened){
          adminNotice('새 창이 차단되었습니다. 브라우저 주소창 오른쪽의 팝업 차단 아이콘에서 wheng.onrender.com을 허용해주세요.',true);
        }else if(copied){
          adminNotice('네이버 글쓰기 화면을 열었습니다. WHENG 도우미가 설치되어 있으면 제목·본문·링크·사진이 자동 입력됩니다. 자동 입력이 안 되면 본문은 이미 복사되어 있습니다.');
        }else{
          adminNotice('네이버 글쓰기 화면을 열었습니다. 자동 입력이 안 되면 WHENG 네이버 도우미 설치 여부를 확인해주세요.',true);
        }
      };
      body.append(publish);

      const urlLabel=document.createElement('label');urlLabel.className='field';urlLabel.textContent='게시 후 실제 네이버 블로그 글 주소';
      const urlInput=document.createElement('input');urlInput.type='url';urlInput.placeholder='https://blog.naver.com/...';urlInput.value=x.blog_url||'';urlLabel.append(urlInput);body.append(urlLabel);

      const savePublished=document.createElement('button');savePublished.className='btn btn-dark full';savePublished.type='button';savePublished.textContent='게시 완료 URL 저장';
      savePublished.onclick=async()=>{
        const value=urlInput.value.trim();
        let parsed;try{parsed=new URL(value)}catch{adminNotice('네이버 블로그 글 주소를 확인해주세요.',true);return}
        if(parsed.protocol!=='https:'||!/(^|\.)blog\.naver\.com$/.test(parsed.hostname)){adminNotice('blog.naver.com의 실제 게시글 주소를 입력해주세요.',true);return}
        if(!isConfiguredNaverPostUrl(value)){adminNotice('WHENG 지정 블로그는 '+configuredNaverBlogId()+' 입니다. 다른 네이버 블로그 글 주소는 저장할 수 없습니다.',true);return}
        await WHENG_DATA.updateCaseBlog(x.id,{blog_title:titleInput.value,blog_body:text.value,blog_status:'published',blog_url:value});
        Object.assign(x,{blog_title:titleInput.value,blog_body:text.value,blog_status:'published',blog_url:value});
        adminNotice('게시 완료 URL을 저장했습니다.');
        closeDrawer();await refreshAll();
      };
      body.append(savePublished);

      if(x.blog_url){
        const openPublished=document.createElement('a');openPublished.className='btn btn-light full';openPublished.href=x.blog_url;openPublished.target='_blank';openPublished.rel='noopener noreferrer';openPublished.textContent='실제 블로그 글 열기';body.append(openPublished);
      }
      $('#drawer').classList.remove('hidden');
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
  $('#caseActive').value=String(x.active!==false); $('#caseSave').onclick=async()=>{const id=x.id||crypto.randomUUID(); const file=$('#caseImageFile').files[0]; let imageUrl=$('#caseImage').value; if(file){$('#caseSave').textContent='사진 업로드 중...'; imageUrl=await WHENG_DATA.uploadCaseImage(file,id);} await WHENG_DATA.saveCase({id,area:$('#caseArea').value,category:$('#caseCategory').value,title:$('#caseTitle').value,summary:$('#caseSummary').value,image_url:imageUrl,sort_order:$('#caseOrder').value,active:$('#caseActive').value==='true',blog_title:x.blog_title||'',blog_body:x.blog_body||'',blog_status:x.blog_status||'draft',blog_url:x.blog_url||''});closeDrawer();await refreshAll()}; $('#drawer').classList.remove('hidden');
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
