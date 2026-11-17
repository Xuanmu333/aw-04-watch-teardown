"""Synthesize the AW-04 tour score and the three illustrated sound cues."""
import array
import json
import math
from pathlib import Path
import sys
import wave

story = json.loads(Path(__file__).with_name("timeline.json").read_text())
beat = story["beats"]
rate = 48000
duration = story["duration"]
tracks = [array.array("f", [0]) * (rate * duration) for _ in range(2)]
tau = 2 * math.pi

def event(start, length, signal, pan=0):
    offset = round(start * rate)
    gains = [math.sqrt((1-pan)/2), math.sqrt((1+pan)/2)]
    for i in range(min(round(length*rate), len(tracks[0])-offset)):
        t = i/rate
        edge = min(1, t/.009, (length-t)/.04)
        v = signal(t)*edge
        for channel in range(2):
            tracks[channel][offset+i] += v*gains[channel]

def bell(start, pitch, gain, pan):
    event(start, 1.65, lambda t: gain*math.exp(-3.1*t)*(
        math.sin(tau*pitch*t)+.29*math.sin(tau*pitch*2.02*t)*math.exp(-2*t)+
        .09*math.sin(tau*pitch*4.03*t)*math.exp(-4*t)), pan)

# A restrained sustained fifth under the assembly, with a new voicing at each cut.
for j, start in enumerate([0,beat["open"],beat["array"],beat["processor"],beat["dial"]]):
    length = (beat["dial"]+2 if j==4 else [beat["open"],beat["array"],beat["processor"],beat["dial"]][j])-start
    pitches = [(146.83,220.0),(130.81,196.0),(164.81,246.94),(146.83,220.0),(130.81,196.0)][j]
    for ch,pitch in enumerate(pitches):
        event(start,length,lambda t,f=pitch:.065*min(1,t/.6,(length-t)/.7)*(
            math.sin(tau*f*t)+.25*math.sin(tau*(f*2+.5)*t)),(-.32,.32)[ch])
    if j in (1,2,3):
        for k in range(3):
            event(start+.075*k,.20,lambda t:.23*math.exp(-42*t)*(
                math.sin(tau*880*t)+.32*math.sin(tau*2137*t)),(k-1)*.3)

for start in [0,beat["dial"]]:
    bell(start+.16,783.99,.34,.28)
    bell(start+.58,659.25,.32,.28)
for k in range(5):
    pitch=2250+180*(k%3)
    event(beat["bird"]+.12+k*.39,.20,lambda t,f=pitch:.23*math.sin(math.pi*t/.20)**2*
          math.sin(tau*(f*t+3200*t*t)+.9*math.sin(89*t)),-.35)
for k in range(5):
    event(beat["alarm"]+.12+k*.46,.25,lambda t:.20*math.sin(math.pi*min(1,t/.25))**.55*(
        math.sin(tau*880*t)+.25*math.sin(tau*1760*t)),.30)
pcm=array.array("h")
for l,r in zip(*tracks):
    pcm.extend(round(max(-1,min(1,v))*32765) for v in (l,r))
with wave.open(sys.argv[1],"wb") as dest:
    dest.setparams((2,2,rate,0,"NONE","not compressed"))
    dest.writeframes(pcm.tobytes())
