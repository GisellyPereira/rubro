import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ------------------------------------------------------------------ */
/* Estado global do ponteiro (mouse, toque ou giroscópio)             */
/* ------------------------------------------------------------------ */
const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0.5, ny: 0.5, source: 'none' };
const setPointer = (x, y, source) => {
  pointer.x = x; pointer.y = y;
  pointer.nx = clamp(x / innerWidth, 0, 1);
  pointer.ny = clamp(y / innerHeight, 0, 1);
  pointer.source = source;
};
addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY, e.pointerType), { passive: true });

/* ------------------------------------------------------------------ */
/* Scroll suave                                                       */
/* ------------------------------------------------------------------ */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });
});

/* ------------------------------------------------------------------ */
/* Divisão de texto em linhas / palavras                              */
/* ------------------------------------------------------------------ */
function splitLines(el) {
  // Cada trecho separado por <br> vira uma linha mascarada
  const parts = el.innerHTML.split(/<br\s*\/?>/i).map((p) => p.trim());
  el.innerHTML = parts.map((p) => `<span class="line"><span>${p}</span></span>`).join('');
  return $$('.line > span', el);
}
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((chunk) => {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) frag.appendChild(document.createTextNode(chunk));
          else { const s = document.createElement('span'); s.className = 'word'; s.textContent = chunk; frag.appendChild(s); }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    });
  };
  walk(el);
  return $$('.word', el);
}

/* ------------------------------------------------------------------ */
/* Preloader                                                          */
/* ------------------------------------------------------------------ */
const heroTitleLines = splitLines($('.hero__title'));
const heroImg = $('[data-char]');
const imgReady = heroImg.complete ? Promise.resolve() : new Promise((r) => { heroImg.onload = r; heroImg.onerror = r; });
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

function runLoader() {
  const count = $('[data-count]');
  const bar = $('.loader__bar span');
  const state = { v: 0 };
  const tl = gsap.timeline();
  tl.to(state, {
    v: 100, duration: reduced ? 0.2 : 1.6, ease: 'power2.inOut',
    onUpdate: () => { count.textContent = Math.round(state.v); bar.style.transform = `scaleX(${state.v / 100})`; },
  });
  return Promise.all([imgReady, fontsReady, new Promise((r) => tl.eventCallback('onComplete', r))]);
}

function intro() {
  document.body.classList.remove('is-loading');
  if (lenis) lenis.start();
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.loader', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' })
    .set('.loader', { display: 'none' })
    .from('[data-stage]', { yPercent: 40, opacity: 0, duration: 1.4 }, '-=0.55')
    .from('.hero__ghost', { opacity: 0, scale: 0.9, duration: 1.6 }, '<')
    .from(heroTitleLines, { yPercent: 110, duration: 1.1, stagger: 0.08 }, '<0.15')
    .from('.hero__side > *', { y: 30, opacity: 0, duration: 0.9, stagger: 0.1 }, '<0.2')
    .from('.nav > *', { y: -20, opacity: 0, duration: 0.8, stagger: 0.06 }, '<')
    .from('.hero__hint, .hero__badge', { opacity: 0, duration: 0.8 }, '<0.2');
}

/* ------------------------------------------------------------------ */
/* Cursor customizado                                                 */
/* ------------------------------------------------------------------ */
function initCursor() {
  if (!finePointer) return;
  const ring = $('.cursor');
  const dot = $('.cursor-dot');
  const label = $('.cursor__label');
  const pos = { x: pointer.x, y: pointer.y };
  gsap.ticker.add(() => {
    pos.x = lerp(pos.x, pointer.x, 0.18);
    pos.y = lerp(pos.y, pointer.y, 0.18);
    ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
  });
  $$('a, button, [data-tilt]').forEach((el) => {
    el.addEventListener('mouseenter', () => { if (!el.dataset.cursor) ring.classList.add('is-hover'); });
    el.addEventListener('mouseleave', () => ring.classList.remove('is-hover'));
  });
  $$('[data-cursor]').forEach((el) => {
    el.addEventListener('mouseenter', () => { label.textContent = el.dataset.cursor; ring.classList.add('is-label'); dot.style.opacity = 0; });
    el.addEventListener('mouseleave', () => { ring.classList.remove('is-label'); dot.style.opacity = 1; });
  });
  document.addEventListener('mouseleave', () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 }));
  document.addEventListener('mouseenter', () => gsap.to([ring, dot], { opacity: 1, duration: 0.3 }));
}

