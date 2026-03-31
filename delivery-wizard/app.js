/* app.js */
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
    currentAccountId = defAcc.id; 
    currentAccountName = defAcc.name;
    // 初次使用，自動寫入規則
    await db.syncTemplate(currentAccountId, 'foodpanda');
    await db.syncTemplate(currentAccountId, 'ubereats');
  } else {
    const active = accounts.find(a => a.id === currentAccountId) || accounts[0];
    currentAccountId = active.id; 
    currentAccountName = active.name;
  }
  
  localStorage.setItem('activeAccountId', currentAccountId);
  document.getElementById('current-account-name').innerText = currentAccountName;
  updateGlobalDate();
  
  await loadAndRender();

  // 如果帳號內沒規則，強制同步一次範本 (解決你提到的沒規則問題)
  if (currentRules.length === 0) {
    await db.syncTemplate(currentAccountId, 'foodpanda');
    currentRules = await db.getRules(currentAccountId);
    renderHome();
  }
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

/* Modal 控制 (加上 try-catch 保護) */
function toggleModal(id, show) {
  try {
    const m = document.getElementById(id);
    const c = document.getElementById(`${id}-content`);
    if (!m) return;
    if (show) {
      m.classList.remove('hidden'); m.classList.add('flex'); void m.offsetWidth;
      m.classList.remove('opacity-0'); if(c) c.classList.remove('translate-y-full');
    } else {
      m.classList.add('opacity-0'); if(c) c.classList.add('translate-y-full');
      setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
    }
  } catch (e) { console.error("Toggle Modal Error:", e); }
}

const openModal = () => toggleModal('add-modal', true);
const closeModal = () => toggleModal('add-modal', false);
const openAccountModal = () => { renderAccountList(); toggleModal('account-modal', true); };
const closeAccountModal = () => toggleModal('account-modal', false);
const openRuleModal = () => { renderRuleList(); toggleModal('rule-modal', true); };
const closeRuleModal = () => { toggleModal('rule-modal', false); loadAndRender(); };
const closeEditRuleModal = () => toggleModal('edit-rule-modal', false);

/* 帳號切換 */
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
async function handleDeleteAccount(id) { if (confirm('確定刪除此帳號嗎？')) { await db.deleteAccount(id); initApp(); } }

