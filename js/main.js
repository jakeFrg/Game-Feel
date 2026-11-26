// js/main.js
// Cuadro negro de combate: personajes, bucle, panel de capas y conexión con el motor.
import { Character } from './Character.js';
import { SoundFX } from './SoundFX.js';
import { FeedbackManager } from './FeedbackManager.js';
import { BattleEngine, ESTADOS } from './BattleEngine.js';

// ===== Canvas =====
const canvas = document.getElementById('escena');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ===== Personajes (baseX/baseY = posición de los pies) =====
const jugador = new Character({
  name: 'Héroe', maxHp: 120,
  baseX: 200, baseY: 360,
  width: 148, height: 208,          // sprite 37×52 ampliado ×4
  spriteSrc: 'assets/hero.png', isPlayer: true,
});
const rival = new Character({
  name: 'Rival', maxHp: 130,
  baseX: 520, baseY: 230,
  width: 111, height: 156,          // sprite 37×52 ampliado ×3 (más lejos)
  spriteSrc: 'assets/hero.png', isPlayer: false,
});
jugador.tipo = 'fuego';
rival.tipo = 'agua';
const personajes = [rival, jugador]; // el orden define quién se dibuja detrás

// ===== Servicios =====
const sonido = new SoundFX();
const camara = new FeedbackManager(canvas, ctx);

// ===== Flags: leen el estado de las casillas del panel =====
const casillas = {
  squashShake: document.getElementById('capa1'),
  tint:        document.getElementById('capa2'),
  screenEffects: document.getElementById('capa3'),
  sound:       document.getElementById('capa4'),
  hitstop:     document.getElementById('reto1'),
  elemental:   document.getElementById('reto2'),
};
const flags = {};

function leerFlags() {
  for (const clave in casillas) flags[clave] = casillas[clave].checked;
  camara.layers.layer3_screenEffects = flags.screenEffects; // Capa 3
  sonido.enabled = flags.sound;                             // Capa 4
}
Object.values(casillas).forEach(c => c.addEventListener('change', leerFlags));
leerFlags();

// ===== Interfaz =====
const cuadroMensaje = document.getElementById('mensaje');
const botonesAtaque = document.querySelectorAll('[data-ataque]');

// Los botones solo se activan en el turno del jugador
function actualizarBotones(estado) {
  botonesAtaque.forEach(b => { b.disabled = estado !== ESTADOS.TURNO_JUGADOR; });
}

// ===== Motor de combate (FSM) =====
const motor = new BattleEngine({
  player: jugador, enemy: rival,
  feedback: camara, sound: sonido, flags,
  onMessage: (texto) => { cuadroMensaje.textContent = texto; },
  onState: actualizarBotones,
});

botonesAtaque.forEach(b => b.addEventListener('click', () => {
  sonido.init(); // el clic autoriza el audio (Autoplay Policy)
  motor.chooseMove(b.dataset.ataque);
}));
document.getElementById('reiniciar').addEventListener('click', () => motor.reset());

// ===== Dibujo =====
// Nombre, tipo, barra de vida y cifras de un personaje
function dibujarBarra(p, x, y) {
  const w = 200;
  const h = 10;
  const pct = p.currentHp / p.maxHp;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px "Segoe UI", sans-serif';
  ctx.fillText(`${p.name} · ${p.tipo.toUpperCase()}`, x, y - 8);

  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#eab308' : '#ef4444';
  ctx.fillRect(x, y, w * pct, h);

  ctx.fillStyle = '#9aa4b5';
  ctx.font = '12px monospace';
  ctx.fillText(`${p.currentHp} / ${p.maxHp}`, x, y + 26);
}

function dibujar() {
  // Fondo negro
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Escena con sacudida de cámara (Capa 3)
  ctx.save();
  camara.applyCameraShake();
  dibujarBarra(rival, 24, 36);
  dibujarBarra(jugador, 480, 380);
  personajes.forEach(p => p.draw(ctx, flags));
  ctx.restore();

  // Destello de pantalla (Capa 3)
  camara.drawScreenFlash();
}

// ===== Bucle principal =====
let ultimo = performance.now();

function bucle(ahora) {
  // dt en segundos, limitado para evitar saltos al cambiar de pestaña
  const dt = Math.min((ahora - ultimo) / 1000, 0.05);
  ultimo = ahora;

  // Hitstop global: si alguien está congelado, nadie avanza (el dibujo sigue)
  const congelado = personajes.some(p => p.hitstopTimer > 0);
  if (congelado) {
    personajes.forEach(p => { p.hitstopTimer = Math.max(0, p.hitstopTimer - dt); });
  } else {
    personajes.forEach(p => p.update(dt, flags));
  }

  motor.update(dt);   // FSM del combate
  camara.update(dt);  // temporizadores de sacudida y destello
  dibujar();

  requestAnimationFrame(bucle);
}

actualizarBotones(motor.state);
requestAnimationFrame(bucle);