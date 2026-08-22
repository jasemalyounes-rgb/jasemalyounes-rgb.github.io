// Wrap Latin/number runs in FSI...PDI isolates.
//
// Rules learned the hard way:
//  1. Brackets must balance inside the isolate — grabbing a closing ")" without
//     its opening "(" duplicates the paren on screen.
//  2. Sentence punctuation (. ، ؛ :) stays OUTSIDE the isolate but is bidi
//     neutral, so it needs an RLM (U+200F) after it to resolve right-to-left;
//     otherwise periods jump to the left edge of the line.
//  3. A leading "+" or "(" belongs INSIDE the isolate (phone numbers), and
//     trailing symbols like "#" in "C#" must not be split off.
const FSI='⁨', PDI='⁩', RLM='‏';

const LATIN=/[A-Za-z0-9]/;
const INNER=/[ .,:/@#+'’&_-]/;          // may appear inside a run
const LEADIN=/[+(#@]/;                        // may start a run

function isolate(text){
  let out='', i=0;
  while(i<text.length){
    // a run may start with + ( # @ when directly followed by latin/digit
    let start=i;
    if(LEADIN.test(text[i]) && i+1<text.length && LATIN.test(text[i+1])){
      // only treat as lead-in if the previous char is not latin (else it is inner)
      if(i===0 || !LATIN.test(text[i-1])) { /* keep start=i */ }
    } else if(!LATIN.test(text[i])){ out+=text[i++]; continue; }

    let j=start, depth=0, lastGood=-1;
    while(j<text.length){
      const c=text[j];
      if(LATIN.test(c)){ lastGood=j; j++; continue; }
      if(c==='('){ depth++; j++; continue; }
      if(c===')'){ if(depth===0) break; depth--; lastGood=j; j++; continue; }
      if(c==='+'||c==='#'||c==='@'){
        // keep if glued to latin on either side (C#, +1, a@b)
        const prevLatin=j>start&&LATIN.test(text[j-1]);
        const nextLatin=j+1<text.length&&LATIN.test(text[j+1]);
        if(prevLatin||nextLatin){ if(prevLatin) lastGood=j; j++; continue; }
        break;
      }
      if(INNER.test(c)){
        const rest=text.slice(j);
        // A separator continues the SAME isolate when more Latin follows, so a
        // comma-separated list ("Python, Java, C#") stays one left-to-right run
        // instead of N isolates that the RTL paragraph would then reverse.
        if(/^[ ]+[A-Za-z0-9(+]/.test(rest)||
           /^[.,:/'’&_-]+[ ]*[A-Za-z0-9(]/.test(rest)){ j++; continue; }
        break;
      }
      break;
    }
    if(lastGood<0){ out+=text[i++]; continue; }
    const frag=text.slice(start,lastGood+1);
    out+=FSI+frag+PDI;
    let end=lastGood+1;
    // Sentence punctuation right after an isolate is bidi-neutral, so at the end
    // of a line it drifts to the left edge. Emit the punctuation and then an RLM
    // AFTER it, giving the neutral a strong RTL neighbour to attach to.
    while(end<text.length && /[.،؛:!?]/.test(text[end])){ out+=text[end]; end++; }
    if(out.endsWith('.')||out.endsWith('،')||out.endsWith('؛')||
       out.endsWith(':')||out.endsWith('!')||out.endsWith('?')) out+=RLM;
    i=end;
  }
  return out;
}

module.exports={isolate,FSI,PDI,RLM};

if(require.main===module){
  const tests=[
    'معقّدة (Oracle) بمعماريات',
    'شهادات SSL/HTTPS.',
    'إدارة خوادم Linux VPS، بما في ذلك',
    'بيروت، لبنان  |  +1 (931) 623-7215  |  jasemalyounes@gmail.com',
    'واستخدام Python وPostgreSQL لبناء',
    'معقّدة (Oracle/SQL) مع ضمان',
    'Python, Java, Spring Boot, C#, JavaScript, XML, PHP, Laravel, RESTful APIs.',
    'إتقان متقدّم لبرامج Word وExcel (إعداد التقارير) وPowerPoint.',
    'على Odoo 19 يتضمّن تفويض',
    'React Native (Expo), TypeScript, Fastify, PostgreSQL'
  ];
  for(const t of tests){
    console.log('IN : '+t);
    console.log('OUT: '+isolate(t).replace(/⁨/g,'[').replace(/⁩/g,']').replace(/‏/g,'~'));
    console.log();
  }
}
