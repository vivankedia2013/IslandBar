(function(){
var T=window.__TAURI__, invoke=T.core.invoke, $=function(s){return document.querySelector(s)};
var S={}; try{S=JSON.parse(localStorage.getItem('ib')||'{}')}catch(e){}
S.use=S.use||{day:'',i:0,o:0,r:0};S.focus=S.focus||25;S.brk=S.brk||5;S.key=S.key||'';
S.shape=(S.shape==='circle'||!S.shape)?(S.shape==='circle'?'island':'notch'):S.shape;
function save(){try{localStorage.setItem('ib',JSON.stringify(S))}catch(e){}}
var PLAY='<svg><use href="#i-play"/></svg>',PAUSE='<svg><use href="#i-pause"/></svg>';

/* ---------- window size / shape ---------- */
// c = idle pill, m = pill with music, e = expanded.  Island shape has a 10px floating margin on top.
var SIZE={notch:{c:[236,38],m:[330,38],e:[440,270]},island:{c:[158,48],m:[310,48],e:[420,282]}};
var open=false,mus=false,leaveT=null,hoverT=null,closeT=null,first=true;
function applyShape(){
  document.body.classList.remove('notch','island');document.body.classList.add(S.shape);
  var z=SIZE[S.shape][open?'e':(mus?'m':'c')];
  invoke('animate_island',{w:z[0],h:z[1],ms:first?0:(open?260:220)});first=false;
}
function expand(){clearTimeout(leaveT);clearTimeout(closeT);document.body.classList.remove('closing');
  if(open)return;open=true;document.body.classList.add('open');applyShape();syncVol();tabCheck();schedNP(0)}
function collapse(){if(!open||document.activeElement&&document.activeElement.tagName==='INPUT')return;
  open=false;tabCheck();document.body.classList.add('closing');
  closeT=setTimeout(function(){document.body.classList.remove('open','closing');applyShape();fitSong()},130)}
document.body.addEventListener('mouseenter',function(){clearTimeout(leaveT);hoverT=setTimeout(expand,110)});
document.body.addEventListener('mouseleave',function(){clearTimeout(hoverT);leaveT=setTimeout(collapse,450)});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(document.activeElement)document.activeElement.blur();collapse()}});
T.event.listen('shape',function(e){S.shape=e.payload==='circle'?'island':e.payload;save();applyShape()});

/* ---------- tabs ---------- */
var btns=document.querySelectorAll('nav button'),tabOn='timer';
btns.forEach(function(b){b.onclick=function(){
  tabOn=b.dataset.t;
  btns.forEach(function(x){x.classList.toggle('on',x===b)});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.id===tabOn)});
  tabCheck();if(tabOn==='nowp')schedNP(0);if(tabOn==='wx')loadWx(false);}});
function rng(el){el.style.setProperty('--p',((el.value-el.min)/(el.max-el.min)*100)+'%')}

/* ---------- idle pill: clock / timer ---------- */
function fmt(s){var m=Math.floor(s/60),r=s%60;return (m<10?'0':'')+m+':'+(r<10?'0':'')+r}
function pill(){
  var t=$('#pillT');
  if(running){t.textContent=fmt(left);$('#pillDot').className='run';$('#pTimer').textContent=fmt(left)}
  else{var d=new Date();t.textContent=d.getHours()+':'+('0'+d.getMinutes()).slice(-2)+(S.wx?'  ·  '+Math.round(S.wx.temp)+'°':'');$('#pillDot').className='';$('#pTimer').textContent=''}
}
setInterval(function(){if(!running)pill()},30000);

