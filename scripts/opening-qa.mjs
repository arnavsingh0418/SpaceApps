import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/short-story',{recursive:true});
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
try {
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>f.name==='frame'?0:raf(f);});
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.render_game_to_text,null,{polling:100,timeout:90000});
await page.click('[data-do=solo]');
const step=n=>page.evaluate(n=>window.advanceTime(n),n);
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
for(const [shot,seconds] of [['launch',6],['cruise',4],['entry',4],['touchdown',4],['egress',6],['resolve',3]]){
 assert.equal((await state()).arrival.shot,shot);
 await step(1000);const a=(await state()).arrival;await step(1000);const b=(await state()).arrival;
 assert.notDeepEqual(a.camera,b.camera);
 assert.equal(await page.locator('[data-arrival=next]').isVisible(),false);
 if(['launch','egress'].includes(shot))await page.screenshot({path:'artifacts/short-story/'+shot+'.png'});
 await step((seconds-2)*1000+20);
}
assert.equal((await state()).modal,'briefing');assert.deepEqual(errors,[]);
await page.goto('http://127.0.0.1:5173');await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await page.click('[data-do=solo]');
await step(1000);const a=(await state()).arrival;await step(1000);const b=(await state()).arrival;
assert.ok(b.elapsed > a.elapsed);assert.equal(b.reduced,true);
await page.screenshot({path:'artifacts/short-story/phone.png'});
await page.click('[data-arrival=skip]');assert.equal((await state()).modal,'briefing');
console.log('PASS automatic 27-second animated story, 6 moving scenes, brief text, mobile, gentle camera, skip, no page errors');
}finally{await browser.close();}
