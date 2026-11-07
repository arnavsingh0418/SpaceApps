import {writeFile} from 'node:fs/promises';
const start=process.argv[2]||'2024-05-08',end=process.argv[3]||'2024-05-15';
// NASA_API_KEY stays in the environment; never write it to the repository.
const url=new URL('https://api.nasa.gov/DONKI/FLR');url.search=new URLSearchParams({startDate:start,endDate:end,api_key:process.env.NASA_API_KEY||'DEMO_KEY'}).toString();
try{
 const res=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!res.ok)throw Error(`HTTP ${res.status}`);const raw=await res.json();
 const rows=raw.filter(f=>/^[CMX]/.test(f.classType)&&f.beginTime&&f.peakTime).map(({classType,beginTime,peakTime,sourceLocation,link})=>({classType,beginTime,peakTime,sourceLocation,source:'NASA DONKI API · archived data',url:link||'https://kauai.ccmc.gsfc.nasa.gov/DONKI/'}));
 if(!rows.length)throw Error('No valid flares returned; embedded archive retained');
 await writeFile(new URL('../shared/src/data/donki_flares.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');console.log(`Saved ${rows.length} archived flare records.`);
}catch(e){console.error(`NASA fetch unavailable: ${e.message}. Existing verified archive was not changed.`);process.exitCode=1;}
