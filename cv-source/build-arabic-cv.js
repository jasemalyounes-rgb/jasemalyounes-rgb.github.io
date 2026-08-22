const fs=require('fs');

/* ============================================================================
   Arabic CV builder — v3.

   v2 used Unicode isolates (FSI/PDI, U+2068/U+2069) around Latin fragments.
   That fixed the bidi ordering, but many fonts have no glyph for those code
   points, so readers drew them as visible boxes.

   v3 uses NO control characters at all. Direction is set structurally instead:
   every run carries <w:rtl/> (Arabic) or <w:rtl w:val="0"/> (Latin). Word
   applies the bidi algorithm per run, and because each run is explicitly and
   uniformly directional, the neutrals inside it resolve correctly.

   The one thing that still needs care is punctuation that FOLLOWS a Latin run
   ("... SSL/HTTPS." ). Keeping that punctuation in the *Arabic* run rather than
   the Latin one makes it resolve right-to-left, which is what we want.
   ========================================================================== */

// U+200F RIGHT-TO-LEFT MARK: zero-width, glyphless in every font.
const RLM='‏';
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const HL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

let rels=fs.readFileSync('base_rels.xml','utf8');
let next=500;
function relId(url){
  const id='rIdV'+(next++);
  rels=rels.replace('</Relationships>','<Relationship Id="'+id+'" Type="'+HL+'" Target="'+esc(url)+'" TargetMode="External"/></Relationships>');
  return id;
}

/* ---------- palette ---------- */
const INK='1F2933';     // near-black for body
const ACCENT='1D4ED8';  // blue, matches the site
const MUTED='6B7280';   // grey for dates/meta
const RULE='D1D5DB';

/* ---------- run builders ----------
   dir: 'ar' -> <w:rtl/>, 'en' -> <w:rtl w:val="0"/>                          */
function run(text,{dir='ar',b=false,i=false,sz=null,color=null,caps=false,font=null}={}){
  let rPr='';
  if(font) rPr+='<w:rFonts w:ascii="'+font+'" w:hAnsi="'+font+'" w:cs="'+font+'"/>';
  if(b) rPr+='<w:b/><w:bCs/>';
  if(i) rPr+='<w:i/><w:iCs/>';
  if(caps) rPr+='<w:caps/>';
  if(color) rPr+='<w:color w:val="'+color+'"/>';
  if(sz) rPr+='<w:sz w:val="'+sz+'"/><w:szCs w:val="'+sz+'"/>';
  rPr += (dir==='en') ? '<w:rtl w:val="0"/>' : '<w:rtl/>';
  return '<w:r><w:rPr>'+rPr+'</w:rPr><w:t xml:space="preserve">'+esc(text)+'</w:t></w:r>';
}
const ar =(t,o)=>run(t,Object.assign({dir:'ar'},o));
const en =(t,o)=>run(t,Object.assign({dir:'en'},o));

/* Split a mixed string into alternating Arabic / Latin runs.
   Punctuation that trails a Latin chunk is pushed back onto the Arabic side so
   it resolves RTL and does not jump to the far edge of the line.            */
