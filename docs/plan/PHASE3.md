# PLAN — Phase 3: Self-Serve App, Distribution & Commercial Model

> **Phase:** 3 of 3  
> **Pre-condition:** Phase 2 fully complete and verified per docs/plan/PHASE2.md exit criteria.  
> **Goal:** Package Phuebus for self-serve commercial distribution — Tauri desktop app (one-time license) and Web SaaS cloud deployment (monthly subscription) with a downloadable Model Store.  
> **Flow for each prompt:** Research → Plan → Ask for choices/decisions → Write code → Verify → Commit → Push

---

## Prompt 1 — Tauri Desktop App Setup

### Research
- [ ] Confirm Tauri v2 setup with existing Vite/vanilla HTML frontend (no framework migration needed)
- [ ] Confirm Tauri WebView limitations vs full Chromium (WebGL2 support, MediaDevices API, WebRTC)
- [ ] Evaluate Tauri `sidecar` plugin for bundling the Python AI sidecar process
- [ ] App binary size: Tauri (~6MB) vs Electron (~120MB)

### Plan
- [ ] Migrate project to Tauri v2 scaffold wrapping existing `public/` frontend
- [ ] Bundle Python AI sidecar as Tauri `sidecar` (pre-compiled PyInstaller binary)
- [ ] Create native macOS/Windows app with auto-updater
- [ ] App startup: auto-launch Node.js server + Python sidecar, open display window

### Ask Before Writing
- macOS only first, or Windows simultaneously?
- Code-signing: Apple Developer account ready for notarization?
- Update mechanism: Tauri built-in updater or manual download?

### Verify
- [ ] `tauri build` produces `.dmg` < 50MB
- [ ] App launches and all Phase 1 + Phase 2 features work inside Tauri WebView
- [ ] WebGL2 confirmed in Tauri WebView on macOS
- [ ] MediaDevices API (camera + audio) accessible inside Tauri WebView

### Commit Message
```
feat(phase3): Tauri v2 desktop app scaffold + sidecar bundling
```

---

## Prompt 2 — Base Kit & Model Pack Architecture

### Research
- [ ] Define minimal Base Kit: Which shaders + which model (SDXL Turbo lite) ship by default?
- [ ] Model pack format: directory structure, `manifest.json` schema, asset loading API
- [ ] `ModelPackManager.js` full implementation (was stub in Phase 1/2)

### Plan
- [ ] `ModelPackManager.js`: `loadPack(packPath)`, `listInstalledPacks()`, `downloadPack(url)`
- [ ] Pack manifest schema: `{ id, name, version, type: 'shader'|'model', assets: [], presets: [] }`
- [ ] Base Kit contents: 3 shader presets (Toon, Trails, NeonAura) + SDXL Turbo lite model
- [ ] Download packs from Phuebus CDN → save to user's app data directory
- [ ] UI: Model Store tab in display HUD showing available packs + install status

### Ask Before Writing
- Model pack hosting: self-hosted S3 / Cloudflare R2, or marketplace platform?
- Pack format: zip archive unpacked on install, or streamed?
- License enforcement: offline license key or online activation check?

### Verify
- [ ] Install a model pack → new presets appear in preset grid
- [ ] Downloaded packs persist across app restarts
- [ ] Base Kit ships with app (no internet required to use basic features)

### Commit Message
```
feat(phase3): ModelPackManager — pack manifest, install, Base Kit
```

---

## Prompt 3 — Cloud SaaS Deployment

### Research
- [ ] WebRTC STUN/TURN requirements for non-LAN deployment (public users behind NAT)
- [ ] Hosting: Cloudflare Workers + Durable Objects for Socket.IO rooms, or traditional Node.js VPS?
- [ ] WebGL2 in cloud-hosted browser context: any restrictions?

### Plan
- [ ] Configure TURN server (Cloudflare TURN or Coturn) for public WebRTC
- [ ] Deployment: containerize Node.js server (Docker) → deploy to Fly.io / Railway
- [ ] Authentication: session-based auth (Lucia Auth) gating access to remote + display routes
- [ ] Subscription tier: free trial (time-limited), monthly subscription (Stripe)
- [ ] Cloud GPU: connect to managed StreamDiffusion fleet (RunPod serverless)

### Ask Before Writing
- Auth provider: email/password only, or social login (Google/GitHub)?
- Free tier limits: session duration? FPS cap on free tier?
- Cloud GPU budget: on-demand (pay-per-use) or reserved instance?

### Verify
- [ ] Public user creates account → accesses `/display` and `/remote` over internet
- [ ] WebRTC works through TURN on NAT networks (test on mobile 5G → public server)
- [ ] Stripe payment flow creates active subscription
- [ ] Cloud AI generation functional at <150ms latency from cloud deployment

### Commit Message
```
feat(phase3): Cloud SaaS deployment — Docker, auth, Stripe, public WebRTC
```

---

## Prompt 4 — Licensing & Activation

### Research
- [ ] License key generation and offline validation approach (asymmetric signature vs online check)
- [ ] Tauri plugin for secure key storage (`tauri-plugin-stronghold` or system keychain)

### Plan
- [ ] License key server: generate signed JWT with device fingerprint + expiry
- [ ] `LicenseManager.js` (Tauri): validate key offline via signature; allow 3-day grace period without internet
- [ ] Activation UI: settings screen in Tauri app for key entry + activation status
- [ ] Model pack download gated behind valid license

### Ask Before Writing
- License model: per-seat (1 machine) or per-user (multi-machine)?
- Offline grace period: 3 days, 7 days, or indefinite?
- License transfer: allow user to deactivate + reactivate on new machine?

### Verify
- [ ] Valid license key activates app and enables Model Store downloads
- [ ] Invalid/expired key shows clear error message
- [ ] Offline grace period allows 3 days without internet check

### Commit Message
```
feat(phase3): License activation — offline key validation + Tauri keychain storage
```

---

## Prompt 5 — Auto-Update & Analytics (Privacy-First)

### Research
- [ ] Tauri updater: GitHub Releases as update source vs custom update server
- [ ] Privacy-preserving analytics: Plausible.io or self-hosted Umami (no personal data)

### Plan
- [ ] Tauri auto-updater: sign updates, host on GitHub Releases, check on startup
- [ ] Update changelog: display what's new modal on first launch after update
- [ ] Anonymous analytics: count active sessions, preset usage frequency (no PII)
- [ ] Opt-out toggle in settings

### Ask Before Writing
- Update check frequency: on startup only or hourly background check?
- Analytics: self-hosted (Umami on own VPS) or Plausible.io cloud?
- Crash reporting: Sentry (with PII scrubbing) or none?

### Verify
- [ ] Mock update available → app shows update prompt → downloads → relaunches with new version
- [ ] Analytics dashboard shows session count without user identifiers
- [ ] Opt-out toggle persists across restarts

### Commit Message
```
feat(phase3): Auto-updater + privacy-first analytics
```

---

## Phase 3 Exit Criteria (Definition of Done)

| Criterion | Status |
|---|---|
| Tauri desktop app builds for macOS | [ ] |
| App < 50MB download size | [ ] |
| Base Kit bundled (no internet needed for Phase 1 shaders) | [ ] |
| Model Pack install/update flow functional | [ ] |
| Cloud SaaS deployed on public URL | [ ] |
| Public WebRTC works through TURN (non-LAN) | [ ] |
| Stripe subscription payment flow functional | [ ] |
| License activation (offline-capable) functional | [ ] |
| Auto-updater functional | [ ] |
| Phase 1 + Phase 2 features unbroken in packaged app | [ ] |
