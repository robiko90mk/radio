var hostname = window.location.hostname;
var modesd = false;
const query = window.location.search;
const params = new URLSearchParams(query);
const yoTitle = 'ёRadio';
let audiopreview=null;
if(params.size>0){
  if(params.has('host')) hostname=params.get('host');
}
var websocket;
var wserrcnt = 0;
var wstimeout;
var loaded = false;
var currentItem = 0;

window.addEventListener('load', onLoad);

function loadCSS(href){ const link = document.createElement("link"); link.rel = "stylesheet"; link.href = href; document.head.appendChild(link); }
function loadJS(src, callback){ const script = document.createElement("script"); script.src = src; script.type = "text/javascript"; script.async = true; script.onload = callback; document.head.appendChild(script); }

function initWebSocket() {
  clearTimeout(wstimeout);
  console.log('Trying to open a WebSocket connection...');
  websocket = new WebSocket(`ws://${hostname}/ws`);
  websocket.onopen    = onOpen;
  websocket.onclose   = onClose;
  websocket.onmessage = onMessage;
}
function onLoad(event) { initWebSocket(); }

function onOpen(event) {
  console.log('Connection opened');
  continueLoading(playMode); //playMode in variables.js
  loaded = true;
  wserrcnt=0;
}
function onClose(event) {
  wserrcnt++;
  wstimeout=setTimeout(initWebSocket, wserrcnt<10?2000:120000);
}
function secondToTime(seconds){
  if(seconds>=3600){
    return new Date(seconds * 1000).toISOString().substring(11, 19);
  }else{
    return new Date(seconds * 1000).toISOString().substring(14, 19);
  }
}
function showById(show,hide){
  show.forEach(item=>{ getId(item).classList.remove('hidden'); });
  hide.forEach(item=>{ getId(item).classList.add('hidden'); });
}
function onMessage(event) {
  if (window.location.pathname === '/dlna.html') { //DLNA mod
    return;
  }
  try{
    const data = JSON.parse(escapeData(event.data));
    /*ir*/
    if(typeof data.ircode !== 'undefined'){
      getId('protocol').innerText=data.protocol;
      classEach('irrecordvalue', function(el){ if(el.hasClass("active")) el.innerText='0x'+data.ircode.toString(16).toUpperCase(); });
      return;
    }
    if(typeof data.irvals !== 'undefined'){
      classEach('irrecordvalue', function(el,i){ var val = data.irvals[i]; if(val>0) el.innerText='0x'+val.toString(16).toUpperCase(); else el.innerText=""; });
      return;
    }
    /*end ir*/
    if(typeof data.redirect !== 'undefined'){
      getId("mdnsnamerow").innerHTML=`<h3 style="line-height: 37px;color: #aaa; margin: 0 auto;">redirecting to ${data.redirect}</h3>`;
      setTimeout(function(){ window.location.href=data.redirect; }, 4000);
      return;
    }
    if(typeof data.playermode !== 'undefined') { //Web, SD
      modesd = data.playermode=='modesd';
      classEach('modeitem', function(el){ el.classList.add('hidden') });
      if(modesd) showById(['modesd', 'sdsvg'],['plsvg']); else showById(['modeweb','plsvg','bitinfo'],['sdsvg','snuffle']);
      showById(['volslider'],['sdslider']);
      getId('toggleplaylist').classList.remove('active');
      generatePlaylist(`http://${hostname}/data/playlist.csv`+"?"+new Date().getTime());
      // Add hiding elements with modeweb class in SD mode
      classEach('modeweb', function(el){ el.classList.toggle('hidden', modesd); });
      return;
    }
    if(typeof data.sdinit !== 'undefined') {
      if(data.sdinit==1) {
        getId('playernav').classList.add("sd");
        getId('volmbutton').classList.add("hidden");
      }else{
        getId('playernav').classList.remove("sd");
        getId('volmbutton').classList.remove("hidden");
      }
    }
    if(typeof data.sdpos !== 'undefined' && getId("sdpos")){
      if(data.sdtpos==0 && data.sdtend==0){
        getId("sdposvalscurrent").innerHTML="00:00";
        getId("sdposvalsend").innerHTML="00:00";
        getId("sdpos").value = data.sdpos;
        fillSlider(getId("sdpos"));
      }else{
        getId("sdposvalscurrent").innerHTML=secondToTime(data.sdtpos);
        getId("sdposvalsend").innerHTML=secondToTime(data.sdtend);
        getId("sdpos").value = data.sdpos;
        fillSlider(getId("sdpos"));
      }
      return;
    }
    if(typeof data.sdmin !== 'undefined' && getId("sdpos")){
      getId("sdpos").attr('min',data.sdmin); 
      getId("sdpos").attr('max',data.sdmax); 
      return;
    }
    if(typeof data.snuffle!== 'undefined'){
      if(data.snuffle==1){
        getId("snuffle").classList.add("active");
      }else{
        getId("snuffle").classList.remove("active");
      }
      return;
    }
    if(typeof data.payload !== 'undefined'){
      data.payload.forEach(item=> {
        setupElement(item.id, item.value);
      });
    }else{
      if(typeof data.current !== 'undefined') { setCurrentItem(data.current); return; }
      if(typeof data.file !== 'undefined') { generatePlaylist(data.file+"?"+new Date().getTime()); websocket.send('submitplaylistdone=1'); return; }
      if(typeof data.act !== 'undefined'){ data.act.forEach(showclass=> { classEach(showclass, function(el) { el.classList.remove("hidden"); }); }); return; }
      Object.keys(data).forEach(key=>{
        setupElement(key, data[key]);
      });
    }
  }catch(e){
    console.log("ws.onMessage error:", event.data);
  }
}
function escapeData(data){
  let m=data.match(/{.+?:\s"(.+?)"}/);
  if(m!==null){
    let m1 = m[1];
    if(m1.indexOf('"') !== -1){
      let mq=m1.replace(/["]/g, '\\\"');
      return data.replace(m1,mq);
    }
  }
  return data;
}
function getId(id,patent=document){
  return patent.getElementById(id);
}
function classEach(classname, callback) {
  document.querySelectorAll(`.${classname}`).forEach((item, index) => callback(item, index));
}
function quoteattr(s) {
  return ('' + s)
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
HTMLElement.prototype.attr = function(name, value=null){
  if(value!==null){
    return this.setAttribute(name, value);
  }else{
    return this.getAttribute(name);
  }
}
HTMLElement.prototype.hasClass = function(className){
  return this.classList.contains(className);
}
function fillSlider(sl){
  const slaveid = sl.dataset.slaveid;
  const value = (sl.value-sl.min)/(sl.max-sl.min)*100;
  if(slaveid) getId(slaveid).innerText=sl.value;
  sl.style.background = 'linear-gradient(to right, var(--accent-dark) 0%,  var(--accent-dark) ' + value + '%, var(--odd-bg-color) ' + value + '%, var(--odd-bg-color) 100%)';
}
function setupElement(id,value){
  const element = getId(id);
  if(element){
    if(element.classList.contains("checkbox")){
      element.classList.remove("checked");
      if(value) element.classList.add("checked");
    }
    if(element.classList.contains("classchange")){
      element.attr("class", "classchange");
      element.classList.add(value);
    }
    if(element.classList.contains("text")){
      element.innerText=value;
    }
    if(element.type==='text' || element.type==='number' || element.type==='password'){
      element.value=value;
    }
    if(element.type==='range'){
      element.value=value;
      fillSlider(element);
    }
    if(element.tagName==='SELECT'){
      element.value=value;
    }
  }
}
/***--- playlist ---***/
function setCurrentItem(item){
  currentItem=item;
  const playlist = getId("playlist");
  let topPos = 0, lih = 0;
  playlist.querySelectorAll('li').forEach((item, index)=>{ item.attr('class','play'); if(index+1==currentItem){ item.classList.add("active"); topPos = item.offsetTop; lih = item.offsetHeight; } });
  playlist.scrollTo({ top: (topPos-playlist.offsetHeight/2+lih/2), left: 0, behavior: 'smooth' });
}
function initPLEditor(){
  ple= getId('pleditorcontent');
  if(!ple) return;
  let html='';
  ple.innerHTML="";
  pllines = getId('playlist').querySelectorAll('li');
  pllines.forEach((item,index)=>{
    html+=`<li class="pleitem" id="${'plitem'+index}"><span class="grabbable" draggable="true">${("00"+(index+1)).slice(-3)}</span>
      <span class="pleinput plecheck"><input type="checkbox" class="plcb" /></span>
      <input class="pleinput plename" type="text" value="${quoteattr(item.dataset.name)}" maxlength="140" />
      <input class="pleinput pleurl" type="text" value="${item.dataset.url}" maxlength="140" />
      <span class="pleinput pleplay" data-command="preview">&#9658;</span>
      <input class="pleinput pleovol" type="number" min="-64" max="64" step="1" value="${item.dataset.ovol}" />
      <input class="pleinput pleovol" type="text" value="${quoteattr(item.dataset.genre||'')}" maxlength="64" placeholder="genre" />
      </li>`;
  });
  ple.innerHTML=html;
}
function handlePlaylistData(fileData) {
  const ul = getId('playlist');
  ul.innerHTML='';
  if (!fileData) return;
  const lines = fileData.split('\n');
  let li='', html='';
  for(var i = 0;i < lines.length;i++){
    let line = lines[i].split('\t');
    if(line.length==3 || line.length==4){
      const active=(i+1==currentItem)?' class="active"':'';
      const genre = (line.length==4?line[3].trim():"");
      li=`<li${active} attr-id="${i+1}" class="play" data-name="${line[0].trim()}" data-url="${line[1].trim()}" data-ovol="${line[2].trim()}" data-genre="${genre}"><span class="text">${line[0].trim()}</span><span class="count">${i+1}</span></li>`;
      html += li;
    }
  }
  ul.innerHTML=html;
  setCurrentItem(currentItem);
  if(!modesd) initPLEditor();
  buildGenreIndexFromCSV(fileData);
  annotatePlaylistWithGenres();
  populateGenreFilter();
  filterPlaylist();
}
let __genreIndexByItem = {};
let __genreList = [];
function buildGenreIndexFromCSV(fileData){
  __genreIndexByItem = {};
  const set = new Set();
  if(!fileData) return;
  const lines = fileData.split('\n');
  let itemIdx = 0;  
  for(let i=0;i<lines.length;i++){
    const raw = lines[i].replace(/\r$/, '');
    if(raw.trim()==='') continue;
    const cols = raw.split('\t');
    const name = (cols[0]||'').trim();
    const isGroup = name.startsWith('***') && name.endsWith('***');
    if(isGroup) continue; 
    itemIdx++; 
    const genre = (cols[3]||'').trim();
    __genreIndexByItem[itemIdx] = genre;
    if(genre) set.add(genre);
  }
  __genreList = Array.from(set).sort((a,b)=>a.localeCompare(b));
}
function populateGenreFilter(){
  const customOptions = getId('customoptions');
  if(!customOptions) return;
  const allOption = customOptions.querySelector('.customoption[data-value="all"]');
  customOptions.innerHTML = '';
  if(allOption) customOptions.appendChild(allOption);
  __genreList.forEach(genre => {
    const option = document.createElement('div');
    option.className = 'customoption';
    option.setAttribute('data-value', genre);
    option.textContent = genre;
    customOptions.appendChild(option);
  });
  if(!customOptions._initialized){
    initCustomFilter();
    customOptions._initialized = true;
  }
}
function initCustomFilter(){
  const customInput = getId('custominput');
  const customOptions = getId('customoptions');
  if(!customInput || !customOptions) return;
  customInput.dataset.selectedGenre = 'all';
  customInput.value = '';
  customInput.addEventListener('click', () => {
    customOptions.classList.toggle('hidden');
  });
  customInput.addEventListener('input', (e) => {
    filterPlaylist();
  });
  customOptions.addEventListener('click', (e) => {
    if(e.target.classList.contains('customoption')){
      const value = e.target.getAttribute('data-value');
      customInput.dataset.selectedGenre = value;
      customInput.value = ''; 
      customOptions.classList.add('hidden');
      filterPlaylist();
    }
  });
  document.addEventListener('click', (e) => {
    if(!customInput.contains(e.target) && !customOptions.contains(e.target)){
      customOptions.classList.add('hidden');
    }
  });
}
function filterPlaylist() {
  const customInput = getId('custominput');
  const playlist = getId('playlist');
  if (!playlist || !customInput) return;
  const searchTerm = customInput.value.toLowerCase();
  const selectedGenre = customInput.dataset.selectedGenre || 'all';
  const items = playlist.querySelectorAll('li');
  items.forEach(item => {
    const genre = item.getAttribute('data-genre') || '';
    const name = item.textContent.toLowerCase();
    const matchesGenre = selectedGenre === 'all' || genre.toLowerCase() === selectedGenre.toLowerCase();
    const matchesName = name.includes(searchTerm);
    item.style.display = matchesGenre && matchesName ? '' : 'none';
  });
}
function annotatePlaylistWithGenres(){
  const nodes = document.querySelectorAll('#playlist [attr-id]');
  nodes.forEach((el)=>{
    const idStr = el.getAttribute('attr-id');
    const idx = parseInt(idStr,10);
    if(!isNaN(idx)){
      const g = __genreIndexByItem[idx] || '';
      el.dataset.genre = g;
    }
  });
}
function generatePlaylist(path){
  getId('playlist').innerHTML='<div id="progress"><span id="loader"></span></div>';
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        handlePlaylistData(xhr.responseText);
      } else {
        handlePlaylistData(null);
      }
    }
  };
  xhr.open("GET", path);
  xhr.send(null);
}
function plAdd(){
  let ple=getId('pleditorcontent');
  let plitem = document.createElement('li');
  let cnt=ple.getElementsByTagName('li');
  plitem.attr('class', 'pleitem');
  plitem.attr('id', 'plitem'+(cnt.length));
  plitem.innerHTML = '<span class="grabbable" draggable="true">'+("00"+(cnt.length+1)).slice(-3)+'</span>\
      <span class="pleinput plecheck"><input type="checkbox" /></span>\
      <input class="pleinput plename" type="text" value="" maxlength="140" />\
      <input class="pleinput pleurl" type="text" value="" maxlength="140" />\
      <span class="pleinput pleplay" data-command="preview">&#9658;</span>\
      <input class="pleinput pleovol" type="number" min="-30" max="30" step="1" value="0" />\
      <input class="pleinput pleovol" type="text" value="" maxlength="64" placeholder="genre" />';
  ple.appendChild(plitem);
  ple.scrollTo({
    top: ple.scrollHeight,
    left: 0,
    behavior: 'smooth'
  });
}
function plRemove(){
  let items=getId('pleditorcontent').getElementsByTagName('li');
  let pass=[];
  for (let i = 0; i <= items.length - 1; i++) {
    if(items[i].getElementsByTagName('span')[1].getElementsByTagName('input')[0].checked) {
      pass.push(items[i]);
    }
  }
  if(pass.length==0) {
    alert('Choose something first');
    return;
  }
  for (var i = 0; i < pass.length; i++)
  {
    pass[i].remove();
  }
  items=getId('pleditorcontent').getElementsByTagName('li');
  for (let i = 0; i <= items.length-1; i++) {
    items[i].getElementsByTagName('span')[0].innerText=("00"+(i+1)).slice(-3);
  }
}
function submitPlaylist(){
  var items=getId("pleditorcontent").getElementsByTagName("li");
  var output="";
  for (var i = 0; i <= items.length - 1; i++) {
    inputs=items[i].getElementsByTagName("input");
    // inputs: 0 checkbox, 1 name, 2 url, 3 ovol, 4 genre
    if(inputs[1].value == "" || inputs[2].value == "") continue;
    let ovol = inputs[3].value;
    if(ovol < -30) ovol = -30;
    if(ovol > 30) ovol = 30;
    let genre = inputs[4].value || '';
    output+=inputs[1].value+"\t"+inputs[2].value+"\t"+ovol+"\t"+genre+"\n";
  }
  let file = new File([output], "tempplaylist.csv",{type:"text/plain;charset=utf-8", lastModified:new Date().getTime()});
  let container = new DataTransfer();
  container.items.add(file);
  let fileuploadinput=getId("file-upload");
  fileuploadinput.files = container.files;
  doPlUpload(fileuploadinput);
  toggleTarget(0, 'pleditorwrap');
}
function doPlUpload(finput) {
  websocket.send("submitplaylist=1");
  var formData = new FormData();
  formData.append("plfile", finput.files[0]);
  var xhr = new XMLHttpRequest();
  xhr.open("POST",`http://${hostname}/upload`,true);
  xhr.send(formData);
  finput.value = '';
}
function toggleTarget(el, id){
  const target = getId(id);
  if(id=='pleditorwrap'){
    audiopreview.pause();
    audiopreview.src='';
    getId('previewinfo').innerHTML='';
  }
  if(target){
    if(id=='pleditorwrap' && modesd) {
      getId('sdslider').classList.toggle('hidden');
      getId('volslider').classList.toggle('hidden');
      getId('bitinfo').classList.toggle('hidden');
      getId('snuffle').classList.toggle('hidden');
    }else target.classList.toggle("hidden");
    getId(target.dataset.target).classList.toggle("active");
  }
}
function checkboxClick(cb, command){
  cb.classList.toggle("checked");
  websocket.send(`${command}=${cb.classList.contains("checked")?1:0}`);
}
function sliderInput(sl, command){
  websocket.send(`${command}=${sl.value}`);
  fillSlider(sl);
}
function applyEqPreset(bass, middle, trebble){
  ['bass','middle','trebble'].forEach(id=>{
    const val = id==='bass'?bass:id==='middle'?middle:trebble;
    const sl = getId(id);
    if(sl){ sl.value=val; fillSlider(sl); websocket.send(`${id}=${val}`); }
  });
}
function handleWiFiData(fileData) {
  if (!fileData) return;
  var lines = fileData.split('\n');
  for(var i = 0;i < lines.length;i++){
    let line = lines[i].split('\t');
    if(line.length==2){
      getId("ssid"+i).value=line[0].trim();
      getId("pass"+i).attr('data-pass', line[1].trim());
    }
  }
}
function getWiFi(path){
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        handleWiFiData(xhr.responseText);
      } else {
        handleWiFiData(null);
      }
    }
  };
  xhr.open("GET", path);
  xhr.send(null);
}
function applyTZ(){
  websocket.send("tzh="+getId("tzh").value);
  websocket.send("tzm="+getId("tzm").value);
  websocket.send("sntp2="+getId("sntp2").value);
  websocket.send("sntp1="+getId("sntp1").value);
}
function rebootSystem(info){
  getId("settingscontent").innerHTML=`<h2>${info}</h2>`;
  getId("settingsdone").classList.add("hidden");
  getId("navigation").classList.add("hidden");
  setTimeout(function(){ window.location.href=`http://${hostname}/`; }, 5000);
}
function submitWiFi(){
  var output="";
  var items=document.getElementsByClassName("credential");
  for (var i = 0; i <= items.length - 1; i++) {
    inputs=items[i].getElementsByTagName("input");
    if(inputs[0].value == "") continue;
    let ps=inputs[1].value==""?inputs[1].dataset.pass:inputs[1].value;
    output+=inputs[0].value+"\t"+ps+"\n";
  }
  if(output!=""){ // Well, let's say, quack.
    let file = new File([output], "tempwifi.csv",{type:"text/plain;charset=utf-8", lastModified:new Date().getTime()});
    let container = new DataTransfer();
    container.items.add(file);
    let fileuploadinput=getId("file-upload");
    fileuploadinput.files = container.files;
    var formData = new FormData();
    formData.append("wifile", fileuploadinput.files[0]);
    var xhr = new XMLHttpRequest();
    xhr.open("POST",`http://${hostname}/upload`,true);
    xhr.send(formData);
    fileuploadinput.value = '';
    getId("settingscontent").innerHTML="<h2>Settings saved. Rebooting...</h2>";
    getId("settingsdone").classList.add("hidden");
    getId("navigation").classList.add("hidden");
    setTimeout(function(){ window.location.href=`http://${hostname}/`; }, 10000);
  }
}
function playItem(target){
  const item = target.attr('attr-id');
  setCurrentItem(item)
  websocket.send(`play=${item}`);
}
function hideSpinner(){
  getId("progress").classList.add("hidden");
  getId("content").classList.remove("hidden");
}
function changeMode(el){
  const cmd = el.dataset.command;
  //setPlaylistMod();
  el.classList.add('hidden');
  if(cmd=='web') getId('modesd').classList.remove('hidden');
  else getId('modeweb').classList.remove('hidden');
  websocket.send("newmode="+(cmd=="web"?0:1));
}
function toggleSnuffle(){
  let el = getId('snuffle');
  el.classList.toggle('active');
  websocket.send("snuffle="+el.classList.contains('active'));
}
function previewInfo(text, url='', error=false){
  const previewinfo=getId('previewinfo');
  previewinfo.classList.remove('error');
  if(url!='') previewinfo.innerHTML=`${text} <a href="${url}" target="_blank">${url}</a>`;
  else previewinfo.innerHTML=`${text}`;
  if(error) previewinfo.classList.add('error');
}
const PREVIEW_TIMEOUT = 3000;
function playPreview(root) {
  const streamUrl=root.getElementsByClassName('pleurl')[0].value;
  if(root.hasClass('active')){ root.classList.remove('active'); audiopreview.pause(); previewInfo('Stop playback:', streamUrl); return; }
  classEach('pleitem', function(el){ el.classList.remove('active') });
  if(streamUrl=='' || !audiopreview) { previewInfo("No streams available.", '', true); return; }
  previewInfo('Attempting to play:', streamUrl);
  audiopreview.src = streamUrl;
  audiopreview.load();
  let isTimeout = false;
  const timeout = setTimeout(() => { isTimeout = true; previewInfo("Connection timeout", streamUrl, true); root.classList.remove('active'); audiopreview.pause(); audiopreview.src = ''; return; }, PREVIEW_TIMEOUT);
  const onCanPlay = () => { if (!isTimeout) { clearTimeout(timeout); previewInfo('Playback', streamUrl); root.classList.add('active'); audiopreview.play().catch(err => { previewInfo("Playback error:", streamUrl, true); root.classList.remove('active'); return; }); }  };
  const onError = () => { if (!isTimeout) { clearTimeout(timeout); root.classList.remove('active'); previewInfo("Error loading stream:", streamUrl, true); audiopreview.src = ''; return; } };
  audiopreview.addEventListener("canplay", onCanPlay, { once: true });
  audiopreview.addEventListener("error", onError, { once: true });
}
function continueLoading(mode){
  if(typeof mode === 'undefined' || loaded) return;
  if(mode=="player"){
    const pathname = window.location.pathname;
    if(['/','/index.html'].includes(pathname)){
      document.title = `${yoTitle} - Player`;
      fetch(`player.html?${yoVersion}`).then(response => response.text()).then(player => { 
        getId('content').classList.add('idx');
        getId('content').innerHTML = player; 
        fetch('logo.svg').then(response => response.text()).then(svg => { 
          getId('logo').innerHTML = svg;
          hideSpinner();
          audiopreview = getId('audiopreview');
          generatePlaylist(`http://${hostname}/data/playlist.csv` + "?" + new Date().getTime());
          populateBankSelect();
		  //DLNA mod
			const dlnaBtn = document.getElementById('dlnabtn');
			if (dlnaBtn) {
			  if (typeof dlnaSupported !== 'undefined' && !dlnaSupported) {
				dlnaBtn.classList.add('hidden');
			  } else {
				dlnaBtn.addEventListener('click', openDlna);
				dlnaBtn.classList.remove('hidden');
			  }
			}
        });
        getId("version").innerText=` | v${yoVersion}`;
        document.querySelectorAll('input[type="range"]').forEach(sl => { fillSlider(sl); });
        websocket.send('getindex=1');
        //generatePlaylist(`http://${hostname}/data/playlist.csv`+"?"+new Date().getTime());
      });
    }
    if(pathname=='/settings.html'){
      document.title = `${yoTitle} - Settings`;
      fetch(`options.html?${yoVersion}`).then(response => response.text()).then(options => {
        getId('content').innerHTML = options; 
        fetch('logo.svg').then(response => response.text()).then(svg => { 
          getId('logo').innerHTML = svg;
          hideSpinner();
          initCustomOptions();
        });
        getId("version").innerText=` | v${yoVersion}`;
        document.querySelectorAll('input[type="range"]').forEach(sl => { fillSlider(sl); });
        websocket.send('getsystem=1');
        websocket.send('getscreen=1');
        websocket.send('gettimezone=1');
        websocket.send('getweather=1');
        websocket.send('getcontrols=1');
        getWiFi(`http://${hostname}/data/wifi.csv`+"?"+new Date().getTime());
        websocket.send('getactive=1');
        classEach("reset", function(el){ el.innerHTML='<svg viewBox="0 0 16 16" class="fill"><path d="M8 3v5a36.973 36.973 0 0 1-2.324-1.166A44.09 44.09 0 0 1 3.417 5.5a52.149 52.149 0 0 1 2.26-1.32A43.18 43.18 0 0 1 8 3z"/><path d="M7 5v1h4.5C12.894 6 14 7.106 14 8.5S12.894 11 11.5 11H1v1h10.5c1.93 0 3.5-1.57 3.5-3.5S13.43 5 11.5 5h-4z"/></svg>'; });
      });
    }
    if(pathname=='/update.html'){
      document.title = `${yoTitle} - Update`;
      fetch(`updform.html?${yoVersion}`).then(response => response.text()).then(updform => {
        getId('content').classList.add('upd');
        getId('content').innerHTML = updform; 
        fetch('logo.svg').then(response => response.text()).then(svg => { 
          getId('logo').innerHTML = svg;
          hideSpinner();
        });
        getId("version").innerText=` | v${yoVersion}`;
      });
    }
    if(pathname=='/ir.html'){
      document.title = `${yoTitle} - IR Recorder`;
      fetch(`irrecord.html?${yoVersion}`).then(response => response.text()).then(ircontent => {
        loadCSS(`ir.css?${yoVersion}`);
        getId('content').innerHTML = ircontent; 
        loadJS(`ir.js?${yoVersion}`, () => {
          fetch('logo.svg').then(response => response.text()).then(svg => { 
            getId('logo').innerHTML = svg;
            initControls();
            hideSpinner();
          });
        });
        getId("version").innerText=` | v${yoVersion}`;
      });
    }
    if (window.location.pathname === '/dlna.html') {  //DLNA mod
      document.title = `${yoTitle} - DLNA`;

      fetch(`dlna.html?${yoVersion}`)
        .then(r => r.text())
        .then(html => {
          getId('content').innerHTML = html;
          fetch('logo.svg').then(r => r.text()).then(svg => {
            getId('logo').innerHTML = svg;
            hideSpinner();
          });
          getId("version").innerText = ` | v${yoVersion}`;
        });
    }
  }else{ // AP mode
    fetch(`options.html?${yoVersion}`).then(response => response.text()).then(options => {
      getId('content').innerHTML = options; 
      fetch('logo.svg').then(response => response.text()).then(svg => { 
        getId('logo').innerHTML = svg;
        hideSpinner();
      });
      getId("version").innerText=` | v${yoVersion}`;
      getWiFi(`http://${hostname}/data/wifi.csv`+"?"+new Date().getTime());
      websocket.send('getactive=1');
    });
  }
  document.body.addEventListener('click', (event) => {
    let target = event.target.closest('div, span, li');
    if(!target) return; 
    if(target.classList && target.classList.contains("knob") && target.parentElement) target = target.parentElement;
    if(target.classList && target.classList.contains("snfknob") && target.parentElement) target = target.parentElement;
    if(target.parentElement && target.parentElement.classList && target.parentElement.classList.contains("play")){ playItem(target.parentElement); return; }
    if(target.classList.contains("navitem")) { getId(target.dataset.target).scrollIntoView({ behavior: 'smooth' }); return; }
    if(target.classList.contains("reset")) { websocket.send("reset="+target.dataset.name); return; }
    if(target.classList.contains("eqpreset")) { applyEqPreset(+target.dataset.bass, +target.dataset.middle, +target.dataset.trebble); return; }
    if(target.classList.contains("done")) { window.location.href=`http://${hostname}/`; return; }
    let command = target.dataset.command;
    if(!command && event.target && event.target.dataset && event.target.dataset.command){
      command = event.target.dataset.command;
      target = event.target;
    }
    if (command){
      if(target.classList.contains("local")){
        switch(command){
          case "toggle": toggleTarget(target, target.dataset.target); break;
          case "settings": window.location.href=`http://${hostname}/settings.html`; break;
          case "plimport": break;
          case "plexport": window.open(`http://${hostname}/data/playlist.csv`); break;
          case "pladd": plAdd(); break;
          case "pldel": plRemove(); break;
          case "plselect": {
            const headerCb = target.tagName === 'INPUT' ? target : target.querySelector('input[type="checkbox"]');
            const checked = headerCb ? headerCb.checked : false;
            getId('pleditorcontent').querySelectorAll('li .plecheck input[type="checkbox"]').forEach(cb => { cb.checked = checked; });
            break;
          }
          case "plsubmit": submitPlaylist(); break;
          case "fwupdate": window.location.href=`http://${hostname}/update.html`; break;
          case "webboard": window.location.href=`http://${hostname}/webboard`; break;
          case "setupir": window.location.href=`http://${hostname}/ir.html`; break;
          case "applyweather":
            let key=getId("wkey").value;
            if(key!=""){
              websocket.send("lat="+getId("wlat").value);
              websocket.send("lon="+getId("wlon").value);
              websocket.send("key="+key);
            }
            // --- NEW: Elevation save ---
            let gh = getId("grndHeight").value || 0;
            fetch("/set?grndHeight=" + encodeURIComponent(gh))
              .catch(err => alert("❌ Elevation save failed: " + err));
            // --- NEW: Pressure Slope ---
            let k = getId("pressureSlope_x1000").value || 120;
            fetch("/set?pressureSlope_x1000=" + encodeURIComponent(k))
              .catch(err => alert("❌ Pressure Slope save failed: " + err));
            break;
          case "applytz": applyTZ(); break;
          case "applyLedstrip":
            fetch("/set?lsEnabled="    + (getId("lsEnabled")   ? (getId("lsEnabled").classList.contains("checked")   ? 1 : 0) : 0)
              + "&lsSsEnabled="        + (getId("lsSsEnabled") ? (getId("lsSsEnabled").classList.contains("checked") ? 1 : 0) : 0)
              + "&lsModel="            + (getId("lsModel")     ? getId("lsModel").value     : 0)
              + "&lsBrightness="       + (getId("lsBrightness")? getId("lsBrightness").value: 30))
            .then(r => r.text()).then(t => { if(t==="OK") console.log("LED strip saved"); })
            .catch(err => alert("❌ LED strip save failed: " + err));
            break;
          case "wifiexport": window.open(`http://${hostname}/data/wifi.csv`+"?"+new Date().getTime()); break;
          case "wifiupload": submitWiFi(); break;
          case "reboot": websocket.send("reboot=1"); rebootSystem('Rebooting...'); break;
          case "format": websocket.send("format=1"); rebootSystem('Format SPIFFS. Rebooting...'); break;
          case "reset":  websocket.send("reset=1");  rebootSystem('Reset settings. Rebooting...'); break;
          case "snuffle": toggleSnuffle(); break;
          case "rebootmdns": websocket.send(`mdnsname=${getId('mdns').value}`); websocket.send("rebootmdns=1"); break;
          default: break;
        }
      }else{
        if(target.classList.contains("checkbox")) checkboxClick(target, command);
        if (target.classList.contains("cmdbutton")) {

          if (command === "toggle" && modesd) {

            // állapot lekérése — játszik-e?
            const isPlaying = target.classList.contains("active");

            if (isPlaying) {
              // épp játszik → STOP → küldjünk 0-t
              websocket.send("toggle=0");

            } else {
              // nem játszik → PLAY → küldjük a pozíciót
              let pos = 0;
              const sl = getId("sdpos");
              if (sl && sl.value) pos = sl.value;

              websocket.send(`toggle=${pos}`);
            }

          } else {
            websocket.send(`${command}=1`);
          }
        }
        if(target.classList.contains("modeitem")) changeMode(target);
        if(target.hasClass("pleplay")) playPreview(target.parentElement);
        if(target.classList.contains("play")){
          const item = target.attr('attr-id');
          setCurrentItem(item)
          websocket.send(`${command}=${item}`);
        }
      }
  event.preventDefault(); event.stopPropagation();
    }
  });
  document.body.addEventListener('input', (event) => {
    const originalTarget = event.target;
    let target = originalTarget;
    let command = target && target.dataset ? target.dataset.command : undefined;
    if (!command && target && target.parentElement && target.parentElement.dataset) {
      command = target.parentElement.dataset.command;
    }
    if (command) {
      if(target && target.type==='range') sliderInput(target, command);  //<-- range
      else websocket.send(`${command}=${target ? target.value : ''}`);   //<-- other
      event.preventDefault(); event.stopPropagation();
    }
    if (originalTarget && originalTarget.id === 'bankselect') {
      const selectedOption = originalTarget.selectedOptions[0];
      if (selectedOption && selectedOption.value) {
        const url = selectedOption.dataset.url; 
        if (url) {
          loadPlaylistFromBank(url);
        }
        originalTarget.value = '';
      }
    }
    // New custom bankselect is handled by initBankSelectFilter function
  });
  document.body.addEventListener('mousewheel', (event) => {
    const target = event.target;
    if(target.type==='range'){
      const command = target.dataset.command;
      target.valueAsNumber += event.deltaY>0?-1:1;
      if (command) {
        sliderInput(target, command);
      }
    }
  });
}
async function loadPlaylistFromBank(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load playlist');
    const csvText = await response.text();
    const blob = new Blob([csvText], { type: 'text/csv' });
    const file = new File([blob], 'bankplaylist.csv', { type: 'text/csv' });
    const container = new DataTransfer();
    container.items.add(file);
    const fileInput = getId('file-upload');
    fileInput.files = container.files;
    doPlUpload(fileInput);
    setTimeout(() => {
      websocket.send('plsubmit');
    }, 1000); 
  } catch (error) {
    alert('Error loading playlist from bank: ' + error.message);
  }
}
async function populateBankSelect() {
  const bankselectOptions = getId('bankselectoptions');
  const bankselectInput = getId('bankselectinput');
  if (!bankselectOptions || !bankselectInput) return;
  
  const defaultOptions = [
    { value: 'plbank1', text: 'Bank 1 General', url: 'https://raw.githubusercontent.com/mirek76/playlist/refs/heads/main/generalplaylist.csv' },
    { value: 'plbank2', text: 'Bank 2 Jazz', url: 'https://raw.githubusercontent.com/mirek76/playlist/refs/heads/main/jazzplaylist.csv' },
    { value: 'plbank3', text: 'Bank 3 Metal', url: 'https://raw.githubusercontent.com/mirek76/playlist/refs/heads/main/metalplaylist.csv' },
    { value: 'plbank4', text: 'Bank 4 Pop', url: 'https://raw.githubusercontent.com/mirek76/playlist/refs/heads/main/popplaylist.csv' },
    { value: 'plbank5', text: 'Bank 5 Rock', url: 'https://raw.githubusercontent.com/mirek76/playlist/refs/heads/main/rockplaylist.csv' }
  ];

  try {
    const response = await fetch('https://api.github.com/repos/mirek76/playlist/contents/');
    if (!response.ok) throw new Error('GitHub API error');
    const files = await response.json();
    const csvFiles = files.filter(file => file.name.endsWith('.csv') && file.type === 'file');
    if (csvFiles.length === 0) throw new Error('No CSV files found');
    
    bankselectOptions.innerHTML = '<div class="bankselectoption" data-value="">Select a bank...</div>';
    
    csvFiles.forEach((file, index) => {
      const option = document.createElement('div');
      option.className = 'bankselectoption';
      option.setAttribute('data-value', `plbank${index + 1}`);
      const name = file.name.replace('.csv', '').replace('playlist', '').replace(/^\w/, c => c.toUpperCase());
      option.textContent = `Bank ${index + 1} ${name}`;
      option.setAttribute('data-url', file.download_url);
      bankselectOptions.appendChild(option);
    });
  } catch (error) {
    console.log('Error loading bank select from GitHub:', error.message);
    bankselectOptions.innerHTML = '<div class="bankselectoption" data-value="">Select a bank...</div>';
    
    defaultOptions.forEach(opt => {
      const option = document.createElement('div');
      option.className = 'bankselectoption';
      option.setAttribute('data-value', opt.value);
      option.textContent = opt.text;
      option.setAttribute('data-url', opt.url);
      bankselectOptions.appendChild(option);
    });
  }
  
  // Uproszczona inicjalizacja - podstawowe nasłuchiwanie zdarzeń
  bankselectInput.addEventListener('click', () => {
    bankselectOptions.classList.toggle('hidden');
  });
  
  bankselectOptions.addEventListener('click', (e) => {
    if (e.target.classList.contains('bankselectoption')) {
      const value = e.target.getAttribute('data-value');
      const url = e.target.getAttribute('data-url');
      if (value && url) {
        loadPlaylistFromBank(url);
      }
      bankselectOptions.classList.add('hidden');
    }
  });
  
  // Zamykanie dropdown po kliknięciu poza elementem
  document.addEventListener('click', (e) => {
    if (bankselectInput && bankselectOptions && 
        !bankselectInput.contains(e.target) && 
        !bankselectOptions.contains(e.target)) {
      bankselectOptions.classList.add('hidden');
    }
  });
}

