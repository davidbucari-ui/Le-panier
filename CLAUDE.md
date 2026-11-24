# Le Panier — contexte pour Claude Code

Application web personnelle (français) de gestion des courses : recettes, idées de recettes par IA, liste de courses, stock alimentaire, prix par magasin, scanner de code-barres. Un seul utilisateur (David), usage sur tablette et smartphone.

## Langue et ton
- Interface, messages et commentaires visibles : **français**, vouvoiement neutre dans l'UI.
- Réponses à David en français, concises, sans jargon. Il valide en testant sur sa tablette/son téléphone : toujours dire ce qui a été testé et ce qui ne l'a pas été (caméra, réseau réel).

## Architecture
- **Un seul fichier** `index.html` (HTML + CSS + JS vanilla, aucune étape de build). Ne pas introduire de framework ni de bundler.
- `ingredients.json` : dictionnaire d'ingrédients (~4 200 entrées) chargé par `fetch` au démarrage. Entrée = `[nom, synonymes[], indices_ancêtres[], indice_rayon, code_ciqual]`. Généré depuis la taxonomie Open Food Facts (ODbL) ; absent dans la version Claude (l'appli doit rester fonctionnelle sans).
- `supabase.sql` : table `app_state` (une ligne par utilisateur, colonne `data` jsonb, RLS par `auth.uid()`, publication realtime) ; tables des listes partagées (`shared_lists`, `shared_list_members`, `shared_items`, migration `listes_partagees` appliquée le 22/11/2026).
- `supabase/functions/import-recette/index.ts` : Edge Function Deno qui lit le JSON-LD schema.org/Recipe d'une page (JWT obligatoire, protections SSRF, limite 2 Mo / 8 s).
- Hébergement : **GitHub Pages**, `https://davidbucari-ui.github.io/Le-panier/` (attention à la casse : « Le-panier »). Déploiement = `git push` sur `main` (1 à 2 minutes, un 404 passager est possible pendant la publication).
- Supabase : projet `uwowtbninyoylwqgrqby` (eu-west-1). La clé *publishable* dans `index.html` est publique par conception ; ne jamais y mettre de clé secrète.

## Mots de passe divulgués
- La protection Supabase « leaked password protection » exige l'offre Pro (le projet est en offre gratuite) : remplacée par `pwLeaked` dans l'appli, appelée à la **création de compte** (`authGo(true)`). Have I Been Pwned, k-anonymat (seuls les 5 premiers caractères hexadécimaux du SHA-1 partent, en-tête `Add-Padding`), délai 6 s. Si le service est injoignable, l'inscription n'est **pas** bloquée (`null`). Contournable par un client modifié : c'est une aide pour les membres de la famille, pas une barrière serveur.

