// Supabase/PostgREST corta cualquier consulta a 1000 filas por defecto, sin avisar.
// Esta funcion pide los datos por paginas hasta traerlos todos.
export async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error || !data) break
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}
