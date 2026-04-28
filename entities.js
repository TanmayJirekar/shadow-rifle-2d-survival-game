// entities.js — Player, Enemy, Bullet, Coin, Particle, DamageNumber
import { ENEMY_CONFIGS } from './weapons.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 44; this.h = 58;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.health = 100; this.maxHealth = 100;
    this.weapon = null;
    this.ammo = 30;
    this.reloading = false;
    this.reloadTimer = 0;
    this.shootTimer = 0;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.coins = 0;
    this.walkFrame = 0; this.walkTimer = 0;
    this.img = null;
  }

  update(dt, keys, groundY, minX, maxX) {
    const SPEED = 200, JUMP = -520, GRAVITY = 1200;
    this.vx = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) { this.vx = -SPEED; this.facing = -1; }
    if (keys['ArrowRight'] || keys['KeyD']) { this.vx = SPEED; this.facing = 1; }
    if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && this.onGround) {
      this.vy = JUMP; this.onGround = false;
    }
    this.vy += GRAVITY * dt;
    this.x = Math.max(minX, Math.min(maxX - this.w, this.x + this.vx * dt));
    this.y += this.vy * dt;
    if (this.y + this.h >= groundY) {
      this.y = groundY - this.h; this.vy = 0; this.onGround = true;
    }
    if (this.shootTimer > 0) this.shootTimer -= dt * 1000;
    if (this.reloading) {
      this.reloadTimer -= dt * 1000;
      if (this.reloadTimer <= 0) { this.ammo = this.weapon.maxAmmo; this.reloading = false; }
    }
    if (this.invincible) {
      this.invincibleTimer -= dt * 1000;
      if (this.invincibleTimer <= 0) this.invincible = false;
    }
    if (Math.abs(this.vx) > 0 && this.onGround) {
      this.walkTimer += dt;
      if (this.walkTimer > 0.12) { this.walkFrame = (this.walkFrame + 1) % 4; this.walkTimer = 0; }
    }
  }

  shoot(mx, my) {
    if (this.reloading || this.shootTimer > 0 || !this.weapon) return null;
    if (this.ammo <= 0) { this.startReload(); return null; }
    this.shootTimer = this.weapon.fireRate;
    this.ammo--;
    if (this.ammo <= 0) this.startReload();
    const cx = this.x + this.w / 2, cy = this.y + this.h * 0.4;
    const dx = mx - cx, dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const sp = this.weapon.bulletSpeed;
    const pellets = this.weapon.pellets || 1;
    const spread = this.weapon.spread || 0;
    const bullets = [];
    for (let i = 0; i < pellets; i++) {
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * spread * 2;
      bullets.push(new Bullet(cx, cy, Math.cos(angle) * sp, Math.sin(angle) * sp, this.weapon.damage, 'player', this.weapon.color));
    }
    this.facing = dx >= 0 ? 1 : -1;
    return bullets;
  }

  startReload() {
    if (!this.reloading && this.weapon && this.ammo < this.weapon.maxAmmo) {
      this.reloading = true;
      this.reloadTimer = this.weapon.reloadTime;
    }
  }

  takeDamage(amount) {
    if (this.invincible) return;
    this.health = Math.max(0, this.health - amount);
    this.invincible = true; this.invincibleTimer = 900;
  }

  draw(ctx, camX) {
    const sx = this.x - camX;
    ctx.save();
    if (this.invincible && Math.floor(Date.now() / 80) % 2 === 0) ctx.globalAlpha = 0.35;
    if (this.img && this.img.complete && this.img.naturalWidth > 0) {
      if (this.facing === -1) {
        ctx.translate(sx + this.w, this.y); ctx.scale(-1, 1);
        ctx.drawImage(this.img, 0, 0, this.w, this.h);
      } else {
        ctx.drawImage(this.img, sx, this.y, this.w, this.h);
      }
    } else {
      this._drawShape(ctx, sx);
    }
    ctx.restore();
  }

  _drawShape(ctx, sx) {
    const legOff = [0, 3, 0, -3][this.walkFrame];
    ctx.fillStyle = '#1a3a12'; ctx.fillRect(sx + 10, this.y + 48, 11, 10 + legOff);
    ctx.fillRect(sx + 23, this.y + 48, 11, 10 - legOff);
    ctx.fillStyle = '#2d5a1e'; ctx.fillRect(sx + 9, this.y + 22, 26, 28);
    ctx.fillStyle = '#c8a06a'; ctx.fillRect(sx + 12, this.y + 5, 20, 18);
    ctx.fillStyle = '#1e4012'; ctx.fillRect(sx + 10, this.y + 1, 24, 12);
    ctx.fillStyle = '#777';
    if (this.facing === 1) ctx.fillRect(sx + 34, this.y + 28, 14, 5);
    else ctx.fillRect(sx - 4, this.y + 28, 14, 5);
  }
}

export class Enemy {
  constructor(x, y, type, level) {
    this.type = type;
    const cfg = ENEMY_CONFIGS[type];
    this.x = x; this.y = y;
    this.w = cfg.w; this.h = cfg.h;
    this.speed = cfg.speed + level * 4;
    this.health = cfg.health + level * 15;
    this.maxHealth = this.health;
    this.damage = cfg.damage + Math.floor(level / 2);
    this.attackRange = cfg.attackRange;
    this.attackRate = cfg.attackRate;
    this.attackTimer = Math.random() * 500;
    this.coinReward = cfg.coinReward;
    this.scoreValue = cfg.scoreValue;
    this.color = cfg.color;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = -1;
    this.hitFlash = 0;
    this.img = null;
  }

