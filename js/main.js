// js/main.js
// Cuadro negro con un personaje que muestra las capas 1 y 2 y el reto de Hitstop.
import { Character } from './Character.js';

// ===== Canvas =====
const canvas = document.getElementById('escena');
const ctx = canvas.getContext('2d');

// ===== Personaje (baseX/baseY = posición de los pies) =====
const heroe = new Character({
  name: 'Héroe', maxHp: 100,
  baseX: 300, baseY: 340,
  width: 148, height: 208,        // sprite 37×52 ampliado ×4
  spriteSrc: 'assets/hero.png', isPlayer: true,
});

// ===== Flags: leen el estado de las casillas =====
const casillas = {
  squashShake: document.getElementById('capa1'),
  tint:        document.getElementById('capa2'),
  hitstop:     document.getElementById('reto1'),
};
const flags = { squashShake: true, tint: true, hitstop: true };

function leerFlags() {
  for (const clave in casillas) flags[clave] = casillas[clave].checked;
}
Object.values(casillas).forEach(c => c.addEventListener('change', leerFlags));
leerFlags();

// ===== Botones =====
// Embestida: anticipación -> golpe -> retorno
document.getElementById('atacar').addEventListener('click', () => {
  if (heroe.attackProgress === -1) heroe.startAttackAnimation();
});

// Golpe recibido: squash, shake, tinte y hitstop (daño 0: solo se ve el efecto)
document.getElementById('golpe').addEventListener('click', () => {
  heroe.takeDamage(0, flags);
});

// ===== Bucle principal =====
let ultimo = performance.now();

function bucle(ahora) {
  // dt en segundos, limitado para evitar saltos al cambiar de pestaña
  const dt = Math.min((ahora - ultimo) / 1000, 0.05);
  ultimo = ahora;

  // Reto Hitstop: mientras dura, la física se detiene pero el dibujo continúa
  if (heroe.hitstopTimer > 0) {
    heroe.hitstopTimer = Math.max(0, heroe.hitstopTimer - dt);
  } else {
    heroe.update(dt, flags);
  }

  // Fondo negro y personaje
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  heroe.draw(ctx, flags);

  requestAnimationFrame(bucle);
}

requestAnimationFrame(bucle);
