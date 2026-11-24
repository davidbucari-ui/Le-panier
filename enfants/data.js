/* Petite enfance 0-3 ans : données du module (séparées de l'interface pour pouvoir être remplacées ou étendues).
   BASE DE DÉPART INDICATIVE : à faire valider par un professionnel de santé / le protocole de la crèche (PMI) avant usage. */
(function(g){
g.PE_DATA={
version:1,
avertissement:"Base de départ indicative, rédigée sans validation médicale. À faire valider par un professionnel de santé (pédiatre, PMI) ou le protocole de votre crèche avant tout usage. Elle ne remplace pas leur avis.",

/* Tranches d'âge. facteur = part de la portion de référence (12-36 mois). min/max en mois. */
ages:[
 {id:'0-6',label:'0 à 6 mois',min:0,max:6,facteur:0,texture:'Lait maternel ou infantile uniquement. Pas d\'aliment solide sans avis médical.'},
 {id:'6-8',label:'6 à 8 mois',min:6,max:8,facteur:0.5,texture:'Lisse : mixée très finement, sans morceaux.'},
 {id:'8-10',label:'8 à 10 mois',min:8,max:10,facteur:0.6,texture:'Mouliné ou écrasé à la fourchette.'},
 {id:'10-12',label:'10 à 12 mois',min:10,max:12,facteur:0.7,texture:'Écrasé avec de petits morceaux fondants ; bâtonnets tendres à saisir.'},
 {id:'12-36',label:'12 à 36 mois',min:12,max:36,facteur:1,texture:'Petits morceaux tendres, coupés ; viande hachée ou très tendre.'}
],

/* Composition indicative d'un repas selon l'âge (grammes, à valider : GEMRCN / protocole de la crèche) */
portions:[
 {age:'6-8',legumes:'100 g',feculents:'30 g',viande:'10 g (ou ¼ d\'œuf)',fruit:'60 g'},
 {age:'8-10',legumes:'120 g',feculents:'40 g',viande:'15 g (ou ⅓ d\'œuf)',fruit:'70 g'},
 {age:'10-12',legumes:'130 g',feculents:'50 g',viande:'20 g (ou ½ œuf)',fruit:'80 g'},
 {age:'12-36',legumes:'150 g',feculents:'80 g (cuits)',viande:'25 g (ou ½ œuf)',fruit:'100 g'}
],

/* 14 allergènes à déclaration obligatoire (UE). Détection par mots-clés dans le nom de l'ingrédient (sans accents). */
allergenes:[
 {id:'gluten',label:'Gluten',re:/\b(ble|farine|pates?|semoule|couscous|boulgour|pain|orge|seigle|avoine|epeautre|biscuits?|spaghettis?|pancakes?|gnocchis?|panure|chapelure|tagliatelles?|macaronis?|vermicelles?)\b/},
 {id:'crustaces',label:'Crustacés',re:/\b(crevettes?|crabe|homard|langoustines?|ecrevisses?)\b/},
 {id:'oeuf',label:'Œufs',re:/\b(oeufs?|mayonnaise|omelette)\b/},
 {id:'poisson',label:'Poissons',re:/\b(saumon|thon|cabillaud|colin|merlu|sardines?|maquereaux?|poisson|lieu|truite|sole|anchois|dorade)\b/},
 {id:'arachide',label:'Arachides',re:/\b(arachides?|cacahuetes?)\b/},
 {id:'soja',label:'Soja',re:/\b(soja|tofu|edamame|tempeh)\b/},
 {id:'lait',label:'Lait',re:/\b(lait(?! de (?:coco|soja|amande|avoine|riz))|fromages?|yaourts?|yogourts?|creme|beurre(?! de (?:cacahuetes?|cajou|amande))|ricotta|mozzarella|gruyere|emmental|parmesan|skyr|petits? suisses?|kefir|comte)\b/},
 {id:'coque',label:'Fruits à coque',re:/\b(noix(?! de (?:coco|muscade))|noisettes?|amandes?|pistaches?|cajou|pecans?|macadamia)\b/},
 {id:'celeri',label:'Céleri',re:/\bceleri\b/},
 {id:'moutarde',label:'Moutarde',re:/\bmoutarde\b/},
 {id:'sesame',label:'Sésame',re:/\b(sesame|tahin|tahini)\b/},
 {id:'sulfites',label:'Sulfites',re:/\b(sulfites?|vin blanc|vin rouge|abricots? secs?|raisins? secs?)\b/},
 {id:'lupin',label:'Lupin',re:/\blupin\b/},
 {id:'mollusques',label:'Mollusques',re:/\b(moules?|huitres?|escargots?|calamars?|poulpes?|coquilles? saint)\b/}
],

/* Aliments à éviter selon l'âge : l'alerte s'applique si un enfant de la tranche a moins de maxMois. sauf = exception. */
interdits:[
 {re:/\bmiel\b/,maxMois:12,msg:'Miel interdit avant 1 an (risque de botulisme infantile).'},
 {re:/\b(sel|bouillon cube|bouillon en cube)\b/,maxMois:12,msg:'Pas de sel ajouté avant 1 an.'},
 {re:/\b(sucre|sirop|confiture|pate a tartiner|bonbons?)\b/,maxMois:12,msg:'Pas de sucre ajouté avant 1 an.'},
 {re:/\blait (?:de vache|entier|demi ecreme|ecreme)\b/,maxMois:12,msg:'Pas de lait de vache en boisson avant 1 an : lait infantile.'},
 {re:/\b(boissons? vegetales?|lait (?:d amande|de soja|d avoine|de riz))\b/,maxMois:12,msg:'Les boissons végétales ne remplacent pas le lait infantile avant 1 an.'},
 {re:/\b(noix(?! de (?:coco|muscade))|noisettes?|amandes?|pistaches?|cajou|pecans?|cacahuetes?|arachides?)\b/,sauf:/\b(puree|poudre|beurre)\b/,maxMois:48,msg:'Fruits à coque entiers ou en morceaux : risque d\'étouffement avant 4 ans (uniquement en purée ou en poudre).'},
 {re:/\b(raisins?(?! secs?)|tomates? cerise|(?<!huile d )olives?|pop ?corn)\b/,maxMois:48,msg:'Aliment rond ou dur : risque d\'étouffement avant 4 ans (couper en quatre ou éviter).'},
 {re:/\b(tartare|carpaccio|sushis?|crue?s?)\b/,sauf:/\blait cru\b/,maxMois:36,msg:'Viande, poisson ou œuf cru : à éviter avant 3 ans (cuisson à cœur).'},
 {re:/\b(lait cru|camembert|brie|roquefort|chevre frais cru)\b/,maxMois:60,msg:'Fromage au lait cru ou à pâte molle : à éviter avant 5 ans.'},
 {re:/\b(espadon|requin|marlin|thon rouge|lamproie)\b/,maxMois:36,msg:'Poisson prédateur sauvage (mercure) : à éviter avant 3 ans.'}
],

/* Repères généraux affichés dans l'onglet Règles */
regles:[
 {titre:'0 à 6 mois',items:['Lait maternel ou lait infantile uniquement.','La diversification ne commence pas avant 4 mois révolus, en général vers 6 mois, sur avis du médecin.']},
 {titre:'Textures par âge',items:['6-8 mois : lisse.','8-10 mois : mouliné, écrasé.','10-12 mois : petits morceaux fondants, bâtonnets tendres.','12-36 mois : petits morceaux, viande hachée ou très tendre.']},
 {titre:'Cuisson et hygiène',items:['Viande, poisson et œufs toujours bien cuits à cœur.','Poisson : retirer toutes les arêtes.','Ne pas réchauffer plusieurs fois un plat ; jeter les restes de l\'assiette.']},
 {titre:'Allergènes',items:['Les 14 allergènes réglementaires sont détectés automatiquement d\'après le nom des ingrédients : vérifier toujours les étiquettes.','Un allergène nouveau s\'introduit en petite quantité, à la maison d\'abord, selon l\'avis du médecin et le protocole de la crèche.']}
],

/* Recettes : ing = [nom, grammes] pour UNE portion de référence (12-36 mois) ; min = âge minimal en mois. */
recettes:[
 {id:'pe1',titre:'Purée de carottes et pommes de terre',min:6,type:'plat',ing:[['carotte',100],['pomme de terre',50],['huile de colza',3]],
  etapes:['Éplucher et couper les légumes.','Cuire à la vapeur ou à l\'eau jusqu\'à tendreté.','Mixer avec un peu d\'eau de cuisson selon la texture voulue.','Ajouter l\'huile de colza hors du feu.']},
 {id:'pe2',titre:'Purée de courgettes et riz',min:6,type:'plat',ing:[['courgette',120],['riz',20],['huile d\'olive',3]],
  etapes:['Cuire le riz dans l\'eau sans sel.','Cuire la courgette épluchée à la vapeur.','Mixer ensemble selon la texture.','Ajouter l\'huile d\'olive.']},
 {id:'pe3',titre:'Purée de patate douce et poulet',min:6,type:'plat',ing:[['patate douce',100],['blanc de poulet',25],['huile de colza',3]],
  etapes:['Cuire la patate douce à la vapeur.','Cuire le poulet à cœur (aucune partie rose).','Mixer ou écraser ensemble.','Ajouter l\'huile.']},
 {id:'pe4',titre:'Brocoli, pomme de terre et saumon',min:6,type:'plat',ing:[['brocoli',80],['pomme de terre',60],['saumon',25],['huile de colza',3]],
  etapes:['Cuire les légumes à la vapeur.','Cuire le saumon à cœur et retirer toutes les arêtes.','Mixer ou écraser selon l\'âge.','Ajouter l\'huile.']},
 {id:'pe5',titre:'Lentilles corail et carottes',min:6,type:'plat',ing:[['lentilles corail',25],['carotte',80],['huile d\'olive',3]],
  etapes:['Rincer les lentilles.','Cuire lentilles et carottes dans l\'eau sans sel 15 min.','Mixer finement pour les plus petits, écraser ensuite.','Ajouter l\'huile.']},
 {id:'pe6',titre:'Œuf dur écrasé aux haricots verts',min:8,type:'plat',ing:[['oeuf',25],['haricots verts',100],['pomme de terre',50]],
  etapes:['Cuire l\'œuf dur 10 min.','Cuire haricots verts et pomme de terre.','Mixer ou écraser les légumes, écraser l\'œuf à la fourchette.','Mélanger.']},
 {id:'pe7',titre:'Houmous doux sans sel',min:8,type:'plat',ing:[['pois chiches',50],['huile d\'olive',3],['purée de sésame',5],['citron',2]],
  etapes:['Rincer les pois chiches.','Mixer avec l\'huile, la purée de sésame et le jus de citron, un peu d\'eau.','Servir en petite quantité avec du pain tendre ou des légumes cuits.']},
 {id:'pe8',titre:'Bâtonnets de patate douce rôtis (sans sel)',min:10,type:'plat',ing:[['patate douce',120],['huile d\'olive',3]],
  etapes:['Couper en bâtonnets épais.','Enrober d\'huile et cuire au four à 200 °C, 25 min, jusqu\'à ce qu\'ils soient très tendres.','Laisser tiédir.']},
 {id:'pe9',titre:'Pâtes aux petits légumes et dinde',min:12,type:'plat',ing:[['pâtes',40],['dinde',25],['courgette',60],['carotte',40],['huile d\'olive',3],['gruyère',5]],
  etapes:['Cuire les pâtes dans l\'eau sans sel.','Cuire la dinde hachée à cœur avec les légumes coupés petits.','Mélanger, saupoudrer de gruyère.','Couper les pâtes en petits morceaux au besoin.']},
 {id:'pe10',titre:'Gratin de courgettes au fromage blanc',min:12,type:'plat',ing:[['courgette',120],['pomme de terre',50],['fromage blanc',40],['gruyère',5]],
  etapes:['Cuire courgettes et pomme de terre.','Mélanger avec le fromage blanc.','Saupoudrer de gruyère et gratiner au four.']},
 {id:'pe11',titre:'Bœuf haché, riz et haricots verts',min:12,type:'plat',ing:[['bœuf haché',25],['riz',30],['haricots verts',80],['huile de colza',3]],
  etapes:['Cuire le riz dans l\'eau sans sel.','Cuire la viande hachée à cœur (aucune partie rose).','Cuire les haricots verts, les couper petits.','Mélanger.']},
 {id:'pe12',titre:'Compote pomme-poire',min:6,type:'dessert',ing:[['pomme',80],['poire',40]],
  etapes:['Éplucher et couper les fruits.','Cuire à feu doux avec un peu d\'eau.','Mixer ou écraser. Sans sucre ajouté.']},
 {id:'pe13',titre:'Yaourt nature et banane écrasée',min:8,type:'dessert',ing:[['yaourt nature',100],['banane',50]],
  etapes:['Écraser la banane.','Mélanger au yaourt nature.']},
 {id:'pe14',titre:'Bouillie de semoule au lait infantile',min:8,type:'goûter',ing:[['semoule',15],['lait infantile',150]],
  etapes:['Chauffer le lait infantile.','Verser la semoule en pluie et cuire 5 min en remuant.','Laisser tiédir.']},
 {id:'pe15',titre:'Pancakes banane-œuf sans sucre ajouté',min:12,type:'goûter',ing:[['banane',60],['oeuf',25],['farine de blé',20],['lait',20]],
  etapes:['Écraser la banane, ajouter l\'œuf, la farine et le lait.','Cuire à la poêle antiadhésive 2 min de chaque côté.','Laisser tiédir et couper en petits morceaux.']},
 {id:'pe16',titre:'Velouté de potimarron',min:6,type:'dîner',ing:[['potimarron',120],['pomme de terre',40],['huile de colza',3]],
  etapes:['Éplucher et couper le potimarron et la pomme de terre.','Cuire à la vapeur ou à l\'eau jusqu\'à tendreté.','Mixer avec un peu d\'eau de cuisson.','Ajouter l\'huile hors du feu.']},
 {id:'pe17',titre:'Soupe de légumes verts',min:6,type:'dîner',ing:[['poireau',60],['courgette',60],['pomme de terre',50],['huile de colza',3]],
  etapes:['Cuire les légumes épluchés dans l\'eau sans sel.','Mixer finement ou écraser selon l\'âge.','Ajouter l\'huile hors du feu.']},
 {id:'pe18',titre:'Omelette douce aux courgettes',min:8,type:'dîner',ing:[['oeuf',50],['courgette',60],['huile d\'olive',3]],
  etapes:['Faire revenir la courgette râpée 5 min.','Verser l\'œuf battu et cuire à cœur (omelette bien cuite, aucune partie liquide).','Couper en petits morceaux.']},
 {id:'pe19',titre:'Semoule aux petits légumes',min:8,type:'dîner',ing:[['semoule',40],['carotte',50],['courgette',50],['huile d\'olive',3]],
  etapes:['Cuire les légumes à la vapeur.','Cuire la semoule dans l\'eau sans sel.','Écraser ou mixer légèrement les légumes, mélanger avec la semoule et l\'huile.']},
 {id:'pe20',titre:'Dahl doux de lentilles corail',min:10,type:'dîner',ing:[['lentilles corail',30],['carotte',50],['tomate concassée',40],['lait de coco',20],['huile d\'olive',3]],
  etapes:['Cuire lentilles, carotte et tomate 15 min dans l\'eau sans sel.','Ajouter le lait de coco.','Écraser à la fourchette ou mixer selon l\'âge.']},
 {id:'pe21',titre:'Gratin de chou-fleur à la ricotta',min:12,type:'dîner',ing:[['chou-fleur',100],['pomme de terre',40],['ricotta',30],['gruyère',5]],
  etapes:['Cuire le chou-fleur et la pomme de terre.','Mélanger avec la ricotta.','Saupoudrer de gruyère et gratiner au four.']},
 {id:'pe22',titre:'Riz au thon et haricots verts',min:12,type:'dîner',ing:[['riz',30],['thon',25],['haricots verts',80],['huile d\'olive',3]],
  etapes:['Cuire le riz dans l\'eau sans sel.','Cuire les haricots verts et les couper petits.','Émietter le thon (en boîte au naturel, égoutté, sans arêtes) et mélanger.']},
 {id:'pe23',titre:'Pâtes au brocoli et fromage blanc',min:12,type:'dîner',ing:[['pâtes',40],['brocoli',80],['fromage blanc',30],['gruyère',5]],
  etapes:['Cuire les pâtes dans l\'eau sans sel.','Cuire le brocoli et le hacher finement.','Mélanger avec le fromage blanc et le gruyère.']}
]
};
})(typeof window!=='undefined'?window:globalThis);
