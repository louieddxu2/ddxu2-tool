let currentAccountId = localStorage.getItem('activeAccountId');
let currentAccountName = '預設帳號';
let currentData = [];
let chartInstance = null;
let currentRules = [];

async function initApp() {
  lucide.createIcons();
  const accounts = await db.getAccounts();
  if (accounts.length === 0) {
    const defAcc = await db.addAccount('我的帳號');
    currentAccountId = defAcc.id; currentAccountName = defAcc.name;
  } else {
    const active = accounts.find(a => a.id === currentAccountId) || accounts[0];
    currentAccountId = active.id; currentAccountName = active.name;
  }
  localStorage.setItem('activeAccountId', currentAccountId);
  document.getElementById('current-account-name').innerText = currentAccountName;
  updateGlobalDate();
  await loadAndRender();
}

function updateGlobalDate() {
  const now = new Date();
  const days = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  document.getElementById('display-date').innerText = `今日：${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${days[now.getDay()]}`;
  document.getElementById('form-date').value = now.toISOString().split('T')[0];
}

async function loadAndRender() {
  currentData = await db.getRecords(currentAccountId);
  currentRules = await db.getRules(currentAccountId);
  await renderHome();
  renderRecords();
  renderStats();
}

/* UI 切換輔助函數 */
function switchTab(tabId) {
  document.querySelectorAll('.view-section').forEach(el => { el.classList.add('hidden'); el.classList.remove('block'); });
  document.getElementById(`view-${tabId}`).classList.remove('hidden'); document.getElementById(`view-${tabId}`).classList.add('block');
  document.querySelectorAll('.nav-btn').forEach(btn => { btn.classList.toggle('tab-active', btn.dataset.target === tabId); btn.classList.toggle('tab-inactive', btn.dataset.target !== tabId); });
  document.getElementById('fab-add').classList.toggle('hidden', tabId !== 'records');
}
function toggleModal(id, show) {
  const m = document.getElementById(id);
  const c = document.getElementById(`${id}-content`);
  if (show) {
    m.classList.remove('hidden'); m.classList.add('flex'); void m.offsetWidth;
    m.classList.remove('opacity-0'); if(c) c.classList.remove('translate-y-full');
  } else {
    m.classList.add('opacity-0'); if(c) c.classList.add('translate-y-full');
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
  }
}
const openModal = () => toggleModal('add-modal', true);
const closeModal = () => toggleModal('add-modal', false);
const openAccountModal = () => { renderAccountList(); toggleModal('account-modal', true); };
const closeAccountModal = () => toggleModal('account-modal', false);

