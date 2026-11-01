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
| souris | le bout qui ne tient rien suit le pointeur. Si aucun ne tient, c'est le plus proche du pointeur. Il tire avec 1,3 fois le poids du lacet si l'autre bout est accroché ou si le lacet repose sur une barre ou une étagère (comme sur une poulie), et 0,45 fois seulement sur le sol (le lacet ne peut pas grimper sans appui) |
| Espace (maintenu) | l'aiguillette se faufile : les 8 derniers centimètres du bout qui suit la souris passent à travers les autres cordes (ils brillent en bleu), donc devant ou derrière. Le reste du lacet reste solide et suit le chemin du bout : pour se démêler, il faut ramener le bout par où il est passé. Relâchée, l'aiguillette redevient solide là où elle ne touche rien, et repousse les cordes là où elle les chevauche encore |
| R | revenir au dernier poteau |
| H | masquer ou afficher l'aide contextuelle |

Pour grimper, on alterne : un bout accroché, l'autre monte jusqu'à une barre plus haute, on l'accroche, on lâche le premier. Quand un bout libre peut s'accrocher, un anneau de sa couleur montre où il se collera, avec le bouton à maintenir. Un anneau autour de chaque prise affiche l'énergie qui lui reste. **Une prise fatigue comme la main d'un grimpeur** : pendu sous elle, le lacet la laisse récupérer (elle brille en vert) ; c'est quand l'autre bout s'étire pour monter qu'elle s'épuise, d'autant plus vite que ce bout tire fort (la force de sa cible, mesurée par le solveur). La portion que le bout tendu soulève, jusqu'au premier appui, rougit avec l'effort. Un lacet qui tire sur la main plus que son propre poids (tendu presque à l'horizontale, rattrapé en pleine chute) la fatigue en plus. Une étiquette au-dessus de la prise donne le chiffre : « effort 60 % ↓ », « repos ↑ », « sur une corde ↓ » (une corde ne laisse jamais reposer). Mesuré sur 4 s, une prise à 60 % : pendue, elle remonte à 100 % ; le bout tendu 1 m vers le haut, elle descend ; tendu de côté (le lacet presque horizontal tire aussi sur la main), elle s'épuise.

Le bout libre suit la souris avec un léger retard (`PLAY.inertia`, 0,12 s) : le lacet a du poids. Il tire avec 0,85 fois le poids du lacet : assez pour atteindre une prise proche (40 cm plus haut, 35 cm à côté), pas pour dresser le lacet droit au-dessus de la main. Pour monter plus haut, il faut s'élancer, ou passer le lacet par-dessus une barre (mesuré : à 1,3 fois le poids, comme avant, il atteignait une barre 95 cm droit au-dessus ; à 0,8, il la manque de 32 cm).

- **Se rattraper coûte.** Une main qui saisit le lacet en mouvement encaisse le choc : au-delà de 1,2 m/s (le lacet entier, son centre de masse), chaque m/s de plus coûte 45 % de l'endurance de la prise, et use le bout qui saisit. Une chute de 40 cm en coûte les trois quarts ; à 80 cm, la prise est arrachée et le lacet continue de tomber. Saisir au sommet d'un balancement ne coûte rien.
- **Le lacet s'use, fibre à fibre.** Chaque nœud a son usure, de 0 (neuf) à 1 (déchiré) : les ciseaux l'entaillent (55 % par coup), la flamme la brûle (110 % par seconde), le frottement l'use quand il glisse sur une surface (50 % par mètre sur du bois, moins sur le caoutchouc et le chrome), les chocs usent le bout qui saisit. Le shader masque les fibres en proportion (d'après le rendu de tissus au niveau de la fibre de Wu et Yuksel, I3D 2017) : des brins disparaissent, l'âme apparaît, les fibres cassées s'ébouriffent, le lacet s'amincit. Déchiré, il casse à cet endroit : le morceau qu'un bout tient continue, plus court, l'autre tombe. Plus court que 55 cm, il retourne au dernier poteau. Un poteau le rend neuf.

- **Endurance = vraie tension.** Une prise s'use selon la force que le solveur mesure à cet endroit (`targetPull`, le long du lacet). Pendu à bout de bras, elle tient environ 4 secondes. La charge est lissée sur un quart de seconde, pour qu'un à-coup ne vide pas une prise d'un coup. Drapé par-dessus une barre voisine, le frottement porte le poids (cabestan) et la prise se repose.
- **Les matériaux comptent.** Le bois se prend. Le chrome ne se prend pas et glisse (μ 0,1). Le caoutchouc rouge accroche (μ 1) et fatigue moitié moins.
- **Les poteaux dorés sauvegardent si la physique le veut.** Il faut avoir au moins un demi-tour en contact avec le poteau, ne rien tenir, et que rien ne glisse sur le poteau pendant une seconde. Un drapé équilibré tient, un drapé trop déséquilibré (au-delà de e^(μπ)) glisse : c'est le cabestan qui décide.
- **Lianes et rideau** : les cordes pendues s'agrippent (une sangle `addBundle`) et se balancent.

