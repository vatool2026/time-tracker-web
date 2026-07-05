'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getMonthlyBalancesAction, closeEmployeeMonthAction } from '@/app/actions';
import { calculateComplianceViolations } from '@/utils/complianceCalculator';

export default function MonatsabschlussClient({ employees, company, currentUserId }: any) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()); // Default to previous month. (0-indexed in JS, but we will use 1-12)
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [categorySettings, setCategorySettings] = useState<any[]>([]);

  // We want month 1-12. If current is Jan (0), prev is Dec (12) of prev year.
  const [selectedYear, setSelectedYear] = useState(() => {
    const d = new Date();
    return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return d.getMonth() === 0 ? 12 : d.getMonth();
  });

  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [transferHours, setTransferHours] = useState(0);
  const [payOutHours, setPayOutHours] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    // Fetch time entries for the selected month
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`;
    
    const { data: entries } = await supabase
      .from('time_entries')
      .select('*')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);
      
    const { data: cats } = await supabase
      .from('category_settings')
      .select('*')
      .eq('company_id', company.id);

    setTimeEntries(entries || []);
    setCategorySettings(cats || []);

    const res = await getMonthlyBalancesAction(selectedYear, selectedMonth);
    if (res.success && res.data) {
      setBalances(res.data);
    }
    setLoading(false);
  };

  const openModal = (emp: any) => {
    setSelectedEmployee(emp);
    setTransferHours(0);
    setPayOutHours(0);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee) return;
    const res = await closeEmployeeMonthAction(
      selectedEmployee.id,
      selectedYear,
      selectedMonth,
      transferHours,
      payOutHours
    );
    if (res.success) {
      setIsModalOpen(false);
      fetchData(); // reload
    } else {
      alert(res.message);
    }
  };

  const calculateEmployeeStats = (emp: any) => {
    const empEntries = timeEntries.filter(e => e.user_id === emp.id && !e.deleted_at);
    
    let totalWorkedMs = 0;
    empEntries.forEach(e => {
      if (e.start_time && e.end_time) {
        let startD = new Date(`1970-01-01T${e.start_time}`);
        let endD = new Date(`1970-01-01T${e.end_time}`);
        if (endD < startD) {
          endD.setDate(endD.getDate() + 1);
        }
        totalWorkedMs += (endD.getTime() - startD.getTime()) - ((e.break_minutes || 0) * 60000);
      }
    });

    const totalHours = totalWorkedMs / (1000 * 60 * 60);
    const balance = balances.find(b => b.user_id === emp.id);
    
    // For Minijobbers roughly 43.3 hours target. In a real app we'd fetch the target from timesheet_settings
    let targetHours = emp.employment_category === 'MINIJOB' ? 43.3 : 160; 

    return {
      worked: totalHours,
      target: targetHours,
      overtime: totalHours - targetHours,
      balance: balance
    };
  };

  const violations = useMemo(() => {
    return calculateComplianceViolations(employees, timeEntries, categorySettings);
  }, [employees, timeEntries, categorySettings]);

  return (
  return (
    <div className="glass glass-card" style={{ padding: '2rem' }}>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
        <div style={{ flex: '1', maxWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Jahr</label>
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="custom-select"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)' }}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ flex: '1', maxWidth: '300px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Monat</label>
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            className="custom-select"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)' }}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i+1} value={i+1}>{i+1} - {new Date(2000, i, 1).toLocaleString('de', { month: 'long' })}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Lade Daten...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="stundenzettel-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Mitarbeiter</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Typ</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Ist-Stunden</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Soll (ca.)</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Differenz</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp: any) => {
                const stats = calculateEmployeeStats(emp);
                const hasViolations = violations.some(v => v.employee.id === emp.id);
                
                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                      {emp.last_name}, {emp.first_name}
                      {hasViolations && (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--danger)' }} title="Verstöße gefunden"></span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{emp.employment_category}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>{stats.worked.toFixed(2)}h</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{stats.target.toFixed(2)}h</td>
                    <td style={{ 
                      padding: '1rem', 
                      textAlign: 'center', 
                      fontWeight: 700, 
                      color: stats.overtime > 0 ? 'var(--success)' : stats.overtime < 0 ? 'var(--danger)' : 'var(--text-primary)' 
                    }}>
                      {stats.overtime > 0 ? '+' : ''}{stats.overtime.toFixed(2)}h
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {stats.balance ? (
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' }}>
                          Abgeschlossen
                        </span>
                      ) : (
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning)' }}>
                          Offen
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button 
                        onClick={() => openModal(emp)}
                        className={stats.balance ? "btn btn-secondary glass" : "btn btn-primary"}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        {stats.balance ? 'Bearbeiten' : 'Abschließen'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && selectedEmployee && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(5px)' }}>
          <div className="glass glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              Monatsabschluss: {selectedEmployee.first_name} {selectedEmployee.last_name}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Stunden in nächsten Monat übertragen (+/-)
                </label>
                <input 
                  type="number" 
                  step="0.5"
                  value={transferHours} 
                  onChange={e => setTransferHours(parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Auszahlen / Abgelten (Stunden)
                </label>
                <input 
                  type="number" 
                  step="0.5"
                  value={payOutHours} 
                  onChange={e => setPayOutHours(parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn btn-secondary glass"
              >
                Abbrechen
              </button>
              <button 
                onClick={handleSave}
                className="btn btn-primary"
              >
                Speichern & Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
