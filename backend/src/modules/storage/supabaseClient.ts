import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertStorageEnabled, getStorageConfig } from '../../config/storageEnv';

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const config = assertStorageEnabled();
  if (!client) {
    client = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
}

export function storageBucket(): string {
  return getStorageConfig().bucket;
}

export function resetSupabaseClientForTests(): void {
  client = null;
}
