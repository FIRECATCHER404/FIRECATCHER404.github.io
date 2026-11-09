import {frequency} from './model.js';
export function voiceSpec(voice){return voice==='bell'?{wave:'sine',attack:.004,duration:1.15,cutoff:10000,partial:2.003,partialGain:.22}:voice==='pluck'?{wave:'triangle',attack:.003,duration:.48,cutoff:3200,partial:1,partialGain:0}:voice==='wood'?{wave:'triangle',attack:.002,duration:.24,cutoff:1600,partial:3,partialGain:.08}:{wave:'sine',attack:.035,duration:1.25,cutoff:6000,partial:2,partialGain:.08};}
export function makeMaster(context,destination,volume){const gain=context.createGain(),compressor=context.createDynamicsCompressor();gain.gain.value=volume;compressor.threshold.value=-15;compressor.knee.value=12;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.18;gain.connect(compressor).connect(destination);return{gain,compressor};}
export function playTone(context,destination,event,time,onEnd=()=>{}){
  const spec=voiceSpec(event.voice),envelope=context.createGain(),filter=context.createBiquadFilter(),pan=context.createStereoPanner(),oscillators=[],f=frequency(event.note),start=Math.max(context.currentTime,time),end=start+spec.duration;
  filter.type='lowpass';filter.frequency.value=Math.min(spec.cutoff,context.sampleRate*.45);filter.Q.value=.45;pan.pan.value=Math.max(-.8,Math.min(.8,(event.x-.5)*1.6));envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,event.gain*.2),start+spec.attack);envelope.gain.exponentialRampToValueAtTime(.0001,end);envelope.connect(filter).connect(pan).connect(destination);
  let ended=0;const finish=()=>{ended++;if(ended!==oscillators.length)return;envelope.disconnect();filter.disconnect();pan.disconnect();onEnd();};
  for(const [multiple,level]of [[1,1],[spec.partial,spec.partialGain]]){if(!level)continue;const osc=context.createOscillator(),gain=context.createGain();osc.type=spec.wave;osc.frequency.value=f*multiple;gain.gain.value=level;osc.connect(gain).connect(envelope);osc.onended=()=>{osc.disconnect();gain.disconnect();finish();};oscillators.push(osc);}
  for(const osc of oscillators){osc.start(start);osc.stop(end+.02);}
  return{end,stop(){try{envelope.gain.cancelScheduledValues(context.currentTime);envelope.gain.setValueAtTime(.0001,context.currentTime);for(const osc of oscillators)osc.stop(context.currentTime+.005);}catch{}}};
}
export class AudioEngine{
  constructor(){this.context=null;this.voices=new Set();this.recent=new Map();this.scheduled=0;}
  async enable(){const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Audio)throw Error('This browser does not support Web Audio.');if(!this.context||this.context.state==='closed'){this.context=new Audio();this.master=makeMaster(this.context,this.context.destination,.55);}await this.context.resume();if(this.context.state!=='running')throw Error('Audio could not start. Click Play to try again.');}
  volume(value){if(this.context)this.master.gain.gain.setTargetAtTime(value,this.context.currentTime,.02);}
  anchor(beat,tempo){if(this.context)this.origin=this.context.currentTime-beat*60/tempo;}
  note(event,project){if(this.context?.state!=='running')return;const time=project.quantize?Math.max(this.context.currentTime+.008,(this.origin??this.context.currentTime)+Math.ceil(event.beat*4-1e-8)/4*60/project.tempo):this.context.currentTime+.008,key=event.id+':'+Math.round(time*100);if(this.recent.has(key))return;this.recent.set(key,time);for(const [k,t]of this.recent)if(t<this.context.currentTime-.1)this.recent.delete(k);while(this.voices.size>=32){const oldest=this.voices.values().next().value;oldest.stop();this.voices.delete(oldest);}let voice;voice=playTone(this.context,this.master.gain,event,time,()=>this.voices.delete(voice));this.voices.add(voice);this.scheduled++;}
  silence(){for(const voice of this.voices)voice.stop();this.voices.clear();this.recent.clear();}
  snapshot(){return{state:this.context?.state??'not started',voices:this.voices.size,scheduled:this.scheduled};}
}
