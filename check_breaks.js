const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  const { data: profiles } = await supabase.from('profiles').select('*');
  const andre = profiles.find(p => p.first_name === 'Andre' && p.last_name === 'Reitz');
  
  const { data: entries } = await supabase.from('time_entries').select('*').eq('user_id', andre.id).is('deleted_at', null);
  
  let missingBreaksCount = 0;
  let missingBreaksTime = 0;
  
  entries.forEach(e => {
    if (!e.start_time || !e.end_time || e.absence_code) return;
    const sh = parseInt(e.start_time.split(':')[0]);
    const sm = parseInt(e.start_time.split(':')[1]);
    const eh = parseInt(e.end_time.split(':')[0]);
    const em = parseInt(e.end_time.split(':')[1]);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin < startMin) endMin += 24 * 60;
    
    const durationMins = endMin - startMin;
    const recordedBreak = e.break_minutes || 0;
    
    let requiredBreak = 0;
    if (durationMins > 9 * 60) requiredBreak = 45;
    else if (durationMins > 6 * 60) requiredBreak = 30;
    
    if (recordedBreak < requiredBreak) {
      const diff = requiredBreak - recordedBreak;
      missingBreaksCount++;
      missingBreaksTime += diff;
      console.log(`Date: ${e.entry_date}, Duration: ${durationMins/60}h, Recorded Break: ${recordedBreak}m, Required: ${requiredBreak}m, Missing: ${diff}m`);
    }
  });
  
  console.log(`\nTotal days with missing legal breaks: ${missingBreaksCount}`);
  console.log(`Total missing break time: ${missingBreaksTime} minutes (${missingBreaksTime/60} hours)`);
}

analyze();
