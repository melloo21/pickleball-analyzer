(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))h(e);new MutationObserver(e=>{for(const l of e)if(l.type==="childList")for(const d of l.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&h(d)}).observe(document,{childList:!0,subtree:!0});function u(e){const l={};return e.integrity&&(l.integrity=e.integrity),e.referrerPolicy&&(l.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?l.credentials="include":e.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function h(e){if(e.ep)return;e.ep=!0;const l=u(e);fetch(e.href,l)}})();const z="./demo/",st="dinklab-demo-review-v1",K=async o=>{if(!o.ok)throw new Error((await o.json().catch(()=>({}))).detail??o.statusText);return o.json()},bt=()=>Promise.reject(new Error("This is a static demo with no backend. Run the app locally (./start.sh) to analyse your own videos.")),Lt={jobs:async()=>[await fetch(`${z}job.json`).then(K)],async job(o){if(o!=="demo")throw new Error("not found");const[r,u,h]=await Promise.all([fetch(`${z}job.json`).then(K),fetch(`${z}result.json`).then(K),fetch(`${z}review.json`).then(K).catch(()=>({}))]);let e=h;try{e=JSON.parse(localStorage.getItem(st)??"null")??h}catch{}return{job:r,result:u,review:e}},async saveReview(o,r){const u=Date.now()/1e3;try{localStorage.setItem(st,JSON.stringify({...r,saved:u}))}catch{}return{ok:!0,saved:u}},reanalyze:(o,r)=>bt(),async remove(o){return localStorage.removeItem(st),{ok:!0}},videoUrl:o=>`${z}video.mp4`,thumbUrl:(o,r)=>`${z}thumbs/r${r}.jpg`,upload:(o,r,u)=>bt()},O=Lt;function Rt(o,r){const u=l=>{const d=Math.floor(l/60);return`${String(d).padStart(2,"0")}:${(l-d*60).toFixed(2).padStart(5,"0")}`},h=l=>`"${l.replace(/"/g,'""')}"`,e=["type,id,rally,shot_index,timestamp_s,timestamp,label,review_status,winner,strength_db,confidence"];for(const l of[...o.rallies].sort((d,S)=>d.start-S.start)){const d=l.status??"unchecked";if(d==="rejected")continue;const S=o.shots.filter(p=>p.rally===l.id).sort((p,$)=>p.t-$.t);e.push(`rally_start,R${l.id},${l.id},,${l.start},${u(l.start)},${h(`rally (${S.length} shots)`)},${d},,,`);for(const p of S)e.push(`shot,${p.id},${p.rally},${p.index},${p.t},${u(p.t)},${h(p.label.replace(" (rally end)",""))},${d},,${p.strength_db},${p.confidence}`);for(const p of o.points.filter($=>$.rally===l.id))e.push(`point,${p.id},${p.rally},,${p.t},${u(p.t)},${h(p.label)},${d},${h(p.winner?r[p.winner]:"")},,`)}return e.join(`
`)+`
`}function mt(o,r,u){const h=document.createElement("a");h.href=URL.createObjectURL(new Blob([r],{type:u})),h.download=o,document.body.appendChild(h),h.click(),h.remove(),setTimeout(()=>URL.revokeObjectURL(h.href),1e3)}const at=o=>o==="A"?"B":"A";function Mt(o,r,u,h="A"){var S;const e={score:{A:0,B:0},serving:h,server:2},l=[],d=new Map(r.map(p=>[p.rally,p]));for(const p of[...o].sort(($,g)=>$.start-g.start)){if(p.status==="rejected")continue;const $=(S=d.get(p.id))==null?void 0:S.winner;if(!$)continue;let g=!1;u==="rally"?(e.score[$]+=1,g=!0,e.serving=$):$===e.serving?(e.score[$]+=1,g=!0):e.server===1?e.server=2:(e.serving=at(e.serving),e.server=1);const M=e.score,H=u==="rally"?`${M[e.serving]}-${M[at(e.serving)]}`:`${M[e.serving]}-${M[at(e.serving)]}-${e.server}`;l.push({rally:p.id,winner:$,scored:g,after:structuredClone(e),call:H})}return l}const w=(o,r=document)=>r.querySelector(o),k=o=>o.replace(/[&<>"']/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[r]),B=o=>{const r=Math.floor(o/60),u=o-r*60;return`${r}:${u.toFixed(1).padStart(4,"0")}`},$t=o=>{const r=Math.floor(o/60),u=Math.round(o-r*60);return r?`${r}m ${u}s`:`${u}s`},P=w("#app"),yt=["serve","return","third shot","drop","dink","drive","volley","lob","smash","reset","other"],D={serve:"#ff7aa2",return:"#ffb347","third shot":"#a78bfa",drop:"#60a5fa",dink:"#34d399",drive:"#f87171",volley:"#fbbf24",lob:"#38bdf8",smash:"#ef4444",reset:"#94a3b8",other:"#cbd5e1"},nt={serve:"🎯",return:"↩️","third shot":"3️⃣",drop:"🪶",dink:"🤏",drive:"💥",volley:"⚡",lob:"🌈",smash:"🔨",reset:"🧘",other:"•"},gt={strict:"Strict",balanced:"Balanced",sensitive:"Sensitive"};function Y(o){return`
  <header class="topbar">
    <a class="brand" href="#/"><span class="ball">🏓</span><span>Dink<b>Lab</b></span><small>pickleball analyzer</small></a>
    <nav>
      <a href="https://github.com/melloo21/pickleball-analyzer" target="_blank" rel="noopener">⭐ GitHub</a>
    </nav>
  </header>
  <div class="demo-bar">🧪 <b>Live demo</b>: one pre-analysed match, no uploads. Your review edits stay in this browser.
    <a href="https://github.com/melloo21/pickleball-analyzer#run" target="_blank" rel="noopener">Run it locally</a> to analyse your own videos.</div>`}let C=null,it=new AbortController;const W={get signal(){return it.signal}};function V(){return C==null||C(),C=null,it.abort(),it=new AbortController,At("demo")}window.addEventListener("hashchange",V);V();const wt=[["Checking video","📼"],["Converting video for the browser","🔄"],["Extracting audio","🎧"],["Detecting paddle hits","👂"],["Scanning video frames","👀"],["Finding rallies","🧩"],["Tagging shots","🏷"],["Making rally thumbnails","🖼"]];async function At(o){P.innerHTML=`${Y()}<main class="loading"><div class="bounce">🎾</div></main>`;let r=0;const u=async()=>{let h;try{h=await O.job(o)}catch{P.innerHTML=`${Y()}<main class="center"><div class="card empty">😿 Analysis not found. <a href="#/">Back</a></div></main>`;return}if(h.job.state==="done"&&h.result)return Bt(h.job,h.result,h.review);jt(h.job),h.job.state!=="error"&&(r=window.setTimeout(u,800))};C=()=>clearTimeout(r),u()}function jt(o){const r=wt.findIndex(([u])=>o.stage.startsWith(u));P.innerHTML=`
  ${Y()}
  <main class="center">
    <div class="card progress-card">
      <div class="court-anim"><div class="net"></div><div class="pb">🎾</div></div>
      <h2>${o.state==="error"?"😿 Something went wrong":o.state==="queued"?"⏳ Waiting in line…":"Analyzing your match…"}</h2>
      <p class="muted">${k(o.name)}</p>
      <div class="pbar big"><div style="width:${Math.max(2,o.progress*100)}%"></div></div>
      <p><b>${Math.round(o.progress*100)}%</b> · ${k(o.stage)}</p>
      <ol class="steps">${wt.map(([u,h],e)=>`<li class="${e<r?"done":e===r?"now":""}"><span>${e<r?"✅":h}</span>${u}</li>`).join("")}</ol>
      ${o.error?`<pre class="err">${k(o.error)}</pre><a class="btn" href="#/">⬅ Back</a>`:""}
    </div>
  </main>`}function Bt(o,r,u){const h=s=>s.replace(" (rally end)",""),e={rallies:(u.rallies??r.rallies).map(s=>({...s,status:s.status??"unchecked"})),shots:(u.shots??r.shots).map(s=>({...s,label:h(s.label)})),points:u.points??r.points,firstServer:u.firstServer??"A",cur:null,curShot:null,loop:!1,zoom:!1,filter:new Set},l=o.teams;P.innerHTML=`
  ${Y()}
  <main class="ws">
    <section class="ws-head">
      <div>
        
        <h1 title="${k(o.name)}">${k(o.name)}</h1>
        <div class="chips">
          <span class="chip">🟢 ${k(l.A)} <i>vs</i> 🔵 ${k(l.B)}</span>
          <span class="chip">${o.scoring==="rally"?"Rally scoring":"Side-out scoring"}</span>
          <span class="chip">🎚 ${gt[o.preset]??o.preset}</span>
          <span class="chip">📼 ${r.video.width}×${r.video.height} · ${r.video.fps} fps · ${$t(r.video.duration)}</span>
          <span class="chip saved" id="saved">💾 Saved in browser</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn" data-a="exportCsv">📄 CSV</button>
        <button class="btn" data-a="exportJson">🧾 JSON</button>
        <button class="btn" data-a="resetDemo" title="Undo your edits and go back to the original review">↺ Reset</button>
      </div>
    </section>

    <section class="stats" id="stats"></section>

    <section class="ws-grid">
      <div class="ws-left">
        <div class="player card">
          <video id="vid" src="${O.videoUrl(o.id)}" controls preload="auto" playsinline></video>
          <div class="hud" id="hud"></div>
        </div>
        <div class="controls card">
          <button class="btn round" data-a="prevRally" title="Previous rally (J)">⏮</button>
          <button class="btn round" data-a="prevShot" title="Previous shot (←)">◀</button>
          <button class="btn primary" data-a="playRally" title="Play rally (P)">▶ Play rally</button>
          <button class="btn round" data-a="nextShot" title="Next shot (→)">▶</button>
          <button class="btn round" data-a="nextRally" title="Next rally (K)">⏭</button>
          <span class="sep"></span>
          <button class="btn toggle" data-a="loop" id="loopBtn" title="Loop current rally (L)">🔁 Loop</button>
          <button class="btn toggle" data-a="zoom" id="zoomBtn" title="Zoom timeline to rally (Z)">🔍 Zoom</button>
          <div class="speed"><span>Speed</span>${[.25,.5,1,1.5,2].map(s=>`<button class="btn tiny ${s===1?"on":""}" data-rate="${s}">${s}×</button>`).join("")}</div>
        </div>
        <div class="timeline card">
          <canvas id="tl" height="132"></canvas>
          <div class="legend" id="legend"></div>
        </div>
        <div class="shots card" id="shots"></div>
        <details class="card keys"><summary>⌨️ Keyboard shortcuts</summary>
          <div class="kgrid">
            <span><kbd>J</kbd>/<kbd>K</kbd> prev / next rally</span><span><kbd>←</kbd>/<kbd>→</kbd> prev / next shot</span>
            <span><kbd>Space</kbd> play / pause</span><span><kbd>P</kbd> play rally</span>
            <span><kbd>Y</kbd> rally correct</span><span><kbd>N</kbd> not a rally</span>
            <span><kbd>A</kbd>/<kbd>B</kbd> point to team</span><span><kbd>S</kbd> add shot at playhead</span>
            <span><kbd>L</kbd> loop</span><span><kbd>Z</kbd> zoom timeline</span>
          </div></details>
      </div>

      <aside class="ws-right">
        <div class="scoreboard card" id="score"></div>
        <div class="review card" id="review"></div>
        <div class="rallies card">
          <div class="sec-h"><h3>🏓 Rallies</h3><div class="seg small" id="rfilter">
            <button data-f="all" class="on">All</button><button data-f="unchecked">To check</button><button data-f="ok">✓</button><button data-f="rejected">✗</button></div></div>
          <div class="rlist" id="rlist"></div>
        </div>
        <div class="mix card" id="mix"></div>
      </aside>
    </section>
  </main>`;const d=w("#vid"),S=w("#tl");let p="all";const $=s=>e.shots.filter(t=>t.rally===s).sort((t,n)=>t.t-n.t),g=s=>e.rallies.find(t=>t.id===s)??null,M=s=>e.points.find(t=>t.rally===s),H=()=>e.rallies.filter(s=>s.status!=="rejected"),Z=()=>[...e.rallies].sort((s,t)=>s.start-t.start),X=s=>e.rallies.find(t=>s>=t.start-.8&&s<=t.end+.4)??null,ot=s=>{const t=$(s);t.forEach((a,i)=>{a.index=i+1});const n=g(s);n&&t.length&&(n.n_shots=t.length,n.start=t[0].t,n.end=Math.max(n.end,t[t.length-1].t+.3))};let G=0;const _=()=>{const s=w("#saved");s.textContent="✏️ Saving…",s.classList.add("dirty"),clearTimeout(G),G=window.setTimeout(async()=>{await O.saveReview(o.id,{rallies:e.rallies,shots:e.shots,points:e.points,firstServer:e.firstServer}),s.textContent="💾 Saved in browser",s.classList.remove("dirty")},500)};function kt(){const s=H(),t=new Set(s.map(f=>f.id)),n=e.shots.filter(f=>t.has(f.rally)),a=s.map(f=>$(f.id).length),i=s.reduce((f,y)=>f+(y.end-y.start),0),c=s.reduce((f,y)=>!f||$(y.id).length>$(f.id).length?y:f,null),m=[["🏓",String(s.length),"Rallies"],["🎾",String(n.length),"Shots tagged"],["🚩",String(s.length),"Points / side-outs"],["📊",a.length?(n.length/s.length).toFixed(1):"0","Avg shots / rally"],["🔥",c?String($(c.id).length):"0","Longest rally (shots)",c?`R${c.id}`:""],["⏱",`${Math.round(i/r.video.duration*100)}%`,"Ball-in-play time",$t(i)]];w("#stats").innerHTML=m.map(([f,y,A,x],j)=>`<div class="stat card" style="--d:${j*40}ms" ${x!=null&&x.startsWith("R")?`data-go="${x.slice(1)}"`:""}><span class="se">${f}</span><b>${y}</b><small>${A}${x?` · ${x}`:""}</small></div>`).join("")}function St(){const s=Mt(e.rallies,e.points,o.scoring,e.firstServer),t=s[s.length-1],n=(t==null?void 0:t.after.score)??{A:0,B:0},a=(t==null?void 0:t.after.serving)??e.firstServer,i=(t==null?void 0:t.call)??(o.scoring==="rally"?"0-0":"0-0-2"),c=H().filter(f=>{var y;return!((y=M(f.id))!=null&&y.winner)}).length,m=e.cur!=null?s.filter(f=>{var y,A;return(((y=g(f.rally))==null?void 0:y.start)??0)<=(((A=g(e.cur))==null?void 0:A.start)??0)}).pop():null;w("#score").innerHTML=`
      <div class="sec-h"><h3>🏆 Scoreboard</h3><span class="call" title="Score call (server's score first)">${i}</span></div>
      <div class="sb">
        <div class="team a ${a==="A"?"srv":""}"><small>🟢 ${k(l.A)}</small><b>${n.A}</b>${a==="A"?"<i>🎾 serving</i>":""}</div>
        <div class="vs">vs</div>
        <div class="team b ${a==="B"?"srv":""}"><small>🔵 ${k(l.B)}</small><b>${n.B}</b>${a==="B"?"<i>🎾 serving</i>":""}</div>
      </div>
      ${m?`<p class="muted small">After rally ${m.rally}: <b>${m.call}</b> ${m.scored?"· point scored":"· side-out / 2nd server"}</p>`:""}
      <div class="fs"><span>First serve:</span>
        <button class="btn tiny ${e.firstServer==="A"?"on":""}" data-fs="A">${k(l.A)}</button>
        <button class="btn tiny ${e.firstServer==="B"?"on":""}" data-fs="B">${k(l.B)}</button></div>
      ${c?`<p class="hint">👉 ${c} rall${c>1?"ies":"y"} without a winner. Pick 🟢/🔵 on each rally card to build the score.</p>`:'<p class="hint ok">🎉 All rallies scored!</p>'}`}function xt(){const s=e.rallies.length,t=e.rallies.filter(i=>i.status==="ok").length,n=e.rallies.filter(i=>i.status==="rejected").length,a=t+n;w("#review").innerHTML=`
      <div class="sec-h"><h3>🕵️ Human check</h3><span class="muted">${a}/${s} reviewed</span></div>
      <div class="pbar tri"><div class="okb" style="width:${t/Math.max(1,s)*100}%"></div><div class="rejb" style="width:${n/Math.max(1,s)*100}%"></div></div>
      <div class="legend2"><span><i class="dot ok"></i>${t} correct</span><span><i class="dot rej"></i>${n} not a rally</span><span><i class="dot un"></i>${s-a} to check</span></div>
      ${s-a?'<button class="btn primary wide" data-a="nextUnchecked">🔎 Review next unchecked rally</button>':'<p class="hint ok">✅ Review complete — export when ready.</p>'}`}function rt(){const s=Z().filter(t=>p==="all"||t.status===p);w("#rlist").innerHTML=s.length?s.map(t=>{const n=M(t.id),a=$(t.id).length;return`
      <div class="rcard ${t.status} ${e.cur===t.id?"cur":""}" data-r="${t.id}">
        <div class="rthumb"><img src="${O.thumbUrl(o.id,t.id)}" loading="lazy"/><span>R${t.id}</span></div>
        <div class="rbody">
          <div class="rtop"><b>Rally ${t.id}</b><span class="muted">${B(t.start)} → ${B(t.end)}</span></div>
          <div class="rmeta"><span>🎾 ${a} shots</span><span>⏱ ${(t.end-t.start).toFixed(1)}s</span>${n?`<span>🚩 ${B(n.t)}</span>`:""}</div>
          <div class="rbtns">
            <button class="chipbtn ${t.status==="ok"?"on ok":""}" data-st="ok" title="Correct rally (Y)">✓</button>
            <button class="chipbtn ${t.status==="rejected"?"on rej":""}" data-st="rejected" title="Not a rally (N)">✗</button>
            <span class="sep"></span>
            <button class="chipbtn team a ${(n==null?void 0:n.winner)==="A"?"on":""}" data-win="A" title="Point to ${k(l.A)} (A)">🟢 ${k(l.A)}</button>
            <button class="chipbtn team b ${(n==null?void 0:n.winner)==="B"?"on":""}" data-win="B" title="Point to ${k(l.B)} (B)">🔵 ${k(l.B)}</button>
          </div>
        </div>
      </div>`}).join(""):'<div class="muted pad">Nothing here 🎉</div>'}function lt(){const s=g(e.cur),t=w("#shots");if(!s){t.innerHTML='<div class="sec-h"><h3>🎾 Shots</h3></div><p class="muted">Pick a rally on the right (or press <kbd>K</kbd>) to see and fix its shots.</p>';return}const n=$(s.id);t.innerHTML=`
      <div class="sec-h"><h3>🎾 Rally ${s.id} · ${n.length} shots</h3>
        <div><button class="btn tiny" data-a="addShot" title="Add a shot at the playhead (S)">➕ Add shot at ${B(d.currentTime)}</button></div></div>
      <div class="shot-strip">${n.map(a=>`
        <div class="shot ${e.curShot===a.id?"cur":""} ${e.filter.size&&!e.filter.has(a.label)?"dim":""}" data-s="${a.id}" style="--c:${D[a.label]??"#ccc"}">
          <div class="sn">#${a.index}${a.index===n.length?" 🏁":""}</div>
          <div class="st">${B(a.t)}</div>
          <select data-lab="${a.id}">${yt.map(i=>`<option ${i===a.label?"selected":""} value="${i}">${nt[i]} ${i}</option>`).join("")}</select>
          <div class="conf" title="Detector confidence"><div style="width:${a.confidence*100}%"></div></div>
          <button class="x" data-delshot="${a.id}" title="Remove false hit">✕</button>
        </div>`).join("")}</div>`}function ct(){const s=new Set(H().map(i=>i.id)),t={};e.shots.filter(i=>s.has(i.rally)).forEach(i=>{t[i.label]=(t[i.label]??0)+1});const n=Object.values(t).reduce((i,c)=>i+c,0)||1,a=yt.filter(i=>t[i]).sort((i,c)=>t[c]-t[i]);w("#mix").innerHTML='<div class="sec-h"><h3>🧁 Shot mix</h3><span class="muted">tap to highlight</span></div>'+a.map(i=>`
      <button class="mixrow ${e.filter.has(i)?"on":""}" data-mf="${i}">
        <span>${nt[i]} ${i}</span><div class="bar"><div style="width:${t[i]/n*100}%;background:${D[i]}"></div></div><b>${t[i]}</b></button>`).join(""),w("#legend").innerHTML='<span><i class="sw rally"></i>rally</span><span><i class="sw ok"></i>checked</span><span><i class="sw rej"></i>rejected</span><span>🚩 point</span><span><i class="sw act"></i>hit activity</span>'+a.slice(0,6).map(i=>`<span><i class="tick" style="background:${D[i]}"></i>${i}</span>`).join("")}function dt(){const s=d.currentTime,t=X(s),n=e.shots.filter(c=>Math.abs(c.t-s)<.35).sort((c,m)=>Math.abs(c.t-s)-Math.abs(m.t-s))[0],a=e.points.find(c=>{var m;return s>=c.t&&s<c.t+1.2&&((m=g(c.rally))==null?void 0:m.status)!=="rejected"}),i=`
      ${t?`<span class="h-r ${t.status}">🏓 Rally ${t.id}${t.status==="rejected"?" (rejected)":""}</span>`:'<span class="h-r idle">💤 between points</span>'}
      ${n?`<span class="h-s pop" style="--c:${D[n.label]}">${nt[n.label]} #${n.index} ${n.label}</span>`:""}
      ${a?`<span class="h-p pop">🚩 Point${a.winner?` → ${k(l[a.winner])}`:""}</span>`:""}`;i!==ut&&(ut=i,w("#hud").innerHTML=i+'<span class="h-t" id="ht"></span>'),w("#ht").textContent=B(s)}let ut="",N=[0,r.video.duration];function ht(){const s=g(e.cur);N=e.zoom&&s?[Math.max(0,s.start-3),Math.min(r.video.duration,s.end+3)]:[0,r.video.duration]}function E(){var R;const s=window.devicePixelRatio||1,t=S.clientWidth,n=132;S.width!==t*s&&(S.width=t*s,S.height=n*s);const a=S.getContext("2d");a.setTransform(s,0,0,s,0,0),a.clearRect(0,0,t,n);const[i,c]=N,m=v=>(v-i)/(c-i)*t;a.fillStyle="#f3f6ec",a.beginPath(),a.roundRect(0,0,t,n,12),a.fill();const{t:f,activity:y}=r.curves,A=Math.max(2.5,...y);a.beginPath(),a.moveTo(0,96),f.forEach((v,T)=>{v>=i-1&&v<=c+1&&a.lineTo(m(v),96-y[T]/A*40)}),a.lineTo(t,96),a.closePath(),a.fillStyle="rgba(27,153,139,.18)",a.fill();for(const v of e.rallies){const T=m(v.start),q=m(v.end);if(q<0||T>t)continue;a.fillStyle=v.status==="ok"?"#22c55e":v.status==="rejected"?"#cbd5e1":"#c7e33a",a.beginPath(),a.roundRect(T,22,Math.max(3,q-T),22,7),a.fill(),e.cur===v.id&&(a.strokeStyle="#13315c",a.lineWidth=2.5,a.stroke()),q-T>26&&(a.fillStyle=v.status==="rejected"?"#64748b":"#13315c",a.font="600 11px ui-rounded, system-ui",a.fillText(`R${v.id}`,T+6,37));const J=M(v.id);J&&v.status!=="rejected"&&(a.font="14px system-ui",a.fillText("🚩",m(J.t)-4,18))}for(const v of e.shots){const T=m(v.t);if(T<-2||T>t+2)continue;const q=((R=g(v.rally))==null?void 0:R.status)==="rejected",J=e.filter.size>0&&!e.filter.has(v.label);a.fillStyle=q||J?"#d6dbe1":D[v.label]??"#999";const ft=e.curShot===v.id?30:20;a.beginPath(),a.roundRect(T-1.5,100-ft/2+10,3,ft,2),a.fill()}a.fillStyle="#7b8794",a.font="10px ui-rounded, system-ui";const x=c-i,j=x>120?30:x>40?10:x>15?5:1;for(let v=Math.ceil(i/j)*j;v<=c;v+=j)a.fillText(B(v).replace(/\.\d$/,""),m(v)+2,128);const b=m(d.currentTime);a.fillStyle="#ff5a8a",a.fillRect(b-1,4,2,n-18),a.beginPath(),a.arc(b,6,5,0,Math.PI*2),a.fill()}S.addEventListener("click",s=>{const t=S.getBoundingClientRect(),n=N[0]+(s.clientX-t.left)/t.width*(N[1]-N[0]),a=X(n);a&&a.id!==e.cur&&F(a.id,!1),d.currentTime=n,E()});function L(){kt(),St(),xt(),rt(),lt(),ct(),ht(),E(),dt()}function F(s,t=!0){var n;if(e.cur=s,e.curShot=null,t){const a=g(s);d.currentTime=Math.max(0,a.start-1)}L(),(n=document.querySelector(`.rcard[data-r="${s}"]`))==null||n.scrollIntoView({block:"nearest",behavior:"smooth"})}function U(s){const t=Z(),n=d.currentTime,a=e.cur!=null?t.findIndex(c=>c.id===e.cur):-1,i=a>=0?t[a+s]:s>0?t.find(c=>c.start>n):[...t].reverse().find(c=>c.end<n);i&&F(i.id)}function I(s){const t=[...e.shots].filter(i=>{var c;return((c=g(i.rally))==null?void 0:c.status)!=="rejected"}).sort((i,c)=>i.t-c.t),n=d.currentTime,a=s>0?t.find(i=>i.t>n+.05):[...t].reverse().find(i=>i.t<n-.25);a&&(a.rally!==e.cur&&(e.cur=a.rally),e.curShot=a.id,d.currentTime=Math.max(0,a.t-.2),L())}function Q(s,t){const n=g(s);n.status=n.status===t?"unchecked":t,_(),L()}function tt(s,t){let n=M(s);const a=g(s);n||(n={id:`p${s}`,rally:s,t:a.end,label:`Point / side-out #${s}`,winner:null,note:""},e.points.push(n)),n.winner=n.winner===t?null:t,n.winner&&a.status==="unchecked"&&(a.status="ok"),_(),L()}function pt(){const s=+d.currentTime.toFixed(2);let t=X(s);t||(t={id:Math.max(0,...e.rallies.map(i=>i.id))+1,start:s,end:s+1,n_shots:0,point_t:s+1,rally_type:"manual",status:"ok"},e.rallies.push(t));const n=`m${Date.now().toString(36)}`;e.shots.push({id:n,rally:t.id,index:0,t:s,label:"other",strength_db:0,confidence:1,manual:!0}),ot(t.id),e.cur=t.id,e.curShot=n,_(),L()}P.addEventListener("click",s=>{var j;const t=s.target,n=(j=t.closest("[data-a]"))==null?void 0:j.dataset.a,a=t.closest(".rcard");if(t.closest("[data-st]")&&a)return Q(+a.dataset.r,t.closest("[data-st]").dataset.st);if(t.closest("[data-win]")&&a)return tt(+a.dataset.r,t.closest("[data-win]").dataset.win);if(a&&!t.closest("button"))return F(+a.dataset.r);const i=t.closest("[data-go]");if(i)return F(+i.dataset.go);const c=t.closest("[data-fs]");if(c)return e.firstServer=c.dataset.fs,_(),L();const m=t.closest("[data-mf]");if(m){const b=m.dataset.mf;return e.filter.has(b)?e.filter.delete(b):e.filter.add(b),L()}const f=t.closest("[data-f]");if(f)return p=f.dataset.f,f.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b===f)),rt();const y=t.closest("[data-rate]");if(y){d.playbackRate=+y.dataset.rate,P.querySelectorAll("[data-rate]").forEach(b=>b.classList.toggle("on",b===y));return}const A=t.closest("[data-delshot]");if(A){const b=e.shots.find(R=>R.id===A.dataset.delshot);return e.shots=e.shots.filter(R=>R!==b),ot(b.rally),_(),L()}const x=t.closest(".shot[data-s]");if(x&&!t.closest("select")){const b=e.shots.find(R=>R.id===x.dataset.s);return e.curShot=b.id,d.currentTime=Math.max(0,b.t-.2),L()}switch(n){case"prevRally":return U(-1);case"nextRally":return U(1);case"prevShot":return I(-1);case"nextShot":return I(1);case"playRally":{e.cur==null&&U(1);const b=g(e.cur);b&&(d.currentTime=Math.max(0,b.start-1),d.play());return}case"loop":e.loop=!e.loop,w("#loopBtn").classList.toggle("on",e.loop);return;case"zoom":return e.zoom=!e.zoom,w("#zoomBtn").classList.toggle("on",e.zoom),ht(),E();case"addShot":return pt();case"nextUnchecked":{const b=Z().find(R=>R.status==="unchecked");b&&(F(b.id),d.play());return}case"exportCsv":return mt("dinklab-demo.csv",Rt(e,l),"text/csv");case"exportJson":return mt("dinklab-demo.json",JSON.stringify({...r,rallies:e.rallies,shots:e.shots,points:e.points},null,1),"application/json");case"resetDemo":confirm("Reset the demo? Your checks, labels and point winners in this browser will be cleared.")&&(clearTimeout(G),O.remove(o.id).then(()=>V()));return}},W),P.addEventListener("change",s=>{const t=s.target;if(t.dataset.lab){const n=e.shots.find(a=>a.id===t.dataset.lab);n.label=t.value,_(),ct(),E(),lt()}t.id==="re"&&t.value&&(confirm(`Re-run detection with "${gt[t.value]}" sensitivity? Your review edits will be cleared.`)&&O.reanalyze(o.id,t.value).then(()=>V()),t.value="")},W);const Tt=s=>{if(s.target.closest("input,select,textarea"))return;const t=s.key.toLowerCase(),n={j:()=>U(-1),k:()=>U(1),arrowleft:()=>I(-1),arrowright:()=>I(1)," ":()=>d.paused?d.play():d.pause(),p:()=>w('[data-a="playRally"]').click(),y:()=>e.cur!=null&&Q(e.cur,"ok"),n:()=>e.cur!=null&&Q(e.cur,"rejected"),a:()=>e.cur!=null&&tt(e.cur,"A"),b:()=>e.cur!=null&&tt(e.cur,"B"),s:pt,l:()=>w("#loopBtn").click(),z:()=>w("#zoomBtn").click()};n[t]&&(s.preventDefault(),n[t]())};window.addEventListener("keydown",Tt,W);let et=0;const vt=()=>{const s=g(e.cur);e.loop&&s&&!d.paused&&d.currentTime>s.end+.6&&(d.currentTime=Math.max(0,s.start-1)),E(),dt(),et=requestAnimationFrame(vt)};et=requestAnimationFrame(vt),window.addEventListener("resize",()=>E(),W),C=()=>cancelAnimationFrame(et),L()}
