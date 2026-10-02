export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'STAGE_CLEAR' | 'UPGRADE_SELECTION' | 'GAME_OVER' | 'VICTORY';

export type BlockType = 'normal' | 'tough' | 'armored' | 'bonus' | 'explosive';

export type PowerUpType = 'expand' | 'multi_ball' | 'laser_ball' | 'slow_ball' | 'extra_life';

export interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  isPenetrating: boolean; // Laser ball goes through blocks
  trail: { x: number; y: number; alpha: number }[];
}

export interface Paddle {
  x: number; // center x
  y: number; // top y
  width: number;
  height: number;
  baseWidth: number;
  speed: number;
  isExpanded: boolean;
  expandTimer: number; // in frames or timestamp
}

export interface Block {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHp: number;
  hp: number;
  color: string;
  accentColor: string;
  type: BlockType;
  score: number;
  isShaking?: number;
  vx?: number;
  minX?: number;
  maxX?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface PowerUpItem {
  id: string;
  x: number;
  y: number;
  vy: number;
  type: PowerUpType;
  label: string;
  color: string;
  iconName: string;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  color: string;
  scale: number;
}

export interface LaserBolt {
  id: string;
  x: number;
  y: number;
  vy: number;
  width: number;
  height: number;
  color: string;
}

export interface RocketMissile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
