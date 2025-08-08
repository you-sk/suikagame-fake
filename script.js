// Matter.js module aliases
const { Engine, Render, World, Bodies, Body, Events, Vector, Composite } = Matter;

// Game UI elements
const gameContainer = document.getElementById('game-container');
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const nextFruitDisplay = document.getElementById('next-fruit-display');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');
const menuButton = document.getElementById('menu-button');
const menuScreen = document.getElementById('menu-screen');
const mainContainer = document.getElementById('main-container');
const currentModeEl = document.getElementById('current-mode');
const timerDisplay = document.getElementById('timer-display');
const timeRemainingEl = document.getElementById('time-remaining');
const mergeCountEl = document.getElementById('merge-count');
const maxComboEl = document.getElementById('max-combo');
const achievementUnlock = document.getElementById('achievement-unlock');
const achievementNameEl = document.getElementById('achievement-name');
const achievementListEl = document.getElementById('achievement-list');

// Game dimensions
const gameWidth = 400;
const gameHeight = 600;

// Game state
let currentScore = 0;
let highScore = localStorage.getItem('suika-high-score') || 0;
let currentFruit = null;
let nextFruitLevel = 0;
let gameEnded = false;
let engine;
let render;
let world;

// Game modes
let currentMode = 'classic';
let timeRemaining = 120;
let timerInterval = null;
let mergeCount = 0;
let maxCombo = 0;

// Combo system
let comboCount = 0;
let comboTimer = null;
let lastMergeTime = 0;

// Power-up system
let activePowerUp = null;
let powerUpTimer = null;
let bombAvailable = false;
let rainbowMode = false;

// Visual effects
let particles = [];
let floatingTexts = [];

// Achievements system
const achievements = [
    { id: 'firstMerge', name: 'First Merge', icon: '🎯', description: 'Merge your first fruits', unlocked: false },
    { id: 'combo5', name: 'Combo Master', icon: '⚡', description: 'Get a 5x combo', unlocked: false },
    { id: 'score1000', name: 'Thousand Club', icon: '💎', description: 'Score 1000 points', unlocked: false },
    { id: 'score5000', name: 'High Roller', icon: '👑', description: 'Score 5000 points', unlocked: false },
    { id: 'maxFruit', name: 'Watermelon King', icon: '🍉', description: 'Create the biggest fruit', unlocked: false },
    { id: 'bombMaster', name: 'Bomb Expert', icon: '💣', description: 'Use 10 bombs in one game', unlocked: false },
    { id: 'survivor', name: 'Survivor', icon: '🛡️', description: 'Survive for 5 minutes', unlocked: false },
    { id: 'speedDemon', name: 'Speed Demon', icon: '🚀', description: 'Score 2000 in Time Attack', unlocked: false }
];

let bombsUsed = 0;
let gameStartTime = 0;

function loadAchievements() {
    const saved = localStorage.getItem('suika-achievements');
    if (saved) {
        const savedAchievements = JSON.parse(saved);
        achievements.forEach(ach => {
            const savedAch = savedAchievements.find(s => s.id === ach.id);
            if (savedAch) {
                ach.unlocked = savedAch.unlocked;
            }
        });
    }
}

function saveAchievements() {
    localStorage.setItem('suika-achievements', JSON.stringify(achievements));
}

function unlockAchievement(id) {
    const achievement = achievements.find(a => a.id === id);
    if (achievement && !achievement.unlocked) {
        achievement.unlocked = true;
        saveAchievements();
        showAchievementUnlock(achievement);
        updateAchievementDisplay();
    }
}

function showAchievementUnlock(achievement) {
    achievementNameEl.textContent = `${achievement.icon} ${achievement.name}`;
    achievementUnlock.style.display = 'block';
    playSound('combo');
}

function updateAchievementDisplay() {
    achievementListEl.innerHTML = '';
    achievements.forEach(ach => {
        const icon = document.createElement('div');
        icon.className = `achievement-icon ${ach.unlocked ? 'unlocked' : ''}`;
        icon.textContent = ach.icon;
        icon.title = `${ach.name}: ${ach.description}`;
        achievementListEl.appendChild(icon);
    });
}

