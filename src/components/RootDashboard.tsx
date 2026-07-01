'use client';

import React, { useState, useMemo } from 'react';
import { deleteCompanyAction, deleteProfileAction, updateCompanyAction, updateProfileAction, resetUserPasswordAction, toggleUserLockAction } from '@/app/root/actions';
import { logoutAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import CustomSelect from './CustomSelect';
import ThemeToggle from './ThemeToggle';
import { LogOut, ChevronDown, ChevronUp, Search, Building, Lock, Unlock, Key, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { getEmploymentCategoryLabel } from '@/utils/employment';

export default function RootDashboard({ companies, profiles, rootProfile }: any) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editFeatureUrlaub, setEditFeatureUrlaub] = useState(false);
  const [editFeatureAbwesenheit, setEditFeatureAbwesenheit] = useState(false);
  const [editFeatureSonstiges, setEditFeatureSonstiges] = useState(false);

  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editProfileRole, setEditProfileRole] = useState('');
  const [editProfileCompany, setEditProfileCompany] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);

  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Unternehmen wirklich löschen? Alle zugehörigen Daten (außer User) werden gelöscht.')) return;
    setLoadingId(id);
    const res = await deleteCompanyAction(id);
    if (res.success) {
      alert('Unternehmen gelöscht');
      router.refresh();
    } else {
      alert(res.message);
    }
    setLoadingId(null);
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm('Benutzer wirklich löschen?')) return;
    setLoadingId(id);
    const res = await deleteProfileAction(id);
    if (res.success) {
      alert('Benutzer gelöscht');
      router.refresh();
    } else {
      alert(res.message);
    }
    setLoadingId(null);
  };

  const handleToggleLock = async (p: any) => {
    const isLocked = p.is_locked;
    if (!confirm(isLocked ? 'Benutzer entsperren?' : 'Benutzer wirklich sperren?')) return;
    setLoadingId(p.id);
    const res = await toggleUserLockAction(p.id, !isLocked);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.message);
    }
    setLoadingId(null);
  };

  const handleResetPassword = async (id: string) => {
    if (newPassword.length < 6) {
      alert('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    setLoadingId(id);
    const res = await resetUserPasswordAction(id, newPassword);
    if (res.success) {
      alert('Passwort erfolgreich geändert.');
      setResetPasswordId(null);
      setNewPassword('');
    } else {
      alert(res.message);
    }
    setLoadingId(null);
  };

  const startEditCompany = (e: React.MouseEvent, c: any) => {
    e.stopPropagation();
    setEditingCompany(c.id);
    setEditCompanyName(c.name);
    setEditFeatureUrlaub(c.feature_urlaub ?? false);
    setEditFeatureAbwesenheit(c.feature_abwesenheit ?? false);
    setEditFeatureSonstiges(c.feature_sonstiges ?? false);
  };

  const saveEditCompany = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setLoadingId(id);
      const res = await updateCompanyAction(id, { 
        name: editCompanyName,
        feature_urlaub: editFeatureUrlaub,
        feature_abwesenheit: editFeatureAbwesenheit,
        feature_sonstiges: editFeatureSonstiges
      });
      if (res?.success) {
        setEditingCompany(null);
        router.refresh();
      } else {
        alert(res?.message || 'Unbekannter Fehler beim Speichern');
      }
    } catch (err: any) {
      alert("Fehler beim Speichern: " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const cancelEditCompany = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCompany(null);
  };

  const startEditProfile = (p: any) => {
    setEditingProfile(p.id);
    setEditProfileRole(p.role);
    setEditProfileCompany(p.company_id || '');
  };

  const saveEditProfile = async (id: string) => {
    setLoadingId(id);
    const res = await updateProfileAction(id, { role: editProfileRole, company_id: editProfileCompany || null });
    if (res.success) {
      setEditingProfile(null);
      router.refresh();
    } else {
      alert(res.message);
    }
    setLoadingId(null);
  };

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return companies;
    return companies.filter((c: any) => {
      const matchCompany = c.name.toLowerCase().includes(q);
      const companyEmployees = profiles.filter((p: any) => p.company_id === c.id);
      const matchEmployee = companyEmployees.some((p: any) => 
        (p.first_name + ' ' + p.last_name).toLowerCase().includes(q) || 
        p.email.toLowerCase().includes(q)
      );
      return matchCompany || matchEmployee;
    });
  }, [companies, profiles, searchQuery]);

  const unassignedProfiles = useMemo(() => {
    return profiles.filter((p: any) => !p.company_id && (
      !searchQuery || 
      (p.first_name + ' ' + p.last_name).toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
    )).sort((a: any, b: any) => {
      const catA = getEmploymentCategoryLabel(a.employment_category || 'OTHER');
      const catB = getEmploymentCategoryLabel(b.employment_category || 'OTHER');
      if (catA < catB) return -1;
      if (catA > catB) return 1;
      const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
      const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [profiles, searchQuery]);

  const renderProfile = (p: any) => (
    <div key={p.id} style={{ 
      padding: '1rem', 
      background: 'rgba(255,255,255,0.02)', 
      borderBottom: '1px solid var(--border-color)', 
      display: 'flex',
      flexDirection: 'column',
      opacity: p.is_locked ? 0.6 : 1 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 250px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '1.1rem', flexShrink: 0 }}>
            {p.first_name?.charAt(0) || ''}{p.last_name?.charAt(0) || ''}
          </div>
          <div>
            <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', margin: 0 }}>
              {p.first_name} {p.last_name}
              {p.is_locked && <Lock size={14} color="var(--danger)" />}
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.email}</div>
          </div>
        </div>

        <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rolle</span>
          <span style={{ 
            fontSize: '0.75rem', 
            padding: '0.2rem 0.5rem', 
            borderRadius: '4px',
            background: p.role === 'ROOT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.15)',
            color: p.role === 'ROOT' ? 'var(--danger)' : 'var(--accent-secondary)',
            display: 'inline-block',
            width: 'fit-content',
            marginTop: '0.25rem'
          }}>
            {p.role}
          </span>
        </div>

        <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kategorie</span>
          <span style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {getEmploymentCategoryLabel(p.employment_category || 'OTHER')}
          </span>
        </div>

        <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Letzter Login</span>
          <span style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {p.last_login ? new Date(p.last_login).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nie'}
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === p.id ? null : p.id); }}
            className="btn-secondary"
            style={{ padding: '0.5rem', borderRadius: '50%', border: 'none', background: 'transparent', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <MoreVertical size={18} />
          </button>
          {openDropdownId === p.id && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }} />
              <div className="glass-dropdown" style={{ 
                position: 'absolute', right: 0, top: '100%', 
                padding: '0.5rem',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                minWidth: '200px',
                marginTop: '0.5rem'
              }}>
                <button className="dropdown-item" onClick={() => { setResetPasswordId(p.id); setNewPassword(''); setOpenDropdownId(null); }}>
                  <Key size={16} /> Passwort zurücksetzen
                </button>
                <button className="dropdown-item" onClick={() => { handleToggleLock(p); setOpenDropdownId(null); }} disabled={loadingId === p.id || p.id === rootProfile.id} style={{ color: p.is_locked ? 'var(--accent-primary)' : 'var(--warning)' }}>
                  {p.is_locked ? <Unlock size={16} /> : <Lock size={16} />} {p.is_locked ? 'Entsperren' : 'Sperren'}
                </button>
                <button className="dropdown-item" onClick={() => { startEditProfile(p); setOpenDropdownId(null); }}>
                  <Edit2 size={16} /> Bearbeiten
                </button>
                <button className="dropdown-item" onClick={() => { handleDeleteProfile(p.id); setOpenDropdownId(null); }} disabled={loadingId === p.id || p.id === rootProfile.id} style={{ color: 'var(--danger)' }}>
                  <Trash2 size={16} /> Löschen
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {resetPasswordId === p.id && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <input 
            type="text" 
            placeholder="Neues Passwort" 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            className="input-field" 
            style={{ flex: 1 }}
          />
          <button onClick={() => handleResetPassword(p.id)} className="btn-primary" disabled={loadingId === p.id}>Speichern</button>
          <button onClick={() => setResetPasswordId(null)} className="btn-secondary">Abbrechen</button>
        </div>
      )}

      {editingProfile === p.id && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Benutzer bearbeiten</h4>
          <CustomSelect
            value={editProfileRole}
            onChange={setEditProfileRole}
            options={[
              { value: 'ROOT', label: 'ROOT' },
              { value: 'COMPANY_ADMIN', label: 'COMPANY_ADMIN' },
              { value: 'EMPLOYEE', label: 'EMPLOYEE' }
            ]}
          />
          <CustomSelect
            value={editProfileCompany}
            onChange={setEditProfileCompany}
            options={[
              { value: '', label: 'Kein Unternehmen' },
              ...(companies.map((c: any) => ({ value: c.id, label: c.name })))
            ]}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={() => saveEditProfile(p.id)} className="btn-primary" disabled={loadingId === p.id}>Speichern</button>
            <button onClick={() => setEditingProfile(null)} className="btn-secondary">Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <header className="glass" style={{ 
        padding: '1rem 1.5rem', 
        marginBottom: '2rem',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="flex-center" style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--accent-gradient)',
            color: 'white',
            fontWeight: 700,
            fontSize: '1.2rem'
          }}>
            ZP
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>Zeiterfassung Pro</h1>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              System-Übersicht (ROOT)
            </span>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem', 
          marginLeft: 'auto' 
        }}>
          <div className="user-details" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '1rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Root Admin</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {rootProfile.email}
            </span>
          </div>

          <ThemeToggle />
          <button 
            onClick={() => logoutAction()} 
            className="btn-secondary glass" 
            style={{ padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            title="Abmelden"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="glass" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Unternehmen & Mitarbeiter</h2>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Suchen..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredCompanies.map((c: any) => {
            const companyEmployees = profiles
              .filter((p: any) => p.company_id === c.id)
              .sort((a: any, b: any) => {
                const catA = getEmploymentCategoryLabel(a.employment_category || 'OTHER');
                const catB = getEmploymentCategoryLabel(b.employment_category || 'OTHER');
                if (catA < catB) return -1;
                if (catA > catB) return 1;
                const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
                const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
                return nameA.localeCompare(nameB);
              });
            const isExpanded = expandedCompanyId === c.id;

            return (
              <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                {/* Company Header */}
                <div 
                  onClick={() => setExpandedCompanyId(isExpanded ? null : c.id)}
                  style={{ 
                    padding: '1rem 1.5rem', 
                    background: 'rgba(255,255,255,0.02)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Building size={20} color="var(--accent-primary)" />
                    <div>
                      {editingCompany === c.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                              value={editCompanyName} 
                              onChange={(e) => setEditCompanyName(e.target.value)} 
                              className="input-field" 
                              style={{ padding: '0.25rem 0.5rem', minHeight: 'auto' }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button onClick={(e) => saveEditCompany(e, c.id)} className="btn-primary" style={{ padding: '0.25rem 0.5rem' }} disabled={loadingId === c.id}>Speichern</button>
                            <button onClick={cancelEditCompany} className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>Abbrechen</button>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }} onClick={(e) => e.stopPropagation()}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={editFeatureUrlaub} onChange={(e) => setEditFeatureUrlaub(e.target.checked)} />
                              Urlaub aktiv
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={editFeatureAbwesenheit} onChange={(e) => setEditFeatureAbwesenheit(e.target.checked)} />
                              Abwesenheit aktiv
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={editFeatureSonstiges} onChange={(e) => setEditFeatureSonstiges(e.target.checked)} />
                              Sonstiges aktiv
                            </label>
                          </div>
                        </div>
                      ) : (
                        <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                          {c.name}
                          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            {[c.feature_urlaub && 'Urlaub', c.feature_abwesenheit && 'Abw.', c.feature_sonstiges && 'Sonstiges'].filter(Boolean).join(', ')}
                          </span>
                        </h3>
                      )}
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        ID: {c.id.substring(0,8)}... &bull; {companyEmployees.length} Mitarbeiter
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {editingCompany !== c.id && (
                      <div style={{ position: 'relative' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === c.id ? null : c.id); }}
                          className="btn-secondary"
                          style={{ padding: '0.5rem', borderRadius: '50%', border: 'none', background: 'transparent', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openDropdownId === c.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }} />
                            <div className="glass-dropdown" style={{ 
                              position: 'absolute', right: 0, top: '100%', 
                              padding: '0.5rem',
                              zIndex: 10,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              minWidth: '150px',
                              marginTop: '0.5rem'
                            }}>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); startEditCompany(e, c); setOpenDropdownId(null); }}>
                                <Edit2 size={16} /> Bearbeiten
                              </button>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); handleDeleteCompany(c.id); setOpenDropdownId(null); }} style={{ color: 'var(--danger)' }} disabled={loadingId === c.id}>
                                <Trash2 size={16} /> Löschen
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* Employees List */}
                {isExpanded && (
                  <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Mitarbeiter</h4>
                    {companyEmployees.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Keine Mitarbeiter vorhanden.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {companyEmployees.map((p: any) => renderProfile(p))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned Profiles */}
          {unassignedProfiles.length > 0 && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginTop: '1rem' }}>
              <div 
                onClick={() => setExpandedCompanyId(expandedCompanyId === 'unassigned' ? null : 'unassigned')}
                style={{ 
                  padding: '1rem 1.5rem', 
                  background: 'rgba(255,255,255,0.02)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Building size={20} color="var(--text-secondary)" />
                  <div>
                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Kein Unternehmen zugeordnet</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {unassignedProfiles.length} Benutzer
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {expandedCompanyId === 'unassigned' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>

              {expandedCompanyId === 'unassigned' && (
                <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {unassignedProfiles.map((p: any) => renderProfile(p))}
                  </div>
                </div>
              )}
            </div>
          )}

          {filteredCompanies.length === 0 && unassignedProfiles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Keine Ergebnisse für "{searchQuery}" gefunden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
