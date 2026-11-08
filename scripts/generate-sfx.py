import math,random,struct,wave
from pathlib import Path
random.seed(42)
out=Path('artifacts/sfx-staging');out.mkdir(parents=True,exist_ok=True)
names={'footstep':(.09,95),'pickup':(.18,640),'scan':(.32,420),'build':(.4,150),'storm':(1.4,0),'flare':(.55,600),'power':(.45,220),'click':(.07,420),'success':(.6,720)}
for name,(duration,hz) in names.items():
 samples=[];rate=16000
 for i in range(int(duration*rate)):
  t=i/rate;p=t/duration;noise=random.uniform(-1,1)
  if name=='storm':value=noise*.25*(.7+.3*math.sin(t*3))
  elif name=='footstep':value=noise*.5+math.sin(2*math.pi*hz*t)*.35
  elif name=='build':value=(noise*.4+math.sin(2*math.pi*hz*t)*.5)*(1 if t%0.2<.065 else .12)
  elif name=='success':value=math.sin(2*math.pi*(hz*(1 if p<.33 else 1.25 if p<.66 else 1.5))*t)*.6
  elif name=='flare':value=math.sin(2*math.pi*hz*t)*(.4+.3*math.sin(t*24))
  else:value=math.sin(2*math.pi*(hz*t+hz*.65*t*t))* .7
  envelope=min(1,t/.008)*min(1,(duration-t)/.025) if name=='storm' else min(1,t/.004)*(1-p)**1.4
  samples.append(value*envelope)
 peak=max(abs(v) for v in samples);data=b''.join(struct.pack('<h',int(v/peak*24000)) for v in samples)
 with wave.open(str(out/(name+'.wav')),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(data)
print('Prepared nine original normalized sound files; largest',max(p.stat().st_size for p in out.glob('*.wav')),'bytes.')
