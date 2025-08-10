// Matter.js モジュールの設定
const { Engine, Render, Runner, World, Bodies, Body, Events, Constraint, Mouse, MouseConstraint } = Matter;

// ゲーム設定
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const WALL_THICKNESS = 10;
const DANGER_LINE = 120;

// 果物の設定（進化順：🍒→🍓→🍇→🍐→🍊→🍈→🍍→🍉）
const FRUITS = [
    { emoji: '🍒', radius: 30, score: 10, color: '#dc2626' },      // チェリー
    { emoji: '🍓', radius: 36, score: 20, color: '#f97316' },      // いちご
    { emoji: '🍇', radius: 44, score: 40, color: '#7c3aed' },      // ぶどう
    { emoji: '🍐', radius: 52, score: 80, color: '#16a34a' },      // 梨
    { emoji: '🍊', radius: 60, score: 160, color: '#ea580c' },     // オレンジ
    { emoji: '🍈', radius: 70, score: 320, color: '#16a34a' },     // メロン
    { emoji: '🍍', radius: 80, score: 640, color: '#eab308' },     // パイナップル
    { emoji: '🍉', radius: 100, score: 1280, color: '#dc2626' }     // スイカ
];

// ゲーム状態
let engine, world, render, runner;
let score = 0;
let nextFruitType = 0;
let gameOver = false;
let dropCooldown = false;
let fruits = [];

// DOM要素
const canvas = document.getElementById('gameCanvas');
const scoreElement = document.getElementById('score');
const nextFruitElement = document.getElementById('next-fruit');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const restartGameBtn = document.getElementById('restartGameBtn');

// エンジンとレンダラーの初期化
function initializeGame() {
    // エンジンの作成
    engine = Engine.create();
    world = engine.world;
    engine.world.gravity.y = 0.8;

    // レンダラーの作成
    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            wireframes: false,
            background: 'transparent',
            showVelocity: false,
            showAngleIndicator: false,
            showDebug: false
        }
    });

    // ランナーの作成
    runner = Runner.create();

    // 壁の作成
    createWalls();

    // イベントリスナーの設定
    setupEventListeners();

    // ゲーム開始
    Render.run(render);
    Runner.run(runner, engine);

    // 初期化
    resetGame();
}

// 壁の作成
function createWalls() {
    const walls = [
        // 左の壁
        Bodies.rectangle(-WALL_THICKNESS/2, GAME_HEIGHT/2, WALL_THICKNESS, GAME_HEIGHT, { 
            isStatic: true,
            render: { fillStyle: '#ff6b6b' }
        }),
        // 右の壁
        Bodies.rectangle(GAME_WIDTH + WALL_THICKNESS/2, GAME_HEIGHT/2, WALL_THICKNESS, GAME_HEIGHT, { 
            isStatic: true,
            render: { fillStyle: '#ff6b6b' }
        }),
        // 底
        Bodies.rectangle(GAME_WIDTH/2, GAME_HEIGHT + WALL_THICKNESS/2, GAME_WIDTH + WALL_THICKNESS*2, WALL_THICKNESS, { 
            isStatic: true,
            render: { fillStyle: '#ff6b6b' }
        })
    ];

    World.add(world, walls);
}

// 果物の作成
function createFruit(x, y, type) {
    const fruitData = FRUITS[type];
    const fruit = Bodies.circle(x, y, fruitData.radius, {
        render: {
            fillStyle: fruitData.color,
            strokeStyle: '#333',
            lineWidth: 2
        },
        restitution: 0.3,
        friction: 0.3,
        frictionAir: 0.01
    });

    fruit.fruitType = type;
    fruit.emoji = fruitData.emoji;
    fruit.isProcessed = false;
    
    fruits.push(fruit);
    World.add(world, fruit);
    
    return fruit;
}

// 果物を落とす
function dropFruit(x) {
    if (gameOver || dropCooldown) return;
    
    dropCooldown = true;
    setTimeout(() => dropCooldown = false, 500);
    
    createFruit(x, 50, nextFruitType);
    
    // 次の果物をランダムに選択（最初の3種類から）
    nextFruitType = Math.floor(Math.random() * 3);
    updateNextFruitDisplay();
}