/** UPDATE **/
var uploadWithError = false;
function doUpdate(el) {
  let binfile = getId('binfile').files[0];
  if(binfile){
    getId('updateform').attr('class','hidden');
    getId("updateprogress").value = 0;
    getId('updateprogress').hidden=false;
    getId('update_cancel_button').hidden=true;
    var formData = new FormData();
    formData.append("updatetarget", getId('uploadtype1').checked?"firmware":"spiffs");
    formData.append("update", binfile);
    var xhr = new XMLHttpRequest();
    uploadWithError = false;
    xhr.onreadystatechange = function() {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        if(xhr.responseText!="OK"){
          getId("uploadstatus").innerHTML = xhr.responseText;
          uploadWithError=true;
        }
      }
    }
    xhr.upload.addEventListener("progress", progressHandler, false);
    xhr.addEventListener("load", completeHandler, false);
    xhr.addEventListener("error", errorHandler, false);
    xhr.addEventListener("abort", abortHandler, false);
    xhr.open("POST",`http://${hostname}/update`,true);
    xhr.send(formData);
  }else{
    alert('Choose something first');
  }
}
function progressHandler(event) {
  var percent = (event.loaded / event.total) * 100;
  getId("uploadstatus").innerHTML = Math.round(percent) + "%&nbsp;&nbsp;uploaded&nbsp;&nbsp;|&nbsp;&nbsp;please wait...";
  getId("updateprogress").value = Math.round(percent);
  if (percent >= 100) {
    getId("uploadstatus").innerHTML = "Please wait, writing file to filesystem";
  }
}
var tickcount=0;
function rebootingProgress(){
  getId("updateprogress").value = Math.round(tickcount/7);
  tickcount+=14;
  if(tickcount>700){
    location.href=`http://${hostname}/`;
  }else{
    setTimeout(rebootingProgress, 200);
  }
}
function completeHandler(event) {
  if(uploadWithError) return;
  getId("uploadstatus").innerHTML = "Upload Complete, rebooting...";
  rebootingProgress();
}
function errorHandler(event) {
  getId('updateform').attr('class','');
  getId('updateprogress').hidden=true;
  getId("updateprogress").value = 0;
  getId("status").innerHTML = "Upload Failed";
}
function abortHandler(event) {
  getId('updateform').attr('class','');
  getId('updateprogress').hidden=true;
  getId("updateprogress").value = 0;
  getId("status").innerHTML = "inUpload Aborted";
}
/** UPDATE **/
// === CUSTOM CODE START ===
// =============================
// GLOBAL STATE
// =============================
const STATE = {
  cfg: null,
  vu: null
};

