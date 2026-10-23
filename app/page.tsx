import Link from "next/link";
import { GAMES } from "@/lib/games";
export default function Hub() {
  return (<div className="app hub">
    <h1>Variant Games</h1><p className="sub">选择一个游戏开始玩 · 全部无计时</p>
    <div className="cards">{GAMES.map(g => g.status === "live"
      ? <Link key={g.slug} className="gc" href={`/games/${g.slug}`}><div className="ic">{g.icon}</div><b>{g.name}</b><small>{g.nameZh} · {g.desc}</small></Link>
      : <div key={g.slug} className="gc soon"><span className="tag">即将推出</span><div className="ic">{g.icon}</div><b>{g.name}</b><small>{g.nameZh} · {g.desc}</small></div>)}</div>
  </div>);
}
