# Loose Ends : ce que seul ce moteur permet, et comment tenir des dizaines de niveaux

## 1. Le constat

Le premier prototype ne montrait que de la **brachiation** : s'accrocher à une barre, lancer l'autre bout plus haut, recommencer. N'importe quel moteur de corde la fait : une chaîne de points reliés (Verlet), un *rope joint* Box2D, ou même un grappin à longueur fixe. Si le cœur du jeu tient là-dedans, le moteur n'apporte rien de visible.

Ce que fait **ce** moteur, et que les moteurs de corde courants ne font pas :

| Capacité du solveur | Moteur de corde courant | Ce que ça devient en jeu |
|---|---|---|
| Contact corde contre corde, sans traversée même rapide | les cordes se traversent (ou on les en empêche à grand prix, pour quelques cordes) | enfiler, tisser, passer dessus ou dessous, s'emmêler, grimper dans une masse de fils |
| Frottement de Coulomb dur, avec ancrage | pas de frottement, ou un frottement « collant » qui glisse quand même | un fil posé tient ou glisse selon la matière et l'équilibre (cabestan e^(μθ)), les nœuds tiennent |
| Inextensible sous charge, tension mesurable (`targetPull`) | élastique, tension inconnue | la fatigue de la prise est le poids réellement porté, une tirette sent qui s'y pend |
| Des centaines de cordes qui s'endorment | quelques cordes, toutes actives | des écheveaux, des rideaux de fils, un filet, presque gratuits au repos (mais trop de fils éveillés à la fois font ramer : voir 5) |

**La règle de conception qui en découle** : chaque niveau doit reposer sur **les autres fils** (pas seulement sur des barres) et sur **le frottement**. Une barre en bois sert de décor, et ce sont les fils qui font le niveau.

**La preuve, mesurée sur le prototype** : on a rejoué les niveaux avec un « moteur simplifié » (toutes les cordes se traversent, plus aucun frottement). Ce mode de test a été retiré du jeu depuis. Voici ce qu'on y perdait :

- **Drapés et poteaux** : le lacet glisse du poteau, plus de sauvegarde. Une prise drapée ne se repose plus.
- **Fils posés** : le fil sur le caoutchouc glisse comme celui sur le chrome (mesuré : sous le poids du lacet, il tient sur caoutchouc avec le moteur complet, et glisse avec le moteur simplifié).
- **Écheveaux** : les boucles se traversent et s'aplatissent.
- **Œillets** : le lacet enfilé ne repose plus sur les anneaux, il glisse et ressort.

## 2. Les verbes, et les objets qui les font naître

Le joueur n'a que trois gestes : **accrocher un bout**, **le lâcher**, **déplacer le bout libre**. La variété vient donc entièrement de ce que le monde fait de ces gestes. Voici les familles d'objets, chacune liée à une capacité du moteur.

