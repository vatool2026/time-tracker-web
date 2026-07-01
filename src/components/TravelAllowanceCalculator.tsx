"use client";

import React, { useState, useEffect } from 'react';
import { Calculator, Info, Car } from 'lucide-react';

interface TravelAllowanceCalculatorProps {
  entries: any[];
}

export default function TravelAllowanceCalculator({ entries }: TravelAllowanceCalculatorProps) {
  const currentYear = new Date().getFullYear();

  // Calculate default work days from entries
  const defaultWorkDays = React.useMemo(() => {
    if (!entries) return 0;
    // Count unique days in the current year where the user actually worked
    const currentYearStr = currentYear.toString();
    const workDays = new Set();
    entries.forEach(entry => {
      if (
        entry.entry_date.startsWith(currentYearStr) &&
        !entry.deleted_at &&
        entry.end_time && 
        entry.absence_code !== 'U' && 
        entry.absence_code !== 'K'
      ) {
        workDays.add(entry.entry_date);
      }
    });
    return workDays.size;
  }, [entries, currentYear]);

  // State for inputs
  const [workDays, setWorkDays] = useState<number>(defaultWorkDays);
  const [distance, setDistance] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0.30);
  
  const [fixedCosts, setFixedCosts] = useState<number>(0);
  const [consumption, setConsumption] = useState<number>(8.0);
  const [fuelPrice, setFuelPrice] = useState<number>(1.80);

  // Update workDays if defaultWorkDays changes (e.g. entries loaded)
  useEffect(() => {
    if (workDays === 0 && defaultWorkDays > 0) {
      setWorkDays(defaultWorkDays);
    }
  }, [defaultWorkDays]);

  // Tax calculations (Werbungskosten)
  const sumKmTax = workDays * distance;
  const taxPerDay = distance * taxRate;
  const totalTaxDeduction = sumKmTax * taxRate;

  // Actual costs (Eigene Kosten)
  // Assuming they drive both ways: distance * 2
  const totalKmDriven = workDays * distance * 2;
  const fuelCostYear = (totalKmDriven / 100) * consumption * fuelPrice;
  const totalCostYear = fixedCosts + fuelCostYear;
  const totalCostMonth = totalCostYear / 12;

  return (
    <div className="glass glass-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <Car size={28} style={{ color: 'var(--accent-primary)' }} />
        <h3 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>Fahrtkostenberechnung {currentYear}</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Steuerberechnung / Werbungskosten */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.5rem' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calculator size={18} /> Steuerberechnung (Werbungskosten)
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Fahrten zur Arbeit (Tage)</label>
              <input 
                type="number" 
                value={workDays} 
                onChange={(e) => setWorkDays(Number(e.target.value) || 0)}
                className="input-field"
                style={{ width: '100px', textAlign: 'right' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Entfernung km (einfach)</label>
              <div style={{ position: 'relative', width: '100px' }}>
                <input 
                  type="number" 
                  value={distance} 
                  onChange={(e) => setDistance(Number(e.target.value) || 0)}
                  className="input-field"
                  style={{ width: '100%', textAlign: 'right', paddingRight: '2rem' }}
                />
                <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>km</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Steuerpauschale je km</label>
              <div style={{ position: 'relative', width: '100px' }}>
                <input 
                  type="number" 
                  step="0.01"
                  value={taxRate} 
                  onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                  className="input-field"
                  style={{ width: '100%', textAlign: 'right', paddingRight: '1.5rem' }}
                />
                <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>€</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0.5rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Summe km (einfach)</span>
              <span style={{ fontWeight: 600 }}>{sumKmTax.toLocaleString('de-DE')} km</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Steuerberechnung pro Tag</span>
              <span style={{ fontWeight: 600 }}>{taxPerDay.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>Werbungskosten</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>{totalTaxDeduction.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            </div>
          </div>
        </div>

        {/* Eigene Kosten */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.5rem' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={18} /> Eigene Kosten (Hin- & Rückfahrt)
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>KFZ-Fixkosten/Jahr</label>
              <div style={{ position: 'relative', width: '100px' }}>
                <input 
                  type="number" 
                  value={fixedCosts || ''} 
                  onChange={(e) => setFixedCosts(Number(e.target.value) || 0)}
                  className="input-field"
                  style={{ width: '100%', textAlign: 'right', paddingRight: '1.5rem' }}
                />
                <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>€</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Verbrauch je 100km</label>
              <div style={{ position: 'relative', width: '100px' }}>
                <input 
                  type="number" 
                  step="0.1"
                  value={consumption || ''} 
                  onChange={(e) => setConsumption(Number(e.target.value) || 0)}
                  className="input-field"
                  style={{ width: '100%', textAlign: 'right', paddingRight: '1.5rem' }}
                />
                <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>l</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Preis je Liter</label>
              <div style={{ position: 'relative', width: '100px' }}>
                <input 
                  type="number" 
                  step="0.01"
                  value={fuelPrice || ''} 
                  onChange={(e) => setFuelPrice(Number(e.target.value) || 0)}
                  className="input-field"
                  style={{ width: '100%', textAlign: 'right', paddingRight: '1.5rem' }}
                />
                <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>€</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0.5rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Gefahrene km (Hin & Zurück)</span>
              <span style={{ fontWeight: 600 }}>{totalKmDriven.toLocaleString('de-DE')} km</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Reine Spritkosten/Jahr</span>
              <span style={{ fontWeight: 600 }}>{fuelCostYear.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Fahrtkosten/Monat</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--danger)', opacity: 0.8 }}>Gesamtkosten im Jahr</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>{totalCostMonth.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', opacity: 0.8 }}>{totalCostYear.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
