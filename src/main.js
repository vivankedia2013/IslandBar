(function(){
var T=window.__TAURI__, invoke=T.core.invoke, $=function(s){return document.querySelector(s)};
var S={}; try{S=JSON.parse(localStorage.getItem('ib')||'{}')}catch(e){}
S.use=S.use||{day:'',i:0,o:0,r:0};S.shape=S.shape||'notch'; S.focus=S.focus||25; S.brk=S.brk||5; S.key=S.key||'';
function save(){try{localStorage.setItem('ib',JSON.stringify(S))}catch(e){}}
var SIZE={notch:{c:[190,38],e:[420,260]},circle:{c:[44,44],e:[390,260]}};
var open=false,leaveT=null;

var first=true;
function applyShape(){
  document.body.classList.remove('notch','circle');document.body.classList.add(S.shape);
  var z=SIZE[S.shape][open?'e':'c'];
  invoke('animate_island',{w:z[0],h:z[1],ms:first?0:(open?260:220)});first=false;
}
var hoverT=null,closeT=null;
function expand(){clearTimeout(leaveT);clearTimeout(closeT);document.body.classList.remove('closing');
  if(open)return;open=true;document.body.classList.add('open');applyShape();syncVol();npCheck()}
function collapse(){if(!open||document.activeElement&&document.activeElement.tagName==='INPUT')return;
  open=false;npCheck();document.body.classList.add('closing');
  closeT=setTimeout(function(){document.body.classList.remove('open','closing');applyShape()},130)}
document.body.addEventListener('mouseenter',function(){clearTimeout(leaveT);hoverT=setTimeout(expand,110)});
document.body.addEventListener('mouseleave',function(){clearTimeout(hoverT);leaveT=setTimeout(collapse,450)});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){document.activeElement.blur();collapse()}});
T.event.listen('shape',function(e){S.shape=e.payload;save();applyShape()});

// tabs
var btns=document.querySelectorAll('nav button');
var tabOn='timer';
btns.forEach(function(b){b.onclick=function(){
  tabOn=b.dataset.t;
  btns.forEach(function(x){x.classList.toggle('on',x===b)});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.id===tabOn)});
  npCheck();if(tabOn==='wx')loadWx(false);}});

// clock / pill (idle cost: one 30s timer)
function fmt(s){var m=Math.floor(s/60),r=s%60;return (m<10?'0':'')+m+':'+(r<10?'0':'')+r}
function pill(){
  var t=$('#pillT');
  if(running){t.textContent=fmt(left);$('#pillDot').className='run'}
  else{var d=new Date();t.textContent=d.getHours()+':'+('0'+d.getMinutes()).slice(-2)+(S.wx?' · '+Math.round(S.wx.temp)+'°':'');$('#pillDot').className=''}
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
  var hdr=null;$('#aiIn').value='';hist.push({role:'user',content:q});hist=hist.slice(-10);$('#aiOut').textContent='…';
  fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,
    'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:S.model||'claude-sonnet-5-5',max_tokens:600,messages:hist})})
  .then(function(r){hdr=r.headers;return r.json()}).then(function(d){
    if(d.error){$('#aiOut').textContent='Error: '+d.error.message;hist.pop();return}
    addUse(d.usage,hdr);
    var t=d.content.map(function(c){return c.text||''}).join('');hist.push({role:'assistant',content:t});$('#aiOut').textContent=t})
  .catch(function(e){$('#aiOut').textContent='Network error: '+e;hist.pop()});
}
$('#aiSend').onclick=send;$('#aiIn').onkeydown=function(e){if(e.key==='Enter')send()};