## Deux modes d'exécution
1. **Hors Claude** (GitHub Pages) : connexion e-mail + mot de passe Supabase, synchro realtime, dictionnaire, scanner, import d'URL via l'Edge Function. Pas d'IA intégrée : les « idées » passent par un copier-coller de prompt vers une conversation Claude (`ideasPrompt`/`ingestIdeas`, `recipePrompt`/`ingestRecipe`).
- **Ticket de caisse** (« Lire mon ticket » dans Courses) : lecture sans IA (PDF via pdf.js, capture d'écran via Tesseract, ou texte collé ; analyse locale `parseTicketText`, pensée pour Lidl Plus). Chaque ligne est **rapprochée de la liste** (`tkMatch` : `ckey`/`covers`, modifiable par une liste déroulante) ; `applyTicket` met au stock et note les prix, et les articles rapprochés sortent de la liste (lignes hors liste : ajoutées au stock et aux prix). Une ligne rapprochée vaut « acheté » (quantité = max ticket/liste, même unité). Le prix est noté sous le nom de la liste. Sans ticket : « Ranger les courses » (`storeBought`) ou saisie à la main. Retirée puis rétablie à la demande de David : ne pas la supprimer sans qu'il le demande.
- **Vie privée** : le texte lu sur un ticket (adresse, téléphone, carte…) n'est ni affiché ni stocké ; seuls magasin, date, articles et prix sont gardés. L'analyse ne regarde que le tableau d'articles (après l'en-tête « Article … EUR »). Ne pas remettre le texte brut dans la zone de collage.
- Le ticket demande le magasin pour noter les prix ; pdf.js/Tesseract sont chargés à la demande depuis jsDelivr (réseau requis).
- Lecture d'image : un ticket Lidl Plus en capture fait ~5 000 px de haut ; `imgText` le lit **par tranches** d'environ 2 000 px (coupées à la ligne la moins encrée, `quietRow`) pour ménager la mémoire des mobiles, avec `errorHandler` + délai (Tesseract ne rejette pas toujours ses erreurs). Chez Lidl, la lettre de TVA classe : `A` (5,5 %) = alimentaire, `B` (20 %) = non alimentaire ; les articles non alimentaires sont gardés et cochés, rangés dans un rayon non alimentaire (`NONFOOD_R`, repli « Autres »). Les remises (« Réduction Lidl Plus », « Prix en baisse », « Rem … ») sont déduites de l'article précédent : une ligne d'article rejetée par l'analyse fausse donc la remise suivante. Vérification de référence : la somme des lignes doit égaler « A payer », la somme des lignes `A` « Total éligible TR ».
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

## Trouver une recette en ligne (Recettes → « Trouver en ligne »)
- Fenêtre `#fo` : pastilles d'ingrédients du stock (`foItems`, colorées par rayon), 4 choisies d'office (un peu de viande, de légumes, de crèmerie ; les ingrédients de base `FO_SKIP` — sel, huile, farine, lait… — ne le sont jamais), mot-clé libre, choix du site. Le lien `#fo-go` est une vraie balise `<a target="_blank">` mise à jour à chaque changement (`foUpdate`) : elle ouvre la recherche d'un site (Marmiton, ou Google restreint à Marmiton / 750g / CuisineAZ). **Aucun appel réseau depuis l'appli** : seuls les noms choisis partent, dans l'adresse. « Importer l'adresse copiée » lit le presse-papiers (si le navigateur l'autorise), ouvre l'import existant (`openImport`) et lance `importUrl` (Edge Function `import-recette`, connexion requise).
- Terme de recherche (`foTerm`) = vos mots, coupés à la plus longue partie initiale connue du dictionnaire (« poulet pac fermier j » → « poulet ») ; ne jamais prendre le nom générique du dictionnaire (« pâtes » → « pâte » = pâte à tarte). Les URL de recherche des sites n'ont pas pu être vérifiées depuis l'environnement de développement (pas de réseau externe) : à contrôler sur appareil si un site change.

## Historique d'achat (Courses)
- Dans « ＋ Ajouter », la section « Mon historique d'achat » (`histItems`, `renderHist`) liste les articles déjà achetés, sous la recherche : issus de `S.prices` (une ligne de ticket ou un prix noté = un achat, compté par jour et magasin) et des articles en stock sans prix noté. Chaque ligne : dernier magasin, dernier prix, ancienneté, nombre d'achats. Tri : plus achetés / récents / A–Z (`UI.hSort`, local à l'appareil). Filtré par la saisie et par le rayon choisi ; un toucher ajoute l'article à la liste (`extra-pick`, avec la quantité saisie), les articles déjà sur la liste sont marqués et désactivés. Aucune clé de données nouvelle : l'historique se déduit de `prices` et `stock` (« Ranger les courses » ne laisse pas de trace).

## Catégorie (rayon) d'un article
- Toucher le nom d'un article (Courses, Stock) ouvre la fenêtre `#fm` : **catégorie** + conditionnement. Le choix est mémorisé dans `S.cats` (clé `norm(nom)`, `{n,r}`, comparé par `ckey` à l'exécution) et **prime partout** : `rayonOf(nom, rayonEnregistré)` = choix de l'utilisateur, sinon rayon enregistré, sinon `guessRayon`. `guessRayon` consulte lui-même `S.cats` en premier, donc les futurs tickets, ajouts et scans reprennent le choix. Le sélecteur de rayon de l'onglet Prix et le rayon choisi au scanner alimentent aussi `S.cats`. Le choix est toujours mémorisé, même s'il égale le rayon deviné (l'article peut porter un ancien `r`). Ne pas lire `x.r` directement pour afficher un rayon : passer par `rayonOf`.

