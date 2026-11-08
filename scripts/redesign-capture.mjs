import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const dir=process.argv[2]||'references/redesign/before';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>!!window.__stageScene);
await fs.mkdir(dir,{recursive:true});
const scenes=(process.argv[3]||'title,intro,power,explore,near-item,workbench,scan,storm,summary').split(',');
for(const name of scenes){await page.evaluate(n=>window.__stageScene(n),name);await page.waitForTimeout(250);await page.screenshot({path:`${dir}/${name}-1600.png`});await fs.writeFile(`${dir}/${name}.json`,await page.evaluate(()=>window.render_game_to_text()));}
await fs.writeFile(`${dir}/errors.json`,JSON.stringify(errors,null,2));console.log(`Captured ${scenes.length} scenes; ${errors.length} page errors.`);await browser.close();