// ---- live system music control (polls only while the Now-playing tab is visible)
var np={source:''},npIv=null,isMac=/Mac/.test(navigator.platform);
function pollNP(){
  invoke('now_playing').then(function(r){
    np=r;
    if(r.available){$('#npTitle').textContent=r.title||'Unknown';$('#npArtist').textContent=r.artist||'';$('#npPlay').textContent=r.playing?'⏸':'▶'}
    else{$('#npTitle').textContent='Nothing playing';$('#npArtist').textContent=isMac?'Play music in a browser, Spotify or Apple Music':'Play music in any browser or app';$('#npPlay').textContent='▶'}
  }).catch(function(){$('#npTitle').textContent='Not available'});
}
function npCheck(){
  var want=open&&tabOn==='nowp';
  if(want&&!npIv){pollNP();npIv=setInterval(pollNP,2000)}
  else if(!want&&npIv){clearInterval(npIv);npIv=null}
}
function npCtl(a){invoke('media_control',{action:a,source:np.source||''}).then(function(){setTimeout(pollNP,400)}).catch(function(){})}
$('#npPlay').onclick=function(){npCtl('toggle')};$('#npNext').onclick=function(){npCtl('next')};$('#npPrev').onclick=function(){npCtl('prev')};

// ---- weather (Open-Meteo, no key needed; cached for offline)
var ICON=function(c){return c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=57?'🌦️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌧️':'⛈️'};
function showWx(offline){
  var w=S.wx;if(!w){$('#wxCity').textContent=offline?'Offline: no weather yet':'Loading…';return}
  var u=S.f?'°F':'°C';
  $('#wxIcon').textContent=ICON(w.code);$('#wxTemp').textContent=Math.round(w.temp)+u;
  $('#wxCity').textContent=w.city+(offline?' (offline, last update)':'');
  $('#wxMore').textContent='Feels '+Math.round(w.feels)+'° · H '+Math.round(w.hi)+'° L '+Math.round(w.lo)+'° · Wind '+Math.round(w.wind)+(S.f?' mph':' km/h');
}
function getLoc(){
  if(S.loc&&S.loc.custom)return Promise.resolve(S.loc);
  return fetch('https://get.geojs.io/v1/ip/geo.json').then(function(r){return r.json()})
    .then(function(g){return {lat:+g.latitude,lon:+g.longitude,city:g.city||'Your area'}});
}
function loadWx(force){
  if(!force&&S.wx&&Date.now()-S.wx.t<20*60000){showWx();return}
  if(!navigator.onLine){showWx(true);return}
  var loc;
  getLoc().then(function(l){loc=l;
    return fetch('https://api.open-meteo.com/v1/forecast?latitude='+l.lat+'&longitude='+l.lon+
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto'+
      (S.f?'&temperature_unit=fahrenheit&wind_speed_unit=mph':''))})
  .then(function(r){return r.json()}).then(function(d){
    S.wx={t:Date.now(),city:loc.city,temp:d.current.temperature_2m,feels:d.current.apparent_temperature,code:d.current.weather_code,
      wind:d.current.wind_speed_10m,hi:d.daily.temperature_2m_max[0],lo:d.daily.temperature_2m_min[0]};
    save();showWx();pill()})
  .catch(function(){showWx(true)});
}
function findCity(){
  var q=$('#wxIn').value.trim();if(!q)return;
  if(!navigator.onLine){$('#wxCity').textContent='Offline: cannot search';return}
  fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){
    if(!d.results||!d.results.length){$('#wxCity').textContent='City not found';return}
    var r=d.results[0];S.loc={lat:r.latitude,lon:r.longitude,city:r.name,custom:true};$('#wxIn').value='';save();loadWx(true)})
  .catch(function(){$('#wxCity').textContent='Search failed'});
}
$('#wxGo').onclick=findCity;$('#wxIn').onkeydown=function(e){if(e.key==='Enter')findCity()};
$('#wxAuto').onclick=function(){S.loc=null;save();loadWx(true)};
$('#wxUnit').onclick=function(){S.f=!S.f;save();loadWx(true)};
setTimeout(function(){loadWx(false)},2000);setInterval(function(){loadWx(false)},30*60000);
showWx();