## La montée

Le jeu est une seule montée, sans fin, qui peut durer des heures. L'écran titre propose **Continuer** (la montée laissée la dernière fois, depuis son dernier poteau) et **Nouvelle montée** (une autre graine, depuis le sol ; `?new` dans l'adresse fait de même). La montée est faite de **sections** empilées. Chacune assemble trois **pièces** indépendantes ([src/gen/parts.ts](src/gen/parts.ts)) :

| Famille | Rôle | Pièces |
|---|---|---|
| **montée** | du dernier appui à une **station** (une barre) plus haut | barres, barres mobiles, bougies, cascade, ciseaux, rideau de cordes, fils posés, fils à linge, écheveau, corde lisse, pendule, échelle de corde, forêt de lianes, filet, escalier de chrome |
| **obstacle** | au-dessus de la station, jusqu'à l'appui suivant | rien, trappe, trappe minutée, fente, fente gardée, surplomb, chicanes, traversée sous un plafond |
| **clé** | ce qui ouvre la trappe | poteau doré, œillets, œillets croisés, tirette, porte à ressort, colonne d'œillets, deux tirettes |

Une pièce ne connaît que l'appui d'où elle part et celui où elle arrive. N'importe quelle montée mène donc à n'importe quel obstacle, et n'importe quelle clé ouvre n'importe quelle trappe. Une pièce nouvelle, de n'importe quelle famille, fait des sections nouvelles avec toutes les autres. Les dispositions viennent des cinq niveaux faits main du premier prototype, où elles ont été jouées (ils ont été retirés depuis) : entre deux prises, jamais plus d'environ 50 cm de montée ni 60 cm d'écart.

**Assemblage**, façon *wave function collapse* en une dimension ([src/gen/course.ts](src/gen/course.ts)). Chaque pièce déclare ses « prises » : de quel côté elle arrive, son effort (0 à 3), les cordes qu'elle ajoute. Parmi toutes les combinaisons, une section est tirée (au poids) parmi celles qui respectent les règles de voisinage :

- jamais deux montées chargées en cordes à la suite (le solveur ramerait), ni la même pièce deux fois de suite ;
- un effort plafonné qui monte avec le parcours, et une section plus facile après une difficile ;
- une pièce nouvelle arrive seule, avec des pièces faciles autour, et sa ligne d'aide la première fois ;
- un **tronçon** finit sur un poteau (une trappe dont la clé est le poteau). Les tronçons s'allongent avec la hauteur, de 3 à 6 sections. Chacun a sa variante : glissant (plus de chrome), lâche (fils détendus), sans repos (pas de caoutchouc), espacé (montées plus hautes).

Quand aucune combinaison ne passe, les règles cèdent une à une, la moins importante d'abord. Sur 400 sections, aucune barre ne chevauche une autre pièce, et la première prise de chaque section est à portée de la précédente (vérifié par script).

**Le stress de la chute.** Le monde construit est une **fenêtre** du parcours : de la section sous le dernier poteau sauvegardé jusqu'au poteau suivant, dont la trappe reste fermée tant qu'on ne s'y est pas sauvegardé. Tout ce qui sépare le lacet du dernier poteau est là : une chute est une vraie chute, on peut se rattraper en route. Tomber sous le poteau ramène au poteau. À chaque sauvegarde, la fenêtre monte, et le monde est reconstruit autour du lacet, les cordes déjà posées gardant leur place. Mesuré : 1 à 5 ms pour reconstruire, 2 à 3 ms par pas au repos. Juste après, le temps que les cordes nouvelles se posent (une à deux secondes), un pas peut coûter jusqu'à 22 ms quand le tronçon est long.

## Les étages, et ce qu'ils racontent

La montée traverse une maison, puis le ciel. Le lacet est celui d'une paire de chaussures restée près de la porte ; la maison est celle d'un vieux couple, qu'on vide après leur départ. Rien ne le dit, tout le montre : un miroir sous un drap, des cartons « à donner » et « à garder », un calendrier arrêté en mars 2009 (les jours barrés jusqu'au 13, puis plus rien), un tricot qui attend sa dernière rangée, du linge sec depuis longtemps sur son fil, des rectangles plus clairs sur le papier peint là où étaient les cadres, une horloge arrêtée, un lit fait, « Lettres de Jeanne » au grenier. Sur la toise de l'entrée, les enfants ont été mesurés (et Papi, pour rire). Un fil rouge court sur les murs d'étage en étage ; en sortant du grenier il devient lumière, et à l'aube il finit en nœud, sous une étoile. Au-dessus, le ciel ne finit pas.