// Sound system
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'merge':
            oscillator.frequency.value = 400 + Math.random() * 200;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
        case 'combo':
            oscillator.frequency.value = 600;
            oscillator.type = 'triangle';
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'bomb':
            const noise = audioContext.createBufferSource();
            const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.5, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            noise.buffer = buffer;
            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;
            noise.connect(filter);
            filter.connect(gainNode);
            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            noise.start(audioContext.currentTime);
            break;
        case 'drop':
            oscillator.frequency.value = 200;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'gameOver':
            oscillator.frequency.value = 300;
            oscillator.type = 'sawtooth';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 1);
            break;
    }
}

const wallOptions = {
    isStatic: true,
    render: {
        fillStyle: 'black'
    }
};

// --- Fruits ---
const fruitRadius = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const fruitColors = ['#ffdddd', '#ffbbbb', '#ff9999', '#ff7777', '#ff5555', '#ff3333', '#ff1111', '#ff0000', '#cc0000', '#990000', '#660000'];
const fruitScores = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
const fruitEmojis = ['🍒', '🍓', '🍊', '🍋', '🍑', '🍎', '🍉', '🍇', '🥥', '🍍', '🍈'];

function createFruit(x, y, level, isStatic = false, isPowerUp = false) {
    const radius = fruitRadius[level];
    const color = rainbowMode ? `hsl(${Math.random() * 360}, 100%, 50%)` : fruitColors[level];
    const fruit = Bodies.circle(x, y, radius, {
        isStatic: isStatic,
        restitution: 0.3,
        friction: 0.5,
        render: {
            fillStyle: color,
            strokeStyle: isPowerUp ? '#FFD700' : 'transparent',
            lineWidth: isPowerUp ? 3 : 0
        },
        label: isPowerUp ? 'powerup' : 'fruit',
        plugin: {
            level: level,
            isPowerUp: isPowerUp,
            powerUpType: isPowerUp ? (Math.random() > 0.5 ? 'bomb' : 'rainbow') : null
        }
    });
    return fruit;
}

// --- Game Logic ---
function prepareNextFruit() {
    // 10% chance for power-up
    if (Math.random() < 0.1) {
        nextFruitLevel = Math.floor(Math.random() * 3); // Power-ups are smaller
        bombAvailable = true;
    } else {
        nextFruitLevel = Math.floor(Math.random() * 5);
        bombAvailable = false;
    }
    updateNextFruitDisplay();
}

function spawnNextFruit() {
    if (gameEnded) return;
    currentFruit = createFruit(gameWidth / 2, 50, nextFruitLevel, true, bombAvailable);
    World.add(world, currentFruit);
    prepareNextFruit();
}

function updateNextFruitDisplay() {
    nextFruitDisplay.innerHTML = '';
    const radius = fruitRadius[nextFruitLevel];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('width', radius * 2);
    svg.setAttribute('height', radius * 2);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute('cx', radius);
    circle.setAttribute('cy', radius);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', bombAvailable ? '#FFD700' : fruitColors[nextFruitLevel]);
    
    if (bombAvailable) {
        circle.setAttribute('stroke', '#FF6B6B');
        circle.setAttribute('stroke-width', '3');
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute('x', radius);
        text.setAttribute('y', radius);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', radius);
        text.textContent = '💣';
        svg.appendChild(text);
    } else {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute('x', radius);
        text.setAttribute('y', radius);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', radius * 1.5);
        text.textContent = fruitEmojis[nextFruitLevel];
        svg.appendChild(text);
    }
    
    svg.appendChild(circle);
    nextFruitDisplay.appendChild(svg);
}

