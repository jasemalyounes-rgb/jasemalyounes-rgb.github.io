const fs=require('fs');

/* ============================================================================
   Arabic CV — Harvard-classic single column.

   Layout follows the format recruiters and ATS guidance converge on for 2026:
     - ONE column, top-to-bottom (two-column is what ATS parsers handle worst)
     - centered name, contact details on a single line beneath
     - section headings in small caps/bold with a full-width rule under each
     - dense bullets, no icons, no graphics, no sidebars
     - conservative colour: near-black text, one restrained accent

   Bidi handling (unchanged from the version that tested clean):
     every run is explicitly directional — <w:rtl/> for Arabic,
     <w:rtl w:val="0"/> for Latin — so NO isolate characters are needed.
     Only RLM (U+200F) is used, and only where punctuation follows a Latin run;
     RLM is zero-width and glyphless in every font, unlike FSI/PDI which many
     fonts render as visible boxes.
   ========================================================================== */

const RLM='‏';
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const HL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

let rels=fs.readFileSync('base_rels.xml','utf8');
let next=600;
function relId(url){
  const id='rIdH'+(next++);
  rels=rels.replace('</Relationships>','<Relationship Id="'+id+'" Type="'+HL+'" Target="'+esc(url)+'" TargetMode="External"/></Relationships>');
  return id;
}

/* ---------- type scale (half-points) ----------
   Body 11pt, headings 13pt, name 22pt — inside the 10-11 / 13-14 pt range the
   Arabic-CV guidance recommends.                                            */
const T={ name:'52', role:'24', contact:'21', head:'28', role_t:'26', date:'21', body:'26', meta:'22' };

/* ---------- colour: conservative, one accent ---------- */
const INK   ='000000';   // headings + name: pure black, Harvard style
const BODY  ='1A1A1A';   // body text
const MUTED ='595959';   // dates / secondary
const ACCENT='1F3864';   // deep navy for links only (not red/green/orange)

/* Fonts: Sakkal Majalla is a genuine Arabic document face that ships with
   Office; Calibri carries the Latin so the two scripts sit at a similar
   optical size.                                                             */
const AR_FONT='Sakkal Majalla';
const EN_FONT='Calibri';

function run(text,{dir='ar',b=false,i=false,sz=T.body,color=BODY,caps=false,space=null}={}){
  const font = dir==='en' ? EN_FONT : AR_FONT;
  let rPr='<w:rFonts w:ascii="'+font+'" w:hAnsi="'+font+'" w:cs="'+AR_FONT+'"/>';
  if(b) rPr+='<w:b/><w:bCs/>';
  if(i) rPr+='<w:i/><w:iCs/>';
  if(caps) rPr+='<w:smallCaps/>';
  if(space) rPr+='<w:spacing w:val="'+space+'"/>';
  rPr+='<w:color w:val="'+color+'"/><w:sz w:val="'+sz+'"/><w:szCs w:val="'+sz+'"/>';
  rPr+= (dir==='en') ? '<w:rtl w:val="0"/>' : '<w:rtl/>';
  return '<w:r><w:rPr>'+rPr+'</w:rPr><w:t xml:space="preserve">'+esc(text)+'</w:t></w:r>';
}
const ar=(t,o)=>run(t,Object.assign({dir:'ar'},o));
const en=(t,o)=>run(t,Object.assign({dir:'en'},o));

