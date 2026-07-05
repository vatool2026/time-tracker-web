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
    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl p-6">
      
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Jahr</label>
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="border rounded px-3 py-2 bg-transparent dark:border-zinc-700"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Monat</label>
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            className="border rounded px-3 py-2 bg-transparent dark:border-zinc-700"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i+1} value={i+1}>{i+1} - {new Date(2000, i, 1).toLocaleString('de', { month: 'long' })}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div>Lade Daten...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b dark:border-zinc-700 text-sm text-zinc-500">
                <th className="py-3 px-4 font-semibold">Mitarbeiter</th>
                <th className="py-3 px-4 font-semibold">Typ</th>
                <th className="py-3 px-4 font-semibold">Ist-Stunden</th>
                <th className="py-3 px-4 font-semibold">Soll (ca.)</th>
                <th className="py-3 px-4 font-semibold">Differenz</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp: any) => {
                const stats = calculateEmployeeStats(emp);
                const hasViolations = violations.some(v => v.employee.id === emp.id);
                
                return (
                  <tr key={emp.id} className="border-b dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="py-3 px-4 flex items-center gap-2">
                      {emp.last_name}, {emp.first_name}
                      {hasViolations && (
                        <span className="w-3 h-3 rounded-full bg-red-500" title="Verstöße gefunden"></span>
                      )}
                    </td>
                    <td className="py-3 px-4">{emp.employment_category}</td>
                    <td className="py-3 px-4 font-medium">{stats.worked.toFixed(2)}h</td>
                    <td className="py-3 px-4 text-zinc-500">{stats.target.toFixed(2)}h</td>
                    <td className={`py-3 px-4 font-medium ${stats.overtime > 0 ? 'text-green-600' : stats.overtime < 0 ? 'text-red-500' : ''}`}>
                      {stats.overtime > 0 ? '+' : ''}{stats.overtime.toFixed(2)}h
                    </td>
                    <td className="py-3 px-4">
                      {stats.balance ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">Abgeschlossen</span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">Offen</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button 
                        onClick={() => openModal(emp)}
                        className="px-3 py-1.5 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-800"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl w-full max-w-md border dark:border-zinc-800">
            <h3 className="text-lg font-bold mb-4">Monatsabschluss: {selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Stunden in nächsten Monat übertragen (+/-)</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={transferHours} 
                  onChange={e => setTransferHours(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-2 bg-transparent dark:border-zinc-700"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Auszahlen / Abgelten (Stunden)</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={payOutHours} 
                  onChange={e => setPayOutHours(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-2 bg-transparent dark:border-zinc-700"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Abbrechen
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