/* ---------- focus timer ---------- */
var mode='Focus',left=S.focus*60,running=false,iv=null,endAt=0,CIRC=276.46;
$('#fMin').value=S.focus;$('#bMin').value=S.brk;
function total(){return (mode==='Focus'?S.focus:S.brk)*60}
function draw(){
  $('#tBig').textContent=fmt(left);$('#tMode').textContent=mode;$('#tGo').textContent=running?'Pause':'Start';
  $('#rf').style.strokeDashoffset=(CIRC*(1-left/total())).toFixed(1);$('#rf').style.stroke=mode==='Focus'?'#30d158':'#0a84ff';pill()}
function chime(){try{var a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.value=.15;o.start();setTimeout(function(){o.stop();a.close()},700)}catch(e){}}
function tick(){left=Math.max(0,Math.round((endAt-Date.now())/1000));draw();if(left<=0)finish()}
function finish(){clearInterval(iv);running=false;chime();mode=mode==='Focus'?'Break':'Focus';left=total();draw();expand()}
$('#tGo').onclick=function(){if(running){clearInterval(iv);running=false}else{running=true;endAt=Date.now()+left*1000;iv=setInterval(tick,1000)}draw()};
$('#tReset').onclick=function(){clearInterval(iv);running=false;mode='Focus';left=total();draw()};
$('#tSkip').onclick=function(){clearInterval(iv);running=false;mode=mode==='Focus'?'Break':'Focus';left=total();draw()};
$('#fMin').onchange=function(){S.focus=Math.max(1,+this.value||25);save();if(!running&&mode==='Focus'){left=total();draw()}};
$('#bMin').onchange=function(){S.brk=Math.max(1,+this.value||5);save();if(!running&&mode==='Break'){left=total();draw()}};

/* ---------- media: one merged "now playing" shown on the collapsed island ---------- */
var au=new Audio(),list=[],idx=-1,sys={available:false},cur=null,lastPlay=0,isMac=/Mac/.test(navigator.platform),npT=null;
au.preload='metadata';
function pick(){
  var name=idx>=0&&list[idx]?list[idx].name.replace(/\.[^.]+$/,''):'';
  if(name&&!au.paused)return {title:name,artist:'My files',playing:true,src:'local'};
  if(sys.available)return {title:sys.title||'Unknown',artist:sys.artist||'',playing:!!sys.playing,src:sys.source||'system'};
  if(name)return {title:name,artist:'My files',playing:false,src:'local'};
  return null;
}
function fitSong(){
  var s=$('#pSong'),box=s.parentNode;s.classList.remove('scroll');
  setTimeout(function(){var ov=s.scrollWidth-box.clientWidth;if(ov>4){s.style.setProperty('--d',(ov+14)+'px');s.classList.add('scroll')}},380);
}
function refreshMedia(){
  var m=pick();cur=m;if(m&&m.playing)lastPlay=Date.now();
  var show=!!m&&(m.playing||Date.now()-lastPlay<20000),txt=m?(m.title+(m.artist?'  ·  '+m.artist:'')):'';
  if($('#pSong').textContent!==txt){$('#pSong').textContent=txt;if(show)fitSong()}
  $('#eq').classList.toggle('on',!!m&&m.playing);
  // expanded "Now playing" tab
  $('#npTitle').textContent=m?m.title:'Nothing playing';
  $('#npArtist').textContent=m?(m.artist||''):(isMac?'Play music in a browser, Spotify or Apple Music':'Play music in any browser or app');
  $('#npPlay').innerHTML=m&&m.playing?PAUSE:PLAY;
  if(show!==mus){mus=show;document.body.classList.toggle('mus',mus);if(!open)applyShape()}
}
function pollNP(){
  invoke('now_playing').then(function(r){sys=r;refreshMedia();schedNP(open&&tabOn==='nowp'?1500:(r.available?3000:6000))})
  .catch(function(){schedNP(8000)});
}
function schedNP(d){clearTimeout(npT);npT=setTimeout(pollNP,d)}
function npCtl(a){
  if(cur&&cur.src==='local'){if(a==='toggle'){au.paused?au.play():au.pause()}else play(idx+(a==='next'?1:-1));return}
  invoke('media_control',{action:a,source:(cur&&cur.src)||sys.source||''}).then(function(){setTimeout(function(){schedNP(0)},400)}).catch(function(){});
}
$('#npPlay').onclick=function(){npCtl('toggle')};$('#npNext').onclick=function(){npCtl('next')};$('#npPrev').onclick=function(){npCtl('prev')};