// =============================
// LOADERS
// =============================
async function loadConfig() {
  if (!STATE.cfg) {
    const r = await fetch("/get?config", {cache:"no-store"});
    STATE.cfg = await r.json();
  }
  return STATE.cfg;
}

async function loadVu() {
  if (!STATE.vu) {
    const r = await fetch("/get?vu", {cache:"no-store"});
    STATE.vu = await r.json();
  }
  return STATE.vu;
}

async function reloadVu() {
  const r = await fetch("/get?vu", {cache:"no-store"});
  STATE.vu = await r.json();
  return STATE.vu;
}

async function safeFetch(url) {
  try {
    const r = await fetch(url, {cache:"no-store"});
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  } catch(e) {
    console.warn("Fetch failed:", url, e);
    return null;
  }
}

let _vuDefOptCache = null;
function nukeDefaultOptionUntilCfg() {
  const sel = document.getElementById('vuLayout');
  if (!sel) return;
  const optDef = sel.querySelector('option[value="0"]');
  if (optDef) { _vuDefOptCache = optDef; optDef.remove(); }
}

function restoreDefaultOptionIfNeeded(sel) {
  if (!sel) return;
  if (!sel.querySelector('option[value="0"]')) {
    const o = _vuDefOptCache || document.createElement('option');
    if (!o.value) { o.value = '0'; o.textContent = 'Default'; }
    o.disabled = false;
    const current = sel.value;
    sel.insertBefore(o, sel.firstChild);
    if (sel.querySelector(`option[value="${current}"]`)) {
      sel.value = current;
    }
  }
}

