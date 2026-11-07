import type {Game,Action} from '../../../shared/src/sim';
export class CrewConnection{
 socket:WebSocket;id='';room='';onState:(s:Game)=>void=()=>{};onError:(s:string)=>void=()=>{};onClose:()=>void=()=>{};
 constructor(url:string){this.socket=new WebSocket(url);}
 async join(name:string,code?:string,seed=42){return new Promise<void>((resolve,reject)=>{
  const timeout=setTimeout(()=>{this.socket.close();reject(Error('Crew server did not answer. Solo play is always available.'));},8000);
  this.socket.onopen=()=>this.socket.send(JSON.stringify({type:code?'join':'create',name,code,seed}));
  this.socket.onerror=()=>{clearTimeout(timeout);reject(Error('Could not reach the crew server. Check its address, or play solo.'));};
  this.socket.onmessage=event=>{try{const m=JSON.parse(event.data);if(m.type==='welcome'){this.id=m.id;this.room=m.room;clearTimeout(timeout);resolve();}if(m.type==='state')this.onState(m.state);if(m.type==='error'){this.onError(m.message);if(!this.id){clearTimeout(timeout);this.socket.close();reject(Error(m.message));}}}catch{this.onError('The crew server sent an unreadable update.');}};
  this.socket.onclose=()=>{clearTimeout(timeout);this.onClose();};
 });}
 send(a:Action){if(this.socket.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type:'action',action:a}));}
 close(){this.socket.onclose=null;this.socket.close();}
}
