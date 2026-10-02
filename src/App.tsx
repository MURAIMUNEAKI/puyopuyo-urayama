/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Pause,
  Trophy,
  Heart,
  ChevronLeft,
  ChevronRight,
  Flame,
  Zap,
  HelpCircle,
  Maximize2,
  Copy,
  TrendingUp,
  Sparkles,
  Radio,
  Shield,
  CircleDot,
  Crosshair,
  Bomb,
  Rocket,
  Layers,
  FastForward,
  ArrowRight,
} from 'lucide-react';
import { Ball, Block, FloatingText, GameState, LaserBolt, Paddle, Particle, PowerUpItem, PowerUpType, RocketMissile } from './types';
import { buildBlocksForLevel, getThreatDetails, LEVELS } from './levels';
import { sound } from './sound';
import { getRandomUpgrades, INITIAL_PERKS, PlayerPerks, UpgradeOption } from './upgrades';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_BASE_WIDTH = 110;
const PADDLE_HEIGHT = 16;
const PADDLE_Y = CANVAS_HEIGHT - 38;
const BALL_BASE_RADIUS = 7;
const BASE_LIVES = 3;

function renderUpgradeIcon(iconName: string) {
  switch (iconName) {
    case 'Maximize2': return <Maximize2 className="h-6 w-6" />;
    case 'Zap': return <Zap className="h-6 w-6" />;
    case 'Heart': return <Heart className="h-6 w-6" />;
    case 'Copy': return <Copy className="h-6 w-6" />;
    case 'TrendingUp': return <TrendingUp className="h-6 w-6" />;
    case 'Flame': return <Flame className="h-6 w-6" />;
    case 'Sparkles': return <Sparkles className="h-6 w-6" />;
    case 'Radio': return <Radio className="h-6 w-6" />;
    case 'Shield': return <Shield className="h-6 w-6" />;
    case 'CircleDot': return <CircleDot className="h-6 w-6" />;
    case 'Crosshair': return <Crosshair className="h-6 w-6" />;
    case 'Bomb': return <Bomb className="h-6 w-6" />;
    case 'Rocket': return <Rocket className="h-6 w-6" />;
    case 'Layers': return <Layers className="h-6 w-6" />;
    case 'FastForward': return <FastForward className="h-6 w-6" />;
    default: return <Sparkles className="h-6 w-6" />;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game UI States
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('breakout_high_score');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [lives, setLives] = useState<number>(BASE_LIVES);
  const [levelIndex, setLevelIndex] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted);
  const [showHowTo, setShowHowTo] = useState<boolean>(false);
  const [activePowerUpName, setActivePowerUpName] = useState<string | null>(null);

  // Roguelite Upgrade selection between rounds
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeOption[]>([]);
  const [acquiredUpgrades, setAcquiredUpgrades] = useState<{ option: UpgradeOption; count: number }[]>([]);
  const [, setPlayerPerks] = useState<PlayerPerks>({ ...INITIAL_PERKS });

  // Mutable Game Engine References
  const engineRef = useRef<{
    gameState: GameState;
    balls: Ball[];
    paddle: Paddle;
    blocks: Block[];
    particles: Particle[];
    powerUps: PowerUpItem[];
    floatingTexts: FloatingText[];
    laserBolts: LaserBolt[];
    rockets: RocketMissile[];
    keys: { left: boolean; right: boolean };
    score: number;
    lives: number;
    levelIndex: number;
    combo: number;
    maxCombo: number;
    ballAttached: boolean;
    remainingBlocks: number;
    laserTimer: number;
    lastLaserShotTime: number;
    screenShake: number;
    safetyBarrierRemaining: number;
    currentBaseSpeed: number;
    touchLeft: boolean;
    touchRight: boolean;
    perks: PlayerPerks;
  }>({
    gameState: 'TITLE_MENU',
    balls: [],
    paddle: {
      x: CANVAS_WIDTH / 2,
      y: PADDLE_Y,
      width: PADDLE_BASE_WIDTH,
      height: PADDLE_HEIGHT,
      baseWidth: PADDLE_BASE_WIDTH,
      speed: 9,
      isExpanded: false,
      expandTimer: 0,
    },
    blocks: [],
    particles: [],
    powerUps: [],
    floatingTexts: [],
    laserBolts: [],
    rockets: [],
    keys: { left: false, right: false },
    score: 0,
    lives: BASE_LIVES,
    levelIndex: 0,
    combo: 0,
    maxCombo: 0,
    ballAttached: true,
    remainingBlocks: 0,
    laserTimer: 0,
    lastLaserShotTime: 0,
    screenShake: 0,
    safetyBarrierRemaining: 0,
    currentBaseSpeed: 6.8,
    touchLeft: false,
    touchRight: false,
    perks: { ...INITIAL_PERKS },
  });

  // Keep engine ref synced with React state
  useEffect(() => {
    engineRef.current.gameState = gameState;
  }, [gameState]);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      try {
        localStorage.setItem('breakout_high_score', String(score));
      } catch {}
    }
  }, [score, highScore]);

  // Spawn new ball with current meteor perk radius
  const createBall = (x: number, y: number, vx: number, vy: number, speed: number, isPenetrating = false): Ball => {
    const radius = BALL_BASE_RADIUS + engineRef.current.perks.ballRadiusBonus;
    return {
      id: `ball-${Math.random()}`,
      x,
      y,
      vx,
      vy,
      radius,
      speed,
      isPenetrating,
      trail: [],
    };
  };

  // Add floating text
  const addFloatingText = (text: string, x: number, y: number, color = '#FDE047') => {
    const engine = engineRef.current;
    engine.floatingTexts.push({
      id: `text-${Math.random()}`,
      text,
      x,
      y,
      vy: -1.3,
      alpha: 1,
      color,
      scale: 1,
    });
  };

  // Spawn explosion particles
  const spawnBlockParticles = (x: number, y: number, color: string, count = 12) => {
    const engine = engineRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 1.2;
      engine.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        size: Math.random() * 3.5 + 2,
        color,
        alpha: 1,
        life: 0,
        maxLife: Math.floor(Math.random() * 18 + 18),
      });
    }
  };

  // Explode explosive blocks
  const triggerExplosion = (centerX: number, centerY: number, radius = 105) => {
    const engine = engineRef.current;
    sound.playBlockDestroy(true);
    spawnBlockParticles(centerX, centerY, '#FB7171', 25);
    spawnBlockParticles(centerX, centerY, '#FACC15', 20);

    engine.blocks.forEach((blk) => {
      if (blk.hp <= 0) return;
      const blkCenterX = blk.x + blk.width / 2;
      const blkCenterY = blk.y + blk.height / 2;
      const dist = Math.hypot(blkCenterX - centerX, blkCenterY - centerY);
      if (dist <= radius) {
        blk.hp -= 2;
        if (blk.hp <= 0) {
          const pointsEarned = Math.round(blk.score * engine.perks.scoreMultiplier);
          engine.score += pointsEarned;
          engine.remainingBlocks--;
          spawnBlockParticles(blkCenterX, blkCenterY, blk.color, 12);
        }
      }
    });
  };

  // Setup level with escalating difficulty & stacked perks
  const initLevel = useCallback((lvlIndex: number, resetScore = false) => {
    const engine = engineRef.current;
    const { blocks, totalDestructible, ballBaseSpeed } = buildBlocksForLevel(lvlIndex, CANVAS_WIDTH, CANVAS_HEIGHT);
    const initialSpeed = ballBaseSpeed * engine.perks.ballSpeedFactor;

    engine.levelIndex = lvlIndex;
    engine.currentBaseSpeed = initialSpeed;
    engine.blocks = blocks;
    engine.remainingBlocks = totalDestructible;
    engine.particles = [];
    engine.powerUps = [];
    engine.floatingTexts = [];
    engine.laserBolts = [];
    engine.rockets = [];
    engine.ballAttached = true;
    engine.combo = 0;
    engine.lastLaserShotTime = 0;
    engine.screenShake = 0;
    // Safety barrier charges stack!
    engine.safetyBarrierRemaining = engine.perks.safetyBarrierCharges;

    // Apply stacked perks to paddle
    const effectiveBaseWidth = PADDLE_BASE_WIDTH + engine.perks.extraPaddleWidth;
    const effectiveSpeed = 9 * engine.perks.paddleSpeedMultiplier;

    engine.paddle = {
      x: CANVAS_WIDTH / 2,
      y: PADDLE_Y,
      width: effectiveBaseWidth,
      height: PADDLE_HEIGHT,
      baseWidth: effectiveBaseWidth,
      speed: effectiveSpeed,
      isExpanded: false,
      expandTimer: 0,
    };

    // Check stacked Start Dash frenzy duration
    if (engine.perks.startLaserDuration > 0) {
      engine.laserTimer = Date.now() + engine.perks.startLaserDuration * 1000;
      addFloatingText(`🔥 スタートダッシュ貫通発動! (${engine.perks.startLaserDuration}秒)`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#F43F5E');
    } else {
      engine.laserTimer = 0;
    }

    // Spawn starting ball(s) according to stacked perks
    const ballCount = engine.perks.startBallsCount || 1;
    const isPenetrating = engine.laserTimer > Date.now();
    const newBalls: Ball[] = [];
    for (let i = 0; i < ballCount; i++) {
      const offset = (i - (ballCount - 1) / 2) * 16;
      newBalls.push(
        createBall(
          CANVAS_WIDTH / 2 + offset,
          PADDLE_Y - (BALL_BASE_RADIUS + engine.perks.ballRadiusBonus) - 1,
          0,
          -initialSpeed,
          initialSpeed,
          isPenetrating
        )
      );
    }
    engine.balls = newBalls;

    // Opening blast missile perk: stacks to explode 3, 6, 9+ blocks!
    if (engine.perks.openingBlastCount > 0) {
      const aliveBlocks = engine.blocks.filter((b) => b.hp > 0);
      const blastCount = Math.min(engine.perks.openingBlastCount, aliveBlocks.length);
      for (let i = 0; i < blastCount; i++) {
        const target = aliveBlocks[Math.floor(Math.random() * aliveBlocks.length)];
        if (target && target.hp > 0) {
          target.hp = 0;
          engine.remainingBlocks--;
          const pts = Math.round(target.score * engine.perks.scoreMultiplier);
          engine.score += pts;
          spawnBlockParticles(target.x + target.width / 2, target.y + target.height / 2, '#F97316', 16);
          addFloatingText(`開幕爆破! +${pts}`, target.x + target.width / 2, target.y + target.height / 2, '#FB923C');
        }
      }
      sound.playBlockDestroy(true);
    }

    if (resetScore) {
      engine.score = 0;
      engine.lives = BASE_LIVES;
      engine.maxCombo = 0;
      engine.perks = { ...INITIAL_PERKS };
      setScore(0);
      setLives(BASE_LIVES);
      setCombo(0);
      setMaxCombo(0);
      setPlayerPerks({ ...INITIAL_PERKS });
      setAcquiredUpgrades([]);
    }

    setLevelIndex(lvlIndex);
    setActivePowerUpName(null);
  }, []);

  // Launch the attached ball(s)
  const launchBall = useCallback(() => {
    const engine = engineRef.current;
    if (engine.ballAttached && engine.balls.length > 0) {
      engine.ballAttached = false;
      const initialSpeed = engine.currentBaseSpeed;

      engine.balls.forEach((ball, idx) => {
        let angle = (Math.random() * 0.3 - 0.15) * Math.PI;
        if (engine.balls.length > 1) {
          angle = ((idx / (engine.balls.length - 1)) - 0.5) * 0.6 * Math.PI;
        }
        ball.vx = initialSpeed * Math.sin(angle);
        ball.vy = -Math.abs(initialSpeed * Math.cos(angle));
      });
      sound.playPaddleHit(0);
    }
  }, []);

  // Spawn Power-up item
  const spawnPowerUp = (x: number, y: number) => {
    const engine = engineRef.current;
    const types: { type: PowerUpType; label: string; color: string; icon: string }[] = [
      { type: 'expand', label: 'ワイドパドル', color: '#38BDF8', icon: '↔' },
      { type: 'multi_ball', label: 'マルチボール', color: '#4ADE80', icon: '●●' },
      { type: 'laser_ball', label: '貫通ファイヤー', color: '#F87171', icon: '★' },
      { type: 'slow_ball', label: 'スピードダウン', color: '#A78BFA', icon: '▼' },
      { type: 'extra_life', label: 'ライフ+1', color: '#F43F5E', icon: '♥' },
    ];
    const roll = Math.random();
    let selected = types[0];
    if (roll < 0.28) selected = types[0];
    else if (roll < 0.55) selected = types[1];
    else if (roll < 0.75) selected = types[2];
    else if (roll < 0.90) selected = types[3];
    else selected = types[4];

    engine.powerUps.push({
      id: `pw-${Math.random()}`,
      x,
      y,
      vy: 2.3,
      type: selected.type,
      label: selected.label,
      color: selected.color,
      iconName: selected.icon,
    });
  };

  // Apply in-game temporary drop Power-up (STACKING TIMERS & MULTIPLIERS)
  const applyPowerUp = (type: PowerUpType, label: string) => {
    const engine = engineRef.current;
    sound.playPowerUp();
    addFloatingText(label, engine.paddle.x, engine.paddle.y - 20, '#38BDF8');
    setActivePowerUpName(label);
    setTimeout(() => setActivePowerUpName(null), 3000);

    const now = Date.now();
    switch (type) {
      case 'expand': {
        // Stack duration!
        engine.paddle.isExpanded = true;
        engine.paddle.expandTimer = Math.max(now, engine.paddle.expandTimer) + 15000;
        break;
      }
      case 'multi_ball': {
        const currentBalls = [...engine.balls];
        // Stack with quadSplitCount perk!
        const splitCount = 2 + engine.perks.quadSplitCount * 2;
        currentBalls.forEach((b) => {
          if (engine.balls.length < 16) {
            for (let s = 0; s < splitCount; s++) {
              const spread = (s - (splitCount - 1) / 2) * 1.8;
              engine.balls.push(
                createBall(b.x, b.y, b.vx * 0.8 + spread, b.vy * 0.9 - 1, b.speed, b.isPenetrating)
              );
            }
          }
        });
        break;
      }
      case 'laser_ball': {
        // Stack duration!
        engine.balls.forEach((b) => (b.isPenetrating = true));
        engine.laserTimer = Math.max(now, engine.laserTimer) + 10000;
        break;
      }
      case 'slow_ball': {
        const baseSpeed = engine.currentBaseSpeed;
        engine.balls.forEach((b) => {
          b.speed = baseSpeed;
          const currentSpd = Math.hypot(b.vx, b.vy) || 1;
          b.vx = (b.vx / currentSpd) * baseSpeed;
          b.vy = (b.vy / currentSpd) * baseSpeed;
        });
        break;
      }
      case 'extra_life': {
        engine.lives += 1;
        setLives(engine.lives);
        break;
      }
    }
  };

  // Shockwave damage from upgrade perk
  const triggerShockwave = (centerX: number, centerY: number) => {
    const engine = engineRef.current;
    const radius = 75;
    spawnBlockParticles(centerX, centerY, '#2DD4BF', 12);
    engine.blocks.forEach((blk) => {
      if (blk.hp <= 0) return;
      const blkCenterX = blk.x + blk.width / 2;
      const blkCenterY = blk.y + blk.height / 2;
      if (Math.hypot(blkCenterX - centerX, blkCenterY - centerY) <= radius) {
        blk.hp -= 1;
        if (blk.hp <= 0) {
          const points = Math.round(blk.score * engine.perks.scoreMultiplier);
          engine.score += points;
          engine.remainingBlocks--;
          spawnBlockParticles(blkCenterX, blkCenterY, blk.color, 8);
        }
      }
    });
  };

  // Chain lightning damage from upgrade perk
  const triggerChainLightning = (sourceBlock: Block) => {
    const engine = engineRef.current;
    const srcX = sourceBlock.x + sourceBlock.width / 2;
    const srcY = sourceBlock.y + sourceBlock.height / 2;

    const aliveOtherBlocks = engine.blocks.filter(
      (b) => b.id !== sourceBlock.id && b.hp > 0 && Math.hypot(b.x + b.width / 2 - srcX, b.y + b.height / 2 - srcY) < 110
    );

    if (aliveOtherBlocks.length > 0) {
      const targets = aliveOtherBlocks.slice(0, 3);
      targets.forEach((tgt) => {
        tgt.hp -= 1;
        const tgtX = tgt.x + tgt.width / 2;
        const tgtY = tgt.y + tgt.height / 2;
        spawnBlockParticles(tgtX, tgtY, '#38BDF8', 8);
        if (tgt.hp <= 0) {
          engine.score += Math.round(tgt.score * engine.perks.scoreMultiplier);
          engine.remainingBlocks--;
        }
      });
      addFloatingText('⚡ 稲妻連鎖!', srcX, srcY - 10, '#38BDF8');
    }
  };

  // Fire laser bolts from paddle (SCALES WITH LASER LEVEL!)
  const fireTwinLasers = () => {
    const engine = engineRef.current;
    sound.playLaser();
    const level = engine.perks.laserBlasterLevel;
    const y = engine.paddle.y - 4;

    if (level === 1) {
      // Twin lasers
      engine.laserBolts.push(
        { id: `lz-${Math.random()}`, x: engine.paddle.x - engine.paddle.width * 0.38, y, vy: -14, width: 4, height: 16, color: '#F43F5E' },
        { id: `lz-${Math.random()}`, x: engine.paddle.x + engine.paddle.width * 0.38, y, vy: -14, width: 4, height: 16, color: '#F43F5E' }
      );
    } else if (level === 2) {
      // Quad lasers
      const offsets = [-0.42, -0.15, 0.15, 0.42];
      offsets.forEach((off) => {
        engine.laserBolts.push({
          id: `lz-${Math.random()}`,
          x: engine.paddle.x + engine.paddle.width * off,
          y,
          vy: -14,
          width: 4,
          height: 16,
          color: '#38BDF8',
        });
      });
    } else {
      // Hexa / Gatling barrage
      const offsets = [-0.45, -0.27, -0.09, 0.09, 0.27, 0.45];
      offsets.forEach((off) => {
        engine.laserBolts.push({
          id: `lz-${Math.random()}`,
          x: engine.paddle.x + engine.paddle.width * off,
          y,
          vy: -15,
          width: 5,
          height: 18,
          color: '#A855F7',
        });
      });
    }
  };

  // Launch counter missile (SCALES WITH COUNTER BOMB COUNT!)
  const launchCounterMissiles = (startX: number, startY: number) => {
    const engine = engineRef.current;
    const count = engine.perks.counterBombCount || 1;
    for (let c = 0; c < count; c++) {
      const spread = (c - (count - 1) / 2) * 1.5;
      engine.rockets.push({
        id: `rkt-${Math.random()}`,
        x: startX + spread * 8,
        y: startY,
        vx: spread * 1.2 + (Math.random() - 0.5),
        vy: -7.5 - Math.random() * 2,
        life: 0,
      });
    }
  };

  // Start new game
  const startGame = useCallback(() => {
    initLevel(0, true);
    setGameState('PLAYING');
    engineRef.current.gameState = 'PLAYING';
  }, [initLevel]);

  // Restart current stage
  const restartLevel = useCallback(() => {
    initLevel(engineRef.current.levelIndex, false);
    setGameState('PLAYING');
    engineRef.current.gameState = 'PLAYING';
  }, [initLevel]);

  // When player selects 1 of the 3 upgrades after clearing a round (STACKING PERKS!)
  const handleSelectUpgrade = (upgrade: UpgradeOption) => {
    const engine = engineRef.current;
    sound.playPowerUp();

    // Apply upgrade to perks (stacking values)
    const updatedPerks = { ...engine.perks };
    upgrade.apply(updatedPerks, engine);
    engine.perks = updatedPerks;

    setPlayerPerks(updatedPerks);
    setLives(engine.lives);

    // Track stacked count in UI
    setAcquiredUpgrades((prev) => {
      const existing = prev.find((u) => u.option.id === upgrade.id);
      if (existing) {
        return prev.map((u) => (u.option.id === upgrade.id ? { ...u, count: u.count + 1 } : u));
      }
      return [...prev, { option: upgrade, count: 1 }];
    });

    // Advance to next harder round
    const nextLvl = engine.levelIndex + 1;
    initLevel(nextLvl, false);
    setGameState('PLAYING');
    engineRef.current.gameState = 'PLAYING';
  };

  // Sound toggle
  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'KeyA' || e.code === 'KeyA') {
        engine.keys.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'KeyD' || e.code === 'KeyD') {
        engine.keys.right = true;
      }
      if (e.key === ' ' || e.code === 'Space' || e.key === 'ArrowUp') {
        if (engine.gameState === 'PLAYING') {
          if (engine.ballAttached) {
            launchBall();
          }
        } else if (engine.gameState === 'TITLE_MENU') {
          startGame();
        } else if (engine.gameState === 'GAME_OVER') {
          startGame();
        }
      }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (engine.gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (engine.gameState === 'PAUSED') {
          setGameState('PLAYING');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'KeyA' || e.code === 'KeyA') {
        engine.keys.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'KeyD' || e.code === 'KeyD') {
        engine.keys.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [launchBall, startGame]);

  // Pointer / Mouse tracking on canvas
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const pointerX = (e.clientX - rect.x) * scaleX;
    const engine = engineRef.current;

    const halfWidth = engine.paddle.width / 2;
    engine.paddle.x = Math.max(halfWidth, Math.min(CANVAS_WIDTH - halfWidth, pointerX));

    if (engine.ballAttached && engine.balls.length > 0) {
      engine.balls.forEach((ball, idx) => {
        const offset = (idx - (engine.balls.length - 1) / 2) * 16;
        ball.x = engine.paddle.x + offset;
        ball.y = engine.paddle.y - ball.radius - 1;
      });
    }
  };

  const handlePointerDown = () => {
    const engine = engineRef.current;
    if (engine.gameState === 'PLAYING' && engine.ballAttached) {
      launchBall();
    }
  };

  // Main Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const gameLoop = () => {
      const engine = engineRef.current;
      const isRunning = engine.gameState === 'PLAYING';

      // 1. UPDATE STATE (If Playing)
      if (isRunning) {
        const now = Date.now();

        // Calculate dynamic paddle width (base width + expand powerup)
        let calcWidth = engine.paddle.baseWidth;
        if (engine.paddle.isExpanded) {
          if (now > engine.paddle.expandTimer) {
            engine.paddle.isExpanded = false;
          } else {
            calcWidth += 50;
          }
        }
        engine.paddle.width = calcWidth;

        // Laser power-up timer
        if (engine.laserTimer > 0 && now > engine.laserTimer) {
          engine.laserTimer = 0;
          engine.balls.forEach((b) => (b.isPenetrating = false));
        }

        // Automatic Laser Blaster firing interval based on stacked laser level!
        if (engine.perks.laserBlasterLevel > 0 && !engine.ballAttached) {
          const interval = Math.max(650, 1600 - (engine.perks.laserBlasterLevel - 1) * 350);
          if (now - engine.lastLaserShotTime > interval) {
            engine.lastLaserShotTime = now;
            fireTwinLasers();
          }
        }

        // Moving blocks in higher difficulty stages
        engine.blocks.forEach((blk) => {
          if (blk.hp > 0 && blk.vx) {
            blk.x += blk.vx;
            if (blk.x <= (blk.minX ?? 15) || blk.x >= (blk.maxX ?? CANVAS_WIDTH - blk.width - 15)) {
              blk.vx = -blk.vx;
            }
          }
        });

        // Paddle Movement via Keyboard or Touch buttons
        const moveLeft = engine.keys.left || engine.touchLeft;
        const moveRight = engine.keys.right || engine.touchRight;
        if (moveLeft) {
          engine.paddle.x = Math.max(engine.paddle.width / 2, engine.paddle.x - engine.paddle.speed);
        }
        if (moveRight) {
          engine.paddle.x = Math.min(CANVAS_WIDTH - engine.paddle.width / 2, engine.paddle.x + engine.paddle.speed);
        }

        // Keep attached ball(s) positioned on paddle
        if (engine.ballAttached && engine.balls.length > 0) {
          engine.balls.forEach((ball, idx) => {
            const offset = (idx - (engine.balls.length - 1) / 2) * 16;
            ball.x = engine.paddle.x + offset;
            ball.y = engine.paddle.y - ball.radius - 1;
          });
        }

        // Laser bolts update & block collision
        for (let lIdx = engine.laserBolts.length - 1; lIdx >= 0; lIdx--) {
          const bolt = engine.laserBolts[lIdx];
          bolt.y += bolt.vy;

          let hit = false;
          for (let b = 0; b < engine.blocks.length; b++) {
            const blk = engine.blocks[b];
            if (blk.hp <= 0) continue;
            if (bolt.x >= blk.x && bolt.x <= blk.x + blk.width && bolt.y <= blk.y + blk.height && bolt.y >= blk.y) {
              blk.hp -= 1;
              hit = true;
              spawnBlockParticles(bolt.x, bolt.y, bolt.color, 8);
              if (blk.hp <= 0) {
                engine.score += Math.round(blk.score * engine.perks.scoreMultiplier);
                engine.remainingBlocks--;
                sound.playBlockDestroy(blk.type === 'explosive');
                if (blk.type === 'explosive') {
                  triggerExplosion(blk.x + blk.width / 2, blk.y + blk.height / 2);
                }
              }
              break;
            }
          }

          if (hit || bolt.y < -20) {
            engine.laserBolts.splice(lIdx, 1);
          }
        }

        // Rocket missiles update
        for (let rIdx = engine.rockets.length - 1; rIdx >= 0; rIdx--) {
          const rkt = engine.rockets[rIdx];
          rkt.x += rkt.vx;
          rkt.y += rkt.vy;
          rkt.life++;

          if (rkt.life % 2 === 0) {
            engine.particles.push({
              x: rkt.x,
              y: rkt.y + 4,
              vx: (Math.random() - 0.5) * 1,
              vy: Math.random() * 1.5,
              size: 2,
              color: '#F472B6',
              alpha: 0.8,
              life: 0,
              maxLife: 12,
            });
          }

          let hit = false;
          for (let b = 0; b < engine.blocks.length; b++) {
            const blk = engine.blocks[b];
            if (blk.hp <= 0) continue;
            if (rkt.x >= blk.x && rkt.x <= blk.x + blk.width && rkt.y <= blk.y + blk.height && rkt.y >= blk.y) {
              triggerExplosion(rkt.x, rkt.y, 80);
              hit = true;
              break;
            }
          }

          if (hit || rkt.y < -20) {
            engine.rockets.splice(rIdx, 1);
          }
        }

        // Paddle boundaries
        const paddleTop = engine.paddle.y;
        const paddleBottom = engine.paddle.y + engine.paddle.height;
        const paddleLeft = engine.paddle.x - engine.paddle.width / 2;
        const paddleRight = engine.paddle.x + engine.paddle.width / 2;

        // Balls update & collision
        for (let i = engine.balls.length - 1; i >= 0; i--) {
          const ball = engine.balls[i];

          if (!engine.ballAttached) {
            ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 0.6 });
            if (ball.trail.length > 8) ball.trail.pop();

            ball.x += ball.vx;
            ball.y += ball.vy;

            // Side wall collision
            if (ball.x - ball.radius <= 0) {
              ball.x = ball.radius;
              ball.vx = Math.abs(ball.vx);
              sound.playWallHit();
            } else if (ball.x + ball.radius >= CANVAS_WIDTH) {
              ball.x = CANVAS_WIDTH - ball.radius;
              ball.vx = -Math.abs(ball.vx);
              sound.playWallHit();
            }

            // Top wall collision
            if (ball.y - ball.radius <= 0) {
              ball.y = ball.radius;
              ball.vy = Math.abs(ball.vy);
              sound.playWallHit();
            }

            // Paddle collision
            if (
              ball.vy > 0 &&
              ball.y + ball.radius >= paddleTop &&
              ball.y - ball.radius <= paddleBottom &&
              ball.x + ball.radius >= paddleLeft &&
              ball.x - ball.radius <= paddleRight
            ) {
              ball.y = paddleTop - ball.radius - 0.5;

              const hitOffset = (ball.x - engine.paddle.x) / (engine.paddle.width / 2);
              const clampedOffset = Math.max(-0.92, Math.min(0.92, hitOffset));

              const maxDeflection = Math.PI * 0.38;
              const angle = clampedOffset * maxDeflection;

              let paddleSpeedInfluence = 0;
              if (moveLeft) paddleSpeedInfluence = -1.3;
              if (moveRight) paddleSpeedInfluence = 1.3;

              const maxAllowedSpeed = (10.0 + engine.levelIndex * 0.4) * engine.perks.ballSpeedFactor;
              const currentSpeed = Math.min(maxAllowedSpeed, ball.speed + 0.06);
              ball.speed = currentSpeed;
              ball.vx = currentSpeed * Math.sin(angle) + paddleSpeedInfluence;
              ball.vy = -Math.abs(currentSpeed * Math.cos(angle));

              if (Math.abs(ball.vy) < currentSpeed * 0.35) {
                ball.vy = -currentSpeed * 0.35;
              }

              if (engine.combo > 0) {
                engine.combo = 0;
                setCombo(0);
              }

              sound.playPaddleHit(clampedOffset);

              // Launch stacked counter missiles!
              if (engine.perks.counterBombCount > 0) {
                launchCounterMissiles(ball.x, paddleTop - 4);
              }

              for (let p = 0; p < 6; p++) {
                engine.particles.push({
                  x: ball.x,
                  y: paddleTop,
                  vx: (Math.random() - 0.5) * 4,
                  vy: -Math.random() * 3 - 1,
                  size: 2,
                  color: '#67E8F9',
                  alpha: 1,
                  life: 0,
                  maxLife: 15,
                });
              }
            }

            // Block collisions
            for (let bIdx = 0; bIdx < engine.blocks.length; bIdx++) {
              const blk = engine.blocks[bIdx];
              if (blk.hp <= 0) continue;

              const closestX = Math.max(blk.x, Math.min(ball.x, blk.x + blk.width));
              const closestY = Math.max(blk.y, Math.min(ball.y, blk.y + blk.height));
              const distX = ball.x - closestX;
              const distY = ball.y - closestY;
              const distSq = distX * distX + distY * distY;

              if (distSq <= ball.radius * ball.radius) {
                const prevX = ball.x - ball.vx;
                const prevY = ball.y - ball.vy;

                const isPierce = ball.isPenetrating || (Math.random() < engine.perks.pierceChance);

                if (!isPierce) {
                  const wasLeft = prevX + ball.radius <= blk.x;
                  const wasRight = prevX - ball.radius >= blk.x + blk.width;
                  const wasAbove = prevY + ball.radius <= blk.y;
                  const wasBelow = prevY - ball.radius >= blk.y + blk.height;

                  if (wasLeft || wasRight) {
                    ball.vx = -ball.vx;
                  } else if (wasAbove || wasBelow) {
                    ball.vy = -ball.vy;
                  } else {
                    if (Math.abs(distX) > Math.abs(distY)) {
                      ball.vx = -ball.vx;
                    } else {
                      ball.vy = -ball.vy;
                    }
                  }
                } else {
                  spawnBlockParticles(closestX, closestY, '#EF4444', 8);
                }

                blk.hp -= 1;
                blk.isShaking = 6;
                engine.combo += 1;
                setCombo(engine.combo);
                if (engine.combo > engine.maxCombo) {
                  engine.maxCombo = engine.combo;
                  setMaxCombo(engine.combo);
                }

                const comboMultiplier = Math.min(5, 1 + (engine.combo - 1) * 0.25);
                const basePoints = Math.round(blk.score * comboMultiplier);
                const pointsEarned = Math.round(basePoints * engine.perks.scoreMultiplier);

                if (blk.hp <= 0) {
                  engine.score += pointsEarned;
                  engine.remainingBlocks--;
                  setScore(engine.score);

                  sound.playBlockDestroy(blk.type === 'explosive' || blk.type === 'armored');
                  spawnBlockParticles(blk.x + blk.width / 2, blk.y + blk.height / 2, blk.color, 16);

                  const comboText = engine.combo > 1 ? `+${pointsEarned} (x${engine.combo})` : `+${pointsEarned}`;
                  addFloatingText(comboText, blk.x + blk.width / 2, blk.y + blk.height / 2, blk.accentColor);

                  if (blk.type === 'explosive') {
                    triggerExplosion(blk.x + blk.width / 2, blk.y + blk.height / 2);
                  }

                  if (Math.random() < engine.perks.shockwaveChance) {
                    triggerShockwave(blk.x + blk.width / 2, blk.y + blk.height / 2);
                  }

                  if (Math.random() < engine.perks.chainLightningChance) {
                    triggerChainLightning(blk);
                  }

                  const dropChance = 0.22 * engine.perks.dropRateMultiplier;
                  if (blk.type === 'bonus' || Math.random() < dropChance) {
                    spawnPowerUp(blk.x + blk.width / 2, blk.y + blk.height / 2);
                  }
                } else {
                  sound.playBlockHit(engine.combo);
                  spawnBlockParticles(closestX, closestY, blk.accentColor, 6);
                  engine.score += Math.round(20 * engine.perks.scoreMultiplier);
                  setScore(engine.score);
                }

                break;
              }
            }

            // Stacked Safety Barrier Check at bottom floor!
            if (ball.y + ball.radius >= CANVAS_HEIGHT - 10 && engine.safetyBarrierRemaining > 0) {
              engine.safetyBarrierRemaining--;
              ball.y = CANVAS_HEIGHT - 16;
              ball.vy = -Math.abs(ball.speed) * 0.95;
              sound.playBarrier();
              addFloatingText(`バリア防御! (残 ${engine.safetyBarrierRemaining}回)`, ball.x, CANVAS_HEIGHT - 35, '#06B6D4');
              for (let p = 0; p < 16; p++) {
                engine.particles.push({
                  x: ball.x + (Math.random() - 0.5) * 40,
                  y: CANVAS_HEIGHT - 8,
                  vx: (Math.random() - 0.5) * 6,
                  vy: -Math.random() * 4 - 2,
                  size: 3,
                  color: '#22D3EE',
                  alpha: 1,
                  life: 0,
                  maxLife: 20,
                });
              }
            }

            // Ball lost below paddle
            if (ball.y - ball.radius > CANVAS_HEIGHT) {
              engine.balls.splice(i, 1);
            }
          }
        }

        // If all balls lost
        if (engine.balls.length === 0) {
          engine.lives -= 1;
          setLives(engine.lives);
          sound.playLifeLost();

          if (engine.lives <= 0) {
            sound.playGameOver();
            setGameState('GAME_OVER');
            engine.gameState = 'GAME_OVER';
          } else {
            engine.ballAttached = true;
            const lvlSpeed = engine.currentBaseSpeed;
            engine.balls = [
              createBall(
                engine.paddle.x,
                engine.paddle.y - (BALL_BASE_RADIUS + engine.perks.ballRadiusBonus) - 1,
                0,
                -lvlSpeed,
                lvlSpeed,
                false
              ),
            ];
          }
        }

        // Check Round Clear -> Trigger 3-Choice Upgrade Selection
        if (engine.remainingBlocks <= 0) {
          sound.playStageClear();
          const stageBonus = (engine.levelIndex + 1) * 1000 + engine.lives * 500;
          engine.score += Math.round(stageBonus * engine.perks.scoreMultiplier);
          setScore(engine.score);

          const randomUpgrades = getRandomUpgrades(3);
          setUpgradeChoices(randomUpgrades);

          setGameState('UPGRADE_SELECTION');
          engine.gameState = 'UPGRADE_SELECTION';
        }

        // Power-ups update
        for (let pIdx = engine.powerUps.length - 1; pIdx >= 0; pIdx--) {
          const item = engine.powerUps[pIdx];
          item.y += item.vy;

          if (
            item.y >= paddleTop &&
            item.y <= paddleBottom + 10 &&
            item.x >= paddleLeft &&
            item.x <= paddleRight
          ) {
            applyPowerUp(item.type, item.label);
            engine.powerUps.splice(pIdx, 1);
            continue;
          }

          if (item.y > CANVAS_HEIGHT + 30) {
            engine.powerUps.splice(pIdx, 1);
          }
        }

        // Particles update
        for (let pIdx = engine.particles.length - 1; pIdx >= 0; pIdx--) {
          const pt = engine.particles[pIdx];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vy += 0.12;
          pt.life++;
          pt.alpha = 1 - pt.life / pt.maxLife;
          if (pt.life >= pt.maxLife) {
            engine.particles.splice(pIdx, 1);
          }
        }

        // Floating texts update
        for (let fIdx = engine.floatingTexts.length - 1; fIdx >= 0; fIdx--) {
          const ft = engine.floatingTexts[fIdx];
          ft.y += ft.vy;
          ft.alpha -= 0.022;
          if (ft.alpha <= 0) {
            engine.floatingTexts.splice(fIdx, 1);
          }
        }
      }

      // 2. RENDER CANVAS
      ctx.save();
      if (engine.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * engine.screenShake, (Math.random() - 0.5) * engine.screenShake);
        engine.screenShake *= 0.85;
        if (engine.screenShake < 0.5) engine.screenShake = 0;
      }

      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < CANVAS_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Safety Barrier line at Bottom Floor (shown if remaining > 0)
      if (engine.safetyBarrierRemaining > 0) {
        ctx.save();
        ctx.shadowColor = '#06B6D4';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT - 6);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 6);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Blocks
      engine.blocks.forEach((blk) => {
        if (blk.hp <= 0) return;

        let drawX = blk.x;
        let drawY = blk.y;
        if (blk.isShaking && blk.isShaking > 0) {
          drawX += (Math.random() - 0.5) * blk.isShaking;
          drawY += (Math.random() - 0.5) * blk.isShaking;
          blk.isShaking--;
        }

        ctx.save();
        ctx.fillStyle = blk.color;
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, blk.width, blk.height, 4);
        ctx.fill();

        ctx.fillStyle = blk.accentColor;
        ctx.beginPath();
        ctx.roundRect(drawX + 2, drawY + 2, blk.width - 4, 3, 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.roundRect(drawX + 2, drawY + blk.height - 4, blk.width - 4, 3, 2);
        ctx.fill();

        if (blk.type === 'bonus') {
          ctx.fillStyle = '#FFF';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', drawX + blk.width / 2, drawY + blk.height / 2 + 1);
        } else if (blk.type === 'explosive') {
          ctx.fillStyle = '#FFF';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💥', drawX + blk.width / 2, drawY + blk.height / 2);
        } else if (blk.type === 'tough') {
          if (blk.hp === 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(drawX + blk.width * 0.3, drawY + 4);
            ctx.lineTo(drawX + blk.width * 0.5, drawY + blk.height * 0.5);
            ctx.lineTo(drawX + blk.width * 0.7, drawY + blk.height - 4);
            ctx.stroke();
          }
        } else if (blk.type === 'armored') {
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.arc(drawX + 6, drawY + blk.height / 2, 2.5, 0, Math.PI * 2);
          ctx.arc(drawX + blk.width - 6, drawY + blk.height / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
          if (blk.hp < 3) {
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(drawX + blk.width * 0.4, drawY + 4);
            ctx.lineTo(drawX + blk.width * 0.6, drawY + blk.height - 4);
            ctx.stroke();
          }
        }

        ctx.restore();
      });

      // Draw Laser Bolts
      engine.laserBolts.forEach((bolt) => {
        ctx.save();
        ctx.shadowColor = bolt.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = bolt.color;
        ctx.beginPath();
        ctx.roundRect(bolt.x - bolt.width / 2, bolt.y, bolt.width, bolt.height, 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Rockets
      engine.rockets.forEach((rkt) => {
        ctx.save();
        ctx.shadowColor = '#EC4899';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#F472B6';
        ctx.beginPath();
        ctx.arc(rkt.x, rkt.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Power-Up items falling
      engine.powerUps.forEach((item) => {
        ctx.save();
        ctx.shadowColor = item.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.roundRect(item.x - 14, item.y - 10, 28, 20, 6);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.iconName, item.x, item.y);
        ctx.restore();
      });

      // Draw Paddle
      const paddle = engine.paddle;
      const paddleX = paddle.x - paddle.width / 2;
      ctx.save();

      ctx.shadowColor = paddle.isExpanded ? '#38BDF8' : '#10B981';
      ctx.shadowBlur = 12;

      const paddleGrad = ctx.createLinearGradient(paddleX, paddle.y, paddleX, paddle.y + paddle.height);
      paddleGrad.addColorStop(0, paddle.isExpanded ? '#38BDF8' : '#34D399');
      paddleGrad.addColorStop(0.5, paddle.isExpanded ? '#0284C7' : '#059669');
      paddleGrad.addColorStop(1, paddle.isExpanded ? '#0369A1' : '#047857');
      ctx.fillStyle = paddleGrad;

      ctx.beginPath();
      ctx.roundRect(paddleX, paddle.y, paddle.width, paddle.height, paddle.height / 2);
      ctx.fill();

      // Center indicator pip
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(paddle.x, paddle.y + paddle.height / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Top glossy highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.roundRect(paddleX + 8, paddle.y + 2, Math.max(10, paddle.width - 16), 3, 1.5);
      ctx.fill();

      // Laser cannons visual indicators on paddle if laser blaster perk active
      if (engine.perks.laserBlasterLevel > 0) {
        ctx.fillStyle = engine.perks.laserBlasterLevel >= 2 ? '#38BDF8' : '#F43F5E';
        ctx.beginPath();
        ctx.arc(paddle.x - paddle.width * 0.38, paddle.y, 3, 0, Math.PI * 2);
        ctx.arc(paddle.x + paddle.width * 0.38, paddle.y, 3, 0, Math.PI * 2);
        if (engine.perks.laserBlasterLevel >= 2) {
          ctx.arc(paddle.x - paddle.width * 0.15, paddle.y, 2.5, 0, Math.PI * 2);
          ctx.arc(paddle.x + paddle.width * 0.15, paddle.y, 2.5, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      ctx.restore();

      // Draw Ball Trails & Balls
      engine.balls.forEach((ball) => {
        ball.trail.forEach((t, idx) => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(t.x, t.y, ball.radius * (1 - idx * 0.08), 0, Math.PI * 2);
          ctx.fillStyle = ball.isPenetrating
            ? `rgba(248, 113, 113, ${t.alpha * 0.4})`
            : `rgba(255, 255, 255, ${t.alpha * 0.3})`;
          ctx.fill();
          ctx.restore();
        });

        ctx.save();
        ctx.shadowColor = ball.isPenetrating ? '#EF4444' : '#67E8F9';
        ctx.shadowBlur = 14;

        const ballGrad = ctx.createRadialGradient(
          ball.x - 2,
          ball.y - 2,
          1,
          ball.x,
          ball.y,
          ball.radius
        );
        if (ball.isPenetrating) {
          ballGrad.addColorStop(0, '#FFFFFF');
          ballGrad.addColorStop(0.4, '#F87171');
          ballGrad.addColorStop(1, '#DC2626');
        } else {
          ballGrad.addColorStop(0, '#FFFFFF');
          ballGrad.addColorStop(0.3, '#E0F2FE');
          ballGrad.addColorStop(1, '#38BDF8');
        }

        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Particles
      engine.particles.forEach((pt) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Floating Texts
      engine.floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      // Ball attached prompt
      if (engine.gameState === 'PLAYING' && engine.ballAttached) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SPACEキー または 画面タップでボールを発射', CANVAS_WIDTH / 2, PADDLE_Y - 30);
        ctx.restore();
      }

      ctx.restore(); // restore screenShake translate

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const threat = getThreatDetails(levelIndex);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100 antialiased select-none">
      {/* 3-ZONE TOP BAR CONTRACT */}
      <header className="flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 md:px-8 backdrop-blur-md">
        {/* Zone 1: Single Brand Wordmark */}
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-white md:text-lg">
            ブロック崩し Arcade
          </span>
        </div>

        {/* Zone 2: Clean Typography HUD Indicators */}
        <div className="flex items-center gap-2.5 text-xs md:gap-5 md:text-sm">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>ラウンド</span>
            <span className="font-mono font-semibold tabular-nums text-white">
              {levelIndex + 1}
            </span>
          </div>

          <span className="text-slate-700" aria-hidden="true">·</span>

          {/* Threat Level Indicator */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 hidden sm:inline">脅威度:</span>
            <span
              className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border"
              style={{
                color: threat.color,
                borderColor: `${threat.color}40`,
                backgroundColor: `${threat.color}15`,
              }}
            >
              {threat.label} {threat.stars}
            </span>
          </div>

          <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>スコア</span>
            <span className="font-mono font-bold tabular-nums text-amber-400">
              {score.toLocaleString()}
            </span>
          </div>

          <span className="text-slate-700 hidden md:inline" aria-hidden="true">·</span>

          <div className="hidden md:flex items-center gap-1.5 text-slate-400">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span>ハイスコア</span>
            <span className="font-mono tabular-nums text-slate-300">
              {highScore.toLocaleString()}
            </span>
          </div>

          <span className="text-slate-700" aria-hidden="true">·</span>

          {/* Lives display */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
              <Heart key={i} className="h-4 w-4 fill-rose-500 text-rose-500" />
            ))}
            {lives === 0 && <span className="text-xs text-rose-400 font-mono">0</span>}
          </div>
        </div>

        {/* Zone 3: 1-2 Primary Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            title={isMuted ? 'サウンドをONにする' : 'サウンドをOFFにする'}
            aria-label="Sound Toggle"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>

          {gameState === 'PLAYING' && (
            <button
              onClick={() => setGameState('PAUSED')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="ポーズ"
              aria-label="Pause"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => setShowHowTo(!showHowTo)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            title="遊び方"
            aria-label="How to play"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ACTIVE POWER-UP BANNER / COMBO HUD / ACTIVE UPGRADES WITH STACK COUNTS */}
      <div className="flex min-h-7 items-center justify-between px-4 sm:px-6 py-1 text-xs text-slate-400 bg-slate-900/40 border-b border-slate-800/40">
        <div className="flex items-center gap-2">
          {combo > 1 ? (
            <span className="flex items-center gap-1 font-mono font-bold text-amber-400">
              <Flame className="h-3.5 w-3.5 text-orange-500 animate-pulse" />
              {combo} COMBO! (x{Math.min(5, 1 + (combo - 1) * 0.25).toFixed(1)})
            </span>
          ) : (
            <span className="text-slate-500">連続ヒットでコンボ倍率UP！</span>
          )}

          {activePowerUpName && (
            <>
              <span className="text-slate-700">·</span>
              <span className="flex items-center gap-1 font-semibold text-sky-400 animate-pulse">
                <Zap className="h-3.5 w-3.5" />
                {activePowerUpName}
              </span>
            </>
          )}
        </div>

        {/* Acquired permanent upgrades count & stacked badges */}
        <div className="flex items-center gap-2">
          {acquiredUpgrades.length > 0 && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[11px] text-slate-500">習得能力:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {acquiredUpgrades.map((item) => (
                  <span
                    key={item.option.id}
                    title={`${item.option.title} (x${item.count}): ${item.option.description}`}
                    className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700"
                  >
                    <span className="scale-75 origin-center">{renderUpgradeIcon(item.option.icon)}</span>
                    {item.count > 1 && <span className="font-mono text-[9px] font-bold text-emerald-400">x{item.count}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GAMEPLAY VIEWPORT */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-2 sm:p-4">
        {/* Game Canvas Container */}
        <div className="relative w-full max-w-[800px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/80">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            className="block w-full h-auto aspect-[4/3] cursor-none touch-none"
          />

          {/* TITLE MENU OVERLAY */}
          {gameState === 'TITLE_MENU' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm p-6 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                ブロック崩し <span className="text-emerald-400">ARCADE</span>
              </h1>
              <p className="mt-3 max-w-md text-sm text-slate-400 leading-relaxed">
                全パワーアップが何回でも重複可能！
                <br />
                <strong className="text-amber-400 font-normal">
                  ワイドパドルも連射レーザー砲も重ねて取得して究極のビルドを完成させましょう！
                </strong>
              </p>

              {/* Instructions summary */}
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-slate-300">
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-4 py-2.5">
                  <span className="font-semibold text-emerald-400">← → または A / D</span>
                  <div className="text-slate-400 mt-0.5">バーを左右に移動</div>
                </div>
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-4 py-2.5">
                  <span className="font-semibold text-amber-400">パワーアップ重複スタック</span>
                  <div className="text-slate-400 mt-0.5">同じ能力を重ねて超強化</div>
                </div>
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-4 py-2.5">
                  <span className="font-semibold text-sky-400">スペース / クリック</span>
                  <div className="text-slate-400 mt-0.5">ボールを発射</div>
                </div>
              </div>

              <button
                onClick={startGame}
                className="mt-8 flex items-center gap-2 rounded-lg bg-emerald-500 px-7 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:scale-105 active:scale-95"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                ゲームスタート
              </button>
            </div>
          )}

          {/* PAUSED OVERLAY */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">一時停止中</h2>
              <p className="mt-2 text-sm text-slate-400">いつでも再開できます</p>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setGameState('PLAYING')}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  <Play className="h-3.5 w-3.5 fill-slate-950" />
                  再開する
                </button>
                <button
                  onClick={restartLevel}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  ラウンドをやり直す
                </button>
              </div>
            </div>
          )}

          {/* ROUND CLEAR - 3-CHOICE UPGRADE SELECTION MODAL */}
          {gameState === 'UPGRADE_SELECTION' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 sm:p-6 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                ROUND {levelIndex + 1} CLEAR!
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                パワーアップを選択
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-lg">
                すべての能力は何度でも重複して累積強化されます。
              </p>

              {/* 3 Upgrade Cards */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-2xl text-left">
                {upgradeChoices.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelectUpgrade(option)}
                    className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-4 transition-all duration-200 hover:border-emerald-500/70 hover:bg-slate-850 hover:shadow-xl hover:shadow-emerald-500/10 active:scale-[0.98] text-left cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: `${option.color}25`, color: option.color }}
                        >
                          {renderUpgradeIcon(option.icon)}
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {option.subtitle}
                        </span>
                      </div>

                      <h3 className="mt-3 text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {option.title}
                      </h3>

                      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                        {option.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                      <span>この能力を強化獲得</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GAME OVER OVERLAY */}
          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-rose-500 sm:text-4xl">
                GAME OVER
              </h2>
              <p className="mt-2 text-sm text-slate-400">すべてのボールを失いました</p>

              <div className="mt-4 rounded-lg bg-slate-900 border border-slate-800 p-4 text-xs text-slate-300 w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">最終スコア</span>
                  <span className="font-mono font-bold text-white tabular-nums">{score.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">到達ラウンド</span>
                  <span className="font-mono font-semibold text-slate-200">ROUND {levelIndex + 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">到達脅威度</span>
                  <span className="font-mono font-semibold" style={{ color: threat.color }}>{threat.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">最大コンボ</span>
                  <span className="font-mono text-amber-400 tabular-nums">{maxCombo}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <span className="text-slate-400">ハイスコア</span>
                  <span className="font-mono font-bold text-amber-400 tabular-nums">{highScore.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={startGame}
                className="mt-6 flex items-center gap-2 rounded-lg bg-rose-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-400 hover:scale-105"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                もう一度遊ぶ
              </button>
            </div>
          )}
        </div>

        {/* ON-SCREEN CONTROLS FOR MOBILE / TABLET OR EASY TOUCH ACCESS */}
        <div className="mt-3 flex w-full max-w-[800px] items-center justify-between gap-3 px-2">
          <button
            onPointerDown={() => { engineRef.current.touchLeft = true; }}
            onPointerUp={() => { engineRef.current.touchLeft = false; }}
            onPointerLeave={() => { engineRef.current.touchLeft = false; }}
            className="flex-1 flex h-12 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/90 text-slate-200 active:bg-slate-700 active:text-white transition-colors"
            aria-label="左へ移動"
          >
            <ChevronLeft className="h-6 w-6" />
            <span className="text-xs font-semibold ml-1">左 (←)</span>
          </button>

          <button
            onClick={() => {
              if (gameState === 'PLAYING') launchBall();
              else if (gameState === 'TITLE_MENU') startGame();
              else if (gameState === 'GAME_OVER') startGame();
            }}
            className="flex-1 flex h-12 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/40 text-emerald-400 active:bg-emerald-800 active:text-white transition-colors"
            aria-label="発射"
          >
            <span className="text-xs font-bold">発射 (SPACE)</span>
          </button>

          <button
            onPointerDown={() => { engineRef.current.touchRight = true; }}
            onPointerUp={() => { engineRef.current.touchRight = false; }}
            onPointerLeave={() => { engineRef.current.touchRight = false; }}
            className="flex-1 flex h-12 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/90 text-slate-200 active:bg-slate-700 active:text-white transition-colors"
            aria-label="右へ移動"
          >
            <span className="text-xs font-semibold mr-1">右 (→)</span>
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* HOW TO PLAY MODAL */}
        {showHowTo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">遊び方 & 重複強化システム</h3>
                <button
                  onClick={() => setShowHowTo(false)}
                  className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-slate-800"
                >
                  閉じる
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
                <div>
                  <h4 className="font-semibold text-emerald-400">操作方法</h4>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-slate-400">
                    <li><strong className="text-slate-200">矢印キー (← →) または A / D:</strong> バーを左右に移動</li>
                    <li><strong className="text-slate-200">マウス / タッチ:</strong> 画面上でバーを直接操作可能</li>
                    <li><strong className="text-slate-200">スペースキー / タップ:</strong> ボールを発射</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-amber-400">パワーアップの重複スタック</h4>
                  <p className="mt-1 text-slate-400">
                    すべてのアップグレードは同じ能力を<strong className="text-slate-200">何度でも重ねて取得可能</strong>です。パドルが画面の半分を覆う超ワイド化や、レーザー砲の多砲門化、開幕5個以上のボール一斉発射など、思い通りの極限ビルドを構築できます！
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-sky-400">難易度上昇</h4>
                  <p className="mt-1 text-slate-400">
                    ラウンドが進むにつれてボール速度が加速し、頑丈な装甲ブロックや動く防壁が出現。強化したビルドで突き破りましょう。
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowHowTo(false)}
                className="mt-6 w-full rounded-lg bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                理解しました
              </button>
            </div>
          </div>
        )}
      </main>

      {/* QUIET FOOTER */}
      <footer className="flex h-10 items-center justify-between border-t border-slate-800/60 px-6 text-xs text-slate-500">
        <div>矢印キー・マウス・タッチ対応</div>
        <div>パワーアップ重複スタック対応 · スピード感重視</div>
      </footer>
    </div>
  );
}
