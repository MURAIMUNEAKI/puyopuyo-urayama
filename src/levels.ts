import { Block, BlockType } from './types';

export interface LevelConfig {
  name: string;
  subtitle: string;
  threatLevel: 'NORMAL' | 'HARD' | 'EXPERT' | 'INFERNO';
  ballBaseSpeed: number;
  hasMovingBlocks?: boolean;
  layout: (number | string)[][]; // 0: empty, 1-6: colors, T: tough (2 hits), A: armored (3 hits), B: bonus, E: explosive
}

const PALETTE: Record<string, { color: string; accent: string; maxHp: number; type: BlockType; score: number }> = {
  '1': { color: '#EF4444', accent: '#F87171', maxHp: 1, type: 'normal', score: 100 }, // Red
  '2': { color: '#F97316', accent: '#FB923C', maxHp: 1, type: 'normal', score: 90 },  // Orange
  '3': { color: '#FACC15', accent: '#FEF08A', maxHp: 1, type: 'normal', score: 80 },  // Yellow
  '4': { color: '#10B981', accent: '#34D399', maxHp: 1, type: 'normal', score: 70 },  // Green
  '5': { color: '#06B6D4', accent: '#38BDF8', maxHp: 1, type: 'normal', score: 60 },  // Cyan
  '6': { color: '#8B5CF6', accent: '#A78BFA', maxHp: 1, type: 'normal', score: 50 },  // Purple
  'T': { color: '#64748B', accent: '#94A3B8', maxHp: 2, type: 'tough', score: 200 },  // Tough (2 hits)
  'A': { color: '#334155', accent: '#CBD5E1', maxHp: 3, type: 'armored', score: 350 }, // Armored (3 hits)
  'B': { color: '#F59E0B', accent: '#FDE047', maxHp: 1, type: 'bonus', score: 150 },   // Bonus (Drops powerup)
  'E': { color: '#E11D48', accent: '#FDA4AF', maxHp: 1, type: 'explosive', score: 250 }, // Explosive
};

export const LEVELS: LevelConfig[] = [
  {
    name: 'STAGE 1',
    subtitle: '初級: スピードブレイク',
    threatLevel: 'NORMAL',
    ballBaseSpeed: 6.8,
    layout: [
      ['1', '1', 'E', '1', '1', 'E', '1', '1'],
      ['2', 'B', '2', '2', '2', '2', 'B', '2'],
      ['3', '3', '3', 'E', 'E', '3', '3', '3'],
    ],
  },
  {
    name: 'STAGE 2',
    subtitle: '中級: ダイヤモンド・ラッシュ',
    threatLevel: 'NORMAL',
    ballBaseSpeed: 7.3,
    layout: [
      [0, 0, '1', 'B', 'B', '1', 0, 0],
      [0, '2', 'E', 'T', 'T', 'E', '2', 0],
      ['3', '4', '4', 'E', 'E', '4', '4', '3'],
      [0, 0, '5', 'B', 'B', '5', 0, 0],
    ],
  },
  {
    name: 'STAGE 3',
    subtitle: '上級: アーマード・バリケード',
    threatLevel: 'HARD',
    ballBaseSpeed: 7.8,
    layout: [
      ['A', '1', 'A', 'E', 'E', 'A', '1', 'A'],
      ['2', 'T', 'B', 'A', 'A', 'B', 'T', '2'],
      ['E', '3', 'A', 'E', 'E', 'A', '3', 'E'],
    ],
  },
  {
    name: 'STAGE 4',
    subtitle: '特級: ムービング・フォートレス',
    threatLevel: 'EXPERT',
    ballBaseSpeed: 8.3,
    hasMovingBlocks: true,
    layout: [
      ['A', 'A', 'E', 'B', 'B', 'E', 'A', 'A'],
      [0, 'T', 'A', '1', '1', 'A', 'T', 0],
      ['3', 'E', 'B', 'A', 'A', 'B', 'E', '3'],
      [0, '4', '5', 'T', 'T', '5', '4', 0],
    ],
  },
  {
    name: 'STAGE 5',
    subtitle: '地獄級: インフェルノ・コア',
    threatLevel: 'INFERNO',
    ballBaseSpeed: 8.8,
    hasMovingBlocks: true,
    layout: [
      ['A', 'E', 'A', 'T', 'T', 'A', 'E', 'A'],
      ['B', 'A', 'E', 'A', 'A', 'E', 'A', 'B'],
      ['3', 'T', 'A', 'E', 'E', 'A', 'T', '3'],
    ],
  },
];

