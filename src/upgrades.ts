export interface PlayerPerks {
  extraPaddleWidth: number;
  paddleSpeedMultiplier: number;
  scoreMultiplier: number;
  startBallsCount: number;
  dropRateMultiplier: number;
  pierceChance: number;
  shockwaveChance: number;
  ballSpeedFactor: number;
  ballRadiusBonus: number;
  laserBlasterLevel: number; // 0: none, 1: twin, 2: quad, 3+: rapid barrage
  safetyBarrierCharges: number; // Stacks: +1 save per round
  counterBombCount: number; // Stacks: 1, 2, 3 rockets on bounce
  openingBlastCount: number; // Stacks: 3, 6, 9 blocks destroyed
  chainLightningChance: number;
  quadSplitCount: number; // 0: normal 2-split, 1: 4-split, 2: 6-split
  startLaserDuration: number; // Stacks: +5s each
}

export const INITIAL_PERKS: PlayerPerks = {
  extraPaddleWidth: 0,
  paddleSpeedMultiplier: 1.0,
  scoreMultiplier: 1.0,
  startBallsCount: 1,
  dropRateMultiplier: 1.0,
  pierceChance: 0,
  shockwaveChance: 0,
  ballSpeedFactor: 1.0,
  ballRadiusBonus: 0,
  laserBlasterLevel: 0,
  safetyBarrierCharges: 0,
  counterBombCount: 0,
  openingBlastCount: 0,
  chainLightningChance: 0,
  quadSplitCount: 0,
  startLaserDuration: 0,
};

export interface UpgradeOption {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  apply: (perks: PlayerPerks, engine: any) => void;
}

