const fs=require('fs');
const DIR=(process.argv[2]||'ar').toLowerCase();
const RTL = DIR==='ar';
const P=DIR+'/word/styles.xml';
let s=fs.readFileSync(P,'utf8');

// CT_PPrBase child order — <w:bidi/> must precede all of these.
const AFTER=['adjustRightInd','snapToGrid','spacing','ind','contextualSpacing','mirrorIndents',
             'suppressOverlap','jc','textDirection','textAlignment','textboxTightWrap',
             'outlineLvl','divId','cnfStyle','rPr','sectPr','pPrChange'];

function addBidi(xml){
  let n=0;
  const out=xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g,(full,inner)=>{
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
  return [out,n];
}
function stripBidi(xml){
  return xml.replace(/<w:bidi\/>/g,'').replace(/<w:bidi w:val="[^"]*"\/>/g,'');
}

let n=0;
if(RTL){ [s,n]=addBidi(s); } else { s=stripBidi(s); }

// Default fonts: Arabic document face for complex script, Calibri for Latin.
s=s.replace(/<w:rFonts w:ascii[^>]*\/>/,
  '<w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:cs="Sakkal Majalla"/>');

// Default RUN direction.
s=s.replace(/<w:rPrDefault><w:rPr>([\s\S]*?)<\/w:rPr><\/w:rPrDefault>/,(full,inner)=>{
  inner=inner.replace(/<w:rtl\/>/g,'');
  return '<w:rPrDefault><w:rPr>'+inner+(RTL?'<w:rtl/>':'')+'</w:rPr></w:rPrDefault>';
});

// Default PARAGRAPH direction.
s=s.replace(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>|<w:pPrDefault\/>/,
  RTL ? '<w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr></w:pPrDefault>'
      : '<w:pPrDefault><w:pPr><w:jc w:val="left"/></w:pPr></w:pPrDefault>');

// THE IMPORTANT ONE: put direction + alignment on the Normal style itself.
// Word normalises paragraph-level <w:bidi/> away when it re-saves a document —
// that is exactly what silently turned the previous Arabic build back to LTR.
// A style-level declaration survives the round-trip.
s=s.replace(/(<w:style w:type="paragraph"[^>]*w:styleId="Normal"[^>]*>)([\s\S]*?)(<\/w:style>)/,
  (full,open,inner,close)=>{
    inner=inner.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/,'');
    const pPr = RTL
      ? '<w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr>'
      : '<w:pPr><w:jc w:val="left"/></w:pPr>';
    // CT_Style order: name, aliases, basedOn, ..., rsid, pPr, rPr
    if(/<w:rsid[^>]*\/>/.test(inner)) return open+inner.replace(/(<w:rsid[^>]*\/>)/,'$1'+pPr)+close;
    if(/<w:rPr>/.test(inner))         return open+inner.replace('<w:rPr>',pPr+'<w:rPr>')+close;
    return open+inner+pPr+close;
  });

s=s.split('w:cs="Sakkal Majalla" w:cs="Sakkal Majalla"').join('w:cs="Sakkal Majalla"');
fs.writeFileSync(P,s);

let bad=0;
for(const t of (s.match(/<[a-zA-Z:][^>]*>/g)||[])){
  const at=[...t.matchAll(/([a-zA-Z:]+)="/g)].map(m=>m[1]);
  const seen=new Set();
  for(const a of at){ if(seen.has(a)){bad++;break;} seen.add(a); }
}
const normal=(s.match(/<w:style w:type="paragraph"[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/)||[''])[0];
console.log('['+DIR+'] bidi added to '+n+' style blocks; dup-attr tags: '+bad);
console.log('       Normal style: '+normal.replace(/<w:name[^>]*\/>/,'').slice(0,190));
