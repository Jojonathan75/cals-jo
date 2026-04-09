# 🔥 Cal's Jo — PWA Suivi Calories

## ⚡ Lancer en local

```bash
cd calsjo
npm install
npm start
```

L'app s'ouvre sur http://localhost:3000

---

## 🚀 Déployer gratuitement sur Vercel (recommandé)

### Étape 1 — Créer un compte
1. Va sur **https://vercel.com**
2. Clique **Sign Up** → connecte-toi avec ton compte **GitHub**

### Étape 2 — Mettre le code sur GitHub
1. Va sur **https://github.com** → connecte-toi ou crée un compte
2. Clique le **+** en haut à droite → **New repository**
3. Nomme-le `cals-jo`, laisse-le en **Public**, clique **Create**
4. Dans VS Code, ouvre le terminal dans le dossier `calsjo` et tape :

```bash
git init
git add .
git commit -m "Cal's Jo v1"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/cals-jo.git
git push -u origin main
```

(Remplace `TON-PSEUDO` par ton nom d'utilisateur GitHub)

### Étape 3 — Déployer sur Vercel
1. Retourne sur **https://vercel.com/dashboard**
2. Clique **Add New → Project**
3. Sélectionne ton repo **cals-jo**
4. Vercel détecte automatiquement que c'est du React
5. Clique **Deploy** → attend ~1 minute
6. Tu reçois un lien comme **https://cals-jo.vercel.app** 🎉

### Étape 4 — Partager à tes proches
Envoie le lien à tes proches ! Voici comment ils l'installent :

#### 📱 Android (Chrome)
1. Ouvrir le lien dans **Chrome**
2. Appuyer sur les **3 points** en haut à droite
3. Appuyer sur **"Ajouter à l'écran d'accueil"**
4. L'icône Cal's Jo apparaît comme une app

#### 🍎 iOS (Safari)
1. Ouvrir le lien dans **Safari** (pas Chrome)
2. Appuyer sur le bouton **Partager** (carré avec flèche)
3. Faire défiler et appuyer sur **"Sur l'écran d'accueil"**
4. L'icône Cal's Jo apparaît comme une app

---

## 📁 Structure du projet

```
calsjo/
├── public/
│   ├── index.html          ← Page HTML + inscription SW
│   ├── manifest.json       ← Config PWA (nom, icône, couleurs)
│   ├── sw.js               ← Service Worker (cache offline)
│   └── icons/
│       ├── icon-192.png    ← Icône app
│       └── icon-512.png    ← Icône app HD
├── src/
│   ├── index.js            ← Point d'entrée React
│   ├── index.css           ← Styles globaux
│   ├── App.js              ← Composant principal (toute l'app)
│   ├── theme.js            ← Couleurs et constantes
│   └── data/
│       └── foods.js        ← Base de données d'aliments
└── package.json
```

---

## 🔄 Mettre à jour l'app

Après avoir modifié le code :

```bash
git add .
git commit -m "Mise à jour"
git push
```

Vercel redéploie automatiquement en ~30 secondes. Tes proches verront la mise à jour au prochain chargement.

---

## 💡 Pour aller plus loin

- **Domaine personnalisé** : Dans Vercel → Settings → Domains, tu peux ajouter un domaine comme `calsjo.fr`
- **API nutritionnelle** : Connecter OpenFoodFacts (gratuit) pour le scan de codes-barres
- **Base de données** : Ajouter Firebase/Supabase pour sauvegarder les données entre appareils
- **Notifications** : Rappels de repas via push notifications
