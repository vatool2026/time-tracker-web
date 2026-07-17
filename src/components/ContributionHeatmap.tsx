"use client";

import React, { useMemo } from 'react';
import { calculateSurcharges } from '@/utils/surchargeCalculator';

interface TimeEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  absence_code: string | null;
}

interface SurchargeSettings {
  night_surcharge_start_time: string;
  night_surcharge_end_time: string;
  night_surcharge_rate: number;
  sunday_surcharge_rate: number;
  holiday_surcharge_rate: number;
}

interface ContributionHeatmapProps {
  entries: TimeEntry[];
  year: number;
  surchargeSettings: SurchargeSettings | null;
}

export default function ContributionHeatmap({ entries, year, surchargeSettings }: ContributionHeatmapProps) {
  const surchSet = surchargeSettings || {
    night_surcharge_start_time: '22:00:00',
    night_surcharge_end_time: '06:00:00',
    night_surcharge_rate: 25,
    sunday_surcharge_rate: 50,
    holiday_surcharge_rate: 100
  };

  const { days, maxHours } = useMemo(() => {
    const dayMap = new Map<string, number>();
    
    entries.forEach(e => {
      const d = new Date(e.entry_date);
      if (d.getFullYear() !== year) return;
      
      let worked = 0;
      if (!e.absence_code && e.end_time) {
        const surch = calculateSurcharges(
          e.entry_date,
          e.start_time,
          e.end_time,
          e.break_minutes || 0,
          surchSet
        );
        worked += surch.workedHours;
      } else if (e.absence_code) {
        // give standard 8h for full absence to visually fill the map
        worked = 8; 
      }
      
      const current = dayMap.get(e.entry_date) || 0;
      dayMap.set(e.entry_date, current + worked);
    });

    // Determine max for color scaling
    let max = 0;
    dayMap.forEach(val => { if (val > max) max = val; });
    
    return { days: dayMap, maxHours: max || 10 };
  }, [entries, year, surchSet]);

  const getColor = (hours: number) => {
    if (hours === 0) return 'rgba(255, 255, 255, 0.05)'; // empty state, visible on dark
    // scale 0 to maxHours
    const intensity = Math.min(hours / (maxHours * 0.8), 1);
    
    if (intensity < 0.25) return 'rgba(16, 185, 129, 0.3)'; // light green
    if (intensity < 0.5) return 'rgba(16, 185, 129, 0.5)';
    if (intensity < 0.75) return 'rgba(16, 185, 129, 0.8)';
    return 'var(--success)'; // Full green
  };

  // Generate grid for 365/366 days
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const daysInYear = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  
  const cells = [];
  
  // Offset to align first day to the correct row (Sunday = 0, Monday = 1)
  const startDayOfWeek = startDate.getDay();
  
  // push empty cells for padding
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push(<div key={`empty-${i}`} style={{ width: '12px', height: '12px', borderRadius: '3px', visibility: 'hidden' }} />);
  }

  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(year, 0, i + 1);
    const dateStr = d.toISOString().split('T')[0];
    const hours = days.get(dateStr) || 0;
    
    cells.push(
      <div 
        key={dateStr}
        title={`${new Date(dateStr).toLocaleDateString('de-DE')}: ${hours.toFixed(1)} h`}
        style={{ 
          width: '12px', 
          height: '12px', 
          borderRadius: '3px',
          backgroundColor: getColor(hours),
          transition: 'transform 0.1s',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      />
    );
  }

  return (
    <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', overflowX: 'auto', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>Contribution Heatmap {year}</h3>
      <div style={{ display: 'flex', gap: '0.5rem', minWidth: 'min-content' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '16px', fontSize: '10px', color: 'var(--text-secondary)', paddingRight: '0.5rem' }}>
          <span style={{ height: '12px', lineHeight: '12px' }}>So</span>
          <span style={{ height: '12px', lineHeight: '12px' }}>Mo</span>
          <span style={{ height: '12px', lineHeight: '12px' }}>Di</span>
          <span style={{ height: '12px', lineHeight: '12px' }}>Mi</span>
          <span style={{ height: '12px', lineHeight: '12px' }}>Do</span>
          <span style={{ height: '12px', lineHeight: '12px' }}>Fr</span>
          <span style={{ height: '12px', lineHeight: '12px' }}>Sa</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', fontSize: '10px', color: 'var(--text-secondary)', justifyContent: 'space-between' }}>
            <span>Jan</span><span>Feb</span><span>Mär</span><span>Apr</span><span>Mai</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Okt</span><span>Nov</span><span>Dez</span>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoFlow: 'column',
            gap: '4px'
          }}>
            {cells}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
        <span>Weniger</span>
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}></div>
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(16, 185, 129, 0.3)' }}></div>
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(16, 185, 129, 0.5)' }}></div>
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(16, 185, 129, 0.8)' }}></div>
        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--success)' }}></div>
        <span>Mehr</span>
      </div>
    </div>
  );
}
