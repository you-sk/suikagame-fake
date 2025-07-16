// Matter.js module aliases
const { Engine, Render, World, Bodies, Body, Events, Vector } = Matter;

// Game UI elements
const gameContainer = document.getElementById('game-container');
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const nextFruitDisplay = document.getElementById('next-fruit-display');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

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

function createFruit(x, y, level, isStatic = false) {
    const radius = fruitRadius[level];
    const fruit = Bodies.circle(x, y, radius, {
        isStatic: isStatic,
        restitution: 0.3,
        friction: 0.5,
        render: {
            fillStyle: fruitColors[level]
        },
        label: 'fruit',
        plugin: {
            level: level
        }
    });
    return fruit;
}

// --- Game Logic ---
function prepareNextFruit() {
    nextFruitLevel = Math.floor(Math.random() * 5);
    updateNextFruitDisplay();
}

function spawnNextFruit() {
    if (gameEnded) return;
    currentFruit = createFruit(gameWidth / 2, 50, nextFruitLevel, true);
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
    circle.setAttribute('fill', fruitColors[nextFruitLevel]);
    svg.appendChild(circle);
    nextFruitDisplay.appendChild(svg);
}

function updateScore(points) {
    currentScore += points;
    if (currentScore > highScore) {
        highScore = currentScore;
        localStorage.setItem('suika-high-score', highScore);
    }
    updateScoreDisplay();
}

function updateScoreDisplay() {
    currentScoreEl.textContent = currentScore;
    highScoreEl.textContent = highScore;
}

function gameOver() {
    console.log("Game Over");
    gameEnded = true;
    Engine.running = false; // Stop the physics engine

    finalScoreEl.textContent = currentScore;
    gameOverScreen.style.display = 'flex';
}

function restartGame() {
    gameOverScreen.style.display = 'none';
    World.clear(world, false);

    World.add(world, [
        Bodies.rectangle(gameWidth / 2, gameHeight, gameWidth, 20, wallOptions),
        Bodies.rectangle(0, gameHeight / 2, 20, gameHeight, wallOptions),
        Bodies.rectangle(gameWidth, gameHeight / 2, 20, gameHeight, wallOptions)
    ]);

    currentScore = 0;
    gameEnded = false;
    currentFruit = null;
    updateScoreDisplay();

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
        if (gameEnded) return;
        const context = render.context;
        context.beginPath();
        context.moveTo(0, gameOverLineY);
        context.lineTo(gameWidth, gameOverLineY);
        context.strokeStyle = 'red';
        context.setLineDash([5, 5]);
        context.stroke();
        context.setLineDash([]);
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
            setTimeout(spawnNextFruit, 1000);
        }
    });

    Events.on(engine, 'collisionStart', (event) => {
        if (gameEnded) return;
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const { bodyA, bodyB } = event.pairs[i];
            if (bodyA.label === 'fruit' && bodyB.label === 'fruit' && bodyA.plugin.level === bodyB.plugin.level) {
                const level = bodyA.plugin.level;
                if (level < fruitRadius.length - 1) {
                    const newLevel = level + 1;
                    const newPosition = Vector.add(bodyA.position, bodyB.position);
                    const newFruit = createFruit(newPosition.x / 2, newPosition.y / 2, newLevel);
                    World.remove(world, [bodyA, bodyB]);
                    World.add(world, newFruit);
                    updateScore(fruitScores[level]);
                } else {
                    World.remove(world, [bodyA, bodyB]);
                    updateScore(fruitScores[level]);
                }
            }
        }
    });

    Events.on(engine, 'afterUpdate', () => {
        if (gameEnded) return;
        const fruits = World.allBodies(world).filter(body => body.label === 'fruit' && !body.isStatic);
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
    Engine.run(engine);
    Render.run(render);

    prepareNextFruit();
    spawnNextFruit();
}

// Start the game
initGame();