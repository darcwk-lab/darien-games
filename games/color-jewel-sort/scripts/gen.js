const fs=require('fs');
const P={k:'#3a3a44',w:'#f3ecd8',r:'#ff5a6e',p:'#ff3fb4',o:'#ffa020',y:'#ffd93d',g:'#2fd07f',l:'#a6e03a',b:'#3fa9ff',v:'#9b3fe0',n:'#a0673a',s:'#ffb8c8'};
const L=[
["小草莓",["..gg..",".grrg.","rrwrrr","rrrrwr",".rwrr.","..rr.."]],
["爱心",[".pp.pp.","ppppppp","ppwpppp","ppppppp",".ppppp.","..ppp..","...p..."]],
["小鸡",["..yyyy..",".yyyyyy.","yykyykyy","yyyooyyy","yyyyyyyy",".yyyyyy.","..o..o..","........"].map(r=>r.replace(/\./g,'b'))],
["蘑菇",["...rrrr...","..rrwwrr..",".rrrwwrrr.","rrwrrrrwwr","rwwrrrrwwr","rrrrrrrrrr","...wkwk...","...wwww...","...wwww...","....ww...."]],
["小猫",["k........k","kk......kk","kwkkkkkkwk","kkkkkkkkkk","kkgkkkkgkk","kkgkkkkgkk","kkkkskkkkk","kkkskskkkk",".kkkkkkkk.","..kkkkkk.."].map(r=>r.replace(/\./g,'l'))],
["西瓜",["............","...gggggg...",".gglllllllg.","gllrrrrrrllg","glrrkrrkrrlg","glrrrrrrrrlg","glrrrkrrkrlg",".glrrrrrrlg.","..gllrrllg..","...gglllgg..",".....ggg....","............"].map(r=>r.replace(/\./g,'b'))],
["彩虹",["bbbbbbbbbbbbbb","bbbbrrrrrrbbbb","bbbrooooooorbb","bbroyyyyyyorbb","broyggggggyorb","royglllllgyorb","roygl....lgyor","roygl.ww.lgyor","roygl.wwwlgyor","royg.wwwwwgyor","bbbwwwwwwwwwbb","bbwwwwwwwwwwwb","bbbbbbbbbbbbbb","bbbbbbbbbbbbbb"].map(r=>r.replace(/\./g,'b'))],
["火箭",["bbbbbbbbbbbbbbbb","bbbbbbbwbbbbbbbb","bbbbbbwwwbbbbbbb","bbbbbwwwwwbbbbbb","bbbbbwrrrwbbbbbb","bbbbwwrbrwwbbbbb","bbbbwwrbrwwbbbbb","bbbbwwrrrwwbbbbb","bbbbwwwwwwwbbbbb","bbbbwwwwwwwbbbbb","bbbrwwwwwwwrbbbb","bbrrwwwwwwwrrbbb","bbrrbwwwwwbrrbbb","bbbbbbooooobbbbb","bbbbbbyoyoybbbbb","bbbbbbbybybbbbbb"]],
["企鹅",null],["花朵",null]];
function gen(n,f){const a=[];for(let y=0;y<n;y++){let r='';for(let x=0;x<n;x++)r+=f(x,y,n);a.push(r)}return a}
L[8][1]=gen(18,(x,y,n)=>{const cx=8.5,dx=(x-cx)/6,dy=(y-9)/8;const d=dx*dx+dy*dy;if(d>1)return 'b';const ix=(x-cx)/4,iy=(y-10)/6;if(ix*ix+iy*iy<1)return (y==12&&(x==8||x==9))?'o':'w';if(y==5&&(x==6||x==11))return 'w';if(y==7&&(x==8||x==9))return 'o';if(y>=16)return 'o';return 'k'});
L[9][1]=gen(20,(x,y,n)=>{const cx=9.5,cy=8.5,dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);if(y>12&&(x==9||x==10))return 'g';if(y==15&&x>=6&&x<=13&&Math.abs(x-9.5)>1)return 'l';if(r<2.3)return 'y';if(r<2.8+3.6*Math.abs(Math.cos(3*a))&&y<=14)return r<4.5?'p':'s';return y>17?'n':'b'});
L.forEach(([name,rows],i)=>{const used=[...new Set(rows.join(''))].filter(c=>c!=='.');const pal={};used.forEach(c=>pal[c]=P[c]);
fs.writeFileSync(`games/color-jewel-sort/levels/level${i+1}.json`,JSON.stringify({id:i+1,name,palette:pal,rows},null,1));});
fs.writeFileSync('levels/index.ts',L.map((_,i)=>`import l${i+1} from './level${i+1}.json';`).join('\n')+`\nexport type LevelDef={id:number;name:string;palette:Record<string,string>;rows:string[]};\nexport const LEVELS:LevelDef[]=[${L.map((_,i)=>'l'+(i+1)).join(',')}] as LevelDef[];\n`);
