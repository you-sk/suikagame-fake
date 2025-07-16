// Matter.js module aliases
const { Engine, Render, World, Bodies, Body, Events, Vector } = Matter;

// Game container
const gameContainer = document.getElementById('game-container');
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');


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
const fruitScores = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66]; // Scores for merging each fruit level

function createFruit(x, y, level) {
    const radius = fruitRadius[level];
    const fruit = Bodies.circle(x, y, radius, {
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
let currentFruitLevel = 0;
let gameEnded = false;

function spawnNextFruit() {
    if (gameEnded) return;
    currentFruitLevel = Math.floor(Math.random() * 5); // Spawn smaller fruits initially
    currentFruit = createFruit(gameWidth / 2, 50, currentFruitLevel);
    Body.setStatic(currentFruit, true); // Make it static until dropped
    World.add(world, currentFruit);
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
        Body.setPosition(currentFruit, { x: Math.max(20 + fruitRadius[currentFruitLevel], Math.min(x, gameWidth - 20 - fruitRadius[currentFruitLevel])), y: 50 });
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
const gameOverLineY = 100;
Events.on(engine, 'afterUpdate', () => {
    if (gameEnded) return;
    const fruits = World.allBodies(world).filter(body => body.label === 'fruit' && !body.isStatic);
    for (let i = 0; i < fruits.length; i++) {
        if (fruits[i].position.y < gameOverLineY && fruits[i].velocity.y < 0.01) {
             // A simple check, can be improved
            console.log("Game Over");
            gameEnded = true;
            Engine.clear(engine);
            Render.stop(render);
            alert(`Game Over! Your score: ${currentScore}`);
            // No need to break, gameEnded flag will stop further actions
        }
    }
});


// Run the engine and renderer
Engine.run(engine);
Render.run(render);

// Initial fruit
spawnNextFruit();