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
1. **Hors Claude** (GitHub Pages) : connexion e-mail + mot de passe Supabase, synchro realtime, dictionnaire, scanner, import d'URL via l'Edge Function. Pas d'IA intégrée : les « idées » passent par un copier-coller de prompt vers une conversation Claude (`ideasPrompt`/`ingestIdeas`, `recipePrompt`/`ingestRecipe`).
- **Ticket de caisse** (« Lire mon ticket » dans Courses) : lecture sans IA (PDF via pdf.js, capture d'écran via Tesseract, ou texte collé ; analyse locale `parseTicketText`, pensée pour Lidl Plus). Chaque ligne est **rapprochée de la liste** (`tkMatch` : `ckey`/`covers`, modifiable par une liste déroulante) ; `applyTicket` met au stock et note les prix, et les articles rapprochés sortent de la liste (lignes hors liste : ajoutées au stock et aux prix). Une ligne rapprochée vaut « acheté » (quantité = max ticket/liste, même unité). Le prix est noté sous le nom de la liste. Sans ticket : « Ranger les courses » (`storeBought`) ou saisie à la main. Retirée puis rétablie à la demande de David : ne pas la supprimer sans qu'il le demande.
- **Vie privée** : le texte lu sur un ticket (adresse, téléphone, carte…) n'est ni affiché ni stocké ; seuls magasin, date, articles et prix sont gardés. L'analyse ne regarde que le tableau d'articles (après l'en-tête « Article … EUR »). Ne pas remettre le texte brut dans la zone de collage.
- Le ticket demande le magasin pour noter les prix ; pdf.js/Tesseract sont chargés à la demande depuis jsDelivr (réseau requis).
- Lecture d'image : un ticket Lidl Plus en capture fait ~5 000 px de haut ; `imgText` le lit **par tranches** d'environ 2 000 px (coupées à la ligne la moins encrée, `quietRow`) pour ménager la mémoire des mobiles, avec `errorHandler` + délai (Tesseract ne rejette pas toujours ses erreurs). Chez Lidl, la lettre de TVA décide : `A` (5,5 %) = alimentaire, `B` (20 %) = non alimentaire. Les remises (« Réduction Lidl Plus », « Prix en baisse », « Rem … ») sont déduites de l'article précédent : une ligne d'article rejetée par l'analyse fausse donc la remise suivante. Vérification de référence : la somme des lignes doit égaler « A payer », la somme des lignes `A` « Total éligible TR ».
2. **Dans Claude** (artifact) : `claude.use("db"|"user"|"sample")`, stockage par utilisateur `data/users/<id>/app`, IA via `sample`. Cette version n'est **pas** republiée à chaque changement : elle date d'avant le stock/les prix/le scanner. Ne pas la considérer comme à jour.
Le code doit rester compatible avec les deux : tout accès réseau ou dictionnaire est optionnel et dégrade proprement.

## Modèle de données (objet `S`, persisté sous `lepanier-v1` + Supabase)
```
S = { v, rev, recipes[], plan{recetteId: personnes}, days{recetteId: jour}, stock[], extras[],
      prices[], barcodes{ean: {n,r,q,u}}, fmts{norm(nom): {n,c,q,u,l,s}}, bought[], exclude[] }
stock    : {k: norm(nom), n, q, u, r}      q=0 → quantité inconnue (considéré disponible)
extras   : {id, n, q, u, r}                articles ajoutés à la main à la liste de courses
prices   : {id, k, n, p, q, u, shop, d, r?} p = prix payé pour q·u ; d = AAAA-MM-JJ ; r = rayon corrigé
fmts     : conditionnement d'un produit : c unités par lot × q·u de contenu (g/ml/pièce), l type (paquet, brique…), s source user|ticket|scan
```
- Unités normalisées par `normQty` : kg→g, l/cl/dl→ml ; `''` = pièce. Prix unitaire = `unitPrice` (€/kg, €/l ou €/pièce).
- **Conflits de synchro** : chaque `persist()` pose `rev = Date.now()` ; un état distant n'est accepté que si `remote.rev > local.rev`. Toute écriture directe en base doit **mettre `rev` à l'heure courante** (en ms), sinon elle sera ignorée ou écrasée.
- Toujours passer les données lues par `fix()` (tolère les anciens formats) ; toute nouvelle clé de `S` doit être ajoutée dans `fresh()` **et** `fix()`.

