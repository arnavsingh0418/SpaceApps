import {createServer} from 'node:http';
import {randomUUID,randomInt} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {createGame,addPlayer,removePlayer,dispatch,tick,type Game} from '../shared/src/sim';
const rooms=new Map<string,Game>();const clients=new Map<WebSocket,{id:string;room:string;count:number;window:number;last:number}>();
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({service:'Outpost Down crew server',rooms:rooms.size}));});
const wss=new WebSocketServer({server,maxPayload:4096});
const send=(ws:WebSocket,m:object)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<1e6)ws.send(JSON.stringify(m));};
wss.on('connection',ws=>{
 const info={id:randomUUID(),room:'',count:0,window:Date.now(),last:Date.now()};clients.set(ws,info);
 ws.on('message',buf=>{try{
  if(Date.now()-info.window>1000){info.window=Date.now();info.count=0;}if(++info.count>40)return;info.last=Date.now();
  const m=JSON.parse(buf.toString());
  if(m.type==='create'||m.type==='join'){
   if(info.room)return;if(rooms.size>=100&&m.type==='create'){send(ws,{type:'error',message:'The server is full. Please try solo play.'});return;}
   let code=String(m.code||'').toUpperCase();let game:Game|undefined;
   if(m.type==='create'){do{code=Array.from({length:4},()=>String.fromCharCode(65+randomInt(26))).join('');}while(rooms.has(code));game=createGame(Number.isFinite(m.seed)?m.seed:randomInt(1000000));rooms.set(code,game);}else game=rooms.get(code);
   if(!game){send(ws,{type:'error',message:'Crew code not found. Ask your friend for the four letters.'});return;}
   if(!addPlayer(game,info.id,String(m.name||'Explorer'))){send(ws,{type:'error',message:'This crew already has four explorers.'});return;}
   info.room=code;send(ws,{type:'welcome',id:info.id,room:code});send(ws,{type:'state',state:game});return;
  }
  if(m.type==='action'&&info.room){const game=rooms.get(info.room);if(game&&m.action&&typeof m.action==='object'){const error=dispatch(game,info.id,m.action);if(error)send(ws,{type:'error',message:error});}}
 }catch{send(ws,{type:'error',message:'That action could not be read.'});}});
 ws.on('close',()=>{const game=rooms.get(info.room);if(game){removePlayer(game,info.id);if(!Object.keys(game.players).length)rooms.delete(info.room);}clients.delete(ws);});
});
const interval=setInterval(()=>{for(const game of rooms.values())tick(game,.1);for(const [ws,c] of clients){if(Date.now()-c.last>90000){ws.close(1001,'Idle connection');continue;}const state=rooms.get(c.room);if(state)send(ws,{type:'state',state});}},100);
server.listen(Number(process.env.PORT)||2567,'0.0.0.0',()=>console.log(`Crew server listening on http://localhost:${process.env.PORT||2567}`));
function shutdown(){clearInterval(interval);wss.clients.forEach(w=>w.close());server.close();}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
