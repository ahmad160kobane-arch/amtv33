"use strict";(()=>{var e={};e.id=313,e.ids=[313],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},785:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>g,patchFetch:()=>v,requestAsyncStorage:()=>h,routeModule:()=>m,serverHooks:()=>b,staticGenerationAsyncStorage:()=>f});var n={};r.r(n),r.d(n,{GET:()=>l});var o=r(9303),a=r(8716),i=r(670),s=r(7070);let c=["vidsrc.to","vidsrc.cc","vidsrc.me","vidsrc.net","2embed.cc","embed.su","autoembed.cc","multiembed.mov"],u=`<script>(function(){
var _AD=[
  'doubleclick','googlesyndication','adservice','adnxs','advertising',
  'popads','popcash','exoclick','trafficjunky','juicyads','adsterra',
  'propellerads','revcontent','outbrain','taboola','mgid','adclick',
  'yllix','popunder','hilltopads','adskeeper','clickadu','bidvertiser',
  'adblade','infolinks','vibrantmedia','zedo','valueclick','adform',
  'smartadserver','rubiconproject','openx','pubmatic','criteo','quantserve',
  'scorecardresearch','conversantmedia','yieldmanager','clicksor','kontera',
  'media.net','justpremium','admixer','adtelligent','undertone',
  'realgm','popup','popunder','redirect-','go.php','click.php'
];
function _bad(u){
  if(!u)return false;
  try{var h=new URL(String(u)).hostname.toLowerCase();
    return _AD.some(function(d){return h.includes(d);});
  }catch(e){return false;}
}
// 1. Block window.open
window.open=function(){return null;};
// 2. Block fetch
var _F=window.fetch;
window.fetch=function(u,o){
  if(_bad(typeof u==='string'?u:(u&&u.url)||''))return new Promise(function(){});
  return _F.apply(this,arguments);
};
// 3. Block XMLHttpRequest
var _XO=XMLHttpRequest.prototype.open;
var _XS=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){
  if(_bad(u)){this.__bl=1;return;}
  return _XO.apply(this,arguments);
};
XMLHttpRequest.prototype.send=function(){
  if(this.__bl)return;
  return _XS.apply(this,arguments);
};
// 4. MutationObserver — remove ad scripts/iframes as they are added
new MutationObserver(function(ms){
  ms.forEach(function(m){
    m.addedNodes.forEach(function(n){
      if(!n||n.nodeType!==1)return;
      var src=n.src||n.href||'';
      if(_bad(src)){n.remove();return;}
      if((n.tagName==='SCRIPT'||n.tagName==='IFRAME')&&n.src&&_bad(n.src)){n.remove();}
    });
  });
}).observe(document.documentElement,{childList:true,subtree:true});
// 5. Stop iframe from navigating parent
window.addEventListener('beforeunload',function(e){e.stopImmediatePropagation();},true);
// 6. Re-focus if focus stolen by popup
window.addEventListener('blur',function(){setTimeout(function(){try{window.focus();}catch(e){}},50);});
})();</script>`,d={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",Accept:"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9","Cache-Control":"no-cache",Pragma:"no-cache"};async function p(e,t){let r=await fetch(e,{headers:{...d,Referer:`${t.origin}/`},signal:AbortSignal.timeout(1e4)});if(!r.ok)throw Error(`HTTP ${r.status}`);let n=await r.text(),o=n.toLowerCase();if(n.length<4e3&&(o.includes("not found")||o.includes("404")||o.includes("403")||o.includes("forbidden")||o.includes("access denied")||o.includes("blocked")||o.includes("error")))throw Error("صفحة خطأ من المصدر");if(!o.includes("<html")&&!o.includes("<!doctype")&&!o.includes("<head"))throw Error("استجابة غير صالحة");let a=`<base href="${t.origin}/">`+u;if(n.includes("<head>"))return n.replace("<head>",`<head>${a}`);let i=n.match(/<head[^>]*>/i);return i?n.replace(i[0],`${i[0]}${a}`):`<head>${a}</head>`+n}async function l(e){let t;let r=e.nextUrl.searchParams.get("url");if(!r)return s.NextResponse.json({error:"url مطلوب"},{status:400});try{t=new URL(r)}catch{return s.NextResponse.json({error:"رابط غير صالح"},{status:400})}let n=t.hostname.replace(/^www\./,"");if(!c.some(e=>n===e||n.endsWith("."+e)))return s.NextResponse.json({error:"مصدر غير مسموح"},{status:403});try{let e=await p(r,t);return new s.NextResponse(e,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store, no-cache","X-Frame-Options":"ALLOWALL","Access-Control-Allow-Origin":"*"}})}catch(e){return s.NextResponse.json({error:e.message||"خطأ في الخادم"},{status:502})}}let m=new o.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/proxy/embed/route",pathname:"/api/proxy/embed",filename:"route",bundlePath:"app/api/proxy/embed/route"},resolvedPagePath:"C:\\Users\\princ\\Desktop\\ma\\web-app\\src\\app\\api\\proxy\\embed\\route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:h,staticGenerationAsyncStorage:f,serverHooks:b}=m,g="/api/proxy/embed/route";function v(){return(0,i.patchFetch)({serverHooks:b,staticGenerationAsyncStorage:f})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[276,972],()=>r(785));module.exports=n})();