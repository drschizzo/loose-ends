// The floors the climb goes through: a house, then the sky, for ever.
//
// The lace is the lace of a pair of shoes left by the door. The house it
// climbs is the house of an old couple, emptied after they are gone: never
// said, only seen. Cartons « à donner », a mirror under a sheet, a calendar
// stopped long ago, the laundry dry for ever on its line, the bed made. A red
// thread runs up the wall from floor to floor; out of the attic it turns to
// light, and at dawn it ends in a bow. Above, the sky does not end.
//
// A floor is chosen per stretch of course (from post to post): it changes on
// a post, when the lace has just been saved, so that a new floor comes as a
// reward. Which floor, follows the time a good player would have taken to get
// there (see `STORY` in tuning.ts): the house lasts some fifty minutes.
// A floor also leans the course its way: the laundry has more lines, the
// sewing room more skeins and eyelets.

export interface Floor {
  /** what the card says when the lace comes into it */
  name: string;
  /** one line under it, said softly */
  line: string;
  /** above the house: no walls */
  sky?: boolean;
  /** parts the floor has more of (× their weight), by name */
  favours?: Record<string, number>;
}

export const FLOORS: Floor[] = [
  { name: 'L\'entrée', line: 'Ses chaussures attendent près de la porte.', favours: { barres: 1.5 } },
  { name: 'La penderie', line: 'Tout sent encore la lavande.', favours: { 'rideau de cordes': 3, 'fils posés': 1.5 } },
  { name: 'La chambre des petits', line: 'Les dessins sont restés au mur.', favours: { 'échelle de corde': 3, filet: 2, chicanes: 2 } },
  { name: 'L\'atelier', line: 'Le tricot attend sa dernière rangée.', favours: { écheveau: 3, ciseaux: 2, œillets: 2, 'œillets croisés': 2, 'colonne d\'œillets': 2 } },
  { name: 'La buanderie', line: 'Le linge a séché depuis longtemps.', favours: { 'fils à linge': 3, cascade: 3, traversée: 1.5 } },
  { name: 'Le salon', line: 'Les lunettes gardent la page.', favours: { 'barres mobiles': 2, bougies: 2.5, pendule: 2 } },
  { name: 'La chambre', line: 'Le lit est fait.', favours: { 'fils posés': 2, tirette: 2, 'deux tirettes': 2 } },
  { name: 'Le grenier', line: 'Ici, on a rangé les étés.', favours: { 'forêt de lianes': 2.5, filet: 2, 'corde lisse': 2 } },
  { name: 'Le toit', line: 'La nuit tombe doucement.', favours: { 'corde lisse': 2, pendule: 2, 'escalier de chrome': 2 } },
  // the sky: where the climb is « up »
  { name: 'La nuit', line: 'Il y a tant d\'étoiles, d\'ici.', sky: true, favours: { pendule: 2, 'fils posés': 1.5 } },
  { name: 'L\'aube', line: 'Le jour se lève quand même.', sky: true, favours: { 'fils à linge': 2, filet: 1.5 } },
  // then, for ever, round these
  { name: 'Les nuages', line: 'On y voit des formes connues.', sky: true },
  { name: 'Le grand ciel', line: 'Plus rien ne pèse.', sky: true },
  { name: 'Les étoiles', line: 'Une de plus, ce soir.', sky: true },
  { name: 'Le matin', line: 'Et tout recommence.', sky: true },
];

/** floors 0 to HOUSE − 1 are the house; HOUSE is the sky */
export const HOUSE = 9;
/** the first of the floors the sky goes round for ever */
export const ROUND = 11;

/** the floor after floor f (the sky goes round its last floors) */
export const nextFloor = (f: number): number => (f + 1 < FLOORS.length ? f + 1 : ROUND);
