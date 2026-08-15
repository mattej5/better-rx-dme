import 'server-only'

async function getOffsetSeconds(): Promise<number> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
    return 0
  }

  try {
    const { supabase } = await import('@/src/lib/supabase')
    const { data, error } = await supabase
      .from('demo_state')
      .select('clock_offset_seconds')
      .eq('id', 1)
      .maybeSingle()

    if (error || !data) return 0
    return data.clock_offset_seconds
  } catch {
    return 0
  }
}

export async function now(): Promise<Date> {
  return new Date(Date.now() + (await getOffsetSeconds()) * 1000)
}
