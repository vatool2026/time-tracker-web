import { isGermanHoliday } from './holidays';

export interface ComplianceViolation {
  date: string;
  type: string;
  description: string;
  severity: 'error' | 'warning';
}

export interface EmployeeViolationResult {
  employee: any;
  violations: ComplianceViolation[];
}

export function calculateComplianceViolations(
  employees: any[],
  allCompanyEntries: any[],
  allCategorySettings: any[],
  companyState?: string,
  companyHolidays?: any[]
): EmployeeViolationResult[] {
  if (!employees || !allCompanyEntries || !allCategorySettings) return [];

  const result = employees.map(emp => {
    const settings = allCategorySettings.find(s => s.category === emp.employment_category) || {
      compliance_max_hours_enabled: true,
      compliance_max_hours: 10,
      compliance_rest_period_enabled: true,
      compliance_rest_period_hours: 11,
      compliance_break_enabled: true,
      compliance_sunday_holiday_enabled: true
    };

    const isMinor = emp.is_minor === true;

    const maxHoursEnabled = settings.compliance_max_hours_enabled ?? true;
    const maxHours = settings.compliance_max_hours ?? 10;
    const restPeriodEnabled = settings.compliance_rest_period_enabled ?? true;
    const restPeriodHours = settings.compliance_rest_period_hours ?? 11;
    const breakEnabled = settings.compliance_break_enabled ?? true;
    const sundayHolidayEnabled = settings.compliance_sunday_holiday_enabled ?? true;

    const empEntries = allCompanyEntries
      .filter(e => e.user_id === emp.id && !e.deleted_at && e.end_time && !e.absence_code)
      .sort((a, b) => {
        const dateComp = b.entry_date.localeCompare(a.entry_date);
        if (dateComp !== 0) return dateComp;
        return (b.start_time || '').localeCompare(a.start_time || '');
      });

    const violations: ComplianceViolation[] = [];

    for (let i = 0; i < empEntries.length; i++) {
      const entry = empEntries[i];
      
      let netWorkedHours = 0;
      let startD: Date | null = null;
      let endD: Date | null = null;
      
      if (entry.start_time && entry.end_time) {
        startD = new Date(`${entry.entry_date}T${entry.start_time}`);
        endD = new Date(`${entry.entry_date}T${entry.end_time}`);
        if (endD < startD) {
          endD.setDate(endD.getDate() + 1);
        }
        const totalMs = endD.getTime() - startD.getTime();
        const rawHours = totalMs / (1000 * 60 * 60);
        netWorkedHours = Math.max(0, rawHours - ((entry.break_minutes || 0) / 60));
      }

      // 1. Max Hours Check
      if (maxHoursEnabled && netWorkedHours > maxHours) {
        violations.push({
          date: entry.entry_date,
          type: 'Maximale Arbeitszeit überschritten',
          description: `${netWorkedHours.toFixed(2)} Std. gearbeitet (Limit: ${maxHours} Std.)`,
          severity: 'error'
        });
      }

      // 2. Break Check
      if (breakEnabled && netWorkedHours > 0) {
        if (isMinor) {
          // JArbSchG
          if (netWorkedHours > 6 && (entry.break_minutes || 0) < 60) {
            violations.push({
              date: entry.entry_date,
              type: 'Pausenzeit unterschritten (JArbSchG)',
              description: `Arbeitszeit > 6 Std., aber nur ${entry.break_minutes || 0} Min. Pause (Gesetzlich: mind. 60 Min.)`,
              severity: 'error'
            });
          } else if (netWorkedHours > 4.5 && netWorkedHours <= 6 && (entry.break_minutes || 0) < 30) {
            violations.push({
              date: entry.entry_date,
              type: 'Pausenzeit unterschritten (JArbSchG)',
              description: `Arbeitszeit > 4,5 Std., aber nur ${entry.break_minutes || 0} Min. Pause (Gesetzlich: mind. 30 Min.)`,
              severity: 'error'
            });
          }
        } else {
          // ArbZG
          if (netWorkedHours > 9 && (entry.break_minutes || 0) < 45) {
            violations.push({
              date: entry.entry_date,
              type: 'Pausenzeit unterschritten (ArbZG)',
              description: `Arbeitszeit > 9 Std., aber nur ${entry.break_minutes || 0} Min. Pause (Gesetzlich: mind. 45 Min.)`,
              severity: 'error'
            });
          } else if (netWorkedHours > 6 && netWorkedHours <= 9 && (entry.break_minutes || 0) < 30) {
            violations.push({
              date: entry.entry_date,
              type: 'Pausenzeit unterschritten (ArbZG)',
              description: `Arbeitszeit > 6 Std., aber nur ${entry.break_minutes || 0} Min. Pause (Gesetzlich: mind. 30 Min.)`,
              severity: 'error'
            });
          }
        }
      }

      // 3. Sunday/Holiday Check
      if (sundayHolidayEnabled && startD) {
        const isSunday = startD.getDay() === 0;
        const isHoliday = isGermanHoliday(startD, companyState, companyHolidays).isHoliday;
        
        if (isSunday || isHoliday) {
          violations.push({
            date: entry.entry_date,
            type: 'Sonntags-/Feiertagsarbeit',
            description: `Arbeit am ${isSunday ? 'Sonntag' : 'Feiertag'} erfasst.`,
            severity: 'warning'
          });
        }
      }

      // 4. Rest Period Check
      if (restPeriodEnabled && i > 0 && endD) {
        const nextEntry = empEntries[i - 1]; // chronologically after
        // Skip rest period check if both entries are on the same day (considered a split shift with long break)
        if (entry.entry_date !== nextEntry.entry_date) {
          if (nextEntry.start_time) {
            const nextStartD = new Date(`${nextEntry.entry_date}T${nextEntry.start_time}`);
            if (nextStartD > endD) {
              const diffHours = (nextStartD.getTime() - endD.getTime()) / (1000 * 60 * 60);
              if (diffHours < restPeriodHours) {
                violations.push({
                  date: entry.entry_date,
                  type: 'Ruhezeit unterschritten',
                  description: `Nur ${diffHours.toFixed(1)} Std. Ruhezeit zwischen Schichtende (${entry.entry_date} ${entry.end_time.slice(0,5)}) und nächstem Beginn (${nextEntry.entry_date} ${nextEntry.start_time.slice(0,5)}). Minimum: ${restPeriodHours} Std.`,
                  severity: 'error'
                });
              }
            }
          }
        }
      }
    }

    return {
      employee: emp,
      violations: violations.sort((a, b) => b.date.localeCompare(a.date))
    };
  }).filter(r => r.violations.length > 0);

  return result;
}
