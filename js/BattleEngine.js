// js/BattleEngine.js
// Máquina de Estados Finita (FSM) del combate por turnos + ventaja elemental.

// Estados mutuamente excluyentes del combate
export const ESTADOS = {
  TURNO_JUGADOR:  'TURNO_JUGADOR',   // espera la acción del jugador
  ATAQUE_JUGADOR: 'ATAQUE_JUGADOR',  // embestida del jugador hasta el impacto
  PAUSA_JUGADOR:  'PAUSA_JUGADOR',   // pausa para asimilar el golpe
  ATAQUE_RIVAL:   'ATAQUE_RIVAL',    // embestida del rival hasta el impacto
  PAUSA_RIVAL:    'PAUSA_RIVAL',     // pausa para asimilar el golpe
  VICTORIA:       'VICTORIA',
  DERROTA:        'DERROTA',
};

// Pausa entre ataque y respuesta (Timing: 600-800 ms)
const PAUSA = 0.75;
// Momento de la embestida en que se considera que el golpe conecta
const PROGRESO_IMPACTO = 0.65;

// Ataques disponibles
export const ATAQUES = {
  placaje: { nombre: 'Placaje',        tipo: 'normal',    dano: 18 },
  llamas:  { nombre: 'Lanzallamas',    tipo: 'fuego',     dano: 24 },
  chispa:  { nombre: 'Chispa',         tipo: 'electrico', dano: 30 },
  chorro:  { nombre: 'Chorro de agua', tipo: 'agua',      dano: 16 },
};

// Multiplicadores por tipo (atacante -> defensor). Lo no listado vale 1
const VENTAJAS = {
  electrico: { agua: 2 },
  fuego:     { agua: 0.5 },
  agua:      { fuego: 2 },
};

// Feedback adaptativo según la eficacia del golpe
const FEEDBACK = {
  neutral:     { shake: 9,  flash: '255, 255, 255', mensaje: '' },
  superEficaz: { shake: 18, flash: '255, 220, 50',  mensaje: ' ¡Es súper eficaz!' },
  pocoEficaz:  { shake: 4,  flash: '160, 160, 160', mensaje: ' No es muy eficaz...' },
};

export class BattleEngine {
  // flags: objeto compartido con el panel (squashShake, tint, hitstop, elemental...)
  constructor({ player, enemy, feedback, sound, flags, onMessage, onState }) {
    this.player = player;
    this.enemy = enemy;
    this.feedback = feedback;
    this.sound = sound;
    this.flags = flags;
    this.onMessage = onMessage || (() => {});
    this.onState = onState || (() => {});

    this.state = ESTADOS.TURNO_JUGADOR;
    this.timer = 0;
    this.attacker = null;
    this.defender = null;
    this.move = null;
    this.impacted = false;
  }

  // Cambia de estado y avisa a la interfaz
  setState(nuevo) {
    this.state = nuevo;
    this.onState(nuevo);
  }

  // El jugador elige un ataque (solo válido en su turno)
  chooseMove(clave) {
    if (this.state !== ESTADOS.TURNO_JUGADOR) return false;
    this.startAttack(this.player, this.enemy, ATAQUES[clave], ESTADOS.ATAQUE_JUGADOR);
    return true;
  }

  // Inicia la embestida y el sonido de ataque
  startAttack(attacker, defender, move, estado) {
    this.attacker = attacker;
    this.defender = defender;
    this.move = move;
    this.impacted = false;
    this.sound.playAttack();
    attacker.startAttackAnimation();
    this.onMessage(`${attacker.name} usa ${move.nombre}.`);
    this.setState(estado);
  }

  // Calcula eficacia: 'superEficaz', 'pocoEficaz' o 'neutral'
  getEffectiveness(move, defender) {
    if (!this.flags.elemental) return 'neutral'; // reto desactivado
    const mult = (VENTAJAS[move.tipo] && VENTAJAS[move.tipo][defender.tipo]) || 1;
    return mult > 1 ? 'superEficaz' : mult < 1 ? 'pocoEficaz' : 'neutral';
  }

  // Aplica daño y todo el feedback del impacto
  resolveImpact() {
    const { move, defender } = this;
    const eficacia = this.getEffectiveness(move, defender);
    const mult = eficacia === 'superEficaz' ? 2 : eficacia === 'pocoEficaz' ? 0.5 : 1;
    const dano = Math.round(move.dano * mult);
    const fb = FEEDBACK[eficacia];

    defender.takeDamage(dano, this.flags);       // Capas 1, 2 y Hitstop
    this.feedback.triggerShake(fb.shake);        // Capa 3: cámara
    this.feedback.triggerFlash(fb.flash);        // Capa 3: destello

    // Capa 4: sonido (el súper eficaz añade el acorde agudo)
    this.sound.playHit();
    if (eficacia === 'superEficaz') this.sound.playSuperEffective();

    this.onMessage(`¡${defender.name} recibe ${dano} de daño!${fb.mensaje}`);
  }

  // Se llama en cada frame del bucle principal
  update(dt) {
    switch (this.state) {
      case ESTADOS.ATAQUE_JUGADOR:
      case ESTADOS.ATAQUE_RIVAL: {
        const p = this.attacker.attackProgress;
        if (!this.impacted && (p >= PROGRESO_IMPACTO || p === -1)) {
          this.impacted = true;
          this.resolveImpact();
          this.timer = PAUSA;
          this.setState(this.state === ESTADOS.ATAQUE_JUGADOR
            ? ESTADOS.PAUSA_JUGADOR : ESTADOS.PAUSA_RIVAL);
        }
        break;
      }

      case ESTADOS.PAUSA_JUGADOR:
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.enemy.currentHp === 0) {
            this.onMessage(`¡${this.enemy.name} cae derrotado! Pulsa Reiniciar.`);
            this.setState(ESTADOS.VICTORIA);
          } else {
            // Turno del rival: ataque al azar
            const opciones = ['placaje', 'chorro'];
            const clave = opciones[Math.floor(Math.random() * opciones.length)];
            this.startAttack(this.enemy, this.player, ATAQUES[clave], ESTADOS.ATAQUE_RIVAL);
          }
        }
        break;

      case ESTADOS.PAUSA_RIVAL:
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.player.currentHp === 0) {
            this.onMessage(`${this.player.name} ha caído. Pulsa Reiniciar.`);
            this.setState(ESTADOS.DERROTA);
          } else {
            this.onMessage('Elige una acción.');
            this.setState(ESTADOS.TURNO_JUGADOR);
          }
        }
        break;
    }
  }

  // Reinicia el combate completo
  reset() {
    this.player.reset();
    this.enemy.reset();
    this.timer = 0;
    this.impacted = false;
    this.onMessage('¡Combate reiniciado! Elige una acción.');
    this.setState(ESTADOS.TURNO_JUGADOR);
  }
}