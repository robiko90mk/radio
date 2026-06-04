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
    const dedupeBtn = document.createElement('button'); dedupeBtn.className='btn'; dedupeBtn.textContent='Usuń duplikaty';
    const checkBtn = document.createElement('button'); checkBtn.className='btn'; checkBtn.textContent='Sprawdź dostępność';
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
    dedupeBtn.addEventListener('click', ()=>{
      // remove duplicates by URL
      const rows = Array.from(preview.querySelectorAll('input.preview-title'));
      const seen = new Set();
      const toRemove = [];
      rows.forEach((inp, i)=>{
        const url = parsed[i].url; if(seen.has(url)) toRemove.push(i); else seen.add(url);
      });
      // remove from bottom to top
      toRemove.sort((a,b)=>b-a).forEach(i=>{ preview.children[i].remove(); parsed.splice(i,1); });
    });
    checkBtn.addEventListener('click', ()=>{
      const urls = parsed.map(p=>p.url);
      if(!urls.length) return alert('Brak URL do sprawdzenia');
      checkBtn.disabled = true; checkBtn.textContent='Sprawdzam...';
      api('/api/check_urls','POST',{urls}).then(res=>{
        checkBtn.disabled=false; checkBtn.textContent='Sprawdź dostępność';
        if(res && res.results){
          // append status badges
          parsed.forEach((p,idx)=>{
            const row = preview.children[idx];
            if(!row) return;
            // remove previous status
            const old = row.querySelector('.status'); if(old) old.remove();
            const span = document.createElement('span'); span.className='status'; span.style.marginLeft='8px'; span.textContent = res.results[idx]?'OK':'NIEDOSTĘPNE'; span.style.color = res.results[idx] ? '#7ee787' : '#ff8b8b'; row.appendChild(span);
          });
        } else alert('Błąd podczas sprawdzania');
      }).catch(()=>{ checkBtn.disabled=false; checkBtn.textContent='Sprawdź dostępność'; alert('Błąd sieci'); });
    });
    cancel.addEventListener('click', ()=>{ document.body.removeChild(prevModal); overlay.classList.remove('show'); });
    // insert dedupe and check buttons before import/save
    btns.insertBefore(dedupeBtn, temp);
    btns.insertBefore(checkBtn, temp);
  }

  // save playlist button
  document.getElementById('save-playlist')?.addEventListener('click', ()=>{ syncPlaylist().then(()=> alert('Playlist zapisana (demo)')); });

  // export playlist to CSV
  document.getElementById('export-playlist')?.addEventListener('click', ()=>{
    const lines = (state.playlist||[]).map(it => `${(it.title||'').replace(/\t/g,' ')}\t${(it.url||'')}`);
    const blob = new Blob([lines.join('\n')], {type:'text/tab-separated-values;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'playlist.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // EQ bands setup
  const EQ_BANDS = [60,250,1000,4000,10000];
  const eqContainer = document.getElementById('settings-eq-sliders') || document.getElementById('eq-sliders');
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

  // Settings tab toggle
  const openSettingsBtn = document.getElementById('open-settings');
  const settingsSection = document.getElementById('settings-section');
  openSettingsBtn?.addEventListener('click', ()=>{
    const m = document.querySelector('main');
    if(!settingsSection) return;
    if(settingsSection.style.display === 'block'){
      settingsSection.style.display='none'; m.style.display='grid'; openSettingsBtn.textContent='Ustawienia';
    } else {
      settingsSection.style.display='block'; m.style.display='none'; openSettingsBtn.textContent='Powrót';
      // build dynamic form each time
      buildSettingsForm();
    }
  });

  // dynamic settings form will be built on settings open

  // build dynamic settings form from myoptions.h on settings open
  const settingsContainer = document.getElementById('settings-form-container');
  async function buildSettingsForm(){
    settingsContainer.innerHTML = '<div class="status">Ładowanie ustawień projektu...</div>';
    const res = await api('/api/import_myoptions','GET');
    if(!res || (!res.settings && !res.content)){
      settingsContainer.innerHTML = '<div class="status">Nie znaleziono myoptions.h w projekcie.</div>';
      return;
    }
    const parsed = res.settings || {};
    settingsContainer.innerHTML = '';
    // mapped fields: set values for explicit structured inputs
    const map = {
      'L10N_LANGUAGE': 'sys-language',
      'INITIAL_VOLUME': 'audio-initial-volume',
      'FIXED_VOLUME': 'audio-fixed-volume',
      'PLAYER_FORCE_MONO': 'audio-force-mono',
      'REMOVE_AUDIO_CONTROLS': 'audio-remove-audio-controls',
      'MUTE_PIN': 'sys-mute-pin',
      'BRIGHTNESS_PIN': 'sys-display-brightness',
      'VU_PEAK': 'sys-vu'
    };
    Object.keys(map).forEach(k=>{
      try{
        const el = document.getElementById(map[k]); if(!el) return;
        const v = parsed[k]; if(typeof v === 'undefined') return;
        if(el.type === 'checkbox') el.checked = !!v;
        else el.value = String(v);
      }catch(e){}
    });

    // put full parsed JSON into editor
    const raw = document.getElementById('adv-raw-settings'); if(raw) raw.value = JSON.stringify(parsed,null,2);

    // populate device-like fields 1:1 where possible
    try{
      Object.keys(parsed).forEach(k=>{
        // direct id match
        const elById = document.getElementById(k.toLowerCase()) || document.getElementById(k);
        if(elById){ if(elById.type==='checkbox') elById.checked = !!parsed[k]; else elById.value = String(parsed[k]); }
      });
    }catch(e){}

    // build dynamic inputs for any remaining keys (not present as structured fields)
    const mappedKeys = new Set(Object.keys(map));
    const dynContainer = document.createElement('div'); dynContainer.style.marginTop='12px';
    dynContainer.innerHTML = '<h4>Wszystkie pozostałe klucze z myoptions.h</h4>';
    Object.keys(parsed).sort().forEach(k=>{
      if(mappedKeys.has(k)) return;
      const v = parsed[k];
      const row = document.createElement('div'); row.style.margin='6px 0';
      const label = document.createElement('label'); label.style.display='block'; label.style.fontWeight='600'; label.textContent = k;
      let input;
      if(typeof v === 'boolean'){
        input = document.createElement('input'); input.type='checkbox'; input.checked = v; input.dataset.key=k;
      } else if(Number.isInteger(v) || (/^-?\d+$/.test(String(v)))){
        input = document.createElement('input'); input.type='number'; input.value = String(v); input.dataset.key=k;
      } else {
        input = document.createElement('input'); input.type='text'; input.value = String(v); input.dataset.key=k;
      }
      input.style.marginTop='6px'; input.style.width='100%'; row.appendChild(label); row.appendChild(input); dynContainer.appendChild(row);
    });
    settingsContainer.appendChild(dynContainer);
    // wire import/download JSON buttons
    document.getElementById('adv-import-json')?.addEventListener('click', ()=>{
      const txt = document.getElementById('adv-raw-settings').value;
      try{ const obj = JSON.parse(txt); // apply to mapped fields and dynamic inputs
        Object.keys(obj).forEach(k=>{
          const target = map[k] && document.getElementById(map[k]); if(target){ if(target.type==='checkbox') target.checked = !!obj[k]; else target.value = String(obj[k]); }
          const dyn = settingsContainer.querySelector(`[data-key="${k}"]`); if(dyn){ if(dyn.type==='checkbox') dyn.checked = !!obj[k]; else dyn.value = String(obj[k]); }
        });
        alert('Import JSON: pola zaktualizowane');
      }catch(e){ alert('Błąd parsowania JSON'); }
    });
    document.getElementById('adv-download-json')?.addEventListener('click', ()=>{
      const blob=new Blob([JSON.stringify(parsed,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='myoptions.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
    document.getElementById('adv-clear-json')?.addEventListener('click', ()=>{ if(confirm('Wyczyścić pole JSON?')) document.getElementById('adv-raw-settings').value=''; });
  }

  function collectSettingsFromContainer(){
    // collect from the whole settings section (structured fields + dynamic container)
    const selector = '#settings-section input, #settings-section select, #settings-section textarea';
    const inputs = Array.from(document.querySelectorAll(selector));
    const out = {};
    // reverse id->key map for common mapped fields
    const reverse = {
      'sys-language':'L10N_LANGUAGE','audio-initial-volume':'INITIAL_VOLUME','audio-fixed-volume':'FIXED_VOLUME','audio-force-mono':'PLAYER_FORCE_MONO','audio-remove-audio-controls':'REMOVE_AUDIO_CONTROLS','sys-mute-pin':'MUTE_PIN','sys-display-brightness':'BRIGHTNESS_PIN','sys-vu':'VU_PEAK',
      'br':'BRIGHTNESS_PIN','scrt':'SCREENSAVER_TIMEOUT','scrpe':'SCREENSAVER_PLAYING_ENABLED','scrpb':'SCREENSAVER_PLAYING_BLANK','scrpt':'SCREENSAVER_PLAYING_TIMEOUT',
      'vols':'VOL_STEPS','enca':'ENC_ACCEL','irtl':'IR_TOLERANCE','tzh':'TZ_HOURS','tzm':'TZ_MINUTES','sntp1':'SNTP1','sntp2':'SNTP2',
      'wlat':'W_LAT','wlon':'W_LON','wkey':'W_KEY','grndHeight':'grndHeight','pressureSlope_x1000':'pressureSlope_x1000','wint':'W_INTERVAL',
      'ssid0':'SSID0','ssid1':'SSID1','ssid2':'SSID2','ssid3':'SSID3','ssid4':'SSID4','pass0':'PASS0','pass1':'PASS1','pass2':'PASS2','pass3':'PASS3','pass4':'PASS4'
    };
    inputs.forEach(inp=>{
      // determine key: explicit data-key preferred, else reverse map by id, else use id
      let key = inp.dataset && inp.dataset.key ? inp.dataset.key : (inp.id ? (reverse[inp.id] || inp.id) : null);
      if(!key) return;
      if(inp.type === 'checkbox') out[key] = !!inp.checked;
      else if(inp.type === 'number') out[key] = (inp.value===''? null : parseFloat(inp.value));
      else if(inp.tagName === 'SELECT') out[key] = inp.value;
      else if(inp.tagName === 'TEXTAREA') out[key] = inp.value;
      else out[key] = inp.value;
    });
    return out;
  }

  document.getElementById('apply-settings')?.addEventListener('click', ()=>{
    const payload = collectSettingsFromContainer();
    // basic validation
    if(typeof payload.INITIAL_VOLUME !== 'undefined' && (payload.INITIAL_VOLUME < 0 || payload.INITIAL_VOLUME > 100)) return alert('INITIAL_VOLUME musi być 0-100');
    if(typeof payload.FIXED_VOLUME !== 'undefined' && (payload.FIXED_VOLUME < 0 || payload.FIXED_VOLUME > 255)) return alert('FIXED_VOLUME musi być 0-255');
    if(typeof payload.BRIGHTNESS_PIN !== 'undefined' && (payload.BRIGHTNESS_PIN < 0 || payload.BRIGHTNESS_PIN > 255)) return alert('BRIGHTNESS_PIN musi być 0-255');
    // send
    api('/api/settings','POST', {settings: payload}).then(res=>{
      if(res && res.ok){ alert('Ustawienia zastosowane (demo)'); state.device_settings = payload; }
      else alert('Błąd przy zastosowaniu ustawień');
    });
  });

  document.getElementById('save-settings')?.addEventListener('click', ()=>{
    const payload = { settings: collectSettingsFromContainer(), persist: true };
    api('/api/settings','POST', payload).then(res=>{ if(res && res.ok) alert('Ustawienia zapisane (demo)'); else alert('Błąd zapisu'); });
  });

  // export myoptions.h generator
  const exportBtn = document.createElement('button'); exportBtn.className='btn'; exportBtn.textContent='Eksportuj myoptions.h';
  exportBtn.style.marginLeft='8px'; document.getElementById('settings-section')?.appendChild(exportBtn);
  exportBtn.addEventListener('click', ()=>{
    const payload = collectSettingsFromContainer();
    // prefer raw JSON if present
    const raw = document.getElementById('adv-raw-settings')?.value; let obj = payload;
    try{ if(raw && raw.trim()) obj = JSON.parse(raw); }catch(e){}
    // build header
    let out = '// Generated myoptions.h from WebUI\n#ifndef myoptions_h\n#define myoptions_h\n\n';
    Object.keys(obj).forEach(k=>{
      const v = obj[k];
      if(typeof v === 'boolean') out += `#define ${k} ${v ? 'true' : 'false'}\n`; else if(Number.isInteger(v) || (/^-?\\d+$/.test(String(v)))) out += `#define ${k} ${v}\n`; else out += `#define ${k} ${String(v)}\n`;
    });
    out += '\n#endif // myoptions_h\n';
    const blob = new Blob([out],{type:'text/x-c'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='myoptions.h'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  document.getElementById('cancel-settings')?.addEventListener('click', ()=>{ settingsSection.style.display='none'; document.querySelector('main').style.display='grid'; openSettingsBtn.textContent='Ustawienia'; });
  // tab switching
  function showTab(id){
    ['system','playlists','audio','display','controls','timezone','wifi','weather','tools','timer','advanced'].forEach(k=>{
      const panel = document.getElementById('tab-'+k+'-panel'); if(panel) panel.style.display = (k===id? 'block':'none');
    });
  }
  document.getElementById('tab-system')?.addEventListener('click', ()=> showTab('system'));
  document.getElementById('tab-playlists')?.addEventListener('click', ()=> showTab('playlists'));
  document.getElementById('tab-audio')?.addEventListener('click', ()=> showTab('audio'));
  document.getElementById('tab-display')?.addEventListener('click', ()=> showTab('display'));
  document.getElementById('tab-controls')?.addEventListener('click', ()=> showTab('controls'));
  // timezone, wifi, tools, timer events
  document.getElementById('tab-timezone')?.addEventListener('click', ()=> showTab('timezone'));
  document.getElementById('tab-wifi')?.addEventListener('click', ()=> showTab('wifi'));
  document.getElementById('tab-tools')?.addEventListener('click', ()=> showTab('tools'));
  document.getElementById('tab-timer')?.addEventListener('click', ()=> showTab('timer'));
  document.getElementById('tab-weather')?.addEventListener('click', ()=> showTab('weather'));
  document.getElementById('tab-advanced')?.addEventListener('click', ()=> showTab('advanced'));
  showTab('system');

  document.getElementById('goto-playlist')?.addEventListener('click', ()=>{ settingsSection.style.display='none'; document.querySelector('main').style.display='grid'; openSettingsBtn.textContent='Ustawienia'; const el = document.querySelector('.playlist'); if(el) el.scrollIntoView({behavior:'smooth'}); });

  document.getElementById('download-wifi-template')?.addEventListener('click', ()=>{
    const txt = 'SSID\tPASSWORD\n'; const blob = new Blob([txt], {type:'text/plain'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='wifi.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // wifi export (build csv from inputs)
  document.getElementById('wifiexport')?.addEventListener('click', ()=>{
    const rows = [];
    for(let i=0;i<5;i++){ const ss=document.getElementById('ssid'+i).value||''; const pw=document.getElementById('pass'+i).value||''; if(ss) rows.push(`${ss}\t${pw}`); }
    if(!rows.length) return alert('Brak zapisanych sieci');
    const blob = new Blob([rows.join('\n')], {type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='wifi.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  document.getElementById('wifiupload')?.addEventListener('click', ()=>{
    // demo: package wifi CSV and POST to /upload (same as device). If server doesn't accept, offer download.
    const rows = [];
    for(let i=0;i<5;i++){ const ss=document.getElementById('ssid'+i).value||''; const pw=document.getElementById('pass'+i).value||''; if(ss) rows.push(`${ss}\t${pw}`); }
    if(!rows.length) return alert('Brak sieci do wysłania');
    const file = new File([rows.join('\n')],'wifi.csv',{type:'text/plain'});
    const fd = new FormData(); fd.append('wifile', file);
    fetch('/upload',{method:'POST',body:fd}).then(r=>{ if(r.ok) alert('Wysłano. Urządzenie może się zrestartować.'); else { alert('Serwer demo nie przyjął pliku — pobierz plik lokalnie.'); const url=URL.createObjectURL(file); const a=document.createElement('a'); a.href=url; a.download='wifi.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); } }).catch(()=>{ const url=URL.createObjectURL(file); const a=document.createElement('a'); a.href=url; a.download='wifi.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); alert('Błąd sieci — plik pobrany lokalnie.'); });
  });

  // tools buttons
  document.getElementById('tool-reboot')?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'reboot'}).then(()=>alert('Reboot (demo)')));
  document.getElementById('tool-format')?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'format'}).then(()=>alert('Format (demo)')));
  document.getElementById('tool-reset')?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'reset'}).then(()=>alert('Reset settings (demo)')));

  document.getElementById('tz-apply')?.addEventListener('click', ()=>{
    const h = document.getElementById('tz-hours').value; const m = document.getElementById('tz-minutes').value; api('/api/control','POST',{cmd:'tz',hours:h,minutes:m}).then(()=>alert('Timezone applied (demo)'));
  });

  document.getElementById('timer-apply')?.addEventListener('click', ()=>{ const s=document.getElementById('timer-start').value; const e=document.getElementById('timer-stop').value; api('/api/settings','POST',{timer:{start:s,stop:e}}).then(()=>alert('Timer saved (demo)')); });

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
