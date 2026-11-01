// The line of help: what to do now, from what the lace is doing and where
// it is. The first that applies.

import type { Level } from '../level/level';
import { PLAY } from '../tuning';
import type { Lace } from './lace';

export interface Situation {
  lace: Lace;
  level: Level;
  /** seconds the lace has lain against other cords, gripping none */
  tangled: number;
  /** the gates opened (a tip about a gate goes once it is) */
  isOpen: (gate: number) => boolean;
}

export function advice({ lace, level, tangled, isOpen }: Situation): string {
  const [h, t] = lace.ends, [cx, cy] = lace.centre(), leader = lace.leader();
  if (lace.ends.find((e) => e.grip && e.stamina < 0.35)) return 'Ta prise fatigue : accroche vite l\'autre bout, ou arrête de tendre et laisse pendre le lacet pour qu\'elle récupère.';
  const tiring = lace.ends.find((e) => e.grip && e.load >= PLAY.restLoad && e.stamina < 0.85);
  if (tiring) return 'Une prise fatigue quand l\'autre bout s\'étire pour monter (en rouge : ce qu\'il soulève). Pendu sous elle, le lacet la laisse récupérer (vert) : reprends ton souffle avant de tendre.';
  if (tangled > 1.5) return 'Emmêlé ? Ramène le bout par où il est passé, le lacet suit son chemin. Maintiens Espace : l\'aiguillette (le bout) passe devant ou derrière une corde, pas le reste du lacet.';
  const tip = level.tips.find((q) => Math.hypot(q.x - cx, q.y - cy) < q.r && (q.gate === undefined || !isOpen(q.gate)));
  if (tip) return tip.text;
  // under a shut trapdoor: what opens it, every time (its key wears its mark)
  const k = level.gates.findIndex((g, i) => !isOpen(i) && g.y0 - cy > -0.2 && g.y0 - cy < 1.4);
  if (k >= 0) return opens(level, k);
  if (h.grip && t.grip) return 'Les deux bouts tiennent. Relâche un clic : ce bout suivra la souris.';
  if (h.grip) return 'La queue (bleue) suit la souris. Amène-la contre une prise plus haute et maintiens clic droit.';
  if (t.grip) return 'La tête (orange) suit la souris. Amène-la contre une prise plus haute et maintiens clic gauche.';
  if (lace.supported) return 'Posé sur une barre : le bout le plus proche du pointeur le suit, avec toute sa force. Amène-le contre une prise et maintiens son clic.';
  if (cy > 0.3 && lace.speed() > 0.5) return 'Tu tombes ! Rattrape-toi vite : plus le lacet va vite, plus le choc coûte à la prise, et il peut l\'arracher.';
  return `Sans prise ni appui, le lacet ne peut pas se soulever. Le bout le plus proche du pointeur le suit : amène ${leader === t ? 'la queue (bleue)' : 'la tête (orange)'} contre une prise et maintiens ${leader === t ? 'clic droit' : 'clic gauche'}.`;
}

/** what opens trapdoor k, in words */
function opens(level: Level, k: number): string {
  const g = level.gates[k];
  if (g.period) return 'Trappe minutée : elle s\'ouvre et se referme toute seule, et s\'éclaire juste avant de s\'ouvrir. Tiens-toi prêt dessous, et passe un bout dès qu\'elle s\'ouvre.';
  if (g.post !== undefined) return 'Trappe du poteau : passe le lacet à cheval sur le poteau doré marqué de sa couleur, et lâche les deux bouts. S\'il tient en équilibre une seconde, c\'est sauvegardé et la trappe s\'ouvre.';
  if (g.rings) return `Trappe à œillets : le lacet passé dans les ${g.rings.length} œillets marqués de sa couleur, tous à la fois, l'ouvre.`;
  if (g.held) return 'Trappe à ressort : elle ne reste ouverte que tant que tu pèses sur la tirette marquée de sa couleur. Pends un bout à la tirette, passe l\'autre par la trappe.';
  if (g.pulls && g.pulls.length > 1) return 'Trappe à deux tirettes : pèse sur les deux tirettes marquées de sa couleur à la fois, un bout à chacune.';
  return 'Trappe à tirette : pends-toi à la tirette marquée de sa couleur, ton poids l\'ouvre.';
}
