const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyze() {
  const { data: profiles } = await supabase.from('profiles').select('*');
  const andre = profiles.find(p => p.first_name === 'Andre' && p.last_name === 'Reitz');
  
  if (!andre) {
    console.log("Andre Reitz not found.");
    return;
  }
  
  const { data: tsSets } = await supabase.from('timesheet_settings').select('*').eq('user_id', andre.id).eq('year', 2026);
  const tsSet = tsSets[0];
  console.log("Carry Over Hours:", tsSet?.carry_over_hours);

  // Get entries
  const { data: entries, error: err } = await supabase.from('time_entries').select('*').eq('user_id', andre.id);
  if (err) console.error("Entries Error:", err);
  
  const { data: payouts, error: pErr } = await supabase.from('overtime_payouts').select('*').eq('user_id', andre.id);
  if (pErr) console.error("Payouts Error:", pErr);
  
  const validEntries = (entries || []).filter(e => e.deleted_at === null);
  
  console.log("Total valid entries for Andre:", validEntries.length);
  
  let runningBalance = tsSet?.carry_over_hours || 0;
  
  // To match the sheet exactly, I need target hours for each month.
  // Assuming 144 target hours per month from the user's screenshot. 
  // Wait! Let's just output actuals and let me see if they match the user's excel sheet.
  for (let m = 1; m <= 6; m++) {
    const mmStr = String(m).padStart(2, '0');
    const monthEntries = validEntries.filter(e => e.entry_date.startsWith(`2026-${mmStr}-`));
    
    let actualHours = 0;
    monthEntries.forEach(e => {
        if (e.start_time && e.end_time && !e.absence_code) {
            const sh = parseInt(e.start_time.split(':')[0]);
            const sm = parseInt(e.start_time.split(':')[1]);
            const eh = parseInt(e.end_time.split(':')[0]);
            const em = parseInt(e.end_time.split(':')[1]);
            
            let startMin = sh * 60 + sm;
            let endMin = eh * 60 + em;
            if (endMin < startMin) endMin += 24 * 60; // overnight
            let duration = (endMin - startMin - (e.break_minutes || 0)) / 60;
            actualHours += duration;
        }
    });

    const monthPayouts = (payouts || []).filter(p => p.year === 2026 && p.month === m);
    const payoutTotal = monthPayouts.reduce((sum, p) => sum + p.hours, 0);
    
    console.log(`Month: ${m}`);
    console.log(`IST Arbeitszeit (approx): ${actualHours}`);
    console.log(`Ausgezahlt: ${payoutTotal}`);
    console.log('---');
  }
}

analyze();
