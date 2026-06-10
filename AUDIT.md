# Rapport d'audit — Onskoné

> Audit automatisé multi-agents du monorepo (frontend / backend / shared).
> **76 agents**, deux salves (qualité/maintenabilité + cohérence/bugs), **vérification adversariale** des candidats code-mort et des bugs présumés.
> 185 findings bruts → ce rapport ne garde que ce qui a survécu à la vérification, priorisé.

## Légende
- **Sévérité** : 🔴 high · 🟠 medium · 🟡 low
- **Effort** : S (<1h) · M (quelques heures) · L (refactor majeur)
- ✅ = confirmé par un agent vérificateur adversarial (qui cherchait à *réfuter* le finding)

---

## Baseline santé du projet (état actuel)

| Check | Réalité |
|---|---|
| `pnpm typecheck` | ❌ **NO-OP** — aucun package ne définit le script, sort en code 0 sans rien vérifier |
| `pnpm lint` | ❌ **NO-OP** — aucun ESLint installé/configuré dans le repo |
| `pnpm --filter backend test` | ❌ **CASSÉ** — 0 test ne s'exécute (3 problèmes empilés, voir P0-1) |
| `pnpm build:shared` | ✅ PASS |
| `tsc --noEmit` shared | ✅ PASS, 0 erreur |
| `tsc --noEmit` frontend | ✅ PASS (après `pnpm install`) |
| `tsc --noEmit` backend | ⚠️ 2 erreurs, uniquement dans les tests (`@jest/globals` non résolvable) |

**Conséquence** : aucune barrière automatique n'empêche d'introduire des erreurs de type ou de régresser. La doc (CLAUDE.md) survend la couverture qualité réelle.

---

# P0 — À corriger en priorité

## P0-1 · Outillage qualité fantôme + tests cassés 🔴 (effort M)
- `package.json` racine : `typecheck` et `lint` délèguent en récursif à des scripts **qui n'existent dans aucun package** → no-op silencieux.
- Tests backend cassés, 3 causes empilées (`backend/`) :
  1. `jest.config.js` en `module.exports` (CommonJS) alors que `package.json` a `"type":"module"` → `ReferenceError: module is not defined`. **Fix** : renommer en `jest.config.cjs`.
  2. Les tests importent `@jest/globals`, absent des deps directes. **Fix** : `pnpm --filter backend add -D @jest/globals`.
  3. `ts-jest` (CommonJS) ne parse pas `shared/dist` (ESM) → `SyntaxError: Unexpected token 'export'`. **Fix** : preset `ts-jest/presets/default-esm` + `transformIgnorePatterns` autorisant `@onskone/shared`.
- **Fix global** : ajouter de vrais scripts `typecheck` (`tsc --noEmit`) par package + ESLint v9 flat config avec `eslint-plugin-react-hooks` (critique vu le nombre de `useEffect`/cleanup socket).

## P0-2 · Dépendance supply-chain `claude` 🔴 (effort S) ✅
- `package.json:37` racine déclare `"claude": "^0.1.2"` en **dependency de prod**. Le paquet se décrit lui-même : *"This is not the official Claude Code package"*. **Jamais importé** (grep négatif partout).
- **Fix** : `pnpm remove -w claude` (et supprimer le bloc `dependencies` racine, inutile dans un monorepo).

## P0-3 · Bugs de logique de jeu confirmés ✅

### a. Réponse vidée par `sanitizeInput` après validation → blocage de phase 🔴 (S)
`SocketHandler.ts:1470-1520` — `validateAnswer` passe AVANT `sanitizeInput`, qui peut renvoyer `""` (ex : input = balises HTML). La branche "tous ont répondu" teste la truthiness → `""` est falsy → la phase ne transitionne jamais.
**Fix** : re-valider après sanitize (`if (!sanitizedAnswer) emit error; return;`) ou tester `answers[p.id] !== undefined`.

### b. Réponse substitut vide → la réponse du pilier disparaît du pool de devinette 🔴 (S)
Mode "Devine ma réponse", `SocketHandler.ts:1685-1717` — même problème de falsy sur `substituteAnswer`. Une réponse vide (balises seules) fait disparaître l'entrée pilier de `getGuessingAnswers()`.
**Fix** : re-valider après sanitize dans `submitSubstituteAnswer` + tester `substituteAnswer != null` plutôt que la truthiness.