export function getThreatDetails(levelIndex: number): { label: string; color: string; stars: string } {
  if (levelIndex < 2) return { label: 'NORMAL', color: '#10B981', stars: '★☆☆' };
  if (levelIndex < 4) return { label: 'HARD', color: '#F59E0B', stars: '★★☆' };
  if (levelIndex < 6) return { label: 'EXPERT', color: '#EF4444', stars: '★★★' };
  return { label: 'INFERNO', color: '#A855F7', stars: '💀 極悪' };
}

export function buildBlocksForLevel(
  levelIndex: number,
  canvasWidth: number,
  canvasHeight: number
): { blocks: Block[]; totalDestructible: number; ballBaseSpeed: number; hasMovingBlocks: boolean } {
  let config: LevelConfig;
  const stageNum = levelIndex + 1;

  if (levelIndex < LEVELS.length) {
    config = LEVELS[levelIndex];
  } else {
    // Endless escalating nightmare stages!
    const rows = 3;
    const cols = 8;
    const dynamicLayout: (string | number)[][] = [];

    // Probability of armored and tough blocks increases with stage
    const armoredChance = Math.min(0.5, 0.2 + (stageNum - 5) * 0.06);
    const toughChance = 0.25;

    for (let r = 0; r < rows; r++) {
      const row: (string | number)[] = [];
      for (let c = 0; c < cols; c++) {
        const rand = Math.random();
        if (rand < 0.15) {
          row.push(0);
        } else if (rand < 0.32) {
          row.push('E');
        } else if (rand < 0.45) {
          row.push('B');
        } else if (rand < 0.45 + armoredChance) {
          row.push('A'); // High armored ratio in deep rounds
        } else if (rand < 0.45 + armoredChance + toughChance) {
          row.push('T');
        } else {
          row.push(String(Math.floor(Math.random() * 5) + 1));
        }
      }
      dynamicLayout.push(row);
    }

    const calculatedSpeed = Math.min(11.2, 8.8 + (stageNum - 5) * 0.35);
    config = {
      name: `STAGE ${stageNum}`,
      subtitle: `ナイトメア・ラッシュ Lv.${stageNum}`,
      threatLevel: stageNum >= 7 ? 'INFERNO' : 'EXPERT',
      ballBaseSpeed: calculatedSpeed,
      hasMovingBlocks: stageNum >= 4,
      layout: dynamicLayout,
    };
  }

  const rows = config.layout.length;
  const cols = config.layout[0].length;
  const marginTop = 75;
  const marginSide = 45;
  const spacingX = 10;
  const spacingY = 10;

  const totalWidth = canvasWidth - marginSide * 2;
  const blockWidth = (totalWidth - (cols - 1) * spacingX) / cols;
  const blockHeight = 24;

  const blocks: Block[] = [];
  let totalDestructible = 0;

  for (let r = 0; r < rows; r++) {
    // Top row moves if hasMovingBlocks is true
    const isMovingRow = config.hasMovingBlocks && (r === 0 || r === 1);
    const rowDirection = r % 2 === 0 ? 1 : -1;
    const speed = isMovingRow ? (0.7 + levelIndex * 0.1) * rowDirection : 0;

    for (let c = 0; c < cols; c++) {
      const val = config.layout[r][c];
      if (val === 0 || val === '0') continue;

      const key = String(val);
      const def = PALETTE[key] || PALETTE['1'];
      const x = marginSide + c * (blockWidth + spacingX);
      const y = marginTop + r * (blockHeight + spacingY);

      blocks.push({
        id: `block-${r}-${c}-${stageNum}`,
        x,
        y,
        width: blockWidth,
        height: blockHeight,
        maxHp: def.maxHp,
        hp: def.maxHp,
        color: def.color,
        accentColor: def.accent,
        type: def.type,
        score: def.score,
        isShaking: 0,
        vx: speed,
        minX: Math.max(15, x - 35),
        maxX: Math.min(canvasWidth - blockWidth - 15, x + 35),
      });

      totalDestructible++;
    }
  }

  return {
    blocks,
    totalDestructible,
    ballBaseSpeed: config.ballBaseSpeed,
    hasMovingBlocks: !!config.hasMovingBlocks,
  };
}
