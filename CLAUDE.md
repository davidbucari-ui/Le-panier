# Le Panier — contexte pour Claude Code

Application web personnelle (français) de gestion des courses : recettes, idées de recettes par IA, liste de courses, stock alimentaire, prix par magasin, scanner de code-barres. Un seul utilisateur (David), usage sur tablette et smartphone.

## Langue et ton
- Interface, messages et commentaires visibles : **français**, vouvoiement neutre dans l'UI.
- Réponses à David en français, concises, sans jargon. Il valide en testant sur sa tablette/son téléphone : toujours dire ce qui a été testé et ce qui ne l'a pas été (caméra, réseau réel).

## Architecture
- **Un seul fichier** `index.html` (HTML + CSS + JS vanilla, aucune étape de build). Ne pas introduire de framework ni de bundler.
- `ingredients.json` : dictionnaire d'ingrédients (~4 200 entrées) chargé par `fetch` au démarrage. Entrée = `[nom, synonymes[], indices_ancêtres[], indice_rayon, code_ciqual]`. Généré depuis la taxonomie Open Food Facts (ODbL) ; absent dans la version Claude (l'appli doit rester fonctionnelle sans).
- `supabase.sql` : table `app_state` (une ligne par utilisateur, colonne `data` jsonb, RLS par `auth.uid()`, publication realtime).
- `supabase/functions/import-recette/index.ts` : Edge Function Deno qui lit le JSON-LD schema.org/Recipe d'une page (JWT obligatoire, protections SSRF, limite 2 Mo / 8 s).
- Hébergement : **GitHub Pages**, `https://davidbucari-ui.github.io/Le-panier/` (attention à la casse : « Le-panier »). Déploiement = `git push` sur `main` (1 à 2 minutes, un 404 passager est possible pendant la publication).
- Supabase : projet `uwowtbninyoylwqgrqby` (eu-west-1). La clé *publishable* dans `index.html` est publique par conception ; ne jamais y mettre de clé secrète.

## Deux modes d'exécution
1. **Hors Claude** (GitHub Pages) : connexion e-mail + mot de passe Supabase, synchro realtime, dictionnaire, scanner, import d'URL via l'Edge Function. Pas d'IA intégrée : les « idées » et la lecture de ticket passent par un copier-coller de prompt vers une conversation Claude (`ideasPrompt`/`ingestIdeas`, `ticketPrompt`/`ingestTicket`, `recipePrompt`/`ingestRecipe`).
2. **Dans Claude** (artifact) : `claude.use("db"|"user"|"sample")`, stockage par utilisateur `data/users/<id>/app`, IA via `sample`. Cette version n'est **pas** republiée à chaque changement : elle date d'avant le stock/les prix/le scanner. Ne pas la considérer comme à jour.
Le code doit rester compatible avec les deux : tout accès réseau ou dictionnaire est optionnel et dégrade proprement.

## Modèle de données (objet `S`, persisté sous `lepanier-v1` + Supabase)
```
S = { v, rev, recipes[], plan{recetteId: personnes}, days{recetteId: jour}, stock[], extras[],
      prices[], barcodes{ean: {n,r,q,u}}, bought[], exclude[] }
stock    : {k: norm(nom), n, q, u, r}      q=0 → quantité inconnue (considéré disponible)
extras   : {id, n, q, u, r}                articles ajoutés à la main à la liste de courses
prices   : {id, k, n, p, q, u, shop, d, r?} p = prix payé pour q·u ; d = AAAA-MM-JJ ; r = rayon corrigé
```
- Unités normalisées par `normQty` : kg→g, l/cl/dl→ml ; `''` = pièce. Prix unitaire = `unitPrice` (€/kg, €/l ou €/pièce).
- **Conflits de synchro** : chaque `persist()` pose `rev = Date.now()` ; un état distant n'est accepté que si `remote.rev > local.rev`. Toute écriture directe en base doit **mettre `rev` à l'heure courante** (en ms), sinon elle sera ignorée ou écrasée.
- Toujours passer les données lues par `fix()` (tolère les anciens formats) ; toute nouvelle clé de `S` doit être ajoutée dans `fresh()` **et** `fix()`.

## Rapprochement d'ingrédients (important)
- `ckey(nom)` renvoie l'**identifiant interne du dictionnaire** (`'#123'`) ou, sans dictionnaire, le nom normalisé (`norm`). Ces identifiants changent si `ingredients.json` est régénéré : **ne jamais les stocker**. Comparer à l'exécution avec `ckey(x.n)` (c'est ce que font les prix), jamais avec une clé persistée.
- `covers(nomStock, cléBesoin)` : un stock couvre un besoin s'il est identique ou **plus précis** (« tomate concassée » couvre « tomate », pas l'inverse).
- `guessRayon(nom)` : mots-clés Épicerie prioritaires (compote, jus, biscuit…), puis dictionnaire, puis mots-clés.
- Pas de filtre végétarien/allergènes : volontairement non fait (héritage des propriétés OFF non vérifié).

## Conventions de code
- Clic : un seul écouteur délégué, `data-act="..."` + `switch` dans le gestionnaire `click`. Champs : écouteurs `input`/`change` délégués. Ajouter une action = un `case` + un bouton `data-act`.
- Rendu : fonctions `renderX()` qui réécrivent `innerHTML` (toujours `esc()` sur les valeurs). `renderAll()` isole chaque rendu (`safe()`) : une erreur affiche un message en bas sans vider la page.
- Les champs de formulaire statiques (hors `#courses`) ne perdent pas le focus au rendu ; ce qui est dans `#courses` est réécrit à chaque rendu.
- Préférences d'affichage propres à l'appareil : `lepanier-ui` (localStorage), non synchronisées.
- Accessibilité : rôles/`aria-*` sur onglets et boutons, cibles tactiles ≥ 36 px. Thème clair/sombre via variables CSS.
- Pas de dépendance ajoutée sans nécessité (supabase-js 2.45.4 via jsDelivr ; ZXing chargé à la demande pour le scanner ; pdf.js 3.11.174 chargé à la demande pour les tickets PDF).
- Ticket téléchargé : `readTicketDoc` → `pdfText` (lignes reconstruites par position) → `parseTicketText` (analyse locale, sans IA) → revue `R.items`.

## Tester
Il n'y a pas de suite de tests dans le dépôt. Méthode utilisée : **jsdom** avec `window.fetch` simulé (dictionnaire, Open Food Facts), on charge `index.html` (en retirant la balise `<script src=...supabase...>`), on clique via `data-act` et on lit le DOM. Vérifier au minimum : `node --check` du script extrait, puis les parcours stock / courses / cuisiner (déduction) / prix / scanner. La caméra, Supabase et Open Food Facts réels ne sont testables que sur appareil.

## Données de David — prudence
- Les données vivent dans `public.app_state` (une ligne). **Sauvegarder avant toute écriture directe** (table `app_state_backup`, RLS activée sans politique).
- Ne pas committer de données personnelles (tickets, adresse e-mail, prix réels) ni d'export de la base.
- Prix saisis depuis des tickets Lidl : prix **net payé** (après remises), unité de base g/ml/pièce, articles non alimentaires exclus.

## Sources et licences
Dictionnaire : Open Food Facts (ODbL), codes Ciqual (Anses). Le crédit s'affiche en bas de page et dans le README ; le conserver.

## Pistes en attente
- Valeurs nutritionnelles via les codes Ciqual (quand le fichier/site est disponible).
- Icône et manifeste pour l'écran d'accueil du smartphone.
- Import de plusieurs tickets d'un coup (aujourd'hui : écriture ponctuelle en base).
