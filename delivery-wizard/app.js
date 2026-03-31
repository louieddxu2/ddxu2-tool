/* app.js - 負責 UI 控制與業務邏輯 */
let currentAccountId = localStorage.getItem('activeAccountId');
let currentAccountName = '預設帳號';
let currentData = [];
let chartInstance = null;

// 初始化應用
async function initApp() {
  lucide.createIcons();
  const accounts = await db.getAccounts();
  
  // 若無帳號，建立一個預設的
  if (accounts.length === 0) {
    const defAcc = await db.addAccount('我的帳號');
    currentAccountId = defAcc.id;
    currentAccountName = defAcc.name;
    localStorage.setItem('activeAccountId', currentAccountId);
  } else {
    // 檢查上次選取的帳號是否存在
    const active = accounts.find(a => a.id === currentAccountId) || accounts[0];
    currentAccountId = active.id;
    currentAccountName = active.name;
    localStorage.setItem('activeAccountId', currentAccountId);
  }

  document.getElementById('current-account-name').innerText = currentAccountName;
  updateGlobalDate();
  await loadAndRender();
}

async function loadAndRender() {
  currentData = await db.getRecords(currentAccountId);
  renderHome();
  renderRecords();
  renderStats();
}

// 多帳號 UI 邏輯
function openAccountModal() {
  const modal = document.getElementById('account-modal');
  const content = document.getElementById('account-modal-content');
  renderAccountList();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('translate-y-full'); }, 10);
}

function closeAccountModal() {
  const modal = document.getElementById('account-modal');
  const content = document.getElementById('account-modal-content');
  modal.classList.add('opacity-0');
  content.classList.add('translate-y-full');
  setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

async function renderAccountList() {
  const accounts = await db.getAccounts();
  const list = document.getElementById('account-list');
  list.innerHTML = accounts.map(acc => `
    <div onclick="switchAccount('${acc.id}', '${acc.name}')" class="flex justify-between items-center p-4 rounded-xl border-2 ${acc.id === currentAccountId ? 'border-panda bg-pink-50 text-panda font-bold' : 'border-slate-100 bg-white'} active:scale-95 transition-all">
      <div class="flex items-center gap-2">
        <i data-lucide="${acc.id === currentAccountId ? 'check-circle' : 'circle'}" class="w-5 h-5"></i>
        ${acc.name}
      </div>
      ${accounts.length > 1 ? `<button onclick="event.stopPropagation(); handleDeleteAccount('${acc.id}')" class="text-slate-300 hover:text-red-500 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
    </div>
  `).join('');
  lucide.createIcons();
}

async function handleAddAccount() {
  const input = document.getElementById('new-account-name');
  if (!input.value.trim()) return;
  const newAcc = await db.addAccount(input.value.trim());
  input.value = '';
  switchAccount(newAcc.id, newAcc.name);
  closeAccountModal();
}

function switchAccount(id, name) {
  currentAccountId = id;
  currentAccountName = name;
  localStorage.setItem('activeAccountId', id);
  document.getElementById('current-account-name').innerText = name;
  loadAndRender();
  if (document.getElementById('account-modal').classList.contains('flex')) closeAccountModal();
}

async function handleDeleteAccount(id) {
  if (confirm('確定刪除此帳號標籤嗎？(歷史紀錄會保留，但將暫時無法在此帳號下看到)')) {
    await db.deleteAccount(id);
    initApp(); // 重新載入
  }
}

// 核心渲染與工具函數 (其餘邏輯同前，略作整合)
function updateGlobalDate() {
  const now = new Date();
  const days = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  document.getElementById('display-date').innerText = `今日：${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${days[now.getDay()]}`;
  document.getElementById('form-date').value = now.toISOString().split('T')[0];
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const record = {
    id: 'rec_' + Date.now(),
    accountId: currentAccountId, // 綁定當前帳號
    timestamp: Date.now(),
    platform: document.querySelector('input[name="platform"]:checked').value,
    date: document.getElementById('form-date').value,
    orders: parseInt(document.getElementById('form-orders').value),
    income: parseInt(document.getElementById('form-income').value),
    hours: parseFloat(document.getElementById('form-hours').value)
  };
  await db.saveRecord(record);
  closeModal();
  loadAndRender();
  e.target.reset();
  updateGlobalDate();
}

// CSV 匯出 (包含帳號)
async function exportCSV() {
  if (currentData.length === 0) return alert('無資料');
  let csv = "data:text/csv;charset=utf-8,\uFEFF帳號,日期,平台,單數,收入,工時,時薪\n";
  currentData.forEach(r => {
    const wage = Math.round(r.income / r.hours);
    csv += `${currentAccountName},${r.date},${r.platform},${r.orders},${r.income},${r.hours},${wage}\n`;
  });
  const link = document.createElement("a");
  link.href = encodeURI(csv);
  link.download = `外送紀錄_${currentAccountName}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// 基礎 UI 切換
function switchTab(tabId) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(`view-${tabId}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('tab-active', btn.dataset.target === tabId);
    btn.classList.toggle('tab-inactive', btn.dataset.target !== tabId);
  });
}

function openModal() {
  const m = document.getElementById('add-modal');
  m.classList.remove('hidden'); m.classList.add('flex');
  setTimeout(() => { m.classList.remove('opacity-0'); document.getElementById('add-modal-content').classList.remove('translate-y-full'); }, 10);
}

function closeModal() {
  const m = document.getElementById('add-modal');
  m.classList.add('opacity-0'); document.getElementById('add-modal-content').classList.add('translate-y-full');
  setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
}

// 其餘今日統計 (renderHome), 列表 (renderRecords), 圖表 (renderStats) 之邏輯請延續之前版本並適度調整 ID
function renderHome() {
  const today = new Date().toISOString().split('T')[0];
  const todayData = currentData.filter(d => d.date === today);
  const sums = todayData.reduce((acc, d) => ({ o: acc.o+d.orders, i: acc.i+d.income, h: acc.h+d.hours }), {o:0,i:0,h:0});
  document.getElementById('home-orders').innerText = `${sums.o} 單`;
  document.getElementById('home-income').innerText = `NT$${sums.i}`;
  document.getElementById('home-hours').innerText = `${sums.h.toFixed(1)} h`;
  document.getElementById('home-wage').innerText = `NT$${sums.h ? Math.round(sums.i/sums.h) : 0}/時`;
}

function renderRecords() { /* ...渲染列表邏輯... */ }
function renderStats() { /* ...渲染圖表邏輯... */ }

initApp();
