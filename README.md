# Studio Keiko

Web app du studio vidéo Keiko (Ofi Invest) : devis versionnés, registre des réalisations et tableau de bord pour la direction.

- **Devis** : numérotation automatique (`DEV-2026-001`), statuts brouillon / envoyé / accepté / refusé. Une version envoyée n'est jamais modifiée : toute modification crée une nouvelle version. Un devis accepté crée (ou met à jour) la réalisation correspondante dans le registre.
- **Réalisations** : vidéos internes (services Ofi Invest, non facturées, valorisées au tarif du studio) et externes (facturées).
- **Tableau de bord** : chiffres clés, évolution mensuelle, répartitions, synthèse texte et export CSV.

La grille tarifaire est dans `lib/pricing.ts`.

## Développement

```bash
npm install
npm run dev   # http://localhost:3000, mot de passe local : keiko
```

Sans `BLOB_READ_WRITE_TOKEN`, les données sont stockées dans `.data/`.

## Variables d'environnement (Vercel)

| Variable | Rôle |
| --- | --- |
| `APP_PASSWORD` | Mot de passe partagé de l'équipe |
| `AUTH_SECRET` | Secret de signature des sessions (32 caractères aléatoires minimum) |
| `BLOB_READ_WRITE_TOKEN` | Ajouté automatiquement en connectant un store Vercel Blob (privé) au projet |
