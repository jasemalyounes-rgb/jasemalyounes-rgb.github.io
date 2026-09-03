// Minimal CDP client: evaluate an expression in the page and print the result.
// Also collects console errors / uncaught exceptions seen since page load.
const net=require('net'),crypto=require('crypto');
const m=process.argv[2].match(/^ws:\/\/([^:]+):(\d+)(\/.*)$/);
const expr=process.argv[3];
const key=crypto.randomBytes(16).toString('base64');
const sock=net.connect(+m[2],m[1],()=>sock.write('GET '+m[3]+' HTTP/1.1\r\nHost: '+m[1]+':'+m[2]+'\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '+key+'\r\nSec-WebSocket-Version: 13\r\n\r\n'));
function enc(p){const b=Buffer.from(p),mask=crypto.randomBytes(4);let h;const l=b.length;
 if(l<126){h=Buffer.from([0x81,0x80|l]);}
 else if(l<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=0xFE;h.writeUInt16BE(l,2);}
 else {h=Buffer.alloc(10);h[0]=0x81;h[1]=0xFF;h.writeUInt32BE(0,2);h.writeUInt32BE(l,6);}
 const o=Buffer.alloc(l);for(let i=0;i<l;i++)o[i]=b[i]^mask[i%4];return Buffer.concat([h,mask,o]);}
let hs=false,buf=Buffer.alloc(0),tries=0;
const errs=[];
function send(id,method,params){sock.write(enc(JSON.stringify({id,method,params:params||{}})));}
function ask(){send(100+(++tries),'Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});}
sock.on('data',d=>{buf=Buffer.concat([buf,d]);
 if(!hs){const i=buf.indexOf('\r\n\r\n');if(i<0)return;hs=true;buf=buf.slice(i+4);
   send(1,'Runtime.enable'); send(2,'Log.enable'); setTimeout(ask,2500);}
 while(buf.length>=2){let l=buf[1]&127,off=2;
  if(l===126){if(buf.length<4)return;l=buf.readUInt16BE(2);off=4;}
  else if(l===127){if(buf.length<10)return;l=Number(buf.readBigUInt64BE(2));off=10;}
  if(buf.length<off+l)return;
  const p=buf.slice(off,off+l).toString();buf=buf.slice(off+l);
  let msg;try{msg=JSON.parse(p);}catch(e){continue;}
  if(msg.method==='Runtime.exceptionThrown'){
    const e=msg.params.exceptionDetails;
    errs.push('EXCEPTION: '+((e.exception&&e.exception.description)||e.text));
  }
  if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')
    errs.push('ERROR('+msg.params.entry.source+'): '+msg.params.entry.text);
  if(msg.id>=101){
   if(msg.result&&msg.result.exceptionDetails){
     console.log('EVAL EXCEPTION: '+JSON.stringify(msg.result.exceptionDetails.exception&&msg.result.exceptionDetails.exception.description||msg.result.exceptionDetails.text));
     process.exit(1);
   }
   const v=msg.result&&msg.result.result&&msg.result.result.value;
   if(v&&v!=='PENDING'){
     console.log(v);
     console.log('CONSOLE ERRORS: '+(errs.length?JSON.stringify(errs):'none'));
     process.exit(0);
   }
   if(tries<10) return setTimeout(ask,1500);
   console.log('gave up: '+v); process.exit(1);
  }
 }});
setTimeout(()=>{console.log('TIMEOUT');process.exit(1);},40000);
