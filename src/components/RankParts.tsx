import { teamLogoUrl } from '../lib/teamLogos'

export function RankAvatar({ name, team, size = 40 }: { name: string; team: string | null; size?: number }) {
  return (
    <div className="rk-av" style={{ width: size, height: size }}>
      {team ? <img src={teamLogoUrl(team)} alt={team} loading="lazy" /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </div>
  )
}

export interface PodiumItem {
  pos: 1 | 2 | 3
  name: string
  team: string | null
  isMe: boolean
  points: number
  line: string       // texto chico bajo los puntos
  extra?: string     // ej. premio
  badges?: React.ReactNode
  onClick?: () => void
}

// Podio: 2do - 1ro - 3ro (el 1ro mas grande y al centro)
export function Podium({ items }: { items: PodiumItem[] }) {
  const byPos = (p: number) => items.find((i) => i.pos === p)
  const order = [byPos(2), byPos(1), byPos(3)].filter(Boolean) as PodiumItem[]
  return (
    <div className="rk-podium" style={{ gridTemplateColumns: order.length === 3 ? undefined : `repeat(${order.length}, 1fr)` }}>
      {order.map((it) => {
        const Tag: any = it.onClick ? 'button' : 'div'
        return (
          <Tag key={it.pos} onClick={it.onClick} className={`rk-pod p${it.pos}${it.isMe ? ' me' : ''}`}>
            <span className="rk-medal">{it.pos}</span>
            <RankAvatar name={it.name} team={it.team} size={it.pos === 1 ? 68 : 52} />
            <span className="rk-pname">{it.name}{it.isMe && <em> (tú)</em>}</span>
            {it.badges && <span className="rk-pbadges">{it.badges}</span>}
            <span className="rk-ppts">{it.points}<small>pts</small></span>
            <span className="rk-pline">{it.line}</span>
            {it.extra && <span className="rk-pextra">{it.extra}</span>}
          </Tag>
        )
      })}
    </div>
  )
}
