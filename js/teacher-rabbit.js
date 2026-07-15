const canvas = document.getElementById('gameCanvas');
if (canvas) {
  const ctx = canvas.getContext('2d');

  // DOM elements for overlays
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const finalScoreEl = document.getElementById('final-score');
  const newRecordMsg = document.getElementById('new-record-msg');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');

  // --- Game Constants ---
  const GRAVITY = 0.5;
  const JUMP_FORCE = -9.5;
  const GROUND_HEIGHT = 40;

  // --- Game State Machine ---
  const GAME_STATE = {
    START: 'START',
    RUNNING: 'RUNNING',
    GAME_OVER: 'GAME_OVER'
  };
  let gameState = GAME_STATE.START;

  // --- Game Variables ---
  let frames = 0;
  let score = 0;
  let gameSpeed = 3.5;
  const BASE_SPEED = 3.5;
  const MAX_SPEED = 9.0;
  let lastDifficultyIncrease = 0;
  let highScore = parseInt(localStorage.getItem('teacherRabbitHighScore')) || 0;

  // ================== Particle System (Optimized) ==================
  let particles = [];
  const MAX_PARTICLES = 150;        // 限制粒子总数，保证性能
  const MAX_FLOATING_TEXTS = 8;     // 限制同时显示的浮动文字数

  class Particle {
    constructor(x, y, vx, vy, color, size, life, type = 'normal') {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.size = size || 4;
      this.life = life || 30;
      this.maxLife = this.life;
      this.type = type;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.05;
      this.life--;
      this.size *= 0.98;
    }
    draw(ctx) {
      const alpha = this.life / this.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      if (this.type === 'sparkle') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(1, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
      }
      ctx.globalAlpha = 1;
    }
    isDead() { return this.life <= 0 || this.size < 0.5; }
  }

  // 辅助函数：确保粒子总数不超过上限
  function trimParticles() {
    if (particles.length > MAX_PARTICLES) {
      // 移除最旧的粒子（数组头部）
      particles.splice(0, particles.length - MAX_PARTICLES);
    }
  }

  function emitDust(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI/2 + (Math.random() - 0.5) * 1.2;
      const speed = 1 + Math.random() * 2;
      particles.push(new Particle(
        x + (Math.random()-0.5)*10,
        y,
        Math.cos(angle) * speed,
        -Math.sin(angle) * speed - 0.5,
        '#a0a0a0', 3 + Math.random()*4, 20 + Math.random()*15, 'dust'
      ));
    }
    trimParticles();
  }

  function emitScoreParticles(x, y, count = 15) {
    const colors = ['#f1c40f', '#e67e22', '#e74c3c', '#2ecc71', '#3498db'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        -Math.sin(angle) * speed - 1,
        colors[Math.floor(Math.random() * colors.length)],
        3 + Math.random() * 5,
        30 + Math.random() * 20,
        'sparkle'
      ));
    }
    trimParticles();
  }

  function emitCollisionParticles(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particles.push(new Particle(
        x + (Math.random()-0.5)*20,
        y + (Math.random()-0.5)*20,
        Math.cos(angle) * speed,
        -Math.sin(angle) * speed - 1,
        '#c0392b', 3 + Math.random()*6, 25 + Math.random()*20, 'fragment'
      ));
    }
    trimParticles();
  }

  // ================== Floating Score Text (Optimized) ==================
  let floatingTexts = [];
  class FloatingText {
    constructor(x, y, text, color = '#2c3e50') {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.life = 40;
      this.maxLife = 40;
      this.vy = -1.5;
    }
    update() {
      this.y += this.vy;
      this.vy *= 0.98;
      this.life--;
    }
    draw(ctx) {
      const alpha = this.life / this.maxLife;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = this.color;
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(this.text, this.x, this.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    isDead() { return this.life <= 0; }
  }

  function addFloatingText(x, y, text, color) {
    floatingTexts.push(new FloatingText(x, y, text, color));
    if (floatingTexts.length > MAX_FLOATING_TEXTS) {
      floatingTexts.shift(); // 移除最早的一个
    }
  }

  // ================== Clouds ==================
  let clouds = [];
  class Cloud {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * (canvas.height - GROUND_HEIGHT - 40) + 10;
      this.width = 50 + Math.random() * 80;
      this.speed = 0.2 + Math.random() * 0.3;
      this.opacity = 0.3 + Math.random() * 0.4;
    }
    update() {
      this.x -= this.speed;
      if (this.x + this.width < 0) {
        this.x = canvas.width + 20;
        this.y = Math.random() * (canvas.height - GROUND_HEIGHT - 40) + 10;
        this.width = 50 + Math.random() * 80;
        this.speed = 0.2 + Math.random() * 0.3;
      }
    }
    draw(ctx) {
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = '#ffffff';
      const w = this.width;
      const h = w * 0.3;
      const x = this.x;
      const y = this.y;
      ctx.beginPath();
      ctx.ellipse(x + w*0.3, y + h*0.5, w*0.25, h*0.5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w*0.6, y + h*0.4, w*0.3, h*0.6, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w*0.5, y + h*0.2, w*0.3, h*0.5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // --- Rabbit ---
  const rabbit = {
    x: 60,
    y: canvas.height - GROUND_HEIGHT - 18,
    width: 24,
    height: 36,
    dy: 0,
    grounded: true,

    reset() {
      this.y = canvas.height - GROUND_HEIGHT - this.height/2;
      this.dy = 0;
      this.grounded = true;
    },

    update() {
      this.dy += GRAVITY;
      this.y += this.dy;
      const groundY = canvas.height - GROUND_HEIGHT - this.height/2;
      if (this.y > groundY) {
        this.y = groundY;
        this.dy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    },

    jump() {
      if (this.grounded && gameState === GAME_STATE.RUNNING) {
        this.dy = JUMP_FORCE;
        this.grounded = false;
        emitDust(this.x, this.y + this.height/2, 10);
      }
    },

    draw() {
      const p = 3;
      const x = this.x;
      const y = this.y + this.height/2;
      ctx.save();
      ctx.translate(x, y);

      let scaleX = 1, scaleY = 1;
      if (!this.grounded && this.dy < 0) {
        scaleY = 0.85;
        scaleX = 1.15;
      } else if (!this.grounded && this.dy > 0) {
        scaleY = 1.1;
        scaleX = 0.9;
      }
      ctx.scale(scaleX, scaleY);

      const legOffset = (this.grounded && gameState === GAME_STATE.RUNNING) ? (Math.floor(frames / 5) % 2 === 0 ? 0 : 3) : 0;
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(-2*p, -2*p, 4*p, 4*p);
      ctx.fillRect(-1*p, 2*p + legOffset, 1*p, 2*p);
      ctx.fillRect(1*p, 2*p - legOffset, 1*p, 2*p);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1*p, -2*p, 2*p, 2*p);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(0, -1*p, 1*p, 2*p);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2*p, -5*p, 4*p, 3*p);
      const earAngle = (this.grounded && gameState === GAME_STATE.RUNNING) ? Math.sin(frames * 0.15) * 0.1 : 0;
      ctx.save();
      ctx.translate(-2*p, -8*p);
      ctx.rotate(-0.2 + earAngle);
      ctx.fillRect(0, 0, 1*p, 3*p);
      ctx.restore();
      ctx.save();
      ctx.translate(1*p, -8*p);
      ctx.rotate(0.2 - earAngle);
      ctx.fillRect(0, 0, 1*p, 3*p);
      ctx.restore();
      ctx.fillStyle = '#000000';
      ctx.fillRect(-1*p, -4*p, 1*p, 1*p);
      ctx.fillRect(1*p, -4*p, 1*p, 1*p);
      ctx.fillRect(0, -3*p, 1*p, 1*p);
      ctx.restore();
    }
  };

  // --- Obstacles (ONLY BOOKS) ---
  const obstacles = {
    items: [],
    spawnTimer: 0,
    minSpawnInterval: 50,
    maxSpawnInterval: 120,

    reset() {
      this.items = [];
      this.spawnTimer = 60;
    },

    update() {
      this.spawnTimer--;
      if (this.spawnTimer <= 0) {
        const height = Math.floor(Math.random() * 30) + 20;
        const width = 25;
        this.items.push({
          x: canvas.width,
          y: canvas.height - GROUND_HEIGHT - height,
          width: width,
          height: height,
          type: 'book',
          passed: false
        });
        const interval = Math.max(this.minSpawnInterval, this.maxSpawnInterval - Math.floor(score / 20));
        this.spawnTimer = interval + Math.floor(Math.random() * 40);
      }

      for (let i = this.items.length - 1; i >= 0; i--) {
        const obs = this.items[i];
        obs.x -= gameSpeed;

        const rx = rabbit.x - rabbit.width/2 + 6;
        const ry = rabbit.y - rabbit.height/2 + 6;
        const rw = rabbit.width - 12;
        const rh = rabbit.height - 12;
        if (rx < obs.x + obs.width && rx + rw > obs.x &&
            ry < obs.y + obs.height && ry + rh > obs.y) {
          emitCollisionParticles(obs.x + obs.width/2, obs.y + obs.height/2);
          gameOver();
          return;
        }

        if (obs.x + obs.width < rabbit.x && !obs.passed) {
          obs.passed = true;
          score++;
          emitScoreParticles(obs.x + obs.width/2, obs.y + obs.height/2);
          addFloatingText(obs.x + obs.width/2 - 15, obs.y - 10, '+1', '#27ae60');
          if (score - lastDifficultyIncrease >= 100) {
            gameSpeed = Math.min(MAX_SPEED, BASE_SPEED + score * 0.008);
            lastDifficultyIncrease = score;
          }
        }

        if (obs.x + obs.width < 0) {
          this.items.splice(i, 1);
        }
      }
    },

    draw() {
      for (const obs of this.items) {
        const bookHeight = 12;
        const numBooks = Math.floor(obs.height / bookHeight);
        for (let i = 0; i < numBooks; i++) {
          const y = obs.y + obs.height - (i+1) * bookHeight;
          ctx.fillStyle = (i % 3 === 0) ? '#e74c3c' : (i % 3 === 1) ? '#3498db' : '#f1c40f';
          ctx.fillRect(obs.x, y, obs.width, bookHeight - 2);
          ctx.fillStyle = '#fff';
          ctx.fillRect(obs.x + 3, y + 3, obs.width - 6, bookHeight - 8);
        }
      }
    }
  };

  // --- Background with Parallax and Ground Texture ---
  const bgLayers = [
    { color: '#bdc3c7', speed: 0.2, yOffset: 0 },
    { color: '#95a5a6', speed: 0.6, yOffset: 0 },
    { color: '#7f8c8d', speed: 1.0, yOffset: 0 }
  ];
  let bgOffsets = [0, 0, 0];

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height - GROUND_HEIGHT);
    gradient.addColorStop(0, '#d5e8f0');
    gradient.addColorStop(0.6, '#f0f5f8');
    gradient.addColorStop(1, '#fdfbf7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height - GROUND_HEIGHT);

    for (const cloud of clouds) cloud.draw(ctx);

    for (let i = 0; i < bgLayers.length; i++) {
      const layer = bgLayers[i];
      const offset = bgOffsets[i] % canvas.width;
      ctx.fillStyle = layer.color;
      ctx.fillRect(-offset, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);
      ctx.fillRect(canvas.width - offset, canvas.height - GROUND_HEIGHT, offset, GROUND_HEIGHT);
      bgOffsets[i] += gameSpeed * layer.speed;
    }

    ctx.fillStyle = '#5d6d7e';
    ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, 2);
    const grassOffset = (frames * 0.5) % 20;
    for (let i = -grassOffset; i < canvas.width; i += 20) {
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(i, canvas.height - GROUND_HEIGHT - 2, 2, 5);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(i + 6, canvas.height - GROUND_HEIGHT - 1, 2, 4);
    }
  }

  // --- UI Drawing ---
  function drawUI() {
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = '#2c3e50';
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText('📖 ' + score, 15, 30);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText('🏆 HI: ' + highScore, canvas.width - 110, 25);
  }

  // --- Game State Functions ---
  function startGame() {
    if (gameState === GAME_STATE.START || gameState === GAME_STATE.GAME_OVER) {
      gameState = GAME_STATE.RUNNING;
      score = 0;
      frames = 0;
      gameSpeed = BASE_SPEED;
      lastDifficultyIncrease = 0;
      rabbit.reset();
      obstacles.reset();
      particles = [];
      floatingTexts = [];
      for (let i = 0; i < bgOffsets.length; i++) bgOffsets[i] = 0;
      startScreen.classList.add('hidden');
      gameOverScreen.classList.add('hidden');
      newRecordMsg.classList.add('hidden');
    }
  }

  function gameOver() {
    gameState = GAME_STATE.GAME_OVER;
    finalScoreEl.textContent = score;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('teacherRabbitHighScore', highScore);
      newRecordMsg.classList.remove('hidden');
    } else {
      newRecordMsg.classList.add('hidden');
    }
    gameOverScreen.classList.remove('hidden');
  }

  // --- Main Loop ---
  function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    if (gameState === GAME_STATE.RUNNING) {
      obstacles.update();
      rabbit.update();
      // 更新粒子（只更新存活的）
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].isDead()) particles.splice(i, 1);
      }
      // 更新浮动文字
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].update();
        if (floatingTexts[i].isDead()) floatingTexts.splice(i, 1);
      }
      for (const cloud of clouds) cloud.update();
      frames++;
    }

    // 绘制所有粒子
    for (const particle of particles) particle.draw(ctx);
    obstacles.draw();
    rabbit.draw();
    for (const ft of floatingTexts) ft.draw(ctx);
    drawUI();

    requestAnimationFrame(gameLoop);
  }

  // --- Event Handlers ---
  function handleJump(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'keydown') e.preventDefault();

    if (gameState === GAME_STATE.START) {
      startGame();
    } else if (gameState === GAME_STATE.RUNNING) {
      rabbit.jump();
    }
  }

  window.addEventListener('keydown', handleJump);

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (gameState === GAME_STATE.RUNNING) rabbit.jump();
    else if (gameState === GAME_STATE.START) startGame();
  });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === GAME_STATE.RUNNING) rabbit.jump();
    else if (gameState === GAME_STATE.START) startGame();
  }, { passive: false });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  // Initialize clouds
  for (let i = 0; i < 6; i++) {
    clouds.push(new Cloud());
  }

  rabbit.reset();
  obstacles.reset();
  gameLoop();
}