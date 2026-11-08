declare global {
 interface Window {
  advanceTime: (ms:number)=>void;
  render_game_to_text: ()=>string;
  __stageScene?: (name:string)=>void;
 }
}
export {};
