# EasyTax Canada 🇨🇦

**Logiciel fiscal canadien simplifié — Déclaration fédérale (T1) + Québec (TP-1)**

> Déposez vos documents, répondez à quelques questions, et votre déclaration est prête.

---

## Stack technique

- **Frontend** : Next.js 15 · TypeScript · Tailwind CSS
- **Hébergement** : Vercel
- **Auth** : À venir — Clerk / NextAuth
- **Base de données** : À venir — PostgreSQL (Supabase / Neon)
- **Stockage** : À venir — Encrypted object storage
- **OCR** : À venir — Document AI
- **Paiements** : À venir — Stripe

## Fonctionnalités prévues

- [ ] Compte particulier (salarié, étudiant, retraité, autonome)
- [ ] Compte famille (conjoint + enfants)
- [ ] Compte entreprise (employeur + employés)
- [ ] OCR automatique des feuillets (T4, RL-1, T5, T4A…)
- [ ] Moteur de calcul fiscal fédéral
- [ ] Moteur de calcul fiscal Québec
- [ ] Transmission NETFILE (ARC)
- [ ] Transmission Revenu Québec
- [ ] Coffre-fort de documents chiffré
- [ ] Assistant fiscal conversationnel

## Architecture

```
Document → OCR → Extraction → Validation → Tax Engine → T1/TP-1 → Transmission
```

## Développement

```bash
npm install
npm run dev
```

## Certification gouvernementale

La transmission officielle aux gouvernements nécessite :
- **ARC (NETFILE/EFILE)** : Certification du logiciel par l'ARC
- **Revenu Québec** : Autorisation pour logiciel de déclaration TP-1

Ces certifications seront obtenues après validation du moteur fiscal.

---

© 2025 EasyTax Canada
