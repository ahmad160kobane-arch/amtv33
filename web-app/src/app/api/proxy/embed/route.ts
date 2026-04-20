import { NextRequest, NextResponse } from 'next/server';

// ─── Allowed embed domains (security whitelist) ───────────────────────────────
const ALLOWED = [
  'vidsrc.to', 'vidsrc.cc', 'vidsrc.me', 'vidsrc.net',
  '2embed.cc', 'embed.su', 'autoembed.cc', 'multiembed.mov',
];

// ─── Ad-blocking script injected at the TOP of <head> ────────────────────────
// Blocks window.open, ad-network XHR/fetch, _blank clicks, and click-overlay divs.
// location.replace/assign are allowed UNLESS target is an ad domain (VidSrc needs them).
const AD_BLOCKER_SCRIPT = `<script>(function(){
var _AD=[
  'doubleclick','googlesyndication','adservice','adnxs','advertising',
  'popads','popcash','exoclick','trafficjunky','juicyads','adsterra',
  'propellerads','revcontent','outbrain','taboola','mgid',
  'yllix','popunder','hilltopads','adskeeper','clickadu','bidvertiser',
  'adblade','infolinks','vibrantmedia','zedo','valueclick','adform',
  'smartadserver','rubiconproject','openx','pubmatic','criteo',
  'scorecardresearch','conversantmedia','yieldmanager','clicksor',
  'media.net','justpremium','admixer','adtelligent','undertone',
  'trafficfactory','trafficstars','popads.net','popcash.net',
  'go.php','click.php','redirect-','tracker.','track.'
];
function _bad(u){
  if(!u||typeof u!=='string')return false;
  try{var h=new URL(u).hostname.toLowerCase();
    return _AD.some(function(d){return h.indexOf(d)!==-1;});
  }catch(e){return false;}
}
// 1. Block window.open at instance + prototype level (cannot be overridden by page scripts)
var _fakeWin={focus:function(){},blur:function(){},close:function(){},closed:true,
  document:{write:function(){},body:{}},location:{href:''}};
var _blockOpen=function(){return _fakeWin;};
try{Object.defineProperty(window,'open',{value:_blockOpen,writable:false,configurable:false});}
catch(e){window.open=_blockOpen;}
try{Object.defineProperty(Window.prototype,'open',{value:_blockOpen,writable:false,configurable:false});}catch(e){}
// Re-enforce every second in case ad scripts try to restore it
setInterval(function(){
  try{Object.defineProperty(window,'open',{value:_blockOpen,writable:false,configurable:false});}catch(e){}
},1000);

// 2. Block location navigation to ad domains only (allow VidSrc CDN navigation)
var _oA=window.location.assign.bind(window.location);
var _oR=window.location.replace.bind(window.location);
window.location.assign=function(u){if(!_bad(String(u)))_oA(u);};
window.location.replace=function(u){if(!_bad(String(u)))_oR(u);};
try{
  var _ld=Object.getOwnPropertyDescriptor(Location.prototype,'href');
  if(_ld&&_ld.set){
    Object.defineProperty(Location.prototype,'href',{get:_ld.get,
      set:function(u){if(!_bad(String(u))){_ld.set.call(this,u);}},configurable:true});
  }
}catch(e){}

// 3. Block link clicks that open new tabs or go to ad networks
['click','mousedown','auxclick'].forEach(function(evt){
  document.addEventListener(evt,function(e){
    var el=e.target;
    while(el&&el!==document.body){
      if(el.tagName==='A'){
        var href=el.getAttribute('href')||'';
        var tgt=el.getAttribute('target')||'';
        if(tgt==='_blank'||tgt==='_top'||tgt==='_parent'||_bad(href)){
          e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return;
        }
      }
      el=el.parentElement;
    }
  },true);
});

// 4. Re-focus if focus stolen
window.addEventListener('blur',function(){setTimeout(function(){try{window.focus();}catch(e){}},100);});

// 5. Detect and disable click-overlay ad divs (VidSrc clickjack pattern)
function removeOverlays(){
  try{
    var vw=window.innerWidth||800,vh=window.innerHeight||600;
    document.querySelectorAll('a[href],div[onclick],span[onclick]').forEach(function(el){
      try{
        var s=window.getComputedStyle(el);
        if(s.position!=='fixed'&&s.position!=='absolute')return;
        var r=el.getBoundingClientRect();
        if(r.width<vw*0.6||r.height<vh*0.6)return;
        if(el.tagName==='VIDEO')return;
        var href=(el.getAttribute('href')||'').trim();
        var oc=el.getAttribute('onclick')||'';
        var bad=(href&&href!==''&&href!=='#'&&href!=='javascript:void(0)'&&href!=='javascript:;');
        var suspicious=(oc&&(oc.indexOf('open')!==-1||oc.indexOf('location')!==-1));
        if(bad||suspicious){
          el.style.pointerEvents='none';
          if(el.tagName==='A')el.removeAttribute('href');
          el.removeAttribute('onclick');
        }
      }catch(x){}
    });
  }catch(e){}
}
setTimeout(removeOverlays,100);setTimeout(removeOverlays,500);setTimeout(removeOverlays,1500);
setInterval(removeOverlays,2000);

// 6. Fetch blocking for ad networks
var _F=window.fetch;
window.fetch=function(u,o){
  if(_bad(typeof u==='string'?u:(u&&u.url)||''))return new Promise(function(){});
  return _F.apply(this,arguments);
};

// 7. XHR blocking for ad networks
var _XO=XMLHttpRequest.prototype.open,_XS=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){if(_bad(u)){this.__bl=1;return;}return _XO.apply(this,arguments);};
XMLHttpRequest.prototype.send=function(){if(this.__bl)return;return _XS.apply(this,arguments);};

// 8. MutationObserver — remove ad elements on DOM changes
new MutationObserver(function(ms){
  removeOverlays();
  ms.forEach(function(m){
    m.addedNodes.forEach(function(n){
      if(!n||n.nodeType!==1)return;
      if((n.tagName==='SCRIPT'||n.tagName==='IFRAME')&&_bad(n.src||n.getAttribute('src')||''))n.remove();
      if(n.tagName==='A'){var t=n.getAttribute('target');if(t==='_blank'||t==='_top')n.setAttribute('target','_self');}
    });
  });
}).observe(document.documentElement,{childList:true,subtree:true});
})();</script>`;

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

