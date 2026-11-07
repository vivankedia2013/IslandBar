(function(){
var T=window.__TAURI__, invoke=T.core.invoke, $=function(s){return document.querySelector(s)};
var S={}; try{S=JSON.parse(localStorage.getItem('ib')||'{}')}catch(e){}
S.shape=S.shape||'notch'; S.focus=S.focus||25; S.brk=S.brk||5; S.key=S.key||'';
function save(){try{localStorage.setItem('ib',JSON.stringify(S))}catch(e){}}
var SIZE={notch:{c:[190,38],e:[420,240]},circle:{c:[44,44],e:[360,240]}};
var open=false,leaveT=null;

function applyShape(){
  document.body.classList.remove('notch','circle');document.body.classList.add(S.shape);
  var z=SIZE[S.shape][open?'e':'c'];invoke('resize_island',{w:z[0],h:z[1]});
}
function expand(){clearTimeout(leaveT);if(open)return;open=true;document.body.classList.add('open');applyShape();syncVol()}
function collapse(){if(!open||document.activeElement&&document.activeElement.tagName==='INPUT')return;
  open=false;document.body.classList.remove('open');applyShape()}
document.body.addEventListener('mouseenter',expand);
document.body.addEventListener('mouseleave',function(){leaveT=setTimeout(collapse,500)});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){document.activeElement.blur();collapse()}});
T.event.listen('shape',function(e){S.shape=e.payload;save();applyShape()});

// tabs
var btns=document.querySelectorAll('nav button');
btns.forEach(function(b){b.onclick=function(){
  btns.forEach(function(x){x.classList.toggle('on',x===b)});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.id===b.dataset.t)});}});

// clock / pill (idle cost: one 30s timer)
function fmt(s){var m=Math.floor(s/60),r=s%60;return (m<10?'0':'')+m+':'+(r<10?'0':'')+r}
function pill(){
  var t=$('#pillT');
  if(running){t.textContent=fmt(left);$('#pillDot').className='run'}
  else{var d=new Date();t.textContent=d.getHours()+':'+('0'+d.getMinutes()).slice(-2);$('#pillDot').className=''}
}
setInterval(function(){if(!running)pill()},30000);

// focus timer
var mode='Focus',left=S.focus*60,running=false,iv=null,endAt=0;
$('#fMin').value=S.focus;$('#bMin').value=S.brk;
function draw(){$('#tBig').textContent=fmt(left);$('#tMode').textContent=mode;$('#tGo').textContent=running?'Pause':'Start';pill()}
function tick(){left=Math.max(0,Math.round((endAt-Date.now())/1000));draw();if(left<=0)finish()}
function finish(){clearInterval(iv);running=false;
  try{new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=').play()}catch(e){}
  mode=mode==='Focus'?'Break':'Focus';left=(mode==='Focus'?S.focus:S.brk)*60;draw();expand()}
$('#tGo').onclick=function(){
  if(running){clearInterval(iv);running=false}
  else{running=true;endAt=Date.now()+left*1000;iv=setInterval(tick,1000)}draw()};
$('#tReset').onclick=function(){clearInterval(iv);running=false;mode='Focus';left=S.focus*60;draw()};
$('#tSkip').onclick=function(){clearInterval(iv);running=false;mode=mode==='Focus'?'Break':'Focus';left=(mode==='Focus'?S.focus:S.brk)*60;draw()};
$('#fMin').onchange=function(){S.focus=Math.max(1,+this.value||25);save();if(!running&&mode==='Focus'){left=S.focus*60;draw()}};
$('#bMin').onchange=function(){S.brk=Math.max(1,+this.value||5);save();if(!running&&mode==='Break'){left=S.brk*60;draw()}};

// media player (local files)
var au=new Audio(),list=[],idx=-1;au.preload='metadata';
$('#mOpen').onclick=function(){$('#mFiles').click()};
$('#mFiles').onchange=function(){list=list.concat(Array.prototype.slice.call(this.files));if(idx<0)play(0)};
function play(i){if(!list.length)return;idx=(i+list.length)%list.length;
  if(au.src)URL.revokeObjectURL(au.src);au.src=URL.createObjectURL(list[idx]);au.play();
  $('#mTitle').textContent=list[idx].name.replace(/\.[^.]+$/,'')}
$('#mPlay').onclick=function(){if(idx<0)return;au.paused?au.play():au.pause()};
$('#mNext').onclick=function(){play(idx+1)};$('#mPrev').onclick=function(){play(idx-1)};
au.onended=function(){play(idx+1)};
au.onplay=au.onpause=function(){$('#mPlay').textContent=au.paused?'▶':'⏸'};
au.ontimeupdate=function(){if(au.duration)$('#seek').value=au.currentTime/au.duration*100};
$('#seek').oninput=function(){if(au.duration)au.currentTime=this.value/100*au.duration};

// master volume
function syncVol(){invoke('get_volume').then(function(v){$('#vSlide').value=Math.round(v*100);$('#vBig').textContent=Math.round(v*100)+'%'}).catch(function(){})}
$('#vSlide').oninput=function(){$('#vBig').textContent=this.value+'%';invoke('set_volume',{level:this.value/100}).catch(function(){})};

// Claude (Anthropic API key; Google sign-in is only possible on claude.ai itself)
var hist=[];
$('#aiKey').onclick=function(){var k=prompt('Paste your Anthropic API key (console.anthropic.com):',S.key);if(k!==null){S.key=k.trim();save()}};
$('#aiWeb').onclick=function(){invoke('open_claude')};
function send(){
  var q=$('#aiIn').value.trim();if(!q)return;
  if(!navigator.onLine){$('#aiOut').textContent="You're offline. Claude needs internet; everything else still works.";return}
  if(!S.key){$('#aiOut').textContent='Add an API key first (link below), or use "Open claude.ai" to sign in with Google in your browser.';return}
  $('#aiIn').value='';hist.push({role:'user',content:q});hist=hist.slice(-10);$('#aiOut').textContent='…';
  fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,
    'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:S.model||'claude-sonnet-5-5',max_tokens:600,messages:hist})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){$('#aiOut').textContent='Error: '+d.error.message;hist.pop();return}
    var t=d.content.map(function(c){return c.text||''}).join('');hist.push({role:'assistant',content:t});$('#aiOut').textContent=t})
  .catch(function(e){$('#aiOut').textContent='Network error: '+e;hist.pop()});
}
$('#aiSend').onclick=send;$('#aiIn').onkeydown=function(e){if(e.key==='Enter')send()};

draw();applyShape();
})();
