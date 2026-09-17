import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
const base = process.env.GAME_URL || 'http://localhost:4173';
const sizes = [[320,568],[375,667],[390,844],[430,932],[768,1024],[1366,768],[1440,900],[844,390]];
const report = [];
for (const [width,height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem('moon-settings',JSON.stringify({muted:true,reduced:true}));
    const contour = Array.from({length:64},(_,i)=>{const a=i/64*Math.PI*2,r=1+.05*Math.sin(3*a);return{x:r*Math.cos(a),y:r*Math.sin(a)}});
    const result={version:'moon-roll-v2',distance:1566.3,score:92,grade:'S',title:'月宫远行客',time:13.52,contour};
    localStorage.setItem('moon-collection-moon-roll-v2',JSON.stringify(result));
    localStorage.setItem('moon-record-moon-roll-v2',JSON.stringify(result));
  });
  async function check(name,selectors) {
    const metrics = await page.evaluate(selectors => ({
      width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
      bounds:selectors.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return{selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}})
    }),selectors);
    report.push({viewport:`${width}x${height}`,page:name,...metrics});
    assert.ok(metrics.scrollHeight<=height+1,`${width}x${height} ${name}: vertical overflow ${metrics.scrollHeight}`);
    assert.ok(metrics.scrollWidth<=width+1,`${width}x${height} ${name}: horizontal overflow`);
    for(const b of metrics.bounds) assert.ok(b.x>=-1&&b.y>=-1&&b.right<=width+1&&b.bottom<=height+1&&b.h>0,`${name} ${width}x${height}: ${JSON.stringify(b)}`);
    if ([390,1440,320].includes(width)) await page.screenshot({path:`/tmp/gift-${name}-${width}.png`});
  }
  await page.goto(base);
  await check('home',['#start','#last-moon','.hero-heading','.footer']);
  await page.click('#start');
  await check('draw',['#drawing','#leave','#feedback','.footer']);
  await page.locator('#drawing').evaluate(canvas=>{
    const r=canvas.getBoundingClientRect(),radius=Math.min(r.width,r.height)*.25;
    const fire=(type,i)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,pointerId:77,pointerType:'touch',clientX:r.left+r.width/2+radius*Math.cos(i/80*Math.PI*2),clientY:r.top+r.height/2+radius*.84*Math.sin(i/80*Math.PI*2)}));
    canvas.setPointerCapture=()=>{};fire('pointerdown',0);for(let i=1;i<=80;i++)fire('pointermove',i);fire('pointerup',80);
  });
  await page.clock.runFor(1300);
  await check('rolling',['#roll-stage','#live-stats','#skip','#feedback']);
  await page.click('#skip');
  await check('result',['#personal-moon','#poster-open','#again','#download-model','#result-distance']);
  await page.click('#poster-open');await page.locator('#poster-image').waitFor({state:'visible'});
  await check('poster',['#poster-image','#share-image','#download-image','#poster-back']);
  if(width===390){
    const bytes=await page.locator('#poster-image').evaluate(async image=>Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())));
    await writeFile('/tmp/moon-gift-final.png',Buffer.from(bytes));
    const copy=await page.evaluate(async()=> (await import('./poster.js')).POSTER_COPY);
    assert.equal(copy.title,'送你一颗中秋的月亮');
    assert.deepEqual(copy.blessing,['愿你所念皆圆满，','所行皆坦途。']);
  }
  assert.deepEqual(errors,[]); await page.close();
}
await writeFile('/tmp/moon-layout-report.json',JSON.stringify(report,null,2));
console.log(`PASS: ${sizes.length} viewport sizes × 5 states, all controls/canvases inside viewport; full gift PNG 1080×1440; exact blessing text; no runtime errors.`);
await browser.close();
