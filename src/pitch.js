import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/500.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/pitch.css';

const PITCH_SECONDS = 120;

const stage = document.getElementById('stage');
const viewport = document.getElementById('viewport');
const slides = [...document.querySelectorAll('.slide')];
const water = document.getElementById('water');
const hp = document.getElementById('hp');
const timerEl = document.getElementById('timer');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Scale the 1600x900 stage to the window ----------
function fit() {
    const s = Math.min(innerWidth / 1600, innerHeight / 900);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit);
fit();

// ---------- HP bar = progress (one segment per slide) ----------
slides.forEach((_, n) => {
    const seg = document.createElement('i');
    seg.style.setProperty('--t', slides.length > 1 ? (n / (slides.length - 1) * 100).toFixed(1) + '%' : '0%');
    hp.appendChild(seg);
});
const segs = [...hp.children];

// Autoplay + loop. Muted is required for browsers to allow autoplay; if the file
// is still loading, start as soon as it can play.
function playVideo(v) {
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.play().catch(() => {
        v.addEventListener('canplay', () => {
            if (v.closest('.slide.active')) v.play().catch(() => {});
        }, { once: true });
    });
}

// ---------- Sub-steps: a slide with data-steps (the "Why" card gallery) eats arrow presses first ----------
const whySlide = document.querySelector('.s-why');
const whyStack = document.getElementById('why-stack');
const whyCards = [...whyStack.children];
const whyTitle = document.getElementById('why-title');
const whyDots = [...document.querySelectorAll('#why-dots i')];
const whyCount = document.getElementById('why-count');
let sub = 0;

// Card depth layout, same maths as the threejs-slides gallery (scaled to the 1600x900 stage).
function layoutWhy(active, instant = false) {
    whyCards.forEach((card, i) => {
        const o = i - active;
        let t, op, blur = 0, bright = 1, z;
        if (o === 0) {
            t = 'translate3d(60px,0,0) rotateY(-18deg)';
            op = 1; bright = 1.05; z = 30;
        } else if (o > 0) {
            t = `translate3d(${60 + o * 95}px,${-o * 8}px,${-o * 125}px) rotateY(${-18 - o * 4.5}deg) scale(${1 - o * 0.07})`;
            op = Math.max(0.28, 0.82 - o * 0.16); blur = Math.min(2, o * 0.7); bright = Math.max(0.65, 0.94 - o * 0.09); z = 30 - o;
        } else {
            t = `translate3d(${60 + o * 120 - 50}px,0,${o * 100}px) rotateY(15deg) scale(${1 + o * 0.1})`;
            op = 0; blur = 4; z = 5;
        }
        card.style.transition = instant ? 'none' : '';
        card.style.transform = t;
        card.style.opacity = op;
        card.style.zIndex = z;
        card.style.filter = `blur(${blur}px) brightness(${bright})`;
        card.style.boxShadow = o === 0
            ? '0 30px 60px -15px rgba(0,0,0,.95), 0 0 32px rgba(107,202,186,.45), 0 0 70px rgba(60,140,255,.22)'
            : `0 ${20 - o * 3}px 40px -10px rgba(0,0,0,.9), 0 0 ${Math.max(0, 20 - o * 3)}px rgba(107,202,186,${Math.max(0, 0.25 - o * 0.05)})`;
        card.style.pointerEvents = 'none';
        card.classList.toggle('front', o === 0);
    });
    if (instant) { void whyStack.offsetWidth; whyCards.forEach(c => { c.style.transition = ''; }); }
}

// sub 0 = grand-entrance title, sub 1..n = the cards
function setWhy(n, instant = false) {
    const prev = sub - 1;
    const card = n - 1;
    sub = n;
    whySlide.dataset.phase = card < 0 ? 'intro' : 'cards';
    layoutWhy(Math.max(card, -1), instant);
    whyDots.forEach((d, i) => d.classList.toggle('on', i === card));
    if (card < 0) return;
    whyCount.textContent = `${String(card + 1).padStart(2, '0')} / ${String(whyCards.length).padStart(2, '0')}`;
    whyTitle.textContent = whyCards[card].dataset.title;
    if (prev >= 0 && prev !== card) {
        whyTitle.classList.remove('swap');
        void whyTitle.offsetWidth;
        whyTitle.classList.add('swap');
    }
}

// Gameplay slide: step 0 = teaser, step 1 = nodes, then the lines + video follow on their own.
let playTimer = 0;
function setSub(slide, n, instant = false) {
    if (slide === whySlide) { setWhy(n, instant); return; }
    sub = n;
    clearTimeout(playTimer);
    if (n === 0) slide.dataset.phase = 'intro';
    else if (instant) slide.dataset.phase = 'link';
    else {
        slide.dataset.phase = 'nodes';
        playTimer = setTimeout(() => { if (sub === n) slide.dataset.phase = 'link'; }, 1700);
    }
}