export const UPGRADE_POOL: UpgradeOption[] = [
  {
    id: 'wide_paddle',
    title: 'ワイドフレーム',
    subtitle: 'パドル強化 (累積可能)',
    description: 'パドルの基本横幅がさらに +30px 拡大。重ねて取得するほど超巨大パドルに成長！',
    icon: 'Maximize2',
    color: '#38BDF8',
    apply: (perks) => {
      perks.extraPaddleWidth += 30;
    },
  },
  {
    id: 'nitro_paddle',
    title: 'ニトロスピード',
    subtitle: '機動性向上 (累積可能)',
    description: 'パドルの移動速度がさらに +30% 向上。重ねて取得するほど高速移動が可能に。',
    icon: 'Zap',
    color: '#FACC15',
    apply: (perks) => {
      perks.paddleSpeedMultiplier += 0.3;
    },
  },
  {
    id: 'extra_heart',
    title: 'ハートストック',
    subtitle: '耐久強化 (累積可能)',
    description: 'ライフが +1 増加。取得するたびに残機がどんどんストックされます。',
    icon: 'Heart',
    color: '#F43F5E',
    apply: (_, engine) => {
      engine.lives += 1;
    },
  },
  {
    id: 'twin_launch',
    title: 'マルチボール開幕',
    subtitle: '手数増加 (累積可能)',
    description: '各ラウンド開始時の発射ボール数が +1 個増加。重ねることで開幕から大弾幕に！',
    icon: 'Copy',
    color: '#4ADE80',
    apply: (perks) => {
      perks.startBallsCount += 1;
    },
  },
  {
    id: 'meteor_ball',
    title: 'メテオボール',
    subtitle: '巨弾化 (累積可能)',
    description: 'ボールの半径がさらに +4px 巨大化。重ねるほど超巨大ボールとなり一帯を粉砕！',
    icon: 'CircleDot',
    color: '#FB923C',
    apply: (perks) => {
      perks.ballRadiusBonus += 4;
    },
  },
  {
    id: 'laser_blaster',
    title: 'レーザーブラスター',
    subtitle: '自動迎撃 (強化重複)',
    description: 'パドルから自動で上空へレーザー砲を連射！重ねるほど砲門数と連射速度が向上。',
    icon: 'Crosshair',
    color: '#E11D48',
    apply: (perks) => {
      perks.laserBlasterLevel += 1;
    },
  },
  {
    id: 'opening_blast',
    title: '開幕爆破ミサイル',
    subtitle: '即時クリア支援 (累積可能)',
    description: 'ラウンド開始時、ランダムに 3 個のブロックを即座に爆破。重ねるほど爆破数増加！',
    icon: 'Bomb',
    color: '#F97316',
    apply: (perks) => {
      perks.openingBlastCount += 3;
    },
  },
  {
    id: 'chain_lightning',
    title: 'チェインサンダー',
    subtitle: '電撃連鎖 (確率累積)',
    description: 'ブロック命中時の電撃発生率が +35% 向上。重ねて100%発動の雷神ビルドへ！',
    icon: 'Zap',
    color: '#38BDF8',
    apply: (perks) => {
      perks.chainLightningChance = Math.min(1.0, perks.chainLightningChance + 0.35);
    },
  },
  {
    id: 'safety_barrier',
    title: 'セーフティバリア',
    subtitle: '落下防止 (ストック累積)',
    description: '底面にボール落下を防ぐバリアを展開。重ねるたびに防げる回数が +1 回増加！',
    icon: 'Shield',
    color: '#06B6D4',
    apply: (perks) => {
      perks.safetyBarrierCharges += 1;
    },
  },
  {
    id: 'counter_bomb',
    title: 'カウンターロケット',
    subtitle: '迎撃ミサイル (発射数累積)',
    description: 'ボールを打ち返すたびに上空へ迎撃ロケットを発射。重ねると斉射数が増加！',
    icon: 'Rocket',
    color: '#EC4899',
    apply: (perks) => {
      perks.counterBombCount += 1;
    },
  },
  {
    id: 'plasma_pierce',
    title: 'プラズマショット',
    subtitle: '貫通弾 (確率累積)',
    description: 'ボールがブロックを貫通する確率が +30% 向上。重ねて高確率貫通ボールに！',
    icon: 'Flame',
    color: '#EF4444',
    apply: (perks) => {
      perks.pierceChance = Math.min(0.95, perks.pierceChance + 0.3);
    },
  },
  {
    id: 'shockwave',
    title: 'ショックウェーブ',
    subtitle: '衝撃波 (確率累積)',
    description: 'ブロック破壊時の衝撃波発生率が +35% 向上。重ねて確定広域粉砕！',
    icon: 'Radio',
    color: '#2DD4BF',
    apply: (perks) => {
      perks.shockwaveChance = Math.min(1.0, perks.shockwaveChance + 0.35);
    },
  },
  {
    id: 'lucky_charm',
    title: 'ラッキードロップ',
    subtitle: 'アイテム補給 (倍率累積)',
    description: 'ブロック破壊時のアイテム出現率がさらに大幅アップ。アイテムの雨を降らせよう！',
    icon: 'Sparkles',
    color: '#EAB308',
    apply: (perks) => {
      perks.dropRateMultiplier += 1.5;
    },
  },
  {
    id: 'quad_split',
    title: 'クアッド分裂',
    subtitle: 'アイテム強化 (分裂数累積)',
    description: 'マルチボール獲得時の分裂数がさらに増加（4個→6個→8個へ倍増）。',
    icon: 'Layers',
    color: '#10B981',
    apply: (perks) => {
      perks.quadSplitCount += 1;
    },
  },
  {
    id: 'opening_frenzy',
    title: 'スタートダッシュ',
    subtitle: '開幕無双 (時間累積)',
    description: '各ラウンド開始直後の無敵貫通ファイヤーボール時間がさらに +5秒 延長！',
    icon: 'FastForward',
    color: '#F43F5E',
    apply: (perks) => {
      perks.startLaserDuration += 5;
    },
  },
  {
    id: 'score_boost',
    title: 'スコアブースト',
    subtitle: 'ハイスコア特化 (倍率累積)',
    description: 'ブロック破壊スコアがさらに +60% 加算。重ねて超高倍率スコアを叩き出せます。',
    icon: 'TrendingUp',
    color: '#A855F7',
    apply: (perks) => {
      perks.scoreMultiplier += 0.6;
    },
  },
];

// Randomly sample 3 distinct upgrades from the pool
export function getRandomUpgrades(count = 3): UpgradeOption[] {
  const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
