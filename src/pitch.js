import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/pitch.css';

// Second gameplay video. Put the file in public/assets/videos/ and set the path,
// e.g. './assets/videos/second.mp4'. Empty string keeps the placeholder.
const VIDEO_2 = '';

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
slides.forEach(() => {
    const seg = document.createElement('i');
    hp.appendChild(seg);
});
const segs = [...hp.children];

// ---------- Video 2 placeholder swap ----------
const vid2 = document.getElementById('vid-2');
if (VIDEO_2) {
    vid2.src = VIDEO_2;
    vid2.hidden = false;
    document.getElementById('screen-2').classList.remove('placeholder');
    document.querySelector('#screen-2 .ph').remove();
}

// ---------- Navigation ----------
let current = -1;

function show(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === current) return;
    const prev = slides[current];
    if (prev) {
        prev.classList.remove('active');
        prev.querySelectorAll('video').forEach(v => v.pause());
    }
    const next = slides[n];
    // Restart entrance animations by toggling the class on a fresh frame.
    void next.offsetWidth;
    next.classList.add('active');
    next.querySelectorAll('video:not([hidden])').forEach(v => {
        v.currentTime = 0;
        v.play().catch(() => {});
    });
    current = n;
    water.style.setProperty('--level', `${next.dataset.water || 8}%`);
    segs.forEach((s, i) => s.classList.toggle('on', i <= n));
    history.replaceState(null, '', `#${n + 1}`);
    if (n === 0) burst(); // fresh flare when we return to the title
}

const go = d => show(current + d);

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
    const intensity = current === 0 ? 1 : current === 3 ? 0.35 : current === 7 ? 0.2 : 0.12;
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