### c. Soft-lock de fin de partie 🔴 (S)
`Game.ts:90` — `isGameOver()` ne tient pas compte de l'épuisement des piliers éligibles. Si des joueurs se déconnectent, `eligibleLeaders` peut tomber à 0 **avant** que `rounds.length` n'atteigne `initialActivePlayerCount` → `nextRound()` (`Game.ts:46`) throw en boucle au lieu de finir proprement.
**Fix** : `isGameOver()` renvoie aussi `true` quand `getEligibleLeaders().length === 0` (factoriser le calcul, réutilisé par `nextRound`).

### d. `confirmSimilarity` accorde +1 sans re-vérifier la similarité côté serveur 🔴 sécurité (S)
`SocketHandler.ts:2074-2085` — le serveur fait confiance au client : bonus accordé sans recalculer `areAnswersSimilar`. Un client modifié peut s'octroyer des points.
**Fix** : recalculer la paire via `getGuessingAnswers()` et n'accorder le bonus que si `areAnswersSimilar()` est vrai et qu'aucune n'est `NO_RESPONSE` (reproduire les gardes de `revealAnswer` l.1989-1999).

### e. `requestTimerState` renvoie le timer de la phase **précédente** 🟠 (S)
`SocketHandler.ts:2197-2205` — les champs timer ne sont jamais réinitialisés au changement de phase ; un client qui reconnecte reçoit un compte à rebours périmé.
**Fix** : vérifier `timerPhase === phase` avant de répondre (sinon `emit('timerState', null)`), et remettre les champs timer à `undefined` dans `Round.nextPhase()`.

### f. Pas de timer serveur autoritatif → round figé si le pilier est en arrière-plan 🟠 (M)
`SocketHandler.ts:2156-2226` — le serveur stocke `timerEnd` mais ne l'applique **jamais** ; seul le client du pilier émet `timerExpired`. **Nuance** (confirmée par la vérif) : sur une vraie déconnexion socket, le filet `leader-disconnect` (15s) rattrape. Le trou ne concerne que le pilier **connecté mais throttlé** (onglet mobile en arrière-plan, throttling JS) → toutes les phases sauf REVEAL se bloquent pour **tout le monde**.
**Fix** : armer un `setTimeout(duration)` côté serveur au `startTimer` (annulé/réarmé par phase, gardé par `timerProcessedForPhase`) qui exécute la logique d'expiration. Le `timerExpired` du pilier devient une simple optimisation de réactivité.

### g. Kick d'un non-pilier pendant une partie supprime ses scores du leaderboard 🟠 (S)
`SocketHandler.ts:930-950` + `Game.ts:107`.
**Fix** : si `game.status === IN_PROGRESS`, refuser le kick ou marquer inactif sans retirer de `lobby.players`.