// 次の果物表示を更新
function updateNextFruitDisplay() {
    nextFruitElement.textContent = FRUITS[nextFruitType].emoji;
}

// スコア更新
function updateScore(points) {
    score += points;
    scoreElement.textContent = score;
}

// 衝突検知と合成
function handleCollisions() {
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        
        pairs.forEach(pair => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            // 両方が果物で、同じ種類で、まだ処理されていない場合
            if (bodyA.fruitType !== undefined && bodyB.fruitType !== undefined &&
                bodyA.fruitType === bodyB.fruitType && 
                !bodyA.isProcessed && !bodyB.isProcessed &&
                bodyA.fruitType < FRUITS.length - 1) {
                
                // 処理済みマークを付ける
                bodyA.isProcessed = true;
                bodyB.isProcessed = true;
                
                // 新しい果物の位置（2つの果物の中間）
                const newX = (bodyA.position.x + bodyB.position.x) / 2;
                const newY = (bodyA.position.y + bodyB.position.y) / 2;
                const newType = bodyA.fruitType + 1;
                
                // スコア加算
                const scoreToAdd = FRUITS[newType].score;
                updateScore(scoreToAdd);
                
                // エフェクト（簡単なアニメーション）
                setTimeout(() => {
                    // 古い果物を削除
                    World.remove(world, bodyA);
                    World.remove(world, bodyB);
                    fruits = fruits.filter(f => f !== bodyA && f !== bodyB);
                    
                    // 新しい果物を作成
                    createFruit(newX, newY, newType);
                }, 50);
            }
        });
    });
}

// ゲームオーバー判定
function checkGameOver() {
    let isGameOver = false;
    
    fruits.forEach(fruit => {
        if (fruit.position.y - FRUITS[fruit.fruitType].radius < DANGER_LINE) {
            // 危険ライン上に3秒以上いる場合
            if (!fruit.dangerTime) {
                fruit.dangerTime = Date.now();
            } else if (Date.now() - fruit.dangerTime > 3000) {
                isGameOver = true;
            }
        } else {
            fruit.dangerTime = null;
        }
    });
    
    if (isGameOver && !gameOver) {
        gameOver = true;
        showGameOver();
    }
}

// ゲームオーバー表示
function showGameOver() {
    finalScoreElement.textContent = score;
    gameOverElement.classList.remove('hidden');
}

// ゲームリセット
function resetGame() {
    // 果物をすべて削除
    fruits.forEach(fruit => {
        World.remove(world, fruit);
    });
    fruits = [];
    
    // ゲーム状態をリセット
    score = 0;
    nextFruitType = Math.floor(Math.random() * 3);
    gameOver = false;
    dropCooldown = false;
    
    // UI更新
    updateScore(0);
    updateNextFruitDisplay();
    gameOverElement.classList.add('hidden');
}

// イベントリスナーの設定
function setupEventListeners() {
    // キャンバスクリック
    canvas.addEventListener('click', (event) => {
        if (gameOver) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // キャンバス座標をゲーム座標に変換
        const gameX = (x / rect.width) * GAME_WIDTH;
        
        dropFruit(Math.max(30, Math.min(GAME_WIDTH - 30, gameX)));
    });
    
    // リスタートボタン
    restartBtn.addEventListener('click', resetGame);
    restartGameBtn.addEventListener('click', resetGame);
    
    // 衝突検知
    handleCollisions();
    
    // ゲームループ
    setInterval(() => {
        if (!gameOver) {
            checkGameOver();
        }
    }, 100);
}

// カスタム描画（絵文字表示）
function customRender() {
    const ctx = render.canvas.getContext('2d');
    
    // フレームごとに果物の絵文字を描画
    Events.on(render, 'afterRender', () => {
        fruits.forEach(fruit => {
            if (fruit.render.visible) {
                const pos = fruit.position;
                const radius = FRUITS[fruit.fruitType].radius;
                
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.rotate(fruit.angle);
                ctx.font = `${radius * 1.5}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(fruit.emoji, 0, 0);
                ctx.restore();
            }
        });
    });
}

// ゲーム初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
    customRender();
});