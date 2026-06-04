(() => {
  const wsStatus = document.getElementById('ws-status');
  const deviceHost = document.getElementById('device-host');
  const titleEl = document.getElementById('title');
  const artistEl = document.getElementById('artist');
  const streamEl = document.getElementById('stream');
  const playBtn = document.getElementById('play');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const vol = document.getElementById('volume');
  const playlistEl = document.getElementById('playlist');

  const overlay = document.createElement('div'); overlay.className='overlay'; document.body.appendChild(overlay);
  const modal = document.createElement('div'); modal.className='modal'; modal.innerHTML = `<h3>Add URL</h3><input id="newurl" style="width:360px;padding:8px;margin-top:8px"><div style="margin-top:10px"><button id="addConfirm">Add</button> <button id="addCancel">Cancel</button></div>`; document.body.appendChild(modal);
  document.getElementById('add-url')?.addEventListener('click', ()=>{ overlay.classList.add('show'); modal.classList.add('show'); document.getElementById('newurl').focus(); });
  document.getElementById('addCancel')?.addEventListener('click', ()=>{ overlay.classList.remove('show'); modal.classList.remove('show'); });
  document.getElementById('addConfirm')?.addEventListener('click', ()=>{ const v=document.getElementById('newurl').value.trim(); if(v){ state.playlist.push({title:v,url:v}); syncPlaylist(); overlay.classList.remove('show'); modal.classList.remove('show'); render(); }});

  let ws; let state = {playing:false,volume:50,track:{title:'—',artist:'—',stream:'—'},playlist:[]};
  function setWS(s){ wsStatus.textContent = 'WS: '+s; }

  function connect(){
    const proto = location.protocol==='https:'? 'wss':'ws';
    const url = `${proto}://${location.host}/ws`;
    try{ ws = new WebSocket(url); }catch(e){ setWS('unsupported'); return; }
    ws.onopen = ()=> setWS('connected');
    ws.onclose = ()=> setWS('disconnected');
    ws.onmessage = (m)=>{ try{ const d=JSON.parse(m.data); Object.assign(state,d); render(); }catch(e){} };
  }

  async function api(path,method='GET',body=null){
    try{ const res = await fetch(path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}); return res.ok? res.json().catch(()=>({})): null; }catch(e){return null}
  }

  function render(){
    titleEl.textContent = state.track?.title || '—';
    artistEl.textContent = state.track?.artist || '—';
    streamEl.textContent = state.track?.stream || '—';
    playBtn.classList.toggle('primary', state.playing);
    vol.value = state.volume || 50;
    renderPlaylist();
  }

  function renderPlaylist(){
    const list = document.createElement('div'); list.className='list';
    (state.playlist||[]).forEach((it,idx)=>{
      const li=document.createElement('li');
      li.innerHTML = `<div class="info"><div class="t">${escapeHtml(it.title||it.url)}</div><div class="s">${escapeHtml(it.url)}</div></div><div class="actions"><button data-idx="${idx}">Play</button></div>`;
      list.appendChild(li);
    });
    playlistEl.innerHTML=''; playlistEl.appendChild(list);
    playlistEl.querySelectorAll('.actions button').forEach(b=> b.addEventListener('click', (e)=>{ const i=parseInt(e.target.dataset.idx); api('/api/control','POST',{cmd:'play_index',index:i}); }));
  }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function syncPlaylist(){ await api('/api/playlist','PUT',{playlist: state.playlist}); }

  prevBtn?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'prev'}));
  nextBtn?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'next'}));
  playBtn?.addEventListener('click', ()=> api('/api/control','POST',{cmd: state.playing? 'pause':'play'}));
  vol?.addEventListener('input', ()=> api('/api/control','POST',{cmd:'volume',value:parseInt(vol.value)}));

  // visualizer
  const canvas=document.getElementById('viz'); const ctx=canvas.getContext('2d'); function draw(arr){ if(!ctx) return; const w=canvas.width=canvas.clientWidth; const h=canvas.height; ctx.clearRect(0,0,w,h); const bars=arr.length||32; for(let i=0;i<bars;i++){ const v=arr[i]||0; const bw=w/bars; ctx.fillStyle=`rgba(58,160,255,${0.5+0.5*v})`; ctx.fillRect(i*bw,h*(1-v),bw-2,h*v);} }
  setInterval(()=>{ // try to update from state.visual or fake
    if(state.visual) draw(state.visual); else { draw(new Array(32).fill(0).map(()=>Math.random()*0.7)); }
  },120);

  // initial
  connect(); api('/api/state').then(r=>{ if(r) Object.assign(state,r); render(); });

})();
