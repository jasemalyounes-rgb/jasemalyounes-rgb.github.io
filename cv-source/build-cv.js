const fs=require('fs');

/* ============================================================================
   CV generator — Harvard-classic single column, Arabic (RTL) + English (LTR).

   Run:  node build.js ar     -> writes ar/word/document.xml
         node build.js en     -> writes en/word/document.xml

   Layout follows the format ATS guidance and recruiters converge on for 2026:
   one column top-to-bottom, centered name, contact on one line, bold section
   headings with a full-width rule, dense bullets, no icons/sidebars, and a
   single restrained accent used only for links.

   RTL: <w:bidi/> and <w:jc w:val="right"/> are written on EVERY paragraph AND
   into the Normal style. Word strips paragraph-level bidi when it re-saves a
   document (it did exactly that on the previous build, leaving the file LTR),
   so the style-level copy is what actually makes it stick.
   ========================================================================== */

const LANG=(process.argv[2]||'ar').toLowerCase();
const RTL_DOC = LANG==='ar';
const DIR = RTL_DOC ? 'ar' : 'en';

const RLM='‏';
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const HL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

let rels=fs.readFileSync('base_rels.xml','utf8');
let next=700;
function relId(url){
  const id='rIdX'+(next++);
  rels=rels.replace('</Relationships>','<Relationship Id="'+id+'" Type="'+HL+'" Target="'+esc(url)+'" TargetMode="External"/></Relationships>');
  return id;
}

/* Arabic needs ~2pt more than Latin to match optically: Sakkal Majalla has a
   noticeably smaller x-height than Calibri. */
const T = RTL_DOC
  ? { name:'52', role:'24', contact:'21', head:'28', role_t:'26', date:'21', body:'26', meta:'22' }
  : { name:'44', role:'22', contact:'19', head:'24', role_t:'23', date:'19', body:'21', meta:'19' };

const INK='000000', BODY='1A1A1A', MUTED='595959', ACCENT='1F3864';
const AR_FONT='Sakkal Majalla', EN_FONT='Calibri';

function run(text,{dir=null,b=false,i=false,sz=T.body,color=BODY,space=null}={}){
  const d = dir || (RTL_DOC?'ar':'en');
  const font = d==='en' ? EN_FONT : AR_FONT;
  let rPr='<w:rFonts w:ascii="'+font+'" w:hAnsi="'+font+'" w:cs="'+AR_FONT+'"/>';
  if(b) rPr+='<w:b/><w:bCs/>';
  if(i) rPr+='<w:i/><w:iCs/>';
  if(space) rPr+='<w:spacing w:val="'+space+'"/>';
  rPr+='<w:color w:val="'+color+'"/><w:sz w:val="'+sz+'"/><w:szCs w:val="'+sz+'"/>';
  rPr+= d==='en' ? '<w:rtl w:val="0"/>' : '<w:rtl/>';
  return '<w:r><w:rPr>'+rPr+'</w:rPr><w:t xml:space="preserve">'+esc(text)+'</w:t></w:r>';
}
const ar=(t,o)=>run(t,Object.assign({dir:'ar'},o));
const en=(t,o)=>run(t,Object.assign({dir:'en'},o));
const tx=(t,o)=>run(t,o);                       // text in the document's own script

