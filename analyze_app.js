const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getEasterSunday(year) {
  const a = year % 19;
  const b = year % 4;
  const c = year % 7;
  const k = Math.floor(year / 100);
  const p = Math.floor((13 + 8 * k) / 25);
  const q = Math.floor(k / 4);
  const M = (15 - p + k - q) % 30;
  const N = (4 + k - q) % 7;
  const d = (19 * a + M) % 30;
  const e = (2 * b + 4 * c + 6 * d + N) % 7;
  
  let day = 22 + d + e;
  let month = 2; // March
  
  if (day > 31) {
    month = 3; // April
    day = day - 31;
  }

  if (month === 3 && day === 26) day = 19;
  if (month === 3 && day === 25 && d === 28 && e === 6 && a > 10) day = 18;

  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getGermanHolidays(year) {
  const holidays = new Map();
  holidays.set(`${year}-01-01`, 'Neujahr');
  holidays.set(`${year}-05-01`, 'Tag der Arbeit');
  holidays.set(`${year}-10-03`, 'Tag der Deutschen Einheit');
  holidays.set(`${year}-12-25`, '1. Weihnachtstag');
  holidays.set(`${year}-12-26`, '2. Weihnachtstag');

  const easterSunday = getEasterSunday(year);
  const karfreitag = addDays(easterSunday, -2);
  const ostermontag = addDays(easterSunday, 1);
  const christiHimmelfahrt = addDays(easterSunday, 39);
  const pfingstmontag = addDays(easterSunday, 50);
  const fronleichnam = addDays(easterSunday, 60);

  holidays.set(formatDateKey(karfreitag), 'Karfreitag');
  holidays.set(formatDateKey(ostermontag), 'Ostermontag');
  holidays.set(formatDateKey(christiHimmelfahrt), 'Christi Himmelfahrt');
  holidays.set(formatDateKey(pfingstmontag), 'Pfingstmontag');
  holidays.set(formatDateKey(fronleichnam), 'Fronleichnam');
  
  // Custom user holidays maybe? We will see.
  return holidays;
}

async function analyze() {
  const { data: profiles } = await supabase.from('profiles').select('*');
  const andre = profiles.find(p => p.first_name === 'Andre' && p.last_name === 'Reitz');
  
  const { data: tsSets } = await supabase.from('timesheet_settings').select('*').eq('user_id', andre.id).eq('year', 2026);
  const tsSet = tsSets[0];
  
  const { data: entries } = await supabase.from('time_entries').select('*').eq('user_id', andre.id).is('deleted_at', null);
  const { data: payouts } = await supabase.from('overtime_payouts').select('*').eq('user_id', andre.id);
  
  const activeEntriesByDate = new Map();
  entries.forEach(e => {
    if (!activeEntriesByDate.has(e.entry_date)) activeEntriesByDate.set(e.entry_date, []);
    activeEntriesByDate.get(e.entry_date).push(e);
  });

  const absenceCodes = { 'U': 0.0, 'UH': 0.5, 'K': 0.0, 'KR': 1.0, 'KU': 0.0, 'F': 0.0, 'G': 1.0, 'S': 0.0 };

  let cumulativeOvertime = tsSet.carry_over_hours || 0;

  for (let m = 0; m < 6; m++) { // Jan to Jun
    let monthTarget = 0;
    let monthActual = 0;
    
    const startDate = new Date(Date.UTC(2026, m, 1));
    const endDate = new Date(Date.UTC(2026, m + 1, 0));
    const holidays = getGermanHolidays(2026);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      // Check holiday
      let isHoliday = holidays.has(dateStr);
      
      let dayTarget = 0;
      if (!isHoliday) {
          const day = d.getDay();
          switch (day) {
            case 1: dayTarget = tsSet.target_hours_monday || 8; break;
            case 2: dayTarget = tsSet.target_hours_tuesday || 8; break;
            case 3: dayTarget = tsSet.target_hours_wednesday || 8; break;
            case 4: dayTarget = tsSet.target_hours_thursday || 8; break;
            case 5: dayTarget = tsSet.target_hours_friday || 8; break;
            case 6: dayTarget = tsSet.target_hours_saturday || 0; break;
            case 0: dayTarget = tsSet.target_hours_sunday || 0; break;
          }
      }
      
      let dayWorked = 0;
      const dayEntries = activeEntriesByDate.get(dateStr) || [];
      
      if (dayEntries.length > 0) {
        let codeFactor = 1.0;
        const codeStr = dayEntries[0].absence_code;
        if (codeStr && absenceCodes[codeStr] !== undefined) {
          codeFactor = absenceCodes[codeStr];
        }
        dayTarget = dayTarget * codeFactor;
        
        dayEntries.forEach(e => {
          if (!e.start_time || !e.end_time || e.absence_code) return;
          const sh = parseInt(e.start_time.split(':')[0]);
          const sm = parseInt(e.start_time.split(':')[1]);
          const eh = parseInt(e.end_time.split(':')[0]);
          const em = parseInt(e.end_time.split(':')[1]);
          let startMin = sh * 60 + sm;
          let endMin = eh * 60 + em;
          if (endMin < startMin) endMin += 24 * 60;
          dayWorked += (endMin - startMin - (e.break_minutes || 0)) / 60;
        });
      }
      
      monthTarget += dayTarget;
      monthActual += dayWorked;
    }
    
    const monthPayouts = payouts.filter(p => p.year === 2026 && p.month === m + 1);
    const payoutTotal = monthPayouts.reduce((sum, p) => sum + p.hours, 0);
    
    const monthOvertime = monthActual - monthTarget;
    cumulativeOvertime += monthOvertime - payoutTotal;
    
    console.log(`Month ${m+1}: SOLL: ${monthTarget}, IST: ${monthActual}, Ausgezahlt: ${payoutTotal}`);
    console.log(`ÜBERTRAG IN DEN NÄCHSTEN MONAT: ${cumulativeOvertime.toFixed(2)}`);
    console.log('---');
  }
}

analyze();
