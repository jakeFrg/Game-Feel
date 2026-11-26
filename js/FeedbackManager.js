// js/FeedbackManager.js
// Capa 3: cámara (Screen Shake) y destellos de pantalla (Screen Flash).
export class FeedbackManager {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Interruptores de capas (el panel los modifica)
    this.layers = { layer3_screenEffects: true };

    // Estado de la sacudida
    this.screenShakeTimer = 0;
    this.screenShakeDuration = 0.4;
    this.screenShakeMagnitude = 0;

    // Estado del destello
    this.screenFlashTimer = 0;
    this.screenFlashDuration = 0.08; // 80 ms
    this.screenFlashColor = '255, 255, 255';
  }

  // Inicia una sacudida de cámara con la magnitud indicada (px)
  triggerShake(magnitude, duration = 0.4) {
    this.screenShakeMagnitude = magnitude;
    this.screenShakeDuration = duration;
    this.screenShakeTimer = duration;
  }

  // Inicia un destello de color "r, g, b" (80 ms por defecto)
  triggerFlash(color = '255, 255, 255', duration = 0.08) {
    this.screenFlashColor = color;
    this.screenFlashDuration = duration;
    this.screenFlashTimer = duration;
  }

  // Avanza los temporizadores
  update(dt) {
    if (this.screenShakeTimer > 0) this.screenShakeTimer -= dt;
    if (this.screenFlashTimer > 0) this.screenFlashTimer -= dt;
  }

  // Llamar tras ctx.save() y antes de dibujar la escena
  applyCameraShake() {
    if (this.layers.layer3_screenEffects && this.screenShakeTimer > 0) {
      const factor = this.screenShakeTimer / this.screenShakeDuration;
      const mag = this.screenShakeMagnitude * factor * factor; // decaimiento cuadrático
      this.ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    }
  }

  // Llamar al final, después de ctx.restore(), para cubrir todo el lienzo
  drawScreenFlash() {
    if (this.layers.layer3_screenEffects && this.screenFlashTimer > 0) {
      const alpha = (this.screenFlashTimer / this.screenFlashDuration) * 0.65;
      this.ctx.save();
      this.ctx.fillStyle = `rgba(${this.screenFlashColor}, ${alpha})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }
  }
}