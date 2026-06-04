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

ROOT = Path(__file__).resolve().parents[1] / 'yoRadio' / 'data' / 'www'

state = {
    'playing': False,
    'volume': 50,
    'track': {'title': 'Demo Track', 'artist': 'yoRadio', 'stream': 'Local'},
    'playlist': [
        {'title': 'Internet Radio 1', 'url': 'http://stream.example/1'},
        {'title': 'Podcast Episode 2', 'url': 'http://pod.example/ep2.mp3'},
    ],
    'eq': { '60':0, '250':0, '1000':0, '4000':0, '10000':0 }
}

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
        await broadcast_state()
        return web.json_response({'ok': True})
    except Exception:
        return web.json_response({'error': 'invalid json'}, status=400)

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
    app.router.add_post('/api/control', api_control)
    app.router.add_put('/api/playlist', api_playlist)
    # serve static files
    app.router.add_static('/', str(ROOT), show_index=True)

    loop = asyncio.get_event_loop()
    loop.create_task(periodic_viz())
    web.run_app(app, host='0.0.0.0', port=8000)

if __name__ == '__main__':
    print('Serving', ROOT)
    main()
