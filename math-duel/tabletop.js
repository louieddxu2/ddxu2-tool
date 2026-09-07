/* Five fixed regions. Reading direction is independent of seat direction. */
function initializeTabletop() {
  const board = document.getElementById('game-board');
  const template = document.getElementById('play-area').cloneNode(true);
  const center = document.getElementById('center-area');
  const content = document.createElement('div');
  content.className = 'center-content reading-content';
  while (center.firstChild) content.append(center.firstChild);
  content.append(document.getElementById('game-meta'));
  center.replaceChildren(content);
  board.append(center);
  for (const side of ['white', 'black']) {
    const zone = document.createElement('section');
    zone.id = `${side}-operation`;
    zone.className = `operation-zone ${side}-operation`;
    zone.dataset.side = side.toUpperCase();
    const play = template.cloneNode(true);
    play.className = 'player-workspace';
    const equation = document.createElement('div');
    equation.className = 'equation-view reading-content';
    equation.append(play.querySelector('.play-stage-grid'), play.querySelector('#move-preview'));
    play.prepend(equation);
    play.querySelectorAll('[id]').forEach(el => { el.dataset.ui = el.id; el.id = `${side}-${el.id}`; });
    play.dataset.ui = 'play-area'; play.id = `${side}-play-area`;
    zone.append(play); board.append(zone);
    const info = document.createElement('span');
    info.className = 'seat-info'; info.id = `${side}-info`;
    document.getElementById(`${side}-area`).firstElementChild.append(info);
  }
  document.getElementById('table-area').remove();
}

function syncTabletop(state) {
  document.body.classList.toggle('solo-white', state.mode !== 'PVP' && state.aiSide === 'BLACK');
  for (const zone of document.querySelectorAll('.operation-zone')) {
    const active = zone.dataset.side === state.turn;
    zone.classList.toggle('is-active', active);
    zone.querySelectorAll('[data-ui]').forEach(el => {
      el.id = active ? el.dataset.ui : `${zone.dataset.side.toLowerCase()}-${el.dataset.ui}`;
    });
    zone.querySelectorAll('button').forEach(button => { button.disabled = !active; });
  }
}

function renderPlayerTabletop(state) {
  const selected = state.selections.hand.length || state.selections.center.length || state.selections.operator;
  for (const zone of document.querySelectorAll('.operation-zone')) {
    const side = zone.dataset.side;
    const active = side === state.turn;
    const move = state.playerMoves?.[side] || (state.lastMove?.turn === side ? state.lastMove : null);
    const showHistory = move && (!active || (!selected && state.state !== 'ANIMATING'));
    zone.querySelector('.equation-view').classList.toggle('is-history', Boolean(showHistory));
    const grid = zone.querySelector('.play-stage-grid');
    const hand = zone.querySelector('[data-ui="stage-hand-cards"]');
    const target = zone.querySelector('[data-ui="stage-center-cards"]');
    const symbol = zone.querySelector('[data-ui="stage-operator-symbol"]');
    if (showHistory) {
      const w = move.witness;
      const operand = (cards, digits) => `<span class="operand-group">${cards.map((card, i) =>
        `<span class="history-card ${card.color === 'b' ? 'history-black' : 'history-white'}" data-history-card-id="${escapeHtml(card.id)}">${escapeHtml(digits?.[i] ?? card.val)}</span>`).join('')}</span>`;
      hand.innerHTML = `${operand(w?.left?.cards || move.cardsA || [], w?.left?.digits)}<span class="operand-divider">${escapeHtml(w?.operator || move.op)}</span>${operand(w?.right?.cards || move.cardsB || [], w?.right?.digits)}`;
      target.innerHTML = operand(w?.target?.cards || move.centerCards || [], w?.target?.digits);
      symbol.textContent = '=';
      grid.setAttribute('aria-label', `${side === 'BLACK' ? '黑方' : '白方'}：${move.eq}`);
      grid.dataset.historyEquation = move.eq;
    } else {
      grid.removeAttribute('aria-label'); delete grid.dataset.historyEquation;
      if (!active) { hand.replaceChildren(); target.replaceChildren(); symbol.textContent = '='; }
    }
    if (!active) {
      zone.querySelector('[data-ui="move-preview"]').replaceChildren();
      zone.querySelectorAll('.op-btn').forEach(button => { button.className = 'op-btn'; button.disabled = true; });
      zone.querySelector('[data-ui="operator-group"]').className = 'operator-group';
      const main = zone.querySelector('[data-ui="main-btn"]');
      main.className = 'seat-main'; main.textContent = t('send_eq');
      const giveup = zone.querySelector('[data-ui="giveup-btn"]');
      giveup.className = 'seat-giveup'; giveup.textContent = isRace2Mode() ? (LANG === 'zh' ? '無法湊出' : 'No move') : t('give_up');
      for (const key of ['pass-btn', 'plan-continue-btn']) zone.querySelector(`[data-ui="${key}"]`).className = 'hidden';
    }
    const seat = side.toLowerCase();
    const score = isRace2Mode() ? ` · ${state.scores[side]}/2` : '';
    document.getElementById(`${seat}-info`).textContent = `${state[`${seat}Hand`].length}${score}`;
    document.getElementById(`${seat}-area`).classList.toggle('seat-active', active);
  }
}