function _toBool(val, defVal) {
  if (typeof val === 'undefined') return defVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number')  return val !== 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes') return true;
    if (s === '0' || s === 'false'|| s === 'no')  return false;
  }
  return defVal;
}

function pad2(n) { return String(n).padStart(2, '0'); }
function getMonthLong(d, locale) { return new Intl.DateTimeFormat(locale, { month: "long" }).format(d); }
function getWeekdayLong(d, locale) { return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d); }

function formatDateByFmt(d, fmt, locale) {
  const y   = d.getFullYear();
  const m   = d.getMonth() + 1;
  const dd  = d.getDate();
  const m2  = pad2(m);
  const d2  = pad2(dd);
  const month = getMonthLong(d, locale);
  const dow   = getWeekdayLong(d, locale);

  const isHU = (locale || '').toLowerCase().startsWith('hu');

  if (isHU) {
    // --- MAGYAR blokk
    switch (fmt) {
      case 1: return `${y}. ${month} ${dd}.`;
      case 2: return `${y}. ${m2}. ${d2}. - ${dow}`;
      case 3: return `${y} ${month} ${dd}. ${dow}`;
      case 4: return `${m2}. ${d2}. - ${dow}`;
      default: return `${y}. ${m2}. ${d2}.`;
    }
  } else {
    // --- NEMZETKÖZI blokk
    switch (fmt) {
      case 1: return `${dd}. ${month} ${y}`;
      case 2: return `${dow} - ${d2}. ${m2}. ${y}`;
      case 3: return `${dow}, ${dd}. ${month} ${y}`;
      case 4: return `${dow} - ${d2}. ${m2}.`;
      default: return `${d2}. ${m2}. ${y}`;
    }
  }
}

