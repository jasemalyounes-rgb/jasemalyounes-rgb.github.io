const fs=require('fs');

/* ============================================================================
   Arabic CV builder.

   Key lesson from the first attempt: do NOT emit a separate run per language
   and toggle <w:rtl/>. Word then runs the Unicode bidi algorithm across those
   run boundaries and neutral characters (: . , ( ) —) at the edges resolve
   against the wrong direction, so labels, colons and periods jump to the wrong
   end of the line.

   Instead: keep every run RTL, and wrap each Latin/number fragment in
   FSI ... PDI (U+2068 / U+2069). An isolate is treated as a single neutral
   character by the surrounding paragraph, so the Arabic layout is unaffected
   while the Latin text inside is laid out left-to-right.
   ========================================================================== */

const {isolate,FSI,PDI}=require('./iso.js');

const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const HL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

// Read the ORIGINAL rels from the untouched base package: re-running this
// script must not append a second copy of the hyperlink relationships.
let rels=fs.readFileSync('base_rels.xml','utf8');
let next=400;
function relId(url){
  const id='rIdA'+(next++);
  rels=rels.replace('</Relationships>','<Relationship Id="'+id+'" Type="'+HL+'" Target="'+esc(url)+'" TargetMode="External"/></Relationships>');
  return id;
}

function iso(text){ return isolate(text); }

// --- run helpers: every run is RTL; direction changes come from isolates ---
const RTL='<w:rtl/>';
const r  =t=>'<w:r><w:rPr>'+RTL+'</w:rPr><w:t xml:space="preserve">'+esc(iso(t))+'</w:t></w:r>';
const rb =t=>'<w:r><w:rPr><w:b/><w:bCs/>'+RTL+'</w:rPr><w:t xml:space="preserve">'+esc(iso(t))+'</w:t></w:r>';
// raw = no isolation (used for pure-Arabic strings, marginally smaller output)
const rr =t=>'<w:r><w:rPr>'+RTL+'</w:rPr><w:t xml:space="preserve">'+esc(t)+'</w:t></w:r>';
const rrb=t=>'<w:r><w:rPr><w:b/><w:bCs/>'+RTL+'</w:rPr><w:t xml:space="preserve">'+esc(t)+'</w:t></w:r>';

function link(url,label){
  const id=relId(url);
  return '<w:hyperlink r:id="'+id+'"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/>'+RTL+'</w:rPr>'+
         '<w:t xml:space="preserve">'+esc(FSI+label+PDI)+'</w:t></w:r></w:hyperlink>';
}

// pPr: pStyle first, then bidi (schema order), then right alignment.
function P(styleName,inner){
  const st=styleName?'<w:pStyle w:val="'+styleName+'"/>':'';
  return '<w:p><w:pPr>'+st+'<w:bidi/><w:jc w:val="right"/></w:pPr>'+inner+'</w:p>';
}
const title=t=>P('Title',rr(t));
const h1=t=>P('Heading1',rr(t));
const h2=t=>P('Heading2',r(t));
const h3=t=>P('Heading3',r(t));
const para=inner=>P('',inner);
const bullet=inner=>P('ListBullet',inner);

let body='';

/* ---- header ---- */
body+=title('جاسم أحمد اليونس');
body+=para(r('بيروت، لبنان  |  +1 (931) 623-7215  |  jasemalyounes@gmail.com'));

/* ---- summary ---- */
body+=h1('الملخص المهني');
body+=para(r('مهندس برمجيات حاصل على ماجستير في علوم الويب وبكالوريوس في هندسة البرمجيات، مع أكثر من خمس سنوات من الخبرة في بناء تطبيقات متكاملة قابلة للتوسّع وإدارة دورة حياة المشاريع التقنية لدى Lazer Net ISP. متخصص في ربط بيانات المؤسسات المعقّدة (Oracle) بمعماريات الويب الحديثة، وخبير في تطوير Odoo 19 وإدارة الأنظمة والدعم التقني وممارسات DevOps.'));

/* ---- experience ---- */
body+=h1('الخبرات العملية');
body+=h3('أيلول 2024 – حتّى الآن');
body+=h2('مطوّر أنظمة ERP مستقل');
body+=para(rb('تطوير أنظمة ERP: ')+r('تصميم وبناء حل مخصّص لإدارة المهام على Odoo 19 يتضمّن تفويض المدراء وتتبّع أعمال البحث والتطوير.'));
body+=para(rrb('الواجهات الخلفية والأمامية: ')+r('تصميم واجهات XML موروثة معقّدة وإجراءات مخصّصة لعروض القوائم، واستخدام Python وPostgreSQL لبناء منطق خلفي قابل للتوسّع.'));
body+=para(rrb('إدارة الأنظمة: ')+r('إدارة خوادم Linux VPS، بما في ذلك إعداد Nginx كوكيل عكسي ونشر شهادات SSL/HTTPS.'));
body+=para(rrb('الأتمتة: ')+r('إنشاء خدمات systemd مؤتمتة لضمان التوافر العالي واستمرارية أداء التطبيقات.'));

