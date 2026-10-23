// 游戏注册表：新增游戏只需在此加一项，并在 app/games/<slug>/page.tsx 放入口
export type GameEntry = { slug: string; name: string; nameZh: string; icon: string; desc: string; status: "live" | "soon" };
export const GAMES: GameEntry[] = [
  { slug: "color-jewel-sort", name: "Color Jewel Sort", nameZh: "宝石像素拼图", icon: "💎", desc: "把打乱的宝石移回对应底色，拼出像素画。无计时，轻松解压。", status: "live" },
  { slug: "sniper", name: "Sniper", nameZh: "暗夜狙击", icon: "🎯", desc: "按住瞄准、松开射击，爆头加分。无计时。", status: "live" },
  { slug: "water-sort", name: "Water Sort", nameZh: "倒水排序", icon: "🧪", desc: "敬请期待", status: "soon" },
  { slug: "block-jam", name: "Block Jam", nameZh: "方块消除", icon: "🧱", desc: "敬请期待", status: "soon" },
];
