/**
 * Supabase Connectivity Diagnostics
 *
 * Use this to debug loading state issues and verify Supabase is working.
 * Call from your screen's useEffect or add to a debug menu.
 */

import { supabase } from './supabase';
import * as clientsService from './services/clients';
import * as leadsService from './services/leads';

export async function testSupabaseConnection(): Promise<void> {
  console.log('\n=== Supabase Diagnostics Start ===\n');

  try {
    // Test 1: Check environment variables
    console.log('[Test 1] Checking environment variables...');
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    console.log('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING');
    console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'MISSING');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    console.log('✅ Environment variables found\n');

    // Test 2: Check Supabase client
    console.log('[Test 2] Testing Supabase client...');
    console.log('Supabase client exists:', !!supabase);
    console.log('✅ Supabase client initialized\n');

    // Test 3: Test basic query with clients service
    console.log('[Test 3] Testing clients service.getAll()...');
    const clients = await clientsService.getAll();
    console.log('✅ Clients query succeeded, received', clients.length, 'records\n');

    // Test 4: Test leads service
    console.log('[Test 4] Testing leads service.getAll()...');
    const leads = await leadsService.getAll();
    console.log('✅ Leads query succeeded, received', leads.length, 'records\n');

    // Test 5: Summary
    console.log('=== All Tests Passed ===');
    console.log('Supabase connectivity: ✅ OK');
    console.log('Clients data: ✅', clients.length, 'records');
    console.log('Leads data: ✅', leads.length, 'records');
    console.log('=== Diagnostics Complete ===\n');

  } catch (error) {
    console.error('\n❌ Diagnostics Failed');
    console.error('Error:', error);
    console.error('\nTroubleshooting steps:');
    console.error('1. Check .env file has EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
    console.error('2. Verify Supabase project is running');
    console.error('3. Check firewall/network settings');
    console.error('4. Verify RLS policies allow anon access');
    console.error('\n=== Diagnostics Complete ===\n');
  }
}

export async function debugLoadingState(screenName: string): Promise<void> {
  console.log(`\n[${screenName}] Testing Supabase queries...`);
  try {
    const startTime = Date.now();
    const result = await clientsService.getAll();
    const duration = Date.now() - startTime;
    console.log(`[${screenName}] ✅ Query completed in ${duration}ms, got ${result.length} records`);
  } catch (error) {
    console.error(`[${screenName}] ❌ Query failed:`, error);
  }
}