async function fetchEmbed(url: string, parsed: URL): Promise<string> {
  const res = await fetch(url, {
    headers: { ...FETCH_HEADERS, 'Referer': `${parsed.origin}/` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();

  // Detect error pages (may come with HTTP 200 from some CDNs)
  const low = html.toLowerCase();
  const isErrorPage =
    html.length < 4000 &&
    (low.includes('not found') || low.includes('404') || low.includes('403') ||
     low.includes('forbidden') || low.includes('access denied') ||
     low.includes('blocked') || low.includes('error'));

  if (isErrorPage) throw new Error('صفحة خطأ من المصدر');

  // Must look like a real HTML page
  if (!low.includes('<html') && !low.includes('<!doctype') && !low.includes('<head')) {
    throw new Error('استجابة غير صالحة');
  }

  const baseTag = `<base href="${parsed.origin}/">`;
  const inject = baseTag + AD_BLOCKER_SCRIPT;

  // Server-side HTML sanitization — happens at parse time, before any JS runs
  // Strip target="_blank" from all anchors
  let sanitized = html.replace(/(<a\b[^>]*?)\s+target\s*=\s*(["'])(_blank|_top|_parent)\2/gi, '$1 target="_self"');
  // Remove script/iframe tags from known ad domains
  const _AD_REMOVE = ['doubleclick','googlesyndication','adnxs','popads','popcash','exoclick',
    'trafficjunky','adsterra','propellerads','hilltopads','trafficfactory','trafficstars','juicyads','yllix'];
  _AD_REMOVE.forEach(d => {
    const esc = d.replace(/\./g, '\\.');
    sanitized = sanitized.replace(new RegExp(`<script[^>]+src=(["'])[^"']*/(?:${esc})[^"']*\\1[^>]*>.*?</script>`, 'gis'), '');
    sanitized = sanitized.replace(new RegExp(`<script[^>]+src=(["'])[^"']*/(?:${esc})[^"']*\\1[^>]*\/?>`, 'gi'), '');
    sanitized = sanitized.replace(new RegExp(`<iframe[^>]+src=(["'])[^"']*/(?:${esc})[^"']*\\1[^>]*>.*?</iframe>`, 'gis'), '');
  });

  if (sanitized.includes('<head>')) return sanitized.replace('<head>', `<head>${inject}`);
  const headMatch = sanitized.match(/<head[^>]*>/i);
  if (headMatch) return sanitized.replace(headMatch[0], `${headMatch[0]}${inject}`);
  return `<head>${inject}</head>` + sanitized;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url مطلوب' }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return NextResponse.json({ error: 'رابط غير صالح' }, { status: 400 });
  }

  const host = parsed.hostname.replace(/^www\./, '');
  if (!ALLOWED.some(h => host === h || host.endsWith('.' + h))) {
    return NextResponse.json({ error: 'مصدر غير مسموح' }, { status: 403 });
  }

  try {
    const html = await fetchEmbed(url, parsed);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache',
        'X-Frame-Options': 'ALLOWALL',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'خطأ في الخادم' }, { status: 502 });
  }
}
