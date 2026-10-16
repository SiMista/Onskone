# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git & commits (IMPORTANT)

- **Always ask the user for confirmation before ANY `git commit` AND ANY `git push`.** Never commit or push autonomously, even after a "finished" task or for an obvious fix.
- **Do not add a `Co-Authored-By` trailer** to commit messages (no generated co-author).

## Stack & layout

pnpm workspace monorepo with three packages:

- `frontend/` — React 18 + Vite 6 + TypeScript + Tailwind v4 + socket.io-client. SPA with `react-router-dom` v7.
- `backend/` — Node 18+ ESM, Express + Socket.IO 4, TypeScript via `tsx` (no build step in dev). `better-sqlite3` for the tickets table only.
- `shared/` — `@onskone/shared`, the contract between front and back: types (player, lobby, round, game, decks, socket-events) + `GAME_CONSTANTS` + `RoundPhase`/`GameStatus`/`GameMode` enums.

The shared package is **built**, not watched-into-source. Frontend and backend import the compiled `dist/`. **Always rebuild shared before backend/frontend** when its types change, or run it in watch mode in parallel.

## Common commands

```bash
# Dev (parallel front + back)
pnpm dev                # ⚠️ ne lance QUE front + back (shared n'a pas de script `dev`, seulement `watch`)
pnpm dev:frontend       # http://localhost:3000
pnpm dev:backend        # http://localhost:8080
pnpm dev:shared         # rebuild shared types on change (alias de `pnpm --filter @onskone/shared watch`)
# Pour un vrai parallèle front+back+shared:watch, lancer `pnpm dev` ET `pnpm dev:shared` côte à côte
# (ou utiliser les scripts scripts/start-dev.* qui buildent shared une fois avant de spawn back+front).

# Or via the launcher scripts in scripts/ (build shared once, then spawn back+front)
./scripts/start-dev.sh          # Linux/macOS
scripts\start-dev.bat           # Windows (opens two cmd windows)

# Build (must be ordered: shared first)
pnpm build:shared
pnpm build:frontend
pnpm build:backend       # ⚠️ NO-OP : backend n'a pas de script `build` (tourne via tsx, jamais compilé)
pnpm build               # recursive — build shared (tsc) puis frontend (tsc && vite build), PAS le backend

# Mobile (Capacitor — Android local, iOS buildé sur CI Codemagic)
./scripts/start-mobile.sh       # live reload sur device/émulateur (le tel charge le Vite du PC)
./scripts/build-mobile.sh       # build statique final + cap sync + ouvre Android Studio
# (équivalents .bat pour Windows). build-mobile attend VITE_SERVER_URL (URL du backend).
# iOS : pas de build local (pas de Mac). codemagic.yaml génère frontend/ios à la
# volée (cap add ios) sur Mac cloud, signe, et publie sur TestFlight.

# Checks
pnpm typecheck           # ⚠️ NO-OP — aucun package ne définit le script `typecheck`, sort en code 0 sans rien vérifier
pnpm lint                # ⚠️ NO-OP — pas d'ESLint installé/configuré dans le repo
# Pour vraiment typer un package : tsc -p <pkg>/tsconfig.json --noEmit
#   tsc -p shared/tsconfig.json --noEmit
#   tsc -p frontend/tsconfig.json --noEmit
#   tsc -p backend/tsconfig.json --noEmit

# Tests — backend (Jest) et frontend (Vitest) ; shared n'a pas de tests
pnpm --filter backend test
pnpm --filter backend test -- path/to/file.test.ts
pnpm --filter backend test -- -t "name of test"
pnpm --filter frontend test                        # vitest run (utils, hooks, composants)
pnpm --filter frontend test -- src/utils/gameSync.test.ts

# Regenerate the question deck from the Excel source (génère questions_fr.json + questions_en.json)
node backend/src/data/build-questions.mjs
```

Adding deps: `pnpm --filter frontend add <pkg>`, `pnpm --filter backend add <pkg>`, `pnpm --filter @onskone/shared add -D <pkg>`. Root devDeps: `pnpm add -w -D <pkg>`.

## Architecture

### Real-time game model (backend)

The game runs entirely in-memory; SQLite is only used for the tickets table (`backend/src/db/database.ts`, schema `tickets`).

