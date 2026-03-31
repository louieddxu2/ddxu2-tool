let currentAccountId = localStorage.getItem('activeAccountId');
let currentAccountName = '預設帳號';
let currentData = [];
let chartInstance = null;
let currentRules = [];

const RULE_TYPE_WEEKLY_DAYS = 'weekly_days';
const RULE_TYPE_WEEKLY_RANGE = 'weekly_range';
const RULE_TYPE_DATE_RANGE = 'date_range';

const DOW_ORDER_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const DOW_LABEL = { 0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
const DOW_LABEL_FULL = { 0: '星期日', 1: '星期一', 2: '星期二', 3: '星期三', 4: '星期四', 5: '星期五', 6: '星期六' };

function pad2(n) { return String(n).padStart(2, '0'); }
function toLocalDateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseLocalDateStr(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function timeToMinutes(t) {
  if (!t || typeof t !== 'string' || !t.includes(':')) return null;
  const [hh, mm] = t.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}
function getPlatformDefaultDayBoundary(platform) {
  // Uber 的官方說明/週期常見以週一 04:00 作為起點
  return platform === 'ubereats' ? '04:00' : '00:00';
}
function normalizeRule(r) {
  const platform = r.platform || 'foodpanda';
  const ruleType = r.ruleType || RULE_TYPE_WEEKLY_DAYS;
  return {
    id: r.id,
    accountId: r.accountId,
    platform,
    name: r.name || '',
    ruleType,
    tiers: Array.isArray(r.tiers) && r.tiers.length ? r.tiers : [{ t: 1, b: 0 }],

    // weekly_days
    activeDays: Array.isArray(r.activeDays) ? r.activeDays : [],
    startTime: r.startTime || '',
    endTime: r.endTime || '',
    dayBoundaryTime: r.dayBoundaryTime || getPlatformDefaultDayBoundary(platform),

    // weekly_range
    rangeStartDow: typeof r.rangeStartDow === 'number' ? r.rangeStartDow : 2,
    rangeStartTime: r.rangeStartTime || '04:00',
    rangeEndDow: typeof r.rangeEndDow === 'number' ? r.rangeEndDow : 5,
    rangeEndTime: r.rangeEndTime || '04:00',

    // date_range
    startDate: r.startDate || '',
    endDate: r.endDate || '',
    dateStartTime: r.dateStartTime || '',
    dateEndTime: r.dateEndTime || ''
  };
}
function normalizeRules(list) {
  return (Array.isArray(list) ? list : []).map(normalizeRule);
}
function getEffectiveDateTime(now, dayBoundaryTime) {
  const boundaryMins = timeToMinutes(dayBoundaryTime) ?? 0;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (nowMins >= boundaryMins) return new Date(now);
  const shifted = new Date(now);
  shifted.setDate(shifted.getDate() - 1);
  return shifted;
}
function isTimeInWindow(nowMins, startTime, endTime) {
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  if (s == null || e == null) return true;
  if (s === e) return true; // 視為全天
  if (s < e) return nowMins >= s && nowMins <= e;
  // 跨午夜（例如 22:00-02:00）
  return nowMins >= s || nowMins <= e;
}
function startOfIsoWeekLocal(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // Mon=0..Sun=6
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function getIsoWeekKeyLocal(d) {
  // 用「週一」為起點的週期 key（YYYY-Www）
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${pad2(weekNo)}`;
}
function buildLocalDateTime(dateStr, timeStr, defaultTime = '00:00') {
  const date = parseLocalDateStr(dateStr);
  if (!date) return null;
  const mins = timeToMinutes(timeStr || defaultTime) ?? 0;
  date.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return date;
}
function computeWeeklyRangeInterval(now, startDow, startTime, endDow, endTime) {
  const weekStart = startOfIsoWeekLocal(now); // 週一 00:00
  const toOffsetDays = (dow) => (dow === 0 ? 6 : dow - 1);
  const start = new Date(weekStart);
  start.setDate(start.getDate() + toOffsetDays(startDow));
  const startMins = timeToMinutes(startTime) ?? 0;
  start.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);

  const end = new Date(weekStart);
  end.setDate(end.getDate() + toOffsetDays(endDow));
  const endMins = timeToMinutes(endTime) ?? 0;
  end.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);

  if (end <= start) end.setDate(end.getDate() + 7);

  // 若 now 在 start 之前，可能屬於上一週的同一區間（例如週五04:00~週二04:00）
  if (now < start) {
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(end); prevEnd.setDate(prevEnd.getDate() - 7);
    if (now >= prevStart && now < prevEnd) return { start: prevStart, end: prevEnd };
  }
  return { start, end };
}
function isRuleActiveNow(rule, now) {
  if (rule.ruleType === RULE_TYPE_WEEKLY_DAYS) {
    const effective = getEffectiveDateTime(now, rule.dayBoundaryTime);
    const effectiveDow = effective.getDay();
    if (!rule.activeDays.includes(effectiveDow)) return false;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return isTimeInWindow(nowMins, rule.startTime, rule.endTime);
  }
  if (rule.ruleType === RULE_TYPE_WEEKLY_RANGE) {
    const interval = computeWeeklyRangeInterval(now, rule.rangeStartDow, rule.rangeStartTime, rule.rangeEndDow, rule.rangeEndTime);
    return now >= interval.start && now < interval.end;
  }
  if (rule.ruleType === RULE_TYPE_DATE_RANGE) {
    const startDate = rule.startDate;
    const endDate = rule.endDate || rule.startDate;
    const start = buildLocalDateTime(startDate, rule.dateStartTime, '00:00');
    const end = buildLocalDateTime(endDate, rule.dateEndTime, '23:59');
    if (!start || !end) return false;
    if (end < start) end.setDate(end.getDate() + 1);
    return now >= start && now <= end;
  }
  return false;
}
function formatRuleScope(rule) {
  if (rule.ruleType === RULE_TYPE_WEEKLY_DAYS) {
    const daysSorted = [...new Set(rule.activeDays)].sort((a, b) => DOW_ORDER_MON_FIRST.indexOf(a) - DOW_ORDER_MON_FIRST.indexOf(b));
    const dayText = daysSorted.map(d => DOW_LABEL[d]).join('、') || '（未選）';
    const timeText = (rule.startTime && rule.endTime) ? ` ${rule.startTime}-${rule.endTime}` : '';
    const boundaryText = rule.dayBoundaryTime && rule.dayBoundaryTime !== '00:00' ? `（日界線 ${rule.dayBoundaryTime}）` : '';
    return `每週 ${dayText}${timeText}${boundaryText}`;
  }
  if (rule.ruleType === RULE_TYPE_WEEKLY_RANGE) {
    return `每週 ${DOW_LABEL[rule.rangeStartDow]} ${rule.rangeStartTime} → ${DOW_LABEL[rule.rangeEndDow]} ${rule.rangeEndTime}`;
  }
  if (rule.ruleType === RULE_TYPE_DATE_RANGE) {
    const endDate = rule.endDate || rule.startDate;
    const dateText = rule.startDate ? `${rule.startDate}${endDate && endDate !== rule.startDate ? ` ~ ${endDate}` : ''}` : '（未選日期）';
    const timeText = (rule.dateStartTime && rule.dateEndTime) ? ` ${rule.dateStartTime}-${rule.dateEndTime}` : '';
    return `${dateText}${timeText}`;
  }
  return '';
}
function computeCycleOrders(rule, now) {
  if (!Array.isArray(currentData)) return 0;

  if (rule.ruleType === RULE_TYPE_WEEKLY_DAYS) {
    const effectiveNow = getEffectiveDateTime(now, rule.dayBoundaryTime);
    const keyNow = getIsoWeekKeyLocal(effectiveNow);
    return currentData.filter(r => {
      if (r.platform !== rule.platform) return false;
      const rDate = parseLocalDateStr(r.date);
      if (!rDate) return false;
      const key = getIsoWeekKeyLocal(rDate);
      return key === keyNow && rule.activeDays.includes(rDate.getDay());
    }).reduce((sum, r) => sum + r.orders, 0);
  }

  if (rule.ruleType === RULE_TYPE_WEEKLY_RANGE) {
    const interval = computeWeeklyRangeInterval(now, rule.rangeStartDow, rule.rangeStartTime, rule.rangeEndDow, rule.rangeEndTime);
    const startDay = new Date(interval.start.getFullYear(), interval.start.getMonth(), interval.start.getDate());
    const endDay = new Date(interval.end.getFullYear(), interval.end.getMonth(), interval.end.getDate());
    return currentData.filter(r => {
      if (r.platform !== rule.platform) return false;
      const rDate = parseLocalDateStr(r.date);
      if (!rDate) return false;
      return rDate >= startDay && rDate <= endDay;
    }).reduce((sum, r) => sum + r.orders, 0);
  }

  if (rule.ruleType === RULE_TYPE_DATE_RANGE) {
    const startDay = parseLocalDateStr(rule.startDate);
    const endDay = parseLocalDateStr(rule.endDate || rule.startDate);
    if (!startDay || !endDay) return 0;
    return currentData.filter(r => {
      if (r.platform !== rule.platform) return false;
      const rDate = parseLocalDateStr(r.date);
      if (!rDate) return false;
      return rDate >= startDay && rDate <= endDay;
    }).reduce((sum, r) => sum + r.orders, 0);
  }

  return 0;
}

function ensureRuleEditorUI() {
  const content = document.getElementById('edit-rule-modal-content');
  if (!content) return;
  if (document.getElementById('edit-rule-section-weekly-range')) return;

  content.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-bold" id="edit-rule-title">編輯規則</h3>
      <button onclick="closeEditRuleModal()" class="p-1 bg-slate-100 rounded-full"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>

    <div class="overflow-y-auto flex-grow space-y-4 pb-4">
      <input type="hidden" id="edit-rule-id">

      <div>
        <label class="text-sm font-bold block mb-1">平台</label>
        <select id="edit-rule-platform" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
          <option value="foodpanda">Foodpanda</option>
          <option value="ubereats">UberEats</option>
        </select>
      </div>

      <div>
        <label class="text-sm font-bold block mb-1">規則名稱</label>
        <input type="text" id="edit-rule-name" class="w-full bg-slate-50 border rounded-xl px-4 py-3" placeholder="例如：熊貓(一～三)、UE 24h 趟次挑戰">
      </div>

      <div>
        <label class="text-sm font-bold block mb-2">規則類型</label>
        <div class="grid grid-cols-3 gap-2">
          <label class="flex items-center justify-center gap-2 bg-slate-50 border rounded-xl px-3 py-3 cursor-pointer active:scale-95 transition-transform">
            <input type="radio" name="edit-rule-type" value="${RULE_TYPE_WEEKLY_DAYS}" class="accent-slate-800" onchange="handleRuleTypeChange()">
            <span class="text-xs font-bold">每週(選星期)</span>
          </label>
          <label class="flex items-center justify-center gap-2 bg-slate-50 border rounded-xl px-3 py-3 cursor-pointer active:scale-95 transition-transform">
            <input type="radio" name="edit-rule-type" value="${RULE_TYPE_WEEKLY_RANGE}" class="accent-slate-800" onchange="handleRuleTypeChange()">
            <span class="text-xs font-bold">每週(區間)</span>
          </label>
          <label class="flex items-center justify-center gap-2 bg-slate-50 border rounded-xl px-3 py-3 cursor-pointer active:scale-95 transition-transform">
            <input type="radio" name="edit-rule-type" value="${RULE_TYPE_DATE_RANGE}" class="accent-slate-800" onchange="handleRuleTypeChange()">
            <span class="text-xs font-bold">特定活動</span>
          </label>
        </div>
        <div class="text-xs text-slate-500 mt-2 leading-relaxed">「每週」適合常態任務；「特定活動」適合公告型加碼（有明確日期/時段）。</div>
      </div>

      <div id="edit-rule-section-weekly-days" class="space-y-3">
        <div>
          <label class="text-sm font-bold block mb-2">適用星期 (可複選)</label>
          <div class="flex gap-2 flex-wrap" id="edit-rule-days"></div>
          <div class="text-xs text-slate-500 mt-2">顯示順序採「一 → 日」。</div>
        </div>
        <div>
          <label class="text-sm font-bold block mb-2">每日有效時段 (選填)</label>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <div class="text-xs text-slate-500 mb-1">開始</div>
              <input type="time" id="edit-rule-start-time" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
            </div>
            <div>
              <div class="text-xs text-slate-500 mb-1">結束</div>
              <input type="time" id="edit-rule-end-time" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
            </div>
          </div>
          <div class="text-xs text-slate-500 mt-2">只影響「首頁何時跳出任務卡」，不會自動結算入帳。</div>
        </div>
        <details class="bg-slate-50 border rounded-xl p-3">
          <summary class="text-sm font-bold cursor-pointer select-none">進階：日界線 (跨日歸屬)</summary>
          <div class="mt-3">
            <label class="text-sm font-bold block mb-2">日界線時間</label>
            <input type="time" id="edit-rule-day-boundary" class="w-full bg-white border rounded-xl px-4 py-3 font-bold">
            <div class="text-xs text-slate-500 mt-2">例如 Uber 常見以 04:00 作為週期/跨日切換點。</div>
          </div>
        </details>
      </div>

      <div id="edit-rule-section-weekly-range" class="space-y-3 hidden">
        <div class="text-xs text-slate-500 leading-relaxed">適合「週二 04:00 ～ 週五 04:00」這種跨多天連續區間。</div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-sm font-bold block mb-1">開始星期</label>
            <select id="edit-rule-range-start-dow" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold"></select>
          </div>
          <div>
            <label class="text-sm font-bold block mb-1">開始時間</label>
            <input type="time" id="edit-rule-range-start-time" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-sm font-bold block mb-1">結束星期</label>
            <select id="edit-rule-range-end-dow" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold"></select>
          </div>
          <div>
            <label class="text-sm font-bold block mb-1">結束時間</label>
            <input type="time" id="edit-rule-range-end-time" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
          </div>
        </div>
      </div>

      <div id="edit-rule-section-date-range" class="space-y-3 hidden">
        <div>
          <label class="text-sm font-bold block mb-2">活動日期</label>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <div class="text-xs text-slate-500 mb-1">開始日期</div>
              <input type="date" id="edit-rule-start-date" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
            </div>
            <div>
              <div class="text-xs text-slate-500 mb-1">結束日期</div>
              <input type="date" id="edit-rule-end-date" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
            </div>
          </div>
          <div class="text-xs text-slate-500 mt-2">只做一天活動：結束日期可留空（系統會自動視為同一天）。</div>
        </div>
        <div>
          <label class="text-sm font-bold block mb-2">活動時段 (選填)</label>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <div class="text-xs text-slate-500 mb-1">開始</div>
              <input type="time" id="edit-rule-date-start-time" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
            </div>
            <div>
              <div class="text-xs text-slate-500 mb-1">結束</div>
              <input type="time" id="edit-rule-date-end-time" class="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold">
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="flex justify-between items-center mb-2">
          <label class="text-sm font-bold">獎金級距 (階梯)</label>
          <button onclick="addTierRow()" class="text-blue-600 bg-blue-50 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> 加一階</button>
        </div>
        <div id="edit-rule-tiers" class="space-y-2"></div>
      </div>
    </div>

    <button onclick="saveRuleForm()" class="w-full bg-panda text-white py-4 rounded-xl font-bold text-lg mt-2 shadow-md">儲存規則</button>
  `;
  lucide.createIcons();
}

function getSelectedRuleType() {
  const el = document.querySelector('input[name="edit-rule-type"]:checked');
  return el ? el.value : RULE_TYPE_WEEKLY_DAYS;
}
function handleRuleTypeChange() {
  const type = getSelectedRuleType();
  const secDays = document.getElementById('edit-rule-section-weekly-days');
  const secRange = document.getElementById('edit-rule-section-weekly-range');
  const secDate = document.getElementById('edit-rule-section-date-range');
  if (!secDays || !secRange || !secDate) return;
  secDays.classList.toggle('hidden', type !== RULE_TYPE_WEEKLY_DAYS);
  secRange.classList.toggle('hidden', type !== RULE_TYPE_WEEKLY_RANGE);
  secDate.classList.toggle('hidden', type !== RULE_TYPE_DATE_RANGE);
}

async function initApp() {
  lucide.createIcons();
  const accounts = await db.getAccounts();
  
  if (accounts.length === 0) {
    const defAcc = await db.addAccount('我的帳號');
    currentAccountId = defAcc.id; 
    currentAccountName = defAcc.name;
    // 初次使用，自動寫入雙平台規則
    await db.syncTemplate(currentAccountId, 'foodpanda');
    await db.syncTemplate(currentAccountId, 'ubereats');
  } else {
    const active = accounts.find(a => a.id === currentAccountId) || accounts[0];
    currentAccountId = active.id; 
    currentAccountName = active.name;
  }
  
  localStorage.setItem('activeAccountId', currentAccountId);
  document.getElementById('current-account-name').innerText = currentAccountName;
  ensureRuleEditorUI();
  updateGlobalDate();
  
  await loadAndRender();

  // 若帳號內無規則(防呆機制)，只補上熊貓範本
  if (currentRules.length === 0) {
    await db.syncTemplate(currentAccountId, 'foodpanda');
    currentRules = normalizeRules(await db.getRules(currentAccountId));
    renderHome();
  }
}

function updateGlobalDate() {
  const now = new Date();
  document.getElementById('display-date').innerText = `今日：${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${DOW_LABEL_FULL[now.getDay()]}`;
  document.getElementById('form-date').value = toLocalDateStr(now);
}

async function loadAndRender() {
  currentData = await db.getRecords(currentAccountId);
  currentRules = normalizeRules(await db.getRules(currentAccountId));
  await renderHome();
  renderRecords();
  renderStats();
}

/* Modal UI 狀態切換 */
function switchTab(tabId) {
  document.querySelectorAll('.view-section').forEach(el => { el.classList.add('hidden'); el.classList.remove('block'); });
  document.getElementById(`view-${tabId}`).classList.remove('hidden'); 
  document.getElementById(`view-${tabId}`).classList.add('block');
  
  document.querySelectorAll('.nav-btn').forEach(btn => { 
    btn.classList.toggle('tab-active', btn.dataset.target === tabId); 
    btn.classList.toggle('tab-inactive', btn.dataset.target !== tabId); 
  });
  
  const fab = document.getElementById('fab-add');
  if (fab) {
    if (tabId === 'records') fab.classList.remove('hidden');
    else fab.classList.add('hidden');
  }
}

function toggleModal(id, show) {
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
}

const openModal = () => toggleModal('add-modal', true);
const closeModal = () => toggleModal('add-modal', false);
const openAccountModal = () => { renderAccountList(); toggleModal('account-modal', true); };
const closeAccountModal = () => toggleModal('account-modal', false);
const openRuleModal = () => { renderRuleList(); toggleModal('rule-modal', true); };
const closeRuleModal = () => { toggleModal('rule-modal', false); loadAndRender(); };
const closeEditRuleModal = () => toggleModal('edit-rule-modal', false);

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
async function handleDeleteAccount(id) {
  if (confirm('確定刪除此帳號標籤嗎？')) { await db.deleteAccount(id); initApp(); }
}

/* 規則邏輯 */
function renderRuleList() {
  const container = document.getElementById('rule-list');
  if (currentRules.length === 0) { 
    container.innerHTML = `<div class="text-center py-10 text-slate-400">目前無規則，請點擊上方同步範本</div>`; 
    return; 
  }
  
  container.innerHTML = currentRules.map(rule => `
    <div onclick="openEditRuleModal('${rule.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 cursor-pointer active:scale-95 transition-transform">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-xs font-bold px-2 py-0.5 rounded ${rule.platform === 'foodpanda' ? 'bg-pink-100 text-panda' : 'bg-green-100 text-uber'}">${rule.platform.toUpperCase()}</span>
          <h4 class="font-bold mt-1 text-slate-800">${rule.name}</h4>
        </div>
        <button onclick="event.stopPropagation(); deleteRule('${rule.id}')" class="text-slate-300 hover:text-red-500 p-1"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
      </div>
      <div class="text-xs text-slate-500 mb-2">適用：${formatRuleScope(rule)}</div>
      <div class="space-y-1">
        ${rule.tiers.map(t => `<div class="flex justify-between items-center text-xs bg-slate-50 px-2 py-1 rounded"><span class="text-slate-500">滿 <span class="font-bold text-slate-700">${t.t}</span> 單</span><span class="font-bold text-slate-700">$${t.b}</span></div>`).join('')}
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function syncRuleTemplate(platform) {
  if (confirm(`確定同步 ${platform} 的範本？`)) { 
    await db.syncTemplate(currentAccountId, platform); 
    currentRules = normalizeRules(await db.getRules(currentAccountId)); 
    renderRuleList(); 
  }
}

async function deleteRule(id) {
  if (confirm('確定刪除此規則？')) { 
    await db.deleteRule(id); 
    currentRules = normalizeRules(await db.getRules(currentAccountId)); 
    renderRuleList(); 
  }
}

/* 進入編輯規則 */
function openEditRuleModal(ruleId) {
  ensureRuleEditorUI();
  const isNew = !ruleId;
  document.getElementById('edit-rule-title').innerText = isNew ? '新增自訂規則' : '編輯規則';
  document.getElementById('edit-rule-id').value = ruleId || '';

  let rule = normalizeRule({ platform: 'foodpanda', name: '', ruleType: RULE_TYPE_WEEKLY_DAYS, activeDays: [], tiers: [{ t: 15, b: 75 }] });
  if (!isNew) rule = normalizeRule(currentRules.find(r => r.id === ruleId) || rule);

  document.getElementById('edit-rule-platform').value = rule.platform;
  document.getElementById('edit-rule-name').value = rule.name;

  // 規則類型
  const typeEl = document.querySelector(`input[name="edit-rule-type"][value="${rule.ruleType}"]`);
  if (typeEl) typeEl.checked = true;
  else document.querySelector(`input[name="edit-rule-type"][value="${RULE_TYPE_WEEKLY_DAYS}"]`)?.click();
  handleRuleTypeChange();

  // 每週(選星期)：星期顯示順序一→日，但 value 仍用 JS getDay 的 0-6
  const dayOptions = DOW_ORDER_MON_FIRST.map(dow => ({ value: dow, label: DOW_LABEL[dow] }));
  const dayContainer = document.getElementById('edit-rule-days');
  if (dayContainer) {
    dayContainer.innerHTML = dayOptions.map(opt => `
      <label class="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg border cursor-pointer has-[:checked]:bg-blue-100 has-[:checked]:border-blue-400">
        <input type="checkbox" class="day-cb hidden" value="${opt.value}" ${rule.activeDays.includes(opt.value) ? 'checked' : ''}>
        <span class="text-sm font-bold">${opt.label}</span>
      </label>
    `).join('');
  }

  // 每週(選星期)：時段 + 日界線
  document.getElementById('edit-rule-start-time').value = rule.startTime || '';
  document.getElementById('edit-rule-end-time').value = rule.endTime || '';
  document.getElementById('edit-rule-day-boundary').value = rule.dayBoundaryTime || getPlatformDefaultDayBoundary(rule.platform);

  // 每週(區間)：選單 + 時間
  const dowSelectOptions = DOW_ORDER_MON_FIRST.map(dow => `<option value="${dow}">${DOW_LABEL[dow]}</option>`).join('');
  document.getElementById('edit-rule-range-start-dow').innerHTML = dowSelectOptions;
  document.getElementById('edit-rule-range-end-dow').innerHTML = dowSelectOptions;
  document.getElementById('edit-rule-range-start-dow').value = String(rule.rangeStartDow);
  document.getElementById('edit-rule-range-end-dow').value = String(rule.rangeEndDow);
  document.getElementById('edit-rule-range-start-time').value = rule.rangeStartTime || '04:00';
  document.getElementById('edit-rule-range-end-time').value = rule.rangeEndTime || '04:00';

  // 特定活動：日期 + 時段
  document.getElementById('edit-rule-start-date').value = rule.startDate || '';
  document.getElementById('edit-rule-end-date').value = rule.endDate || '';
  document.getElementById('edit-rule-date-start-time').value = rule.dateStartTime || '';
  document.getElementById('edit-rule-date-end-time').value = rule.dateEndTime || '';

  // 階梯
  document.getElementById('edit-rule-tiers').innerHTML = '';
  rule.tiers.forEach(t => addTierRow(t.t, t.b));

  toggleModal('edit-rule-modal', true);
  lucide.createIcons();
}

function addTierRow(t = '', b = '') {
  const div = document.createElement('div');
  div.className = 'tier-row flex gap-2 items-center';
  div.innerHTML = `
    <div class="flex-1 flex items-center bg-slate-50 border rounded-lg px-2"><span class="text-xs text-slate-400">滿</span><input type="number" class="w-full bg-transparent px-2 py-2 text-sm font-bold tier-t outline-none" placeholder="單數" value="${t}"></div>
    <i data-lucide="arrow-right" class="w-4 h-4 text-slate-300"></i>
    <div class="flex-1 flex items-center bg-slate-50 border rounded-lg px-2"><span class="text-xs text-slate-400">$</span><input type="number" class="w-full bg-transparent px-2 py-2 text-sm font-bold tier-b outline-none text-panda" placeholder="獎金" value="${b}"></div>
    <button onclick="this.parentElement.remove()" class="p-2 text-slate-300 hover:text-red-500"><i data-lucide="minus-circle" class="w-5 h-5"></i></button>
  `;
  document.getElementById('edit-rule-tiers').appendChild(div);
  lucide.createIcons();
}

async function saveRuleForm() {
  const name = document.getElementById('edit-rule-name').value.trim();
  const platform = document.getElementById('edit-rule-platform').value;
  const ruleType = getSelectedRuleType();
  const days = Array.from(document.querySelectorAll('.day-cb:checked')).map(cb => parseInt(cb.value));
  const tiers = Array.from(document.querySelectorAll('.tier-row')).map(row => ({
    t: parseInt(row.querySelector('.tier-t').value),
    b: parseInt(row.querySelector('.tier-b').value)
  })).filter(t => t.t > 0);

  if (!name || tiers.length === 0) return alert('請填寫完整名稱與獎金階梯');
  tiers.sort((a,b) => a.t - b.t);

  // 依規則類型驗證欄位
  let startTime = '';
  let endTime = '';
  let dayBoundaryTime = '';
  let rangeStartDow = 2;
  let rangeStartTime = '04:00';
  let rangeEndDow = 5;
  let rangeEndTime = '04:00';
  let startDate = '';
  let endDate = '';
  let dateStartTime = '';
  let dateEndTime = '';

  if (ruleType === RULE_TYPE_WEEKLY_DAYS) {
    if (days.length === 0) return alert('請至少選擇一個星期');
    startTime = document.getElementById('edit-rule-start-time').value.trim();
    endTime = document.getElementById('edit-rule-end-time').value.trim();
    if ((startTime && !endTime) || (!startTime && endTime)) return alert('每日有效時段請同時填寫開始與結束（或全部留空）');
    dayBoundaryTime = (document.getElementById('edit-rule-day-boundary').value || '').trim() || getPlatformDefaultDayBoundary(platform);
  } else if (ruleType === RULE_TYPE_WEEKLY_RANGE) {
    rangeStartDow = parseInt(document.getElementById('edit-rule-range-start-dow').value);
    rangeEndDow = parseInt(document.getElementById('edit-rule-range-end-dow').value);
    rangeStartTime = (document.getElementById('edit-rule-range-start-time').value || '').trim() || '04:00';
    rangeEndTime = (document.getElementById('edit-rule-range-end-time').value || '').trim() || '04:00';
    if (Number.isNaN(rangeStartDow) || Number.isNaN(rangeEndDow)) return alert('請選擇區間的開始/結束星期');
  } else if (ruleType === RULE_TYPE_DATE_RANGE) {
    startDate = (document.getElementById('edit-rule-start-date').value || '').trim();
    endDate = (document.getElementById('edit-rule-end-date').value || '').trim();
    if (!startDate) return alert('請選擇活動開始日期');
    if (!endDate) endDate = startDate;
    dateStartTime = (document.getElementById('edit-rule-date-start-time').value || '').trim();
    dateEndTime = (document.getElementById('edit-rule-date-end-time').value || '').trim();
    if ((dateStartTime && !dateEndTime) || (!dateStartTime && dateEndTime)) return alert('活動時段請同時填寫開始與結束（或全部留空）');
  }

  const rule = {
    id: document.getElementById('edit-rule-id').value || 'rule_' + Date.now(),
    accountId: currentAccountId,
    platform,
    name,
    ruleType,
    tiers,

    // weekly_days
    activeDays: ruleType === RULE_TYPE_WEEKLY_DAYS ? days : [],
    startTime: ruleType === RULE_TYPE_WEEKLY_DAYS ? startTime : '',
    endTime: ruleType === RULE_TYPE_WEEKLY_DAYS ? endTime : '',
    dayBoundaryTime: ruleType === RULE_TYPE_WEEKLY_DAYS ? dayBoundaryTime : '',

    // weekly_range
    rangeStartDow: ruleType === RULE_TYPE_WEEKLY_RANGE ? rangeStartDow : undefined,
    rangeStartTime: ruleType === RULE_TYPE_WEEKLY_RANGE ? rangeStartTime : undefined,
    rangeEndDow: ruleType === RULE_TYPE_WEEKLY_RANGE ? rangeEndDow : undefined,
    rangeEndTime: ruleType === RULE_TYPE_WEEKLY_RANGE ? rangeEndTime : undefined,

    // date_range
    startDate: ruleType === RULE_TYPE_DATE_RANGE ? startDate : '',
    endDate: ruleType === RULE_TYPE_DATE_RANGE ? endDate : '',
    dateStartTime: ruleType === RULE_TYPE_DATE_RANGE ? dateStartTime : '',
    dateEndTime: ruleType === RULE_TYPE_DATE_RANGE ? dateEndTime : ''
  };

  await db.saveRule(rule);
  currentRules = normalizeRules(await db.getRules(currentAccountId));
  closeEditRuleModal();
  renderRuleList();
}

/* 紀錄與統計 */
async function handleFormSubmit(e) {
  e.preventDefault();
  const record = { id: 'rec_' + Date.now(), accountId: currentAccountId, timestamp: Date.now(), platform: document.querySelector('input[name="platform"]:checked').value, date: document.getElementById('form-date').value, orders: parseInt(document.getElementById('form-orders').value), income: parseInt(document.getElementById('form-income').value), hours: parseFloat(document.getElementById('form-hours').value) };
  await db.saveRecord(record); closeModal(); loadAndRender(); e.target.reset(); updateGlobalDate();
}
async function deleteRecord(id) { if(confirm('確定要刪除這筆紀錄嗎？')) { await db.deleteRecord(id); loadAndRender(); } }
async function clearAllData() { if(confirm('警告：清空所有資料且無法恢復？')) { await db.clearAllData(); location.reload(); } }
async function exportCSV() {
  if (currentData.length === 0) return alert('無資料');
  let csv = "data:text/csv;charset=utf-8,\uFEFF帳號,日期,平台,單數,收入,工時,時薪\n";
  currentData.forEach(r => { csv += `${currentAccountName},${r.date},${r.platform},${r.orders},${r.income},${r.hours},${Math.round(r.income/r.hours)}\n`; });
  const link = document.createElement("a"); link.href = encodeURI(csv); link.download = `外送紀錄_${currentAccountName}.csv`; link.click();
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - ys) / 86400000) + 1) / 7);
}

async function renderHome() {
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  
  // 1. 計算今日數據
  const todayData = currentData.filter(d => d.date === todayStr);
  const sums = todayData.reduce((acc, d) => ({ o: acc.o+d.orders, i: acc.i+d.income, h: acc.h+d.hours }), {o:0,i:0,h:0});
  document.getElementById('home-orders').innerText = `${sums.o} 單`; 
  document.getElementById('home-income').innerText = `NT$${sums.i}`; 
  document.getElementById('home-hours').innerText = `${sums.h.toFixed(1)} h`; 
  document.getElementById('home-wage').innerText = `NT$${sums.h ? Math.round(sums.i/sums.h) : 0}/時`;

  // 2. 抓取今日適用的「所有」規則 (使用 filter)
  const activeRules = currentRules.filter(r => isRuleActiveNow(r, now));
  const container = document.getElementById('progress-cards-container');
  const noCard = document.getElementById('no-rule-card');
  
  if (!container) return; // 防呆機制

  // 3. 若無規則，清空容器並顯示提示
  if (activeRules.length === 0) { 
    container.innerHTML = '';
    noCard.classList.remove('hidden'); 
    return; 
  }
  
  noCard.classList.add('hidden');

  // 4. 動態生成所有適用的進度卡片
  container.innerHTML = activeRules.map(rule => {
    const isFp = rule.platform === 'foodpanda';
    const tagColor = isFp ? 'bg-panda' : 'bg-uber';
    const bgColor = isFp ? 'bg-pink-50 text-panda' : 'bg-green-50 text-uber';
    const platformName = isFp ? 'Foodpanda' : 'UberEats';

    // 計算該條規則週期內的累積單數
    const cycleOrders = computeCycleOrders(rule, now);

    const nextTier = rule.tiers.find(t => t.t > cycleOrders) || rule.tiers[rule.tiers.length-1];
    const isMax = cycleOrders >= nextTier.t;
    const progress = Math.min((cycleOrders / nextTier.t) * 100, 100);

    return `
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div class="absolute top-0 right-0 text-white text-xs px-3 py-1 rounded-bl-lg font-bold ${tagColor}">${platformName}</div>
        <div class="flex justify-between items-end mb-2 mt-2">
          <span class="text-slate-500 text-sm font-bold">${rule.name}</span>
          <span class="${bgColor} px-2 py-1 rounded text-xs font-bold">累計 ${cycleOrders} 單</span>
        </div>
        <div class="font-bold text-slate-700 mb-2 text-sm">${isMax ? '🎉 已達成最高級距！' : `距離下一級距還差 ${nextTier.t - cycleOrders} 單`}</div>
        <div class="w-full bg-slate-100 rounded-full h-2">
          <div class="h-2 rounded-full transition-all ${tagColor}" style="width: ${progress}%"></div>
        </div>
        <div class="text-xs text-slate-400 mt-2">${formatRuleScope(rule)}</div>
      </div>
    `;
  }).join('');
}


function renderRecords() {
  const listEl = document.getElementById('records-list');
  const emptyEl = document.getElementById('empty-records');
  if (currentData.length === 0) { listEl.innerHTML = ''; emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  
  listEl.innerHTML = currentData.map(r => {
    const isFp = r.platform === 'foodpanda';
    return `
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-2 h-10 rounded-full ${isFp ? 'bg-panda' : 'bg-uber'}"></div>
          <div><div class="font-bold text-sm">${r.date}</div><div class="text-xs font-bold ${isFp ? 'text-panda bg-pink-50' : 'text-uber bg-green-50'} mt-0.5 px-2 py-0.5 rounded inline-block">${isFp ? 'Foodpanda' : 'UberEats'}</div></div>
        </div>
        <div class="text-right">
          <div class="font-bold">NT$${r.income}</div>
          <div class="text-xs text-slate-500">${r.orders}單 | ${r.hours}h | NT$${r.hours>0 ? Math.round(r.income/r.hours) : 0}/h</div>
        </div>
        <button onclick="deleteRecord('${r.id}')" class="ml-2 p-2 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function renderStats() {
  function calc(p) { const pd = p ? currentData.filter(d => d.platform === p) : currentData; const o = pd.reduce((s,d)=>s+d.orders,0); const i = pd.reduce((s,d)=>s+d.income,0); const h = pd.reduce((s,d)=>s+d.hours,0); return { o, i, h, w: h>0?Math.round(i/h):0 }; }
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
