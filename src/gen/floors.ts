// The floors the climb goes through: a house, then the sky, for ever.
//
// The lace was one of a pair, and it has lost the other. It climbs alone to
// find it, through every room of the house and on into the sky, after the
// red thread that runs up the walls: the thread said to tie together two who
// belong together. Out of the attic the thread turns to light; at dawn it
// ends in a knot, the other is near; above, the sky does not end, and every
// morning it is a little nearer.
//
// A floor is chosen per stretch of course (from post to post): it changes on
// a post, when the lace has just been saved, so that a new floor comes as a
// reward. Which floor, follows the time a good player would have taken to get
// there (see `STORY` in tuning.ts): the house lasts some fifty minutes.
// A floor also leans the course its way: the laundry has more lines, the
// sewing room more skeins and eyelets (`favours`, in catalog.json).

export interface Floor {
  /** what the card says when the lace comes into it */
  name: string;
  /** one line under it, said softly */
  line: string;
  /** above the house: no walls */
  sky?: boolean;
}

export const FLOORS: Floor[] = [
  { name: 'L\'entrée', line: 'Un lacet tout seul. L\'autre doit être plus haut.' },
  { name: 'La penderie', line: 'Des paires partout. Pas la sienne.' },
  { name: 'La chambre des petits', line: 'Ici, on apprend à faire ses lacets.' },
  { name: 'L\'atelier', line: 'Un fil rouge mène quelque part.' },
  { name: 'La buanderie', line: 'Même les chaussettes finissent par se retrouver.' },
  { name: 'Le salon', line: 'On l\'a vu filer vers le haut.' },
  { name: 'La chambre', line: 'Deux oreillers, côte à côte.' },
  { name: 'Le grenier', line: 'La lucarne est ouverte.' },
  { name: 'Le toit', line: 'Le fil continue dans le ciel.' },
  // the sky: where the climb is « up »
  { name: 'La nuit', line: 'Quelque part, l\'autre voit les mêmes étoiles.', sky: true },
  { name: 'L\'aube', line: 'Le fil se noue. L\'autre n\'est plus loin.', sky: true },
  // then, for ever, round these
  { name: 'Les nuages', line: 'On y voit des formes qui vont par deux.', sky: true },
  { name: 'Le grand ciel', line: 'Plus rien ne pèse.', sky: true },
  { name: 'Les étoiles', line: 'Deux étoiles, tout près l\'une de l\'autre.', sky: true },
  { name: 'Le matin', line: 'Chaque jour un peu plus près.', sky: true },
];

/** floors 0 to HOUSE − 1 are the house; HOUSE is the sky */
export const HOUSE = 9;
/** the first of the floors the sky goes round for ever */
export const ROUND = 11;

/** the floor after floor f (the sky goes round its last floors) */
export const nextFloor = (f: number): number => (f + 1 < FLOORS.length ? f + 1 : ROUND);