- `LobbyManager` (singleton-style module in `backend/src/managers/`) holds the `Map<lobbyCode, Lobby>` of active lobbies and runs a cleanup interval for stale ones.
- `GameManager` orchestrates round transitions and scoring against the `Game`/`Round`/`Player` models in `backend/src/models/`.
- `SocketHandler` (single class in `backend/src/sockets/SocketHandler.ts`) wires every `ClientToServerEvents` socket event to the managers. **All gameplay actions go through Socket.IO**, not REST — the HTTP routes (`backend/src/routes/`) only cover tickets and admin (auth, données, maj forcée).
- Each lobby is a Socket.IO room keyed by the 6-char `lobbyCode`. `ConnectionRegistry` (`backend/src/sockets/ConnectionRegistry.ts`) holds the disconnect/reconnect timers (delays in `shared/src/constants.ts`):
  - `disconnectTimeouts` / `RECONNECT_GRACE_PERIOD_MS = 30s` — removes a dropped player from a **waiting** lobby. **Never during a game**: in-game players are kept until `gameEnded` (scores + reconnection), and `cleanupDisconnectedPlayers` is a no-op while IN_PROGRESS.
  - `leaderDisconnectTimeouts` / `LEADER_DISCONNECT_DELAY_MS = 60s` — skips the round if the leader doesn't come back (mobile background tolerance).
  - `inactiveTimeouts` / `INACTIVE_DELAY_MS = 60s` — marks a player inactive without removing them.
  - `kickedPlayers` / `KICK_BLOCK_DURATION_MS = 5min` — temporary ban after a kick.
  - `Round.revealBackstopHandle` / `REVEAL_BACKSTOP_MS = 4min` — REVEAL is the only phase without a timer; if the leader does nothing for that long the server concludes the round itself (`armRevealBackstop` in `broadcasting.ts`, rearmed on every reveal action).
