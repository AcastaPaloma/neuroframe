import type {SparseTriplets} from './gpu-solver';

export type NeuralColorMode='grayscale'|'rgb';
export const NEURON_COLOR_SEED=2654435761;

/** An artificial emission channel fixed by neuron identity, never by video. */
export function neuronChannel(id:number):number{
  return (Math.imul(id+1,NEURON_COLOR_SEED)>>>0)%3;
}

export function frameChannels(rgba:Uint8ClampedArray,mode:NeuralColorMode):Float32Array<ArrayBuffer>{
  if(rgba.length%4)throw Error('Video pixels must contain complete RGBA samples.');
  const count=rgba.length/4,values=new Float32Array(count*(mode==='rgb'?3:1));
  for(let i=0;i<count;i++){
    if(mode==='rgb'){
      values[3*i]=rgba[4*i]/255;values[3*i+1]=rgba[4*i+1]/255;values[3*i+2]=rgba[4*i+2]/255;
    }else values[i]=(.2126*rgba[4*i]+.7152*rgba[4*i+1]+.0722*rgba[4*i+2])/255;
  }
  return values;
}

/** Reuse every cable entry and neuron, assigning each entry to its owner's
 * fixed channel. Normalize by that channel's local cable density, exactly as
 * the renderer does. Mutates row/weight arrays to avoid duplicating large data.
 * No neural state or stimulus is an input to this transformation. */
export function colorizeOperator(m:SparseTriplets & {row:Uint32Array;weight:Float32Array}):SparseTriplets{
  if(m.row.length!==m.column.length||m.row.length!==m.weight.length)throw Error('Incomplete anatomical operator.');
  const normalization=new Float64Array(m.rows*3),channels=Uint8Array.from({length:m.columns},(_,id)=>neuronChannel(id));
  for(let e=0;e<m.row.length;e++){
    const pixel=m.row[e],cell=m.column[e],weight=m.weight[e];
    if(pixel>=m.rows||cell<0||cell>=m.columns||!Number.isInteger(cell)||!Number.isFinite(weight)||weight<0)throw Error('Invalid anatomical color contribution.');
    const row=pixel*3+channels[cell];m.row[e]=row;normalization[row]+=weight;
  }
  for(let e=0;e<m.row.length;e++)m.weight[e]=normalization[m.row[e]]?m.weight[e]/normalization[m.row[e]]:0;
  return {...m,rows:m.rows*3,imageWidth:undefined};
}