function buildDateFormatOptions() {
  const sel = document.getElementById("dateFormat");
  if (!sel) return;
  const now = new Date();
  const locale = navigator.language || "en-US";
  sel.innerHTML = "";
  for (let i = 0; i <= 5; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = formatDateByFmt(now, i, locale);
    sel.appendChild(opt);
  }
}

async function initCustomOptions() {
  buildDateFormatOptions();

  try {
    const cfg = await loadConfig();
    const vu  = await loadVu();

    const gh = document.getElementById("grndHeight");
    if (gh) gh.value = cfg.grndHeight ?? 0;

    const k = document.getElementById("pressureSlope_x1000");
    if (k) k.value = cfg.pressureSlope_x1000 ?? 120;

    const a = document.getElementById("autoStartTime");
    const b = document.getElementById("autoStopTime");
    if (a) a.value = cfg.autoStartTime || "";
    if (b) b.value = cfg.autoStopTime || "";

    try {
      initVuDynamicsFromConfig(vu);
      applyVuLayoutAvailability(vu);
    } catch (e) {
      console.warn("VU init failed:", e);
    }

    const df = document.getElementById("dateFormat");
    if (df) {
      let v = (typeof cfg.dateFormat !== 'undefined') ? cfg.dateFormat : null;
      if (v === null && typeof vu.dateFormat !== 'undefined') {
        v = vu.dateFormat;
      }
      df.value = String(v ?? 0);

      if (!df.dataset.bound) {
        df.addEventListener("change", (e) => {
          const val = e.target.value;
          fetch("/setdate?value=" + encodeURIComponent(val))
            .then(r => r.ok ? r.text() : Promise.reject("HTTP " + r.status))
            .catch(err => alert("❌ Date format save failed: " + err));
        });
        df.dataset.bound = "1";
      }
    }

    const cfm = document.getElementById("clockFontMono");
    if (cfm) {
      cfm.classList.toggle("checked", !!cfg.clockfontmono);

      if (!cfm.dataset.bound) {
        cfm.addEventListener("click", async () => {
          const nowOn = !cfm.classList.contains("checked");
          cfm.classList.toggle("checked", nowOn);
          try {
            await fetch("/set?clockFontMono=" + (nowOn ? 1 : 0));
          } catch (err) {
            alert("❌ Clock font shadow save failed: " + err);
          }
        });
        cfm.dataset.bound = "1";
      }
    }

    const wis = document.getElementById("weatherIconSet");
    if (wis) {
      wis.classList.toggle("checked", !!cfg.weatherIconSet);

      if (!wis.dataset.bound) {
        wis.addEventListener("click", async () => {
          const nowOn = !wis.classList.contains("checked");
          wis.classList.toggle("checked", nowOn);
          try {
            await fetch("/set?weatherIconSet=" + (nowOn ? 1 : 0));
          } catch (err) {
            alert("❌ Clock font shadow save failed: " + err);
          }
        });
        wis.dataset.bound = "1";
      }
    }

    const sn = document.getElementById("showNameday");
    if (sn) sn.checked = !!cfg.showNameday;

    const sl = document.getElementById("stationLine");
    if (sl) sl.checked = !!cfg.stationLine;

    const sw = document.getElementById("shortWeather");
    if (sw) sw.checked = !!cfg.shortWeather;

    const ms = document.getElementById("metaStNameSkip");
    if (ms) ms.checked = !!cfg.metaStNameSkip;

    const mt = document.getElementById("monoTheme");
    if (mt) mt.checked = !!cfg.monoTheme;

    const dc = document.getElementById("directChannelChange");
    if (dc) dc.checked = !!cfg.directChannelChange;

    const hr = document.getElementById("hours12");
    if (hr) hr.checked = !!cfg.hours12;

    const de = document.getElementById("blDimEnable");
    if (de) de.checked = !!cfg.blDimEnable;

    const sLRT = document.getElementById('stationsListReturnTime');
    const sLRTinfo = document.getElementById('returnTimeInfo');

    const plm = document.getElementById("playlistMode");
    if (plm) plm.checked = !!cfg.playlistMode;

    const stw = document.getElementById("stallWatchdog");
    if (stw) stw.checked = !!cfg.stallWatchdog;

    if (sLRT) {
      const v = (typeof cfg.stationsListReturnTime !== 'undefined')
                  ? cfg.stationsListReturnTime
                  : 5;

      sLRT.value = v;
      if (sLRTinfo) sLRTinfo.textContent = v + " s";

      sLRT.addEventListener("input", () => {
        let val = parseInt(sLRT.value, 10);

        if (Number.isNaN(val)) val = 5;
        if (val < 2) val = 2;
        if (val > 30) val = 30;

        sLRT.value = val;
        if (sLRTinfo) sLRTinfo.textContent = val + " s";
      });
    }

  } catch (e) {
    console.error("initCustomOptions cfg error:", e);
  }

  const applyTimerBtn = document.querySelector("[data-name='applytimer']");
  if (applyTimerBtn) {
    applyTimerBtn.addEventListener('click', () => {
      const start = document.getElementById("autoStartTime")?.value || "";
      const stop  = document.getElementById("autoStopTime")?.value  || "";
      const query = "/set?autoStartTime=" + encodeURIComponent(start) +
                    "&autoStopTime=" + encodeURIComponent(stop);
      fetch(query)
        .then(r => r.text())
        .then(() => alert("Auto timer saved."))
        .catch(err => alert("❌ Timer save failed: " + err));
    });
  }

  document.querySelectorAll('.reset').forEach(el => {
    if (!el.hasAttribute("title")) el.setAttribute("title", "Reset");
  });
}

// -------- CUSTOMIZE (customize.html) --------
let vuEnabledState = false;

function clamp(v, min, max) {
  v = Number(v);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function setVuInputsDisabled(disabled) {
  ['vuBars','vuHeight','vuGap','vuMidColor','vuFade','vuPeakColor','vuLabelBgColor','vuLabelTextColor','vuLabHgts'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = disabled;
    const wrap = el.closest('.inputwrap');
    if (wrap) wrap.classList.toggle('disabled', disabled);
  });
}

// RGB565 -> #RRGGBB
function rgb565ToHex(v) {
  v = Number(v) >>> 0;
  let r = ((v >> 11) & 0x1F) << 3; r |= (r >> 5);
  let g = ((v >> 5)  & 0x3F) << 2; g |= (g >> 6);
  let b = ( v        & 0x1F) << 3; b |= (b >> 5);
  const to2 = n => n.toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

// --- anti-flood helpers ---
function debounce(fn, delay = 180) {
  let t = null;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

function onRelease(el, fn) {
  const run = (e) => {
    if (e && e.type === 'keyup' && !(e.key === 'Enter' || e.key === ' ')) return;
    fn(e);
  };
  ['change','mouseup','touchend','pointerup','keyup','blur','mouseleave'].forEach(ev =>
    el.addEventListener(ev, run, { passive: true })
  );
}

function bindColorPicker(inputId, name) {
  const el = document.getElementById(inputId);
  if (!el) { console.warn('[bindColorPicker] missing element:', inputId); return; }

  const send = (hex) => {
    console.log('[SETVU]', name, hex, 'vuOn=', vuEnabledState);
    fetch('/setvu?name=' + encodeURIComponent(name) + '&value=' + encodeURIComponent(hex))
      .then(r => r.text())
      .then(t => console.log('[SETVU OK]', name, t))
      .catch(err => console.error('[SETVU ERR]', name, err));
  };

  const handler = (e) => {
    const hex = e.target.value; 
    e.target.value = hex;
    send(hex);
  };

  el.addEventListener('input', handler);
  el.addEventListener('change', handler);
}

function bindSwatches() {
  document.querySelectorAll('.swatches').forEach(box => {
    const targetId = box.getAttribute('data-target'); 
    const input = document.getElementById(targetId);
    box.querySelectorAll('button[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-color');
        if (input) {
          input.value = hex;    
          input.dispatchEvent(new Event('input', {bubbles:true})); 
          input.dispatchEvent(new Event('change', {bubbles:true}));
        }
      });
    });
  });
}

function applyVuLayoutAvailability(obj) {
  const sel = document.getElementById('vuLayout');
  if (!sel) return;

  const hasFlag = obj && Object.prototype.hasOwnProperty.call(obj, 'vuDefaultAvailable');
  const allowed = hasFlag ? _toBool(obj.vuDefaultAvailable, true) : true;

  if (!allowed) {
    const optDef = sel.querySelector('option[value="0"]');
    if (optDef) optDef.remove();

    if (sel.value === '0') {
      const fallback =
        (sel.querySelector('option[value="2"]') && '2') ||
        (sel.querySelector('option[value="1"]') && '1') ||
        (sel.querySelector('option[value="3"]') && '3') || '1';

      sel.value = fallback;
      fetch('/setvu?name=layout&value=' + fallback)
        .then(() => loadVuBands())
        .then(() => fetch('/get?vu'))
        .then(r => r.json())
        .then(vu => initVuDynamicsFromConfig(vu));
    }
  } else {
    restoreDefaultOptionIfNeeded(sel);
  }
}

async function initVuLayoutSection() {

  const sel = document.getElementById('vuLayout');
  if (!sel) return;

  const vu = await loadVu();

  applyVuLayoutAvailability(vu);

  if (typeof vu.layout !== 'undefined') {
    sel.value = String(vu.layout);
  }

  initVuDynamicsFromConfig(vu);

  if (!sel.dataset.bound) {
    sel.addEventListener('change', async (e) => {

      const requested = String(e.target.value);

      await fetch('/setvu?name=layout&value=' + requested);

      await reloadVu();
      await loadVuBands();

    });
    sel.dataset.bound = '1';
  }
}

function isVuOn() { return vuEnabledState; }

