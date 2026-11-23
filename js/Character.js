// js/Character.js
// Entidad base: deformación elástica, anticipación, tinte de daño y hitstop.

// Flags por defecto (se pueden desactivar efectos individualmente)
const DEFAULT_FLAGS = { squashShake: true, tint: true, hitstop: true };

export class Character {
  constructor({ name, maxHp, baseX, baseY, width, height, spriteSrc, isPlayer }) {
    // --- Datos básicos ---
    this.name = name;
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.displayedHp = maxHp;

    // --- Posición (baseX/baseY = punto de los pies) ---
    this.baseX = baseX;
    this.baseY = baseY;
    this.x = baseX;
    this.y = baseY;
    this.width = width;
    this.height = height;
    this.isPlayer = isPlayer;

    // --- Sprite ---
    this.image = new Image();
    this.image.src = spriteSrc;
    this.isLoaded = false;
    this.image.onload = () => { this.isLoaded = true; };

    // Capa 1: deformación y sacudida
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.shakeTimer = 0;
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;

    // Capa 2: tinte cromático de daño
    this.tintTimer = 0;

    // Reto: congelación de fotograma al recibir un golpe
    this.hitstopTimer = 0;

    // Estado cinemático
    this.attackProgress = -1; // -1 = reposo, 0..1 = embestida
    this.idleTimer = Math.random() * Math.PI * 2; // fase aleatoria para que no respiren sincronizados
  }

  // Recibe daño y dispara los efectos visuales
  takeDamage(amount, flags = DEFAULT_FLAGS) {
    this.currentHp = Math.max(0, this.currentHp - amount);

    if (flags.squashShake) {
      // Squash: Sx * Sy ≈ 1.0 (1.35 * 0.75 ≈ 1.01) para conservar volumen
      this.scaleX = 1.35;
      this.scaleY = 0.75;
      this.shakeTimer = 0.35;
      this.shakeDuration = 0.35;
      this.shakeMagnitude = 14;
    }

    if (flags.tint) {
      this.tintTimer = 0.25; // 250 ms de flash rojo
    }

    if (flags.hitstop) {
      this.hitstopTimer = 0.065; // 65 ms congelado (≈ 4 fotogramas a 60 fps)
    }
  }

  startAttackAnimation() {
    this.attackProgress = 0;
  }

  update(dt, flags = DEFAULT_FLAGS) {
    // 0. Hitstop: se congela toda la física, pero draw() sigue dibujando la pose actual
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    this.idleTimer += dt * 3.5;

    // 1. Respiración procedural en reposo (oscilación senoidal en la escala)
    if (this.attackProgress === -1 && this.shakeTimer <= 0) {
      const breathe = Math.sin(this.idleTimer) * 0.035;
      this.scaleY = 1.0 + breathe;
      this.scaleX = 1.0 - breathe * 0.5; // compensa para conservar el área
    }

    // 2. Embestida: anticipación -> golpe -> retorno
    if (this.attackProgress >= 0) {
      this.attackProgress += dt * 2.8;
      const p = this.attackProgress;
      const dir = this.isPlayer ? 1 : -1; // dirección hacia el rival

      if (p < 0.25) {
        // Anticipación: retrocede 18 px
        const subP = p / 0.25;
        this.offsetX = -dir * 18 * subP;
        if (flags.squashShake) {
          this.scaleX = 0.9;
          this.scaleY = 1.15;
        }
      } else if (p < 0.65) {
        // Embestida: avanza 70 px desde la posición retrocedida
        const subP = (p - 0.25) / 0.4;
        this.offsetX = (-dir * 18) + (dir * 70 * subP);
        if (flags.squashShake) {
          this.scaleX = 1.25;
          this.scaleY = 0.85;
        }
      } else if (p < 1.0) {
        // Retorno elástico a la posición original
        const subP = (p - 0.65) / 0.35;
        this.offsetX = (dir * 52) * (1 - subP);
        if (flags.squashShake) {
          this.scaleX = 1.0 + (1 - subP) * 0.1;
          this.scaleY = 1.0;
        }
      } else {
        // Fin de la animación: restablece el estado de reposo
        this.attackProgress = -1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.scaleX = 1.0;
        this.scaleY = 1.0;
      }
    }

    // 3. Sacudida (shake) que se atenúa con el tiempo
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (flags.squashShake) {
        const factor = this.shakeTimer / this.shakeDuration;
        this.offsetX = (Math.random() * 2 - 1) * (this.shakeMagnitude * factor);
        this.offsetY = (Math.random() * 2 - 1) * (this.shakeMagnitude * factor * 0.5);

        // Amortiguación: la escala vuelve suavemente a 1.0
        this.scaleX += (1.0 - this.scaleX) * (dt * 12);
        this.scaleY += (1.0 - this.scaleY) * (dt * 12);
      }
    } else if (this.attackProgress === -1) {
      this.offsetX = 0;
      this.offsetY = 0;
    }

    // Cuenta regresiva del tinte
    if (this.tintTimer > 0) this.tintTimer -= dt;

    // Posición final = base + desplazamientos
    this.x = this.baseX + this.offsetX;
    this.y = this.baseY + this.offsetY;
  }

  draw(ctx, flags = DEFAULT_FLAGS) {
    if (!this.isLoaded) return;
    ctx.save();

    // Origen en los pies: la escala comprime contra el suelo
    ctx.translate(this.x, this.y);

    if (flags.squashShake) {
      ctx.scale(this.scaleX, this.scaleY);
    }

    // Pixel art: sin suavizado para mantener los bordes nítidos
    ctx.imageSmoothingEnabled = false;

    // El sprite mira a la derecha: el rival se voltea para mirar al jugador
    if (!this.isPlayer) ctx.scale(-1, 1);

    // Sombra elíptica de contacto
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.ellipse(0, 0, this.width * 0.35, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Filtro de daño cromático (se desactiva solo con ctx.restore())
    if (flags.tint && this.tintTimer > 0) {
      ctx.filter = 'brightness(1.8) sepia(1) saturate(6) hue-rotate(-50deg)';
    }

    // Centrado en X, anclado a los pies en Y
    ctx.drawImage(this.image, -this.width / 2, -this.height, this.width, this.height);
    ctx.restore();
  }
}
