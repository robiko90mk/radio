#!/usr/bin/env python3
"""Simple demo server to preview the Web UI locally.

Usage:
  pip install aiohttp
  python tools/demo_webui_server.py

Then open http://localhost:8000
"""
import asyncio
import json
from aiohttp import web, WSCloseCode
from pathlib import Path
import csv

ROOT = Path(__file__).resolve().parents[1] / 'yoRadio' / 'data' / 'www'

state = {
    'playing': False,
    'volume': 50,
    'track': {'title': 'Demo Track', 'artist': 'yoRadio', 'stream': 'Local'},

    # playlist will be populated from playlist.csv if present
    'playlist': [],
    'eq': { '60':0, '250':0, '1000':0, '4000':0, '10000':0 }
}


def load_playlist_from_csv():
    # search likely locations for playlist.csv
    candidates = [
        Path(__file__).resolve().parents[1] / 'playlist.csv',
        Path(__file__).resolve().parents[2] / 'playlist.csv',
        ROOT / 'playlist.csv'
    ]
    for p in candidates:
        if p.exists():
            try:
                with p.open('r', encoding='utf-8') as fh:
                    sample = fh.read(2048)
                    fh.seek(0)
                    dialect = csv.Sniffer().sniff(sample, delimiters='\t,;')
                    fh.seek(0)
                    reader = csv.reader(fh, dialect)
                    out = []
                    for row in reader:
                        if not row: continue
                        # try to map: title, url, maybe other columns
                        title = row[0].strip() if len(row) > 0 else ''
                        url = row[1].strip() if len(row) > 1 else ''
                        if url:
                            out.append({'title': title or url, 'url': url})
                    return out
            except Exception:
                return []
    return []


# populate playlist at startup if CSV found
csv_list = load_playlist_from_csv()
if csv_list:
    state['playlist'] = csv_list
    if csv_list:
        state['track'] = csv_list[0]

WS_CLIENTS = set()

async def ws_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    WS_CLIENTS.add(ws)
    try:
        await ws.send_str(json.dumps(state))
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                    # simple echo update
                    if data.get('cmd') == 'volume':
                        state['volume'] = int(data.get('value', state['volume']))
                        await broadcast_state()
            
            
            
                    if data.get('cmd') == 'eq_set':
                        band = str(data.get('band'))
                        val = float(data.get('value',0))
                        state['eq'][band] = val
                        await broadcast_state()
                    if data.get('cmd') == 'eq_preset':
                        vals = data.get('values', {})
                        for k,v in vals.items(): state['eq'][str(k)] = float(v)
                        await broadcast_state()
                    if data.get('cmd') == 'eq_save':
                        # demo: do nothing persistent
                        await broadcast_state()
                        await broadcast_state()
                except Exception:
                    pass
            elif msg.type == web.WSMsgType.ERROR:
                break
    finally:
        WS_CLIENTS.discard(ws)
    return ws

async def api_state(request):
    return web.json_response(state)

