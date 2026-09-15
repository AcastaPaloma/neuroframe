import test from 'node:test';
import assert from 'node:assert/strict';
import {neuronChannel,frameChannels,colorizeOperator} from '../src/neural-color.ts';

test('every released neuron receives a stable channel with exact 32-bit hashing',()=>{
  const counts=[0,0,0];
  for(let id=0;id<139255;id++){
    const expected=Number(((BigInt(id)+1n)*2654435761n&0xffffffffn)%3n);
    assert.equal(neuronChannel(id),expected);counts[expected]++;
  }
  assert.equal(counts.reduce((a,b)=>a+b),139255);
  assert.ok(counts.every(count=>count>45000));
});

test('video capture preserves RGB components and the previous luminance convention',()=>{
  const pixels=new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,0,0,0,255]);
  assert.deepEqual(Array.from(frameChannels(pixels,'rgb')),[1,0,0,0,1,0,0,0,1,0,0,0]);
  const gray=frameChannels(pixels,'grayscale');
  for(const [i,value] of [.2126,.7152,.0722,0].entries())assert.ok(Math.abs(gray[i]-value)<1e-7);
});

test('all anatomical entries survive; inactive channels stay black and uniform activity stays neutral',()=>{
  const n=12,row=Uint32Array.from({length:24},(_,i)=>Math.floor(i/n)),column=Uint32Array.from({length:24},(_,i)=>i%n);
  const weight=Float32Array.from({length:24},(_,i)=>i+1);
  const originalColumn=column.slice();
  const colored=colorizeOperator({rows:2,columns:n,row,column,weight,imageWidth:2});
  assert.equal(colored.columns,n);assert.equal(colored.row.length,24);assert.equal(colored.rows,6);
  assert.deepEqual(colored.column,originalColumn);
  for(const active of [-1,0,1,2]){
    const result=new Float64Array(6);
    for(let e=0;e<24;e++)if(active<0||neuronChannel(column[e])===active)result[colored.row[e]]+=colored.weight[e];
    for(let c=0;c<6;c++)assert.ok(Math.abs(result[c]-(active<0||c%3===active?1:0))<1e-6);
  }
  assert.ok(weight.every(value=>value>0));
});

test('invalid anatomical contributions fail instead of producing color artifacts',()=>{
  assert.throws(()=>colorizeOperator({rows:1,columns:1,row:new Uint32Array([1]),column:[0],weight:new Float32Array([1])}));
  assert.throws(()=>colorizeOperator({rows:1,columns:1,row:new Uint32Array([0]),column:[0],weight:new Float32Array([NaN])}));
});
