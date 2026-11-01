// The page around the scene (index.html): the bar at the top, the card of
// each end, the line of help, the toasts, the title screen.

import type { End, Lace } from '../play/lace';
import { chosen, clue, LACES, unlocked } from '../play/laces';
import { PLAY } from '../tuning';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  private toastTimer = 0;
  private cardTimer = 0;

  /** the three counters at the top */
  stats(time: string, buttons: string, height: string): void {
    $('time').textContent = time;
    $('buttons').textContent = buttons;
    $('height').textContent = height;
  }

  /** a word for a moment, in the middle */
  toast(text: string, seconds = 1.6): void {
    $('toast').textContent = text;
    $('toast').classList.add('show');
    this.toastTimer = seconds;
  }

  /** the floor the lace is on, at the top */
  storey(name: string): void {
    $('storey').textContent = name;
  }

  /** the card of a floor the lace comes into: its name, its line, a few seconds */
  card(name: string, line: string): void {
    $('floor').querySelector('h2')!.textContent = name;
    $('floor').querySelector('p')!.textContent = line;
    $('floor').classList.add('show');
    this.cardTimer = 4.5;
  }

  /** the laces found so far, on the title screen: the one chosen ringed, those not found yet a question */
  laces(pick: (k: number) => void): void {
    const row = $('laces'), name = document.createElement('div');
    row.replaceChildren();
    if (row.nextElementSibling?.classList.contains('lace-name')) row.nextElementSibling.remove();
    name.className = 'lace-name';
    name.textContent = chosen().name;
    LACES.forEach((l, k) => {
      const b = document.createElement('button');
      b.style.setProperty('--c', l.color);
      b.style.setProperty('--s', l.stripe);
      b.disabled = !unlocked(l);
      b.title = unlocked(l) ? l.name : `? (${clue(l)})`;
      b.classList.toggle('on', l === chosen());
      b.onmouseenter = () => { name.textContent = b.title; };
      b.onmouseleave = () => { name.textContent = chosen().name; };
      b.onclick = () => { pick(k); this.laces(pick); };
      row.append(b);
    });
    row.after(name);
  }

  /** the line of help at the top */
  hint(text: string): void {
    $('hint').textContent = text;
  }

  /** what each end is doing, in its card */
  cards(lace: Lace): void {
    const leader = lace.leader();
    lace.ends.forEach((e, k) => {
      const el = $(`end${k}`);
      (el.querySelector('i') as HTMLElement).style.width = `${(e.stamina * 100).toFixed(0)}%`;
      el.classList.toggle('tired', e.stamina < 0.35);
      el.classList.toggle('gripping', !!e.grip);
      el.classList.toggle('pressed', e.held);
      el.querySelector('em')!.textContent = doing(lace, e, leader);
    });
  }

  /** after a frame of dt seconds: the toast fades when its time is up */
  update(dt: number): void {
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) $('toast').classList.remove('show');
    if (this.cardTimer > 0 && (this.cardTimer -= dt) <= 0) $('floor').classList.remove('show');
  }

  /** the title screen: a new climb, or (if there is one) the climb left last time */
  title(fresh: () => void, resume: { label: string; pick: () => void } | null): void {
    $('fresh').onclick = fresh;
    $('resume').classList.toggle('hidden', !resume);
    if (resume) { $('resume').textContent = resume.label; $('resume').onclick = resume.pick; }
  }

  hideTitle(): void {
    $('title').classList.add('hidden');
  }
}

function doing(lace: Lace, e: End, leader: End | null): string {
  if (e.cooldown > 0) return 'épuisée, elle lâche';
  if (e.grip?.kind === 'cord') return e.load < PLAY.restLoad ? 'tient une corde : fatigue lentement' : `tient une corde, effort ${Math.min(999, Math.round(e.load * 100))} % : fatigue`;
  if (e.grip) return e.load < PLAY.restLoad ? 'accrochée, se repose' : `accrochée, effort ${Math.min(999, Math.round(e.load * 100))} % : fatigue`;
  if (e !== leader) return 'pend';
  return lace.ends.some((o) => o.grip) || lace.supported ? 'suit la souris' : 'suit la souris, sans appui : faible';
}
