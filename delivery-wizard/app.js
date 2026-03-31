let currentAccountId = localStorage.getItem('activeAccountId');
let currentAccountName = '預設帳號';
let currentData = [];
let chartInstance = null;

async function initApp() {
  lucide.createIcons();
  const accounts = await db.getAccounts();
  if (accounts.length === 0) {
    const defAcc = await db.addAccount('我的帳號');
    currentAccountId = defAcc.id;
    currentAccountName = defAcc.name;
    localStorage.setItem('activeAccountId', currentAccountId);
  } else {
    const active = accounts.find(a => a.id === currentAccountId) || accounts[0];
    currentAccountId = active.id;
    currentAccountName = active.name;
    localStorage.setItem('activeAccountId', currentAccountId);
  }
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
  await renderHome();
  renderRecords();
  renderStats();
}

/* Modal 控制 */
function switchTab(tabId) {
  document.querySelectorAll('.view-section').forEach(el => { el.classList.add('hidden'); el.classList.remove('block'); });
  document.getElementById(`view-${tabId}`).classList.remove('hidden');
  document.getElementById(`view-${tabId}`).classList.add('block');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('tab-active', btn.dataset.target === tabId);
    btn.classList.toggle('tab-inactive', btn.dataset.target !== tabId);
  });
  const fab = document.getElementById('fab-add');
  tabId === 'records' ? fab.classList.remove('hidden') : fab.classList.add('hidden');
}

function openModal() {
  const m = document.getElementById('add-modal');
  m.classList.remove('hidden'); m.classList.add('flex');
  void m.offsetWidth;
  m.classList.remove('opacity-0'); document.getElementById('add-modal-content').classList.remove('translate-y-full');
}
function closeModal() {
  const m = document.getElementById('add-modal');
  m.classList.add('opacity-0'); document.getElementById('add-modal-content').classList.add('translate-y-full');
  setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
}

/* 帳號切換 */
function openAccountModal() {
  const m = document.getElementById('account-modal');
  renderAccountList();
  m.classList.remove('hidden'); m.classList.add('flex');
  void m.offsetWidth;
  m.classList.remove('opacity-0');
}
function closeAccountModal() {
  const m = document.getElementById('account-modal');
  m.classList.add('opacity-0');
  setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
}
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
async function handleDeleteAccount(id) {
  if (confirm('確定刪除此帳號標籤嗎？')) { await db.deleteAccount(id); initApp(); }
}