async function loadVuBands() {
  const data = await loadVu();

  vuEnabledState = (typeof data.enabled === 'undefined') ? true : !!data.enabled;
  setVuInputsDisabled(!vuEnabledState);
  
  const midHex  = rgb565ToHex(data.midColor);
  const peakHex = rgb565ToHex(data.peakColor);
  const labTextHex  = rgb565ToHex(data.labelTextColor);
  const labBgHex = rgb565ToHex(data.labelBgColor);

  const bars = document.getElementById('vuBars');
  const height = document.getElementById('vuHeight');
  const gap  = document.getElementById('vuGap');
  const mid  = document.getElementById('vuMidColor');
  const fade = document.getElementById('vuFade');
  const aup = document.getElementById('vuAlphaUp');
  const adn = document.getElementById('vuAlphaDown');
  const pup = document.getElementById('vuPeakUp');
  const pdn = document.getElementById('vuPeakDown');
  const pcol= document.getElementById('vuPeakColor');
  const ltcol= document.getElementById('vuLabelTextColor');
  const lbcol= document.getElementById('vuLabelBgColor');
  const lheight = document.getElementById('vuLabHgts');

  if (mid)  mid.value  = midHex;
  if (pcol) pcol.value = peakHex;

  console.log('[loadVuBands] mid=', midHex, 'peak=', peakHex, 'vuOn=', vuEnabledState);

  if (bars) bars.value = data.bars;
  if (height) height.value = data.height;
  if (gap)  gap.value  = data.gap;
  if (mid)  mid.value  = rgb565ToHex(data.midColor);
  if (fade) fade.value = (typeof data.fade !== 'undefined') ? data.fade : 3;
  if (aup) aup.value = data.alphaUp;
  if (adn) adn.value = data.alphaDown;
  if (pup) pup.value = data.pUp;
  if (pdn) pdn.value = data.pDown;
  if (pcol) pcol.value = rgb565ToHex(data.peakColor);
  if (ltcol) ltcol.value = rgb565ToHex(data.labelTextColor);
  if (lbcol) lbcol.value = rgb565ToHex(data.labelBgColor);
  if (lheight) lheight.value = data.labelHeight;
  initVuDynamicsFromConfig(data);

  const vuEnabled = document.getElementById('vuEnabled');
  if (vuEnabled) vuEnabled.classList.toggle('checked', vuEnabledState);

  ['vuAlphaUp','vuAlphaDown','vuPeakUp','vuPeakDown','vuExpo','vuFloor','vuCeil','vuGain','vuKnee','vuMidPct','vuHighPct']
  .forEach(id => fillSlider(document.getElementById(id)));

}

function bindSlider(id, name, min, max) {
  const el = document.getElementById(id);
  if (!el) return;

  el.min = min; el.max = max;
  fillSlider(el);

  let lastSent = null;
  const send = (v) => {
    const val = parseInt(v, 10);
    if (val === lastSent) return; 
    lastSent = val;
    fetch('/setvu?name=' + encodeURIComponent(name) + '&value=' + encodeURIComponent(val));
  };
  const sendDebounced = debounce(() => send(el.value), 180);

  el.addEventListener('input', (e) => {
    fillSlider(e.target);
    sendDebounced();
  }, { passive: true });

  onRelease(el, () => send(el.value));
}

function bindSliderSet(id, name, min, max) {
  const el = document.getElementById(id);
  if (!el) return;

  el.min = min; 
  el.max = max;
  fillSlider(el);

  let lastSent = null;
  const send = (v) => {
    const val = parseInt(v, 10);
    if (val === lastSent) return; 
    lastSent = val;
    fetch('/set?' + encodeURIComponent(name) + '=' + encodeURIComponent(val));
  };

  const sendDebounced = debounce(() => send(el.value), 180);

  el.addEventListener('input', (e) => {
    fillSlider(e.target);
    sendDebounced();
  }, { passive: true });

  onRelease(el, () => send(el.value));
}

function bindVuDynSlider(id, name, fmt) {
  const el  = document.getElementById(id);
  const out = document.getElementById(id + "Val");
  if (!el) return;

  if (!el.hasAttribute('min')) el.min = 0;
  if (!el.hasAttribute('max')) el.max = 100;

  const updateLabel = () => { if (out) out.textContent = fmt ? fmt(el.value) : String(el.value); };

  let lastSent = null;
  const send = (v, save) => {
    const val = parseInt(v, 10);
    if (val === lastSent && save === 0) return;
    lastSent = val;
    fetch(`/setvu?name=${encodeURIComponent(name)}&value=${encodeURIComponent(val)}&save=${save?1:0}`);
  };

  const sendDebounced = debounce(() => send(el.value, 0), 180);

  const updateUI = () => { updateLabel(); fillSlider(el); };

  el.addEventListener('input', () => { updateUI(); sendDebounced(); }, { passive: true });
  onRelease(el, () => { updateUI(); send(el.value); });

  updateUI();
}


function initVuDynamicsFromConfig(cfg) {
  const setIf = (id, v) => {
    const el = document.getElementById(id);
    if (el && v != null) { el.value = v; fillSlider(el); }
  };

  setIf("vuExpo",  cfg.expo);
  setIf("vuFloor", cfg.floor);
  setIf("vuCeil",  cfg.ceil);
  setIf("vuGain",  cfg.gain);
  setIf("vuKnee",  cfg.knee);

  const gammaFmt = v => (Math.round((parseInt(v,10)/100)*100)/100).toFixed(2);
  bindVuDynSlider("vuExpo",  "expo",  gammaFmt);
  bindVuDynSlider("vuFloor", "floor", v => `${v}%`);
  bindVuDynSlider("vuCeil",  "ceil",  v => `${v}%`);
  bindVuDynSlider("vuGain",  "gain",  gammaFmt);
  bindVuDynSlider("vuKnee",  "knee",  v => `${v}%`);

  const midPct  = document.getElementById('vuMidPct');
  const highPct = document.getElementById('vuHighPct');
  const midInfo  = document.getElementById('vuMidPctInfo');
  const highInfo = document.getElementById('vuHighPctInfo');

  if (midPct) {
    midPct.value = (typeof cfg.midPct !== 'undefined' ? cfg.midPct : 60);
    fillSlider(midPct);
    if (midInfo) midInfo.textContent = midPct.value + "%";
    midPct.addEventListener("input", () => {
      fillSlider(midPct);
      if (midInfo) midInfo.textContent = midPct.value + "%";
    }, { passive: true });
  }

  if (highPct) {
    highPct.value = (typeof cfg.highPct !== 'undefined' ? cfg.highPct : 80);
    fillSlider(highPct);
    if (highInfo) highInfo.textContent = highPct.value + "%";
    highPct.addEventListener("input", () => {
      fillSlider(highPct);
      if (highInfo) highInfo.textContent = highPct.value + "%";
    }, { passive: true });
  }

  const midEn  = document.getElementById('midColorEnabled');
  const peakEn = document.getElementById('peakColorEnabled');
  if (midEn)
    midEn.classList.toggle('checked',
      (typeof cfg.midOn === 'undefined') ? true : !!cfg.midOn);
  if (peakEn)
    peakEn.classList.toggle('checked',
      (typeof cfg.peakOn === 'undefined') ? true : !!cfg.peakOn);
}

function initStationsReturnTime(cfg) {

  const input = document.getElementById("stationsListReturnTime");
  const info  = document.getElementById("returnTimeInfo");

  if (!input) return;

  // inicializálás
  let v = parseInt(cfg.stationsListReturnTime ?? 5, 10);
  if (Number.isNaN(v)) v = 5;
  v = Math.min(30, Math.max(2, v));

  input.value = v;
  if (info) info.textContent = v + " s";

  // change handler
  if (!input.dataset.bound) {

    input.addEventListener("change", async () => {

      let val = parseInt(input.value, 10);
      if (Number.isNaN(val)) val = 5;

      val = Math.min(30, Math.max(2, val));
      input.value = val;

      if (info) info.textContent = val + " s";

      try {
        await fetch("/set?stationsListReturnTime=" + val);
      } catch (err) {
        alert("❌ Return time save failed: " + err);
      }

    });

    input.dataset.bound = "1";
  }
}


async function loadVuMoves() {
  try {
    const data = await loadVu();
    const map = [
      ['vuAlphaUp',   'vuAlphaUpInfo',   data.alphaUp],
      ['vuAlphaDown', 'vuAlphaDownInfo', data.alphaDown],
      ['vuPeakUp',    'vuPeakUpInfo',    data.pUp],
      ['vuPeakDown',  'vuPeakDownInfo',  data.pDown],
    ];
    map.forEach(([id, infoId, val]) => {
      const el = document.getElementById(id);
      if (!el || typeof val === 'undefined') return;
      el.value = val;
      const info = document.getElementById(infoId);
      if (info) info.innerText = val;
      fillSlider(el);
    });
  } catch(e) {}
}