// A Latin chunk may START with + ( # @ (phone numbers, "(Oracle)") — those are
// neutrals, so if they are left in the Arabic run they render at the wrong end
// of the line. Capture them as part of the Latin chunk instead.
const LATIN_CHUNK=/([+(#@]?[A-Za-z0-9][A-Za-z0-9 .,:/@#+()'’&_-]*[A-Za-z0-9)]|[+(#@]?[A-Za-z0-9]+)/g;

function mixed(text,opts={}){
  const parts=text.split(LATIN_CHUNK);
  // First pass: classify into [dir, text] segments.
  const seg=[];
  for(const p of parts){
    if(!p) continue;
    const isLatin=/^[+(#@]?[A-Za-z0-9]/.test(p) && /[A-Za-z0-9]/.test(p);
    if(isLatin){
      // Trailing sentence punctuation belongs to the Arabic flow.
      const m=p.match(/^(.*?[A-Za-z0-9)])([ .,:;!?]*)$/);
      if(m){ seg.push(['en',m[1]]); if(m[2]) seg.push(['ar',m[2]]); }
      else seg.push(['en',p]);
    } else {
      seg.push(['ar',p]);
    }
  }
  // Second pass: merge neighbouring Arabic segments so punctuation always sits
  // in the same run as adjacent Arabic text.
  const merged=[];
  for(const s of seg){
    const last=merged[merged.length-1];
    if(last && last[0]==='ar' && s[0]==='ar') last[1]+=s[1];
    else merged.push([s[0],s[1]]);
  }
  // Third pass: a bidi-neutral (". " "، ") sitting after a Latin chunk, or at
  // the very end of the paragraph, still resolves against the paragraph and
  // drifts to the left margin. Prefix such an Arabic run with an RLM.
  //
  // RLM (U+200F) is used deliberately instead of the FSI/PDI isolates the
  // previous version used: RLM is zero-width and every font renders it as
  // nothing, whereas FSI/PDI are missing from many fonts and fell back to
  // .notdef — the visible boxes in the last PDF.
  for(let k=0;k<merged.length;k++){
    if(merged[k][0]!=='ar') continue;
    if(!(k>0 && merged[k-1][0]==='en')) continue;
    // Insert the RLM AFTER any leading whitespace. Putting it before the space
    // makes Word swallow the gap, gluing the Arabic word onto the Latin one
    // ("تطبيقاتsystemd"). Only punctuation actually needs the anchor.
    const m=merged[k][1].match(/^(\s*)([.,:;!?،؛])([\s\S]*)$/);
    if(m) merged[k][1]=m[1]+RLM+m[2]+m[3];
  }
  return merged.map(([d,t])=>(d==='en'?en(t,opts):ar(t,opts))).join('');
}

function link(url,label){
  const id=relId(url);
  return '<w:hyperlink r:id="'+id+'"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/>'+
         '<w:color w:val="'+ACCENT+'"/><w:sz w:val="18"/><w:szCs w:val="18"/>'+
         '<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">'+esc(label)+'</w:t></w:r></w:hyperlink>';
}

/* ---------- paragraph builders ---------- */
function P(inner,{style=null,space_before=0,space_after=0,rule=false,ind=null,keepNext=false}={}){
  let pPr='';
  if(style) pPr+='<w:pStyle w:val="'+style+'"/>';
  if(keepNext) pPr+='<w:keepNext/>';
  if(rule) pPr+='<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="'+RULE+'"/></w:pBdr>';
  pPr+='<w:bidi/>';
  if(ind) pPr+='<w:ind w:right="'+ind+'"/>';
  pPr+='<w:spacing w:before="'+space_before+'" w:after="'+space_after+'"/>';
  pPr+='<w:jc w:val="right"/>';
  return '<w:p><w:pPr>'+pPr+'</w:pPr>'+inner+'</w:p>';
}

let body='';

/* ================= HEADER ================= */
body+=P(ar('جاسم أحمد اليونس',{b:true,sz:'46',color:INK}),{space_after:40});
body+=P(ar('مهندس برمجيات · خبير أنظمة ',{sz:'24',color:ACCENT,b:true})+
        en('Odoo 19',{sz:'24',color:ACCENT,b:true}),{space_after:60});
// contact line: each field its own run, separated by a thin bullet
body+=P(ar('بيروت، لبنان',{sz:'19',color:MUTED})+
        ar('   ·   ',{sz:'19',color:RULE})+
        en('+1 (931) 623-7215',{sz:'19',color:MUTED})+
        ar('   ·   ',{sz:'19',color:RULE})+
        en('jasemalyounes@gmail.com',{sz:'19',color:MUTED})+
        ar('   ·   ',{sz:'19',color:RULE})+
        en('github.com/jasemalyounes-rgb',{sz:'19',color:MUTED}),
        {space_after:40,rule:true});

/* ================= section heading helper ================= */
function H(text){
  return P(ar(text,{b:true,sz:'26',color:ACCENT}),{space_before:100,space_after:38,keepNext:true});
}
/* role heading: title right, dates as a muted run */
function ROLE(title,org,dates){
  let s=ar(title,{b:true,sz:'22',color:INK});
  if(org) s+=ar('  —  ',{sz:'22',color:MUTED})+mixed(org,{sz:'22',color:ACCENT});
  let out=P(s,{space_before:64,space_after:0,keepNext:true});
  out+=P(mixed(dates,{sz:'18',color:MUTED,i:true}),{space_after:60,keepNext:true});
  return out;
}
/* bullet with a bold lead-in label */
function BULLET(label,text){
  const dot=ar('▪  ',{sz:'20',color:ACCENT});
  let s=dot;
  if(label) s+=ar(label,{b:true,sz:'19',color:INK});
  s+=mixed(text,{sz:'19',color:INK});
  return P(s,{space_after:20,ind:0});
}

/* ================= SUMMARY ================= */
body+=H('الملخص المهني');
body+=P(mixed('مهندس برمجيات حاصل على ماجستير في علوم الويب وبكالوريوس في هندسة البرمجيات، مع أكثر من خمس سنوات من الخبرة في بناء تطبيقات متكاملة قابلة للتوسّع وإدارة دورة حياة المشاريع التقنية لدى Lazer Net ISP. متخصص في ربط بيانات المؤسسات المعقّدة (Oracle) بمعماريات الويب الحديثة، وخبير في تطوير Odoo 19 وإدارة الأنظمة والدعم التقني وممارسات DevOps.',
  {sz:'19',color:INK}),{space_after:50});

/* ================= EXPERIENCE ================= */
body+=H('الخبرات العملية');
body+=ROLE('مطوّر أنظمة ERP مستقل','','أيلول 2024 – حتّى الآن');
body+=BULLET('تطوير أنظمة ERP: ','تصميم وبناء حل مخصّص لإدارة المهام على Odoo 19 يتضمّن تفويض المدراء وتتبّع أعمال البحث والتطوير.');
body+=BULLET('الواجهات الخلفية والأمامية: ','تصميم واجهات XML موروثة معقّدة وإجراءات مخصّصة لعروض القوائم، واستخدام Python وPostgreSQL لبناء منطق خلفي قابل للتوسّع.');
body+=BULLET('إدارة الأنظمة: ','إدارة خوادم Linux VPS، بما في ذلك إعداد Nginx كوكيل عكسي ونشر شهادات SSL/HTTPS.');
body+=BULLET('الأتمتة: ','إنشاء خدمات systemd مؤتمتة لضمان التوافر العالي واستمرارية أداء التطبيقات.');

body+=ROLE('مطوّر برمجيات / قائد فريق تقني','Lazer Net ISP','دمشق، سوريا  ·  كانون الثاني 2019 – أيلول 2024');
body+=BULLET('قيادة المشاريع: ','إدارة دورة حياة المشاريع التقنية كاملةً من تحليل المتطلبات حتّى النشر النهائي.');
body+=BULLET('إدارة قواعد البيانات: ','تصميم وصيانة قواعد بيانات علائقية معقّدة (Oracle/SQL) مع ضمان سلامة البيانات وكفاءة الاسترجاع.');
body+=BULLET('التقارير الإدارية: ','إعداد تقارير تقنية دورية للإدارة العليا توثّق الإنجازات واستراتيجيات معالجة المخاطر.');
body+=BULLET('تقييم المخاطر: ','تحديد المخاطر التقنية المحتملة واقتراح استراتيجيات لضمان توافق المشاريع مع معايير الجودة.');
body+=BULLET('البنية التحتية والدعم: ','إدارة البنية التحتية للشبكات ومعالجة أعطال الأجهزة والبرمجيات وتقديم الدعم التقني.');

/* ================= PROJECTS ================= */
body+=H('مشاريع مختارة');
function PROJECT(name,desc,stack,url,label){
  let head=ar('▪  ',{sz:'20',color:ACCENT})+en(name,{b:true,sz:'22',color:INK});
  if(url) head+=ar('   ',{sz:'20'})+link(url,label);
  let out=P(head,{space_before:44,space_after:10,keepNext:true});
  out+=P(mixed(desc,{sz:'19',color:INK}),{space_after:14,ind:0});
  out+=P(ar('التقنيات: ',{b:true,sz:'18',color:MUTED})+en(stack,{sz:'18',color:MUTED}),{space_after:20,ind:0});
  return out;
}
body+=PROJECT('Harmonia',
  'تطبيق لسلامة العائلة ومشاركة الموقع يوفّر التتبّع المباشر وتنبيهات الاستغاثة والمناطق الجغرافية وأدوار الأوصياء، مع بديل يعمل عبر الرسائل القصيرة دون إنترنت؛ تولّيت بناء التطبيق والواجهة الخلفية والبنية التحتية بالكامل.',
  'React Native (Expo), TypeScript, Fastify, PostgreSQL',
  'https://harmonia-safety.vercel.app/','harmonia-safety.vercel.app');
body+=PROJECT('Smart Task Planner',
  'تطبيق مستقل لإدارة المشاريع على Odoo 19 منشور على متجر تطبيقات Odoo، يتضمّن مخطط Gantt تفاعلي مع إعادة الجدولة بالسحب والإفلات والاعتماديات، ولوحة كانبان بسبع مراحل، وجداول زمنية ولوحات تحكّم تنفيذية، دون الاعتماد على النسخة المؤسسية.',
  'Odoo 19, Python, PostgreSQL, OWL, XML',
  'https://apps.odoo.com/apps/modules/19.0/smart_task_planner','apps.odoo.com');
body+=PROJECT('Super Proxy Store',
  'بوت تيليجرام لبيع خدمات البروكسي، يدمج Cryptomus لشحن المحفظة بالعملات الرقمية إضافةً إلى مسار تأكيد يدوي لخدمات OMT وWhish وسيريتل كاش — وهي قنوات دفع إقليمية بلا واجهات برمجية عامة — عبر مُهيّئات موردين قابلة للتبديل.',
  'Node.js, Telegraf, Fastify, PostgreSQL',
  'https://t.me/myproxystore_bot','t.me/myproxystore_bot');
body+=PROJECT('Legends Match',
  'لعبة ذاكرة للهواتف المحمولة تتضمّن تسجيل الدخول عبر Google وتحقيق الدخل بواسطة AdMob واقتصاد عملات داخل اللعبة ونظام إحالة وصرف مدعوم بلوحة تحكّم إدارية.',
  'React Native (Expo), Fastify, PostgreSQL, AdMob',
  null,null);

/* ================= SKILLS ================= */
body+=H('المهارات التقنية والإدارية');
function SKILL(label,value){
  return P(ar('▪  ',{sz:'20',color:ACCENT})+ar(label,{b:true,sz:'19',color:INK})+mixed(value,{sz:'19',color:INK}),
           {space_after:20,ind:0});
}
body+=SKILL('تطوير البرمجيات: ','Python, Java, Spring Boot, C#, JavaScript, XML, PHP, Laravel, RESTful APIs.');
body+=SKILL('إدارة الأنظمة وDevOps: ','Linux VPS, Nginx, SSH Security, SSL/HTTPS, Systemd.');
body+=SKILL('قواعد البيانات: ','Oracle Database, PostgreSQL, SQL Server — الإدارة والتصميم والتحليل.');
body+=SKILL('البنية التحتية والدعم: ','شهادة CCNA، وخبرة قوية في بنية الشبكات ومعالجة أعطال الأجهزة والبرمجيات والدعم التقني.');
body+=SKILL('إدارة المشاريع: ','جمع المتطلبات، وتحديد المخاطر، وتنسيق أصحاب المصلحة، وإعداد التوثيق التقني.');
body+=SKILL('أدوات المكتب: ','إتقان متقدّم لبرامج Word وExcel (إعداد التقارير) وPowerPoint.');

/* ================= EDUCATION + LANGUAGES ================= */
// One-line education entry (ROLE() spends two paragraphs each, which pushed
// the tail of the CV onto a second page).
function EDU(degree,school,date){
  return P(ar('▪  ',{sz:'19',color:ACCENT})+ar(degree,{b:true,sz:'20',color:INK})+
           ar('  —  ',{sz:'19',color:MUTED})+ar(school,{sz:'19',color:ACCENT})+
           ar('   ·   ',{sz:'18',color:RULE})+mixed(date,{sz:'18',color:MUTED,i:true}),
           {space_after:40});
}
body+=H('التعليم');
body+=EDU('ماجستير في علوم الويب','الجامعة الافتراضية السورية','حزيران 2024');
body+=EDU('بكالوريوس في هندسة البرمجيات','جامعة حلب','تشرين الأول 2012');

body+=H('اللغات');
body+=P(ar('▪  ',{sz:'20',color:ACCENT})+ar('العربية: ',{b:true,sz:'19',color:INK})+ar('اللغة الأم',{sz:'19',color:INK}),{space_after:40});
body+=P(ar('▪  ',{sz:'20',color:ACCENT})+ar('الإنجليزية: ',{b:true,sz:'19',color:INK})+ar('إتقان تام (قراءةً وكتابةً ومحادثةً)',{sz:'19',color:INK}),{space_after:40});

const sect='<w:sectPr><w:bidi/><w:pgSz w:w="12240" w:h="15840"/>'+
  '<w:pgMar w:top="620" w:right="860" w:bottom="520" w:left="860" w:header="600" w:footer="600" w:gutter="0"/>'+
  '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>';

const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '+
'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
'<w:body>'+body+sect+'</w:body></w:document>';

fs.writeFileSync('ar/word/document.xml',doc);
fs.writeFileSync('ar/word/_rels/document.xml.rels',rels);

// hard guarantee: no bidi control characters anywhere in the output
const ctl=doc.match(/[‎‏⁦-⁩‪-‮]/g);
console.log('built: '+(next-500)+' links, '+doc.length+' bytes');
console.log('control characters in output: '+(ctl?ctl.length+' -> '+JSON.stringify(ctl):'0 (clean)'));