const LATIN=/([+(#@]?[A-Za-z0-9][A-Za-z0-9 .,:/@#+()'’&_-]*[A-Za-z0-9)]|[+(#@]?[A-Za-z0-9]+)/g;

// Only meaningful in the RTL document: split mixed Arabic/Latin into
// explicitly-directional runs. In the LTR document everything is one run.
function mixed(text,opts={}){
  if(!RTL_DOC) return en(text,opts);
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
  for(let k=0;k<merged.length;k++){
    if(merged[k][0]!=='ar'||!(k>0&&merged[k-1][0]==='en')) continue;
    const m=merged[k][1].match(/^(\s*)([.,:;!?،؛])([\s\S]*)$/);
    if(m) merged[k][1]=m[1]+RLM+m[2]+m[3];   // RLM after the space, not before
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

const MAIN_JC = RTL_DOC ? 'right' : 'left';
function P(inner,{before=0,after=0,rule=false,jc=null,keepNext=false,line=null}={}){
  let pPr='';
  if(keepNext) pPr+='<w:keepNext/>';
  if(rule) pPr+='<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="'+INK+'"/></w:pBdr>';
  if(RTL_DOC) pPr+='<w:bidi/>';
  pPr+='<w:spacing w:before="'+before+'" w:after="'+after+'"'+(line?' w:line="'+line+'" w:lineRule="auto"':'')+'/>';
  pPr+='<w:jc w:val="'+(jc||MAIN_JC)+'"/>';
  return '<w:p><w:pPr>'+pPr+'</w:pPr>'+inner+'</w:p>';
}

/* ------------------------------------------------------------------ CONTENT */
const C = RTL_DOC ? {
  name:'جاسم أحمد اليونس',
  roleBits:[['ar','مهندس برمجيات  |  مطوّر '],['en','Odoo 19'],['ar','  |  حلول '],['en','ERP'],['ar',' و'],['en','SaaS']],
  loc:'بيروت، لبنان',
  h:{sum:'الملخّص المهني',exp:'الخبرات العملية',proj:'مشاريع مختارة',skill:'المهارات التقنية والإدارية',edu:'التعليم',lang:'اللغات'},
  summary:'مهندس برمجيات حاصل على ماجستير في علوم الويب وبكالوريوس في هندسة البرمجيات، مع أكثر من خمس سنوات من الخبرة في بناء تطبيقات متكاملة قابلة للتوسّع وإدارة دورة حياة المشاريع التقنية لدى Lazer Net ISP. متخصص في ربط بيانات المؤسسات المعقّدة (Oracle) بمعماريات الويب الحديثة، وخبير في تطوير Odoo 19 وإدارة الأنظمة والدعم التقني وممارسات DevOps.',
  roles:[
    {t:'مطوّر أنظمة ERP مستقل',o:'',d:'أيلول 2024 – حتّى الآن',b:[
      ['تطوير أنظمة ERP: ','تصميم وبناء حل مخصّص لإدارة المهام على Odoo 19 يتضمّن تفويض المدراء وتتبّع أعمال البحث والتطوير.'],
      ['الواجهات الخلفية والأمامية: ','تصميم واجهات XML موروثة معقّدة وإجراءات مخصّصة لعروض القوائم، واستخدام Python وPostgreSQL لبناء منطق خلفي قابل للتوسّع.'],
      ['إدارة الأنظمة: ','إدارة خوادم Linux VPS، بما في ذلك إعداد Nginx كوكيل عكسي ونشر شهادات SSL/HTTPS.'],
      ['الأتمتة: ','إنشاء خدمات systemd مؤتمتة لضمان التوافر العالي واستمرارية أداء التطبيقات.']]},
    {t:'مطوّر برمجيات / قائد فريق تقني',o:'Lazer Net ISP',d:'دمشق، سوريا  •  كانون الثاني 2019 – أيلول 2024',b:[
      ['قيادة المشاريع: ','إدارة دورة حياة المشاريع التقنية كاملةً من تحليل المتطلبات حتّى النشر النهائي.'],
      ['إدارة قواعد البيانات: ','تصميم وصيانة قواعد بيانات علائقية معقّدة (Oracle/SQL) مع ضمان سلامة البيانات وكفاءة الاسترجاع.'],
      ['التقارير الإدارية: ','إعداد تقارير تقنية دورية للإدارة العليا توثّق الإنجازات واستراتيجيات معالجة المخاطر.'],
      ['تقييم المخاطر: ','تحديد المخاطر التقنية المحتملة واقتراح استراتيجيات لضمان توافق المشاريع مع معايير الجودة.'],
      ['البنية التحتية والدعم: ','إدارة البنية التحتية للشبكات ومعالجة أعطال الأجهزة والبرمجيات وتقديم الدعم التقني.'],
      ['التدريب والتأهيل: ','تصميم وتقديم دورات تدريبية للموظفين والفنيين في البرمجة وأنظمة التشغيل وقواعد البيانات (SQL) والشبكات، مع إعداد المواد التدريبية وتقييم المتدرّبين.']]}],
  techLabel:'التقنيات: ',
  projects:[
    ['Harmonia','تطبيق لسلامة العائلة ومشاركة الموقع يوفّر التتبّع المباشر وتنبيهات الاستغاثة والمناطق الجغرافية وأدوار الأوصياء، مع بديل يعمل عبر الرسائل القصيرة دون إنترنت؛ تولّيت بناء التطبيق والواجهة الخلفية والبنية التحتية بالكامل.','React Native (Expo), TypeScript, Fastify, PostgreSQL','https://harmonia-safety.vercel.app/','harmonia-safety.vercel.app'],
    ['Smart Task Planner','تطبيق مستقل لإدارة المشاريع على Odoo 19 منشور على متجر تطبيقات Odoo، يتضمّن مخطط Gantt تفاعلي مع إعادة الجدولة بالسحب والإفلات والاعتماديات، ولوحة كانبان بسبع مراحل، وجداول زمنية ولوحات تحكّم تنفيذية، دون الاعتماد على النسخة المؤسسية.','Odoo 19, Python, PostgreSQL, OWL, XML','https://apps.odoo.com/apps/modules/19.0/smart_task_planner','apps.odoo.com'],
    ['Super Proxy Store','بوت تيليجرام لبيع خدمات البروكسي، يدمج Cryptomus لشحن المحفظة بالعملات الرقمية إضافةً إلى مسار تأكيد يدوي لخدمات OMT وWhish وسيريتل كاش — وهي قنوات دفع إقليمية بلا واجهات برمجية عامة — عبر مُهيّئات موردين قابلة للتبديل.','Node.js, Telegraf, Fastify, PostgreSQL','https://t.me/myproxystore_bot','t.me/myproxystore_bot'],
    ['Legends Match','لعبة ذاكرة للهواتف المحمولة تتضمّن تسجيل الدخول عبر Google وتحقيق الدخل بواسطة AdMob واقتصاد عملات داخل اللعبة ونظام إحالة وصرف مدعوم بلوحة تحكّم إدارية.','React Native (Expo), Fastify, PostgreSQL, AdMob',null,null]],
  skills:[
    ['تطوير البرمجيات: ','Python, Java, Spring Boot, C#, JavaScript, XML, PHP, Laravel, RESTful APIs.'],
    ['إدارة الأنظمة وDevOps: ','Linux VPS, Nginx, SSH Security, SSL/HTTPS, Systemd.'],
    ['قواعد البيانات: ','Oracle Database, PostgreSQL, SQL Server — الإدارة والتصميم والتحليل.'],
    ['البنية التحتية والدعم: ','شهادة CCNA، وخبرة قوية في بنية الشبكات ومعالجة أعطال الأجهزة والبرمجيات والدعم التقني.'],
    ['إدارة المشاريع: ','جمع المتطلبات، وتحديد المخاطر، وتنسيق أصحاب المصلحة، وإعداد التوثيق التقني.'],
    ['التدريب والتأهيل: ','إعداد وتقديم دورات تدريبية في البرمجة وأنظمة التشغيل وقواعد البيانات (SQL) والشبكات.'],
    ['أدوات المكتب: ','إتقان متقدّم لبرامج Word وExcel (إعداد التقارير) وPowerPoint.']],
  edu:[['ماجستير في علوم الويب','الجامعة الافتراضية السورية','حزيران 2024'],
       ['بكالوريوس في هندسة البرمجيات','جامعة حلب','تشرين الأول 2012']],
  langs:[['العربية: ','اللغة الأم'],['الإنجليزية: ','إتقان تام (قراءةً وكتابةً ومحادثةً)']]
} : {
  name:'Jasem Ahmad Alyounes',
  roleBits:[['en','Software Engineer  |  Odoo 19 Developer  |  ERP & SaaS Solutions']],
  loc:'Beirut, Lebanon',
  h:{sum:'PROFESSIONAL SUMMARY',exp:'EXPERIENCE',proj:'SELECTED PROJECTS',skill:'TECHNICAL & MANAGEMENT SKILLS',edu:'EDUCATION',lang:'LANGUAGES'},
  summary:'Software Engineer with a Master’s in Web Science and a Bachelor’s in Software Engineering, and over 5 years of experience building scalable full-stack applications and managing technical project lifecycles at Lazer Net ISP. Specialized in bridging complex enterprise data (Oracle) with modern web architectures; expert in Odoo 19 development, systems administration, technical support and DevOps practices.',
  roles:[
    {t:'Independent ERP Developer',o:'',d:'Sep 2024 – Present',b:[
      ['ERP Development: ','Architected a custom Odoo 19 task management solution featuring manager-level delegation and R&D tracking.'],
      ['Backend & Frontend: ','Designed complex inherited XML views and custom list-view actions; used Python and PostgreSQL for scalable backend logic.'],
      ['System Administration: ','Managed Linux VPS environments, including Nginx reverse proxy setup and SSL/HTTPS deployment.'],
      ['Automation: ','Established automated systemd services to ensure high availability and seamless application performance.']]},
    {t:'Software Developer / Technical Team Lead',o:'Lazer Net ISP',d:'Damascus, Syria  •  Jan 2019 – Sep 2024',b:[
      ['Project Leadership: ','Managed the full technical project lifecycle from requirements analysis to final deployment.'],
      ['Database Management: ','Designed and maintained complex relational databases (Oracle/SQL), ensuring data integrity and efficient retrieval.'],
      ['Stakeholder Reporting: ','Prepared technical progress reports for senior management, documenting milestones and mitigation strategies.'],
      ['Risk Assessment: ','Identified potential technical risks and proposed strategies to keep projects aligned with quality standards.'],
      ['Infrastructure & Support: ','Managed network infrastructure, hardware/software troubleshooting and IT support.'],
      ['Training & Instruction: ','Designed and delivered technical training for staff and technicians across programming, operating systems, SQL and networking, including course material and trainee assessment.']]}],
  techLabel:'Stack: ',
  projects:[
    ['Harmonia','Family safety and location-sharing app providing live tracking, SOS alerts, geofenced places and guardian roles, with an offline SMS fallback; built the mobile client, API and self-hosted infrastructure end to end.','React Native (Expo), TypeScript, Fastify, PostgreSQL','https://harmonia-safety.vercel.app/','harmonia-safety.vercel.app'],
    ['Smart Task Planner','Standalone Odoo 19 project-management app published on the Odoo App Store, featuring an interactive Gantt with drag-and-drop rescheduling and dependencies, a seven-stage kanban, timesheets and executive dashboards, with no Enterprise dependency.','Odoo 19, Python, PostgreSQL, OWL, XML','https://apps.odoo.com/apps/modules/19.0/smart_task_planner','apps.odoo.com'],
    ['Super Proxy Store','Telegram bot for selling proxy access, integrating Cryptomus for crypto wallet top-ups plus a manual confirmation flow for OMT, Whish and Syriatel Cash — regional payment rails with no public API — behind pluggable supplier adapters.','Node.js, Telegraf, Fastify, PostgreSQL','https://t.me/myproxystore_bot','t.me/myproxystore_bot'],
    ['Legends Match','Cross-platform mobile game with Google Sign-In, AdMob monetization, an in-game coin economy and a referral and cashout system backed by an admin dashboard.','React Native (Expo), Fastify, PostgreSQL, AdMob',null,null]],
  skills:[
    ['Software Development: ','Python, Java, Spring Boot, C#, JavaScript, XML, PHP, Laravel, RESTful APIs.'],
    ['Systems & DevOps: ','Linux VPS, Nginx, SSH Security, SSL/HTTPS, Systemd.'],
    ['Databases: ','Oracle Database, PostgreSQL, SQL Server — administration, design and analysis.'],
    ['Infrastructure & Support: ','CCNA certified; strong proficiency in network infrastructure, hardware/software troubleshooting and IT support.'],
    ['Project Management: ','Requirements gathering, risk identification, stakeholder coordination and technical documentation.'],
    ['Training & Instruction: ','Delivered technical training in programming, operating systems, SQL and networking.'],
    ['Office Tools: ','Advanced proficiency in Word, Excel (reporting) and PowerPoint.']],
  edu:[['M.Sc. in Web Science','Syrian Virtual University','Jun 2024'],
       ['B.Sc. in Software Engineering','University of Aleppo','Oct 2012']],
  langs:[['Arabic: ','Native'],['English: ','Fluent (reading, writing, speaking)']]
};

/* ------------------------------------------------------------------- BUILD */
let body='';

body+=P(tx(C.name,{b:true,sz:T.name,color:INK,space:'20'}),{jc:'center',after:20});
body+=P(C.roleBits.map(([d,t])=>run(t,{dir:d,sz:T.role,color:MUTED})).join(''),{jc:'center',after:40});
const sep=run('  •  ',{dir:RTL_DOC?'ar':'en',sz:T.contact,color:MUTED});
body+=P(tx(C.loc,{sz:T.contact,color:BODY})+sep+
        en('+1 (931) 623-7215',{sz:T.contact,color:BODY})+sep+
        en('jasemalyounes@gmail.com',{sz:T.contact,color:BODY})+sep+
        en('github.com/jasemalyounes-rgb',{sz:T.contact,color:BODY}),
        {jc:'center',after:120});

const H=t=>P(tx(t,{b:true,sz:T.head,color:INK,space:'30'}),{before:200,after:60,rule:true,keepNext:true});

body+=H(C.h.sum);
body+=P(mixed(C.summary,{sz:T.body,color:BODY}),{after:40,line:'252'});

body+=H(C.h.exp);
for(const r of C.roles){
  let head=tx(r.t,{b:true,sz:T.role_t,color:INK});
  if(r.o) head+=tx(RTL_DOC?'، ':', ',{sz:T.role_t,color:INK})+mixed(r.o,{sz:T.role_t,color:INK});
  body+=P(head,{before:120,after:0,keepNext:true});
  body+=P(mixed(r.d,{sz:T.date,color:MUTED,i:true}),{after:40,keepNext:true});
  for(const [lab,txt] of r.b)
    body+=P(tx('•  ',{sz:T.body,color:INK})+tx(lab,{b:true,sz:T.body,color:BODY})+mixed(txt,{sz:T.body,color:BODY}),
            {after:30,line:'252'});
}

body+=H(C.h.proj);
for(const [name,desc,stack,url,label] of C.projects){
  let head=en(name,{b:true,sz:T.role_t,color:INK});
  if(url) head+=tx('   —   ',{sz:T.meta,color:MUTED})+link(url,label);
  body+=P(head,{before:110,after:20,keepNext:true});
  body+=P(mixed(desc,{sz:T.body,color:BODY}),{after:20,line:'252'});
  body+=P(tx(C.techLabel,{b:true,sz:T.meta,color:MUTED})+en(stack,{sz:T.meta,color:MUTED}),{after:30});
}

body+=H(C.h.skill);
for(const [lab,val] of C.skills)
  body+=P(tx('•  ',{sz:T.body,color:INK})+tx(lab,{b:true,sz:T.body,color:BODY})+mixed(val,{sz:T.body,color:BODY}),
          {after:30,line:'252'});

body+=H(C.h.edu);
for(const [deg,school,date] of C.edu){
  body+=P(tx(deg,{b:true,sz:T.role_t,color:INK})+tx(RTL_DOC?'، ':', ',{sz:T.role_t,color:INK})+mixed(school,{sz:T.role_t,color:INK}),
          {before:110,after:0,keepNext:true});
  body+=P(mixed(date,{sz:T.date,color:MUTED,i:true}),{after:40});
}

body+=H(C.h.lang);
for(const [lab,val] of C.langs)
  body+=P(tx('•  ',{sz:T.body,color:INK})+tx(lab,{b:true,sz:T.body,color:BODY})+tx(val,{sz:T.body,color:BODY}),{after:30});

const sect='<w:sectPr>'+(RTL_DOC?'<w:bidi/>':'')+'<w:pgSz w:w="12240" w:h="15840"/>'+
  '<w:pgMar w:top="1000" w:right="1080" w:bottom="1000" w:left="1080" w:header="600" w:footer="600" w:gutter="0"/>'+
  '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>';

const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '+
'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
'<w:body>'+body+sect+'</w:body></w:document>';

fs.writeFileSync(DIR+'/word/document.xml',doc);
fs.writeFileSync(DIR+'/word/_rels/document.xml.rels',rels);

const boxes=doc.match(/[⁦-⁩‪-‮]/g);
console.log('['+DIR+'] '+(next-700)+' links, '+doc.length+' bytes'+
            ' | box-chars: '+(boxes?boxes.length+' FOUND':'0')+
            ' | RLM: '+((doc.match(/‏/g)||[]).length)+
            ' | bidi paras: '+((doc.match(/<w:bidi\/>/g)||[]).length));