| Étage | Ce qu'on y voit | Ce qu'il a de plus |
|---|---|---|
| L'entrée | les chaussures (l'une sans lacet), le courrier, le miroir voilé, la toise | barres |
| La penderie | manteaux, cravates, lavande, cartons | rideaux de cordes |
| La chambre des petits | dessins « pour Papi », ours, fanions | échelles, filets, chicanes |
| L'atelier | le tricot, le calendrier, les ciseaux, les bobines | écheveaux, œillets, ciseaux |
| La buanderie | le linge, une chaussette seule, des bulles | fils à linge, cascades |
| Le salon | l'horloge, les lunettes sur le livre, le fauteuil sous un drap | barres mobiles, bougies, pendules |
| La chambre | le lit fait, la table de nuit, les pantoufles | fils posés, tirettes |
| Le grenier | cartons, robe de mariée, cheval à bascule, toiles d'araignée | lianes, filets |
| Le toit | briques, antenne, la nuit qui tombe | cordes lisses, pendules |
| **Le ciel** : la nuit, l'aube, puis pour toujours les nuages, le grand ciel, les étoiles, le matin | lune, cerfs-volants, ballons, étoiles filantes, souvenirs de la maison qui flottent | |

Chaque étage a son papier peint, son bois, sa lumière (chaude dans l'entrée, froide dans la buanderie, crépuscule dans la chambre, la nuit au-dessus du toit), ses fenêtres et ce qu'on y voit, ce qui flotte dans l'air (poussière, peluches, bulles, étincelles). Ce qui se prend garde son aspect d'étage en étage : le bois est toujours chaud et mat (un crayon dans la chambre des petits), le chrome toujours froid et brillant, le caoutchouc rouge, les poteaux dorés. Le décor reste sur le mur, plus pâle que ce qui se joue. Il est peint une fois sur des canevas, sans fichier à charger, et ne coûte rien au solveur.

**Quand change-t-on d'étage.** Sur un poteau, donc juste après une sauvegarde : le nouvel étage vient comme une récompense, avec son carton (son nom, une ligne) la première fois. L'étage d'un tronçon suit le temps qu'un bon joueur, sans chute, aurait mis pour y arriver : le parcours l'estime section par section (`STORY.pace` dans [src/tuning.ts](src/tuning.ts) : 22 s, plus 14 s par point d'effort, plus 9 s par mètre). Les neuf étages de la maison se partagent `STORY.skyAfter` (50 min). Sur cinq graines, le ciel arrive après 51 à 59 min estimées, entre 75 et 88 m. **Cette estimation n'a pas été mesurée sur un vrai joueur** : la montée garde l'heure où chaque étage a été atteint (`game.pace` dans la console), pour régler `STORY.pace`.