// A Latin chunk may open with + ( # @ — keep those inside the Latin run or the
// bidi algorithm strands them at the wrong end (phone numbers, "(Oracle)").
const LATIN=/([+(#@]?[A-Za-z0-9][A-Za-z0-9 .,:/@#+()'’&_-]*[A-Za-z0-9)]|[+(#@]?[A-Za-z0-9]+)/g;

function mixed(text,opts={}){
  const seg=[];
  for(const p of text.split(LATIN)){
    if(!p) continue;
    const isLatin=/^[+(#@]?[A-Za-z0-9]/.test(p)&&/[A-Za-z0-9]/.test(p);
    if(isLatin){
      const m=p.match(/^(.*?[A-Za-z0-9)])([ .,:;!?]*)$/);
      if(m){ seg.push(['en',m[1]]); if(m[2]) seg.push(['ar',m[2]]); }
      else seg.push(['en',p]);
    } else seg.push(['ar',p]);
  }
  const merged=[];
  for(const s of seg){
    const last=merged[merged.length-1];
    if(last&&last[0]==='ar'&&s[0]==='ar') last[1]+=s[1];
    else merged.push([s[0],s[1]]);
  }
  // Anchor punctuation that follows Latin. RLM goes AFTER any leading space,
  // otherwise Word swallows the gap and glues the words together.
  for(let k=0;k<merged.length;k++){
    if(merged[k][0]!=='ar') continue;
    if(!(k>0&&merged[k-1][0]==='en')) continue;
    const m=merged[k][1].match(/^(\s*)([.,:;!?،؛])([\s\S]*)$/);
    if(m) merged[k][1]=m[1]+RLM+m[2]+m[3];
  }
  return merged.map(([d,t])=>(d==='en'?en(t,opts):ar(t,opts))).join('');
}

function link(url,label){
  const id=relId(url);
  return '<w:hyperlink r:id="'+id+'"><w:r><w:rPr>'+
    '<w:rFonts w:ascii="'+EN_FONT+'" w:hAnsi="'+EN_FONT+'"/>'+
    '<w:color w:val="'+ACCENT+'"/><w:u w:val="single"/>'+
    '<w:sz w:val="'+T.meta+'"/><w:szCs w:val="'+T.meta+'"/>'+
    '<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">'+esc(label)+'</w:t></w:r></w:hyperlink>';
}

function P(inner,{before=0,after=0,rule=false,jc='right',ind=null,keepNext=false,line=null,tabRight=false}={}){
  let pPr='';
  // 9360 twips = 6.5in = the full text measure at 1in margins; a 'left' tab
  // there lands on the far (left) edge of an RTL line.
  if(tabRight) pPr+='<w:tabs><w:tab w:val="left" w:pos="9360"/></w:tabs>';
  if(keepNext) pPr+='<w:keepNext/>';
  if(rule) pPr+='<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="'+INK+'"/></w:pBdr>';
  pPr+='<w:bidi/>';
  if(ind!==null) pPr+='<w:ind w:right="'+ind+'" w:hanging="0"/>';
  pPr+='<w:spacing w:before="'+before+'" w:after="'+after+'"'+(line?' w:line="'+line+'" w:lineRule="auto"':'')+'/>';
  pPr+='<w:jc w:val="'+jc+'"/>';
  return '<w:p><w:pPr>'+pPr+'</w:pPr>'+inner+'</w:p>';
}

let body='';

/* ================= HEADER — centered, Harvard style ================= */
body+=P(ar('جاسم أحمد اليونس',{b:true,sz:T.name,color:INK,space:'20'}),{jc:'center',after:20});
body+=P(ar('مهندس برمجيات  |  مطوّر ',{sz:T.role,color:MUTED})+
        en('Odoo 19',{sz:T.role,color:MUTED})+
        ar('  |  حلول ',{sz:T.role,color:MUTED})+
        en('ERP',{sz:T.role,color:MUTED})+
        ar(' و',{sz:T.role,color:MUTED})+
        en('SaaS',{sz:T.role,color:MUTED}),
        {jc:'center',after:40});
// contact on ONE line, as the format prescribes
body+=P(ar('بيروت، لبنان',{sz:T.contact,color:BODY})+
        ar('  •  ',{sz:T.contact,color:MUTED})+
        en('+1 (931) 623-7215',{sz:T.contact,color:BODY})+
        ar('  •  ',{sz:T.contact,color:MUTED})+
        en('jasemalyounes@gmail.com',{sz:T.contact,color:BODY})+
        ar('  •  ',{sz:T.contact,color:MUTED})+
        en('github.com/jasemalyounes-rgb',{sz:T.contact,color:BODY}),
        {jc:'center',after:120});

/* ================= section heading: bold + full-width rule ================= */
function H(text){
  return P(ar(text,{b:true,sz:T.head,color:INK,space:'30'}),
           {before:200,after:60,rule:true,keepNext:true});
}
/* role line: title on the right, dates pushed to the far left via a tab */
function ROLE(title,org,dates){
  let s=ar(title,{b:true,sz:T.role_t,color:INK});
  if(org){ s+=ar('، ',{sz:T.role_t,color:INK}); s+=mixed(org,{sz:T.role_t,color:INK}); }
  // Dates on their own line: a tab stop at the far margin wrapped long URLs
  // and date strings onto a second line mid-word.
  let out=P(s,{before:120,after:0,keepNext:true});
  out+=P(mixed(dates,{sz:T.date,color:MUTED,i:true}),{after:40,keepNext:true});
  return out;
}
function BULLET(label,text){
  let s=ar('•  ',{sz:T.body,color:INK});
  if(label) s+=ar(label,{b:true,sz:T.body,color:BODY});
  s+=mixed(text,{sz:T.body,color:BODY});
  return P(s,{after:30,ind:0,line:'252'});
}

/* ================= SUMMARY ================= */
body+=H('الملخّص المهني');
body+=P(mixed('مهندس برمجيات حاصل على ماجستير في علوم الويب وبكالوريوس في هندسة البرمجيات، مع أكثر من خمس سنوات من الخبرة في بناء تطبيقات متكاملة قابلة للتوسّع وإدارة دورة حياة المشاريع التقنية لدى Lazer Net ISP. متخصص في ربط بيانات المؤسسات المعقّدة (Oracle) بمعماريات الويب الحديثة، وخبير في تطوير Odoo 19 وإدارة الأنظمة والدعم التقني وممارسات DevOps.',
  {sz:T.body,color:BODY}),{after:40,line:'252'});

/* ================= EXPERIENCE ================= */
body+=H('الخبرات العملية');
body+=ROLE('مطوّر أنظمة ERP مستقل','','أيلول 2024 – حتّى الآن');
body+=BULLET('تطوير أنظمة ERP: ','تصميم وبناء حل مخصّص لإدارة المهام على Odoo 19 يتضمّن تفويض المدراء وتتبّع أعمال البحث والتطوير.');
body+=BULLET('الواجهات الخلفية والأمامية: ','تصميم واجهات XML موروثة معقّدة وإجراءات مخصّصة لعروض القوائم، واستخدام Python وPostgreSQL لبناء منطق خلفي قابل للتوسّع.');
body+=BULLET('إدارة الأنظمة: ','إدارة خوادم Linux VPS، بما في ذلك إعداد Nginx كوكيل عكسي ونشر شهادات SSL/HTTPS.');
body+=BULLET('الأتمتة: ','إنشاء خدمات systemd مؤتمتة لضمان التوافر العالي واستمرارية أداء التطبيقات.');

body+=ROLE('مطوّر برمجيات / قائد فريق تقني','Lazer Net ISP','دمشق، سوريا  •  كانون الثاني 2019 – أيلول 2024');
body+=BULLET('قيادة المشاريع: ','إدارة دورة حياة المشاريع التقنية كاملةً من تحليل المتطلبات حتّى النشر النهائي.');
body+=BULLET('إدارة قواعد البيانات: ','تصميم وصيانة قواعد بيانات علائقية معقّدة (Oracle/SQL) مع ضمان سلامة البيانات وكفاءة الاسترجاع.');
body+=BULLET('التقارير الإدارية: ','إعداد تقارير تقنية دورية للإدارة العليا توثّق الإنجازات واستراتيجيات معالجة المخاطر.');
body+=BULLET('تقييم المخاطر: ','تحديد المخاطر التقنية المحتملة واقتراح استراتيجيات لضمان توافق المشاريع مع معايير الجودة.');
body+=BULLET('البنية التحتية والدعم: ','إدارة البنية التحتية للشبكات ومعالجة أعطال الأجهزة والبرمجيات وتقديم الدعم التقني.');

/* ================= PROJECTS ================= */
body+=H('مشاريع مختارة');
function PROJECT(name,desc,stack,url,label){
  let head=en(name,{b:true,sz:T.role_t,color:INK});
  if(url){ head+=ar('   —   ',{sz:T.meta,color:MUTED})+link(url,label); }
  let out=P(head,{before:110,after:20,keepNext:true});
  out+=P(mixed(desc,{sz:T.body,color:BODY}),{after:20,ind:0,line:'252'});
  out+=P(ar('التقنيات: ',{b:true,sz:T.meta,color:MUTED})+en(stack,{sz:T.meta,color:MUTED}),
         {after:30,ind:0});
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
  return P(ar('•  ',{sz:T.body,color:INK})+ar(label,{b:true,sz:T.body,color:BODY})+mixed(value,{sz:T.body,color:BODY}),
           {after:30,ind:0,line:'252'});
}
body+=SKILL('تطوير البرمجيات: ','Python, Java, Spring Boot, C#, JavaScript, XML, PHP, Laravel, RESTful APIs.');
body+=SKILL('إدارة الأنظمة وDevOps: ','Linux VPS, Nginx, SSH Security, SSL/HTTPS, Systemd.');
body+=SKILL('قواعد البيانات: ','Oracle Database, PostgreSQL, SQL Server — الإدارة والتصميم والتحليل.');
body+=SKILL('البنية التحتية والدعم: ','شهادة CCNA، وخبرة قوية في بنية الشبكات ومعالجة أعطال الأجهزة والبرمجيات والدعم التقني.');
body+=SKILL('إدارة المشاريع: ','جمع المتطلبات، وتحديد المخاطر، وتنسيق أصحاب المصلحة، وإعداد التوثيق التقني.');
body+=SKILL('أدوات المكتب: ','إتقان متقدّم لبرامج Word وExcel (إعداد التقارير) وPowerPoint.');

/* ================= EDUCATION ================= */
body+=H('التعليم');
body+=ROLE('ماجستير في علوم الويب','الجامعة الافتراضية السورية','حزيران 2024');
body+=ROLE('بكالوريوس في هندسة البرمجيات','جامعة حلب','تشرين الأول 2012');

/* ================= LANGUAGES ================= */
body+=H('اللغات');
body+=P(ar('•  ',{sz:T.body,color:INK})+ar('العربية: ',{b:true,sz:T.body,color:BODY})+ar('اللغة الأم',{sz:T.body,color:BODY}),{after:30,ind:0});
body+=P(ar('•  ',{sz:T.body,color:INK})+ar('الإنجليزية: ',{b:true,sz:T.body,color:BODY})+ar('إتقان تام (قراءةً وكتابةً ومحادثةً)',{sz:T.body,color:BODY}),{after:30,ind:0});

/* Right-aligned tab stop at the left margin, so dates/links sit flush left
   on an RTL line. Page: 1 inch margins, the Harvard default.               */
const sect='<w:sectPr><w:bidi/><w:pgSz w:w="12240" w:h="15840"/>'+
  '<w:pgMar w:top="1000" w:right="1080" w:bottom="1000" w:left="1080" w:header="600" w:footer="600" w:gutter="0"/>'+
  '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>';

const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '+
'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
'<w:body>'+body+sect+'</w:body></w:document>';

fs.writeFileSync('ar/word/document.xml',doc);
fs.writeFileSync('ar/word/_rels/document.xml.rels',rels);

const boxes=doc.match(/[⁦-⁩‪-‮]/g);
console.log('built: '+(next-600)+' links, '+doc.length+' bytes');
console.log('box-rendering controls (FSI/PDI/LRE etc): '+(boxes?boxes.length+' FOUND':'0 — clean'));
console.log('RLM (zero-width, safe): '+((doc.match(/‏/g)||[]).length));