/* 規則管理 */
function openRuleModal() {
  const m = document.getElementById('rule-modal');
  renderRuleList();
  m.classList.remove('hidden'); m.classList.add('flex');
  void m.offsetWidth;
  m.classList.remove('opacity-0');
}
function closeRuleModal() {
  const m = document.getElementById('rule-modal');
  m.classList.add('opacity-0');
  setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
  loadAndRender();
}
async function renderRuleList() {
  const rules = await db.getRules(currentAccountId);
  const container = document.getElementById('rule-list');
  if (rules.length === 0) { container.innerHTML = `<div class="text-center py-10 text-slate-400">目前無規則，請點擊上方同步範本</div>`; return; }
  container.innerHTML = rules.map(rule => `
    <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex justify-between items-start mb-3">
        <div><span class="text-xs font-bold px-2 py-0.5 rounded ${rule.platform === 'foodpanda' ? 'bg-pink-100 text-panda' : 'bg-green-100 text-uber'}">${rule.platform.toUpperCase()}</span><h4 class="font-bold mt-1">${rule.name}</h4></div>
        <button onclick="deleteRule('${rule.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
      <div class="space-y-2">
        ${rule.tiers.map(t => `<div class="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded-lg"><span class="text-slate-400 font-medium">達 ${t.t} 單</span><i data-lucide="arrow-right" class="w-3 h-3 text-slate-300"></i><span class="text-slate-700 font-bold">獎金 NT$${t.b}</span></div>`).join('')}
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}
async function syncRuleTemplate(platform) {
  if (confirm(`確定同步 ${platform} 的範本規則？`)) { await db.syncTemplate(currentAccountId, platform); renderRuleList(); }
}
async function deleteRule(id) {
  if (confirm('確定刪除此規則？')) { await db.deleteRule(id); renderRuleList(); }
}

/* 紀錄增刪與匯出 */
async function handleFormSubmit(e) {
  e.preventDefault();
  const record = {
    id: 'rec_' + Date.now(), accountId: currentAccountId, timestamp: Date.now(),
    platform: document.querySelector('input[name="platform"]:checked').value,
    date: document.getElementById('form-date').value,
    orders: parseInt(document.getElementById('form-orders').value),
    income: parseInt(document.getElementById('form-income').value),
    hours: parseFloat(document.getElementById('form-hours').value)
  };
  await db.saveRecord(record); closeModal(); loadAndRender(); e.target.reset(); updateGlobalDate();
}
async function deleteRecord(id) {
  if(confirm('確定要刪除這筆紀錄嗎？')) { await db.deleteRecord(id); loadAndRender(); }
}
async function clearAllData() {
  if(confirm('警告：將清空所有帳號、規則與紀錄，確定繼續？')) { await db.clearAllData(); location.reload(); }
}
async function exportCSV() {
  if (currentData.length === 0) return alert('無資料');
  let csv = "data:text/csv;charset=utf-8,\uFEFF帳號,日期,平台,單數,收入,工時,時薪\n";
  currentData.forEach(r => {
    const wage = Math.round(r.income / r.hours);
    csv += `${currentAccountName},${r.date},${r.platform},${r.orders},${r.income},${r.hours},${wage}\n`;
  });
  const link = document.createElement("a");
  link.href = encodeURI(csv); link.download = `外送紀錄_${currentAccountName}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

/* 渲染視圖 */
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function renderHome() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayNum = now.getDay();
  
  const todayData = currentData.filter(d => d.date === todayStr);
  const sums = todayData.reduce((acc, d) => ({ o: acc.o+d.orders, i: acc.i+d.income, h: acc.h+d.hours }), {o:0,i:0,h:0});
  document.getElementById('home-orders').innerText = `${sums.o} 單`;
  document.getElementById('home-income').innerText = `NT$${sums.i}`;
  document.getElementById('home-hours').innerText = `${sums.h.toFixed(1)} h`;
  document.getElementById('home-wage').innerText = `NT$${sums.h ? Math.round(sums.i/sums.h) : 0}/時`;

  const rules = await db.getRules(currentAccountId);
  const activeRule = rules.find(r => r.activeDays.includes(todayNum));
  const pCard = document.getElementById('fp-progress-card');
  const noCard = document.getElementById('no-rule-card');
  
  if (!activeRule) {
    pCard.classList.add('hidden'); noCard.classList.remove('hidden'); return;
  }
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
  const listEl = document.getElementById('records-list');
  const emptyEl = document.getElementById('empty-records');
  if (currentData.length === 0) { listEl.innerHTML = ''; emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = currentData.map(r => {
    const isFp = r.platform === 'foodpanda';
    const wage = r.hours > 0 ? Math.round(r.income / r.hours) : 0;
    return `
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-2 h-10 rounded-full ${isFp ? 'bg-panda' : 'bg-uber'}"></div>
          <div><div class="font-bold text-sm">${r.date}</div><div class="text-xs font-bold ${isFp ? 'text-panda bg-pink-50' : 'text-uber bg-green-50'} mt-0.5 px-2 py-0.5 rounded inline-block">${isFp ? 'Foodpanda' : 'UberEats'}</div></div>
        </div>
        <div class="text-right"><div class="font-bold">NT$${r.income}</div><div class="text-xs text-slate-500">${r.orders}單 | ${r.hours}h | NT$${wage}/h</div></div>
        <button onclick="deleteRecord('${r.id}')" class="ml-2 p-2 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function renderStats() {
  function calc(p) {
    const pd = p ? currentData.filter(d => d.platform === p) : currentData;
    const o = pd.reduce((s, d) => s + d.orders, 0);
    const i = pd.reduce((s, d) => s + d.income, 0);
    const h = pd.reduce((s, d) => s + d.hours, 0);
    return { o, i, h, w: h > 0 ? Math.round(i / h) : 0 };
  }
  const fp = calc('foodpanda'); const ue = calc('ubereats');
  document.getElementById('platform-analysis').innerHTML = `
    <div class="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-panda flex justify-between items-center">
      <div><div class="font-bold text-panda text-lg">Foodpanda</div><div class="text-xs text-slate-500 mt-1">${fp.o} 單 | NT$${fp.i} | ${fp.h.toFixed(1)}h</div></div>
      <div class="text-right"><div class="text-xs text-slate-400">時薪</div><div class="font-bold text-panda">NT$${fp.w}/h</div></div>
    </div>
    <div class="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-uber flex justify-between items-center">
      <div><div class="font-bold text-uber text-lg">UberEats</div><div class="text-xs text-slate-500 mt-1">${ue.o} 單 | NT$${ue.i} | ${ue.h.toFixed(1)}h</div></div>
      <div class="text-right"><div class="text-xs text-slate-400">時薪</div><div class="font-bold text-uber">NT$${ue.w}/h</div></div>
    </div>
  `;
  const ctx = document.getElementById('incomeChart');
  if(!ctx) return;
  if (chartInstance) chartInstance.destroy();
  const last10 = [...currentData].slice(0, 10).reverse();
  chartInstance = new Chart(ctx.getContext('2d'), {
    type: 'line', data: { labels: last10.map(d => d.date.substring(5)), datasets: [{ label: '收入', data: last10.map(d => d.income), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } }
  });
}

function requestNotification() {
  if (!("Notification" in window)) { alert("不支援桌面通知"); return; }
  if (Notification.permission === "granted") alert("通知已啟用！");
  else Notification.requestPermission().then(p => { if (p === "granted") alert("通知設定成功！"); });
}

window.addEventListener('DOMContentLoaded', initApp);