/* ------------------------------------------------------------------ */
/* Botões magnéticos                                                  */
/* ------------------------------------------------------------------ */
function initMagnetic() {
  if (!finePointer || reduced) return;
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.45);
    });
    el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
  });
}

/* ------------------------------------------------------------------ */
/* HERO: personagem que segue o ponteiro                              */
/*  - com vídeo (/video/hero.mp4): scrub do tempo pelo eixo X          */
/*  - sem vídeo: inclinação 3D + parallax                              */
/* ------------------------------------------------------------------ */
function initHero() {
  const hero = $('[data-hero]');
  const stage = $('[data-stage]');
  const char = $('[data-char]');
  const video = $('[data-video]');
  const ghost = $('.hero__ghost');
  const glow = $('.hero__glow');
  const hint = $('[data-hint]');
  const target = { x: 0.5, y: 0.5 };
  const cur = { x: 0.5, y: 0.5 };
  let heroVisible = true;
  let hasVideo = false;
  let seeking = false;

  // Vídeo do personagem (opcional): defina data-src="/video/hero.mp4" no <video>
  if (video.dataset.src) {
    video.src = video.dataset.src;
    video.addEventListener('loadedmetadata', () => { hasVideo = true; hero.classList.add('has-video'); }, { once: true });
    video.addEventListener('seeked', () => { seeking = false; });
    video.load();
  }

  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);

  // Toque: arrastar no hero move o personagem
  hero.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    setPointer(t.clientX, t.clientY, 'touch');
  }, { passive: true });

  // Giroscópio (celular)
  const onOrient = (e) => {
    if (e.gamma == null) return;
    const gx = clamp((e.gamma + 30) / 60, 0, 1);
    const gy = clamp(((e.beta ?? 45) - 20) / 50, 0, 1);
    pointer.nx = gx; pointer.ny = gy; pointer.source = 'gyro';
  };
  const isTouch = !finePointer;
  if (isTouch) {
    hint.textContent = 'Arraste ou incline o celular';
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      const btn = $('.gyro-btn');
      btn.hidden = false;
      btn.addEventListener('click', async () => {
        try { if ((await DOE.requestPermission()) === 'granted') addEventListener('deviceorientation', onOrient); } catch (_) {}
        btn.hidden = true;
      });
    } else if (DOE) {
      addEventListener('deviceorientation', onOrient);
    }
  }

  // Movimento ocioso: se ninguém mexer, o personagem "respira" de um lado pro outro
  let lastMove = performance.now();
  addEventListener('pointermove', () => { lastMove = performance.now(); }, { passive: true });
  addEventListener('touchmove', () => { lastMove = performance.now(); }, { passive: true });

  gsap.ticker.add(() => {
    if (!heroVisible) return;
    const now = performance.now();
    const idle = now - lastMove > 2500 && pointer.source !== 'gyro';
    if (idle) {
      target.x = 0.5 + Math.sin(now / 1600) * 0.32;
      target.y = 0.5 + Math.cos(now / 2100) * 0.12;
    } else {
      target.x = pointer.nx;
      target.y = pointer.ny;
    }
    const ease = reduced ? 1 : 0.08;
    cur.x = lerp(cur.x, target.x, ease);
    cur.y = lerp(cur.y, target.y, ease);
    const dx = cur.x - 0.5;
    const dy = cur.y - 0.5;

    if (hasVideo && video.duration) {
      // Scrub do vídeo: esquerda = início, direita = fim
      const t = clamp(cur.x, 0, 0.999) * video.duration;
      if (!seeking && Math.abs(video.currentTime - t) > 1 / 60) {
        seeking = true;
        video.currentTime = t;
      }
      stage.style.transform = `translateX(calc(-50% + ${dx * 18}px))`;
    } else if (!reduced) {
      char.style.transform = `rotateY(${dx * 22}deg) rotateX(${-dy * 8}deg) translate3d(${dx * 26}px, ${dy * 10}px, 0)`;
    }
    ghost.style.transform = `translate(calc(-50% + ${-dx * 70}px), calc(-50% + ${-dy * 24}px))`;
    glow.style.transform = `translate3d(${cur.x * hero.clientWidth}px, ${cur.y * hero.clientHeight}px, 0)`;
  });

  // Parallax de saída do hero no scroll
  if (!reduced) {
    gsap.to(stage, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__title, .hero__side', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: '30% top', end: 'bottom top', scrub: true } });
  }
}