async function initCustomizePage() {
  buildDateFormatOptions(); 

  document.title = `${(window.yoTitle || 'yoRadio')} - Customize`;
  const verEl = document.getElementById('version');
  if (verEl && typeof window.yoVersion !== 'undefined') {
    verEl.textContent = ` | v${yoVersion}`;
  }

  try {
    const cfg = await loadConfig();
    const vu  = await loadVu();
    // --- Station line ---
    const sl = document.getElementById("stationLine");
    if (sl) {
      sl.classList.toggle("checked", !!cfg.stationLine);

          sl.addEventListener("click", () => {
        const nowOn = !sl.classList.contains("checked");
        sl.classList.toggle("checked", nowOn);
        fetch("/set?stationLine=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ StationLine save failed: " + err));
      });
    }

    // --- Playlist mode ---
    const plm = document.getElementById("playlistMode");
    if (plm) {
      plm.classList.toggle("checked", !!cfg.playlistMode);

          plm.addEventListener("click", () => {
        const nowOn = !plm.classList.contains("checked");
        plm.classList.toggle("checked", nowOn);
        fetch("/set?playlistMode=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Playlist Mode save failed: " + err));
      });
    }

    // --- Stall watchdog enable ---
    const stw = document.getElementById("stallWatchdog");
    if (stw) {
      stw.classList.toggle("checked", !!cfg.stallWatchdog);

          stw.addEventListener("click", () => {
        const nowOn = !stw.classList.contains("checked");
        stw.classList.toggle("checked", nowOn);
        fetch("/set?stallWatchdog=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Stall watchdog enable save failed: " + err));
      });
    }

    // --- Short weather ---
    const sw = document.getElementById("shortWeather");
    if (sw) {
      sw.classList.toggle("checked", !!cfg.shortWeather);

          sw.addEventListener("click", () => {
        const nowOn = !sw.classList.contains("checked");
        sw.classList.toggle("checked", nowOn);
        fetch("/set?shortWeather=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Shortweather save failed: " + err));
      });
    }

    // --- Date format ---
    const df = document.getElementById("dateFormat");
    if (df) {
      let v = (typeof cfg.dateFormat !== 'undefined') ? cfg.dateFormat : null;
      if (v === null) {
        try {
          const vu = await loadVu();
          if (typeof vu.dateFormat !== 'undefined') v = vu.dateFormat; // fallback
        } catch (_) {}
      }
      df.value = String(v ?? 0);

      if (!df.dataset.bound) {
        df.addEventListener("change", (e) => {
          fetch("/setdate?value=" + encodeURIComponent(e.target.value))
            .then(r => r.ok ? r.text() : Promise.reject("HTTP " + r.status))
            .catch(err => alert("❌ Date format save failed: " + err));
        });
        df.dataset.bound = "1";
      }
    }

    // --- Nameday (init + bind) ---
    const sn = document.getElementById("showNameday");
    if (sn) {
      sn.classList.toggle("checked", !!cfg.showNameday);

      sn.addEventListener("click", () => {
        const nowOn = !sn.classList.contains("checked");
        sn.classList.toggle("checked", nowOn);
        fetch("/setnameday?value=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Nameday save failed: " + err));
      });
    }

    // --- Clock font (init + bind) ---
    const cf = document.getElementById("clockFont");
    if (cf) {
      const n = Number(cfg.clockFonts || 5);
      while (cf.options.length > n) cf.remove(cf.options.length - 1);
      for (let i = cf.options.length; i < n; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = `Font ${i}`;
        cf.appendChild(opt);
      }
      cf.value = String(cfg.clockFont ?? 0);
    } 

   // --- Clock Font Mono / Shadow toggle ---
   const cfm = document.getElementById("clockFontMono");
   if (cfm) {
     cfm.classList.toggle("checked", !!cfg.clockfontmono);
     if (!cfm.dataset.bound) {
       cfm.addEventListener("click", async () => {
         const nowOn = !cfm.classList.contains("checked");
         cfm.classList.toggle("checked", nowOn);
         try {
           await fetch("/set?clockFontMono=" + (nowOn ? 1 : 0));
         } catch (err) {
           alert("❌ Clock font shadow save failed: " + err);
         }
       });
       cfm.dataset.bound = "1";
     }
   }

    // --- META Station name skip INIT ---
    const ms = document.getElementById("metaStNameSkip");
    if (ms) {
      ms.classList.toggle("checked", !!cfg.metaStNameSkip);

          ms.addEventListener("click", () => {
        const nowOn = !ms.classList.contains("checked");
        ms.classList.toggle("checked", nowOn);
        fetch("/set?metaStNameSkip=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Meta Station Name Skip save failed: " + err));
      });
    }

    // --- Mono THEME INIT ---
    const mt = document.getElementById("monoTheme");
    if (mt) {
      mt.classList.toggle("checked", !!cfg.monoTheme);

          mt.addEventListener("click", () => {
        const nowOn = !mt.classList.contains("checked");
        mt.classList.toggle("checked", nowOn);
        fetch("/set?monoTheme=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Mono THEME save failed: " + err));
      });
    }

    // --- Direct Chanel Change INIT ---
    const dc = document.getElementById("directChannelChange");
    if (dc) {
      dc.classList.toggle("checked", !!cfg.directChannelChange);

          dc.addEventListener("click", () => {
        const nowOn = !dc.classList.contains("checked");
        dc.classList.toggle("checked", nowOn);
        fetch("/set?directChannelChange=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Direct Chanel Change save failed: " + err));
      });
    }

    // --- Backlight enable INIT ---
    const bd = document.getElementById("blDimEnable");
    if (bd) {
      bd.classList.toggle("checked", !!cfg.blDimEnable);

          bd.addEventListener("click", () => {
        const nowOn = !bd.classList.contains("checked");
        bd.classList.toggle("checked", nowOn);
        fetch("/set?blDimEnable=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Backlight dimmer enable save failed: " + err));
      });
    }

    // --- Backlight sliders INIT ---
    const blLevel = document.getElementById("blDimLevel");
    const blInterval = document.getElementById("blDimInterval");

    if (blLevel) {
      const v = (typeof cfg.blDimLevel !== 'undefined') ? cfg.blDimLevel : 10;
      blLevel.value = v;
      fillSlider(blLevel);

      const levelInfo = document.getElementById('blDimLevelInfo');
      if (levelInfo) levelInfo.textContent = v;
    }

    if (blInterval) {
      const v = (typeof cfg.blDimInterval !== 'undefined') ? cfg.blDimInterval : 60;
      blInterval.value = v;
      fillSlider(blInterval);

      const intervalInfo = document.getElementById('blDimIntervalInfo');
      if (intervalInfo) intervalInfo.textContent = v;
    }

    // --- Stations list return time INIT ---
    initStationsReturnTime(cfg);

    if (!cf.dataset.bound) {
      cf.addEventListener("change", (e) => {
        fetch("/setClockFont?id=" + encodeURIComponent(e.target.value))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ Clock font save failed: " + err));
      });
      cf.dataset.bound = "1";
    }

    // --- 12 Hours clock INIT ---
    const hr = document.getElementById("hours12");
    if (hr) {
      hr.classList.toggle("checked", !!cfg.hours12);

          hr.addEventListener("click", () => {
        const nowOn = !hr.classList.contains("checked");
        hr.classList.toggle("checked", nowOn);
        fetch("/set?hours12=" + (nowOn ? 1 : 0))
          .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
          .catch(err => alert("❌ 12 hours clock save failed: " + err));
      });
    }

    // --- Weather iconset (init + bind) ---
    const wi = document.getElementById("weatherIconSet");
    if (wi) {
      wi.value = String(cfg.weatherIconSet ?? 0);

      if (!wi.dataset.bound) {
        wi.addEventListener("change", (e) => {
          fetch("/set?weatherIconSet=" + encodeURIComponent(e.target.value))
            .then(r => r.ok ? null : Promise.reject("HTTP " + r.status))
            .catch(err => alert("❌ Weather IconSet save failed: " + err));
        });
        wi.dataset.bound = "1";
      }
    }

    // --- TTS DND init ---
    const dndS = document.getElementById('ttsDndStart');
    const dndE = document.getElementById('ttsDndStop');

    if (dndS) dndS.value = (cfg.ttsdndstart || "");
    if (dndE) dndE.value = (cfg.ttsdndstop  || "");

    // Apply gomb
    const dndApply = document.querySelector("[data-name='ttsDndApply']");
    if (dndApply && !dndApply.dataset.bound) {
      dndApply.addEventListener('click', async () => {
        const s = (dndS?.value || "").trim();
        const e = (dndE?.value || "").trim();
        const qs = new URLSearchParams({ dndStartTime: s, dndStopTime: e }).toString();
        try {
          await fetch('/set?' + qs);
        } catch (err) {
          alert('❌ DND save failed: ' + err);
        }
      });
      dndApply.dataset.bound = '1';
    }

    const dndReset = document.querySelector(".reset[data-name='ttsDndReset']");
    if (dndReset && !dndReset.dataset.bound) {
      dndReset.addEventListener('click', async () => {
        try {
          await fetch('/set?dndReset=1');
          if (dndS) dndS.value = "";
          if (dndE) dndE.value = "";
        } catch (err) {
          alert('❌ DND reset failed: ' + err);
        }
      });
      dndReset.dataset.bound = '1';
    }

    bindTTSFromConfig(cfg);

  // --- TTS during playback ---
  const ttsPB = document.getElementById('ttsDuringPlayback');
  if (ttsPB) {
    ttsPB.classList.toggle('checked', !!cfg.ttsduringplayback);
    if (!ttsPB.dataset.bound) {
      ttsPB.addEventListener('click', async () => {
        const nowOn = !ttsPB.classList.contains('checked');
        ttsPB.classList.toggle('checked', nowOn);
        try {
          await fetch('/set?ttsDuringPlayback=' + (nowOn ? 1 : 0));
        } catch (err) {
          alert('❌ Fade mode save failed: ' + err);
        }
      });
      ttsPB.dataset.bound = '1';
    }
  }

  } catch (e) {
    console.error("initCustomizePage cfg error:", e);
  }

  //await loadVuBands();
  bindSlider('vuAlphaUp',   'alphaUp',   0, 100);
  bindSlider('vuAlphaDown', 'alphaDown', 0, 100);
  bindSlider('vuPeakUp',    'pUp',       0, 100);
  bindSlider('vuPeakDown',  'pDown',     0, 100);
  await loadVuMoves();

  document.body.addEventListener('click', (ev) => {
    const target = ev.target.closest('.navitem');
    if (!target) return;
    const sec = document.getElementById(target.dataset.target);
    if (sec) {
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      ev.preventDefault(); ev.stopPropagation();
    }
  });

  const vuEnabled = document.getElementById('vuEnabled');
  if (vuEnabled) {
    vuEnabled.addEventListener('click', () => {
      const nowOn = !vuEnabled.classList.contains('checked');
      vuEnabled.classList.toggle('checked', nowOn);
      fetch('/setvu?name=enabled&value=' + (nowOn?1:0))
        .then(() => setVuInputsDisabled(!nowOn));
    });
  }
  

  const midEn = document.getElementById('midColorEnabled');
  if (midEn) {
    midEn.addEventListener('click', () => {
      const nowOn = !midEn.classList.contains('checked');
      midEn.classList.toggle('checked', nowOn);
      fetch('/setvu?name=midOn&value=' + (nowOn ? 1 : 0))
        .then(() => reloadVu())
        .then(() => loadVuBands()); // frissítjük a tényleges színt + tiltást
    });
  }

  const peakEn = document.getElementById('peakColorEnabled');
  if (peakEn) {
    peakEn.addEventListener('click', () => {
      const nowOn = !peakEn.classList.contains('checked');
      peakEn.classList.toggle('checked', nowOn);
      fetch('/setvu?name=peakOn&value=' + (nowOn ? 1 : 0))
        .then(() => reloadVu())
        .then(() => loadVuBands());
    });
  }

  const bars = document.getElementById('vuBars');
  if (bars) {
    bars.addEventListener('change', e => {
      e.target.value = clamp(e.target.value, 5, 64);
      if (!isVuOn()) return;
      fetch('/setvu?name=bars&value=' + encodeURIComponent(e.target.value));
    });
  }

  const height = document.getElementById('vuHeight');
  if (height) {
    height.addEventListener('change', e => {
      e.target.value = clamp(e.target.value, 1, 50);
      if (!isVuOn()) return;
      fetch('/setvu?name=height&value=' + encodeURIComponent(e.target.value));
    });
  }

  const gap = document.getElementById('vuGap');
  if (gap) {
    gap.addEventListener('change', e => {
      e.target.value = clamp(e.target.value, 0, 6);
      if (!isVuOn()) return;
      fetch('/setvu?name=gap&value=' + encodeURIComponent(e.target.value));
    });
  }

  const fade = document.getElementById('vuFade');
  if (fade) {
    fade.addEventListener('change', e => {
      e.target.value = clamp(e.target.value, 0, 10);
      if (!isVuOn()) return;
      fetch('/setvu?name=fade&value=' + encodeURIComponent(e.target.value));
    });
  }

  const aup = document.getElementById('vuAlphaUp');
  if (aup) aup.addEventListener('change', e => {
    const v = clamp(e.target.value, 0, 100);
    e.target.value = v;
    fetch('/setvu?name=alphaUp&value=' + v);
  });

  const adn = document.getElementById('vuAlphaDown');
  if (adn) adn.addEventListener('change', e => {
    const v = clamp(e.target.value, 0, 100);
    e.target.value = v;
    fetch('/setvu?name=alphaDown&value=' + v);
  });

  const pup = document.getElementById('vuPeakUp');
  if (pup) pup.addEventListener('change', e => {
    const v = clamp(e.target.value, 0, 100);
    e.target.value = v;
    fetch('/setvu?name=pUp&value=' + v);
  });

  const pdn = document.getElementById('vuPeakDown');
  if (pdn) pdn.addEventListener('change', e => {
    const v = clamp(e.target.value, 0, 100);
    e.target.value = v;
    fetch('/setvu?name=pDown&value=' + v);
  });

  const lheight = document.getElementById('vuLabHgts');
  if (lheight) {
    lheight.addEventListener('change', e => {
      e.target.value = clamp(e.target.value, 1, 50);
      if (!isVuOn()) return;
      fetch('/setvu?name=labelHeight&value=' + encodeURIComponent(e.target.value));
    });
  }

 bindColorPicker('vuMidColor',  'midColor');
 
 bindColorPicker('vuPeakColor', 'peakColor');
 
 bindColorPicker('vuLabelBgColor', 'labelBgColor');
  
 bindColorPicker('vuLabelTextColor', 'labelTextColor');
 
 bindSwatches();
 
 bindSlider('vuMidPct',  'midPct',  0, 100);
 bindSlider('vuHighPct', 'highPct', 0, 100);
 
 const midInfo  = document.getElementById('vuMidPctInfo');
 const highInfo = document.getElementById('vuHighPctInfo');
 document.getElementById('vuMidPct')?.addEventListener('input',  e => { if (midInfo)  midInfo.textContent  = e.target.value; });
 document.getElementById('vuHighPct')?.addEventListener('input', e => { if (highInfo) highInfo.textContent = e.target.value; });
 
 bindSliderSet('blDimLevel', 'blDimLevel', 0, 100);
 bindSliderSet('blDimInterval', 'blDimInterval', 5, 300);

 const levelInfo  = document.getElementById('blDimLevelInfo');
 const intervalInfo = document.getElementById('blDimIntervalInfo');
 document.getElementById('blDimLevel')?.addEventListener('input',  e => { if (levelInfo) levelInfo.textContent = e.target.value; });
 document.getElementById('blDimInterval')?.addEventListener('input', e => { if (intervalInfo) intervalInfo.textContent = e.target.value;});

  const fileInput = document.getElementById("themefile");
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      const file = fileInput.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("upload", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/uploadtheme", true);
      xhr.onload = function () {
        if (xhr.status === 200) alert(xhr.responseText || "Theme uploaded. Applying…");
        else alert("❌ Upload failed: " + xhr.status + " " + xhr.statusText);
      };
      xhr.onerror = function () { alert("❌ Network error during upload"); };
      xhr.send(formData);
    });
  }

  document.body.addEventListener('click', (ev) => {
    const done = ev.target.closest('.done');
    if (!done) return;
    window.location.href = '/';
  });
  
  await initVuLayoutSection();
  await loadVuBands();
  await loadVuMoves();

  ensureResetIcons(document);

  // --- LED strip (csak sikeres /get?ledstrip=1 válasz esetén jelenik meg) ---
  const navLs = document.getElementById('nav_ledstrip');
  const lsSec = document.getElementById('group_ledstrip');
  // alapból rejtve – csak ha a szerver válaszol (USE_LEDSTRIP_PLUGIN definiálva)
  if (navLs) navLs.style.display = 'none';
  if (lsSec) lsSec.style.display = 'none';

  if (navLs) {
    // adatok betöltése – ha 404 vagy hiba → marad rejtve
    try {
      const r = await fetch('/get?ledstrip=1');
      if (!r.ok) throw new Error('not found');
      const ls = await r.json();

      // sikeres válasz → megjelenítés
      if (navLs) navLs.style.display = '';
      if (lsSec) lsSec.style.display = '';

      const lsEn   = document.getElementById('lsEnabled');
      const lsSsEn = document.getElementById('lsSsEnabled');
      const lsMod  = document.getElementById('lsModel');
      const lsBr   = document.getElementById('lsBrightness');
      const lsBrInfo = document.getElementById('lsBrightnessInfo');

      if (lsEn)   lsEn.classList.toggle('checked', !!ls.lsEnabled);
      if (lsSsEn) lsSsEn.classList.toggle('checked', !!ls.lsSsEnabled);
      if (lsMod)  lsMod.value = ls.lsModel ?? 0;
      if (lsBr) {
        lsBr.value = ls.lsBrightness ?? 30;
        if (lsBrInfo) lsBrInfo.textContent = lsBr.value;
        fillSlider(lsBr);
        lsBr.addEventListener('input', () => {
          if (lsBrInfo) lsBrInfo.textContent = lsBr.value;
          fillSlider(lsBr);
        });
      }

      // lsEnabled: azonnali mentés click-nél (div.checkbox, nem select!)
      if (lsEn && !lsEn.dataset.bound) {
        lsEn.addEventListener('click', () => {
          const nowOn = !lsEn.classList.contains('checked');
          lsEn.classList.toggle('checked', nowOn);
          fetch('/set?lsEnabled=' + (nowOn ? 1 : 0))
            .then(r => r.ok ? null : Promise.reject('HTTP ' + r.status))
            .catch(err => alert('❌ LED strip enable save failed: ' + err));
        });
        lsEn.dataset.bound = '1';
      }

      // lsSsEnabled: azonnali mentés click-nél
      if (lsSsEn && !lsSsEn.dataset.bound) {
        lsSsEn.addEventListener('click', () => {
          const nowOn = !lsSsEn.classList.contains('checked');
          lsSsEn.classList.toggle('checked', nowOn);
          fetch('/set?lsSsEnabled=' + (nowOn ? 1 : 0))
            .then(r => r.ok ? null : Promise.reject('HTTP ' + r.status))
            .catch(err => alert('❌ LED strip screensaver enable save failed: ' + err));
        });
        lsSsEn.dataset.bound = '1';
      }

      // lsModel: azonnali mentés change-nél
      if (lsMod && !lsMod.dataset.bound) {
        lsMod.value = String(ls.lsModel ?? 0);
        lsMod.addEventListener('change', (e) => {
          fetch('/set?lsModel=' + encodeURIComponent(e.target.value))
            .then(r => r.ok ? null : Promise.reject('HTTP ' + r.status))
            .catch(err => alert('❌ LED strip model save failed: ' + err));
        });
        lsMod.dataset.bound = '1';
      }

      // Apply gomb
      const lsApply = document.querySelector("[data-name='applyLedstrip']");
      if (lsApply && !lsApply.dataset.bound) {
        lsApply.addEventListener('click', async () => {
          const qs = new URLSearchParams({
            lsBrightness: lsBr   ? lsBr.value   : 30
          }).toString();
          try {
            await fetch('/set?' + qs);
          } catch (err) {
            alert('❌ LED strip save failed: ' + err);
          }
        });
        lsApply.dataset.bound = '1';
      }


    } catch(e) { console.warn('[ledstrip load]', e); }
  }
}