/* 帳號邏輯 */
async function renderAccountList() {
  const accounts = await db.getAccounts();
  document.getElementById('account-list').innerHTML = accounts.map(acc => `
    <div onclick="switchAccount('${acc.id}', '${acc.name}')" class="flex justify-between items-center p-4 rounded-xl border-2 ${acc.id === currentAccountId ? 'border-panda bg-pink-50 text-panda font-bold' : 'border-slate-100 bg-white'} active:scale-95 transition-all">
      <div class="flex items-center gap-2"><i data-lucide="${acc.id === currentAccountId ? 'check-circle' : 'circle'}" class="w-5 h-5"></i>${acc.name}</div>
      ${accounts.length > 1 ? `<button onclick="event.stopPropagation(); handleDeleteAccount('${acc.id}')" class="text-slate-300 hover:text-red-500 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
    </div>
  `).join('');
  lucide.createIcons();
}
async function handleAddAccount() {
  const input = document.getElementById('new-account-name');
  if (!input.value.trim()) return;
  const newAcc = await db.addAccount(input.value.trim());
  input.value = ''; switchAccount(newAcc.id, newAcc.name); closeAccountModal();
}
function switchAccount(id, name) {
  currentAccountId = id; currentAccountName = name; localStorage.setItem('activeAccountId', id);
  document.getElementById('current-account-name').innerText = name;
  closeAccountModal(); loadAndRender();
}
async function handleDeleteAccount(id) { if (confirm('確定刪除此帳號標籤嗎？')) { await db.deleteAccount(id); initApp(); } }

/* 🌟 規則清單與編輯邏輯 🌟 */
function openRuleModal() { 
  try {
    renderRuleList(); 
    toggleModal('rule-modal', true); 
  } catch (err) {
    console.error("彈窗開啟失敗：", err);
    alert("開啟失敗，請重試或重新整理網頁");
  }
}


function renderRuleList() {
  const container = document.getElementById('rule-list');
  if (currentRules.length === 0) { container.innerHTML = `<div class="text-center py-10 text-slate-400">目前無規則，請點擊上方同步範本</div>`; return; }
  
  // 點擊整個卡片即可觸發 openEditRuleModal 進行編輯
  container.innerHTML = currentRules.map(rule => `
    <div onclick="openEditRuleModal('${rule.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 cursor-pointer active:scale-95 transition-transform">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-xs font-bold px-2 py-0.5 rounded ${rule.platform === 'foodpanda' ? 'bg-pink-100 text-panda' : 'bg-green-100 text-uber'}">${rule.platform.toUpperCase()}</span>
          <h4 class="font-bold mt-1 text-slate-800">${rule.name}</h4>
        </div>
        <button onclick="event.stopPropagation(); deleteRule('${rule.id}')" class="text-slate-300 hover:text-red-500 p-1"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
      </div>
      <div class="text-xs text-slate-500 mb-2">
        適用：${rule.activeDays.map(d => ['日','一','二','三','四','五','六'][d]).join(', ')}
      </div>
      <div class="space-y-1">
        ${rule.tiers.map(t => `<div class="flex justify-between text-xs bg-slate-50 px-2 py-1 rounded"><span class="text-slate-500">滿 ${t.t} 單</span><span class="font-bold text-slate-700">$${t.b}</span></div>`).join('')}
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function syncRuleTemplate(platform) {
  if (confirm(`確定同步 ${platform} 的範本？`)) { await db.syncTemplate(currentAccountId, platform); currentRules = await db.getRules(currentAccountId); renderRuleList(); }
}
async function deleteRule(id) {
  if (confirm('確定刪除此規則？')) { await db.deleteRule(id); currentRules = await db.getRules(currentAccountId); renderRuleList(); }
}

/* 🌟 進入單筆規則編輯畫面 🌟 */
function openEditRuleModal(ruleId) {
  const isNew = !ruleId;
  document.getElementById('edit-rule-title').innerText = isNew ? '新增自訂規則' : '編輯規則';
  document.getElementById('edit-rule-id').value = ruleId || '';
  
  // 預設值
  let rule = { platform: 'foodpanda', name: '', activeDays: [], tiers: [{t: 15, b: 50}] };
  if (!isNew) rule = currentRules.find(r => r.id === ruleId) || rule;

  document.getElementById('edit-rule-platform').value = rule.platform;
  document.getElementById('edit-rule-name').value = rule.name;
  
  // 生成星期 Checkbox
  const dayLabels = ['日','一','二','三','四','五','六'];
  document.getElementById('edit-rule-days').innerHTML = dayLabels.map((d, i) => `
    <label class="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg border cursor-pointer has-[:checked]:bg-blue-100 has-[:checked]:border-blue-400 has-[:checked]:text-blue-700 transition-colors">
      <input type="checkbox" class="day-cb hidden" value="${i}" ${rule.activeDays.includes(i) ? 'checked' : ''}>
      <span class="text-sm font-bold">${d}</span>
    </label>
  `).join('');

  // 生成階梯
  document.getElementById('edit-rule-tiers').innerHTML = '';
  rule.tiers.forEach(t => addTierRow(t.t, t.b));

  toggleModal('edit-rule-modal', true);
}
function closeEditRuleModal() { toggleModal('edit-rule-modal', false); }

// 動態增加/刪除階梯
function addTierRow(t = '', b = '') {
  const div = document.createElement('div');
  div.className = 'tier-row flex gap-2 items-center';
  div.innerHTML = `
    <div class="flex-1 flex items-center bg-slate-50 border rounded-lg px-2">
      <span class="text-xs text-slate-400 whitespace-nowrap">滿</span>
      <input type="number" class="w-full bg-transparent px-2 py-2 text-sm font-bold outline-none tier-t" placeholder="單數" value="${t}">
      <span class="text-xs text-slate-400 whitespace-nowrap">單</span>
    </div>
    <i data-lucide="arrow-right" class="w-4 h-4 text-slate-300"></i>
    <div class="flex-1 flex items-center bg-slate-50 border rounded-lg px-2">
      <span class="text-xs text-slate-400 whitespace-nowrap">$</span>
      <input type="number" class="w-full bg-transparent px-2 py-2 text-sm font-bold outline-none text-panda tier-b" placeholder="獎金" value="${b}">
    </div>
    <button onclick="this.parentElement.remove()" class="p-2 text-slate-300 hover:text-red-500"><i data-lucide="minus-circle" class="w-5 h-5"></i></button>
  `;
  document.getElementById('edit-rule-tiers').appendChild(div);
  lucide.createIcons();
}

// 儲存編輯結果
async function saveRuleForm() {
  const name = document.getElementById('edit-rule-name').value.trim();
  if (!name) return alert('請輸入規則名稱');
  
  const days = Array.from(document.querySelectorAll('.day-cb:checked')).map(cb => parseInt(cb.value));
  if (days.length === 0) return alert('請至少選擇一天適用星期');

  const tiers = [];
  document.querySelectorAll('.tier-row').forEach(row => {
    const t = parseInt(row.querySelector('.tier-t').value);
    const b = parseInt(row.querySelector('.tier-b').value);
    if (t > 0 && b > 0) tiers.push({t, b});
  });
  if (tiers.length === 0) return alert('請至少設定一組有效的獎金階梯');
  
  tiers.sort((a,b) => a.t - b.t); // 確保單數由小到大排列

  const rule = {
    id: document.getElementById('edit-rule-id').value || 'rule_' + Date.now(),
    accountId: currentAccountId,
    platform: document.getElementById('edit-rule-platform').value,
    name, activeDays: days, tiers
  };

  await db.saveRule(rule);
  currentRules = await db.getRules(currentAccountId); // 重新讀取
  closeEditRuleModal();
  renderRuleList(); // 更新清單畫面
}


/* 紀錄增刪與匯出 */
async function handleFormSubmit(e) {
  e.preventDefault();
  const record = { id: 'rec_' + Date.now(), accountId: currentAccountId, timestamp: Date.now(), platform: document.querySelector('input[name="platform"]:checked').value, date: document.getElementById('form-date').value, orders: parseInt(document.getElementById('form-orders').value), income: parseInt(document.getElementById('form-income').value), hours: parseFloat(document.getElementById('form-hours').value) };
  await db.saveRecord(record); closeModal(); loadAndRender(); e.target.reset(); updateGlobalDate();
}
async function deleteRecord(id) { if(confirm('確定要刪除嗎？')) { await db.deleteRecord(id); loadAndRender(); } }
async function clearAllData() { if(confirm('警告：清空所有資料？')) { await db.clearAllData(); location.reload(); } }
async function exportCSV() {
  if (currentData.length === 0) return alert('無資料');
  let csv = "data:text/csv;charset=utf-8,\uFEFF帳號,日期,平台,單數,收入,工時,時薪\n";
  currentData.forEach(r => { csv += `${currentAccountName},${r.date},${r.platform},${r.orders},${r.income},${r.hours},${Math.round(r.income/r.hours)}\n`; });
  const link = document.createElement("a"); link.href = encodeURI(csv); link.download = `紀錄_${currentAccountName}.csv`; link.click();
}

/* 渲染首頁進度與清單 */
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - ys) / 86400000) + 1) / 7);
}