  update(dt, px, py, groundY) {
    const dx = px - (this.x + this.w / 2);
    if (Math.abs(dx) > this.attackRange) {
      this.vx = Math.sign(dx) * this.speed;
    } else {
      this.vx = 0;
    }
    this.facing = dx < 0 ? -1 : 1;
    this.vy += 1200 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y + this.h >= groundY) { this.y = groundY - this.h; this.vy = 0; this.onGround = true; }
    if (this.attackTimer > 0) this.attackTimer -= dt * 1000;
    if (this.hitFlash > 0) this.hitFlash -= dt * 1000;
  }

  canAttack() { return this.attackTimer <= 0 && Math.abs(this.vx) === 0; }
  attack() { this.attackTimer = this.attackRate; }
  takeDamage(amount) { this.health -= amount; this.hitFlash = 120; return this.health <= 0; }

  draw(ctx, camX) {
    const sx = this.x - camX;
    ctx.save();
    if (this.hitFlash > 0) { ctx.filter = 'brightness(4)'; ctx.globalAlpha = 0.85; }
    if (this.img && this.img.complete && this.img.naturalWidth > 0) {
      if (this.facing === -1) {
        ctx.translate(sx + this.w, this.y); ctx.scale(-1, 1);
        ctx.drawImage(this.img, 0, 0, this.w, this.h);
      } else { ctx.drawImage(this.img, sx, this.y, this.w, this.h); }
    } else { this._drawShape(ctx, sx); }
    ctx.restore();
    // Health bar
    if (this.health < this.maxHealth) {
      const bx = sx, by = this.y - 8;
      ctx.fillStyle = '#300'; ctx.fillRect(bx, by, this.w, 4);
      ctx.fillStyle = this.type === 'boss' ? '#ff4400' : '#00ff41';
      ctx.fillRect(bx, by, this.w * (this.health / this.maxHealth), 4);
    }
  }

  _drawShape(ctx, sx) {
    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.color;
    ctx.fillRect(sx + 8, this.y + 20, this.w - 16, this.h - 34);
    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : '#b07050';
    ctx.fillRect(sx + 10, this.y + 4, this.w - 20, 17);
    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.color;
    ctx.fillRect(sx + 8, this.y + this.h - 14, 9, 14);
    ctx.fillRect(sx + this.w - 17, this.y + this.h - 14, 9, 14);
    if (this.type === 'boss') {
      ctx.fillStyle = '#ff0044'; ctx.fillRect(sx + 14, this.y + 8, 6, 5); ctx.fillRect(sx + this.w - 20, this.y + 8, 6, 5);
    }
  }
}

export class Bullet {
  constructor(x, y, vx, vy, damage, owner, color) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.damage = damage; this.owner = owner;
    this.color = color || '#ffff44';
    this.alive = true;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < -200 || this.x > 8000 || this.y < -200 || this.y > 1000) this.alive = false;
  }
  draw(ctx, camX) {
    const sx = this.x - camX;
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.shadowColor = this.color; ctx.shadowBlur = 8;
    ctx.fillStyle = this.owner === 'player' ? this.color : '#ff4400';
    ctx.translate(sx, this.y); ctx.rotate(angle);
    ctx.fillRect(-8, -3, 16, 6);
    ctx.restore();
  }
}

export class Coin {
  constructor(x, y, value) {
    this.x = x; this.y = y; this.value = value;
    this.vy = -180 + (Math.random() - 0.5) * 60;
    this.vx = (Math.random() - 0.5) * 60;
    this.r = 7; this.alive = true; this.spin = Math.random() * Math.PI * 2;
  }
  update(dt, groundY) {
    this.vy += 900 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.y + this.r >= groundY) { this.y = groundY - this.r; this.vy = 0; this.vx *= 0.85; }
    this.spin += dt * 4;
  }
  draw(ctx, camX) {
    const sx = this.x - camX;
    ctx.save();
    ctx.translate(sx, this.y);
    ctx.scale(Math.abs(Math.cos(this.spin)), 1);
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700'; ctx.fill();
    ctx.strokeStyle = '#AA8800'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

export class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color;
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 200;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s - 80;
    this.life = 1; this.r = 2 + Math.random() * 4;
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 700 * dt; this.life -= dt * 2.2; }
  get alive() { return this.life > 0; }
  draw(ctx, camX) {
    ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x - camX, this.y, this.r * this.life, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export class DamageNumber {
  constructor(x, y, amount, isPlayer) {
    this.x = x + (Math.random() - 0.5) * 20;
    this.y = y; this.amount = amount; this.isPlayer = isPlayer;
    this.vy = -70; this.life = 1;
  }
  update(dt) { this.y += this.vy * dt; this.life -= dt * 1.8; }
  get alive() { return this.life > 0; }
  draw(ctx, camX) {
    ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.isPlayer ? '#ff4444' : '#88ff44';
    ctx.font = `bold ${11 + Math.floor((1 - this.life) * 6)}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText(`-${this.amount}`, this.x - camX, this.y);
    ctx.restore();
  }
}
