'use client';

import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Trash2, Download, Power, PowerOff } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function QRCodeAdminTab({ qrCodes, companyId, refreshData }: { qrCodes: any[], companyId: string, refreshData: () => void }) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  
  const qrRefs = useRef<{ [key: string]: SVGSVGElement | null }>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newNote.trim()) return;
    
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from('qr_codes').insert({
      company_id: companyId,
      name: newName,
      note_text: newNote
    });
    
    if (error) {
      alert(error.message);
    } else {
      setNewName('');
      setNewNote('');
      refreshData();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('QR-Code wirklich löschen?')) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from('qr_codes').delete().eq('id', id);
    if (error) {
      alert(error.message);
    } else {
      refreshData();
    }
    setLoading(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from('qr_codes').update({ is_active: !currentStatus }).eq('id', id);
    if (error) {
      alert(error.message);
    } else {
      refreshData();
    }
    setLoading(false);
  };

  const downloadQRCode = (id: string, name: string) => {
    const svg = qrRefs.current[id];
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      // Add padding and text to the canvas
      canvas.width = img.width + 40;
      canvas.height = img.height + 80;
      
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        
        ctx.fillStyle = "black";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(name, canvas.width / 2, canvas.height - 20);
      }
      
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${name.replace(/\s+/g, '_')}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const getScanUrl = (id: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/scan?code=${id}`;
    }
    return `/scan?code=${id}`;
  };

  return (
    <div className="admin-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>QR-Code Verwaltung</h2>
      </div>
      
      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {qrCodes.map((qr) => (
            <div key={qr.id} style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '12px', 
              padding: '1.5rem',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <h3 style={{ fontWeight: 600, textAlign: 'center', margin: 0, opacity: qr.is_active ? 1 : 0.5 }}>{qr.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
                Notiz: {qr.note_text}
              </p>
              
              <div style={{ padding: '1rem', background: 'white', borderRadius: '8px' }}>
                <QRCodeSVG 
                  id={`qr-${qr.id}`}
                  value={getScanUrl(qr.id)} 
                  size={150} 
                  ref={(el) => { if (el) qrRefs.current[qr.id] = el; }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <button 
                  onClick={() => downloadQRCode(qr.id, qr.name)}
                  className="btn-secondary" 
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Download size={16} />
                </button>
                <button 
                  onClick={() => handleToggleActive(qr.id, qr.is_active)}
                  className="btn-secondary" 
                  style={{ color: qr.is_active ? 'var(--warning)' : 'var(--success)', padding: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  title={qr.is_active ? "Deaktivieren" : "Aktivieren"}
                  disabled={loading}
                >
                  {qr.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                </button>
                <button 
                  onClick={() => handleDelete(qr.id)}
                  className="btn-secondary" 
                  style={{ color: 'var(--danger)', padding: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  title="Löschen"
                  disabled={loading}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          
          {qrCodes.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Keine QR-Codes vorhanden. Erstelle den ersten Code auf der rechten Seite.
            </div>
          )}
        </div>
        
        <div>
          <div style={{ 
            background: 'var(--bg-card)', 
            borderRadius: '12px', 
            padding: '1.5rem',
            border: '1px solid var(--border-color)',
            position: 'sticky',
            top: '2rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Neuen Code erstellen</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Name (Ort/Position)</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="input-field" 
                  placeholder="z.B. Auto 1"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Notiz (für Zeiterfassung)</label>
                <input 
                  type="text" 
                  value={newNote} 
                  onChange={e => setNewNote(e.target.value)}
                  className="input-field" 
                  placeholder="z.B. Fahrt zum Kunden"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={loading || !newName.trim() || !newNote.trim()}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
              >
                <Plus size={16} /> Code Generieren
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
