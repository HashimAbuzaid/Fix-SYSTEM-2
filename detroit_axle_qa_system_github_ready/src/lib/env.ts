function requireEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY') {
  const value = import.meta.env[name];

  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

export const env = {
  supabaseUrl: requireEnv('https://twhsnbyrsitqkosjxssh.supabase.co'),
  supabaseAnonKey: requireEnv('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3aHNuYnlyc2l0cWtvc2p4c3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTEwMjksImV4cCI6MjA5MDg4NzAyOX0.oKSG-jg-fe5yKYDNrtOyi0r4tzsGiQsALd9gS1mcdp4'),
};