// ---------- Navigation ----------
let current = -1;

function show(n, fromEnd = false) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === current) return;
    const prev = slides[current];
    if (prev) {
        prev.classList.remove('active');
        if (prev.classList.contains('s-title')) {
            prev.classList.add('leaving');
            setTimeout(() => prev.classList.remove('leaving'), 900);
        }
        prev.querySelectorAll('video').forEach(v => v.pause());
    }
    const next = slides[n];
    if (next.dataset.steps) setSub(next, fromEnd ? +next.dataset.steps - 1 : 0, true);
    next.classList.remove('leaving');
    // Restart entrance animations by toggling the class on a fresh frame.
    void next.offsetWidth;
    next.classList.add('active');
    next.querySelectorAll('video:not([hidden])').forEach(v => {
        v.currentTime = 0;
        playVideo(v);
    });
    current = n;
    water.style.setProperty('--level', `${next.dataset.water || 8}%`);
    segs.forEach((s, i) => s.classList.toggle('on', i <= n));
    history.replaceState(null, '', `#${n + 1}`);
    if (n === 0) burst(); // fresh flare when we return to the title
}

const go = d => {
    const steps = +slides[current].dataset.steps || 0;
    if (steps && d > 0 && sub < steps - 1) setSub(slides[current], sub + 1);
    else if (steps && d < 0 && sub > 0) setSub(slides[current], sub - 1);
    else show(current + d, d < 0);
};

addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') { go(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') { go(-1); e.preventDefault(); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') {
        document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    } else if (e.key === 't' || e.key === 'T') timerEl.classList.toggle('hidden');
    else if (e.key === 'm' || e.key === 'M') {
        const v = document.getElementById('vid-gameplay');
        v.muted = !v.muted;
    }
});

viewport.addEventListener('click', e => {
    if (e.target.closest('a, #timer')) return;
    const x = e.clientX / innerWidth;
    go(x < 0.2 ? -1 : 1);
});

// ---------- Timer (starts on first advance; click to pause) ----------
let remaining = PITCH_SECONDS;
let running = false;
let paused = false;
const fmt = s => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`;
function drawTimer() {
    timerEl.textContent = (remaining < 0 ? '+' : '') + fmt(remaining);
    timerEl.classList.toggle('warn', remaining <= 15 && remaining >= 0);
    timerEl.classList.toggle('over', remaining < 0);
}
setInterval(() => {
    if (running && !paused) { remaining--; drawTimer(); }
}, 1000);
timerEl.addEventListener('click', () => {
    if (!running) running = true; else paused = !paused;
    timerEl.classList.toggle('paused', paused);
});
timerEl.addEventListener('dblclick', () => {
    remaining = PITCH_SECONDS; running = false; paused = false;
    timerEl.classList.remove('paused'); drawTimer();
});
addEventListener('keydown', () => { if (!running && current > 0) running = true; });

// ---------- Embers (burning phosphorus) ----------
const cv = document.getElementById('embers');
const ctx = cv.getContext('2d');
const embers = [];
const MAX = 90;

function spawn(x, y, boost = 1) {
    embers.push({
        x, y,
        vx: (Math.random() - 0.5) * 0.9 * boost,
        vy: -(0.6 + Math.random() * 1.6) * boost,
        r: 1.5 + Math.random() * 3.2,
        life: 0,
        max: 160 + Math.random() * 180,
        hue: 28 + Math.random() * 28
    });
}

function burst() {
    if (reduceMotion) return;
    for (let i = 0; i < 60; i++) spawn(500 + Math.random() * 600, 560 + Math.random() * 120, 2.2);
}

function tick() {
    ctx.clearRect(0, 0, 1600, 900);
    const intensity = current === 0 ? 1 : current === 4 ? 0.35 : current === 7 ? 0.2 : 0.12;
    if (!reduceMotion && embers.length < MAX && Math.random() < 0.5 * intensity + 0.05) {
        spawn(Math.random() * 1600, 920 - (parseFloat(water.style.getPropertyValue('--level')) || 8) * 9);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = embers.length - 1; i >= 0; i--) {
        const p = embers[i];
        p.life++;
        p.x += p.vx + Math.sin((p.life + p.x) * 0.03) * 0.4;
        p.y += p.vy;
        p.vy *= 0.998;
        const t = p.life / p.max;
        if (t >= 1) { embers.splice(i, 1); continue; }
        const a = (1 - t) * 0.85;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `hsla(${p.hue + 10},100%,75%,${a})`);
        g.addColorStop(0.35, `hsla(${p.hue},100%,55%,${a * 0.5})`);
        g.addColorStop(1, `hsla(${p.hue - 10},100%,45%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---------- Start ----------
drawTimer();
const start = parseInt(location.hash.slice(1), 10);
show(Number.isFinite(start) ? start - 1 : 0);
