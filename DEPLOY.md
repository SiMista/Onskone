# Déploiement Onskoné (CI/CD)

Pipeline **GitHub Actions** → **VPS Debian** (`51.254.130.224`).
Modèle : **CI** (build + tests) sur chaque push, puis **CD par `git pull` sur le serveur**
(le VPS récupère le code et build lui-même ; aucun artefact n'est committé, le backend
tourne en `tsx` sans build).

```
push main ──▶ GitHub Actions
                ├─ CI : pnpm install · build shared · typecheck · tests back+front · build front
                └─ CD : SSH (clé) ──▶ onskone@VPS : git reset --hard origin/main
                                                     └─ scripts/deploy.sh
                                                        (pnpm install · build shared · build front · pm2 reload)
VPS : nginx :80 ──▶ Node :8080 (sert le front statique + Socket.IO + /api)
```

---

## ⚠️ 0. Sécurité — à faire MAINTENANT

Les mots de passe SSH ont été partagés en clair : considère-les **compromis**.
- Connecte-toi et change-les : `passwd` (pour `debian` **et** `onskone`).
- La pipeline n'utilise **aucun mot de passe** : uniquement une **clé SSH dédiée** (étape 3).
- Une fois les clés en place, désactive l'auth par mot de passe SSH :
  `sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && sudo systemctl restart ssh`
- Mets un **nouvel** `ADMIN_PASSWORD` (différent du SSH) dans `backend/.env` (étape 2c).

---

## 1. Bootstrap du serveur — paquets (à faire une fois, compte `debian`/sudo)

```bash
# Node 22 + outils de build (better-sqlite3 est natif → build-essential + python3)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3 git nginx

# pnpm + pm2 en global (dans le PATH de tous les users)
sudo npm install -g pnpm@10 pm2

# Pare-feu : autoriser SSH + HTTP + HTTPS (si ufw est actif)
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp || true
```

> VPS à faible RAM : `vite build` peut manquer de mémoire. Ajoute un swap si besoin :
> `sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`

---

## 2. Bootstrap de l'app (compte `onskone`)

### 2a. Clé de déploiement (serveur → GitHub, lecture seule)
```bash
ssh-keygen -t ed25519 -C "onskone-deploy" -f ~/.ssh/onskone_deploy -N ""
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/onskone_deploy
  IdentitiesOnly yes
EOF
cat ~/.ssh/onskone_deploy.pub
```
→ Copie cette clé publique dans **GitHub → repo `SiMista/Onskone` → Settings → Deploy keys → Add deploy key** (laisse "Allow write access" **décoché**).

### 2b. Clone
```bash
git clone git@github.com:SiMista/Onskone.git ~/Onskone
cd ~/Onskone
```

### 2c. Variables d'environnement
```bash
cp backend/.env.example backend/.env
# Renseigne ADMIN_PASSWORD (nouveau, fort) et ADMIN_TOKEN_SECRET :
openssl rand -hex 32      # colle le résultat dans ADMIN_TOKEN_SECRET
nano backend/.env
```

### 2d. Premier déploiement + démarrage pm2
```bash
bash scripts/deploy.sh        # install + build shared + build front + pm2 start
pm2 startup                   # affiche UNE commande `sudo ...` → exécute-la (compte debian) une fois
pm2 save                      # pour redémarrer l'app après un reboot du serveur
```

---

## 3. nginx + HTTPS (compte `debian`/sudo) — domaine `onskone.fr`

**Prérequis DNS** : un enregistrement **A** `onskone.fr → 51.254.130.224` (et un `A` ou `CNAME`
pour `www` si tu veux le www). Vérifie : `dig +short onskone.fr` doit renvoyer l'IP.

```bash
# 1) Reverse-proxy HTTP (port 80)
sudo cp ~/Onskone/deploy/nginx-onskone.conf /etc/nginx/sites-available/onskone
sudo ln -sf /etc/nginx/sites-available/onskone /etc/nginx/sites-enabled/onskone
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx       # le site répond sur http://onskone.fr

# 2) Certificat TLS Let's Encrypt (réécrit la conf pour ajouter le 443 + redirection 80->443)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d onskone.fr                 # ajoute -d www.onskone.fr si DNS www présent
```
certbot installe le renouvellement auto (timer systemd). → Le site répond en **https://onskone.fr**
(Socket.IO en `wss://` sécurisé).

> `backend/.env` doit contenir `ALLOWED_ORIGINS=https://onskone.fr` (c'est déjà la valeur par
> défaut du `.env.example`). Après toute modif du `.env` : `pm2 reload onskone`.

---

## 4. Secrets GitHub (clé Actions → serveur)

Sur **ta machine** (ou n'importe où), génère une paire dédiée à la CI :
```bash
ssh-keygen -t ed25519 -C "github-actions-onskone" -f onskone_ci -N ""
```
- **Clé publique** (`onskone_ci.pub`) → ajoute-la sur le serveur :
  `ssh-copy-id -i onskone_ci.pub onskone@51.254.130.224`
  (ou colle son contenu dans `onskone@VPS:~/.ssh/authorized_keys`)
- **Clé privée** (`onskone_ci`) → **GitHub → repo → Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|---|---|
| `SSH_HOST` | `51.254.130.224` |
| `SSH_USER` | `onskone` |
| `SSH_PRIVATE_KEY` | contenu **entier** du fichier `onskone_ci` (clé privée) |

Puis supprime `onskone_ci`/`onskone_ci.pub` de ta machine.

---

## 5. Ça tourne

- **Auto** : chaque `git push` sur `main` → CI ; si verte → déploiement automatique.
- **Manuel sur le serveur** :
  ```bash
  cd ~/Onskone && git pull && bash scripts/deploy.sh
  ```
- **Logs / état** : `pm2 logs onskone` · `pm2 status`
- **Rollback** :
  ```bash
  cd ~/Onskone && git reset --hard <sha-précédent> && bash scripts/deploy.sh
  ```

> ⚠️ La CI verte garantit le build/les types/les tests unitaires, **pas** que le jeu se joue
> correctement (peu de tests runtime sur le gameplay). Valide une partie via le Studio
> avant de pousser sur `main`, surtout après les refactors récents (timers, reveal).
