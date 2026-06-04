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
  const modal = document.createElement('div'); modal.className='modal'; modal.innerHTML = `<h3>Dodaj URL</h3><input id="newurl" placeholder="Wklej adres streamu lub pliku" style="width:360px;padding:8px;margin-top:8px"><div style="margin-top:10px"><button id="addConfirm" class="btn primary">Dodaj</button> <button id="addCancel" class="btn">Anuluj</button></div>`; document.body.appendChild(modal);
  document.getElementById('add-url')?.addEventListener('click', ()=>{ overlay.classList.add('show'); modal.classList.add('show'); document.getElementById('newurl').focus(); });
  document.getElementById('addCancel')?.addEventListener('click', ()=>{ overlay.classList.remove('show'); modal.classList.remove('show'); });
  document.getElementById('addConfirm')?.addEventListener('click', ()=>{ const v=document.getElementById('newurl').value.trim(); if(v){ state.playlist.push({title:v,url:v}); syncPlaylist(); overlay.classList.remove('show'); modal.classList.remove('show'); render(); }});

  // import playlist from CSV file (client-side)
  document.getElementById('import-playlist')?.addEventListener('click', ()=>{
    const f = document.getElementById('import-file'); if(f) f.click();
  });
  document.getElementById('import-file')?.addEventListener('change', (e)=>{ const file = e.target.files && e.target.files[0]; if(file) handleImportedFile(file); e.target.value=''; });

  function handleImportedFile(file){
    const reader = new FileReader();
    reader.onload = ()=>{
      const txt = String(reader.result || '');
      const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length);
      const sample = lines.slice(0,5).join('\n');
      const delim = sample.indexOf('\t')>=0? '\t' : (sample.indexOf(';')>=0? ';' : ',');
      const parsed = [];
      lines.forEach(row=>{
        const parts = row.split(delim).map(p=>p.trim());
        if(parts.length>=2){
          const title = parts[0]; const url = parts[1];
          if(url && /^https?:\/\//.test(url)) parsed.push({title: title || url, url});
        }
      });
      if(parsed.length){
        showImportPreview(parsed);
      } else alert('Nie znaleziono poprawnych wpisów w pliku');
    };
    reader.readAsText(file,'utf-8');
  }

  function showImportPreview(parsed){
    const preview = document.createElement('div'); preview.style.maxHeight='60vh'; preview.style.overflow='auto'; preview.style.padding='6px';
    parsed.forEach((it,idx)=>{
      const row = document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.margin='6px 0';
      const inp = document.createElement('input'); inp.value = it.title||''; inp.style.flex='1'; inp.dataset.idx=idx; inp.className='preview-title';
      const url = document.createElement('div'); url.textContent = it.url; url.style.color='var(--muted)'; url.style.fontSize='12px'; url.style.minWidth='180px'; url.style.overflow='hidden'; url.style.textOverflow='ellipsis';
      row.appendChild(inp); row.appendChild(url); preview.appendChild(row);
    });
    const prevModal = document.createElement('div'); prevModal.className='modal show';
    const h = document.createElement('h3'); h.textContent='Podgląd importu'; prevModal.appendChild(h);
    prevModal.appendChild(preview);
    const btns = document.createElement('div'); btns.style.marginTop='12px'; btns.style.display='flex'; btns.style.gap='8px';
    const temp = document.createElement('button'); temp.className='btn primary'; temp.textContent='Importuj (tymczasowo)';
    const save = document.createElement('button'); save.className='btn'; save.textContent='Importuj i zapisz';
    const cancel = document.createElement('button'); cancel.className='btn'; cancel.textContent='Anuluj';
    btns.appendChild(temp); btns.appendChild(save); btns.appendChild(cancel); prevModal.appendChild(btns);
    document.body.appendChild(prevModal);
    overlay.classList.add('show');

    function collect(){ return Array.from(preview.querySelectorAll('input.preview-title')).map((i,idx)=>({title:i.value||parsed[idx].url,url:parsed[idx].url})); }
    temp.addEventListener('click', ()=>{
      const data = collect(); api('/api/playlist','PUT',{playlist:data}).then(()=>{ state.playlist=data; state.track=data[0]||state.track; render(); document.body.removeChild(prevModal); overlay.classList.remove('show'); alert('Playlist zaimportowana tymczasowo'); });
    });
    save.addEventListener('click', ()=>{
      const data = collect(); api('/api/playlist','PUT',{playlist:data,persist:true}).then(()=>{ state.playlist=data; state.track=data[0]||state.track; render(); document.body.removeChild(prevModal); overlay.classList.remove('show'); alert('Playlist zaimportowana i zapisana'); });
    });
    cancel.addEventListener('click', ()=>{ document.body.removeChild(prevModal); overlay.classList.remove('show'); });
  }

  // save playlist button
  document.getElementById('save-playlist')?.addEventListener('click', ()=>{ syncPlaylist().then(()=> alert('Playlist zapisana (demo)')); });

  // EQ bands setup
  const EQ_BANDS = [60,250,1000,4000,10000];
  const eqContainer = document.getElementById('eq-sliders');
  function buildEQ(){
    if(!eqContainer) return;
    EQ_BANDS.forEach((b,idx)=>{
      const div=document.createElement('div'); div.className='eq-band';
      div.innerHTML = `<input type="range" min="-12" max="12" value="0" step="0.5" data-band="${b}" id="eq-${idx}"><div class="label">${b}Hz</div>`;
      eqContainer.appendChild(div);
    });
    // wire events
    eqContainer.querySelectorAll('input[type=range]').forEach(r=> r.addEventListener('input', (e)=>{
      const band = parseInt(e.target.dataset.band); const val = parseFloat(e.target.value);
      state.eq = state.eq || {}; state.eq[band]=val;
      api('/api/control','POST',{cmd:'eq_set',band:band,value:val});
    }));
  }
  buildEQ();

  // EQ preset buttons
  document.querySelectorAll('[data-preset]').forEach(b=> b.addEventListener('click', ()=>{
    const p = b.dataset.preset;
    // example presets
    const presets = {
      flat: {60:0,250:0,1000:0,4000:0,10000:0},
      rock: {60:3,250:2,1000:-1,4000:2,10000:3},
      jazz: {60:0,250:1,1000:2,4000:1,10000:0},
      pop: {60:2,250:1,1000:0,4000:1,10000:2}
    };
    const preset = presets[p]||presets.flat;
    state.eq = preset;
    // update sliders
    EQ_BANDS.forEach((band,idx)=>{ const el=document.getElementById('eq-'+idx); if(el) el.value = preset[band]; });
    api('/api/control','POST',{cmd:'eq_preset',preset:p,values:preset});
  }));

  document.getElementById('save-eq')?.addEventListener('click', ()=>{
    const name = prompt('Nazwa presetu'); if(!name) return;
    api('/api/control','POST',{cmd:'eq_save',name:name,values:state.eq||{}}).then(()=> alert('Preset zapisany (demo)'));
  });

  let ws; let state = {playing:false,volume:50,track:{title:'—',artist:'—',stream:'—'},playlist:[]};
  function setWS(s){ const map = {connected:'WS: połączono', disconnected:'WS: rozłączono', unsupported:'WS: brak wsparcia'}; wsStatus.textContent = map[s] || ('WS: '+s); }

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
    playBtn.classList.toggle('active', state.playing);
    vol.value = state.volume || 50;
    renderPlaylist();
  }

  function renderPlaylist(){
    const list = document.createElement('div'); list.className='list';
    (state.playlist||[]).forEach((it,idx)=>{
      const li=document.createElement('li');
      const title = it.title && it.title !== it.url ? it.title : (it.title || it.url);
      const urlDisplay = it.url && it.url!==title ? it.url : '';
      li.innerHTML = `<div class="info"><div class="t">${escapeHtml(title)}</div>${urlDisplay?`<div class="s">${escapeHtml(urlDisplay)}</div>`:''}</div><div class="actions"><button class="btn" data-idx="${idx}">Odtwórz</button></div>`;
      list.appendChild(li);
    });
    playlistEl.innerHTML=''; playlistEl.appendChild(list);
    playlistEl.querySelectorAll('.actions button').forEach(b=> b.addEventListener('click', (e)=>{ const i=parseInt(e.target.dataset.idx); api('/api/control','POST',{cmd:'play_index',index:i}); }));

    // enable drag & drop import on playlist card
    playlistEl.addEventListener('dragover', (ev)=>{ ev.preventDefault(); playlistEl.classList.add('dragover'); });
    playlistEl.addEventListener('dragleave', (ev)=>{ playlistEl.classList.remove('dragover'); });
    playlistEl.addEventListener('drop', (ev)=>{
      ev.preventDefault(); playlistEl.classList.remove('dragover');
      const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
      if(f) handleImportedFile(f);
    });
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
