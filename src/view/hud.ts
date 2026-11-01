// The page around the scene (index.html): the bar at the top, the élan, the
// challenge of the stretch and what is carried, the card of each end (while
// the gestures are new), the line of help, the toasts, the panel of a post
// (its time, its challenge, the stretch above to choose, the shop), the
// title screen, the ending.

import type { End, Lace } from '../play/lace';
import { chosen, clue, LACES, unlocked } from '../play/laces';
import { buy, canBuy, LACE_KINDS, owned, progress, WARES, type Ware } from '../play/progress';
import { PLAY } from '../tuning';

const $ = (id: string) => document.getElementById(id)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** a time in seconds, as m:ss (or h:mm:ss) */
export const clockOf = (s: number): string => {
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(Math.floor(s) % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/** what the panel of a post shows */
export interface PostReport {
  /** the time from the post below, the best before it (null: the first time) */
  time: number;
  best: number | null;
  /** the challenge of the stretch just climbed, met or not, and what it paid */
  challenge: { text: string; met: boolean; reward: number } | null;
  /** buttons taken on the way */
  taken: number;
  /** the stretch above: its twist if chosen twisted (null: no choice yet), which is chosen, and to choose */
  twist: { name: string; pays: string } | null;
  twisted: boolean;
  pick: (twisted: boolean) => void;
  /** a kind of lace chosen in the shop (the lace is made again) */
  wear: (kind: string) => void;
  go: () => void;
}

export class Hud {
  private toastTimer = 0;
  private cardTimer = 0;
  private wallet = -1;

  /** the counters at the top */
  stats(time: string, wallet: number, height: string, best: string): void {
    $('time').textContent = time;
    if (wallet !== this.wallet) {
      if (this.wallet >= 0 && wallet > this.wallet) { const w = $('buttons').parentElement!; w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); }
      this.wallet = wallet;
      $('buttons').textContent = String(wallet);
    }
    $('height').textContent = height;
    $('best').textContent = best;
  }

  /** the élan: how many stitches lit, of how many */
  flow(level: number, most: number): void {
    const f = $('flow');
    f.classList.toggle('on', level > 0);
    f.classList.toggle('max', level >= most);
    f.querySelectorAll('i').forEach((s, k) => s.classList.toggle('lit', k < level));
  }

  /** the challenge of the stretch (null: none), how it goes */
  challenge(text: string | null, state: 'on' | 'met' | 'failed' = 'on'): void {
    const c = $('challenge');
    c.classList.toggle('hidden', !text);
    c.classList.toggle('met', state === 'met');
    c.classList.toggle('failed', state === 'failed');
    c.querySelector('span')!.textContent = text ?? '';
  }

  /** what is carried: patches, second winds */
  items(): void {
    const box = $('items'), { patch, breath } = progress.items;
    box.classList.toggle('hidden', !patch && !breath);
    box.replaceChildren(...[patch ? el('span', '', `rustine × ${patch}`) : null, breath ? el('span', '', `souffle × ${breath}`) : null].filter((e): e is HTMLSpanElement => !!e));
  }

  /** a word for a moment, under the bar */
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
  card(name: string, line: string, seconds = 4.5): void {
    $('floor').querySelector('h2')!.textContent = name;
    $('floor').querySelector('p')!.textContent = line;
    $('floor').classList.add('show');
    this.cardTimer = seconds;
  }

  /** the laces found so far, on the title screen: the one chosen ringed, those not found yet a question */
  laces(pick: (k: number) => void): void {
    const row = $('laces'), name = el('div', 'lace-name', chosen().name);
    row.replaceChildren();
    if (row.nextElementSibling?.classList.contains('lace-name')) row.nextElementSibling.remove();
    LACES.forEach((l, k) => {
      const b = el('button');
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

  /** the kinds of lace, on the title screen: those bought (the others are bought on a post) */
  kinds(pick: (id: string) => void): void {
    const row = $('kinds'), name = el('div', 'lace-name');
    row.replaceChildren();
    if (row.nextElementSibling?.classList.contains('lace-name')) row.nextElementSibling.remove();
    const say = (id: string) => WARES.find((w) => w.id === id)?.what ?? (id === 'paire' ? 'Les deux lacets noués : deux fois plus long, plus lourd.' : 'Le lacet de tous les jours.');
    name.textContent = say(progress.kind);
    for (const k of LACE_KINDS) {
      if (k.id === 'paire' && !progress.reunited) continue;
      const b = el('button', '', k.name), have = progress.kinds.includes(k.id) || (k.id === 'paire' && progress.reunited);
      b.disabled = !have;
      b.title = have ? say(k.id) : `${say(k.id)} (à acheter sur un poteau)`;
      b.classList.toggle('on', k.id === progress.kind);
      b.onmouseenter = () => { name.textContent = b.title; };
      b.onmouseleave = () => { name.textContent = say(progress.kind); };
      b.onclick = () => { pick(k.id); this.kinds(pick); };
      row.append(b);
    }
    row.after(name);
  }

  /** the line of help at the bottom */
  hint(text: string): void {
    if ($('hint').textContent !== text) $('hint').textContent = text;
  }

  /** the cards of the ends: shown while the gestures are new (or with H) */
  showCards(on: boolean): void {
    $('ends').classList.toggle('learned', !on);
    document.body.classList.toggle('cards', on);
  }

  /** what each end is doing, in its card */
  cards(lace: Lace, oneButton: boolean): void {
    const leader = lace.leader();
    lace.ends.forEach((e, k) => {
      const card = $(`end${k}`);
      (card.querySelector('i') as HTMLElement).style.width = `${(e.stamina * 100).toFixed(0)}%`;
      card.classList.toggle('tired', e.stamina < 0.35);
      card.classList.toggle('gripping', !!e.grip);
      card.classList.toggle('pressed', e.held);
      card.querySelector('em')!.textContent = doing(lace, e, leader);
      card.querySelector('.key')!.innerHTML = oneButton ? (k === 0 ? 'clic<small>accroche</small>' : 'clic droit<small>lâche tout</small>') : (k === 0 ? 'clic gauche<small>ou A</small>' : 'clic droit<small>ou D</small>');
    });
  }

  /** after a frame of dt seconds: the toast fades when its time is up */
  update(dt: number): void {
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) $('toast').classList.remove('show');
    if (this.cardTimer > 0 && (this.cardTimer -= dt) <= 0) $('floor').classList.remove('show');
  }

  /** the title screen: a new climb, the climb left last time (if there is one), today's climb; one button or two */
  title(o: { fresh: () => void; resume: { label: string; pick: () => void } | null; daily: { label: string; pick: () => void }; oneButton: (on: boolean) => void }): void {
    $('fresh').onclick = o.fresh;
    $('resume').classList.toggle('hidden', !o.resume);
    if (o.resume) { $('resume').textContent = o.resume.label; $('resume').onclick = o.resume.pick; }
    $('daily').innerHTML = o.daily.label;
    $('daily').onclick = o.daily.pick;
    const one = $('one-button') as HTMLInputElement;
    one.checked = progress.oneButton;
    one.onchange = () => o.oneButton(one.checked);
    this.titleWallet();
  }

  titleWallet(): void {
    $('title-wallet').innerHTML = `<i class="btn-icon"></i> ${progress.wallet} bouton${progress.wallet > 1 ? 's' : ''} de côté`;
  }

  hideTitle(): void {
    $('title').classList.add('hidden');
  }

  get posting(): boolean { return !$('post').classList.contains('hidden'); }

  /** the panel of a post */
  post(r: PostReport): void {
    const panel = $('post');
    panel.classList.remove('hidden');
    const d = r.best === null ? null : r.time - r.best;
    const split = $('post-split');
    split.className = 'split';
    split.innerHTML = '';
    split.append(`Du dernier poteau : ${clockOf(r.time)} `);
    if (d !== null) split.append(el('span', d <= 0 ? 'better' : 'worse', `(${d <= 0 ? '−' : '+'}${clockOf(Math.abs(d))})`));
    else split.append(el('span', '', '(premier passage)'));
    if (r.taken) split.append(el('div', '', `${r.taken} bouton${r.taken > 1 ? 's' : ''} ramassé${r.taken > 1 ? 's' : ''}`));
    const ch = $('post-challenge');
    ch.replaceChildren();
    if (r.challenge) ch.append(el('div', `result ${r.challenge.met ? 'met' : 'failed'}`, r.challenge.met ? `Défi tenu : ${r.challenge.text} (+${r.challenge.reward})` : `Défi manqué : ${r.challenge.text}`));
    const choice = $('post-choice');
    choice.replaceChildren();
    if (r.twist) {
      choice.append(el('h4', '', 'La trappe au-dessus'));
      const row = el('div', 'choice'), plain = el('button'), twisted = el('button');
      plain.innerHTML = 'Normale<small>comme prévu</small>';
      twisted.innerHTML = `${r.twist.name[0].toUpperCase()}${r.twist.name.slice(1)}<small>${r.twist.pays}</small>`;
      const show = (t: boolean) => { plain.classList.toggle('on', !t); twisted.classList.toggle('on', t); };
      show(r.twisted);
      plain.onclick = () => { r.pick(false); show(false); };
      twisted.onclick = () => { r.pick(true); show(true); };
      row.append(plain, twisted);
      choice.append(row);
    }
    this.shop(r);
    $('post-go').onclick = () => { this.closePost(); r.go(); };
  }

  closePost(): void {
    $('post').classList.add('hidden');
  }

  private shop(r: PostReport): void {
    const box = $('post-shop');
    box.replaceChildren(el('h4', '', `Mercerie · ${progress.wallet} bouton${progress.wallet > 1 ? 's' : ''}`));
    const row = (w: Ware) => {
      const line = el('div', 'ware'), text = el('div');
      text.append(el('b', '', w.name), el('small', '', w.what));
      line.append(text);
      const have = owned(w);
      if (w.kind === 'lace' && have) {
        const b = el('button', '', progress.kind === w.id ? 'porté' : 'porter');
        b.disabled = progress.kind === w.id;
        b.onclick = () => { r.wear(w.id); this.shop(r); };
        line.append(b);
      } else if (have >= (w.most ?? 1)) line.append(el('span', 'have', w.kind === 'item' ? `${have} / ${w.most}` : 'acquis'));
      else {
        const b = el('button', '', `${w.price}`);
        b.prepend(el('i', 'btn-icon'), ' ');
        b.disabled = !canBuy(w);
        b.onclick = () => { if (buy(w)) { this.items(); this.shop(r); r.wear(progress.kind); } };
        line.append(b);
        if (w.kind === 'item' && have) line.append(el('span', 'have', `${have}`));
      }
      box.append(line);
    };
    WARES.forEach(row);
    // back to the shoelace, from another kind
    if (progress.kind !== 'lacet') {
      const line = el('div', 'ware'), b = el('button', '', 'porter');
      line.append(Object.assign(el('div'), { innerHTML: '<b>Le lacet</b><small>Celui de tous les jours.</small>' }), b);
      b.onclick = () => { r.wear('lacet'); this.shop(r); };
      box.append(line);
    }
    if (progress.reunited && progress.kind !== 'paire') {
      const line = el('div', 'ware'), b = el('button', '', 'porter');
      line.append(Object.assign(el('div'), { innerHTML: '<b>La paire</b><small>Les deux lacets noués.</small>' }), b);
      b.onclick = () => { r.wear('paire'); this.shop(r); };
      box.append(line);
    }
  }

  /** the ending: the pair found */
  ending(stats: string, go: () => void): void {
    $('ending').classList.remove('hidden');
    $('ending-stats').textContent = stats;
    $('ending-go').onclick = () => { $('ending').classList.add('hidden'); go(); };
  }
}

function doing(lace: Lace, e: End, leader: End | null): string {
  if (e.cooldown > 0) return 'épuisée, elle lâche';
  if (e.grip?.kind === 'cord') return e.load < PLAY.restLoad ? 'tient une corde : fatigue lentement' : `tient une corde, effort ${Math.min(999, Math.round(e.load * 100))} % : fatigue`;
  if (e.grip) return e.load < PLAY.restLoad ? 'accrochée, se repose' : `accrochée, effort ${Math.min(999, Math.round(e.load * 100))} % : fatigue`;
  if (e !== leader) return 'pend';
  return lace.ends.some((o) => o.grip) || lace.supported ? 'suit la souris' : 'suit la souris, sans appui : faible';
}
