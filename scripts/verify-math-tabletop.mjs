import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel:'chrome', headless:true });
const base = process.env.MATH_DUEL_URL || 'http://127.0.0.1:3000/math-duel/';
try {
  for (const [width,height] of [[320,568],[360,640],[390,844],[800,360],[640,320]].filter(([w])=>!process.argv[2]||w===Number(process.argv[2]))) {
    const page = await browser.newPage({viewport:{width,height}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector('#black-hand [data-card-id]');
    const measure = () => page.evaluate(() => {
      const ids=['white-area','white-operation','center-area','black-operation','black-area'];
      const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
      const zones=ids.map(id=>rect(document.getElementById(id)));
      const clipped=[];
      for(const id of ids) {
        const area=document.getElementById(id).getBoundingClientRect();
        for(const el of document.querySelectorAll(`#${id} [data-card-id],#${id} .history-card,#${id} button`)) {
          if(!el.checkVisibility()) continue;
          const r=el.getBoundingClientRect();
          if(r.top<area.top-1||r.bottom>area.bottom+1||r.left<area.left-1||r.right>area.right+1) clipped.push(`${id}:${el.dataset.cardId||el.id}`);
        }
      }
      return {zones,clipped,w:document.body.scrollWidth,h:document.body.scrollHeight,rail:rect(document.querySelector('.utility-rail'))};
    });
    const initial=await measure();
    const check=async()=>{
      const r=await measure();
      assert.deepEqual(r.clipped,[],JSON.stringify(r));
      assert.ok(r.w<=width&&r.h<=height);
      assert.deepEqual(r.zones,initial.zones,'zone geometry changed');
      for(let i=0;i<5;i++) {
        assert.ok(Math.abs(r.zones[i].y+r.zones[4-i].y+r.zones[4-i].h-height)<2,'vertical symmetry');
        assert.ok(Math.abs(r.zones[i].x*2+r.zones[i].w-width)<2,'horizontal centering');
      }
      assert.deepEqual(r.rail,initial.rail);
    };
    await check();
    // Rapid selections update before their visual flights finish.
    await page.evaluate(()=>{toggleSelect('b1','hand');toggleSelect('b5','hand');toggleSelect('w9','center');});
    assert.equal(await page.evaluate(()=>game.selections.hand.length),2);
    assert.equal(await page.evaluate(()=>game.uiBusy),false);
    await page.locator('#action-panel [data-op="+"]').click();
    await page.waitForFunction(()=>!document.getElementById('main-btn').disabled);
    await page.waitForTimeout(700);
    await check();
    await page.screenshot({path:`test-results/math-tabletop-${width}.png`});
    await page.locator('#main-btn').click();
    await page.waitForFunction(()=>game.turn==='WHITE'&&!document.body.classList.contains('is-turning'));
    await check();
    assert.equal(await page.locator('#black-operation [data-history-equation]').getAttribute('data-history-equation'),'1 + 5 = 6');
    assert.equal(await page.locator('#black-operation .history-card').count(),3);
    await page.locator('#white-hand [data-card-id="w2"]').click();
    await page.locator('#white-hand [data-card-id="w3"]').click();
    await page.locator('#center-cards [data-card-id="b5"]').click();
    await page.locator('#action-panel [data-op="+"]').click();
    await page.waitForTimeout(700);
    await check();
    await page.screenshot({path:`test-results/math-tabletop-white-${width}.png`});
    const orient=await page.evaluate(()=>({reading:[...document.querySelectorAll('.reading-content')].map(el=>getComputedStyle(el).transform),white:getComputedStyle(document.querySelector('#white-operation .operation-controls')).transform,black:getComputedStyle(document.querySelector('#black-operation .operation-controls')).transform}));
    assert.ok(orient.reading.every(t=>t==='matrix(-1, 0, 0, -1, 0, 0)'));
    assert.equal(orient.white,'matrix(-1, 0, 0, -1, 0, 0)');
    assert.equal(orient.black,'none');
    await page.locator('.settings-toggle').click();
    assert.equal(await page.locator('#table-settings').evaluate(el=>getComputedStyle(el).transform),'none');
    await page.locator('.settings-close').click();
    await page.locator('#main-btn').click();
    await page.waitForFunction(()=>game.state==='DISCARDING');
    await check();
    await page.locator('#center-cards [data-card-id="w2"]').click();
    await page.locator('#center-cards [data-card-id="w3"]').click();
    await page.locator('#main-btn').click();
    await page.waitForFunction(()=>game.turn==='BLACK'&&game.state==='PLAYING');
    await page.reload();
    await page.waitForSelector('#white-operation .history-card');
    assert.equal(await page.locator('#white-operation .history-card').count(),3);
    await check();
    // The largest possible hand still fits, as does a four-card expression with two targets.
    await page.evaluate(()=>{
      const cards=['b','w'].flatMap(color=>Array.from({length:9},(_,i)=>({id:`${color}${i+1}`,val:i+1,color})));
      game.blackHand=cards.filter(c=>c.id!=='w9');game.whiteHand=[];game.center=cards.filter(c=>c.id==='w9');
      game.selections={hand:[],center:[],operator:null};render();
    });
    await check();
    await page.evaluate(()=>{
      game.center.push(game.blackHand.find(c=>c.id==='w8'));game.blackHand=game.blackHand.filter(c=>c.id!=='w8');
      game.selections={hand:['b1','b2','b3','b4'],center:['w8','w9'],operator:'+'};render();
    });
    await check();
    assert.deepEqual(errors,[]);
    console.log(`${width}x${height}: fixed symmetric five regions, rapid input, two turns, history, discard, reload and floating settings passed`);
    await page.close();
  }
} finally {await browser.close();}
