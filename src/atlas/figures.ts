import type { Topic } from './copy'
const cube=(x:number,y:number,s:number,fill:string)=>`<g transform="translate(${x} ${y})"><path d="M0 0l${s} ${-s/2} ${s} ${s/2} ${-s} ${s/2}Z" fill="${fill}"/><path d="M0 0v${s}l${s} ${s/2}v-${s}Z" fill="#d4e7ca"/><path d="M${s} ${s/2}l${s} -${s/2}v${s}l-${s} ${s/2}Z" fill="#7da581"/></g>`
const path=(d:string,extra='')=>`<path d="${d}" ${extra}/>`
const rule=(x:number,y:number,n:number)=>path(`M${x} ${y}h${n}`,'stroke="#91a593" stroke-dasharray="2 4"')
export function figure(topic:Topic){
  let drawing=''
  if(topic==='history') {
    drawing=path('M17 57l23-12 25 12 23-12 26 13 23-12','stroke-dasharray="3 3"')+
       cube(19,39,13,'#e7efdf')+cube(52,34,16,'#d4e8bf')+cube(93,25,21,'#bce395')
  } else if(topic==='inactive') {
    drawing=rule(10,56,132)+[0,1,2,3,4,5,6].map((_,i)=>`<rect x="${19+i*17}" y="${22+i*2.5}" width="13" height="${34-i*2.5}" fill="${['#719777','#86ac85','#a3c09b','#b6cca8','#c3d4b5','#d7e2cc','#e7edde'][i]}"/>`).join('')+path('M18 64h110m-4-3 4 3-4 3')+path('M18 15v-3h45v3','stroke="#69946d"')
  } else if(topic==='concentration'||topic==='context') {
    drawing=path('M13 60l35-18 85 14-32 16Z','fill="#e5ecdf" stroke="#a2b49d"')+
      [[25,49,8,1],[43,42,8,2],[60,50,10,2],[82,53,11,3],[103,46,12,3]].map(([x,y,s,n])=>Array.from({length:n},(_,i)=>cube(x,y-i*7,s,i===n-1?'#b8db96':'#d2e3c3')).join('')).join('')
  } else if(topic==='expiration') {
    drawing=path('M12 51h131m-5-3 5 3-5 3')+path('M23 46V31h43V19h35v32','stroke-width="2" stroke="#487757"')+path('M101 21v31m0 0h28V30','stroke-dasharray="3 3"')+'<circle cx="23" cy="51" r="4" fill="#e2eed7"/><rect x="62" y="47" width="8" height="8" fill="#b3d78c"/><path d="m101 46 5 5-5 5-5-5Z" fill="#f0cc9c"/><circle cx="128" cy="51" r="4" fill="#9cb6de"/>'
  } else {
    drawing=path('M19 33h29l15 17h36l16-21h18M20 53h21l20-21h32l17 15h23','stroke-width="1.7"')+[20,43,62,92,116,133].map((x,i)=>`<circle cx="${x}" cy="${[33,53,32,50,29,47][i]}" r="5" fill="${i%2?'#c3dfa7':'#eff5e9'}"/>`).join('')
  }
  return `<svg class="a-figure" viewBox="0 0 155 80" aria-hidden="true" focusable="false"><g fill="none" stroke="#3a5744" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round">${drawing}</g></svg>`
}
export const logo='<svg class="a-symbol" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.7" stroke-linejoin="round"><path d="M24 3 42 13.5v20L24 44 6 33.5v-20Z"/><path d="m24 11 11 6.4v12.9L24 37l-11-6.7V17.4Z"/><path d="m24 19 5 3v6l-5 3-5-3v-6Z"/></g><path d="m24 3 18 10.5-7 4L24 11Z" fill="#75b345"/></svg>'
export const arrow='<span aria-hidden="true">↗</span>'
