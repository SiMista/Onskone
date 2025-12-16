# Déploiement Cloud - Onskone

## Option 1 : Render (Gratuit)

### Étape 1 : Préparer le projet

Le projet doit être sur GitHub. Si ce n'est pas déjà fait :

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Étape 2 : Créer un compte Render

1. Va sur [render.com](https://render.com)
2. Clique sur "Get Started for Free"
3. Connecte-toi avec GitHub

### Étape 3 : Déployer le Backend

1. Dashboard → **New** → **Web Service**
2. Connecte ton repo GitHub `onskone`
3. Configure :

| Champ | Valeur |
|-------|--------|
| Name | `onskone-backend` |
| Region | Frankfurt (EU) |
| Root Directory | ⚠️ **Laisser vide** (racine du projet) |
| Runtime | Node |
| Build Command | `npm install -g pnpm && pnpm install && pnpm run build:shared` |
| Start Command | `cd backend && npm start` |
| Instance Type | **Free** |

4. Ajoute les variables d'environnement :

| Variable | Valeur |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |

5. Clique **Create Web Service**

⏳ Attends que le déploiement soit terminé (~5 min)

📝 **Note l'URL du backend** (ex: `https://onskone-backend.onrender.com`)

### Étape 4 : Déployer le Frontend

1. Dashboard → **New** → **Static Site**
2. Connecte le même repo GitHub
3. Configure :

| Champ | Valeur |
|-------|--------|
| Name | `onskone-frontend` |
| Root Directory | ⚠️ **Laisser vide** (racine du projet) |
| Build Command | `npm install -g pnpm && pnpm install && pnpm run build:shared && cd frontend && pnpm run build` |
| Publish Directory | `frontend/dist` |

4. Ajoute les variables d'environnement :

| Variable | Valeur |
|----------|--------|
| `VITE_SERVER_URL` | `https://onskone-backend.onrender.com` (ton URL backend) |
| `VITE_CONTACT_EMAIL` | `onskonelejeu@gmail.com` |

5. Clique **Create Static Site**

### Étape 5 : Tester

Une fois déployé, ton site sera accessible à :
`https://onskone-frontend.onrender.com`

⚠️ **Rappel** : Sur le plan gratuit, le backend s'éteint après 15min d'inactivité. Premier chargement = ~30s d'attente.

---

## Option 2 : Railway (5$ crédits offerts)

### Étape 1 : Créer un compte Railway

1. Va sur [railway.app](https://railway.app)
2. Clique sur "Start a New Project"
3. Connecte-toi avec GitHub

### Étape 2 : Créer un nouveau projet

1. **New Project** → **Empty Project**
2. Tu arrives sur un projet vide

### Étape 3 : Déployer le Backend

1. Clique **+ New** → **GitHub Repo**
2. Sélectionne ton repo `onskone`
3. Railway détecte le monorepo. Configure :

Clique sur le service créé, puis **Settings** :

| Champ | Valeur |
|-------|--------|
| Root Directory | ⚠️ **Laisser vide** |
| Build Command | `corepack enable && pnpm install && pnpm run build:shared` |
| Start Command | `cd backend && pnpm start` |

4. Va dans **Variables** et ajoute :

| Variable | Valeur |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |

5. Va dans **Settings** → **Networking** → **Generate Domain**

📝 **Note l'URL** (ex: `onskone-backend-production.up.railway.app`)

### Étape 4 : Déployer le Frontend

1. Dans le même projet, clique **+ New** → **GitHub Repo**
2. Sélectionne encore ton repo `onskone`
3. Configure dans **Settings** :

| Champ | Valeur |
|-------|--------|
| Root Directory | ⚠️ **Laisser vide** |
| Build Command | `corepack enable && pnpm install && pnpm run build:shared && cd frontend && pnpm run build` |
| Start Command | `cd frontend && npx serve dist -s -l 3000` |

4. Va dans **Variables** et ajoute :

| Variable | Valeur |
|----------|--------|
| `VITE_SERVER_URL` | `https://ton-backend.up.railway.app` |
| `VITE_CONTACT_EMAIL` | `onskonelejeu@gmail.com` |

5. Va dans **Settings** → **Networking** → **Generate Domain**

### Étape 5 : Tester

Ton site est accessible à l'URL générée pour le frontend.

---

## Comparatif final

| Critère | Render (Free) | Railway (Trial) |
|---------|---------------|-----------------|
| Coût | 0€ | 5$ offerts puis payant |
| Cold start | ~30-50s | Non |
| Durée gratuite | Illimitée | ~2-3 semaines |
| Difficulté | ⭐⭐ | ⭐⭐ |
| WebSockets | ✅ | ✅ |

---

## Troubleshooting

### Erreur "Cannot find module '@onskone/shared'"

Le build du shared n'a pas fonctionné. Vérifie que le Build Command inclut bien :
```
cd ../shared && npm install && npm run build && cd ../backend
```

### WebSocket ne se connecte pas

1. Vérifie que `VITE_SERVER_URL` pointe vers la bonne URL backend
2. L'URL doit être en `https://` (pas `http://`)
3. Vérifie les logs du backend sur Render/Railway

### Le frontend affiche une page blanche

Vérifie que le Publish Directory est bien `dist` (pas `build` ou autre).

### Render : "Service suspended"

Tu as dépassé les 750h gratuites du mois (peu probable) ou il y a une erreur. Check les logs.

---

## Script de préparation (optionnel)

Si tu veux t'assurer que le projet build correctement avant de push :

```bash
# À la racine du projet
pnpm install
pnpm run build:shared
cd frontend && pnpm run build && cd ..
cd backend && pnpm install && cd ..
echo "✅ Build OK - Ready to deploy"
```

---

## Conseil

1. **Commence par Render** pour tester gratuitement
2. Si le cold start te gêne trop, passe sur **Railway** (payant)
3. Pour un vrai lancement, utilise le **VPS** avec ton ami

Bonne chance ! 🚀
