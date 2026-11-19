// Close the stack before moving the same watch canvas into the acoustic field.
// Two progress values let a second button press reverse a transition in place.
const ease = t => t*t*(3-2*t);
const mix = (a,b,t) => a+(b-a)*t;

export function createSceneMotion({app,stage,canvas,hardware,labHost,footer}) {
  const buttons = [...app.querySelectorAll('button[data-scene]')];
  let target='assembled', opening=0, travel=0, receiver=null, inFlight=false;
  const flight=document.createElement('div');
  flight.className='watch-flight';
  flight.hidden=true;
  app.append(flight);

  function select(name) {
    target=name;
    app.dataset.scene=name;
    for (const button of buttons) button.setAttribute('aria-pressed',String(button.dataset.scene===name));
    hardware.inert=name==='lab';
    if(labHost)labHost.inert=name!=='lab'||travel<1;
  }
  select('assembled');
  app.dataset.motion='idle';

  function advance(dt,reduced,isolated) {
    const endTravel=target==='lab'?1:0;
    const endOpen=target==='exploded'&&!isolated?1:0;
    const step=Math.min(Math.max(dt,0),.1);
    if(reduced){opening=endOpen;travel=endTravel;}
    else if(travel>endTravel)travel=Math.max(endTravel,travel-step/.95);
    else if(opening>endOpen)opening=Math.max(endOpen,opening-step/1.05);
    else if(travel<endTravel)travel=Math.min(endTravel,travel+step/1.15);
    else if(opening<endOpen)opening=Math.min(endOpen,opening+step/1.05);
    const phase=travel>endTravel?'undocking':opening>endOpen?'assembling':
      travel<endTravel?'docking':opening<endOpen?'opening':'idle';
    if(app.dataset.motion!==phase)app.dataset.motion=phase;
  }

  function layout() {
    if(!receiver)return;
    if(travel===0){
      if(canvas.parentNode!==stage)stage.prepend(canvas);
      inFlight=false;flight.hidden=true;
      hardware.hidden=false;hardware.style.opacity='';
      labHost.hidden=true;footer.style.visibility='';
      return;
    }
    labHost.hidden=false;
    if(travel===1){
      if(canvas.parentNode!==receiver)receiver.prepend(canvas);
      inFlight=false;flight.hidden=true;hardware.hidden=true;
      labHost.style.opacity='1';labHost.inert=target!=='lab';
      footer.style.visibility='hidden';
      return;
    }
    hardware.hidden=false;
    if(!inFlight){flight.append(canvas);flight.hidden=false;inFlight=true;}
    const t=ease(travel);
    const from=stage.getBoundingClientRect(),to=receiver.getBoundingClientRect();
    for(const key of ['left','top','width','height']){
      flight.style[key]=mix(from[key],to[key],t)+'px';
    }
    hardware.style.opacity=String(1-ease(Math.min(1,travel*1.6)));
    labHost.style.opacity=String(ease(Math.min(1,travel*1.4)));
    footer.style.visibility=travel>.4?'hidden':'';
  }

  return {
    select,advance,layout,
    setReceiver(node){receiver=node;},
    setExplosion(value){opening=value;},
    tour(name,ex){
      if(target!==name)select(name);
      opening=ex;travel=0;app.dataset.motion='idle';
    },
    get target(){return target;},
    get explosion(){return ease(opening);},
    get dock(){return ease(travel);}
  };
}
