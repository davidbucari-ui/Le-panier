# Le Panier

Recettes, stock et liste de courses dans une seule page web.

- Version hébergée : https://davidbucari-ui.github.io/le-panier/
- Sans compte, les données restent dans le navigateur de l'appareil.
- Avec un compte (Supabase), elles se synchronisent entre appareils : voir `supabase.sql` et la constante `SB` en haut du script de `index.html`.
- Les idées de recettes et la lecture de tickets passent par une conversation Claude (copier la demande, coller la réponse).

## Import d'une recette depuis un site

Le bouton « Importer depuis un site » (onglet Recettes) appelle la fonction `import-recette` (`supabase/functions/import-recette`), réservée aux utilisateurs connectés. Elle lit les données structurées de la page ; sinon, l'utilisateur colle le texte de la recette.

## Dictionnaire d'ingrédients

`ingredients.json` (≈ 4 200 ingrédients, noms français, synonymes, hiérarchie, rayon, code Ciqual) est généré à partir de la taxonomie des ingrédients d'[Open Food Facts](https://world.openfoodfacts.org) (licence ODbL). Les codes Ciqual renvoient à la table de composition nutritionnelle de l'Anses. Il sert à l'autocomplétion, au rapprochement stock/recettes (synonymes, « tomate concassée » couvre « tomate ») et au classement par rayon. Sans ce fichier (par ex. dans Claude), l'appli fonctionne comme avant.

## Prix et magasins

Onglet **Prix** : les prix viennent des tickets (magasin, date et prix par ligne sont lus avec le ticket) ou d'une saisie manuelle. Chaque prix est ramené au kilo, au litre ou à la pièce. L'onglet compare les magasins article par article et estime le total de la liste de courses par magasin. Le meilleur prix connu s'affiche aussi sous chaque article de la liste.
