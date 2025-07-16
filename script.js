// Matter.js module aliases
const { Engine, Render, World, Bodies, Body, Events, Vector } = Matter;

// Game UI elements
const gameContainer = document.getElementById('game-container');
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const nextFruitDisplay = document.getElementById('next-fruit-display');

// Game dimensions
const gameWidth = 400;
const gameHeight = 600;

// Score
let currentScore = 0;
let highScore = localStorage.getItem('suika-high-score') || 0;
updateScoreDisplay();

// Create an engine
const engine = Engine.create();
const world = engine.world;

// Create a renderer
const render = Render.create({
    element: gameContainer,
    engine: engine,
    options: {
        width: gameWidth,
        height: gameHeight,
        wireframes: false,
        background: '#ffffff'
    }
});

// --- Game Over Line ---
const gameOverLineY = 100;
Events.on(render, 'afterRender', function() {
    const context = render.context;
    context.beginPath();
    context.moveTo(0, gameOverLineY);
    context.lineTo(gameWidth, gameOverLineY);
    context.strokeStyle = 'red';
    context.setLineDash([5, 5]);
    context.stroke();
    context.setLineDash([]);
});


// Create walls
const wallOptions = {
    isStatic: true,
    render: {
        fillStyle: 'black'
    }
};
World.add(world, [
    Bodies.rectangle(gameWidth / 2, gameHeight, gameWidth, 20, wallOptions), // Ground
    Bodies.rectangle(0, gameHeight / 2, 20, gameHeight, wallOptions),       // Left wall
    Bodies.rectangle(gameWidth, gameHeight / 2, 20, gameHeight, wallOptions) // Right wall
]);


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
let currentFruit = null;
let nextFruitLevel = 0;
let gameEnded = false;

function prepareNextFruit() {
    nextFruitLevel = Math.floor(Math.random() * 5);
    updateNextFruitDisplay();
}

function spawnNextFruit() {
    if (gameEnded) return;
    currentFruit = createFruit(gameWidth / 2, 50, nextFruitLevel, true);
    World.add(world, currentFruit);
    prepareNextFruit(); // Prepare the next one
}

function updateNextFruitDisplay() {
    nextFruitDisplay.innerHTML = ''; // Clear previous
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


// --- Mouse Control ---
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
        setTimeout(spawnNextFruit, 1000); // Spawn next fruit after a delay
    }
});


// --- Collision Handling ---
Events.on(engine, 'collisionStart', (event) => {
    if (gameEnded) return;
    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const { bodyA, bodyB } = pair;

        if (bodyA.label === 'fruit' && bodyB.label === 'fruit') {
            const levelA = bodyA.plugin.level;
            const levelB = bodyB.plugin.level;

            if (levelA === levelB) {
                // Merge fruits
                if (levelA < fruitRadius.length - 1) {
                    const newLevel = levelA + 1;
                    const newPosition = Vector.add(bodyA.position, bodyB.position);
                    const newFruit = createFruit(newPosition.x / 2, newPosition.y / 2, newLevel);

                    World.remove(world, [bodyA, bodyB]);
                    World.add(world, newFruit);
                    updateScore(fruitScores[levelA]);
                } else { // Both are the largest fruit (suika)
                    World.remove(world, [bodyA, bodyB]);
                    updateScore(fruitScores[levelA]);
                }
            }
        }
    }
});

// --- Game Over ---
Events.on(engine, 'afterUpdate', () => {
    if (gameEnded) return;
    const fruits = World.allBodies(world).filter(body => body.label === 'fruit' && !body.isStatic);
    for (let i = 0; i < fruits.length; i++) {
        if (fruits[i].position.y - fruitRadius[fruits[i].plugin.level] < gameOverLineY && fruits[i].velocity.y < 0.01) {
            console.log("Game Over");
            gameEnded = true;
            Engine.clear(engine);
            Render.stop(render);
            alert(`Game Over! Your score: ${currentScore}`);
            break;
        }
    }
});


// Run the engine and renderer
Engine.run(engine);
Render.run(render);

// Initial setup
prepareNextFruit();
spawnNextFruit();