**La fatigue monte avec la montée.** Une prise s'épuise d'abord moins vite (× 0,45 dans l'entrée), puis de plus en plus vite selon ce même temps estimé, jusqu'à la vitesse réglée par `PLAY.drain` en arrivant au ciel (× 1), et au-delà encore plus vite, de 0,3 par tranche de 50 min, sans dépasser × 1,4. Pendre à une corde suit la même courbe. Réglable dans l'adresse : `?easy=0.6&harder=0.2&hardest=1.2`.

Rarement (une section sur neuf environ), une pièce garde un **souvenir** : la mer (une carte postale de Biarritz, la fenêtre sur la plage), Noël (la neige à la fenêtre, une guirlande), le bal (un gramophone), le jardin (un chapeau de paille). Quelques notes de boîte à musique quand le lacet y entre.

**Les lacets.** Chaque étage atteint pour la première fois (sur n'importe quelle montée) peut en donner un, à choisir sous l'écran titre : le lacet du dimanche, de randonnée, le fil rouge, le lacet doré, le ruban bleu.

Le parcours est tiré par étage depuis cette version : une montée gardée par une version d'avant ne retrouverait pas son poteau, elle n'est donc pas reprise (clé `loose-ends:climb:2`).

## Code

Chaque dossier a un rôle, et ne dépend que de ceux d'au-dessus dans ce tableau.

| Dossier | Rôle |
|---|---|
| [src/tuning.ts](src/tuning.ts) | tous les réglages ; ceux de `PLAY` se changent dans l'adresse : `?muscle=2&drain=0.3` |
| [src/level/](src/level) | ce dont un niveau est fait (`level.ts` : données pures, `merge`, `placeKey`), ses formes statiques (`surfaces.ts`) |
| [src/gen/](src/gen) | le parcours sans fin : les pièces (`parts.ts`), leur assemblage (`course.ts`), les étages (`floors.ts`) |
| [src/sim/](src/sim) | le monde physique construit depuis un niveau : la forme des cordes (`cords.ts`), le solveur et le lacet (`world.ts`) |
| [src/play/](src/play) | le lacet (`lace.ts` : bouts, prises, endurance, aiguillette), les règles du niveau (`rules.ts` : boutons, œillets, trappes, tirettes, poteaux), les commandes, la montée (`climb.ts` : sa fenêtre du parcours, ce qui est gardé d'une visite à l'autre), les lacets trouvés (`laces.ts`), l'aide (`advice.ts`) |
| [src/view/](src/view) | la scène, sa lumière et la caméra (`stage.ts`), ce qui se joue du niveau (`scenery.ts`), le décor des étages (`decor.ts`, d'après `themes.ts`, peint par `paint.ts`), les cordes en tubes (`cordsView.ts`), les repères sur le lacet (`overlay.ts`), la page (`hud.ts`) |
| [src/game.ts](src/game.ts) | la boucle : un pas du solveur, les règles, le dessin ; reconstruit le monde quand la partie le demande |
| [src/main.ts](src/main.ts) | le démarrage : continuer ou nouvelle montée |

Dans la console, `game` expose la simulation. `game.run(60)` joue une seconde, même onglet caché, `game.pointer` déplace le pointeur, `game.hold(0, true)` maintient le bouton de la tête et `game.course.section(k)` montre une section du parcours sans fin (son étage : `.floor`). `game.warp(k)` y emmène le lacet ; pour que la caméra le suive, placer aussi `game.pointer` sur lui.

**Ce qui bouge et ce qui fait mal.**

- **Barres mobiles** : elles glissent de côté ou montent et descendent, chacune à son rythme. Une prise sur elles les suit. Un lacet simplement posé dessus glisse : le moteur ne donne pas de vitesse aux formes statiques, donc le frottement ne l'emporte pas.
- **Trappes minutées** : elles s'ouvrent et se ferment seules, et s'éclairent juste avant de s'ouvrir.
- **Ciseaux** : ils entaillent le lacet (deux coups au même endroit le cassent).
- **Bougies** : la flamme le brûle tant qu'il y reste (un peu moins d'une seconde le casse).
- **Cascade** : l'eau trempe le lacet, qui rétrécit de 8 % et pèse 60 % de plus, puis sèche en 8 s. Plus lourd, il fatigue plus vite les prises.

Chaque trappe porte un point de couleur, et ce qui l'ouvre porte le même. Sous une trappe fermée, la ligne d'aide dit ce qui l'ouvre.

## Ce que le moteur a gagné

`CableSim.targetPull(i, out?)` donne la force qu'une cible exerce sur son nœud, c'est-à-dire ce que « sent » une main. Elle égale le poids porté quand le solveur a convergé, d'où les 12 sous-pas du jeu. C'est testé dans [cable-kit/tests/physics.test.ts](cable-kit/tests/physics.test.ts).

`TubeNodes.wear(i, v)` (three-cable-tubes) donne l'usure d'un nœud, que le shader du matériau lit dans `tubeWear`, interpolée le long du tube : c'est ce qui masque les fibres du lacet usé.

`CableSim.updateStatic(id, shape)` remplace une seule forme statique (elle a bougé), la range de nouveau, et ne réveille que les câbles près d'elle. `setStatics` reconstruit tout et réveille tout le monde. C'est ce qui fait glisser les barres mobiles et ouvrir les trappes sans réveiller le niveau entier. Testé dans [cable-kit/tests/physics.test.ts](cable-kit/tests/physics.test.ts) : une barre qui monte emporte la corde posée dessus, une corde loin d'elle dort toujours.

`SimParams.staticCell` règle la taille des cellules où le solveur range les formes statiques (5 cm par défaut, comme avant). Les murs de la montée sans fin font des mètres de haut : rangés en cellules de 5 cm, ils prenaient 130 à 230 ms à chaque construction du monde et à chaque ouverture de trappe. En cellules de 25 cm, cela prend 1 à 5 ms, et les contacts trouvés sont les mêmes.

## Appris en route

- **Pas de treuil.** Faire tourner une prise autour d'une barre fixe pour s'y enrouler fait glisser le lacet sur la barre. La main paie alors e^(μθ) au lieu d'être soulagée (×5 pour un tour, mesuré). Pour garder ce geste, il faudrait des barres qui tournent.
- **Tourner le bout libre autour d'une barre n'enroule presque pas** : le mou pend. C'est le drapé, et non l'enroulement, qui est le geste naturel de ce prototype.
