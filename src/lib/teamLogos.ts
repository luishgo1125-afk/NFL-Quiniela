// Logos oficiales de cada equipo, servidos por el CDN publico de ESPN.
// No requiere llave y usa las mismas abreviaturas que ya usamos para sincronizar partidos.
export function teamLogoUrl(abbr: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`
}