function updateScore(points, position) {
    const now = Date.now();
    
    // Check for combo
    if (now - lastMergeTime < 2000) {
        comboCount++;
        clearTimeout(comboTimer);
    } else {
        comboCount = 1;
    }
    
    // Apply combo multiplier
    const multiplier = Math.min(1 + (comboCount - 1) * 0.5, 5);
    const finalPoints = Math.floor(points * multiplier);
    currentScore += finalPoints;
    
    // Update stats
    mergeCount++;
    if (comboCount > maxCombo) {
        maxCombo = comboCount;
    }
    mergeCountEl.textContent = mergeCount;
    maxComboEl.textContent = maxCombo;
    
    // Check achievements
    if (mergeCount === 1) unlockAchievement('firstMerge');
    if (comboCount >= 5) unlockAchievement('combo5');
    if (currentScore >= 1000) unlockAchievement('score1000');
    if (currentScore >= 5000) unlockAchievement('score5000');
    if (currentMode === 'timeAttack' && currentScore >= 2000) unlockAchievement('speedDemon');
    
    // Show floating text
    if (position) {
        showFloatingText(position, finalPoints, comboCount > 1);
        if (comboCount > 1) {
            playSound('combo');
        }
    }
    
    // Reset combo after 2 seconds
    comboTimer = setTimeout(() => {
        comboCount = 0;
        updateScoreDisplay();
    }, 2000);
    
    lastMergeTime = now;
    
    if (currentScore > highScore) {
        highScore = currentScore;
        localStorage.setItem('suika-high-score', highScore);
    }
    updateScoreDisplay();
}

function updateScoreDisplay() {
    currentScoreEl.textContent = currentScore;
    highScoreEl.textContent = highScore;
    
    // Show combo indicator
    if (comboCount > 1) {
        currentScoreEl.style.color = '#ff6b6b';
        currentScoreEl.textContent = `${currentScore} (x${comboCount} Combo!)`;
    } else {
        currentScoreEl.style.color = '#000';
    }
}

// Visual effects functions
function showFloatingText(position, points, isCombo) {
    const text = {
        x: position.x,
        y: position.y,
        value: `+${points}${isCombo ? ' COMBO!' : ''}`,
        opacity: 1,
        time: 0,
        color: isCombo ? '#ff6b6b' : '#4CAF50'
    };
    floatingTexts.push(text);
}

function createParticles(x, y, level) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5 - 2,
            life: 1,
            color: fruitColors[level],
            size: Math.random() * 5 + 2
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life -= 0.02;
    });
}

function updateFloatingTexts() {
    floatingTexts = floatingTexts.filter(t => t.opacity > 0);
    floatingTexts.forEach(t => {
        t.y -= 1;
        t.time += 0.02;
        t.opacity = Math.max(0, 1 - t.time);
    });
}

function triggerBomb(position) {
    playSound('bomb');
    bombsUsed++;
    if (bombsUsed >= 10) unlockAchievement('bombMaster');
    // Create explosion effect
    for (let i = 0; i < 30; i++) {
        particles.push({
            x: position.x,
            y: position.y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            color: '#FF6B6B',
            size: Math.random() * 8 + 4
        });
    }
    
    // Remove nearby fruits
    const bodies = Composite.allBodies(world).filter(body => body.label === 'fruit');
    bodies.forEach(body => {
        const distance = Math.sqrt(
            Math.pow(body.position.x - position.x, 2) + 
            Math.pow(body.position.y - position.y, 2)
        );
        if (distance < 100 && !body.isStatic) {
            World.remove(world, body);
            updateScore(fruitScores[body.plugin.level] * 2, body.position);
        }
    });
}

function gameOver() {
    console.log("Game Over");
    gameEnded = true;
    Engine.running = false; // Stop the physics engine
    playSound('gameOver');
    
    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Check survival achievement
    const survivalTime = (Date.now() - gameStartTime) / 1000;
    if (survivalTime >= 300) unlockAchievement('survivor');

    finalScoreEl.textContent = currentScore;
    gameOverScreen.style.display = 'flex';
}

