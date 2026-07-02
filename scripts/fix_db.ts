import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('time_entries')
    .update({ end_time: '00:00:00' })
    .eq('entry_date', '2026-01-15')
    .eq('start_time', '22:30:00')
    .eq('end_time', '22:30:00');
    
  if (error) console.error(error);
  else console.log('Fixed entries:', data);
}

main();
