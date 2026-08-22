const fs=require('fs');
const P='ar/word/styles.xml';
let s=fs.readFileSync(P,'utf8');

// --- 1. bidi on every paragraph style, in schema-legal position -------------
const AFTER=['adjustRightInd','snapToGrid','spacing','ind','contextualSpacing','mirrorIndents',
             'suppressOverlap','jc','textDirection','textAlignment','textboxTightWrap',
             'outlineLvl','divId','cnfStyle','rPr','sectPr','pPrChange'];
let n=0;
s=s.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g,(full,inner)=>{
  if(/<w:bidi\b/.test(inner)) return full;
  let idx=-1;
  for(const tag of AFTER){
    const m=inner.match(new RegExp('<w:'+tag+'[ />]'));
    if(m&&(idx===-1||m.index<idx)) idx=m.index;
  }
  n++;
  return idx===-1 ? '<w:pPr>'+inner+'<w:bidi/></w:pPr>'
                  : '<w:pPr>'+inner.slice(0,idx)+'<w:bidi/>'+inner.slice(idx)+'</w:pPr>';
});

// --- 2. one font family for both scripts, RTL default ----------------------
// Segoe UI has full Arabic coverage and ships on Windows; it also has no
// visible glyph for bidi controls (we emit none now, but keep it consistent).
s=s.replace(/<w:rFonts w:asciiTheme="minorHAnsi"[^>]*\/>/,
  '<w:rFonts w:ascii="Segoe UI" w:eastAsia="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>');
if(!/<w:rPrDefault>[\s\S]*?<w:rtl\/>/.test(s)){
  s=s.replace(/(<w:rPrDefault><w:rPr>[\s\S]*?)(<\/w:rPr><\/w:rPrDefault>)/,'$1<w:rtl/>$2');
}
s=s.replace('<w:pPrDefault/>','<w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault>');

// --- 3. de-dupe any attribute we may have doubled --------------------------
s=s.split('w:cs="Segoe UI" w:cs="Segoe UI"').join('w:cs="Segoe UI"');

fs.writeFileSync(P,s);

// validate: no tag carries the same attribute twice (that makes Word refuse
// to open the package, which cost real time on the previous build)
let bad=0;
for(const t of (s.match(/<[a-zA-Z:][^>]*>/g)||[])){
  const at=[...t.matchAll(/([a-zA-Z:]+)="/g)].map(m=>m[1]);
  const seen=new Set();
  for(const a of at){ if(seen.has(a)){ bad++; break; } seen.add(a); }
}
console.log('styles: bidi added to '+n+' blocks; duplicate-attribute tags: '+bad);