/* ------------------------------------------------------------------ */
/* Campo de pontos interativo no fundo do hero (canvas)               */
/* ------------------------------------------------------------------ */
function initField() {
  const canvas = $('.hero__field');
  const ctx = canvas.getContext('2d');
  const hero = $('[data-hero]');
  let w, h, dpr, pts = [];
  const GAP = 34;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = [];
    for (let y = GAP / 2; y < h; y += GAP) for (let x = GAP / 2; x < w; x += GAP) pts.push({ x, y, ox: x, oy: y });
  };
  resize();
  addEventListener('resize', resize);
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  gsap.ticker.add(() => {
    if (!visible) return;
    const r = hero.getBoundingClientRect();
    const mx = pointer.nx * w, my = pointer.y - r.top;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    for (const p of pts) {
      const dx = p.ox - mx, dy = p.oy - my;
      const d = Math.hypot(dx, dy);
      const f = Math.max(0, 1 - d / 220);
      const tx = p.ox + (dx / (d || 1)) * f * 22;
      const ty = p.oy + (dy / (d || 1)) * f * 22;
      p.x = reduced ? p.ox : lerp(p.x, tx, 0.15);
      p.y = reduced ? p.oy : lerp(p.y, ty, 0.15);
      ctx.globalAlpha = 0.18 + f * 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.1 + f * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Marquee com velocidade/direção ligadas ao scroll                   */
/* ------------------------------------------------------------------ */
function initMarquee() {
  const track = $('[data-marquee]');
  const tween = gsap.to(track, { xPercent: -50, duration: 22, ease: 'none', repeat: -1 });
  if (reduced) { tween.pause(); return; }
  let dir = 1;
  ScrollTrigger.create({
    onUpdate: (self) => {
      dir = self.direction;
      const v = clamp(Math.abs(self.getVelocity()) / 400, 0, 6);
      gsap.to(tween, { timeScale: dir * (1 + v), duration: 0.2, overwrite: true });
      gsap.to(tween, { timeScale: dir, duration: 1.2, delay: 0.2, ease: 'power2.out' });
    },
  });
  gsap.to('.marquee i', { rotation: 360, duration: 6, ease: 'none', repeat: -1 });
}

/* ------------------------------------------------------------------ */
/* Revelações no scroll                                               */
/* ------------------------------------------------------------------ */
function initReveals() {
  $$('[data-split]').forEach((el) => {
    if (el.classList.contains('hero__title')) return;
    const lines = splitLines(el);
    gsap.from(lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  $$('[data-fade]').forEach((el) => {
    if (el.closest('.hero')) return;
    gsap.from(el, { y: 28, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  $$('.cards, .grid, .stats').forEach((group) => {
    gsap.from($$('[data-reveal]', group), { y: 80, opacity: 0, rotate: 1.5, duration: 1.2, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: group, start: 'top 85%' } });
  });
  gsap.from('.quote', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.quote', start: 'top 85%' } });

  // Texto que "acende" palavra por palavra conforme o scroll
  $$('[data-words]').forEach((el) => {
    const words = splitWords(el);
    if (reduced) { words.forEach((w) => w.classList.add('is-on')); return; }
    ScrollTrigger.create({
      trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: (self) => {
        const n = Math.round(self.progress * words.length);
        words.forEach((w, i) => w.classList.toggle('is-on', i < n));
      },
    });
  });

  // Parallax nas imagens dos trabalhos
  $$('.tile__media').forEach((m) => {
    gsap.fromTo(m, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: m.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Linha do processo + números
  gsap.to('.steps__line', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '[data-steps]', start: 'top 80%', end: 'top 35%', scrub: true } });
  gsap.from('.step', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '[data-steps]', start: 'top 80%' } });

  // Contadores
  $$('[data-counter]').forEach((el) => {
    const end = parseFloat(el.dataset.counter);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const obj = { v: 0 };
    const fmt = (v) => v.toFixed(dec).replace('.', ',');
    if (reduced) { el.textContent = fmt(end); return; }
    gsap.to(obj, { v: end, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => { el.textContent = fmt(obj.v); } });
  });

  // Logo do rodapé
  gsap.from('[data-footer-logo] span', { yPercent: 100, duration: 1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.footer', start: 'top 85%' } });

  // CTA: olhos aparecem com "pulo"
  gsap.from('.eye', { scale: 0, duration: 0.9, ease: 'back.out(2.5)', stagger: 0.1, scrollTrigger: { trigger: '.cta', start: 'top 75%' } });
}

/* ------------------------------------------------------------------ */
/* Cards de serviço com inclinação 3D e brilho                        */
/* ------------------------------------------------------------------ */
function initTilt() {
  if (!finePointer || reduced) return;
  $$('[data-tilt]').forEach((card) => {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      ry((px - 0.5) * 14);
      rx(-(py - 0.5) * 12);
    });
    card.addEventListener('mouseleave', () => { rx(0); ry(0); });
  });
}

/* ------------------------------------------------------------------ */
/* Olhinhos do CTA seguindo o ponteiro                                */
/* ------------------------------------------------------------------ */
function initEyes() {
  const eyes = $$('.eye');
  const cta = $('.cta');
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cta);
  const pupils = eyes.map((eye) => ({ eye, pupil: $('i', eye), x: 0, y: 0 }));
  gsap.ticker.add(() => {
    if (!visible) return;
    pupils.forEach((p) => {
      const r = p.eye.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const px = pointer.source === 'gyro' ? pointer.nx * innerWidth : pointer.x;
      const py = pointer.source === 'gyro' ? pointer.ny * innerHeight : pointer.y;
      const ang = Math.atan2(py - cy, px - cx);
      const dist = Math.min(r.width * 0.2, Math.hypot(px - cx, py - cy) / 8);
      p.x = lerp(p.x, Math.cos(ang) * dist, 0.2);
      p.y = lerp(p.y, Math.sin(ang) * dist, 0.2);
      p.pupil.style.transform = `translate(${p.x}px, ${p.y}px)`;
    });
  });
}

/* ------------------------------------------------------------------ */
/* Cor do menu conforme a seção que está por baixo                    */
/* ------------------------------------------------------------------ */
function initNavTheme() {
  const nav = $('.nav');
  $$('[data-nav="dark"]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 44px', end: 'bottom 44px',
      onToggle: (self) => nav.classList.toggle('nav--dark', self.isActive),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Menu mobile                                                        */
/* ------------------------------------------------------------------ */
const burger = $('.nav__burger');
const menu = $('.mobile-menu');
function closeMenu() {
  menu.classList.remove('is-open');
  $('.nav').classList.remove('is-menu');
  menu.setAttribute('aria-hidden', 'true');
  burger.setAttribute('aria-expanded', 'false');
  lenis?.start();
}
burger.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  menu.classList.toggle('is-open', open);
  $('.nav').classList.toggle('is-menu', open);
  menu.setAttribute('aria-hidden', String(!open));
  burger.setAttribute('aria-expanded', String(open));
  if (open) {
    lenis?.stop();
    gsap.fromTo($$('a', menu), { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06, delay: 0.15 });
  } else lenis?.start();
});

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */
initCursor();
initMagnetic();
initHero();
initField();
initMarquee();
initReveals();
initTilt();
initEyes();
initNavTheme();

runLoader().then(() => {
  intro();
  ScrollTrigger.refresh();
});