async function renderHome() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayNum = now.getDay();
  
  const todayData = currentData.filter(d => d.date === todayStr);
  const sums = todayData.reduce((acc, d) => ({ o: acc.o+d.orders, i: acc.i+d.income, h: acc.h+d.hours }), {o:0,i:0,h:0});
  document.getElementById('home-orders').innerText = `${sums.o} 單`; document.getElementById('home-income').innerText = `NT$${sums.i}`; document.getElementById('home-hours').innerText = `${sums.h.toFixed(1)} h`; document.getElementById('home-wage').innerText = `NT$${sums.h ? Math.round(sums.i/sums.h) : 0}/時`;

  // 尋找當天適用的第一條規則來當作首頁展示 (若有多條，目前取第一條)
  const activeRule = currentRules.find(r => r.activeDays.includes(todayNum));
  const pCard = document.getElementById('fp-progress-card');
  const noCard = document.getElementById('no-rule-card');
  
  if (!activeRule) { pCard.classList.add('hidden'); noCard.classList.remove('hidden'); return; }
  pCard.classList.remove('hidden'); noCard.classList.add('hidden');

  const isFp = activeRule.platform === 'foodpanda';
  document.getElementById('progress-platform-tag').innerText = isFp ? 'Foodpanda' : 'UberEats';
  document.getElementById('progress-platform-tag').className = `absolute top-0 right-0 text-white text-xs px-3 py-1 rounded-bl-lg font-bold ${isFp ? 'bg-panda' : 'bg-uber'}`;
  document.getElementById('progress-rule-name').innerText = activeRule.name;

  const cycleOrders = currentData.filter(r => {
    const rDate = new Date(r.date);
    return r.platform === activeRule.platform && activeRule.activeDays.includes(rDate.getDay()) && getWeekNumber(rDate) === getWeekNumber(now);
  }).reduce((sum, r) => sum + r.orders, 0);

  const nextTier = activeRule.tiers.find(t => t.t > cycleOrders) || activeRule.tiers[activeRule.tiers.length-1];
  const isMax = cycleOrders >= nextTier.t;
  const progress = Math.min((cycleOrders / nextTier.t) * 100, 100);

  document.getElementById('home-fp-total').innerText = `週期累計 ${cycleOrders} 單`;
  document.getElementById('home-fp-distance').innerText = isMax ? `已達成最高級距！` : `距離下一級距還差 ${nextTier.t - cycleOrders} 單`;
  document.getElementById('home-fp-bar').style.width = `${progress}%`;
  document.getElementById('home-fp-bar').className = `h-2 rounded-full transition-all ${isFp ? 'bg-panda' : 'bg-uber'}`;
}