if (window.location.pathname === '/customize.html') {
  window.addEventListener('DOMContentLoaded', initCustomizePage);
}

async function saveTTS() {
  const ttsEn = document.getElementById('ttsEnabled');
  const ttsIv = document.getElementById('ttsInterval');

  const enabled = ttsEn && ttsEn.classList.contains('checked') ? 1 : 0;

  const min = 15, max = 240, step = 15;
  let iv = parseInt((ttsIv?.value ?? '60'), 10);
  if (Number.isNaN(iv)) iv = 60;
  iv = Math.min(max, Math.max(min, iv - (iv % step))); 

  const qs = new URLSearchParams({ ttsEnabled: enabled, ttsInterval: iv }).toString();
  try {
    await fetch('/set?' + qs);
  } catch (e) {
    console.warn('[TTS SAVE ERROR]', e);
    try { await fetch('/set?ttsEnabled=' + enabled); } catch(_) {}
    try { await fetch('/set?ttsInterval=' + iv); } catch(_) {}
  }
}

function bindTTSFromConfig(cfg) {
  const ttsEn = document.getElementById('ttsEnabled');
  if (ttsEn) {
    ttsEn.classList.toggle('checked', !!cfg.ttsenabled);
    if (!ttsEn.dataset.bound) {
      ttsEn.addEventListener('click', () => {
        const nowOn = !ttsEn.classList.contains('checked');
        ttsEn.classList.toggle('checked', nowOn);
        saveTTS();
      });
      ttsEn.dataset.bound = '1';
    }
  }

  const ttsIv = document.getElementById('ttsInterval');
  const ttsIvInfo= document.getElementById('ttsIntervalInfo');
  
  if (ttsIv) {
    const min = parseInt(ttsIv.min || '15', 10);
    const max = parseInt(ttsIv.max || '240', 10);
    const step = parseInt(ttsIv.step || '15', 10);

    let iv = parseInt((cfg.ttsinterval ?? 60), 10);
    if (Number.isNaN(iv)) iv = 60;
    iv = Math.min(max, Math.max(min, iv - (iv % step)));

    ttsIv.value = String(iv);
    fillSlider(ttsIv);

    if (ttsIvInfo) ttsIvInfo.textContent = iv + ' min';

    const sendDebounced = debounce(() => saveTTS(), 180);

    ttsIv.addEventListener('input', () => {
      fillSlider(ttsIv);
      if (ttsIvInfo) ttsIvInfo.textContent = ttsIv.value + ' min';
    }, { passive: true });

    onRelease(ttsIv, () => {
      let v = parseInt(ttsIv.value || '60', 10);
      if (Number.isNaN(v)) v = 60;
      v = Math.min(max, Math.max(min, v - (v % step)));
      if (String(v) !== ttsIv.value) ttsIv.value = String(v);
      if (ttsIvInfo) ttsIvInfo.textContent = ttsIv.value + ' min';
      sendDebounced();
    });
  }
}

function ensureResetIcons(root = document) {
  root.querySelectorAll('.reset').forEach(el => {
    if (!el.innerHTML.trim()) {
      el.innerHTML =
        '<svg viewBox="0 0 16 16" class="fill">' +
        '<path d="M8 3v5a36.973 36.973 0 0 1-2.324-1.166A44.09 44.09 0 0 1 3.417 5.5a52.149 52.149 0 0 1 2.26-1.32A43.18 43.18 0 0 1 8 3z"/>' +
        '<path d="M7 5v1h4.5C12.894 6 14 7.106 14 8.5S12.894 11 11.5 11H1v1h10.5c1.93 0 3.5-1.57 3.5-3.5S13.43 5 11.5 5h-4z"/>' +
        '</svg>';
    }
    if (!el.hasAttribute('title')) el.setAttribute('title', 'Reset');
  });
}

//DLNA functions

// --- DLNA playlist activation via /upload (yoRadio-native way) ---

function openDlna() {
  window.location.href = 'dlna.html';
}

// === CUSTOM CODE END ===