async def api_control(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({'error': 'invalid json'}, status=400)
    cmd = data.get('cmd')
    if cmd == 'play':
        state['playing'] = True
    elif cmd == 'pause':
        state['playing'] = False
    elif cmd == 'next':
        # rotate playlist
        if state['playlist']:
            state['playlist'].append(state['playlist'].pop(0))
    elif cmd == 'prev':
        if state['playlist']:
            state['playlist'].insert(0, state['playlist'].pop())
    elif cmd == 'volume':
        state['volume'] = int(data.get('value', state['volume']))
    elif cmd == 'play_index':
        idx = int(data.get('index', 0))
        if 0 <= idx < len(state['playlist']):
            state['track'] = state['playlist'][idx]
            state['playing'] = True
    await broadcast_state()
    return web.json_response({'ok': True})

async def api_playlist(request):
    try:
        data = await request.json()
        state['playlist'] = data.get('playlist', state['playlist'])
        # persist to playlist.csv if requested
        if data.get('persist'):
            try:
                outp = Path(__file__).resolve().parents[1] / 'playlist.csv'
                with outp.open('w', encoding='utf-8', newline='') as fh:
                    for it in state['playlist']:
                        title = it.get('title','')
                        url = it.get('url','')
                        fh.write(f"{title}\t{url}\n")
            except Exception:
                pass
        await broadcast_state()
        return web.json_response({'ok': True})
    except Exception:
        return web.json_response({'error': 'invalid json'}, status=400)


async def api_check_urls(request):
    try:
        data = await request.json()
        urls = data.get('urls', [])
        results = []
        import aiohttp
        async with aiohttp.ClientSession() as sess:
            for url in urls:
                try:
                    # try HEAD first
                    async with sess.head(url, timeout=5) as r:
                        ok = r.status < 400
                except Exception:
                    try:
                        async with sess.get(url, timeout=5) as r:
                            ok = r.status < 400
                    except Exception:
                        ok = False
                results.append(bool(ok))
        return web.json_response({'results': results})
    except Exception:
        return web.json_response({'error': 'invalid json'}, status=400)


async def api_import_myoptions(request):
    # try common locations for myoptions.h within the repo
    candidates = [
        Path(__file__).resolve().parents[1] / 'yoRadio' / 'myoptions.h',
        Path(__file__).resolve().parents[1] / 'myoptions.h'
    ]
    for p in candidates:
        if p.exists():
            try:
                content = p.read_text(encoding='utf-8')
                # simple parser: extract selected #define values
                import re
                defs = dict()
                for m in re.finditer(r"^\s*#define\s+(\w+)\s+(.+)$", content, flags=re.M):
                    k = m.group(1).strip()
                    v = m.group(2).strip()
                    # cleanup trailing comments
                    v = v.split('//')[0].strip()
                    v = v.split('/*')[0].strip()
                    defs[k] = v
                # pick keys of interest and coerce types
                keys = ['INITIAL_VOLUME','FIXED_VOLUME','L10N_LANGUAGE','PLAYER_FORCE_MONO','REMOVE_AUDIO_CONTROLS','MUTE_PIN']
                settings = {}
                for k in keys:
                    if k in defs:
                        val = defs[k]
                        # try int
                        try:
                            settings[k] = int(val)
                            continue
                        except Exception:
                            pass
                        # booleans
                        if val in ('true','false','TRUE','FALSE'):
                            settings[k] = val.lower()=='true'
                            continue
                        # strip quotes
                        settings[k] = val.strip('"')

                return web.json_response({'content': content, 'settings': settings})
            except Exception:
                return web.json_response({'error': 'read error'}, status=500)
    return web.json_response({'error': 'not found'}, status=404)


async def api_settings(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({'error': 'invalid json'}, status=400)
    # store into state for demo purposes
    settings = data.get('settings')
    if settings:
        state['device_settings'] = settings
    # optionally persist? only demo: do not overwrite project files automatically
    if data.get('persist'):
        # For safety, just acknowledge — real implementation would validate and write.
        try:
            # attempt to write a small settings.json next to server for demo
            outp = Path(__file__).resolve().parents[1] / 'yoRadio' / 'data' / 'myoptions_preview.json'
            outp.write_text(json.dumps(settings or {}, indent=2), encoding='utf-8')
        except Exception:
            pass
    return web.json_response({'ok': True})

async def broadcast_state():
    data = json.dumps(state)
    to_remove = []
    for ws in list(WS_CLIENTS):
        try:
            await ws.send_str(data)
        except Exception:
            to_remove.append(ws)
    for ws in to_remove:
        WS_CLIENTS.discard(ws)

async def periodic_viz():
    import random
    while True:
        # simulate small changes and visualizer data
        await asyncio.sleep(1.0)
        # broadcast to clients to update UI
        await broadcast_state()

def main():
    app = web.Application()
    app.router.add_get('/ws', ws_handler)
    app.router.add_get('/api/state', api_state)
    app.router.add_get('/api/import_myoptions', api_import_myoptions)
    app.router.add_post('/api/control', api_control)
    app.router.add_post('/api/settings', api_settings)
    app.router.add_put('/api/playlist', api_playlist)
    app.router.add_post('/api/check_urls', api_check_urls)
    # serve static files
    app.router.add_static('/', str(ROOT), show_index=True)

    loop = asyncio.get_event_loop()
    loop.create_task(periodic_viz())
    web.run_app(app, host='0.0.0.0', port=8000)

if __name__ == '__main__':
    print('Serving', ROOT)
    main()
