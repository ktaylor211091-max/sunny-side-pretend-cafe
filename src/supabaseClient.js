import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function isHttpUrl(value) {
	try {
		const parsed = new URL(value.trim())
		return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname)
	} catch {
		return false
	}
}

export const supabaseConfigWarning = Boolean(
	(url || anonKey) && (!url || !anonKey || !isHttpUrl(url)),
)
export const supabase = url && anonKey && !supabaseConfigWarning
	? createClient(url.trim(), anonKey.trim())
	: null