function renderRecords() {
  const listEl = document.getElementById('records-list'); const emptyEl = document.getElementById('empty-records');
  if (currentData.length === 0) { listEl.innerHTML = ''; emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = currentData.map(r => {
    const isFp = r.platform === 'foodpanda';
    return `<div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center"><div class="flex items-center gap-3"><div class="w-2 h-10 rounded-full ${isFp ? 'bg-panda' : 'bg-uber'}"></div><div><div class="font-bold text-sm">${r.date}</div><div class="text-xs font-bold ${isFp ? 'text-panda bg-pink-50' : 'text-uber bg-green-50'} mt-0.5 px-2 py-0.5 rounded inline-block">${isFp ? 'Foodpanda' : 'UberEats'}</div></div></div><div class="text-right"><div class="font-bold">NT$${r.income}</div><div class="text-xs text-slate-500">${r.orders}單 | ${r.hours}h | NT$${r.hours>0?Math.round(r.income/r.hours):0}/h</div></div><button onclick="deleteRecord('${r.id}')" class="ml-2 p-2 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`;
  }).join('');
  lucide.createIcons();
}

function renderStats() {
  function calc(p) { const pd = p ? currentData.filter(d => d.platform === p) : currentData; const o = pd.reduce((s,d)=>s+d.orders,0); const i = pd.reduce((s,d)=>s+d.income,0); const h = pd.reduce((s,d)=>s+d.hours,0); return { o, i, h, w: h>0?Math.round(i/h):0 }; }
  const fp = calc('foodpanda'); const ue = calc('ubereats');
  document.getElementById('platform-analysis').innerHTML = `<div class="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-panda flex justify-between items-center"><div><div class="font-bold text-panda text-lg">Foodpanda</div><div class="text-xs text-slate-500 mt-1">${fp.o} 單 | NT$${fp.i} | ${fp.h.toFixed(1)}h</div></div><div class="text-right"><div class="text-xs text-slate-400">時薪</div><div class="font-bold text-panda">NT$${fp.w}/h</div></div></div><div class="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-uber flex justify-between items-center"><div><div class="font-bold text-uber text-lg">UberEats</div><div class="text-xs text-slate-500 mt-1">${ue.o} 單 | NT$${ue.i} | ${ue.h.toFixed(1)}h</div></div><div class="text-right"><div class="text-xs text-slate-400">時薪</div><div class="font-bold text-uber">NT$${ue.w}/h</div></div></div>`;
  const ctx = document.getElementById('incomeChart'); if(!ctx) return;
  if (chartInstance) chartInstance.destroy();
  const last10 = [...currentData].slice(0, 10).reverse();
  chartInstance = new Chart(ctx.getContext('2d'), { type: 'line', data: { labels: last10.map(d => d.date.substring(5)), datasets: [{ label: '收入', data: last10.map(d => d.income), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } } });
}

function requestNotification() {
  if (!("Notification" in window)) { alert("不支援桌面通知"); return; }
  if (Notification.permission === "granted") alert("通知已啟用！"); else Notification.requestPermission().then(p => { if (p === "granted") alert("通知設定成功！"); });
}

window.addEventListener('DOMContentLoaded', initApp);
