import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .in('entry_date', ['2026-01-07', '2026-01-09', '2026-01-10', '2026-01-15'])
    .order('entry_date');
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

main();