| Famille | Objet (prototype ✅, à faire ○) | Ce qu'elle demande | Capacité du moteur |
|---|---|---|---|
| **Prendre** | barres bois / chrome / caoutchouc ✅, étagères ✅, aiguille d'horloge ✅, bobine de tyrolienne ✅, poignée de monte-charge ✅ | choisir sa prise, gérer la fatigue, lâcher au bon moment | tension mesurée, μ par surface, statiques mobiles |
| **Se pendre sans prise** | crochets de portemanteau ✅, toile d'araignée collante ✅ | se draper, s'arracher | frottement dur, sangles |
| **L'air et la lumière** | radiateur, courant d'air à rafales ✅, lampe qui cherche ✅ | se laisser porter, attendre, se cacher dans l'ombre | vitesse des nœuds, ombres réelles |
| **Se poser** | poteau doré (sauvegarde par drapé) ✅, fil posé sur une barre ✅ | équilibrer, lire la matière | cabestan |
| **Enfiler** | œillets (en ligne, croisés, en colonne) ✅, ○ peigne (passer dessus-dessous une rangée de dents), ○ boutonnière qui se referme | viser, garder un chemin topologique, tirer contre le frottement accumulé | contact corde/anneau sans traversée, frottement cumulé (lacer serre) |
| **Les fils des autres** | cordes pendues ✅, rideau ✅, écheveaux de boucles ✅, fils à linge ✅, filet et échelle de corde noués ✅, ○ toile d'araignée, ○ pelote qui se dévide | se frayer un chemin, s'appuyer sur un tas, se méfier de ce qui ne tient à rien | contact corde/corde, tas qui dorment |
| **Mécanismes** | tirette (sent le poids, ouvre une trappe) ✅, ○ contrepoids sur poulie (seau, ascenseur), ○ balance à deux plateaux, ○ store à cordon | utiliser son poids, sa longueur | tension mesurée, inextensibilité |
| **Le lacet lui-même** | ○ types de lacet (fil fin et long, cordon épais, tuyau raide qui fait pont), ○ longueur variable (ciseaux qui coupent, rallonges) | changer la façon de jouer d'un niveau à l'autre | presets `CABLES`, raideur en flexion réelle |
| **Dangers** | ○ ciseaux (coupent, il faut `cut()` dans le moteur), ○ ventilateur (force externe), ○ fer chaud (zone où une prise brûle) | rythme, timing | extensions simples du moteur |

## 3. Comment tenir des dizaines de niveaux

### a. Une structure par « ateliers », chacun sa mécanique

Comme les mondes d'un Mario, chaque atelier présente une mécanique en quatre temps : **découverte** (sans danger), **développement** (avec contrainte), **retournement** (la même chose, mais un piège : fil posé sur chrome), **combinaison** (avec une mécanique déjà connue). Quatre ou cinq niveaux courts (1 à 3 minutes) par atelier :

1. **La penderie** : prendre, se reposer, poteaux. ✅
2. **Le laçage** : œillets, laçage croisé, laçage qui serre (la friction cumulée oblige à tirer avec un bout bien ancré). ✅
3. **La mercerie** : les fils des autres, écheveaux, fils posés, tirette. ✅
4. **La buanderie** : fils à linge qui plient et rebondissent ✅ ; ○ mécanismes à contrepoids (seau sur poulie), pince à linge comme prise temporaire.
5. **Le gréement** : filet noué qui cède, échelle de corde qui se tord ✅ ; ○ hamac, pont de corde.

Ces cinq ateliers ont d'abord été cinq niveaux faits main. Ils sont devenus les pièces de la montée sans fin (voir le README), et les niveaux ont été retirés.
6. **Le grenier** : toiles d'araignée et pelotes qui se dévident (le fil qu'on tient s'allonge).
7. **L'atelier de papa** : tuyaux d'arrosage, rallonges électriques (le preset `hose` et `patchCord` du moteur), dangers.

### b. Le lacet comme variable

Le même niveau joue autrement selon le lacet. C'est gratuit avec ce moteur, puisque les presets existent :

- **Fil** (fin, long, léger) : passe partout, s'enroule serré, mais fatigue vite parce qu'il porte loin.
- **Cordon** (épais, court) : solide, mais n'entre pas dans les petits œillets.
- **Tuyau** (raide, `bend` ×30) : tient à l'horizontale, fait pont entre deux barres, ne se drape presque pas.

Un niveau peut imposer un lacet, ou en proposer plusieurs, ce qui rend les niveaux rejouables.

### c. Des objectifs qui ne sont pas « arriver en haut »

- **Lacer** : laisser le lacet passé dans N œillets dans un ordre donné (comme un vrai laçage croisé).
- **Ficeler** : faire un tour complet autour d'un paquet de fils et tenir (le paquet est sanglé par le frottement).
- **Démêler** : sortir un fil précis d'un tas sans en réveiller trop (le moteur sait quels fils sont réveillés).
- **Porter** : amener un bouton enfilé sur le lacet jusqu'en haut (une perle qui coulisse).

