# Guide de Déploiement VPS - Onskone

## Prérequis

- Un VPS Ubuntu 22.04 LTS (Hostinger, OVH, Hetzner, DigitalOcean...)
- Un nom de domaine (optionnel mais recommandé)
- Accès SSH au serveur

---

## 1. Connexion initiale au VPS

```bash
# Depuis ton PC (remplace IP_DU_SERVEUR)
ssh root@IP_DU_SERVEUR
```

---

## 2. Sécurisation de base

### Créer un utilisateur (ne pas rester en root)

```bash
# Créer un utilisateur
adduser onskone

# Lui donner les droits sudo
usermod -aG sudo onskone

# Se connecter avec ce compte
su - onskone
```

### Configurer le firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

---

## 3. Installer Node.js (v20 LTS)

```bash
# Installer nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Recharger le terminal
source ~/.bashrc

# Installer Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Vérifier
node -v  # Devrait afficher v20.x.x
npm -v
```

---

## 4. Installer pnpm

```bash
npm install -g pnpm
pnpm -v
```

---

## 5. Installer PM2 (Process Manager)

```bash
npm install -g pm2
```

---

## 6. Installer Nginx

```bash
sudo apt update
sudo apt install nginx -y

# Vérifier que Nginx fonctionne
sudo systemctl status nginx
```

---

## 7. Installer Git et cloner le projet

```bash
sudo apt install git -y

# Créer un dossier pour les apps
mkdir -p ~/apps
cd ~/apps

# Cloner ton repo (remplace par ton URL)
git clone https://github.com/TON_USERNAME/onskone.git
cd onskone
```

---

## 8. Build du projet

```bash
# Installer les dépendances
pnpm install

# Build le package shared
pnpm run build:shared

# Build le frontend
cd frontend
pnpm run build
cd ..

# Build le backend (si nécessaire, sinon juste installer)
cd backend
pnpm install
cd ..
```

---

## 9. Configuration du Backend

### Créer le fichier d'environnement

```bash
cd ~/apps/onskone/backend
nano .env
```

Contenu du fichier `.env` :

```env
PORT=8080
NODE_ENV=production
```

### Lancer le backend avec PM2

```bash
cd ~/apps/onskone/backend

# Démarrer avec PM2
pm2 start src/index.ts --name "onskone-backend" --interpreter ~/.nvm/versions/node/v20.*/bin/npx -- ts-node

# OU si tu as un script start dans package.json
pm2 start npm --name "onskone-backend" -- start

# Sauvegarder la config PM2 (redémarrage auto)
pm2 save
pm2 startup
# Copie et exécute la commande affichée
```

### Vérifier que le backend tourne

```bash
pm2 status
pm2 logs onskone-backend
```

---

## 10. Configuration Nginx

### Créer la config du site

```bash
sudo nano /etc/nginx/sites-available/onskone
```

**Sans nom de domaine (IP uniquement) :**

```nginx
server {
    listen 80;
    server_name _;  # Accepte toutes les requêtes

    # Frontend (fichiers statiques)
    root /home/onskone/apps/onskone/frontend/dist;
    index index.html;

    # Gestion du routing React (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy vers le backend API + WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts pour WebSocket
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

**Avec nom de domaine (ex: onskone.fr) :**

```nginx
server {
    listen 80;
    server_name onskone.fr www.onskone.fr;

    root /home/onskone/apps/onskone/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

### Activer le site

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/onskone /etc/nginx/sites-enabled/

# Supprimer le site par défaut
sudo rm /etc/nginx/sites-enabled/default

# Tester la config
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx
```

---

## 11. Configuration du Frontend pour la production

### Modifier la connexion Socket.io

Dans `frontend/src/constants/game.ts`, la fonction `getServerUrl()` doit pointer vers ton serveur :

```typescript
const getServerUrl = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // En production, utiliser le même domaine (Nginx fait le proxy)
  return window.location.origin;
};
```

### Créer le fichier .env pour le frontend (avant le build)

```bash
cd ~/apps/onskone/frontend
nano .env.production
```

```env
VITE_CONTACT_EMAIL=ton@email.com
# VITE_SERVER_URL n'est pas nécessaire si même domaine
```

### Rebuild le frontend

```bash
cd ~/apps/onskone/frontend
pnpm run build
```

---

## 12. SSL avec Let's Encrypt (HTTPS)

**Seulement si tu as un nom de domaine**

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtenir le certificat (remplace par ton domaine)
sudo certbot --nginx -d onskone.fr -d www.onskone.fr

# Renouvellement automatique (déjà configuré)
sudo certbot renew --dry-run
```

---

## 13. Mettre à jour le projet

Script de déploiement à créer :

```bash
nano ~/apps/onskone/deploy.sh
```

```bash
#!/bin/bash
cd ~/apps/onskone

echo "📥 Pulling latest changes..."
git pull origin main

echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Building shared..."
pnpm run build:shared

echo "🎨 Building frontend..."
cd frontend && pnpm run build && cd ..

echo "🔄 Restarting backend..."
pm2 restart onskone-backend

echo "✅ Deployment complete!"
```

```bash
chmod +x ~/apps/onskone/deploy.sh
```

Pour déployer une mise à jour :

```bash
~/apps/onskone/deploy.sh
```

---

## 14. Commandes utiles

```bash
# Voir les logs du backend
pm2 logs onskone-backend

# Redémarrer le backend
pm2 restart onskone-backend

# Voir le statut
pm2 status

# Redémarrer Nginx
sudo systemctl restart nginx

# Voir les logs Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 15. Checklist finale

- [ ] VPS créé et accessible en SSH
- [ ] Utilisateur non-root créé
- [ ] Firewall configuré (ports 22, 80, 443)
- [ ] Node.js 20 installé
- [ ] pnpm installé
- [ ] PM2 installé et configuré au démarrage
- [ ] Projet cloné et buildé
- [ ] Backend lancé avec PM2
- [ ] Nginx configuré avec proxy WebSocket
- [ ] DNS pointant vers l'IP du VPS (si domaine)
- [ ] SSL activé (si domaine)
- [ ] Test du jeu complet (création lobby, join, game)

---

## Dépannage courant

### Le WebSocket ne se connecte pas

1. Vérifier que le backend tourne : `pm2 status`
2. Vérifier les logs : `pm2 logs onskone-backend`
3. Vérifier la config Nginx : `sudo nginx -t`
4. Vérifier le firewall : `sudo ufw status`

### Erreur 502 Bad Gateway

Le backend ne répond pas :
```bash
pm2 restart onskone-backend
pm2 logs onskone-backend
```

### Erreur de permissions

```bash
# Si problème de permissions sur les fichiers
sudo chown -R onskone:onskone ~/apps/onskone
```

### Le frontend affiche une page blanche

Vérifier que le build existe :
```bash
ls ~/apps/onskone/frontend/dist
```

Si vide, rebuild :
```bash
cd ~/apps/onskone/frontend && pnpm run build
```

---

## Architecture finale

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│           Nginx (port 80/443)       │
│  ┌─────────────────────────────┐    │
│  │  /  → frontend/dist (static)│    │
│  │  /socket.io/ → :8080 (proxy)│    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│     Node.js Backend (port 8080)     │
│         géré par PM2                │
└─────────────────────────────────────┘
```

---

**Bonne chance ! 🚀**
