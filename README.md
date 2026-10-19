# HisseinCoin (HSC)

Interface web du portefeuille HisseinCoin. La page d'accueil ouvre le tableau de bord autonome situé dans `public/dashboard.html`.

## Lancer en local

Installe les dépendances puis démarre le serveur de développement :

```sh
npm install
npm run dev
```

## Vérifier le build de production

```sh
npm run build
npm run preview
```

Le site compilé est généré dans `dist/`. Ce dossier et `node_modules/` ne doivent pas être envoyés sur GitHub ; ils sont exclus par `.gitignore`.

## Déployer sur Vercel

1. Crée un dépôt GitHub pour ce projet et envoie-y le code.
2. Dans Vercel, importe ce dépôt.
3. Utilise les paramètres Vite par défaut :
   - Build Command : `npm run build`
   - Output Directory : `dist`
   - Install Command : `npm install`
4. Déploie, puis ouvre l'URL fournie par Vercel. La racine du site redirige vers le tableau de bord.

Le tableau de bord utilise le contrat HisseinCoin sur Sepolia. La connexion MetaMask et les opérations blockchain doivent être testées séparément après publication.