### d. La rejouabilité

- **Chrono et boutons** (déjà là) ; étoiles par niveau.
- **Fantômes** : enregistrer les positions des nœuds du lacet (environ 3 Ko/s) et afficher ceux des meilleurs joueurs. Le moteur de tubes en dessine des centaines en un seul appel, sans les simuler. On obtient la foule de *Fall Guys* sans réseau.
- **Défis** : « sans le chrome », « au plus 10 prises », « jamais plus de 80 % de charge ».
- **Niveau du jour** : une montée sans fin à graine fixe, la même pour tous (la montée existe : voir le README, « La montée sans fin »). Les briques (barres, œillets, écheveaux, tirettes, fils à linge, filets) se combinent bien, parce que le moteur juge seul de ce qui tient.

### e. Le multijoueur

- **La paire** (coopération à deux) : deux lacets, chacun peut servir d'appui à l'autre (contact corde/corde), ou s'y nouer.
- **Course de fantômes** asynchrone (voir plus haut).

## 4. Ce que le moteur devra apprendre

Toutes ces extensions sont compatibles avec le comportement actuel (des ajouts, pas des changements) :

- `cut(i)` pour couper un câble (ciseaux, et pour raccourcir le lacet) : `segOK[i] = 0`, plus le message vers le Worker.
- Une **force externe** par nœud (ventilateur, aspirateur).
- Des **statiques mobiles** sans tout réveiller (poulies, plateaux, ascenseurs) : aujourd'hui, `setStatics()` reconstruit tout. C'est assez bon pour une trappe qui s'ouvre une fois, pas pour un objet qui bouge.
- Faire tourner la simulation dans un **Worker** (`threaded`) quand un niveau a beaucoup de fils éveillés. Aujourd'hui, avec tous ses fils éveillés, un pas coûte environ 14 ms dans la mercerie (716 nœuds), 7 ms dans le gréement (779 nœuds) et 3 ms dans la buanderie (371 nœuds).

## 5. Ce que les essais ont appris

