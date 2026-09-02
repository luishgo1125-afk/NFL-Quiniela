// Logos oficiales de cada equipo, servidos por el CDN publico de ESPN.
// No requiere llave y usa las mismas abreviaturas que ya usamos para sincronizar partidos.
// Pedimos la version de 100px: en toda la app el logo se muestra como maximo
// a 80px (w-20), asi que 100px alcanza de sobra hasta en pantallas retina,
// y pesa una fraccion de lo que pesaba la version de 500px que se usaba antes.
export function teamLogoUrl(abbr: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/100/${abbr.toLowerCase()}.png`
}