### h. `PlayerCard` : "Promouvoir hôte" / "Expulser" en **français codé en dur** 🟠 i18n (S) ✅
`PlayerCard.tsx:77,89` — composant prod, n'importe jamais `useLocale()`. Jamais traduit en EN. Pas de clé correspondante dans le dictionnaire.
**Fix** : ajouter `lobby.playerMenu.promote` / `.kick` en miroir fr/en, utiliser `useLocale()`, + `aria-label` sur le déclencheur `FaEllipsisV` (aujourd'hui sans label accessible).

## P0-4 · Sécurité backend

### a. Rate-limit contournable : `X-Forwarded-For` sans `trust proxy` 🔴 (S) ✅
`tickets.ts:22-26` — le header est contrôlable par le client ; `loginLimiter` (anti-bruteforce admin) et `ticketLimiter` sont triviaux à contourner.
**Fix** : `app.set('trust proxy', N)` + utiliser `req.ip`, OU ignorer le header et utiliser `req.socket.remoteAddress` si exposé en direct.

### b. `ADMIN_TOKEN_SECRET` retombe sur `'change-me-dev-only'` en prod sans warning 🟠 (S)
`admin.ts:5` — fallback silencieux → tokens admin forgeables si les deux env vars manquent.
**Fix** : warning sécurité au boot (comme pour `ALLOWED_ORIGINS`), voire refus de démarrer les routes admin en prod sans secret.

### c. CORS Socket.IO : requêtes sans Origin autorisées sans condition en prod 🟠 (S)
`index.ts:42-47` — `if (!origin) callback(null, true)`. Politique divergente du middleware HTTP (plus strict). Les apps Capacitor passent déjà par `CAPACITOR_ORIGINS`.
**Fix** : retirer cette branche en prod pour aligner, ou documenter le client légitime sans Origin.

### d. `IRound` (type *shared*) émis brut à tous les clients 🔴 archi/fuite (L)
`shared/types/round.ts:46-115` + `serializeGame` (`SocketHandler.ts:131`) — émet `answers` (qui-a-écrit-quoi), `guesses`, `scores`, `substituteAnswer`, `shuffledAnswerIds`, le pool de cartes… à **toute la room**. Le front ne lit **aucun** de ces champs. Sur reconnexion en GUESSING, un non-pilier reçoit la map des auteurs.
**Fix** : scinder en `IRound` (serveur) + `RoundView`/`PublicRound` (shared, minimal) ; `serializeGame`/`roundStarted` projettent vers le type public. Supprime la fuite ET clarifie le contrat.

---

# P1 — Maintenabilité & architecture

## P1-1 · `SocketHandler.ts` — god-class de 2483 lignes 🔴 (L)
27 handlers `socket.on` inline dans une seule closure + 4 maps de timers + broadcasting + logique métier. **Plan de découpage** :
1. **`ConnectionRegistry.ts`** (nouveau) — détenteur unique des 4 maps + Set de locks + toutes leurs méthodes (`getDisconnectKey`, `cancel*Timeout`, `isPlayerKicked`, `cleanupLobbyResources`…). *À extraire en premier*, valider tests, puis continuer.
2. **`broadcasting.ts`** — fonctions pures `serializeGame`, `buildRevealResults`, `transitionToGuessing` (reçoivent `io` + lobby/round).
3. **`handlers/lobbyHandlers.ts`** — create/join/leave/kick/promote/updateSelectedDecks/updateGuessMyAnswerMode/updateTimeMultiplier/startGame…
4. **`handlers/roundHandlers.ts`** — requestQuestions/selectQuestion/submitAnswer/selectSubstitute/…/revealAnswer/confirmSimilarity/nextRound…
5. **`handlers/timerHandlers.ts`** — startTimer/requestTimerState/timerExpired + les `handle*Timeout`.

Chaque module exporte `register(socket, ctx)` avec `ctx = { io, registry, broadcasting }`. `SocketHandler` devient une coquille de ~40 lignes.

## P1-2 · Duplication backend dans SocketHandler 🔴 (M)
- **Préambule** rate-limit + validation + lookup lobby dupliqué dans ~27 handlers → helper `withGuards(socket, {limiter, requireLobbyCode, requireHost}, ctx => …)`.
- Logique de **fin de partie** copiée 3× (`game.end + isActive=false + emit gameEnded`).
- Transition vers **GUESSING** dupliquée (`transitionToGuessing` vs `requestShuffledAnswers`).
- Branche "tous ont répondu" dupliquée (`submitAnswer` vs `handleAnsweringTimeout`).
- Logique CORS dupliquée et **divergente** entre Socket.IO et middleware HTTP.

## P1-3 · Logique métier dans le handler au lieu des models 🟠 (M)
`SocketHandler.ts:321-343` etc. → déplacer vers `Round` : `fillMissingAnswers()`, `getRespondingPlayers()`, `getGuessTargets()` (le `guessMyAnswerMode ? players : players.filter(!=leader)` est répété 4×), `prepareGuessing()`.

## P1-4 · `GameManager` mélange dépôt de questions + factory de Game 🟠 (M)
Extraire `data/questionsRepository.ts` (pools, `loadThemesMeta`, `getDecksCatalog`, `getRandomQuestions`, `sanitizeSelectedDecks`…). Casse aussi la dépendance circulaire `Lobby.ts → GameManager.ts`.

## P1-5 · `buildRevealResults` réimplémente `getGuessingAnswers` (couplage par index) 🟠 (M)
`SocketHandler.ts:91-97` — fragile. **Note** : la vérif a confirmé que les index *s'alignent actuellement*, donc pas de bug vivant, mais toute modif d'un côté désaligne. **Fix** : appeler `round.getGuessingAnswers()` au lieu de reconstruire.

## P1-6 · Fichiers frontend trop longs (plans de découpage)
| Fichier | Lignes | Découpage proposé |
|---|---|---|
| `Lobby.tsx` 🔴 | 794 | hooks `useLobbyIdentity` / `useShareInvite` / `useLobbyState` + composants `<LobbySettingsPanel>` `<LobbyPlayersGrid>` `<LobbyTabs>` → cible <300 |
| `RevealPhase.tsx` 🔴 | 642 | hook `useRevealCursor` (machine d'état + 5 listeners) + 4 sous-vues `reveal/*` → dispatcher ~60 lignes |
| `QuestionSelection.tsx` 🔴 | 543 | composant `CardHand` + hook `useSwipe` (réutilisable dans `HowToPlayCarousel`) |
| `EndGame.tsx` 🟠 | 721 | sous-composants podium / stats / partage |
| `admin/Content.tsx` 🟠 | 696 | 6 sections autonomes → fichiers |
| `admin/Tickets.tsx` 🟠 | 693 | `TicketCard` / `TicketDetailModal` / `TicketsPanel` + hook CRUD bulk |
| `ThemePickerModal.tsx` 🟠 | 316 | séparer logique métier / rendu |

## P1-7 · Duplication frontend extractible 🟠 (M)
- **Shell de modale copié 3×** avec comportements **divergents** : `Modal`/`InfoModal`/`ConfirmModal` ne lockent PAS le scroll body et ne ferment PAS sur Escape (contrairement à `ThemePickerModal`). → `ModalShell` (+ `type="button"` manquants). Bug UX mobile réel (contenu scrollable derrière la modale).
- **Câblage socket emit+listen dupliqué dans 5 composants de phase** → hook `usePhaseSocket`.
- Logique **"pilier : handleTimerExpire → timerExpired"** dupliquée dans 5 phases.
- **Pattern admin** load+isLoading+try/catch+showToast répété dans chaque panel → hook `useAdminResource`.
- Zone de saisie **"carnet"** (textarea papier + bouton) dupliquée `AnswerPhase` ↔ `SubstituteAnsweringPhase`.
- Logique **RAF** dupliquée `Timer` ↔ `HourglassTimer`.
- Handlers `kicked`/`lobbyClosed` dupliqués `Lobby` ↔ `Game`.
- Carte illustration-emoji dupliquée `GameModeModal` ↔ `ThemePickerModal`.
- Score d'équipe (pct) recalculé au front, **incohérent** avec le scoring backend (`EndGame.tsx:138-148`).

## P1-8 · Type-safety
- Payloads d'events socket **ré-déclarés inline** au lieu d'être dérivés du contrat shared → drift silencieux. Exposer des alias `type X = Parameters<ServerToClientEvents['ev']>[0]`.
- `timerEnd` typé `Date` mais sérialisé en **string** sur le wire → typer `number` (epoch ms) ou retirer du type public.

---

# P2 — Nettoyage (code mort + doc-drift)

## P2-1 · Code mort confirmé (23 items, vérifiés adversarialement)
**Frontend**
- `index.css` : **16 classes d'animation jamais utilisées** (~150 lignes) ; `.surface-notebook` (pourtant documentée dans CLAUDE.md) ; token `--color-cream-warm` + alias `gradient-start/end` ; utilities `safe-pl/pr/mb/mt`.
- `studio/shared.ts` : exports `PILL`, `PILL_BTN`, `CLUSTER` ; champ `SlotRuntimeState.playerName` propagé mais jamais lu.
- `RevealPhase.tsx` : props `question` et `card` mortes ; champs `correctedScore`/`leaderboard` du payload `similarityConfirmed` ignorés.
- `PlayerAnswerCard.tsx` : props `pulse`/`heading` inutilisées.
- `useSyncedTimer.ts` : `reset()` et `isRunning` jamais consommés.
- `constants/game.ts` : `DEBUG_MODE`, `DEFAULT_CATEGORY_COLOR` (exports superflus).
- `admin/Dashboard.tsx` : `jumpToTickets` **ignore ses arguments** `status`/`type` (filtrage depuis l'Overview jamais implémenté — `TicketsPanel` n'accepte aucune prop de filtre).
- `i18n/dictionary.ts` : clé `report.questionReportLabel` morte (doublon de `phases.questionSelection.reportQuestion`).

**Shared**
- Types `RoundData`, `RoundStat`, `GameConstants` définis mais jamais utilisés.

**Backend**
- `TestHelper.ts` : fichier orphelin, désynchronisé de l'API actuelle (`createPlayers`, `startGameWithPlayers`).
- `logger.ts` : `logger.socket.event` jamais appelé.
- `LobbyManager.ts` : `cleanupInactiveLobbies` exporté mais usage interne seulement.
- `similarity.ts` : `normalizeAnswer`, `levenshteinDistance` exportés inutilement.
- `IGame.ts` : re-exports inutilisés.
- `tsconfig.base.json` : `experimentalDecorators`/`emitDecoratorMetadata` activés sans aucun décorateur.

> ⚠️ Écartés par la vérif (NE PAS supprimer) : paramètre `locale` de `getRandomQuestions` (gardé pour API).

## P2-2 · Feature fantôme "relance de cartes" 🟠 ✅
`isRelance` entièrement implémenté backend (limite, exclusion doublons, `relancesUsed`) + affiché dans l'admin ("Relances par carte"), mais **plus aucun bouton frontend** ne l'émet (retiré lors du refacto `c08a8c19`).
**Décision produit** : soit recâbler un bouton "Nouvelles cartes" dans `QuestionSelection`, soit supprimer la branche morte + l'affichage admin.

## P2-3 · `error.code` du contrat jamais honoré 🟡
`socket-events.ts:249` déclare `code?` mais le backend ne l'émet jamais ; le front discrimine sur le **texte localisé** (fragile, déjà du code mort dans `Lobby.tsx`).
**Fix** : émettre des codes stables (`LOBBY_NOT_FOUND`, `RATE_LIMITED`) et router dessus.

## P2-4 · Doc-drift CLAUDE.md (à corriger pour garder la doc fiable) ✅
- Section "Questions deck" périmée : parle de `questions.json` (inexistant) ; les vrais fichiers sont `questions_fr.json` + `questions_en.json` + `themes.json`.
- Nom du xlsx faux : `Onskoné_Questions_Structurées_2604.xlsx` → réel `Onskoné_2405.xlsx`.
- Routing : `Lobby/Game/EndGame` sont **aussi** lazy (pas seulement Admin) ; routes `/privacy` et `/mentions` non documentées.
- `pnpm typecheck`/`lint` documentés comme checks → en réalité no-op (cf. P0-1).
- `pnpm build` (recursive) ne build PAS le backend (pas de script) ; `pnpm dev` ne lance PAS `shared` en watch (pas de script `dev` dans shared).
- `StudioGallery.tsx` → réel `pages/studio/Gallery.tsx`.
- `TIERS` : dans `constants/tiers.ts` (pas EndGame.tsx), **6 paliers** (pas 5), le 6e = violet Onskoné.

## P2-5 · Config divers
- 2 `package-lock.json` npm parasites versionnés dans un monorepo pnpm → `git rm`.
- `pnpm-lock.yaml` est **gitignoré** → builds non reproductibles. Le versionner (sauf intention contraire).
- `@types/express@5` vs `express@4` → rétrograder en `@types/express@^4.17`.
- `@types/react-router-dom@5` redondant avec react-router v7 → supprimer.

---

# P3 — Améliorations (nice-to-have)
- **Tests frontend : zéro** (101 fichiers source). Ajouter Vitest + Testing Library ; prioriser les utils à risque : `studioStorage` (namespacing par slot), `getServerUrl` (branches natif/LAN), `shareCard`, similarité.
- Prettier + `.prettierrc` partagé.
- Clé de timer `${lobbyCode}_${playerName}` → baser sur `player.id` (UUID stable) plutôt que le nom (à faire dans `ConnectionRegistry`).
- Accessibilité : `aria-label` manquants (menus icônes), `dangerouslySetInnerHTML` sur contenu i18n (statique aujourd'hui, à documenter/migrer en ReactNode).
- `IPlayer.socketId` diffusé à tous → envisager `IPlayer.id` pour l'auto-identification front.

---

# Cas écartés par la vérification adversariale (NON-bugs — pour mémoire)
La vérif a réfuté 6 findings, évitant des "corrections" inutiles :
- **Collision de slot deux joueurs même nom** : impossible — deux `Player` d'ids différents ne peuvent pas coexister avec le même nom dans `lobby.players`.
- **`leaveLobby`/`kick` n'annulent pas les timeouts d'autres joueurs** : états inatteignables ou déjà gardés.
- **Désync inactif(5s)/leader-skip(15s)** : observation factuelle juste mais pas de bug logique exploitable.
- **pct d'équipe compte les bonus de similarité** : dédupliqué par slot, pas de dépassement du dénominateur.
- **"Deadlock systémique sans timer serveur"** : borné par le filet leader-disconnect 15s sur vraie coupure (le vrai trou résiduel = pilier throttlé sans déconnexion, cf. P0-3f).
