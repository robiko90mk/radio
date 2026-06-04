yoRadio Web UI
================

This is a feature-rich remote web UI for yoRadio. Drop these files into `data/www/` on the device so the built-in webserver can serve them.

Features:
- Now playing + metadata
- Play / Pause / Prev / Next controls
- Volume slider
- Playlist view with drag & drop reordering and play-by-index
- EQ presets + visualizer canvas (stub)
- Theme selection (saved in `localStorage`)

Server integration (device side):
- Expose WebSocket at `/ws` to push live state (JSON) like:
  `{ playing: true, volume: 50, track: {title:'..', artist:'..'}, playlist: [...] }`
- Implement REST endpoints (optional fallbacks):
  - `GET /api/state` -> returns current state JSON
  - `POST /api/control` -> body `{ cmd: 'play'|'pause'|'next'|'prev'|'volume'|'play_index', value? }`
  - `PUT /api/playlist` -> body `{ playlist: [...] }`

If the device does not implement these endpoints, the UI will still work locally but controls will be no-ops.
