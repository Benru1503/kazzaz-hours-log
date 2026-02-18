import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    enabled: false,
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ─── Raw fetch helper that NEVER hangs ───
// Bypasses supabase-js query builder entirely
export async function supabaseFetch(path, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers: extraHeaders = {},
    timeoutMs = 8000,
    single = false,
  } = options;

  // Get the current session token if available
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || supabaseAnonKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${supabaseUrl}/rest/v1/${path}`;
    const resp = await fetch(url, {
      method,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': single ? 'return=representation' : 'return=representation',
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: resp.statusText }));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    return single ? (Array.isArray(data) ? data[0] || null : data) : data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('הבקשה נכשלה (timeout) — נסה שוב');
    }
    throw err;
  }
}

// ─── RPC call helper ───
export async function supabaseRpc(functionName, params = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || supabaseAnonKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${supabaseUrl}/rest/v1/rpc/${functionName}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: resp.statusText }));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }

    return await resp.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('הבקשה נכשלה (timeout) — נסה שוב');
    }
    throw err;
  }
}