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

  // help texts for inputs (id -> tooltip)
  const helpTexts = {
    'sys-language': 'Język interfejsu. Ustawienie L10N_LANGUAGE w myoptions.h.',
    'audio-initial-volume': 'Głośność startowa (0-100).',
    'audio-fixed-volume': 'Stała głośność (0-255) - używana zamiast regulacji.',
    'sys-mute-pin': 'Numer pinu, do którego podłączono wyciszenie (MUTE_PIN).',
    'sys-display-brightness': 'Sterowanie jasnością ekranu (0-255).',
    'weather-lat': 'Szerokość geograficzna (-90..90).',
    'weather-lon': 'Długość geograficzna (-180..180).',
    'weather-apikey': 'Klucz API OpenWeather — wymagany do pobierania pogody.',
    'ssid0':'SSID#1 (max 30 znaków)', 'pass0':'Hasło#1 (max 40 znaków)',
    'ssid1':'SSID#2 (max 30 znaków)', 'pass1':'Hasło#2 (max 40 znaków)'
  };
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
  async function buildSettingsForm(){
    const settingsContainer = document.getElementById('settings-form-container');
    if(!settingsContainer){ console.warn('No settings-form-container found'); return; }
    settingsContainer.innerHTML = '<div class="status">Ładowanie ustawień projektu...</div>';
    const res = await api('/api/import_myoptions','GET');
    if(!res || (!res.settings && !res.content)){
      settingsContainer.innerHTML = '<div class="status">Nie znaleziono myoptions.h w projekcie.</div>';
      return;
    }
    const parsed = res.settings || {};
    // Keep original parsed values from myoptions.h for 'reset to original file' action
    try{ window.customizeOriginalParsed = JSON.parse(JSON.stringify(parsed)); }catch(e){ window.customizeOriginalParsed = parsed; }
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
      'VU_PEAK': 'sys-vu',
      'MDNS_NAME': 'sys-mdns',
      'SOFTAP_REBOOT_DELAY': 'sys-softr',
      'AUDIO_BUFFER': 'sys-abuff',
      'NUMBERED_PLAYLIST': 'display-nump'
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
    // --- Populate Customize 1:1 container (separate tab) ---
    const customizeContainer = document.getElementById('customize-container');
    if(customizeContainer){
      // Prefer embedding the device's own customize.html for exact parity.
      customizeContainer.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.src = '/customize.html';
      iframe.style.width = '100%';
      iframe.style.height = '720px';
      iframe.style.border = '1px solid var(--muted)';
      iframe.title = 'Device Customize (embedded)';
      customizeContainer.appendChild(document.createElement('div'));
      // header note
      const note = document.createElement('div'); note.style.marginBottom='8px'; note.style.color='var(--muted)'; note.textContent = 'Wbudowana strona urządzenia (pełna zgodność). Możesz przełączać widok na natywny 1:1.';
      // create sub-tabs inside Customize panel for a professional settings layout
      const subnav = document.createElement('div'); subnav.className = 'settings-subnav'; subnav.style.display='flex'; subnav.style.gap='8px'; subnav.style.marginBottom='12px';
      const tabDevice = document.createElement('button'); tabDevice.className='btn small active'; tabDevice.textContent='Device';
      const tabNative = document.createElement('button'); tabNative.className='btn small'; tabNative.textContent='1:1 (native)';
      const tabOpen = document.createElement('button'); tabOpen.className='btn small'; tabOpen.textContent='Otwórz w nowym oknie';
      subnav.appendChild(tabDevice); subnav.appendChild(tabNative); subnav.appendChild(tabOpen);

      // content areas
      const deviceArea = document.createElement('div'); deviceArea.style.display='block'; deviceArea.style.marginTop='6px';
      const nativeArea = document.createElement('div'); nativeArea.style.display='none'; nativeArea.style.marginTop='6px'; nativeArea.id = 'customize-native';

      // iframe for device page
      const iframe = document.createElement('iframe'); iframe.src = '/customize.html'; iframe.style.width='100%'; iframe.style.height='720px'; iframe.style.border='1px solid var(--muted)'; iframe.title = 'Device Customize (embedded)';
      deviceArea.appendChild(iframe);

      // assemble customize container
      customizeContainer.appendChild(note); customizeContainer.appendChild(subnav); customizeContainer.appendChild(deviceArea); customizeContainer.appendChild(nativeArea);

      // store parsed globally for native builder
      window.currentParsedSettings = parsed;

      tabOpen.addEventListener('click', ()=> window.open('/customize.html','_blank'));
      tabDevice.addEventListener('click', ()=>{
        tabDevice.classList.add('active'); tabNative.classList.remove('active'); deviceArea.style.display='block'; nativeArea.style.display='none';
      });
      tabNative.addEventListener('click', ()=>{
        tabNative.classList.add('active'); tabDevice.classList.remove('active'); deviceArea.style.display='none'; nativeArea.style.display='block';
        // build native view on demand
        try{ buildCustomizeNative(nativeArea, window.currentParsedSettings); }catch(e){ console.error(e); }
      });
    }

    // build the native 1:1 customize editor
    function buildCustomizeNative(container, parsed){
      container.innerHTML = '';
      if(!parsed) return container.textContent = 'Brak danych do wyświetlenia';
      const table = document.createElement('div'); table.style.display='grid'; table.style.gridTemplateColumns='1fr 1fr'; table.style.gap='8px';
      Object.keys(parsed).sort().forEach(k=>{
        const v = parsed[k];
        const wrap = document.createElement('div'); wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.gap='6px'; wrap.className='custom-row';
        const head = document.createElement('div'); head.style.display='flex'; head.style.justifyContent='space-between'; head.style.alignItems='center';
        const lbl = document.createElement('label'); lbl.textContent = k; lbl.style.fontWeight='600'; lbl.style.fontSize='13px'; lbl.style.marginRight='8px';
        const actions = document.createElement('div'); actions.className='custom-actions';
        const helpTxt = (typeof helpTexts !== 'undefined' && helpTexts[k]) ? helpTexts[k] : '';
        if(helpTxt){ const help = document.createElement('span'); help.className='custom-help'; help.textContent='?'; help.title = helpTxt; actions.appendChild(help); }
        const reset = document.createElement('button'); reset.type='button'; reset.className='btn'; reset.textContent='Reset'; reset.dataset.key = k; reset.dataset.default = String(v);
        reset.style.padding='4px 8px'; reset.style.fontSize='12px'; actions.appendChild(reset);
        head.appendChild(lbl); head.appendChild(actions);
        let inp;
        if(typeof v === 'boolean'){
          inp = document.createElement('input'); inp.type='checkbox'; inp.checked = !!v; inp.dataset.key = k;
        } else if(Number.isInteger(v) || (/^-?\d+$/.test(String(v)))){
          inp = document.createElement('input'); inp.type='number'; inp.value = String(v); inp.dataset.key = k;
        } else {
          inp = document.createElement('input'); inp.type='text'; inp.value = String(v); inp.dataset.key = k;
        }
        inp.style.width='100%'; wrap.appendChild(head); wrap.appendChild(inp); table.appendChild(wrap);
      });
      // add save/import controls
      const ctl = document.createElement('div'); ctl.style.gridColumn = '1 / -1'; ctl.style.display='flex'; ctl.style.gap='8px'; ctl.style.marginTop='8px';
      const saveBtn = document.createElement('button'); saveBtn.className='btn primary'; saveBtn.textContent='Zapisz 1:1 (demo)';
      const applyBtn = document.createElement('button'); applyBtn.className='btn'; applyBtn.textContent='Zastosuj 1:1';
      ctl.appendChild(saveBtn); ctl.appendChild(applyBtn);
      container.appendChild(table); container.appendChild(ctl);

      // wire reset buttons
      container.querySelectorAll('button[data-key]').forEach(b=> b.addEventListener('click', ()=>{
        const key = b.dataset.key; const def = b.dataset.default; const inp = container.querySelector(`[data-key="${key}"]`);
        if(!inp) return; if(inp.type==='checkbox') inp.checked = (def === 'true'); else inp.value = def;
      }));

      saveBtn.addEventListener('click', ()=>{
        const inputs = container.querySelectorAll('[data-key]'); const obj = {};
        inputs.forEach(inp=>{ const key=inp.dataset.key; let val; if(inp.type==='checkbox') val=!!inp.checked; else if(inp.type==='number') val=(inp.value===''? null:(isNaN(Number(inp.value))? inp.value:Number(inp.value))); else val=inp.value; obj[key]=val; });
        api('/api/settings','POST',{settings:obj,persist:true}).then(r=>{ if(r && r.ok) alert('Zapisano 1:1 (demo)'); else alert('Błąd zapisu'); });
      });
      applyBtn.addEventListener('click', ()=>{
        const inputs = container.querySelectorAll('[data-key]'); const obj = {};
        inputs.forEach(inp=>{ const key=inp.dataset.key; let val; if(inp.type==='checkbox') val=!!inp.checked; else if(inp.type==='number') val=(inp.value===''? null:(isNaN(Number(inp.value))? inp.value:Number(inp.value))); else val=inp.value; obj[key]=val; });
        api('/api/settings','POST',{settings:obj}).then(r=>{ if(r && r.ok) alert('Zastosowano 1:1 (demo)'); else alert('Błąd zastosowania'); });
      });
    }
    // wire reset buttons
    try{
      const resets = customizeContainer.querySelectorAll('button[data-key]');
      resets.forEach(b=> b.addEventListener('click', (e)=>{
        const key = b.dataset.key; const def = b.dataset.default;
        const inp = customizeContainer.querySelector(`[data-key="${key}"]`);
        if(!inp) return;
        if(inp.type === 'checkbox') inp.checked = (def === 'true'); else inp.value = def;
      }));
    }catch(e){}

    // Reset all button
    const resetAll = document.getElementById('customize-reset-all');
    if(resetAll){
      resetAll.addEventListener('click', ()=>{
        const inputs = customizeContainer.querySelectorAll('[data-key]');
        inputs.forEach(inp=>{
          const key = inp.dataset.key; const btn = customizeContainer.querySelector(`button[data-key="${key}"]`);
          if(btn){ const def = btn.dataset.default; if(inp.type === 'checkbox') inp.checked = (def === 'true'); else inp.value = def; }
        });
        alert('Przywrócono wartości domyślne dla wszystkich pól.');
      });
    }

    // Save as defaults button
    const saveDefaults = document.getElementById('customize-save-defaults');
    if(saveDefaults){
      saveDefaults.addEventListener('click', ()=>{
        const inputs = customizeContainer.querySelectorAll('[data-key]');
        const obj = {};
        inputs.forEach(inp=>{
          const key = inp.dataset.key; let val;
          if(inp.type === 'checkbox') val = !!inp.checked;
          else if(inp.type === 'number') val = (inp.value===''? null : (isNaN(Number(inp.value))? inp.value : Number(inp.value)));
          else val = inp.value;
          obj[key]=val;
          const btn = customizeContainer.querySelector(`button[data-key="${key}"]`); if(btn) btn.dataset.default = String(val);
        });
        // update adv-raw-settings JSON if present
        const rawEl = document.getElementById('adv-raw-settings');
        if(rawEl){ try{ const cur = JSON.parse(rawEl.value||'{}'); Object.assign(cur,obj); rawEl.value = JSON.stringify(cur,null,2); }catch(e){ rawEl.value = JSON.stringify(obj,null,2); } }
        alert('Zapisano bieżące wartości jako domyślne.');
      });
    }
    // Reset to original myoptions.h (from file)
    const resetOriginalBtn = document.getElementById('customize-reset-original');
    if(resetOriginalBtn){
      resetOriginalBtn.addEventListener('click', ()=>{
        const orig = window.customizeOriginalParsed || {};
        if(!orig || Object.keys(orig).length===0) return alert('Brak oryginalnych ustawień wczytanych z projektu');
        const inputs = customizeContainer.querySelectorAll('[data-key]');
        inputs.forEach(inp=>{
          const key = inp.dataset.key; if(typeof orig[key] === 'undefined') return;
          const val = orig[key];
          if(inp.type === 'checkbox') inp.checked = !!val;
          else inp.value = (val===null || typeof val === 'undefined') ? '' : String(val);
        });
        // update adv-raw-settings to original
        const rawEl = document.getElementById('adv-raw-settings'); if(rawEl) rawEl.value = JSON.stringify(orig,null,2);
        alert('Przywrócono wartości z oryginalnego myoptions.h');
      });
    }
    // apply help texts as title attributes
    Object.keys(helpTexts).forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.title = helpTexts[id];
    });
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
    // wifi fields length
    for(let i=0;i<5;i++){ const ss = document.getElementById('ssid'+i); const pw = document.getElementById('pass'+i); if(ss && ss.value.length>30) return alert(`SSID${i} za długi (max 30)`); if(pw && pw.value.length>40) return alert(`Pass${i} za długi (max 40)`); }
    // weather validation
    const weatherEnabled = (document.getElementById('weather-enable') && document.getElementById('weather-enable').checked) || false;
    const wlat = (document.getElementById('weather-lat') && parseFloat(document.getElementById('weather-lat').value)) || null;
    const wlon = (document.getElementById('weather-lon') && parseFloat(document.getElementById('weather-lon').value)) || null;
    const wkey = (document.getElementById('weather-apikey') && document.getElementById('weather-apikey').value) || '';
    if(weatherEnabled){ if(wkey.trim()==='') return alert('OpenWeather API key jest wymagany, gdy pogoda jest włączona'); if(wlat!==null && (wlat<-90 || wlat>90)) return alert('Latitude musi być w zakresie -90..90'); if(wlon!==null && (wlon<-180 || wlon>180)) return alert('Longitude musi być w zakresie -180..180'); }
    // mdns length (support sys-mdns id)
    const mdnsEl = document.getElementById('sys-mdns') || document.getElementById('mdns'); if(mdnsEl && mdnsEl.value && mdnsEl.value.length>24) return alert('mDNS name too long (max 24)');
    // timer format simple check
    const ts = document.getElementById('timer-start')?.value; const te = document.getElementById('timer-stop')?.value;
    const timeRE = /^\d{2}:\d{2}$/;
    if(ts && !timeRE.test(ts)) return alert('Start time invalid (HH:MM)');
    if(te && !timeRE.test(te)) return alert('Stop time invalid (HH:MM)');
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
    ['system','playlists','audio','display','controls','timezone','wifi','weather','tools','timer','customize','advanced'].forEach(k=>{
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
  document.getElementById('tab-customize')?.addEventListener('click', ()=> showTab('customize'));
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

  // main toolbar actions (Update, Webboard, IR, DLNA)
  document.getElementById('btn-update')?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'fwupdate'}).then(()=>alert('FW update triggered (demo)')));
  document.getElementById('btn-webboard')?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'webboard'}).then(()=>alert('Webboard action (demo)')));
  document.getElementById('btn-ir')?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'setupir'}).then(()=>alert('Start IR setup (demo)')));
  document.getElementById('btn-dlna')?.addEventListener('click', ()=> api('/api/control','POST',{cmd:'dlna'}).then(()=>alert('DLNA action (demo)')));

  // mdns restart button
  document.getElementById('sys-mdns-reboot')?.addEventListener('click', ()=>{
    const v = (document.getElementById('sys-mdns')||{}).value || '';
    if(!v) return alert('Podaj nazwę mDNS przed restartem');
    api('/api/control','POST',{cmd:'rebootmdns',mdns:v}).then(()=> alert('Restart mDNS (demo)'));
  });

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
