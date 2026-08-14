export function calcPoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): number {
  const predWinner = predHome === predAway ? 'TIE' : predHome > predAway ? 'HOME' : 'AWAY'
  const actualWinner = actualHome === actualAway ? 'TIE' : actualHome > actualAway ? 'HOME' : 'AWAY'

  if (predWinner !== actualWinner) return 0

  const exact = predHome === actualHome && predAway === actualAway
  return exact ? 3 : 1
}
