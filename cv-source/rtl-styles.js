const fs=require('fs');
const P='ar/word/styles.xml';
let s=fs.readFileSync(P,'utf8');

// CT_PPrBase child order — <w:bidi/> must sit before these:
const AFTER=['adjustRightInd','snapToGrid','spacing','ind','contextualSpacing','mirrorIndents',
             'suppressOverlap','jc','textDirection','textAlignment','textboxTightWrap',
             'outlineLvl','divId','cnfStyle','rPr','sectPr','pPrChange'];

let n=0;
s=s.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g,(full,inner)=>{
  if(/<w:bidi\b/.test(inner)) return full;
  let idx=-1;
  for(const tag of AFTER){
    const m=inner.match(new RegExp('<w:'+tag+'[ />]'));
    if(m && (idx===-1 || m.index<idx)) idx=m.index;
  }
  n++;
  return idx===-1
    ? '<w:pPr>'+inner+'<w:bidi/></w:pPr>'
    : '<w:pPr>'+inner.slice(0,idx)+'<w:bidi/>'+inner.slice(idx)+'</w:pPr>';
});

// document defaults: bidi paragraphs, RTL runs, and an Arabic-capable font
s=s.replace('<w:pPrDefault/>','<w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault>');
if(!/<w:rPrDefault>[\s\S]*?<w:rtl\/>/.test(s)){
  s=s.replace(/(<w:rPrDefault><w:rPr>[\s\S]*?)(<\/w:rPr><\/w:rPrDefault>)/,'$1<w:rtl/>$2');
}
// give complex-script runs a proper Arabic face
s=s.replace(/(<w:rPrDefault><w:rPr><w:rFonts[^>]*?)\/>/,'$1 w:cs="Segoe UI"/>');

fs.writeFileSync(P,s);
console.log('styles: bidi added to '+n+' pPr blocks');
