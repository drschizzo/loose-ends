# Loose Ends

Un lacet échappé d'une basket grimpe parmi des fils. Prototype du concept, bâti sur le moteur de câbles [cable-kit](https://github.com/drschizzo/cable-kit) (solveur AVBD et tubes three.js). La réflexion de fond (ce que seul ce moteur permet, et comment varier les niveaux) est dans [DESIGN.md](DESIGN.md).

**[Jouer en ligne](https://drschizzo.github.io/loose-ends/)** : la version publiée à chaque push sur `main` (GitHub Actions, [.github/workflows/pages.yml](.github/workflows/pages.yml)).

```bash
git clone --recursive https://github.com/drschizzo/loose-ends.git
cd loose-ends
npm install
npm run dev        # http://localhost:5173
```

Le moteur est le sous-module [cable-kit](cable-kit), fixé à un commit ; dans un clone fait sans `--recursive`, `git submodule update --init` le récupère. Ses deux paquets sont des dépendances `file:` du jeu, qui les lit depuis leurs sources (la condition `source` de leurs `exports`, dans [vite.config.ts](vite.config.ts) et [tsconfig.json](tsconfig.json)) : une modification du moteur se voit tout de suite.

Pour faire avancer le moteur : travailler dans `cable-kit/` (c'est un dépôt git complet), y commiter et pousser sur GitHub, puis commiter ici le nouveau commit du sous-module (`git add cable-kit`). La version en ligne prend le commit enregistré, qui doit donc être sur GitHub.

## Jouer

Les deux bouts du lacet sont deux mains : **la tête** (orange, avec les yeux) et **la queue** (bleue).

| Commande | Effet |
|---|---|
| clic gauche maintenu / A | la tête s'accroche (elle se colle) à ce qu'elle touche, et tient tant que le bouton est maintenu |
| clic droit maintenu / D | pareil pour la queue |
| souris | le bout qui ne tient rien suit le pointeur. Si aucun ne tient, c'est le plus proche du pointeur. Il tire avec 1,3 fois le poids du lacet si l'autre bout est accroché ou si le lacet repose sur une barre ou une étagère (comme sur une poulie) ou sur une corde (un fil tendu, un filet, une corde où il est pris), et 0,45 fois seulement sur le sol (le lacet ne peut pas grimper sans appui) |
| Espace (maintenu) | l'aiguillette se faufile : les 8 derniers centimètres du bout qui suit la souris passent à travers les autres cordes et à travers le lacet lui-même (ils brillent en bleu), donc devant ou derrière. Coincé dans un nœud (le bout tire fort sans avancer), il **force le passage** : la partie qui se faufile s'allonge jusqu'à 32 cm, mais s'effiloche (12 % d'usure par seconde). Le reste du lacet reste solide et suit le chemin du bout : pour se démêler, il faut ramener le bout par où il est passé. Relâchée, l'aiguillette redevient solide là où elle ne touche rien, et repousse les cordes là où elle les chevauche encore |
| coup sec de souris | **lancer** : couché sans rien qui le tienne, le lacet lance son bout libre d'un coup sec du pointeur vers le haut, comme on fouette une corde. Le bout part avec de l'élan et tire fort un instant (2 fois le poids du lacet, 0,2 s) : il monte de 20 à 25 cm plus haut qu'en tirant seulement. Le clic maintenu, il s'accroche à la prise qu'il touche en haut de son vol. Un lancer toutes les 0,9 s |
| W, Z ou ↑ (maintenu) | regarder plus haut : la caméra recule et monte, pour lire la voie avant de s'y engager (au repos sur une prise, elle recule un peu d'elle-même) |
| R | revenir au dernier poteau |
| M | couper ou rétablir le son |
| H | masquer ou afficher l'aide contextuelle (et les cartes des deux bouts) |

**Un seul bouton** (une case de l'écran titre) : un clic accroche le bout libre et lâche l'autre, une prise par clic ; le clic droit lâche tout. **À la manette** : le stick gauche mène le bout libre autour de sa position, les gâchettes (ou les boutons de tranche) accrochent la tête et la queue, A faufile l'aiguillette, B regarde plus haut, Y ramène au poteau, Start commence. Le pointeur prend la couleur du bout qu'il mène (un anneau orange ou bleu).

Pour grimper, on alterne : un bout accroché, l'autre monte jusqu'à une barre plus haute, on l'accroche, on lâche le premier. Quand un bout libre peut s'accrocher, un anneau de sa couleur montre où il se collera, avec le bouton à maintenir. Un anneau autour de chaque prise affiche l'énergie qui lui reste. **Une prise fatigue comme la main d'un grimpeur** : pendu sous elle, le lacet la laisse récupérer (elle brille en vert) ; c'est quand l'autre bout s'étire pour monter qu'elle s'épuise, d'autant plus vite que ce bout tire fort (la force de sa cible, mesurée par le solveur). La portion que le bout tendu soulève, jusqu'au premier appui, rougit avec l'effort. Un lacet qui tire sur la main plus que son propre poids (tendu presque à l'horizontale, rattrapé en pleine chute) la fatigue en plus. Une étiquette au-dessus de la prise donne le chiffre : « effort 60 % ↓ », « repos ↑ », « sur une corde ↓ » (une corde ne laisse jamais reposer). Mesuré sur 4 s, une prise à 60 % : pendue, elle remonte à 100 % ; le bout tendu 1 m vers le haut, elle descend ; tendu de côté (le lacet presque horizontal tire aussi sur la main), elle s'épuise.

Le bout libre suit la souris avec un léger retard (`PLAY.inertia`, 0,12 s) : le lacet a du poids. Il tire avec 0,85 fois le poids du lacet : assez pour atteindre une prise proche (40 cm plus haut, 35 cm à côté), pas pour dresser le lacet droit au-dessus de la main. Pour monter plus haut, il faut s'élancer, ou passer le lacet par-dessus une barre (mesuré : à 1,3 fois le poids, comme avant, il atteignait une barre 95 cm droit au-dessus ; à 0,8, il la manque de 32 cm).

- **Se rattraper coûte.** Une main qui saisit le lacet en mouvement encaisse le choc : au-delà de 1,2 m/s (le lacet entier, son centre de masse), chaque m/s de plus coûte 45 % de l'endurance de la prise, et use le bout qui saisit. Une chute de 40 cm en coûte les trois quarts ; à 80 cm, la prise est arrachée et le lacet continue de tomber. Saisir au sommet d'un balancement ne coûte rien.
- **Le lacet s'use, fibre à fibre.** Chaque nœud a son usure, de 0 (neuf) à 1 (déchiré) : les ciseaux l'entaillent (55 % par coup), la flamme la brûle (110 % par seconde), le frottement l'use quand il glisse sur une surface (50 % par mètre sur du bois, moins sur le caoutchouc et le chrome), les chocs usent le bout qui saisit. Le shader masque les fibres en proportion (d'après le rendu de tissus au niveau de la fibre de Wu et Yuksel, I3D 2017) : des brins disparaissent, l'âme apparaît, les fibres cassées s'ébouriffent, le lacet s'amincit. Déchiré, il casse à cet endroit : le morceau qu'un bout tient continue, plus court, l'autre tombe. Plus court que 55 cm, il retourne au dernier poteau. Un poteau le rend neuf.

- **Endurance = vraie tension.** Une prise s'use selon la force que le solveur mesure à cet endroit (`targetPull`, le long du lacet). Pendu à bout de bras, elle tient environ 4 secondes. La charge est lissée sur un quart de seconde, pour qu'un à-coup ne vide pas une prise d'un coup. Drapé par-dessus une barre voisine, le frottement porte le poids (cabestan) et la prise se repose.
- **Les matériaux comptent.** Le bois se prend. Le chrome ne se prend pas et glisse (μ 0,1). Le caoutchouc rouge accroche (μ 1) et fatigue moitié moins.
- **Les poteaux dorés sauvegardent si la physique le veut.** Il faut avoir au moins un demi-tour en contact avec le poteau, ne rien tenir, et que rien ne glisse sur le poteau pendant une seconde. Un drapé équilibré tient, un drapé trop déséquilibré (au-delà de e^(μπ)) glisse : c'est le cabestan qui décide.
- **Lianes et rideau** : les cordes pendues s'agrippent (une sangle `addBundle`) et se balancent.

## La montée

Le jeu est une seule montée, sans fin, qui peut durer des heures. L'écran titre propose **Continuer** (la montée laissée la dernière fois, depuis son dernier poteau) et **Nouvelle montée** (une autre graine, depuis le sol ; `?new` dans l'adresse fait de même). La montée est faite de **sections** empilées. Chacune assemble trois **pièces** indépendantes, décrites en données dans [src/gen/catalog.json](src/gen/catalog.json) (voir [L'éditeur de niveaux](#léditeur-de-niveaux)) :

| Famille | Rôle | Pièces |
|---|---|---|
| **montée** | du dernier appui à une **station** (une barre) plus haut | barres, barres mobiles, bougies, cascade, ciseaux, rideau de cordes, fils posés, fils à linge, écheveau, corde lisse, pendule, échelle de corde, forêt de lianes, filet, escalier de chrome, portemanteau, fils de couture, monte-charge, radiateur, toile d'araignée, courant d'air, lampe qui cherche, horloge, tyrolienne |
| **obstacle** | au-dessus de la station, jusqu'à l'appui suivant | rien, trappe, trappe minutée, fente, fente gardée, surplomb, chicanes, traversée sous un plafond |
| **clé** | ce qui ouvre la trappe | poteau doré, œillets, œillets croisés, tirette, porte à ressort, colonne d'œillets, deux tirettes |

Une pièce ne connaît que l'appui d'où elle part et celui où elle arrive. N'importe quelle montée mène donc à n'importe quel obstacle, et n'importe quelle clé ouvre n'importe quelle trappe. Une pièce nouvelle, de n'importe quelle famille, fait des sections nouvelles avec toutes les autres. Les dispositions viennent des cinq niveaux faits main du premier prototype, où elles ont été jouées (ils ont été retirés depuis) : entre deux prises, jamais plus d'environ 50 cm de montée ni 60 cm d'écart.

**Assemblage**, façon *wave function collapse* en une dimension ([src/gen/course.ts](src/gen/course.ts)). Chaque pièce déclare ses « prises » : de quel côté elle arrive, son effort (0 à 3), les cordes qu'elle ajoute. Parmi toutes les combinaisons, une section est tirée (au poids) parmi celles qui respectent les règles de voisinage :

- jamais deux montées chargées en cordes à la suite (le solveur ramerait), ni la même pièce deux fois de suite ;
- un effort plafonné qui monte avec le parcours, et une section plus facile après une difficile ;
- une pièce nouvelle arrive seule, avec des pièces faciles autour, et sa ligne d'aide la première fois ;
- un **tronçon** finit sur un poteau (une trappe dont la clé est le poteau), de 4 à 6 sections. **Un tronçon est un étage** : dans la maison, chaque étage enseigne ses pièces (celles de ses `favours`, dans le catalogue) ; une pièce n'arrive qu'à l'étage qui l'enseigne, seule la première fois, puis souvent. Le tronçon finit sur son **examen** : la montée sous le poteau est le morceau de bravoure de l'étage (une pièce marquée `bravura`) ;
- à chaque poteau (à partir de la section 12), le joueur **choisit la trappe** au-dessus : normale, ou avec une variante (glissante : plus de chrome ; lâche : fils détendus ; sans repos : pas de caoutchouc ; espacée : montées plus hautes), qui paie double. Le choix est gardé avec la montée, et le tronçon est retiré au sort de nouveau depuis l'état du parcours au poteau (`Course.pick`) ;
- le parcours ajoute de lui-même, tiré de nombres à part (les pièces restent les mêmes) : un bouton là où il est risqué d'aller (juste au-dessus d'un danger, ou au loin de l'autre côté), des **pannes** de lumière sur les étages sombres (la chambre, le grenier, la nuit, les étoiles), et à l'aube, pendu à son poteau, l'autre lacet.

| Étage | Son morceau de bravoure |
|---|---|
| L'entrée | **le manège** : six barres sur une roue qui tourne lentement |
| La penderie | **les monte-charges** : l'un hisse jusqu'à l'autre |
| La chambre des petits | **le mobile** : trois barres qui tournent chacune à son rythme |
| L'atelier | **l'aiguille** : une lame qui va et vient en travers de la voie |
| La buanderie | **le tambour** : une roue de caoutchouc rapide, de l'eau au milieu |
| Le salon | **le ventilateur** : trois pales qui emportent, des rafales |
| La chambre | **les projecteurs** : deux faisceaux qui se croisent |
| Le grenier | **la grande toile** : une toile collante sur toute la largeur |
| Le toit | **la tempête** : le vent d'un côté, puis de l'autre |
| La nuit | **les étoiles filantes** : des barres qui filent en travers |
| L'aube | **la grande roue** ; et sur le poteau, l'autre lacet |

Au-delà, le ciel tire ses examens parmi ceux-là. Les roues sont des barres mobiles « en rond » (`orbit`), le ventilateur une horloge à trois bras (`arms`), l'aiguille un danger qui va et vient (`period` sur un `hazard`), les pannes une étape `blackout`.

Quand aucune combinaison ne passe, les règles cèdent une à une, la moins importante d'abord. Sur 400 sections, aucune barre ne chevauche une autre pièce, et la première prise de chaque section est à portée de la précédente (vérifié par script).

**Le stress de la chute.** Le monde construit est une **fenêtre** du parcours : de la section sous le dernier poteau sauvegardé jusqu'au poteau suivant, dont la trappe reste fermée tant qu'on ne s'y est pas sauvegardé. Tout ce qui sépare le lacet du dernier poteau est là : une chute est une vraie chute, on peut se rattraper en route. Tomber sous le poteau ramène au poteau. À chaque sauvegarde, la fenêtre monte, et le monde est reconstruit autour du lacet, les cordes déjà posées gardant leur place. Mesuré : 1 à 5 ms pour reconstruire, 2 à 3 ms par pas au repos. Juste après, le temps que les cordes nouvelles se posent (une à deux secondes), un pas peut coûter jusqu'à 22 ms quand le tronçon est long.

## L'éditeur de niveaux

À côté du jeu, `npm run dev` sert aussi l'éditeur : **http://localhost:5173/editor.html** (en local seulement, il écrit dans le dépôt ; il n'est pas publié). Il montre une montée entière, dessinée comme le jeu la dessine (le décor des étages, les cordes simulées), et le catalogue dont elle est assemblée, à modifier.

- **La montée** : une graine, ses sections étage par étage, de quoi chacune est faite. Une section choisie, on peut y **essayer d'autres pièces** (elles y sont choisies au lieu d'être tirées ; les sections au-dessus en changent, puisqu'elles sont tirées à la suite) et **jouer ici** : le jeu s'ouvre dans un autre onglet, le lacet pendu à la prise où la section commence (`?seed=…&at=…`, et `&ascent=…&obstacle=…&key=…` pour les pièces choisies). Cet essai ne touche pas à la montée gardée.
- **Les pièces** : les montées, obstacles et clés, leurs réglages (effort, section d'apparition, poids, hauteur de montée…) et leurs **étapes** : ce qu'elles posent où (une barre, un fil tendu, des œillets, un plancher…), ou comment (des barres en zigzag, répéter, si). Une position est un nombre ou une expression, lue des prises que la pièce connaît : `from` et `to` pour une montée, `st`, `k` et `key` pour un obstacle, `st`, `k` et `F` pour une clé, plus `rnd()`, `jitter(a)`, `lerp`… (l'aide est dans l'éditeur, le détail en tête de [src/gen/layout.ts](src/gen/layout.ts)). Une pièce nouvelle entre dans la montée dès sa section d'apparition.
- **Réglages** : les variantes de tronçon, les règles de l'assemblage qui sont des nombres (effort maximal, longueur des tronçons…), ce que chaque étage a de plus.

Chaque modification refait la montée aussitôt, et la vue suit. Survoler une étape montre dans la vue ce qu'elle a posé ; cliquer un élément de la vue ouvre la pièce et l'étape qui l'ont posé. Une étape qui ne se calcule plus est signalée en rouge, et la vue garde la dernière montée valide. **Enregistrer** (⌘S) vérifie le catalogue sur quelques graines puis écrit `src/gen/catalog.json` ; le jeu ouvert se recharge avec. D'ici là, un brouillon est gardé dans le navigateur.

La vue : la molette monte et descend dans la montée, avec ctrl (ou en pinçant) elle zoome ; glisser déplace la vue, avec maj ou le bouton droit elle tourne ; un double clic remet face au mur. Par-dessus le jeu : les débuts de section (en or, ceux qui finissent sur un poteau), la prise où chacune finit (un anneau vert), les zones d'aide (en pointillés bleus), la course des barres mobiles (en orange).

Les étapes sont jouées dans l'ordre, et chaque tirage de `rnd()` vient à son tour : passer les pièces du code aux données n'a rien changé, les mêmes graines donnent les mêmes montées (vérifié sur 8 graines × 300 sections, élément par élément). Changer l'ordre des étapes d'une pièce change en revanche toute la suite de la montée.

## Les étages, et ce qu'ils racontent

La montée traverse une maison, puis le ciel. Le lacet était l'un d'une paire, et il a perdu l'autre : il grimpe seul pour le retrouver, de pièce en pièce. Un fil rouge court sur les murs d'étage en étage (le fil qui, dit-on, relie deux êtres faits l'un pour l'autre) ; en sortant du grenier il devient lumière, et à l'aube il finit en nœud, sous une étoile : l'autre n'est plus loin. Au-dessus, le ciel ne finit pas, et chaque matin il est un peu plus près. Le carton de chaque étage le dit en une ligne (« Des paires partout. Pas la sienne. », « Même les chaussettes finissent par se retrouver. »).

| Étage | Ce qu'il a de plus |
|---|---|
| L'entrée | barres |
| La penderie | rideaux de cordes |
| La chambre des petits | échelles, filets, chicanes |
| L'atelier | écheveaux, œillets, ciseaux |
| La buanderie | fils à linge, cascades |
| Le salon | barres mobiles, bougies, pendules |
| La chambre | fils posés, tirettes |
| Le grenier | lianes, filets |
| Le toit | cordes lisses, pendules |
| **Le ciel** : la nuit, l'aube, puis pour toujours les nuages, le grand ciel, les étoiles, le matin | |

Chaque étage a son étoffe, son bois, sa lumière (chaude dans l'entrée, froide dans la buanderie, crépuscule dans la chambre, la nuit au-dessus du toit), ce qui flotte dans l'air (poussière, peluches, bulles, étincelles). Ce qui se prend garde son aspect d'étage en étage : le bois est toujours chaud et mat (un crayon dans la chambre des petits), le chrome toujours froid et brillant, le caoutchouc rouge, les poteaux dorés. Le décor reste sur le mur, plus terne que ce qui se joue, et ne coûte rien au solveur.

**Plus d'objets au mur, plus rien au premier plan.** Les cadres, clés, parapluies, cartons, dessins et silhouettes de premier plan peints sur canevas ont été retirés : plats et simples, ils juraient avec le lacet et les barres, et la montée générée les répétait sans fin. Un étage se dit maintenant par sa matière, sa couleur et sa lumière. Au ciel restent la lune et les étoiles filantes ; les nuages peints sont devenus des bancs de brume.

**Des appliqués** ([src/view/decor.ts](src/view/decor.ts), `patchOf`) : sur l'étoffe de chaque étage, de grandes pièces d'une autre étoffe, cousues, chacune de sa taille : des ronds dans l'entrée et la chambre, des losanges dans la penderie, un damier chez les petits, des zigzags dans l'atelier, des vagues dans la buanderie, des anneaux au salon, des rayures au grenier. Elles sont un peu en relief, ont une rangée de points de couture le long du bord et une ombre juste au-dehors. Le décor reste abstrait, mais chaque étage se reconnaît d'un coup d'œil. Au ciel, des **cerfs-volants** au loin (un losange, sa queue de nœuds, sa ficelle qui descend hors de vue), une **volée d'oiseaux** qui traverse, et chaque barre pend à deux cordes qui montent et s'effacent, comme une balançoire.

**Ce qui se prend se lit d'un coup d'œil.** Le bout de chaque barre, face à nous, est un disque : le bois montre son bois de bout (des cernes clairs), le caoutchouc son rouge, le poteau son or, et tous trois luisent un peu dans le noir ; le chrome montre un disque froid et sombre, barré d'une croix, qui ne luit jamais. Une trappe porte la couleur de ce qui l'ouvre, des charnières, un anneau pour la soulever, et la lumière passe sous elle par une fente, plus vive quand elle va s'ouvrir.

**Les yeux de la tête** regardent la prise qu'elle pourrait prendre, clignent, se plissent quand une prise fatigue, s'écarquillent quand le lacet tombe.

**L'interface est cousue** : chaque étiquette est une bande d'étoffe à bord piqué (une ligne de points juste à l'intérieur), les titres dans une police de livre. La barre du haut dit l'étage, le temps, les boutons et la hauteur ; sous elle, l'élan ; à droite, le défi et ce qu'on porte. Elle tient sur un téléphone.

**Les murs sont en étoffe** (l'ancien papier peint, avec ses fenêtres, reste visible avec `?papier` dans l'adresse) : du tissu tissé dans le shader (`cloth` dans [src/view/decor.ts](src/view/decor.ts)) : lin dans l'entrée, feutre lavande dans la penderie, tricot à rayures chez les petits, sergé dans l'atelier, coton dans la buanderie, velours vert au salon et rose dans la chambre, toile brute au grenier ; sur le toit, une toile lâche et effilochée, le soir entre ses fils, qui fait passer de la maison au ciel. Les fils sont en relief sous la lumière rasante des lampes, un fil d'une autre couleur passe de temps en temps, l'étoffe pend en plis, plus sombre dans leurs creux. Deux étages se rejoignent par une couture. Plus de fenêtres, sauf la rare qui ouvre sur un souvenir : rien que la matière et la lumière. Le tissage s'efface en sa couleur moyenne quand ses fils deviennent plus fins que les pixels.

**L'air vit** ([src/view/atmosphere.ts](src/view/atmosphere.ts)), tout calculé sur le GPU à partir de l'horloge, sans rien dans le solveur :
- une brume devant le mur, éclairée par les lampes comme la poussière ou la vapeur (épaisse et montante dans la buanderie, dorée au grenier) ;
- un halo autour de chaque lampe, qui respire avec la flamme d'une bougie ;
- de la fumée au-dessus des bougies et des flammes du parcours ;
- au ciel, des bancs de brume à trois profondeurs, qui dérivent à trois vitesses ;
- une lueur qui remonte le fil rouge de temps en temps, comme s'il montrait le chemin ;
- les plis de l'étoffe qui bougent doucement, comme sous un courant d'air ;
- deux fois plus de poussières dans l'air.

Les lueurs et les bouffées de fumée n'écrivent pas de normale dans l'image : leur carré, face à la caméra, était pris pour une surface, et l'occlusion assombrissait un carré autour de chaque lampe.

**Quand change-t-on d'étage.** Sur un poteau, donc juste après une sauvegarde : le nouvel étage vient comme une récompense, avec son carton (son nom, une ligne) la première fois. Un étage par tronçon : la maison dure neuf tronçons (le ciel vers 75 m). Le temps qu'un bon joueur, sans chute, aurait mis est toujours estimé section par section (`STORY.pace` dans [src/tuning.ts](src/tuning.ts) : 22 s, plus 14 s par point d'effort, plus 9 s par mètre) : il règle la fatigue (ci-dessous) et le défi du chrono. **Cette estimation n'a pas été mesurée sur un vrai joueur** : la montée garde l'heure où chaque étage a été atteint (`game.pace` dans la console).

**La fatigue monte avec la montée.** Une prise s'épuise d'abord moins vite (× 0,45 dans l'entrée), puis de plus en plus vite selon ce même temps estimé, jusqu'à la vitesse réglée par `PLAY.drain` en arrivant au ciel (× 1), et au-delà encore plus vite, de 0,3 par tranche de 50 min, sans dépasser × 1,4. Pendre à une corde suit la même courbe. Réglable dans l'adresse : `?easy=0.6&harder=0.2&hardest=1.2`.

Rarement (une section sur neuf environ), une pièce ouvre une fenêtre sur ailleurs : la mer, la neige, le jardin. Quelques notes de boîte à musique quand le lacet y entre.

**Les couleurs.** Chaque étage atteint pour la première fois (sur n'importe quelle montée) peut en donner une, à choisir sous l'écran titre : le lacet du dimanche, de randonnée, le fil rouge, le lacet doré, le ruban bleu.

**L'autre lacet.** À l'aube, il pend au poteau. S'y sauvegarder, c'est le retrouver : l'écran « Retrouvés. », puis la montée continue **à deux** : les deux lacets noués, un lacet de 2 m moitié de sa couleur, moitié rouge, plus lourd, qui va deux fois plus loin et se drape partout. La paire reste à choisir ensuite, sur toutes les montées.

Le parcours a un étage par tronçon et un choix à chaque poteau depuis cette version : une montée gardée par une version d'avant ne retrouverait pas son poteau, elle n'est donc pas reprise (clé `loose-ends:climb:3`).

## Ce qui fait revenir

Tout ce qui dure d'une montée à l'autre est dans [src/play/progress.ts](src/play/progress.ts) (clé `loose-ends:progress`).

- **L'élan.** Des prises qui s'enchaînent (chacune moins de 2,6 s après la précédente) le font monter, jusqu'à 5 crans (les points lumineux sous la barre du haut). Chaque cran fatigue les prises 6 % moins vite. Trois secondes et demie sans prise, une chute, une prise arrachée ou épuisée, et il retombe. Au plus haut, une prise sur trois rapporte un bouton (`PLAY.flow*`).
- **Le rattrapage parfait.** Saisir au sommet d'un balancement (le lacet allait vite il y a un instant, il ne bouge presque plus) : un anneau doré, « Parfait ! », un carillon qui monte avec l'élan, deux crans d'élan, et la prise reprend 15 % de ses forces (`PLAY.perfect*`).
- **Les boutons** sont une monnaie, gardée d'une montée à l'autre (deux par bouton sur un tronçon choisi avec variante). Ils se dépensent à la **mercerie** de chaque poteau : des rustines (quand le lacet va casser, elle le répare là), des seconds souffles (quand une prise va lâcher, elle lui rend la moitié de ses forces), l'aiguillette longue (12 cm), la prise ferme (10 % de fatigue en moins), et les lacets d'autres sortes.
- **Les sortes de lacet** changent la façon de jouer le même parcours : **le fil** (1,42 m, fin et léger : il va loin, s'use 1,6 fois plus vite), **le cordon** (92 cm, épais : fatigue moins les prises, s'use moitié moins, passe mal dans les œillets), **le tuyau** (1 m, raide : tient à l'horizontale, fait pont, se drape mal). Le lacet porté est refait aussitôt, là où il est (`fitKind`, qui règle `LACE`).
- **Un défi par tronçon**, affiché en haut à droite : sans tomber, en moins d'un temps, en peu de prises, sans qu'une prise passe sous 25 %, sans user le lacet de moitié, l'élan au plus haut une fois, tous les boutons. Tenu, il paie au poteau (une fois et demie sur un tronçon avec variante) ; manqué, il est barré dès qu'on le sait.
- **Les temps de passage.** Au poteau, le temps depuis le précédent, comparé au meilleur sur cette graine (« −0:08 » en vert). Le meilleur passage est gardé comme **fantôme** : seize points le long du lacet, tous les dixièmes de seconde, en millimètres (environ 30 Ko pour deux minutes) ; la fois suivante, un lacet de perles pâles refait ce passage à côté ([src/view/ghost.ts](src/view/ghost.ts)). Les 24 derniers sont gardés.
- **La montée du jour** (`?daily`) : la même graine pour tout le monde, toute la journée, gardée à part, son record affiché sur l'écran titre. Il n'y a pas de serveur : pas de classement entre joueurs.
- **L'aide qui s'efface.** Chaque geste fait est compté (prises, lancers, aiguillette dans un nœud, repos, sauvegardes) : son aide ne revient plus une fois le geste su, et les cartes des deux bouts disparaissent après une douzaine de prises (H les rend).

## Le son

Tout est synthétisé ([src/sound.ts](src/sound.ts)), rien à charger :

- **le lacet lui-même**, d'après le solveur à chaque image : un froissement quand il glisse sur une surface (plus fort et plus aigu plus il va vite), un grincement qui monte quand une prise force au-delà du repos, le souffle de l'air quand il se balance ou tombe ;
- **chaque prise sonne sa matière** : le bois toque, le caoutchouc couine, le laiton tinte, une corde vibre ;
- **la musique de chaque étage** : son ton et sa gamme (do pentatonique dans l'entrée, la mineur dans la penderie, ré dorien dans l'atelier, si bémol lydien dans la chambre, mi mineur clairsemé la nuit…), une nappe de trois notes qui change d'accord toutes les huit battues, une basse, et une boîte à musique qui joue d'autant plus que le lacet monte dans l'étage, dans un écho de pièce.

## Code

Chaque dossier a un rôle, et ne dépend que de ceux d'au-dessus dans ce tableau.

| Dossier | Rôle |
|---|---|
| [src/tuning.ts](src/tuning.ts) | tous les réglages ; ceux de `PLAY` se changent dans l'adresse : `?muscle=2&drain=0.3` |
| [src/level/](src/level) | ce dont un niveau est fait (`level.ts` : données pures, `merge`, `placeKey`), ses formes statiques (`surfaces.ts`) |
| [src/gen/](src/gen) | le parcours sans fin : le catalogue des pièces (`catalog.json`), ce qui les pose (`layout.ts`, `parts.ts`), leur assemblage (`course.ts`), les étages (`floors.ts`) |
| [src/sim/](src/sim) | le monde physique construit depuis un niveau : la forme des cordes (`cords.ts`), le solveur et le lacet (`world.ts`) |
| [src/play/](src/play) | le lacet (`lace.ts` : bouts, prises, endurance, aiguillette, rattrapage parfait), les règles du niveau (`rules.ts` : boutons, œillets, trappes, tirettes, poteaux), les commandes (`controls.ts` : souris, un seul bouton, manette), la montée (`climb.ts` : sa fenêtre du parcours, ses choix, la montée du jour, ce qui est gardé d'une visite à l'autre), les couleurs trouvées (`laces.ts`), ce qui dure d'une montée à l'autre (`progress.ts` : boutons, mercerie, sortes de lacet, gestes sus, temps de passage, fantômes), l'aide (`advice.ts`) |
| [src/view/](src/view) | la scène, sa lumière et la caméra (`stage.ts`), l'image et ses passes (`image.ts`, `toneCurve.ts`, `bloom.ts`, `depthOfField.ts`, `cinema.ts`, d'après cablemanagement), les lampes des étages (`lamps.ts`), ce qui se joue du niveau (`scenery.ts`), le décor des étages (`decor.ts`, d'après `themes.ts`, peint par `paint.ts`), les cordes en tubes (`cordsView.ts`), les repères sur le lacet (`overlay.ts`), le fantôme (`ghost.ts`), la page (`hud.ts`) |
| [src/game.ts](src/game.ts) | la boucle : un pas du solveur, les règles, le dessin ; reconstruit le monde quand la partie le demande |
| [src/main.ts](src/main.ts) | le démarrage : continuer, nouvelle montée, ou l'essai ouvert par l'éditeur |
| [src/editor/](src/editor) | l'éditeur de niveaux (`editor.html`) : sa vue (`view.ts`, sur la scène du jeu), ses panneaux (`main.ts`, `steps.ts`), le plugin Vite qui lit et écrit le catalogue (`plugin.ts`) |

Dans la console, `game` expose la simulation. `game.run(60)` joue une seconde, même onglet caché, `game.pointer` déplace le pointeur, `game.hold(0, true)` maintient le bouton de la tête et `game.course.section(k)` montre une section du parcours sans fin (son étage : `.floor`). `game.warp(k)` y emmène le lacet ; pour que la caméra le suive, placer aussi `game.pointer` sur lui. `game.climb` et `game.progress` montrent la montée et ce qui dure d'une montée à l'autre ; `game.reknit()` refait le lacet de la sorte choisie.

**Ce qui bouge et ce qui fait mal.**

- **Barres mobiles** : elles glissent de côté ou montent et descendent, chacune à son rythme. Une prise sur elles les suit. Un lacet simplement posé dessus glisse : le moteur ne donne pas de vitesse aux formes statiques, donc le frottement ne l'emporte pas.
- **Trappes minutées** : elles s'ouvrent et se ferment seules, et s'éclairent juste avant de s'ouvrir.
- **Ciseaux** : ils entaillent le lacet (deux coups au même endroit le cassent).
- **Bougies** : la flamme le brûle tant qu'il y reste (un peu moins d'une seconde le casse).
- **Cascade** : l'eau trempe le lacet, qui rétrécit de 8 % et pèse 60 % de plus, puis sèche en 8 s. Plus lourd, il fatigue plus vite les prises.

**Ce qui demande de jouer avec la corde**, plus qu'une prise de plus. Chaque élément pose un problème que seul un lacet qui pèse, frotte et se balance résout ; ils arrivent tôt (dès la deuxième section) et chaque étage a les siens.

| Élément | Le défi | Comment |
|---|---|---|
| **Portemanteau** | des crochets de fer qui ne se prennent pas : il faut y passer le lacet par-dessus et le laisser pendre, sans prise | des capsules sans prise (`hook`), frottement fort |
| **Fils de couture** | ils cèdent après avoir porté le lacet environ 2 s (ils rougissent en s'usant) : on les prend sans s'attarder, et un fil cassé ne se reprend pas | le temps qu'une prise y est restée, puis `unpin` du haut ; un fil cassé quitte la liste de ce qui se prend |
| **Monte-charge** | saisir la poignée lâche le plomb, qui hisse le lacet de plus d'un mètre en une seconde ; il faut lâcher pour la barre d'en haut. Laissé, il redescend | cinématique : la poignée est une prise qui monte selon le poids du plomb contre celui du lacet (le solveur ne tenait pas un plomb 700 fois plus lourd que les nœuds du fil : le fil traversait la poulie) |
| **Radiateur** | l'air chaud monte et porte le bout libre jusqu'à une prise trop haute pour le bras | une traînée vers la vitesse de l'air, sur les nœuds du lacet dans la colonne (`sim.v`) |
| **Toile d'araignée** | le lacet s'y colle et s'y repose, mais pour en partir il faut tirer d'un coup sec ; collé plus de 4 s, l'araignée descend et mord. L'aiguillette (Espace) passe sans coller | une sangle par nœud au contact (`addBundle`), rompue par une traction ; collé, le lacet tire comme depuis une barre |
| **Courant d'air** | une bouche souffle par rafales en travers : on se tend entre deux rafales, ou on se laisse porter | la même traînée, à rafales |
| **Lampe qui cherche** | un faisceau balaie la pièce ; le lacet éclairé voit ses prises fatiguer 3,5 fois plus vite et roussit. On se cache dans l'ombre des barres et des étagères | un lancer de rayons 2D contre les formes, et une vraie `SpotLight` à ombres pour l'image : l'ombre qu'on voit est celle qui protège |
| **Horloge** | l'aiguille tourne : s'accrocher à sa pointe quand elle passe en bas, lâcher en haut | trois tiges tournantes (`updateStatic`), la prise tourne avec (`Lace.turnGrips`) |
| **Tyrolienne** | la bobine saisie file le long du fil en pente, le lacet se balance dessous ; lâcher au bon moment pour la prise d'en face | une forme mobile poussée par la pente, freinée par le fil, arrêtée net en bas ; rappelée en haut quand on la lâche |

Une prise emportée par un mécanisme (barre mobile, poignée, bobine, aiguille) traîne derrière la cible de son ressort ; ce retard n'est pas compté comme un effort de la main.

Chaque trappe porte un point de couleur, et ce qui l'ouvre porte le même. Sous une trappe fermée, la ligne d'aide dit ce qui l'ouvre.

## L'image

Le jeu est dessiné avec `WebGPURenderer` (WebGPU, ou WebGL 2 si le navigateur ne l'a pas ; `?webgl` le force), en HDR linéaire, puis par des passes en TSL reprises du pipeline de cablemanagement : occlusion ambiante (GTAO à demi-résolution, débruitée), rais de lumière (godrays) depuis la lumière rasante de l'étage, profondeur de champ (seulement en profondeur : le mur reste net, le premier plan et le ciel se floutent), bloom de ce qui dépasse le blanc (flammes, ampoules, fenêtres, étoiles), courbe de tons ACES qui va au-delà du blanc sur un écran HDR (canevas en demi-flottants), SMAA, puis une passe « cinéma » (vignette, grain, ombres froides et lumières chaudes). La qualité baisse d'elle-même quand les images arrivent en retard (`QUALITY` dans `stage.ts`, `?quality=N` la fixe).

**Le clair-obscur.** Chaque étage est sombre, éclairé par ses lampes : appliques dans l'entrée et le salon, ampoules nues dans la penderie et la buanderie, bougies dans la chambre, veilleuses chez les petits (`Lamp` dans `themes.ts`). Trois projecteurs à ombres sont donnés aux lampes les plus proches de la caméra (leur nombre ne change jamais : three reconstruirait ses shaders), et s'éteignent en douceur avant de passer à une autre. **Une seule source d'ombres longues par étage**, et on la voit : là où il y a des lampes, ce sont elles. La lumière principale vient alors de juste au-dessus de la caméra et ne laisse qu'une ombre courte et douce sous chaque barre, pour la détacher du mur (`shade` et `front` dans `Light`). Sans lampes (le grenier, éclairé par ses lucarnes, le toit), elle rase le mur d'un côté et d'en haut, allonge les ombres des barres et fait les rais. Avant, elle rasait partout, et les barres avaient deux ombres, dont une venue d'une lumière qu'on ne voyait pas. Une faible lueur accompagne le lacet, pour qu'on ne le perde jamais. Les fils de l'étoffe ressortent sous cette lumière rasante, ses plis aussi. Rien ne passe plus au premier plan : la profondeur de champ ne floute que de quelques pixels, une silhouette nette à peine floutée se lisait comme un découpage, et des fils dessinés déjà flous comme des barres noires.

## Ce que le moteur a gagné

`CableSim.targetPull(i, out?)` donne la force qu'une cible exerce sur son nœud, c'est-à-dire ce que « sent » une main. Elle égale le poids porté quand le solveur a convergé, d'où les 12 sous-pas du jeu. C'est testé dans [cable-kit/tests/physics.test.ts](cable-kit/tests/physics.test.ts).

`TubeNodes.wear(i, v)` (three-cable-tubes) donne l'usure d'un nœud, que le shader du matériau lit dans `tubeWear`, interpolée le long du tube : c'est ce qui masque les fibres du lacet usé. La variante WebGPU des tubes (`@drschizzo/three-cable-tubes/webgpu`) a maintenant `tubeWear` et `tubeRadius`, que le matériau du lacet, réécrit en TSL, lit pour sa tresse et son usure.

`CableSim.updateStatic(id, shape)` remplace une seule forme statique (elle a bougé), la range de nouveau, et ne réveille que les câbles près d'elle. `setStatics` reconstruit tout et réveille tout le monde. C'est ce qui fait glisser les barres mobiles et ouvrir les trappes sans réveiller le niveau entier. Testé dans [cable-kit/tests/physics.test.ts](cable-kit/tests/physics.test.ts) : une barre qui monte emporte la corde posée dessus, une corde loin d'elle dort toujours.

`SimParams.staticCell` règle la taille des cellules où le solveur range les formes statiques (5 cm par défaut, comme avant). Les murs de la montée sans fin font des mètres de haut : rangés en cellules de 5 cm, ils prenaient 130 à 230 ms à chaque construction du monde et à chaque ouverture de trappe. En cellules de 25 cm, cela prend 1 à 5 ms, et les contacts trouvés sont les mêmes.

## Appris en route

- **Pas de treuil.** Faire tourner une prise autour d'une barre fixe pour s'y enrouler fait glisser le lacet sur la barre. La main paie alors e^(μθ) au lieu d'être soulagée (×5 pour un tour, mesuré). Pour garder ce geste, il faudrait des barres qui tournent.
- **Tourner le bout libre autour d'une barre n'enroule presque pas** : le mou pend. C'est le drapé, et non l'enroulement, qui est le geste naturel de ce prototype.
