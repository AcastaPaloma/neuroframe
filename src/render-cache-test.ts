const output=document.getElementById('result')!,worker=new Worker(new URL('./anatomical-light.worker.ts',import.meta.url),{type:'module'});
let pending:{resolve:(x:any)=>void;reject:(e:Error)=>void}|null=null;
worker.onmessage=event=>{const m=event.data;if(m.type==='progress'){output.textContent=`Loading complete anatomy cache: ${m.loaded}/${m.total}`;return;}if(m.type==='error'){pending?.reject(Error(m.message));return;}pending?.resolve(m);pending=null;};
worker.onerror=event=>pending?.reject(Error(event.message));
const send=(m:object)=>new Promise<any>((resolve,reject)=>{pending={resolve,reject};worker.postMessage(m);});
try{
 const meta=await send({type:'init',base:'/data/full-brain-783/'});
 const values=Float32Array.from({length:meta.neurons},(_,id)=>(Math.imul(id+1,2654435761)>>>0)/4294967296);
 const reference=new Float32Array(await (await fetch('/data/full-brain-783/validation-1280.bin')).arrayBuffer());
 const first=await send({type:'activity',values});let maximumError=0,squared=0;
 for(let i=0;i<reference.length;i++){const error=Math.abs(reference[i]-first.values[i*4]);maximumError=Math.max(maximumError,error);squared+=error*error;}
 if(maximumError>1e-5)throw Error('GPU anatomical projection differs from independent SciPy CSR projection: '+maximumError);
 const black=await send({type:'activity',values:new Float32Array(meta.neurons)});
 for(let i=0;i<reference.length;i++)if(black.values[i*4]!== (reference[i]<0?-1:0))throw Error('Inactive anatomy emitted light.');
 const rgbReference=new Float32Array(await (await fetch('/data/full-brain-783/validation-rgb-1280.bin')).arrayBuffer());
 const rgb=await send({type:'activity',values,colorMode:'rgb'});let rgbMaximumError=0,rgbSquared=0;
 if(rgb.values.length!==reference.length*4||rgbReference.length!==rgb.values.length)throw Error('RGB projection dimensions differ.');
 for(let i=0;i<rgbReference.length;i++){const error=Math.abs(rgbReference[i]-rgb.values[i]);rgbMaximumError=Math.max(rgbMaximumError,error);rgbSquared+=error*error;}
 if(rgbMaximumError>1e-5)throw Error('RGB projection differs from independent SciPy reference: '+rgbMaximumError);
 const white=await send({type:'activity',values:new Float32Array(meta.neurons).fill(1),colorMode:'rgb'});
 for(let i=0;i<reference.length;i++)for(let channel=0;channel<3;channel++){
  const expected=reference[i]<0?-1:rgbReference[i*4+channel]>0?1:0;
  if(Math.abs(white.values[i*4+channel]-expected)>1e-5)throw Error('Full activity changed color-channel normalization.');
 }
 const rgbBlack=await send({type:'activity',values:new Float32Array(meta.neurons),colorMode:'rgb'});
 for(let i=0;i<reference.length;i++)for(let c=0;c<3;c++)if(rgbBlack.values[i*4+c]!== (reference[i]<0?-1:0))throw Error('Inactive RGB anatomy emitted light.');
 const replay=await send({type:'activity',values,colorMode:'grayscale'});
 if(!replay.values.every((value:number,i:number)=>value===first.values[i]))throw Error('Switching color modes changed grayscale projection.');
 const timing:number[]=[];
 for(let k=0;k<20;k++){const m=await send({type:'activity',values});timing.push(m.computeMs);}
 const summary={status:'passed',scope:'Anatomical light cache only; synthetic calibration vector, not video or neural simulation',...meta,rgbMaximumError,rgbRmse:Math.sqrt(rgbSquared/rgbReference.length),rgbComputeMs:rgb.computeMs,maximumError,rmse:Math.sqrt(squared/reference.length),meanComputeMs:timing.reduce((a,b)=>a+b)/timing.length};
 const r=await fetch('http://127.0.0.1:8768/result',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({kind:'summary',label:'render-cache-rgb-1280',summary})});if(!r.ok)throw Error('Could not save local validation.');
 output.textContent=JSON.stringify(summary);document.body.dataset.done='true';worker.terminate();
}catch(error){output.textContent=String(error);document.body.dataset.error='true';worker.terminate();}
export {};
