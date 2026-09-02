// Logos oficiales de cada equipo, servidos por el CDN publico de ESPN.
// No requiere llave y usa las mismas abreviaturas que ya usamos para sincronizar partidos.
// Usamos el "combiner" de ESPN para pedir la imagen ya redimensionada a 100px:
// la ruta base /500/ es la que sabemos que existe para TODOS los equipos (la
// que ya usabamos antes), pero el combiner la reescala del lado del servidor
// antes de mandarla, asi que llega mucho mas liviana sin arriesgar que algun
// equipo no tenga una variante de tamano chico publicada directamente.
export function teamLogoUrl(abbr: string): string {
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png&w=100&h=100`
}