/* 規則邏輯 */
function renderRuleList() {
  const container = document.getElementById('rule-list');
  if (currentRules.length === 0) { container.innerHTML = `<div class="text-center py-10 text-slate-400">目前無規則，請同步範本</div>`; return; }
  container.innerHTML = currentRules.map(rule => `
    <div onclick="openEditRuleModal('${rule.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 cursor-pointer active:scale-95 transition-transform">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-xs font-bold px-2 py-0.5 rounded ${rule.platform === 'foodpanda' ? 'bg-pink-100 text-panda' : 'bg-green-100 text-uber'}">${rule.platform.toUpperCase()}</span>
          <h4 class="font-bold mt-1 text-slate-800">${rule.name}</h4>
        </div>
        <button onclick="event.stopPropagation(); deleteRule('${rule.id}')" class="text-slate-300 hover:text-red-500 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
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
async function deleteRule(id) { if (confirm('確定刪除規則？')) { await db.deleteRule(id); currentRules = await db.getRules(currentAccountId); renderRuleList(); } }

/* 規則編輯 */
function openEditRuleModal(ruleId) {
  const isNew = !ruleId;
  document.getElementById('edit-rule-title').innerText = isNew ? '新增規則' : '編輯規則';
  document.getElementById('edit-rule-id').value = ruleId || '';
  
  let rule = currentRules.find(r => r.id === ruleId) || { platform: 'foodpanda', name: '', activeDays: [], tiers: [{t: 15, b: 75}] };

  document.getElementById('edit-rule-platform').value = rule.platform;
  document.getElementById('edit-rule-name').value = rule.name;
  
  const dayLabels = ['日','一','二','三','四','五','六'];
  document.getElementById('edit-rule-days').innerHTML = dayLabels.map((d, i) => `
    <label class="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg border cursor-pointer has-[:checked]:bg-blue-100 has-[:checked]:border-blue-400">
      <input type="checkbox" class="day-cb hidden" value="${i}" ${rule.activeDays.includes(i) ? 'checked' : ''}>
      <span class="text-sm font-bold">${d}</span>
    </label>
  `).join('');

  document.getElementById('edit-rule-tiers').innerHTML = '';
  rule.tiers.forEach(t => addTierRow(t.t, t.b));
  toggleModal('edit-rule-modal', true);
}

function addTierRow(t = '', b = '') {
  const div = document.createElement('div');
  div.className = 'tier-row flex gap-2 items-center';
  div.innerHTML = `
    <div class="flex-1 flex items-center bg-slate-50 border rounded-lg px-2"><input type="number" class="w-full bg-transparent py-2 text-sm font-bold tier-t" placeholder="單數" value="${t}"></div>
    <i data-lucide="arrow-right" class="w-4 h-4 text-slate-300"></i>
    <div class="flex-1 flex items-center bg-slate-50 border rounded-lg px-2"><input type="number" class="w-full bg-transparent py-2 text-sm font-bold tier-b" placeholder="獎金" value="${b}"></div>
    <button onclick="this.parentElement.remove()" class="p-2 text-slate-300"><i data-lucide="minus-circle" class="w-5 h-5"></i></button>
  `;
  document.getElementById('edit-rule-tiers').appendChild(div);
  lucide.createIcons();
}

async function saveRuleForm() {
  const name = document.getElementById('edit-rule-name').value.trim();
  const days = Array.from(document.querySelectorAll('.day-cb:checked')).map(cb => parseInt(cb.value));
  const tiers = Array.from(document.querySelectorAll('.tier-row')).map(row => ({
    t: parseInt(row.querySelector('.tier-t').value),
    b: parseInt(row.querySelector('.tier-b').value)
  })).filter(t => t.t > 0);

  if (!name || days.length === 0 || tiers.length === 0) return alert('請填寫完整');

  const rule = {
    id: document.getElementById('edit-rule-id').value || 'rule_' + Date.now(),
    accountId: currentAccountId,
    platform: document.getElementById('edit-rule-platform').value,
    name, activeDays: days, tiers
  };

  await db.saveRule(rule);
  currentRules = await db.getRules(currentAccountId);
  closeEditRuleModal();
  renderRuleList();
}

/* 其餘統計與繪圖 (不變) */
async function handleFormSubmit(e) {
  e.preventDefault();
  const record = { id: 'rec_' + Date.now(), accountId: currentAccountId, timestamp: Date.now(), platform: document.querySelector('input[name="platform"]:checked').value, date: document.getElementById('form-date').value, orders: parseInt(document.getElementById('form-orders').value), income: parseInt(document.getElementById('form-income').value), hours: parseFloat(document.getElementById('form-hours').value) };
  await db.saveRecord(record); closeModal(); loadAndRender(); e.target.reset(); updateGlobalDate();
}
async function deleteRecord(id) { if(confirm('確定刪除？')) { await db.deleteRecord(id); loadAndRender(); } }
async function clearAllData() { if(confirm('警告：清空所有資料？')) { await db.clearAllData(); location.reload(); } }
async function exportCSV() {
  if (currentData.length === 0) return alert('無資料');
  let csv = "data:text/csv;charset=utf-8,\uFEFF帳號,日期,平台,單數,收入,工時,時薪\n";
  currentData.forEach(r => { csv += `${currentAccountName},${r.date},${r.platform},${r.orders},${r.income},${r.hours},${Math.round(r.income/r.hours)}\n`; });
  const link = document.createElement("a"); link.href = encodeURI(csv); link.download = `紀錄_${currentAccountName}.csv`; link.click();
}

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
  document.getElementById('home-fp-distance').innerText = isMax ? `達成最高級距！` : `距離下一級距還差 ${nextTier.t - cycleOrders} 單`;
  document.getElementById('home-fp-bar').style.width = `${progress}%`;
  document.getElementById('home-fp-bar').className = `h-2 rounded-full transition-all ${isFp ? 'bg-panda' : 'bg-uber'}`;
}

function renderRecords() {
  const listEl = document.getElementById('records-list');
  if (currentData.length === 0) { listEl.innerHTML = ''; return; }
  listEl.innerHTML = currentData.map(r => `<div class="bg-white p-4 rounded-xl border flex justify-between items-center mb-2"><div><div class="font-bold text-sm">${r.date}</div><div class="text-xs font-bold ${r.platform==='foodpanda'?'text-panda':'text-uber'}">${r.platform.toUpperCase()}</div></div><div class="text-right"><div class="font-bold">NT$${r.income}</div><div class="text-xs text-slate-500">${r.orders}單 | ${r.hours}h</div></div><button onclick="deleteRecord('${r.id}')" class="ml-2 text-slate-300"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`).join('');
  lucide.createIcons();
}

function renderStats() {
  const ctx = document.getElementById('incomeChart'); if(!ctx) return;
  if (chartInstance) chartInstance.destroy();
  const last10 = [...currentData].slice(0, 10).reverse();
  chartInstance = new Chart(ctx.getContext('2d'), { type: 'line', data: { labels: last10.map(d => d.date.substring(5)), datasets: [{ label: '收入', data: last10.map(d => d.income), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } } });
}

window.addEventListener('DOMContentLoaded', initApp);