// local files player
$('#mOpen').onclick=function(){$('#mFiles').click()};
$('#mFiles').onchange=function(){list=list.concat(Array.prototype.slice.call(this.files));if(idx<0)play(0)};
function play(i){if(!list.length)return;idx=(i+list.length)%list.length;
  if(au.src)URL.revokeObjectURL(au.src);au.src=URL.createObjectURL(list[idx]);au.play();
  $('#mTitle').textContent=list[idx].name.replace(/\.[^.]+$/,'')}
$('#mPlay').onclick=function(){if(idx<0)return;au.paused?au.play():au.pause()};
$('#mNext').onclick=function(){play(idx+1)};$('#mPrev').onclick=function(){play(idx-1)};
au.onended=function(){play(idx+1)};
au.onplay=au.onpause=function(){$('#mPlay').innerHTML=au.paused?PLAY:PAUSE;refreshMedia()};
au.ontimeupdate=function(){if(au.duration){$('#seek').value=au.currentTime/au.duration*100;rng($('#seek'))}};
$('#seek').oninput=function(){rng(this);if(au.duration)au.currentTime=this.value/100*au.duration};

/* ---------- master volume ---------- */
function syncVol(){invoke('get_volume').then(function(v){$('#vSlide').value=Math.round(v*100);rng($('#vSlide'));$('#vBig').textContent=Math.round(v*100)+'%'}).catch(function(){})}
$('#vSlide').oninput=function(){rng(this);$('#vBig').textContent=this.value+'%';invoke('set_volume',{level:this.value/100}).catch(function(){})};

