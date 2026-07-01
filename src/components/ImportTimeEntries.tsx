'use client';

import { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { importExcelTimeEntriesAction, ExcelImportEntry } from '@/app/actions';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import CustomSelect from './CustomSelect';

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

type Props = {
  employees: Profile[] | null;
};

// Helper to convert Excel date/time or string time to HH:mm:ss format
function parseTime(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'string') {
    // Expecting formats like "08:00" or "8:00"
    const match = val.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const h = match[1].padStart(2, '0');
      const m = match[2];
      return `${h}:${m}:00`;
    }
  }
  if (typeof val === 'number') {
    // Excel time fraction (e.g., 0.3333 = 08:00)
    let totalSeconds = Math.round(val * 24 * 3600);
    const h = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return null;
}

function parseDate(serial: any, contextYear: number, contextMonth: number): string | null {
  if (serial && !isNaN(Number(serial))) {
    const val = Number(serial);
    if (val > 1000) {
      // It's an Excel serial date
      const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      const y = jsDate.getUTCFullYear();
      const m = jsDate.getUTCMonth() + 1;
      const d = jsDate.getUTCDate();
      return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    } else {
      // It's a literal day of the month
      return `${contextYear}-${contextMonth.toString().padStart(2, '0')}-${val.toString().padStart(2, '0')}`;
    }
  }
  return null;
}

export default function ImportTimeEntries({ employees }: Props) {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ month: string; count: number } | null>(null);
  const [entriesToImport, setEntriesToImport] = useState<ExcelImportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setPreview(null);
    setEntriesToImport([]);
    
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      setFile(f);
      
      try {
        const data = await f.arrayBuffer();
        const workbook = xlsx.read(data, { type: 'array' });
        
        let allEntries: ExcelImportEntry[] = [];
        let monthName = '';
        
        // Months defined in the template
        const monthSheets = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        
        monthSheets.forEach((mName, index) => {
          const sheet = workbook.Sheets[mName];
          if (!sheet) return;
          
          monthName = mName;
          const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true });
          
          if (rows.length < 4) return;
          
          let contextYear = new Date().getFullYear();
          let contextMonth = index + 1; // 1-12
          
          if (rows[0] && rows[0][0] && typeof rows[0][0] === 'string') {
            const yearMatch = rows[0][0].match(/\d{4}/);
            if (yearMatch) contextYear = parseInt(yearMatch[0], 10);
          }
          
          // Data rows start at index 3
          for (let i = 3; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 2) continue;
            
            const dayStr = row[1];
            if (!dayStr || isNaN(Number(dayStr))) continue; // Skip non-day rows
            
            const dateStr = parseDate(dayStr, contextYear, contextMonth);
            if (!dateStr) continue;
            
            const startTime1 = parseTime(row[3]);
            const endTime1 = parseTime(row[4]);
            const startTime2 = parseTime(row[5]);
            const endTime2 = parseTime(row[6]);
            const pauseVal = row[7];
            const absenceCode = row[9] ? String(row[9]).trim() : null;
            const note = row[14] ? String(row[14]).trim() : null;
            
            let breakMinutes = 0;
            if (typeof pauseVal === 'string' && pauseVal.includes(':')) {
              const parts = pauseVal.split(':');
              breakMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            } else if (typeof pauseVal === 'number') {
               breakMinutes = Math.round(pauseVal * 24 * 60);
            }
            
            if (startTime1 || absenceCode) {
              allEntries.push({
                date: dateStr,
                startTime: startTime1,
                endTime: endTime1,
                breakMinutes: breakMinutes,
                absenceCode: absenceCode,
                note: note
              });
            }
            
            if (startTime2) {
              allEntries.push({
                date: dateStr,
                startTime: startTime2,
                endTime: endTime2,
                breakMinutes: 0,
                absenceCode: null,
                note: null
              });
            }
          }
        });
        
        if (allEntries.length > 0) {
          setPreview({ month: 'Alle gefundenen Blätter', count: allEntries.length });
          setEntriesToImport(allEntries);
        } else {
          setMessage({ text: 'Keine gültigen Zeiterfassungen in der Datei gefunden.', type: 'error' });
        }
        
      } catch (err: any) {
        setMessage({ text: `Fehler beim Lesen der Datei: ${err.message}`, type: 'error' });
      }
    }
  };

  const handleImport = async () => {
    if (!selectedUser) {
      setMessage({ text: 'Bitte wähle zuerst einen Mitarbeiter aus.', type: 'error' });
      return;
    }
    
    if (entriesToImport.length === 0) {
      setMessage({ text: 'Keine Daten zum Importieren vorhanden.', type: 'error' });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const res = await importExcelTimeEntriesAction(selectedUser, entriesToImport);
      if (res.success) {
        setMessage({ text: res.message, type: 'success' });
        setEntriesToImport([]);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFile(null);
      } else {
        setMessage({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: `Serverfehler: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!employees || employees.length === 0) {
    return <div className="card p-4">Keine Mitarbeiter gefunden.</div>;
  }

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Upload size={20} className="text-primary" />
        Zeiten aus Excel importieren
      </h3>
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
        Wähle eine Excel-Vorlage (.xlsx) aus, die Monatsblätter (z.B. "Januar") enthält, und weise sie einem Mitarbeiter zu. 
        Achtung: Vorhandene Daten für den importierten Zeitraum des Mitarbeiters werden überschrieben!
      </p>

      {message && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          color: message.type === 'error' ? 'var(--color-error)' : 'var(--color-success)',
        }}>
          {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ fontSize: '0.875rem' }}>{message.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>1. Mitarbeiter wählen</label>
          <CustomSelect
            value={selectedUser}
            onChange={setSelectedUser}
            options={[
              { value: '', label: '-- Mitarbeiter auswählen --' },
              ...employees.map(emp => ({ value: emp.id, label: `${emp.last_name}, ${emp.first_name} (${emp.email})` }))
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>2. Excel-Datei hochladen</label>
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="input"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {preview && (
        <div style={{ background: 'var(--color-background)', padding: '1rem', borderRadius: '0.5rem', border: '1px dashed var(--color-border)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>Vorschau</h4>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
            {preview.count} Datensätze gefunden ({preview.month})
          </p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button 
          className="btn btn-primary" 
          onClick={handleImport}
          disabled={!selectedUser || entriesToImport.length === 0 || loading}
        >
          {loading ? 'Importiert...' : 'Zeiten importieren'}
        </button>
      </div>
    </div>
  );
}