- **Un treuil ne marche pas sur une barre fixe** : faire tourner la prise fait glisser le lacet, et la main paie e^(μθ) au lieu d'être soulagée (×5 mesuré).
- **Trois œillets espacés de 40 cm demandent plus de lacet qu'il n'y en a**, et le lacet ressort du premier. Le niveau du laçage les a resserrés (30 cm), avec une prise à gauche d'où l'on enfile. Le lacet enfilé repose alors sur les anneaux, et la prise se repose.
- **Sans prise, le lacet ne doit pas pouvoir se soulever**, sinon on grimpe sans rien faire. Le bout libre tire à 1,3 fois le poids si l'autre bout tient, et à 0,45 fois sinon.
- **Trop de fils font ramer, et un tas n'apporte rien au jeu.** La marmite de 22 spaghettis de la mercerie coûtait 26 ms par pas avec tout éveillé, et le joueur ne faisait que la traverser. Elle est retirée. Ce qui marche, ce sont quelques fils placés sur le chemin, que le lacet agrippe, enjambe ou grimpe (cordes pendues, écheveaux, fils posés). Un fil que le lacet ne touche jamais coûte autant qu'un fil qu'il grimpe.
- **Un fil dans le plan du lacet ne le porte pas.** Les barres traversent la pièce en profondeur, et le lacet les croise. Un fil à linge, un filet sont dans le même plan que lui : posé dessus, le lacet leur est parallèle et roule devant ou derrière. Ils servent de prises, pas d'appuis.
- **Un filet qui ne pend que par le haut se referme** : ses cordes en travers se plient et le filet perd 40 % de sa largeur. Attaché en haut et en bas, il garde sa forme et cède seulement sous le lacet. Les barreaux d'une échelle de corde doivent être raides (`bend` 40), sinon ils se plient et les montants se rejoignent.
- **Un générateur doit assembler des pièces, pas des niveaux.** La première version empilait des passages figés (dix « modules »). Découpés en trois familles indépendantes (montée, obstacle, clé), les mêmes éléments donnent des centaines de sections différentes, et chaque pièce ajoutée les multiplie toutes. Un *wave function collapse* classique, en grille 2D, aurait placé barres et cordes case par case, sans garantir qu'un lacet de 1,10 m puisse passer. On en garde l'idée (des pièces à « prises » et des règles de voisinage) à l'échelle où chaque pièce est déjà jouable.
- **La peur de tomber tient à ce que le monde garde sous le lacet.** La montée sans fin ne construit qu'une fenêtre, mais elle va toujours du dernier poteau au suivant : tout ce qui a été grimpé depuis la sauvegarde est encore là pour qu'on y retombe, ou qu'on s'y rattrape.
- **La profondeur emmêle.** Le lacet s'accroche aux autres cordes et s'y enroule, ce qui est bien, mais pour s'en dégager il faudrait le passer tantôt devant, tantôt derrière. Choisir « devant » ou « derrière » alourdirait le jeu. Une seule touche : maintenir Espace. Laisser tout le lacet traverser les cordes rendait le démêlage trop facile, alors seule l'aiguillette (8 cm au bout qui suit la souris) les traverse, grâce aux fantômes du moteur. Elle passe devant ou derrière une corde, et le reste du lacet, solide, suit son chemin. Démêler reste un vrai geste, comme avec un vrai lacet : on ramène le bout par où il est passé.
- **Expliquer l'endurance ne suffit pas, il faut la montrer.** Le joueur ne comprenait pas pourquoi une prise s'épuisait vite alors que le lacet était posé sur une barre plus bas. La raison est physique : le bout tendu en diagonale entre la main et cette barre tirait plus fort que le poids du lacet entier (114 % mesuré, contre 40 % pendu sous la main). Afficher la tension du solveur le long du lacet était tentant, mais son multiplicateur λ ne la mesure pas fidèlement (de 1,4 à 4,3 fois le poids). Ce qui marche : faire briller la portion que la main porte, jusqu'au premier appui, d'autant plus rouge qu'elle pèse sur la main (la charge, elle, est mesurée juste, par `targetPull`).
- **L'effort doit suivre l'intuition du grimpeur, pas la tension exacte.** Compter comme effort la tension à la main était juste physiquement, mais à rebours de ce que le joueur ressent : pendre sous une prise lui semble un repos, tendre l'autre bout vers le haut un effort. Une prise s'épuise donc maintenant selon la force que dépense le bout qu'elle soutient ; pendre la repose. Seule une traction au-delà du poids du lacet (tendu en travers, choc d'une chute) s'y ajoute, parce qu'elle se voit.
- **Toujours trop facile, faute de tension.** On se rattrapait de toutes les chutes et on atteignait tout, en ligne droite. Trois raisons, trois réponses physiques. (1) Se rattraper était gratuit : maintenant, le choc d'une prise sur un lacet qui tombe coûte selon sa vitesse, et une longue chute arrache la prise. (2) Le bout libre tirait avec 1,3 fois le poids du lacet : il le dressait comme une tige jusqu'à presque toute sa longueur. À 0,85, il atteint une prise proche, et au-delà il faut s'élancer ou se draper : jouer avec la physique. (3) Rien ne s'usait : le lacet s'use maintenant fibre à fibre, et le frottement (traîner le lacet sur les barres) devient un coût, plus seulement une aide. Une fausse piste : j'ai cru que le lacet tenait debout parce que le solveur résiste à la compression, et ajouté au moteur des cordes qui ne poussent pas ; mesuré, elles se comportaient pareil, c'était la force du bout libre. Retiré.
- **Trop facile sans danger.** Des barres qui bougent, des trappes qui se referment, des ciseaux, des flammes, de l'eau : le lacet devient quelque chose qu'on peut perdre en route. Raccourci, il atteint moins loin, et la peur de tomber s'y ajoute. Les poteaux le rendent entier, ce qui donne une raison de plus d'y arriver.
- **Une grimpe de barres en barres se joue au clic gauche, clic droit.** Il fallait des éléments qui demandent autre chose : se draper sans prise (crochets), ne pas s'attarder (fils qui cèdent), se laisser porter (monte-charge, radiateur, tyrolienne, horloge), s'arracher (toile), attendre son moment (rafales, lampe qui cherche). Ils arrivent dès la deuxième section, et chaque étage a les siens.
- **Le solveur ne tient pas un plomb des centaines de fois plus lourd que les nœuds de son fil** : le fil traversait la poulie. Le monte-charge est devenu cinématique (la poignée monte selon le poids du plomb contre celui du lacet), ce qui le rend aussi plus lisible.
- **Une prise emportée traîne derrière la cible de son ressort**, et ce retard se lisait comme une traction énorme : une poignée qui monte vidait la prise en un quart de seconde. Ce retard n'est plus compté comme un effort.
- **Le flou de profondeur doit rester en profondeur.** Mesuré dans la pièce autour du lacet, il floutait les prises à 50 cm de lui. Mesuré en profondeur seulement, le mur reste net et seuls le premier plan et le ciel se floutent.
- **Un nœud du lacet sur lui-même ne se défaisait pas.** L'aiguillette traversait les autres cordes, jamais le lacet lui-même, et pendu sur un fil le lacet comptait « sans appui » (force 0,45). Maintenant l'aiguillette traverse aussi le lacet, une corde porte le lacet comme une barre, et un bout coincé peut forcer le passage : la partie qui se faufile s'allonge, mais s'effiloche. Démêler reste un geste (ramener le bout par où il est passé) ; forcer est la sortie de secours, qui se paie.
- **Couché au sol, le lacet n'atteignait pas la prise d'au-dessus**, et rien ne permettait d'essayer autrement : le bras seul (0,45 fois le poids) lève le bout d'environ 35 à 50 cm. Plutôt qu'un bras plus fort (qui rendrait la grimpe sans appui facile), un geste : le lancer, un coup sec du pointeur, qui fouette le bout vers le haut. Il faut viser et cliquer au bon moment ; il ne sert que couché sans rien qui tienne le lacet.
- **Un lacet couché en tas n'est pas emmêlé** : l'aide ne parle de nœud que si le lacet se touche lui-même hors du sol et des étagères.
- **Une lampe trop près du mur le brûle.** Les projecteurs sont à 12 à 16 cm du mur, avec une chute plus douce que l'inverse du carré : une flaque de lumière, pas un point blanc.
- **L'endurance doit se lire là où l'on regarde.** Le joueur ne comprenait pas pourquoi une prise fatigue tantôt, tantôt pas. La règle est physique (la part du poids que porte la main), alors on l'affiche à la prise : « porte 80 % ↓ » ou « repos ↑ » en vert.
- **Une ombre longue par source qu'on voit.** La lumière principale rasait le mur à tous les étages, en plus des lampes : chaque barre avait deux ombres, dont une venue d'une fenêtre qu'on ne voyait pas. Maintenant, là où il y a des lampes, elles seules font les ombres longues ; la lumière principale vient de face et ne laisse qu'une ombre courte sous chaque barre. Sans elle, une barre loin des lampes flottait sur le mur, sans rien qui la détache.
- **Le décor figuratif ne tient pas sur une montée générée.** Des objets peints à plat (cadres, clés, parapluies) juraient avec le lacet et les barres, et revenaient sans fin. Une matière (une étoffe tissée dans le shader), une couleur et une lumière tiennent une heure sans s'user. Le papier peint reste visible avec `?papier`.
- **Rien au premier plan.** La profondeur de champ ne floute que de quelques pixels : une silhouette nette au premier plan restait un découpage. Des fils dessinés déjà flous (une bande douce, sombre au milieu) se lisaient comme des barres noires, un bug. Le premier plan est vide, et l'image plus lisible.