## Conditionnement et couleurs par rayon
- **Conditionnement** (`S.fmts`, clé = `norm(nom)`, jamais un identifiant de dictionnaire ; `fmtOf` compare par `ckey` à l'exécution). Exemples : paquet 500 g = {c:1,q:500,u:'g'} ; pot 4 × 125 g = {c:4,q:125,u:'g'} ; boîte de 12 œufs = {c:12,q:1,u:''}. Appris du libellé d'un ticket (`tkFormat`, à la validation) et du contenu Open Food Facts au scan (`scRead`) ; modifiable en touchant le nom d'un article (fenêtre `#fm`). **Un format saisi à la main (`s:'user'`) n'est jamais écrasé** par un ticket ou un scan. Le type de contenant est deviné d'après le nom (`PK_GUESS`).
- Affichage : Stock = format sous le nom + « N briques en stock » si la quantité est un compte rond (`pkLots`) ; Courses = « à prendre : 2 pots de 4 × 125 g » (`pkPacks`, arrondi au-dessus, masqué une fois l'article coché ni quand il n'apporte rien).
- **Couleurs par rayon** : variables `--rc0…6` / `--rs0…6` (clair, sombre auto et sombre forcé) ; `rcStyle(rayon)` pose `--c`/`--s` en style en ligne sur groupes, onglets (Courses, Stock, Prix) ; `RAYON_ICO` donne l'icône. Un nouveau rayon doit être ajouté à `RAYONS`, `RAYON_ICO` et aux variables (`--rc0…10`). Rayons : 6 alimentaires + Boissons, Hygiène et beauté, Entretien et maison, Bébé et animaux (devinés par `KW_PRIO`, testé avant le dictionnaire) + Autres (toujours en dernier : sert de repli à `rcIdx`).
- Les lignes d'un ticket qui ressemblent à des coordonnées (e-mail, site, téléphone) ne deviennent jamais un article (`TK_CONTACT`, et garde-fou dans `addStock`).

## Écran Courses
- Haut : « ＋ Ajouter » (déplie le formulaire de recherche `#ex-box`, masqué par défaut) et « Scanner ». Liste (`renderCourses`) : une ligne par article (`.citem` : case, nom + origine, quantité, bouton « En stock » ou × pour un ajout à la main), regroupée par rayon ; les articles cochés passent dans un groupe « Dans le panier » en bas. À droite (tablette) ou dessous (mobile) : résumé recettes/stock, « Lire mon ticket », « Ranger les courses », « Copier la liste », puis « Plus d'actions » (nouvelle recette, masquer, tout décocher, vider). Même habillage que le Stock : une carte par rayon (`.cgroup`), pastille illustrée `itemIco` après la case, quantité en pastille. L'ancien style « ticket de caisse » (police mono, pointillés) a été retiré.

## Listes de courses partagées (famille)
- Seule la **liste de courses** se partage (pas le stock, les recettes ni les prix). Visible seulement une fois connecté à Supabase ; hors connexion ou dans Claude, le sélecteur `#c-lists` est masqué.
- Base : `shared_lists` (nom, propriétaire, `code` d'invitation), `shared_list_members` (prénom affiché), `shared_items` (une ligne par article : `n,q,u,r,done,by`). RLS par appartenance (`is_list_member`, security definer). Création et adhésion **uniquement** par les fonctions `create_shared_list(p_name,p_me)` et `join_shared_list(p_code,p_me)`. Le propriétaire renomme / supprime ; un membre quitte. Realtime sur les 3 tables.
- Appli : état `SH` (rechargé en entier par `shLoad` à chaque événement realtime, avec un délai de 250 ms), liste courante `UI.cl` (locale à l'appareil). `renderCourses` délègue à `renderShared` quand une liste partagée est choisie ; `exAdd`, le scanner (`sc-list`) et l'historique écrivent dans la liste courante (`shAdd` fusionne un article identique non coché). « Ranger dans mon stock » (`shStore`) met les cochés dans **mon** `S.stock` et les retire de la liste. Prénom : `UI.me` (demandé à la première création ou adhésion).
- Invitation : lien `?liste=CODE` (partage natif ou copie) ; le code est gardé dans `localStorage['lepanier-join']` jusqu'à la connexion (il survit à la confirmation d'e-mail), puis l'adresse est nettoyée. Saisie manuelle possible : « Rejoindre avec un code ». Le lien de confirmation d'e-mail renvoie vers `?liste=CODE` (`authBack`) : un lien ouvert depuis WhatsApp vit souvent dans un autre navigateur que celui de l'e-mail. Le message d'invitation contient aussi le code en clair.
- Écran de connexion `#auth` : « Votre compte Le Panier », encadré rappelant que ce n'est **pas** le compte Google (une inscription a été faite par erreur en croyant se connecter avec Gmail) ; deux choix (`authMode` : « J'ai déjà un compte » / « Créer mon compte », par défaut création si une invitation est en attente), confirmation du mot de passe à la création. « Mot de passe oublié ? » (`authForgot`, `resetPasswordForEmail` vers `authBack()`) ; au retour du lien, l'événement `PASSWORD_RECOVERY` ouvre `#au-reset` (`authNewPw` : vérification des fuites puis `updateUser`).
- Connexion (`authGo`) : un seul envoi à la fois (`AUTH_BUSY`, boutons désactivés — un double toucher déclenchait la limite d'envoi d'e-mails de Supabase, qui écrasait le message de réussite) ; erreurs traduites (`authErr`) ; après inscription, encadré « vérifiez vos e-mails » avec « Renvoyer l'e-mail » (`auth.resend`). Offre gratuite : envois d'e-mails très limités par heure.
- Tests : faux client Supabase en mémoire partagé entre deux pages Playwright (deux membres) ; le vrai realtime n'est testable que sur appareil.

## Onglets par catégorie (Courses et Stock)
- Composant commun `catTabs` (même style `.pr-tabs` que l'onglet Prix) : « Tous » puis un onglet par rayon avec son nombre (✓ = rien à acheter dans Courses). Masqué s'il n'y a qu'une catégorie. État en mémoire seulement (`C_TAB`, `SK_TAB`, pas persisté) ; retour automatique à « Tous » si la catégorie se vide. La barre défile horizontalement et garde sa position à chaque rendu. Dans un onglet de catégorie, l'en-tête de rayon est omis (l'onglet le remplace) ; dans « Tous », le Stock garde ses groupes repliables.

## Écran Prix
- Même habillage que Stock et Courses : barre `catTabs` (« Tous » d'abord, par défaut), une carte par rayon (`.sk-group` + en-tête `.pr-head`), une fiche par article (`.pr-item` : pastille `itemIco`, meilleur prix €/kg·l·pièce en grand, une ligne par magasin `.pr-shop`, la moins chère colorée ; en pied, historique/suppression et choix du rayon `data-prr`). 2 colonnes à partir de 820 px. Dans « Tous », catégories **repliées par défaut** (`pr-toggle`, ouvertes mémorisées dans `UI.prOpen`, local à l'appareil) ; une recherche les déplie toutes. Comparaison du panier : `.pr-cmp`, magasin le mieux classé surligné.

## Écran Recettes
- Carte : bandeau `rcHero` (jusqu'à 4 pastilles `itemIco` des ingrédients principaux — hors ingrédients de base `ING_BASIC` sauf pour compléter —, couleur du rayon du premier, badge « Dans la liste · N pers. »). Ingrédients en pastilles `ingChip` (icône, couleur du rayon via `rayonOf`, contour vert + ✓ si couvert par le stock, `covers`). Même rendu pour les idées de Claude (`proposalCard`, pastilles cliquables pour exclure).

## Photos de recettes
- Champ `r.img` d'une recette : `'https://…'` (image du site, renvoyée par l'Edge Function `import-recette` depuis le JSON-LD `image`/`thumbnailUrl`, sinon `og:image` ; https seulement) ou `'sb:<uid>/<recette>-<date>.jpg'` (photo perso). Rien d'autre n'est affiché (`imgSrc`).
- Photos perso : espace de stockage Supabase **privé** `recettes` (migration `photos_recettes`, un dossier par utilisateur, 2 Mo max, jpeg/webp/png). Réduites dans le navigateur à 900 px, JPEG 0,82 (`shrinkPhoto`) ; affichées par liens signés valables 7 jours (`createSignedUrls`, groupés, en mémoire `IMG_URL`). Ancienne photo supprimée quand elle est remplacée, retirée, ou quand la recette est supprimée (`photoDel`). Bouton masqué hors connexion.
- Formulaire `#nr` : bloc « Photo » (`#nr-file`, état `NR_IMG`, `nrPhoto`) ; `saveNew` est asynchrone (envoi avant enregistrement ; en cas d'échec, le formulaire reste ouvert).
- Carte : `rcHero` affiche la photo (150 px, pastilles par-dessus) ; si l'image ne charge pas (`onerror`), retour au bandeau de pastilles. Images de sites chargées avec `referrerpolicy="no-referrer"`.

## Calories et protéines des recettes
- Dans une recette **ouverte**, `nutBlock` affiche « ≈ N kcal · protéines · glucides · lipides par personne » (`nutOf`). Bouton « Calculer les calories » / « Compléter » (`nut-calc`, `nutCalc`) : une recherche Open Food Facts (`cgi/search.pl`, tri par produits les plus scannés) par ingrédient, **médiane** des 15 premiers produits (`nutFetch`), une requête toutes les 1,2 s (limite ~10/min) ; arrêt sur 429/503 ou réseau coupé.
- **Table de référence `NUT_REF`** (consultée **avant** Open Food Facts) : ~130 aliments courants, valeurs moyennes pour 100 g saisies à la main (proches de Ciqual, mais pas le fichier officiel ; à remplacer par Ciqual si disponible), poids de pièce `w`. Riz/pâtes/quinoa/lentilles crus, pois chiches et haricots rouges/blancs en conserve ; premier motif qui correspond gagne (ordre = du plus précis au plus général). Open Food Facts ne sert que pour les ingrédients absents de la table. Une estimation n'est **affichée et utilisée par le filtre/tri que si `nutOf(r).ok`** (au moins 60 % des lignes comptées) : sinon message « trop incomplète » (un « 0 g de protéines » trompeur sur une recette dont le poulet n'était pas compté a motivé ce garde-fou).
- Cache `lepanier-nut` (localStorage, propre à l'appareil, **hors `S`**, clé `nutKey(nom)`, `null` = rien trouvé). Poids : g/ml tels quels, c. à soupe 15 g, c. à café 5 g, gousse 4 g, pièces via `NUT_PIECE` (œuf, oignon, courgette…) ; `NUT_ZERO` (sel, épices, eau) ignorés. Ligne au poids inconnu = non comptée : « estimation sur X/N ingrédients ». Résultat approximatif (produits transformés mélangés) ; testé avec un faux `fetch` seulement.

- **Riches en protéines** (toutes protéines confondues, animales et végétales : on lit `proteins_100g`) : filtre `UI.prot` + seuil `UI.protG` (25 g/personne par défaut) et tri `UI.protSort` dans Recettes (locaux à l'appareil) ; seules les recettes déjà calculées passent le filtre. « Calculer pour toutes mes recettes » = `nutRun(recettes,'*')` (un seul calcul à la fois, `NUT_BUSY`). Dans « Trouver en ligne », la case `#fo-prot` ajoute « riche en protéines » à la recherche (pas aux ingrédients cherchés dans vos recettes) et coche jusqu'à 2 ingrédients du stock listés dans `FO_PROT`.

## Écran Stock
- Une ligne par article (`skRow`) : nom, boutons − / + (`stock-step`, pas de 1 pièce, 100 g/ml, 500 au-delà d'un kilo/litre), quantité modifiable, × (retrait avec confirmation par second toucher). Quantité vide = « dispo » (`q=0`, considéré disponible). Le − est désactivé au minimum (le retrait passe par ×).
- Présentation : une carte par rayon (`.sk-group`, lignes dans `.sk-rows`, 2 colonnes à partir de 820 px), pastille illustrée par article (`itemIco` : emoji d'après le nom via `ITEM_ICO`, sinon icône du rayon), compteur − / + d'un seul tenant (`.sk-step`). Le format « lot de 1 » n'est pas affiché.
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
- Prix saisis depuis des tickets Lidl : prix **net payé** (après remises), unité de base g/ml/pièce, articles non alimentaires inclus (rayons Hygiène, Entretien, Bébé et animaux, Autres).

## Icône de l'application
- `icons/` (192, 512, 180 pour iOS, favicon 32) + `manifest.webmanifest`, liés dans `<head>` de `index.html` (chemins relatifs, pour le sous-dossier GitHub Pages). Panier d'osier avec légumes sur fond vert, généré par IA, texte « Le Panier » ajouté en bas par script (police DejaVu Sans Bold) ; la même image sert d'icône « maskable » (le motif reste dans la zone sûre). Installation sur l'écran d'accueil à vérifier sur appareil.

## Module Petite enfance 0-3 ans (`enfants/`, indépendant de Le Panier)
- Module à part, pensé pour être intégré à l'application des crèches de David (application web HTML/JS) : `enfants/data.js` (données : tranches d'âge, 14 allergènes par mots-clés, aliments à éviter par âge, 15 recettes de départ, portions indicatives), `enfants/module.js` (logique pure + interface, sans dépendance, `PetiteEnfance.mount(el,{storageKey})`), `enfants/index.html` (page de démonstration, `…/Le-panier/enfants/`). Aucun lien de données avec `S` ; seul un lien « Petite enfance » (`#tab-enfants`, adresse relative `enfants/`, même onglet) dans la barre du haut de `index.html`, et « ← Retour à Le Panier » dans `enfants/index.html`.
- Fonctions : recettes par âge (0-6 / 6-8 / 8-10 / 10-12 / 12-36 mois) et texture, filtre « sans » allergène, alertes d'âge (`alertsFor` : miel, sel, sucre, lait de vache, fruits à coque entiers, aliments ronds, cru, fromage au lait cru, poissons prédateurs), recettes perso (stockées dans `localStorage`, allergènes et alertes détectés d'après les noms), nombre d'enfants par tranche → quantités du groupe (`groupFactor` : portion de référence 12-36 mois × facteur d'âge 0,5 / 0,6 / 0,7 / 1), menus de la semaine (déjeuner, dessert, goûter) et liste de courses.
- **Contenu non validé médicalement** : recettes, portions et règles d'âge rédigées de mémoire, avec avertissement affiché dans l'appli ; à faire valider (pédiatre, PMI, protocole de la crèche) avant tout usage réel. Une recette dont les ingrédients déclenchent une alerte n'est jamais proposée pour la tranche concernée ; une recette plus avancée que la tranche n'est pas proposée non plus.
- Testé : logique en Node + parcours jsdom. Pas testé : appareil réel, intégration dans l'application des crèches.

## Sources et licences
Dictionnaire : Open Food Facts (ODbL), codes Ciqual (Anses). Le crédit s'affiche en bas de page et dans le README ; le conserver.

## Pistes en attente
- Valeurs nutritionnelles exactes via les codes Ciqual (le site Anses était en maintenance ; remplacé pour l'instant par Open Food Facts, voir ci-dessous).
- Import de plusieurs tickets d'un coup (aujourd'hui : écriture ponctuelle en base).
