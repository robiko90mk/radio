(() => {
  const statusEl = document.getElementById('ws-status');
  const deviceHost = document.getElementById('device-host');
  const titleEl = document.getElementById('title');
  const artistEl = document.getElementById('artist');
  const streamEl = document.getElementById('stream');
  const playBtn = document.getElementById('play');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const vol = document.getElementById('volume');
  const playlistEl = document.getElementById('playlist');
  const themeSelect = document.getElementById('theme-select');

  let ws;
  let state = {playing:false,volume:50,track:{title:'—',artist:'—',stream:'—'},playlist:[]};

  function setStatus(s){ statusEl.textContent = 'WS: '+s; }
  function setDeviceHost(){ deviceHost.textContent = location.host; }

  function connectWS(){
    const proto = (location.protocol==='https:')? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
    try {
      ws = new WebSocket(url);
    } catch(e){ setStatus('unsupported'); return; }
    ws.onopen = ()=> setStatus('connected');
    ws.onclose = ()=> setStatus('disconnected');
    ws.onmessage = (m)=> { try{ const d=JSON.parse(m.data); applyState(d);}catch(e){} };
  }

  function applyState(s){ state = Object.assign(state,s); render(); }

  function render(){
    titleEl.textContent = state.track?.title || '—';
    artistEl.textContent = state.track?.artist || '—';
    streamEl.textContent = state.track?.stream || '—';
    playBtn.textContent = state.playing? '⏸' : '⏵';
    vol.value = state.volume || 50;
    renderPlaylist();
  }

  function api(path, method='GET', body){
    return fetch(path, {method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined})
      .then(r=> r.ok? r.json().catch(()=>({})): Promise.reject(r));
  }

  playBtn.onclick = ()=> api('/api/control','POST',{cmd: state.playing? 'pause':'play'}).then(()=>{}).catch(()=>{});
  prevBtn.onclick = ()=> api('/api/control','POST',{cmd:'prev'}).catch(()=>{});
  nextBtn.onclick = ()=> api('/api/control','POST',{cmd:'next'}).catch(()=>{});
  vol.oninput = ()=> api('/api/control','POST',{cmd:'volume','value':parseInt(vol.value)}).catch(()=>{});

  function renderPlaylist(){
    playlistEl.innerHTML = '';
    (state.playlist||[]).forEach((it,idx)=>{
      const li=document.createElement('li');
      li.draggable=true;
      li.dataset.index=idx;
      li.innerHTML = `<span>${it.title||it.url}</span><div class="li-actions"><button data-idx="${idx}" class="play-item">Play</button></div>`;
      playlistEl.appendChild(li);
    });
  }

  playlistEl.addEventListener('click', (e)=>{
    if(e.target.matches('.play-item')){
      const i = parseInt(e.target.dataset.idx);
      api('/api/control','POST',{cmd:'play_index',index:i}).catch(()=>{});
    }
  });

  // drag and drop reorder (client-side) - send to device on drop
  let dragSrc = null;
  playlistEl.addEventListener('dragstart', e=>{ dragSrc = e.target; e.dataTransfer.effectAllowed='move'; });
  playlistEl.addEventListener('dragover', e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; });
  playlistEl.addEventListener('drop', e=>{
    e.preventDefault();
    const tgt = e.target.closest('li');
    if(!tgt || !dragSrc || tgt===dragSrc) return;
    const from = parseInt(dragSrc.dataset.index); const to = parseInt(tgt.dataset.index);
    // reorder local state
    const item = state.playlist.splice(from,1)[0]; state.playlist.splice(to,0,item);
    render();
    api('/api/playlist','PUT', {playlist: state.playlist}).catch(()=>{});
  });

  // small visualizer stub (no audio on web page, but shows reactive bars from ws data)
  const canvas = document.getElementById('viz'); const ctx = canvas.getContext('2d');
  function drawViz(data){ if(!ctx) return; const w=canvas.width=canvas.clientWidth; const h=canvas.height; ctx.clearRect(0,0,w,h); const bars= data?.length||32; for(let i=0;i<bars;i++){ const val = (data[i]||0); const bw = w/bars; ctx.fillStyle = 'rgba(58,160,255,0.6)'; ctx.fillRect(i*bw, h*(1-val), bw-2, h*val); } }

  // theme
  themeSelect.onchange = ()=>{ document.documentElement.setAttribute('data-theme', themeSelect.value); localStorage.theme=themeSelect.value; }
  if(localStorage.theme) themeSelect.value = localStorage.theme;

  // initial load
  setDeviceHost();
  connectWS();
  // fallback poll state
  api('/api/state').then(applyState).catch(()=>{});
  // animate viz from fake data if no ws
  setInterval(()=>{ const fake = new Array(32).fill(0).map(()=>Math.random()); drawViz(fake); }, 200);

})();
