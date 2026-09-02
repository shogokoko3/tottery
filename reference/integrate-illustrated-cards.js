const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");

const oldComponent = 'function Dl({rank:l,suit:t,size:e="md"}){let a=ay.includes(t),n=e==="xs"?{w:24,h:32,fs:10}:e==="sm"?{w:34,h:46,fs:13}:{w:46,h:62,fs:17};return(0,f.jsxs)("div",{className:"card-face",style:{width:n.w,height:n.h},children:[(0,f.jsx)("span",{style:{fontSize:n.fs,color:a?"#a3324a":"#241f18"},children:l}),(0,f.jsx)("span",{style:{fontSize:n.fs*.85,color:a?"#a3324a":"#241f18"},children:zi[t]})]})}';
const newComponent = 'function Dl({rank:l,suit:t,size:e="md"}){let a=e==="xs"?{w:24,h:32}:e==="sm"?{w:34,h:46}:{w:46,h:62},n={spade:"S",heart:"H",diamond:"D",club:"C"}[t],u=`assets/illustrated-cards/${l}${n}.png`;return(0,f.jsx)("img",{className:"card-face card-art-face",style:{width:a.w,height:a.h},src:u,alt:`${l}${zi[t]}`,draggable:!1})}';

if (html.includes(oldComponent)) {
  html = html.replace(oldComponent, newComponent);
} else if (!html.includes(newComponent)) {
  throw new Error("Could not find the original card component to replace.");
}

html = html.replace('ey="v33 (待機中の確認と振り返り)"', 'ey="v34 (イラストカード視認性改善)"');
fs.writeFileSync(htmlPath, html);
console.log("Integrated 52 illustrated cards into the game UI.");