// ---- Claude usage: tokens used in IslandBar + API rate-limit window / reset time
function dayKey(){return new Date().toLocaleDateString('en-CA')}
function roll(){if(S.use.day!==dayKey())S.use={day:dayKey(),i:0,o:0,r:0}}
function addUse(u,h){
  roll();
  if(u){S.use.i+=u.input_tokens||0;S.use.o+=u.output_tokens||0;S.use.r+=1}
  var g=function(n){return h&&h.get?h.get('anthropic-ratelimit-'+n):null};
  if(g('tokens-limit')){S.rl={lim:+g('tokens-limit'),rem:+g('tokens-remaining'),reset:g('tokens-reset')}}
  save();showUse();
}
function showUse(){
  roll();var u=S.use,n=function(x){return x.toLocaleString()};
  $('#uToday').textContent='Today: '+n(u.i+u.o)+' tokens';
  $('#uSplit').textContent='in '+n(u.i)+' · out '+n(u.o)+' · '+u.r+' requests';
  if(S.rl){
    $('#uLimit').textContent='Rate limit: '+n(S.rl.rem)+' of '+n(S.rl.lim)+' tokens left';
    var ms=Date.parse(S.rl.reset)-Date.now();
    if(ms>0){var t=Math.round(ms/1000);$('#uReset').textContent='Resets in '+Math.floor(t/60)+'m '+(t%60)+'s (at '+new Date(Date.parse(S.rl.reset)).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+')'}
    else $('#uReset').textContent='Limit window has reset';
  }else{$('#uLimit').textContent='Rate limit: not available yet (press Refresh)';$('#uReset').textContent=''}
}
$('#uRefresh').onclick=function(){
  if(!S.key||!navigator.onLine){$('#uLimit').textContent=!S.key?'Add an API key first (Claude tab)':"You're offline";return}
  $('#uLimit').textContent='Checking…';
  fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,
    'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:S.model||'claude-sonnet-5-5',max_tokens:1,messages:[{role:'user',content:'hi'}]})})
  .then(function(r){var h=r.headers;return r.json().then(function(d){
    if(d.error){$('#uLimit').textContent='Error: '+d.error.message;return}
    addUse(d.usage,h);if(!S.rl)$('#uLimit').textContent='Limits not shared by the server for this key'})})
  .catch(function(){$('#uLimit').textContent='Network error'});
};
$('#uWeb').onclick=function(){invoke('open_claude')};
var uIv=null;
function useCheck(){var w=open&&tabOn==='use';
  if(w&&!uIv){showUse();uIv=setInterval(showUse,1000)}else if(!w&&uIv){clearInterval(uIv);uIv=null}}
var _npCheck=npCheck;npCheck=function(){_npCheck();useCheck()};


// ---- live activity monitor (polls every 1.5 s only while the tab is visible)
var cpuH=[],monIv=null;
function fb(b){return b<1024?b+' B/s':b<1048576?Math.round(b/1024)+' KB/s':(b/1048576).toFixed(1)+' MB/s'}
function col(p){return p>85?'#ff453a':p>60?'#ff9f0a':'#30d158'}
function pollMon(){
  invoke('get_stats').then(function(r){
    var c=Math.round(r.cpu),m=Math.round(r.mem_used/r.mem_total*100);
    $('#cpuT').textContent=c+'%';$('#cpuBar').style.width=c+'%';$('#cpuBar').style.background=col(c);
    $('#ramT').textContent=m+'%';$('#ramBar').style.width=m+'%';$('#ramBar').style.background=col(m);
    $('#ramD').textContent=(r.mem_used/1073741824).toFixed(1)+' of '+(r.mem_total/1073741824).toFixed(1)+' GB memory in use';
    $('#netT').textContent='↓ '+fb(r.down)+' · ↑ '+fb(r.up);
    $('#batT').textContent=r.battery>=0?'🔋 '+r.battery+'%'+(r.charging?' ⚡':''):'No battery';
    cpuH.push(c);if(cpuH.length>40)cpuH.shift();
    $('#cpuLine').setAttribute('points',cpuH.map(function(v,i){return (i*100/39).toFixed(1)+','+(23-v*22/100).toFixed(1)}).join(' '));
  }).catch(function(){});
}
function monCheck(){var w=open&&tabOn==='mon';
  if(w&&!monIv){pollMon();monIv=setInterval(pollMon,1500)}else if(!w&&monIv){clearInterval(monIv);monIv=null}}
var _npCheck2=npCheck;npCheck=function(){_npCheck2();monCheck()};

draw();applyShape();
})();