function restartGame() {
    gameOverScreen.style.display = 'none';
    achievementUnlock.style.display = 'none';
    World.clear(world, false);

    World.add(world, [
        Bodies.rectangle(gameWidth / 2, gameHeight, gameWidth, 20, wallOptions),
        Bodies.rectangle(0, gameHeight / 2, 20, gameHeight, wallOptions),
        Bodies.rectangle(gameWidth, gameHeight / 2, 20, gameHeight, wallOptions)
    ]);

    currentScore = 0;
    gameEnded = false;
    currentFruit = null;
    comboCount = 0;
    lastMergeTime = 0;
    activePowerUp = null;
    rainbowMode = false;
    particles = [];
    floatingTexts = [];
    mergeCount = 0;
    maxCombo = 0;
    bombsUsed = 0;
    gameStartTime = Date.now();
    
    mergeCountEl.textContent = '0';
    maxComboEl.textContent = '0';
    updateScoreDisplay();
    
    // Start timer for Time Attack mode
    if (currentMode === 'timeAttack') {
        timeRemaining = 120;
        startTimer();
    }

    Engine.run(engine);
    Render.run(render);

    prepareNextFruit();
    spawnNextFruit();
}

function initGame() {
    engine = Engine.create();
    world = engine.world;

    render = Render.create({
        element: gameContainer,
        engine: engine,
        options: {
            width: gameWidth,
            height: gameHeight,
            wireframes: false,
            background: '#ffffff',
            hasBounds: true
        }
    });

    const gameOverLineY = 100;
    Events.on(render, 'afterRender', function() {
        const context = render.context;
        
        // Draw game over line
        if (!gameEnded) {
            context.beginPath();
            context.moveTo(0, gameOverLineY);
            context.lineTo(gameWidth, gameOverLineY);
            context.strokeStyle = 'red';
            context.setLineDash([5, 5]);
            context.stroke();
            context.setLineDash([]);
        }
        
        // Update and draw particles
        updateParticles();
        particles.forEach(p => {
            context.globalAlpha = p.life;
            context.fillStyle = p.color;
            context.beginPath();
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            context.fill();
        });
        
        // Update and draw floating texts
        updateFloatingTexts();
        floatingTexts.forEach(t => {
            context.globalAlpha = t.opacity;
            context.fillStyle = t.color;
            context.font = 'bold 20px Arial';
            context.textAlign = 'center';
            context.fillText(t.value, t.x, t.y);
        });
        
        context.globalAlpha = 1;
        
        // Draw fruit emojis on fruits
        const bodies = Composite.allBodies(world).filter(body => body.label === 'fruit' || body.label === 'powerup');
        bodies.forEach(body => {
            if (body.plugin && body.plugin.level !== undefined) {
                context.save();
                context.translate(body.position.x, body.position.y);
                context.rotate(body.angle);
                context.font = `${fruitRadius[body.plugin.level] * 1.5}px Arial`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                
                if (body.label === 'powerup') {
                    context.fillText(body.plugin.powerUpType === 'bomb' ? '💣' : '🌈', 0, 0);
                } else {
                    context.fillText(fruitEmojis[body.plugin.level], 0, 0);
                }
                context.restore();
            }
        });
    });

    World.add(world, [
        Bodies.rectangle(gameWidth / 2, gameHeight, gameWidth, 20, wallOptions),
        Bodies.rectangle(0, gameHeight / 2, 20, gameHeight, wallOptions),
        Bodies.rectangle(gameWidth, gameHeight / 2, 20, gameHeight, wallOptions)
    ]);

    gameContainer.addEventListener('mousemove', (event) => {
        if (currentFruit) {
            const rect = gameContainer.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const radius = fruitRadius[currentFruit.plugin.level];
            Body.setPosition(currentFruit, { x: Math.max(20 + radius, Math.min(x, gameWidth - 20 - radius)), y: 50 });
        }
    });

    gameContainer.addEventListener('click', () => {
        if (currentFruit) {
            Body.setStatic(currentFruit, false);
            currentFruit = null;
            playSound('drop');
            setTimeout(spawnNextFruit, 1000);
        }
    });

    Events.on(engine, 'collisionStart', (event) => {
        if (gameEnded) return;
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const { bodyA, bodyB } = event.pairs[i];
            
            // Handle power-up collisions
            if ((bodyA.label === 'powerup' && bodyB.label === 'fruit') || 
                (bodyB.label === 'powerup' && bodyA.label === 'fruit')) {
                const powerUp = bodyA.label === 'powerup' ? bodyA : bodyB;
                const fruit = bodyA.label === 'fruit' ? bodyA : bodyB;
                
                if (powerUp.plugin.powerUpType === 'bomb') {
                    triggerBomb(powerUp.position);
                    World.remove(world, powerUp);
                } else if (powerUp.plugin.powerUpType === 'rainbow') {
                    rainbowMode = true;
                    setTimeout(() => { rainbowMode = false; }, 10000);
                    World.remove(world, powerUp);
                    showFloatingText(powerUp.position, 'RAINBOW MODE!', true);
                }
                continue;
            }
            
            // Handle fruit merging
            if (bodyA.label === 'fruit' && bodyB.label === 'fruit' && bodyA.plugin.level === bodyB.plugin.level) {
                const level = bodyA.plugin.level;
                const mergePosition = {
                    x: (bodyA.position.x + bodyB.position.x) / 2,
                    y: (bodyA.position.y + bodyB.position.y) / 2
                };
                
                // Create particles and play sound
                createParticles(mergePosition.x, mergePosition.y, level);
                playSound('merge');
                
                if (level < fruitRadius.length - 1) {
                    const newLevel = level + 1;
                    const newFruit = createFruit(mergePosition.x, mergePosition.y, newLevel);
                    World.remove(world, [bodyA, bodyB]);
                    World.add(world, newFruit);
                    updateScore(fruitScores[level], mergePosition);
                    if (newLevel === fruitRadius.length - 1) {
                        unlockAchievement('maxFruit');
                    }
                } else {
                    World.remove(world, [bodyA, bodyB]);
                    updateScore(fruitScores[level] * 2, mergePosition); // Bonus for max level
                    // Extra particles for max level merge
                    createParticles(mergePosition.x, mergePosition.y, level);
                }
            }
        }
    });

    Events.on(engine, 'afterUpdate', () => {
        if (gameEnded) return;
        
        // Skip game over check in endless mode
        if (currentMode === 'endless') return;
        
        const fruits = Composite.allBodies(world).filter(body => body.label === 'fruit' && !body.isStatic);
        for (let i = 0; i < fruits.length; i++) {
            const fruit = fruits[i];
            if (fruit.position.y - fruitRadius[fruit.plugin.level] < gameOverLineY && fruit.velocity.y < 0.01 && fruit.angularVelocity < 0.01) {
                gameOver();
                break;
            }
        }
    });

    restartButton.addEventListener('click', restartGame);

    updateScoreDisplay();
    // Don't auto-start the game - wait for menu selection
}