## Historique d'achat (Courses)
- Dans « ＋ Ajouter », la section « Mon historique d'achat » (`histItems`, `renderHist`) liste les articles déjà achetés, sous la recherche : issus de `S.prices` (une ligne de ticket ou un prix noté = un achat, compté par jour et magasin) et des articles en stock sans prix noté. Chaque ligne : dernier magasin, dernier prix, ancienneté, nombre d'achats. Tri : plus achetés / récents / A–Z (`UI.hSort`, local à l'appareil). Filtré par la saisie et par le rayon choisi ; un toucher ajoute l'article à la liste (`extra-pick`, avec la quantité saisie), les articles déjà sur la liste sont marqués et désactivés. Aucune clé de données nouvelle : l'historique se déduit de `prices` et `stock` (« Ranger les courses » ne laisse pas de trace).

## Catégorie (rayon) d'un article
- Toucher le nom d'un article (Courses, Stock) ouvre la fenêtre `#fm` : **catégorie** + conditionnement. Le choix est mémorisé dans `S.cats` (clé `norm(nom)`, `{n,r}`, comparé par `ckey` à l'exécution) et **prime partout** : `rayonOf(nom, rayonEnregistré)` = choix de l'utilisateur, sinon rayon enregistré, sinon `guessRayon`. `guessRayon` consulte lui-même `S.cats` en premier, donc les futurs tickets, ajouts et scans reprennent le choix. Le sélecteur de rayon de l'onglet Prix et le rayon choisi au scanner alimentent aussi `S.cats`. Le choix est toujours mémorisé, même s'il égale le rayon deviné (l'article peut porter un ancien `r`). Ne pas lire `x.r` directement pour afficher un rayon : passer par `rayonOf`.

## Conditionnement et couleurs par rayon
- **Conditionnement** (`S.fmts`, clé = `norm(nom)`, jamais un identifiant de dictionnaire ; `fmtOf` compare par `ckey` à l'exécution). Exemples : paquet 500 g = {c:1,q:500,u:'g'} ; pot 4 × 125 g = {c:4,q:125,u:'g'} ; boîte de 12 œufs = {c:12,q:1,u:''}. Appris du libellé d'un ticket (`tkFormat`, à la validation) et du contenu Open Food Facts au scan (`scRead`) ; modifiable en touchant le nom d'un article (fenêtre `#fm`). **Un format saisi à la main (`s:'user'`) n'est jamais écrasé** par un ticket ou un scan. Le type de contenant est deviné d'après le nom (`PK_GUESS`).
- Affichage : Stock = format sous le nom + « N briques en stock » si la quantité est un compte rond (`pkLots`) ; Courses = « à prendre : 2 pots de 4 × 125 g » (`pkPacks`, arrondi au-dessus, masqué une fois l'article coché ni quand il n'apporte rien).
- **Couleurs par rayon** : variables `--rc0…6` / `--rs0…6` (clair, sombre auto et sombre forcé) ; `rcStyle(rayon)` pose `--c`/`--s` en style en ligne sur groupes, onglets (Courses, Stock, Prix) ; `RAYON_ICO` donne l'icône. Un nouveau rayon doit être ajouté à `RAYONS`, `RAYON_ICO` et aux variables.
- Les lignes d'un ticket qui ressemblent à des coordonnées (e-mail, site, téléphone) ne deviennent jamais un article (`TK_CONTACT`, et garde-fou dans `addStock`).

## Écran Courses
- Haut : « ＋ Ajouter » (déplie le formulaire de recherche `#ex-box`, masqué par défaut) et « Scanner ». Liste (`renderCourses`) : une ligne par article (`.citem` : case, nom + origine, quantité, bouton « En stock » ou × pour un ajout à la main), regroupée par rayon ; les articles cochés passent dans un groupe « Dans le panier » en bas. À droite (tablette) ou dessous (mobile) : résumé recettes/stock, « Lire mon ticket », « Ranger les courses », « Copier la liste », puis « Plus d'actions » (nouvelle recette, masquer, tout décocher, vider). L'ancien style « ticket de caisse » (police mono, pointillés) a été retiré.

## Onglets par catégorie (Courses et Stock)
- Composant commun `catTabs` (même style `.pr-tabs` que l'onglet Prix) : « Tous » puis un onglet par rayon avec son nombre (✓ = rien à acheter dans Courses). Masqué s'il n'y a qu'une catégorie. État en mémoire seulement (`C_TAB`, `SK_TAB`, pas persisté) ; retour automatique à « Tous » si la catégorie se vide. La barre défile horizontalement et garde sa position à chaque rendu. Dans un onglet de catégorie, l'en-tête de rayon est omis (l'onglet le remplace) ; dans « Tous », le Stock garde ses groupes repliables.

## Écran Stock
- Une ligne par article (`skRow`) : nom, boutons − / + (`stock-step`, pas de 1 pièce, 100 g/ml, 500 au-delà d'un kilo/litre), quantité modifiable, × (retrait avec confirmation par second toucher). Quantité vide = « dispo » (`q=0`, considéré disponible). Le − est désactivé au minimum (le retrait passe par ×).
- Catégories repliables (`sk-toggle`, état dans `UI.skClosed`, local à l'appareil) ; une recherche les déplie. L'ajout à la main est masqué derrière « ＋ Ajouter ».

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
- Pas de dépendance ajoutée sans nécessité (supabase-js 2.45.4 via jsDelivr ; ZXing chargé à la demande pour le scanner).

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
