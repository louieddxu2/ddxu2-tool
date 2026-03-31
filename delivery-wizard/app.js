/* app.js (主要邏輯) */

// 開啟與關閉管理介面
function openRuleModal() {
  const modal = document.getElementById('rule-modal');
  const content = document.getElementById('rule-modal-content');
  renderRuleList();
  modal.classList.remove('hidden'); modal.classList.add('flex');
  setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('translate-y-full'); }, 10);
}

function closeRuleModal() {
  const modal = document.getElementById('rule-modal');
  const content = document.getElementById('rule-modal-content');
  modal.classList.add('opacity-0'); content.classList.add('translate-y-full');
  setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
  loadAndRender(); // 關閉時重新整理首頁進度
}

// 渲染規則列表
async function renderRuleList() {
  const rules = await db.getRules(currentAccountId);
  const container = document.getElementById('rule-list');
  if (rules.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-slate-400">目前無規則，請點擊上方同步範本</div>`;
    return;
  }

  container.innerHTML = rules.map(rule => `
    <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex justify-between items-start mb-3">
        <div>
          <span class="text-xs font-bold px-2 py-0.5 rounded ${rule.platform === 'foodpanda' ? 'bg-pink-100 text-panda' : 'bg-green-100 text-uber'}">${rule.platform.toUpperCase()}</span>
          <h4 class="font-bold text-slate-800 mt-1">${rule.name}</h4>
        </div>
        <button onclick="deleteRule('${rule.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
      <div class="space-y-2">
        ${rule.tiers.map((t, idx) => `
          <div class="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded-lg">
            <span class="text-slate-400 font-medium">達 ${t.t} 單</span>
            <i data-lucide="arrow-right" class="w-3 h-3 text-slate-300"></i>
            <span class="text-slate-700 font-bold">獎金 NT$${t.b}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function syncTemplate(platform) {
  if (confirm(`確定同步 ${platform} 的範本規則到此帳號嗎？(會覆蓋同名規則)`)) {
    await db.syncTemplate(currentAccountId, platform);
    renderRuleList();
  }
}

async function deleteRule(id) {
  if (confirm('確定刪除此規則？')) {
    await db.deleteRule(id);
    renderRuleList();
  }
}

// 核心：首頁動態進度計算 (renderHome)
async function renderHome() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayNum = now.getDay(); // 0(日)~6(六)
  
  // 1. 抓取今日數據
  const todayData = currentData.filter(d => d.date === todayStr);
  const sums = todayData.reduce((acc, d) => ({ o: acc.o+d.orders, i: acc.i+d.income, h: acc.h+d.hours }), {o:0,i:0,h:0});
  
  document.getElementById('home-orders').innerText = `${sums.o} 單`;
  document.getElementById('home-income').innerText = `NT$${sums.i}`;
  document.getElementById('home-hours').innerText = `${sums.h.toFixed(1)} h`;
  document.getElementById('home-wage').innerText = `NT$${sums.h ? Math.round(sums.i/sums.h) : 0}/時`;

  // 2. 計算獎金進度
  const rules = await db.getRules(currentAccountId);
  const activeRule = rules.find(r => r.activeDays.includes(todayNum));
  
  const progressCard = document.getElementById('fp-progress-card');
  if (!activeRule) {
    progressCard.classList.add('hidden');
    return;
  }

  progressCard.classList.remove('hidden');
  const platformColor = activeRule.platform === 'foodpanda' ? 'bg-panda' : 'bg-uber';
  
  // 計算該週期內的總單數 (需依據 activeDays 範圍撈取紀錄，此處簡化為今日累積)
  // 進階邏輯：應計算本週內屬於該規則 activeDays 的總和
  const cycleOrders = currentData
    .filter(r => {
      const rDate = new Date(r.date);
      const isSameWeek = getWeekNumber(rDate) === getWeekNumber(now); // 需實作週數判斷
      return r.platform === activeRule.platform && activeRule.activeDays.includes(rDate.getDay()) && isSameWeek;
    })
    .reduce((sum, r) => sum + r.orders, 0);

  const nextTier = activeRule.tiers.find(t => t.t > cycleOrders) || activeRule.tiers[activeRule.tiers.length-1];
  const isMax = cycleOrders >= nextTier.t;
  const progress = Math.min((cycleOrders / nextTier.t) * 100, 100);

  document.getElementById('home-fp-total').innerText = `週期累計 ${cycleOrders} 單`;
  document.getElementById('home-fp-distance').innerText = isMax ? `已達成最高級距！` : `距離下一獎勵還差 ${nextTier.t - cycleOrders} 單`;
  const bar = document.getElementById('home-fp-bar');
  bar.style.width = `${progress}%`;
  bar.className = `h-2 rounded-full transition-all ${platformColor}`;
}

// 輔助：取得週數
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
