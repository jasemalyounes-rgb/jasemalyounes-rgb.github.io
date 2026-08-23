const fs=require('fs');
const P='ar/word/styles.xml';
let s=fs.readFileSync(P,'utf8');

// bidi on every paragraph style, inserted in schema-legal position
const AFTER=['adjustRightInd','snapToGrid','spacing','ind','contextualSpacing','mirrorIndents',
             'suppressOverlap','jc','textDirection','textAlignment','textboxTightWrap',
             'outlineLvl','divId','cnfStyle','rPr','sectPr','pPrChange'];
let n=0;
s=s.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g,(full,inner)=>{
  if(/<w:bidi\b/.test(inner)) return full;
  let idx=-1;
  for(const t of AFTER){
    const m=inner.match(new RegExp('<w:'+t+'[ />]'));
    if(m&&(idx===-1||m.index<idx)) idx=m.index;
  }
  n++;
  return idx===-1 ? '<w:pPr>'+inner+'<w:bidi/></w:pPr>'
                  : '<w:pPr>'+inner.slice(0,idx)+'<w:bidi/>'+inner.slice(idx)+'</w:pPr>';
});

// Default run: Arabic document face for complex script, Calibri for Latin.
s=s.replace(/<w:rFonts w:ascii[^>]*\/>/,
  '<w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:cs="Sakkal Majalla"/>');
if(!/<w:rPrDefault>[\s\S]*?<w:rtl\/>/.test(s)){
  s=s.replace(/(<w:rPrDefault><w:rPr>[\s\S]*?)(<\/w:rPr><\/w:rPrDefault>)/,'$1<w:rtl/>$2');
}
s=s.replace('<w:pPrDefault/>','<w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault>');

// A right-aligned tab at the left text margin: on an RTL line this parks the
// dates / links flush against the opposite edge, which is what gives the
// Harvard layout its "title right, date left" alignment.
const TAB='<w:tabs><w:tab w:val="left" w:pos="0"/></w:tabs>';
s=s.replace(/(<w:style w:type="paragraph"[^>]*w:default="1"[^>]*>)([\s\S]*?)(<\/w:style>)/,
  (full,open,inner,close)=>{
    if(/<w:tabs>/.test(inner)) return full;
    if(/<w:pPr>/.test(inner)) return open+inner.replace('<w:pPr>','<w:pPr>'+TAB)+close;
    return open+inner.replace(/(<w:rsid[^>]*\/>)/,'$1<w:pPr>'+TAB+'<w:bidi/></w:pPr>')+close;
  });

s=s.split('w:cs="Sakkal Majalla" w:cs="Sakkal Majalla"').join('w:cs="Sakkal Majalla"');
fs.writeFileSync(P,s);

let bad=0;
for(const t of (s.match(/<[a-zA-Z:][^>]*>/g)||[])){
  const at=[...t.matchAll(/([a-zA-Z:]+)="/g)].map(m=>m[1]);
  const seen=new Set();
  for(const a of at){ if(seen.has(a)){bad++;break;} seen.add(a); }
}
console.log('styles: bidi on '+n+' blocks; duplicate-attr tags: '+bad);
