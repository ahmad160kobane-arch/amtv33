import { NextRequest, NextResponse } from 'next/server';

// ─── Allowed embed domains (security whitelist) ───────────────────────────────
const ALLOWED = [
  'vidsrc.to', 'vidsrc.cc', 'vidsrc.me', 'vidsrc.net',
  '2embed.cc', 'embed.su', 'autoembed.cc', 'multiembed.mov',
];

// ─── Ad-blocking script injected at the TOP of <head> ────────────────────────
// Blocks window.open (popups), ad network XHR/fetch, and _blank link clicks.
// Does NOT block internal navigation (location.replace/assign) — VidSrc needs
// these to load its CDN player.
const AD_BLOCKER_SCRIPT = `<script>(function(){
var _AD=[
  'doubleclick','googlesyndication','adservice','adnxs','advertising',
  'popads','popcash','exoclick','trafficjunky','juicyads','adsterra',
  'propellerads','revcontent','outbrain','taboola','mgid',
  'yllix','popunder','hilltopads','adskeeper','clickadu','bidvertiser',
  'adblade','infolinks','vibrantmedia','zedo','valueclick','adform',
  'smartadserver','rubiconproject','openx','pubmatic','criteo',
  'scorecardresearch','conversantmedia','yieldmanager','clicksor',
  'media.net','justpremium','admixer','adtelligent','undertone'
];
function _bad(u){
  if(!u||typeof u!=='string')return false;
  try{var h=new URL(u).hostname.toLowerCase();
    return _AD.some(function(d){return h.indexOf(d)!==-1;});
  }catch(e){return false;}
}
// 1. Block window.open — return fake window object
var _fakeWin={focus:function(){},blur:function(){},close:function(){},closed:true,
  document:{write:function(){},body:{}},location:{href:''}};
try{Object.defineProperty(window,'open',{value:function(){return _fakeWin;},writable:false,configurable:false});}
catch(e){window.open=function(){return _fakeWin;};}

// 2. Block link clicks that open new tabs
['click','mousedown','auxclick'].forEach(function(evt){
  document.addEventListener(evt,function(e){
    var el=e.target;
    while(el&&el!==document.body){
      if(el.tagName==='A'){
        var href=el.getAttribute('href')||'';
        var tgt=el.getAttribute('target')||'';
        if(tgt==='_blank'||tgt==='_top'||tgt==='_parent'||
           href.startsWith('javascript:')||_bad(href)){
          e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return;
        }
      }
      el=el.parentElement;
    }
  },true);
});

// 3. Re-focus if focus stolen by popunder
window.addEventListener('blur',function(){setTimeout(function(){try{window.focus();}catch(e){}},100);});

// 4. Block fetch to ad networks
var _F=window.fetch;
window.fetch=function(u,o){
  if(_bad(typeof u==='string'?u:(u&&u.url)||''))return new Promise(function(){});
  return _F.apply(this,arguments);
};

// 5. Block XMLHttpRequest to ad networks
var _XO=XMLHttpRequest.prototype.open;
var _XS=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){
  if(_bad(u)){this.__bl=1;return;}
  return _XO.apply(this,arguments);
};
XMLHttpRequest.prototype.send=function(){if(this.__bl)return;return _XS.apply(this,arguments);};

// 6. MutationObserver — remove ad scripts/iframes as they are added
new MutationObserver(function(ms){
  ms.forEach(function(m){
    m.addedNodes.forEach(function(n){
      if(!n||n.nodeType!==1)return;
      if((n.tagName==='SCRIPT'||n.tagName==='IFRAME')&&_bad(n.src||n.getAttribute('src')||'')){n.remove();}
      if(n.tagName==='A'){
        var tgt=n.getAttribute('target');
        if(tgt==='_blank'||tgt==='_top')n.setAttribute('target','_self');
      }
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

  if (html.includes('<head>')) return html.replace('<head>', `<head>${inject}`);
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) return html.replace(headMatch[0], `${headMatch[0]}${inject}`);
  return `<head>${inject}</head>` + html;
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