- **Reconnection & sync (server = single source of truth, clients converge):**
  - Each player has a server-side `reconnectToken` (emitted only to its owner via `lobbyCreated`/`joinedLobby`). `getGameState`/`joinLobby` with a valid token reattach the slot and evict a still-connected old socket. A same-name join **without** the token is refused (`sessionLost: true` on the error).
  - **Lost session** (app killed, storage wiped): `getLobbyInfo` returns `reclaimablePlayers` (players whose socket is dead); `reclaimPlayer {playerId}` takes that seat **only during an IN_PROGRESS game and only if its socket is dead**, issues a provisional `claimToken` (`playerReclaimed`) and is rate-limited per lobby. The original `reconnectToken` stays valid and wins: when its holder comes back, the claim is revoked and the claimant evicted (`tokenMatches` / `revokeClaimIfProvenOwner` in `handlers/reconnection.ts`). The Home page shows the « Tu étais qui ? » modal for in-progress lobbies (and polls while nobody is disconnected yet). **Choix assumé** : le code du salon suffit à reprendre un siège mort en partie (y compris celui du pilier) — compromis UX voulu, pas un oubli ; les garde-fous ci-dessus sont la limite à ne pas abaisser. Un socket qui tient déjà un slot du salon ne peut pas en reprendre un second (`socketHoldsOtherSlot`).
  - Clients send `syncCheck` every 5 s with `gameFingerprint()` (`shared/src/sync.ts`, = status/round/phase/revealed count). Mismatch → the server pushes the full `gameState` (only to the socket attached to that player's slot); no answer in 4 s → the client forces a reconnect. Every phase delta carries `roundNumber`; a delta for another round is never applied, it triggers a resync (`frontend/src/utils/gameSync.ts`).
- Round state machine: `RoundPhase` enum in `shared/src/types/round.ts` (`QUESTION_SELECTION → SUBSTITUTE_SELECTION? → ANSWERING → SUBSTITUTE_ANSWERING? → GUESSING → REVEAL`). Two game modes branch through it: **Classique** (no substitute) and **Devine ma réponse** (leader picks a substitute who writes the leader's answer).
- Similarity scoring (`backend/src/utils/similarity.ts`) merges near-duplicate answers so the guesser doesn't get punished for paraphrases. Validation/sanitization lives in `backend/src/utils/validation.ts`; per-event rate limiters in `backend/src/utils/rateLimiter.ts`.

### CORS / origin policy

`backend/src/index.ts` builds the Socket.IO and HTTP CORS allowlists from `process.env.ALLOWED_ORIGINS` (comma-separated). In **production**, an unset `ALLOWED_ORIGINS` rejects all browser requests — logged as a security warning at boot. In dev, only `localhost`, `127.0.0.1`, and `192.168.x.x:*` are allowed.

### Version & mise à jour forcée

La version de l'app est **dérivée de git** par `scripts/app-version.mjs` : `MAJOR.MINOR` lus dans le fichier `VERSION` commité à la racine, `PATCH` = nombre de commits depuis son dernier bump ; `versionCode` Android = total de commits. Source unique pour `__APP_VERSION__` (vite `define`), `/version.json` (émis au build, servi par nginx, relu en live par le backend via `utils/appVersion.ts`), Gradle (`-PappVersionName` / `-PappVersionCode`) et Codemagic. **Un clone shallow ou sans `.git` fait échouer `vite build`** (on ne livre jamais une fausse version) — d'où les `git fetch --unshallow` dans CI, Codemagic et `deploy.sh`. Le build Docker (`Dockerfile`) a donc besoin de `.git`, que `.dockerignore` exclut aujourd'hui (la prod tourne en pm2 via `scripts/deploy.sh`).

Maj forcée : règle unique dans `shared/src/version.ts` (`shouldBlockForUpdate` : bloqué SSI version < plancher ET une version plus récente lui est réellement obtenable). Le plancher vient de l'admin (`POST /admin/version-gate`, SQLite `app_config`) ou du seed `MIN_SUPPORTED_VERSION` (env, sinon fichier racine). Le serveur l'envoie dans l'event `versionPolicy` à chaque connexion (`backend/src/utils/versionGate.ts`) et le client tranche lui-même (`frontend/src/utils/versionGate.ts` : `/version.json` sur le web, Play Core / App Store lookup en natif) ; seuls les anciens clients sans `handshake.auth.versionPolicy` sont refusés au handshake (`VERSION_TOO_OLD`).

### Frontend routing

`frontend/src/App.tsx` registers the public routes: `/`, `/join/:lobbyCode` (`JoinRedirect`, cible des liens d'invitation `buildInviteUrl` / App Links), `/lobby/:lobbyCode`, `/game/:lobbyCode`, `/endgame/:lobbyCode`, `/privacy`, `/mentions`, `/cgu` et `/support` (tous rendus par `Legal` avec une prop `kind`), `/admin`, et la dev-only `/studio` (guarded by `import.meta.env.DEV`). **Pages lazy** (`React.lazy`) : `Lobby`, `Game`, `EndGame` et `Admin`. Eager : `Home`, `NotFound`, `Studio`, `Legal`.

The single socket connection lives in `frontend/src/utils/socket.ts`; pages subscribe via `useSocketEvent` (`frontend/src/hooks/`). Most game state arrives through `gameStateUpdate`/`gameEnded` payloads — components do not refetch.

### Studio (dev-only test harness)

`frontend/src/pages/Studio.tsx` is a multi-iframe rig that lets one developer simulate a whole lobby locally. Each iframe is a real frontend instance loaded with `?studioSlot=N&playerName=…&avatarId=…&autoCreate=1|autoJoin=1` (+ optionnels : `studioGameMode`, `studioGameSpeed`, `bot=1`, `premium=1`). Critical pieces:

- `frontend/src/utils/studioStorage.ts` namespaces `localStorage` per slot using the `studioSlot` URL param (captured at module load), with `window.name` as a same-origin reload fallback. **Never write directly to `localStorage` from app code that runs inside a studio iframe** — go through `studioStorage` or the Studio slot's state will leak across iframes.
- `frontend/src/hooks/useStudioBot.ts` reads `?bot=1` or a `studio:setBot` postMessage from the parent (flag aussi capté au niveau module dans `studioStorage.ts`, donc même hors `/game`) and auto-plays the current phase (leader: select question, pick substitute, submit guesses, reveal+next; non-leaders: submit a random answer). Used by the Studio's "Tous bots" toggle.
- The "Composants" tab in Studio is `frontend/src/pages/studio/Gallery.tsx`, a live design-system inspector. The ShareCard preview section calls `buildShareCard` from `frontend/src/utils/shareCard.ts` (canvas 1080×1920 image used by the end-game share button).

### Admin

`/admin` (frontend) hits `backend/src/routes/admin.ts`. Auth is a custom HMAC token (`ADMIN_PASSWORD` → 7-day signed token via `ADMIN_TOKEN_SECRET`). No session middleware. Tickets CRUD is at `/api/tickets` (`backend/src/routes/tickets.ts`).

### Questions deck

Le deck est par locale : `backend/src/data/questions_fr.json` + `backend/src/data/questions_en.json` sont la source de vérité en jeu, **générés** depuis `Onskoné_2405.xlsx` via `node backend/src/data/build-questions.mjs` (la xlsx vit à côté dans `backend/src/data/`). Ne pas éditer ces JSON à la main ; éditer la xlsx et relancer le script. `questionsRepository.ts` charge `questions_${locale}.json` par langue (pools en mémoire) ; `GameManager` en tire le deck du salon via `resolveLobbyPool`.

`backend/src/data/themes.json` est un fichier **distinct, maintenu à la main** (PAS généré par le script) : métadonnées de thèmes (`category`, `emoji`, `mature?`, `premium?`, `labels.{fr,en}`, `descriptions.{fr,en}`). `loadThemesMeta()` dans `questionsRepository.ts` le fusionne avec les questions pour construire le catalogue de decks (le flag `premium` est recopié sur chaque `GameCard.premium`, d'où le badge exclusif côté front) ; un thème présent dans les questions mais absent de `themes.json` est ignoré avec un warning.

### Design system (frontend)

All design tokens live in `@theme` inside [frontend/src/index.css](frontend/src/index.css). **Never hardcode a hex color, font family, or repeat the same display-size pattern in components.** If a value would be used in more than one place, it belongs in `@theme` first.

**Color tokens** (the only sanctioned source of color):

- `brand-700 / 500 / 400 / 200` - bleu Onskoné, du plus foncé au plus clair (gradient, UI primaire, halo, slider "à distance")
- `success-700 / 500 / 400` - vert validation (boutons, réponses correctes)
- `danger-700 / 500 / 400` - rouge danger (boutons quit, croix supprimer, réponses incorrectes)
- `warning-700 / 500 / 400 / 350 / 300 / 200 / 100 / 50 / orange` - jaune chaud (CTA warning, achievements, target magnetic, pulse, kraft)
- `premium-100 / 300 / 500 / 600 / 700` - or brillant façon ruban (or saturé, reflet jaune clair, ombres orangées), **seule** famille pour tout ce qui est premium (paywall, bouton accueil, cadre avatar, couronnes, badge carte, pseudo doré, toast `premium`). Ne jamais réutiliser le jaune `warning` pour du premium (sinon ça ressemble à un succès). Dégradé prêt à l'emploi : `.bg-premium-gold` (angle surchargeable via `--premium-gold-angle`) ; pseudo doré : `.text-gold-shine`.
- `cream-player / question / answer / paper / kraft / settings / checkbox / focus` - papiers cartonnés (chaque cream a un usage narratif distinct, ne pas les interchanger)
- `quit / quit-hover` - boutons de retrait neutres
- `podium-gold / silver / bronze` - médailles EndGame (codes universels)

**Couleurs intentionnellement hors-tokens** (story palette, ne pas généraliser) :
- `TIERS` dans `constants/tiers.ts` (6 paliers de couleur du score d'équipe ; le 6e = violet Onskoné `#b46cff`)
- `CATEGORY_COLORS` dans `constants/game.ts` (couleur narrative par thème de carte)
- Onskoné violet (`#b46cff` etc.) dans EndGame, climax visuel
- Palette sombre `Admin.tsx` / `Studio.tsx` / `pages/studio/Gallery.tsx` (dev tooling, isolée)
- `shareCard.ts` peint sur canvas, ne peut pas lire les vars CSS

**Typographie** : trois familles, à composer avec les classes de hiérarchie.

- `font-sans` (Nunito) - body par défaut
- `font-display` (Fredoka) - titres ronds, CTA, badges
- `font-accent` (Fraunces) - **rare**, 1-2 mots-clés par écran pour casser la monotonie Fredoka

**Hiérarchie typo** (utiliser ces classes plutôt que `font-display font-bold text-Xl`) :
- `text-display-xl` (32-44px, poids 700) - titre d'écran principal
- `text-display-lg` (24-30px, poids 700) - h1 / titre de carte
- `text-display-md` (18-22px, poids 600) - h2 / sous-titre
- `text-display-sm` (16px, poids 600) - h3 / label fort
- `text-display-xs` (11px, poids 600, uppercase, tracking large) - labels & metadata

**Identité visuelle** (toujours dispo en utility) :
- `.stack-shadow` / `.stack-shadow-sm` / `.stack-shadow-lg` - ombres de carte empilées
- `.texture-paper` - grain papier appliqué via ::after avec mix-blend multiply
- `.bg-pattern-dots` / `.bg-pattern-diagonal` / `.bg-pattern-zigzag` - motifs de fond par ambiance

**Conventions animations** :
- Animations one-shot pour entrées/transitions (`animate-modal-pop`, `animate-card-deal-in`, etc.)
- Animations idle infinies : **max 1 par écran**, sur l'élément qui porte l'action en cours. Si une carte clignote pour guider l'œil, suspendre les `animate-float` décoratifs alentour.

### Mobile (Capacitor)

Le même build web `frontend/build` est embarqué dans une coquille native via Capacitor. Config dans [frontend/capacitor.config.ts](frontend/capacitor.config.ts) (`appId: com.onskone.app`, `webDir: build`). La plateforme **Android** est commitée (`frontend/android/`, build local). La plateforme **iOS** n'est **pas** commitée : elle est régénérée à neuf (`cap add ios`) à chaque build sur le Mac cloud Codemagic (cf [codemagic.yaml](codemagic.yaml)), signée, puis publiée sur TestFlight. Donc tout réglage iOS qui doit persister (entitlements Universal Links, icônes, version) est réinjecté par le pipeline, pas posé en dur dans `frontend/ios/`. App Store ID (Apple ID numérique) : `6782334531` ; Team ID : `KRJ3L83RCL`.

- `vite.config.ts` a `base: './'` (chemins relatifs obligatoires : la page est servie depuis le filesystem de l'app, pas la racine d'un domaine).
- **URL backend** : en natif, `window.location.origin` vaut `https://localhost` (Android) / `capacitor://localhost` (iOS), donc inexploitable. Le build mobile doit fournir `VITE_SERVER_URL` (URL absolue du backend) — c'est la première branche de `getServerUrl()` dans `frontend/src/constants/game.ts`. En live reload, l'origine devient l'IP du PC (`http://192.168.x.x:3000`) et retombe sur la branche réseau local.
- **CORS** : `CAPACITOR_ORIGINS` (`capacitor://localhost`, `https://localhost`) est toujours autorisé dans `backend/src/index.ts`, indépendamment de `ALLOWED_ORIGINS`.
- Scripts : `scripts/start-mobile.*` (live reload) et `scripts/build-mobile.*` (build final + Android Studio).

### Pubs (AdMob, natif uniquement)

**Règle produit : jamais de pub pendant une partie.** Deux emplacements entre les parties : pub d'ouverture au lancement (format App open, splash tenu 3,5 s max) et interstitiel au clic « Retour au salon » / « Accueil » de l'écran de fin (« Retour au salon » ne rejoint le salon qu'à la **fermeture** de la pub : sinon le joueur y paraît présent et l'hôte peut lancer une partie qui démarre sous sa pub). Premium = SDK jamais initialisé (ni pub ni popup). Règles pures dans `frontend/src/utils/adPolicy.ts` (testées), orchestration dans `frontend/src/utils/ads.ts`.

- Plugin `@capacitor-community/admob` **épinglé en 8.1.0** : la 8.2+ exige Capacitor 8.5. Ne pas le monter seul.
- En dev (Vite) les blocs de démo Google sont utilisés d'office ; `VITE_ADMOB_TEST_ADS=1` force le mode test sur un build de prod. Ne jamais cliquer ses propres vraies pubs (compte suspendu).
- App ID Android dans `strings.xml` ; côté iOS, App ID + SKAdNetwork + texte ATT injectés par Codemagic.

## Gotchas

- **Shared package is consumed from `dist/`** — if you change a type in `shared/src/types/` and front/back don't pick it up, you forgot to rebuild. `pnpm dev:shared` keeps watch.
- **Same-name join = reconnection attempt**: `joinLobby` resolves an existing player by name (case-insensitive) and only reattaches the slot if the `reconnectToken` matches — otherwise it is refused (never a silent fusion). The Studio's `start()` enforces unique names+avatars across slots — preserve that invariant if you touch it.
- **Any new socket event that returns game state must check that the socket is attached to the player's slot** (`player.socketId === socket.id` + in the room), like `syncCheck`; answers/guesses are only exposed in the phases where the client is allowed to see them (`serializeRound`).
- **Studio route is dev-only** — gated by `import.meta.env.DEV`. Don't reference it from production pages.
- **Backend is ESM with `.js` import extensions** in TypeScript (`from '../utils/logger.js'`) — required for `tsx`/native ESM resolution. Keep this convention when adding imports.
- **Tailwind v4** is configured via `@tailwindcss/vite` and `@import "tailwindcss"` in `index.css`, with the design tokens (`--font-display`, `--color-cream-player`, etc.) declared in `@theme`. There is no `tailwind.config.js`.
