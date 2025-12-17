# Guide de Déploiement VPS - Onskone

## Prérequis

- Un VPS Ubuntu 24.04 LTS ou Debian 12 (OVH, Hostinger, Hetzner, DigitalOcean...)
- Un nom de domaine (optionnel mais recommandé pour HTTPS)
- Accès SSH au serveur

---

## Utilisateurs

Ce guide utilise **2 utilisateurs** :

| Utilisateur | Rôle | Commandes |
|-------------|------|-----------|
| `debian` | Admin du serveur | `sudo`, firewall, nginx, installations système |
| `onskone` | Application | clone, build, pm2 (faire tourner l'app) |

**Pourquoi 2 utilisateurs ?**
C'est une bonne pratique de sécurité. Si l'application est piratée, le hacker n'aura accès qu'à `onskone` (limité), pas à `debian` (admin complet).

> Les sections sont marquées **[debian]** ou **[onskone]** pour savoir quel utilisateur utiliser.

---

## 1. Connexion initiale [debian]

**But** : Se connecter à votre serveur distant depuis votre PC.

Après l'achat du VPS, OVH vous envoie par email :
- L'adresse IP du serveur
- Le nom d'utilisateur (`debian` ou `ubuntu`)
- Le mot de passe initial

```bash
# Depuis votre PC Windows (Terminal ou PowerShell)
ssh debian@IP_DU_SERVEUR
```

> **Explication** : `ssh` (Secure Shell) permet de se connecter à un ordinateur distant de manière sécurisée. C'est comme ouvrir un terminal sur votre VPS depuis votre PC.

---

## 2. Mise à jour du système [debian]

**But** : Mettre à jour tous les logiciels du serveur pour avoir les dernières versions et correctifs de sécurité.

```bash
sudo apt update && sudo apt upgrade -y
```

> **Explication** :
> - `sudo` = "super user do", exécute la commande en tant qu'administrateur
> - `apt` = gestionnaire de paquets (logiciels) sur Debian/Ubuntu
> - `update` = télécharge la liste des mises à jour disponibles
> - `upgrade` = installe les mises à jour
> - `-y` = répond "oui" automatiquement aux questions
> - `&&` = exécute la 2ème commande seulement si la 1ère réussit

---

## 3. Créer l'utilisateur onskone [debian]

**But** : Créer un utilisateur dédié à l'application, pour isoler l'app du reste du système.

```bash
# Créer l'utilisateur
sudo adduser onskone
```

> Entrez un mot de passe (ex: `onskone123`), puis appuyez sur `Enter` pour les autres questions (nom complet, etc.).

```bash
# Lui donner les droits sudo
sudo usermod -aG sudo onskone
```

> **Explication** :
> - `adduser` = crée un nouvel utilisateur avec son dossier personnel (`/home/onskone`)
> - `usermod` = modifie un utilisateur existant
> - `-aG sudo` = l'ajoute au groupe `sudo` (administrateurs)

---

## 4. Configurer le firewall [debian]

**But** : Protéger le serveur en n'autorisant que les connexions nécessaires (SSH, web).

```bash
# Installer UFW (Uncomplicated Firewall)
sudo apt install ufw -y
```

> **Explication** : UFW est un pare-feu simple. Il bloque toutes les connexions sauf celles qu'on autorise explicitement.

```bash
# Autoriser SSH (pour ne pas perdre l'accès !)
sudo ufw allow OpenSSH

# Autoriser HTTP (site web normal)
sudo ufw allow 80

# Autoriser HTTPS (site web sécurisé)
sudo ufw allow 443

# Activer le firewall
sudo ufw enable

# Vérifier que tout est bon
sudo ufw status
```

> **Explication des ports** :
> - Port 22 (SSH) = connexion à distance au serveur
> - Port 80 (HTTP) = site web non sécurisé
> - Port 443 (HTTPS) = site web sécurisé (avec cadenas)

---

## 5. Installer Nginx [debian]

**But** : Installer le serveur web qui va servir votre site aux visiteurs.

```bash
sudo apt install nginx -y
```

> **Explication** : Nginx (prononcé "engine-x") est un serveur web très performant. Il va :
> - Servir les fichiers du frontend (HTML, CSS, JS)
> - Rediriger les requêtes WebSocket vers le backend

```bash
# Vérifier que Nginx fonctionne
sudo systemctl status nginx
```

> Appuyez sur `q` pour quitter cet écran.

---

## 6. Installer Git [debian]

**But** : Installer Git pour pouvoir télécharger votre code depuis GitHub.

```bash
sudo apt install git -y
```

> **Explication** : Git est un outil de versioning. Il permet de télécharger (`clone`) votre code depuis GitHub vers le serveur.

---

## 7. Basculer vers l'utilisateur onskone [debian → onskone]

**But** : Changer d'utilisateur pour faire les tâches liées à l'application.

```bash
su - onskone
```

> **Explication** :
> - `su` = "switch user" (changer d'utilisateur)
> - `-` = charge l'environnement complet de l'utilisateur (son dossier, ses variables)

Vous verrez le prompt changer :
```
onskone@vps-xxxxx:~$
```

> **À partir de maintenant, toutes les commandes sont en tant que `onskone`** jusqu'à indication contraire.

---

## 8. Installer Node.js [onskone]

**But** : Installer Node.js, le moteur qui fait tourner votre backend JavaScript/TypeScript.

```bash
# Télécharger et installer nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

> **Explication** :
> - `curl` = télécharge un fichier depuis internet
> - `|` = envoie le contenu téléchargé à la commande suivante
> - `bash` = exécute le script téléchargé
> - `nvm` = outil qui permet d'installer et gérer plusieurs versions de Node.js

```bash
# Recharger la configuration du terminal
source ~/.bashrc
```

> **Explication** : Le script nvm a modifié votre fichier de config (`~/.bashrc`). Cette commande recharge ce fichier pour que `nvm` soit disponible.

```bash
# Installer Node.js version 20 (LTS = Long Term Support)
nvm install 20

# Utiliser cette version
nvm use 20

# La définir comme version par défaut
nvm alias default 20
```

```bash
# Vérifier que ça marche
node -v   # Doit afficher v20.x.x
npm -v    # npm est installé avec Node.js
```

> **Explication** :
> - `node` = le moteur JavaScript
> - `npm` = gestionnaire de paquets pour installer des librairies JavaScript

---

## 9. Installer pnpm et PM2 [onskone]

**But** : Installer les outils nécessaires pour gérer les dépendances et faire tourner l'app.

```bash
npm install -g pnpm pm2
```

> **Explication** :
> - `-g` = installation globale (disponible partout, pas juste dans un projet)
> - `pnpm` = gestionnaire de paquets plus rapide que npm (utilisé par votre projet)
> - `pm2` = process manager, garde votre app en vie 24/7 et la redémarre si elle crashe

```bash
# Vérifier
pnpm -v
pm2 -v
```

---

## 10. Cloner le projet [onskone]

**But** : Télécharger le code de votre projet depuis GitHub vers le serveur.

```bash
# Créer un dossier pour vos applications
mkdir -p ~/apps
```

> **Explication** :
> - `mkdir` = créer un dossier
> - `-p` = crée les dossiers parents si nécessaire
> - `~` = raccourci pour `/home/onskone` (votre dossier personnel)

```bash
cd ~/apps
```

> **Explication** : `cd` = "change directory", se déplacer dans un dossier

```bash
# Cloner le repo (REMPLACEZ par votre URL GitHub)
git clone https://github.com/TON_USERNAME/onskone.git
cd onskone
```

> **Explication** : `git clone` télécharge tout le code du repository GitHub dans un dossier `onskone`.

---

## 11. Build du projet [onskone]

**But** : Installer les dépendances et compiler le code pour la production.

```bash
cd ~/apps/onskone

# Installer toutes les dépendances (librairies externes)
pnpm install
```

> **Explication** : `pnpm install` lit le fichier `package.json` et télécharge toutes les librairies nécessaires.

```bash
# Compiler le package shared (types partagés entre frontend et backend)
pnpm run build:shared
```

```bash
# Compiler le frontend (React → HTML/CSS/JS optimisés)
cd frontend
pnpm run build
cd ..
```

> **Explication** : Le "build" transforme votre code React en fichiers statiques optimisés pour la production. Ils seront dans le dossier `frontend/build`.

---

## 12. Configurer le Backend [onskone]

**But** : Configurer et lancer le serveur backend.

### Créer le fichier .env

```bash
cd ~/apps/onskone/backend
nano .env
```

> **Explication** : `nano` est un éditeur de texte dans le terminal. Le fichier `.env` contient les variables d'environnement (configuration).

Contenu à écrire :
```env
PORT=8080
NODE_ENV=production
```

> **Explication** :
> - `PORT=8080` = le backend écoutera sur le port 8080
> - `NODE_ENV=production` = active les optimisations de production

> **Pour sauvegarder** : `Ctrl+X`, puis `Y` (yes), puis `Enter`.

### Lancer le backend avec PM2

```bash
cd ~/apps/onskone/backend

# Démarrer l'application avec PM2
pm2 start npx --name "onskone-backend" -- tsx src/index.ts
```

> **Explication** :
> - `pm2 start` = lance une application en arrière-plan
> - `--name "onskone-backend"` = donne un nom pour identifier l'app
> - `npx tsx` = exécute TypeScript directement
> - PM2 va garder l'app en vie et la redémarrer si elle crashe

```bash
# Vérifier que ça tourne
pm2 status
pm2 logs onskone-backend
```

> **Explication** :
> - `pm2 status` = affiche toutes les apps gérées par PM2
> - `pm2 logs` = affiche les logs (messages) de l'app

```bash
# Configurer le démarrage automatique (après reboot du serveur)
pm2 save
pm2 startup
```

> **IMPORTANT** : La commande `pm2 startup` affiche une commande à copier/coller. **Exécutez-la** pour que PM2 redémarre automatiquement après un reboot.

---

## 13. Revenir à debian pour configurer Nginx [onskone → debian]

**But** : Revenir sur l'utilisateur admin pour configurer le serveur web.

```bash
exit
```

> **Explication** : `exit` ferme la session `onskone` et vous ramène à `debian`.

Vous revenez sur `debian@vps-xxxxx:~$`.

---

## 14. Configurer Nginx [debian]

**But** : Dire à Nginx comment servir votre site et rediriger les WebSockets vers le backend.

### Créer la config du site

```bash
sudo nano /etc/nginx/sites-available/onskone
```

> **Explication** : On crée un fichier de configuration pour notre site dans le dossier des sites Nginx.

**Sans nom de domaine (IP uniquement) :**

```nginx
server {
    listen 80;                    # Écoute sur le port 80 (HTTP)
    server_name _;                # Accepte toutes les requêtes

    # Frontend : servir les fichiers statiques
    root /home/onskone/apps/onskone/frontend/build;
    index index.html;

    # Routing React : renvoie vers index.html pour les routes SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend : proxy les requêtes WebSocket vers le port 8080
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

> **Explication** :
> - `root` = dossier contenant les fichiers du frontend
> - `location /` = règle pour toutes les URLs
> - `try_files` = cherche le fichier demandé, sinon renvoie `index.html` (nécessaire pour React Router)
> - `location /socket.io/` = redirige les WebSockets vers le backend Node.js
> - `proxy_pass` = l'adresse du backend (localhost port 8080)
> - Les headers `Upgrade` et `Connection` sont nécessaires pour WebSocket

**Avec nom de domaine (ex: onskone.fr) :**

```nginx
server {
    listen 80;
    server_name onskone.fr www.onskone.fr;

    root /home/onskone/apps/onskone/frontend/build;
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

> **Pour sauvegarder** : `Ctrl+X`, puis `Y`, puis `Enter`.

### Activer le site

```bash
# Créer un lien symbolique pour activer le site
sudo ln -s /etc/nginx/sites-available/onskone /etc/nginx/sites-enabled/
```

> **Explication** : Nginx lit les configs dans `sites-enabled`. Le lien symbolique pointe vers notre fichier dans `sites-available`.

```bash
# Supprimer le site par défaut de Nginx
sudo rm /etc/nginx/sites-enabled/default
```

```bash
# Vérifier que la config est valide
sudo nginx -t
```

> Si vous voyez "syntax is ok", c'est bon !

```bash
# Redémarrer Nginx pour appliquer les changements
sudo systemctl restart nginx
```

---

## 15. Tester le site [navigateur]

**But** : Vérifier que tout fonctionne.

Ouvrez votre navigateur et allez sur : `http://VOTRE_IP`

Le site devrait s'afficher ! Testez la création d'un salon et le jeu complet.

---

## 16. SSL avec Let's Encrypt [debian] (optionnel)

**But** : Activer HTTPS (cadenas vert) pour sécuriser les connexions.

> **Prérequis** : Vous devez avoir un nom de domaine qui pointe vers l'IP de votre VPS.

```bash
# Installer Certbot (outil pour obtenir des certificats SSL gratuits)
sudo apt install certbot python3-certbot-nginx -y

# Obtenir le certificat (REMPLACEZ par votre domaine)
sudo certbot --nginx -d onskone.fr -d www.onskone.fr

# Tester le renouvellement automatique
sudo certbot renew --dry-run
```

> **Explication** :
> - Let's Encrypt fournit des certificats SSL gratuits
> - Certbot les installe et configure Nginx automatiquement
> - Les certificats expirent après 90 jours mais Certbot les renouvelle automatiquement

---

## 17. Script de mise à jour [onskone]

**But** : Créer un script pour mettre à jour le site facilement.

```bash
su - onskone
nano ~/apps/onskone/deploy.sh
```

Contenu :
```bash
#!/bin/bash
cd ~/apps/onskone

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
pnpm install

echo "Building shared..."
pnpm run build:shared

echo "Building frontend..."
cd frontend && pnpm run build && cd ..

echo "Restarting backend..."
pm2 restart onskone-backend

echo "Deployment complete!"
```

> **Explication** : Ce script automatise la mise à jour :
> 1. Télécharge les dernières modifications depuis GitHub
> 2. Installe les nouvelles dépendances si nécessaire
> 3. Recompile le code
> 4. Redémarre le backend

```bash
# Rendre le script exécutable
chmod +x ~/apps/onskone/deploy.sh
```

> **Explication** : `chmod +x` donne les droits d'exécution au fichier.

Pour déployer une mise à jour :
```bash
~/apps/onskone/deploy.sh
```

---

## Résumé des commandes par utilisateur

### Commandes admin [debian]
```bash
sudo apt update                    # Mises à jour système
sudo ufw status                    # Voir l'état du firewall
sudo systemctl restart nginx       # Redémarrer Nginx
sudo nginx -t                      # Tester la config Nginx
sudo certbot                       # Gérer les certificats SSL
```

### Commandes app [onskone]
```bash
su - onskone                       # Basculer vers onskone
pm2 status                         # Voir les processus
pm2 logs onskone-backend           # Voir les logs de l'app
pm2 restart onskone-backend        # Redémarrer l'app
~/apps/onskone/deploy.sh           # Déployer une mise à jour
exit                               # Revenir à debian
```

---

## Checklist finale

- [ ] VPS accessible en SSH
- [ ] Utilisateur `onskone` créé
- [ ] Firewall configuré (22, 80, 443)
- [ ] Node.js 20 installé (via nvm, sur onskone)
- [ ] pnpm et PM2 installés (sur onskone)
- [ ] Projet cloné et buildé
- [ ] Backend lancé avec PM2
- [ ] Nginx configuré
- [ ] Site accessible via IP
- [ ] SSL activé (si domaine)

---

## Dépannage

### WebSocket ne se connecte pas
```bash
su - onskone
pm2 status              # L'app est-elle "online" ?
pm2 logs onskone-backend  # Y a-t-il des erreurs ?
```

### Erreur 502 Bad Gateway
Le backend ne répond pas :
```bash
su - onskone
pm2 restart onskone-backend
pm2 logs onskone-backend
```

### Erreur de permissions
```bash
# En tant que debian
sudo chown -R onskone:onskone /home/onskone/apps
```

> **Explication** : `chown` change le propriétaire des fichiers. `-R` = récursif (tous les sous-dossiers).

### Page blanche
```bash
ls /home/onskone/apps/onskone/frontend/build
```
Si vide ou erreur :
```bash
su - onskone
cd ~/apps/onskone/frontend && pnpm run build
```

---

## Architecture finale

```
Visiteur (navigateur)
        |
        v
+----------------------------------+
|     Nginx (port 80/443)          |
|  +----------------------------+  |
|  | /           → frontend/build  |  (fichiers statiques)
|  | /socket.io/ → localhost:8080  |  (proxy WebSocket)
|  +----------------------------+  |
+----------------------------------+
                |
                v
+----------------------------------+
|   Node.js Backend (port 8080)    |
|        géré par PM2              |
+----------------------------------+
```

---

**Bonne chance !**
