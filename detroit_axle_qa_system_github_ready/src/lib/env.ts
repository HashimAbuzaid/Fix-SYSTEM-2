const fallbackSupabaseUrl = 'https://twhsnbyrsitqkosjxssh.supabase.co';
const fallbackSupabaseAnonKey = 'sb_publishable_77x1moWHVtXmxLriCDae5g_QjXGwDdx';

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl,
  supabaseAnonKey:
    import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey,
};