body+=h3('دمشق، سوريا — كانون الثاني 2019 – أيلول 2024');
body+=h2('مطوّر برمجيات / قائد فريق تقني، Lazer Net ISP');
body+=para(rrb('قيادة المشاريع: ')+r('إدارة دورة حياة المشاريع التقنية كاملةً من تحليل المتطلبات حتّى النشر النهائي.'));
body+=para(rrb('إدارة قواعد البيانات: ')+r('تصميم وصيانة قواعد بيانات علائقية معقّدة (Oracle/SQL) مع ضمان سلامة البيانات وكفاءة الاسترجاع.'));
body+=para(rrb('التقارير الإدارية: ')+r('إعداد تقارير تقنية دورية للإدارة العليا توثّق الإنجازات واستراتيجيات معالجة المخاطر.'));
body+=para(rrb('تقييم المخاطر: ')+r('تحديد المخاطر التقنية المحتملة واقتراح استراتيجيات لضمان توافق المشاريع مع معايير الجودة.'));
body+=para(rrb('البنية التحتية والدعم: ')+r('إدارة البنية التحتية للشبكات ومعالجة أعطال الأجهزة والبرمجيات وتقديم الدعم التقني.'));

/* ---- education ---- */
body+=h1('التعليم');
body+=h3('حزيران 2024');
body+=h2('ماجستير في علوم الويب، الجامعة الافتراضية السورية');
body+=h3('تشرين الأول 2012');
body+=h2('بكالوريوس في هندسة البرمجيات، جامعة حلب');

/* ---- skills ---- */
body+=h1('المهارات التقنية والإدارية');
body+=bullet(rrb('تطوير البرمجيات: ')+r('Python, Java, Spring Boot, C#, JavaScript, XML, PHP, Laravel, RESTful APIs.'));
body+=bullet(rb('إدارة الأنظمة وDevOps: ')+r('Linux VPS, Nginx, SSH Security, SSL/HTTPS, Systemd.'));
body+=bullet(rrb('قواعد البيانات: ')+r('Oracle Database, PostgreSQL, SQL Server — الإدارة والتصميم والتحليل.'));
body+=bullet(rrb('البنية التحتية والدعم: ')+r('شهادة CCNA، وخبرة قوية في بنية الشبكات ومعالجة أعطال الأجهزة والبرمجيات والدعم التقني.'));
body+=bullet(rrb('إدارة المشاريع: ')+rr('جمع المتطلبات، وتحديد المخاطر، وتنسيق أصحاب المصلحة، وإعداد التوثيق التقني.'));
body+=bullet(rrb('أدوات المكتب: ')+r('إتقان متقدّم لبرامج Word وExcel (إعداد التقارير) وPowerPoint.'));

/* ---- projects ----
   Layout per bullet: **Name** — description  \n  التقنيات: stack.  link
   The em dash and the stack label stay Arabic-side; names/stacks/URLs are
   isolated so they read left-to-right without dragging the punctuation. */
function project(name,desc,stack,url,label){
  let s=rb(name+' — ')+r(desc)+rrb(' التقنيات: ')+r(stack+'.');
  if(url) s+=rr(' ')+link(url,label);
  return bullet(s);
}
body+=h1('مشاريع مختارة');
body+=project('Harmonia',
  'تطبيق لسلامة العائلة ومشاركة الموقع يوفّر التتبّع المباشر وتنبيهات الاستغاثة والمناطق الجغرافية وأدوار الأوصياء، مع بديل يعمل عبر الرسائل القصيرة دون إنترنت؛ تولّيت بناء التطبيق والواجهة الخلفية والبنية التحتية بالكامل.',
  'React Native (Expo), TypeScript, Fastify, PostgreSQL',
  'https://harmonia-safety.vercel.app/','harmonia-safety.vercel.app');
body+=project('Smart Task Planner',
  'تطبيق مستقل لإدارة المشاريع على Odoo 19 منشور على متجر تطبيقات Odoo، يتضمّن مخطط Gantt تفاعلي مع إعادة الجدولة بالسحب والإفلات والاعتماديات، ولوحة كانبان بسبع مراحل، وجداول زمنية ولوحات تحكّم تنفيذية، دون الاعتماد على النسخة المؤسسية.',
  'Odoo 19, Python, PostgreSQL, OWL, XML',
  'https://apps.odoo.com/apps/modules/19.0/smart_task_planner','apps.odoo.com');
body+=project('Super Proxy Store',
  'بوت تيليجرام لبيع خدمات البروكسي، يدمج Cryptomus لشحن المحفظة بالعملات الرقمية إضافةً إلى مسار تأكيد يدوي لخدمات OMT وWhish وسيريتل كاش — وهي قنوات دفع إقليمية بلا واجهات برمجية عامة — عبر مُهيّئات موردين قابلة للتبديل.',
  'Node.js, Telegraf, Fastify, PostgreSQL',
  'https://t.me/myproxystore_bot','t.me/myproxystore_bot');
body+=project('Legends Match',
  'لعبة ذاكرة للهواتف المحمولة تتضمّن تسجيل الدخول عبر Google وتحقيق الدخل بواسطة AdMob واقتصاد عملات داخل اللعبة ونظام إحالة وصرف مدعوم بلوحة تحكّم إدارية.',
  'React Native (Expo), Fastify, PostgreSQL, AdMob',
  null,null);

/* ---- languages ---- */
body+=h1('اللغات');
body+=para(rrb('العربية: ')+rr('اللغة الأم'));
body+=para(rrb('الإنجليزية: ')+rr('إتقان تام (قراءةً وكتابةً ومحادثةً)'));

const sect='<w:sectPr><w:bidi/><w:pgSz w:w="12240" w:h="15840"/>'+
  '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>'+
  '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>';

const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '+
'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
'<w:body>'+body+sect+'</w:body></w:document>';

fs.writeFileSync('ar/word/document.xml',doc);
fs.writeFileSync('ar/word/_rels/document.xml.rels',rels);
console.log('built: '+(next-400)+' links, '+doc.length+' bytes');
