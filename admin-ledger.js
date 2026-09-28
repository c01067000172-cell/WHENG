(() => {
  const STORAGE_KEY='wheng_admin_ledger_v1';
  const NAME_KEY='wheng_admin_ledger_name_v1';
  const expenseDetails=['자재비','인건비','폐기물처리비','차량유류비','공구비','광고비','사무용품비','기타'];
  const paymentOptions=['현금','카드','계좌이체','기타'];
  const proofOptions=['세금계산서','계산서','카드영수증','현금영수증','이체내역','없음'];
  let rows=[];
  let saveTimer=null;

  const $=s=>document.querySelector(s);
  const money=n=>Number(n||0).toLocaleString('ko-KR')+'원';
  const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2);

  function blankRow(){
    return {id:uid(),date:today(),type:'매출',party:'',description:'',detail:'매출',payment:'계좌이체',proof:'이체내역',amount:0,note:''};
  }
  function normalizeRow(r={}){
    const type=r.type==='경비'?'경비':'매출';
    return {
      id:r.id||uid(),
      date:r.date||today(),
      type,
      party:String(r.party||r.vendor||''),
      description:String(r.description||r.memo||''),
      detail:type==='매출'?'매출':String(r.detail||'자재비'),
      payment:paymentOptions.includes(r.payment)?r.payment:'계좌이체',
      proof:proofOptions.includes(r.proof)?r.proof:'이체내역',
      amount:Math.max(0,Number(r.amount)||0),
      note:String(r.note||'')
    };
  }
  function loadLocal(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      rows=Array.isArray(saved)?saved.map(normalizeRow):[];
    }catch{ rows=[]; }
    if(!rows.length) rows=[blankRow()];
    const name=localStorage.getItem(NAME_KEY)||'설비장부';
    const input=$('#ledgerName'); if(input) input.value=name;
    render();
    setStatus('자동저장 완료');
  }
  function saveLocal(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));
    localStorage.setItem(NAME_KEY,$('#ledgerName')?.value.trim()||'설비장부');
    setStatus('자동저장 완료');
  }
  function queueSave(){
    setStatus('저장 중...');
    clearTimeout(saveTimer);
    saveTimer=setTimeout(saveLocal,250);
  }
  function setStatus(text){
    const el=$('#ledgerSaveStatus'); if(el) el.textContent=text;
  }
  function updateTotals(){
    const sales=rows.filter(r=>r.type==='매출').reduce((s,r)=>s+(Number(r.amount)||0),0);
    const expense=rows.filter(r=>r.type==='경비').reduce((s,r)=>s+(Number(r.amount)||0),0);
    const profit=sales-expense;
    if($('#ledgerSales')) $('#ledgerSales').textContent=money(sales);
    if($('#ledgerExpense')) $('#ledgerExpense').textContent=money(expense);
    if($('#ledgerProfit')) {
      $('#ledgerProfit').textContent=(profit<0?'-':'')+money(Math.abs(profit));
      $('#ledgerProfit').classList.toggle('negative',profit<0);
    }
  }
  function selectHtml(options,value){
    return options.map(x=>'<option'+(x===value?' selected':'')+'>'+x+'</option>').join('');
  }
  function render(){
    const body=$('#ledgerRows'); if(!body)return;
    body.innerHTML=rows.map((r,i)=>{
      const details=r.type==='매출'?['매출']:expenseDetails;
      return `<tr data-id="${r.id}">
        <td><input class="ledger-input" data-key="date" type="date" value="${r.date}"></td>
        <td><select class="ledger-input" data-key="type">${selectHtml(['매출','경비'],r.type)}</select></td>
        <td><input class="ledger-input wide" data-key="party" value="${escapeHtml(r.party)}" placeholder="거래처/현장"></td>
        <td><input class="ledger-input wider" data-key="description" value="${escapeHtml(r.description)}" placeholder="거래내용"></td>
        <td><select class="ledger-input" data-key="detail">${selectHtml(details,r.detail)}</select></td>
        <td><select class="ledger-input" data-key="payment">${selectHtml(paymentOptions,r.payment)}</select></td>
        <td><select class="ledger-input" data-key="proof">${selectHtml(proofOptions,r.proof)}</select></td>
        <td><input class="ledger-input amount" data-key="amount" type="number" min="0" step="1" value="${Number(r.amount)||0}"></td>
        <td><input class="ledger-input wide" data-key="note" value="${escapeHtml(r.note)}" placeholder="비고"></td>
        <td><button class="ledger-delete" type="button" data-delete="${r.id}">삭제</button></td>
      </tr>`;
    }).join('');
    updateTotals();
  }
  function escapeHtml(s){
    return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function downloadBlob(content,type,filename){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function safeName(){
    return ($('#ledgerName')?.value.trim()||'설비장부').replace(/[\\/:*?"<>|]/g,'_');
  }
  function saveJson(){
    const data={version:1,name:$('#ledgerName')?.value.trim()||'설비장부',saved_at:new Date().toISOString(),rows};
    downloadBlob(JSON.stringify(data,null,2),'application/json;charset=utf-8',safeName()+'.json');
  }
  function csvEscape(v){
    const s=String(v??'');
    return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }
  function saveCsv(){
    const headers=['날짜','구분','거래처/현장','거래내용','세부항목','결제수단','증빙','금액','비고'];
    const lines=[headers,...rows.map(r=>[r.date,r.type,r.party,r.description,r.detail,r.payment,r.proof,r.amount,r.note])];
    const csv='\ufeff'+lines.map(line=>line.map(csvEscape).join(',')).join('\r\n');
    downloadBlob(csv,'text/csv;charset=utf-8',safeName()+'.csv');
  }
  function parseCsv(text){
    const out=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quoted){
        if(ch==='"'&&text[i+1]==='"'){field+='"';i++}
        else if(ch==='"') quoted=false;
        else field+=ch;
      }else{
        if(ch==='"') quoted=true;
        else if(ch===','){row.push(field);field=''}
        else if(ch==='\n'){row.push(field.replace(/\r$/,''));out.push(row);row=[];field=''}
        else field+=ch;
      }
    }
    if(field.length||row.length){row.push(field.replace(/\r$/,''));out.push(row)}
    return out;
  }
  async function loadJson(file){
    const data=JSON.parse(await file.text());
    const imported=Array.isArray(data)?data:data.rows;
    if(!Array.isArray(imported)) throw new Error('장부 형식이 올바르지 않습니다.');
    rows=imported.map(normalizeRow);
    if(!rows.length)rows=[blankRow()];
    if(data.name&&$('#ledgerName')) $('#ledgerName').value=String(data.name);
    saveLocal();render();
  }
  async function loadCsv(file){
    const raw=(await file.text()).replace(/^\ufeff/,'');
    const table=parseCsv(raw);
    if(table.length<2) throw new Error('CSV에 불러올 행이 없습니다.');
    rows=table.slice(1).filter(x=>x.some(v=>String(v).trim())).map(c=>normalizeRow({
      date:c[0],type:c[1],party:c[2],description:c[3],detail:c[4],payment:c[5],proof:c[6],amount:c[7],note:c[8]
    }));
    if(!rows.length)rows=[blankRow()];
    saveLocal();render();
  }
  function newLedger(){
    if(!confirm('현재 장부를 비우고 새 장부를 만들까요? 저장하지 않은 내용은 사라질 수 있습니다.'))return;
    rows=[blankRow()];
    if($('#ledgerName')) $('#ledgerName').value='설비장부';
    saveLocal();render();
  }

  document.addEventListener('input',e=>{
    if(e.target.id==='ledgerName'){queueSave();return}
    const input=e.target.closest('#ledgerRows [data-key]'); if(!input)return;
    const tr=input.closest('tr');const row=rows.find(r=>r.id===tr?.dataset.id);if(!row)return;
    const key=input.dataset.key; row[key]=key==='amount'?Math.max(0,Number(input.value)||0):input.value;
    updateTotals();queueSave();
  });
  document.addEventListener('change',e=>{
    const input=e.target.closest('#ledgerRows [data-key]'); if(!input)return;
    const tr=input.closest('tr');const row=rows.find(r=>r.id===tr?.dataset.id);if(!row)return;
    const key=input.dataset.key; row[key]=key==='amount'?Math.max(0,Number(input.value)||0):input.value;
    if(key==='type'){row.detail=row.type==='매출'?'매출':'자재비';render()}
    updateTotals();queueSave();
  });
  document.addEventListener('click',e=>{
    const del=e.target.closest('[data-delete]');if(del){
      rows=rows.filter(r=>r.id!==del.dataset.delete);if(!rows.length)rows=[blankRow()];render();saveLocal();return;
    }
    if(e.target.closest('#ledgerAddRow')){rows.push(blankRow());render();saveLocal();return}
    if(e.target.closest('#ledgerSaveFile')){saveLocal();saveJson();return}
    if(e.target.closest('#ledgerLoadFile')){$('#ledgerJsonInput')?.click();return}
    if(e.target.closest('#ledgerCsvSave')){saveLocal();saveCsv();return}
    if(e.target.closest('#ledgerCsvLoad')){$('#ledgerCsvInput')?.click();return}
    if(e.target.closest('#ledgerNew')){newLedger();return}
  });
  document.addEventListener('change',async e=>{
    if(e.target.id==='ledgerJsonInput'&&e.target.files?.[0]){
      try{await loadJson(e.target.files[0]);adminNotice?.('장부파일을 불러왔습니다.')}catch(err){adminNotice?.(err.message||'장부파일을 불러오지 못했습니다.',true)}
      e.target.value='';
    }
    if(e.target.id==='ledgerCsvInput'&&e.target.files?.[0]){
      try{await loadCsv(e.target.files[0]);adminNotice?.('CSV를 불러왔습니다.')}catch(err){adminNotice?.(err.message||'CSV를 불러오지 못했습니다.',true)}
      e.target.value='';
    }
  });

  loadLocal();
})();