/* ---------- Claude chat (API key; Google sign-in only works on claude.ai) ---------- */
var hist=[];
$('#aiKey').onclick=function(){var r=$('#aiKeyRow');r.hidden=!r.hidden;$('#aiKeyIn').value=S.key;if(!r.hidden)$('#aiKeyIn').focus()};
$('#aiKeySave').onclick=function(){S.key=$('#aiKeyIn').value.trim();save();$('#aiKeyRow').hidden=true;$('#aiOut').textContent=S.key?'API key saved. Ask away.':'API key removed.'};
$('#aiWeb').onclick=function(){invoke('open_claude')};
function send(){
  var q=$('#aiIn').value.trim();if(!q)return;
  if(!navigator.onLine){$('#aiOut').textContent="You're offline. Claude needs internet; everything else still works.";return}
  if(!S.key){$('#aiOut').textContent='Add your Anthropic API key first (link below), or open claude.ai to sign in with Google in your browser.';$('#aiKeyRow').hidden=false;return}
  var hdr=null;$('#aiIn').value='';hist.push({role:'user',content:q});hist=hist.slice(-10);$('#aiOut').textContent='Thinking…';
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

/* ---------- weather (Open-Meteo, cached for offline) ---------- */
var ICON=function(c){return c===0?'☀️':c<=2?'🌤️':c===3?'☁️':c<=48?'🌫️':c<=57?'🌦️':c<=67?'🌧️':c<=77?'❄️':c<=82?'🌧️':'⛈️'};
function showWx(offline){
  var w=S.wx;if(!w){$('#wxCity').textContent=offline?'Offline: no weather yet':'Loading…';return}
  $('#wxIcon').textContent=ICON(w.code);$('#wxTemp').textContent=Math.round(w.temp)+(S.f?'°F':'°C');
  $('#wxCity').textContent=w.city+(offline?' (offline)':'');
  $('#wxMore').textContent='Feels '+Math.round(w.feels)+'°  ·  H '+Math.round(w.hi)+'°  L '+Math.round(w.lo)+'°  ·  Wind '+Math.round(w.wind)+(S.f?' mph':' km/h');
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
setTimeout(function(){loadWx(false)},2000);setInterval(function(){loadWx(false)},30*60000);showWx();

/* ---------- Claude usage ---------- */
function dayKey(){return new Date().toLocaleDateString('en-CA')}
function roll(){if(S.use.day!==dayKey())S.use={day:dayKey(),i:0,o:0,r:0}}
function addUse(u,h){
  roll();if(u){S.use.i+=u.input_tokens||0;S.use.o+=u.output_tokens||0;S.use.r+=1}
  var g=function(n){return h&&h.get?h.get('anthropic-ratelimit-'+n):null};
  if(g('tokens-limit'))S.rl={lim:+g('tokens-limit'),rem:+g('tokens-remaining'),reset:g('tokens-reset')};
  save();showUse();
}
function showUse(){
  roll();var u=S.use,n=function(x){return x.toLocaleString()};
  $('#uToday').textContent=n(u.i+u.o);$('#uReq').textContent=u.r;
  $('#uSplit').textContent='In '+n(u.i)+'  ·  Out '+n(u.o);
  if(S.rl){
    $('#uLeft').textContent=Math.round(S.rl.rem/S.rl.lim*100)+'%';
    $('#uLimit').textContent=n(S.rl.rem)+' of '+n(S.rl.lim)+' tokens left';
    var ms=Date.parse(S.rl.reset)-Date.now();
    if(ms>0){var t=Math.round(ms/1000);$('#uReset').textContent='Resets in '+Math.floor(t/60)+'m '+(t%60)+'s  (at '+new Date(Date.parse(S.rl.reset)).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+')'}
    else $('#uReset').textContent='Limit window has reset';
  }else{$('#uLeft').textContent='–';$('#uLimit').textContent='Rate limit: not available yet (press Refresh)';$('#uReset').textContent=''}
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

/* ---------- activity monitor ---------- */
var cpuH=[];
function fb(b){return b<1024?b+' B/s':b<1048576?Math.round(b/1024)+' KB/s':(b/1048576).toFixed(1)+' MB/s'}
function col(p){return p>85?'#ff453a':p>60?'#ff9f0a':'#30d158'}
function pollMon(){
  invoke('get_stats').then(function(r){
    var c=Math.round(r.cpu),m=Math.round(r.mem_used/r.mem_total*100);
    $('#cpuT').textContent=c+'%';$('#cpuBar').style.width=c+'%';$('#cpuBar').style.background=col(c);
    $('#ramT').textContent=m+'%';$('#ramBar').style.width=m+'%';$('#ramBar').style.background=col(m);
    $('#netT').textContent='↓ '+fb(r.down)+'   ↑ '+fb(r.up);
    $('#batT').textContent=r.battery>=0?'Battery '+r.battery+'%'+(r.charging?' · charging':''):'No battery';
    cpuH.push(c);if(cpuH.length>40)cpuH.shift();
    $('#cpuLine').setAttribute('points',cpuH.map(function(v,i){return (i*100/39).toFixed(1)+','+(23-v*22/100).toFixed(1)}).join(' '));
  }).catch(function(){});
}
/* polling only while the matching tab is visible */
var monIv=null,useIv=null;
function tabCheck(){
  var m=open&&tabOn==='mon',u=open&&tabOn==='use';
  if(m&&!monIv){pollMon();monIv=setInterval(pollMon,1500)}else if(!m&&monIv){clearInterval(monIv);monIv=null}
  if(u&&!useIv){showUse();useIv=setInterval(showUse,1000)}else if(!u&&useIv){clearInterval(useIv);useIv=null}
}

/* ---------- start ---------- */
rng($('#seek'));rng($('#vSlide'));
draw();applyShape();refreshMedia();schedNP(1200);
})();