// Timer functionality
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        timeRemainingEl.textContent = timeRemaining;
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            gameOver();
        }
    }, 1000);
}

// Menu functionality
function showMenu() {
    menuScreen.style.display = 'block';
    mainContainer.style.display = 'none';
    updateAchievementDisplay();
}

function startGameWithMode(mode) {
    currentMode = mode;
    menuScreen.style.display = 'none';
    mainContainer.style.display = 'flex';
    
    // Update UI based on mode
    switch(mode) {
        case 'classic':
            currentModeEl.textContent = 'Classic Mode';
            timerDisplay.style.display = 'none';
            break;
        case 'timeAttack':
            currentModeEl.textContent = 'Time Attack Mode';
            timerDisplay.style.display = 'block';
            break;
        case 'endless':
            currentModeEl.textContent = 'Endless Mode';
            timerDisplay.style.display = 'none';
            break;
    }
    
    // Initialize game if not already initialized
    if (!engine) {
        initGame();
        // Start the game after initialization
        Engine.run(engine);
        Render.run(render);
        prepareNextFruit();
        spawnNextFruit();
        gameStartTime = Date.now();
        
        // Start timer for Time Attack mode
        if (currentMode === 'timeAttack') {
            timeRemaining = 120;
            startTimer();
        }
    } else {
        restartGame();
    }
}

// Event listeners for menu
document.querySelectorAll('.mode-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        startGameWithMode(mode);
    });
});

menuButton.addEventListener('click', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    showMenu();
});

// Load achievements and show menu on start
loadAchievements();
showMenu();