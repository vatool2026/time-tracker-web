'use client';

import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface QRScannerModalProps {
  onClose: () => void;
}

export default function QRScannerModal({ onClose }: QRScannerModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // We need a slight delay to ensure the DOM element is mounted
    let scanner: Html5QrcodeScanner | null = null;
    
    const startScanner = () => {
      try {
        scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        
        scanner.render(
          (decodedText) => {
            scanner?.clear();
            
            // Check if it's a URL to our scan page
            try {
              const url = new URL(decodedText);
              if (url.pathname === '/scan' && url.searchParams.has('code')) {
                const codeId = url.searchParams.get('code');
                if (codeId) {
                  onClose();
                  router.push(`/scan?code=${codeId}`);
                  return;
                }
              }
            } catch(e) {
              // Not a valid URL, ignore or check if it's just the ID
            }
            
            // Fallback: If it's just the ID
            if (decodedText && decodedText.length > 20) {
               onClose();
               router.push(`/scan?code=${decodedText}`);
            } else {
               setError('Ungültiger QR-Code Format');
            }
          },
          (err) => {
            // ignore scan errors, they happen continuously until a code is found
          }
        );
      } catch (err) {
        console.error("Scanner init error", err);
        setError("Kamera konnte nicht gestartet werden. Bitte Berechtigungen prüfen.");
      }
    };
    
    // timeout to let modal render fully
    const timer = setTimeout(startScanner, 100);

    return () => {
      clearTimeout(timer);
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [onClose, router]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div className="glass" style={{
        width: '100%',
        maxWidth: '500px',
        background: 'var(--bg-card)',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>QR-Code Scannen</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {error && (
            <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', width: '100%' }}>
              {error}
            </div>
          )}
          <div id="qr-reader" style={{ width: '100%', maxWidth: '350px' }}></div>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Halte die Kamera auf den generierten QR-Code.
          </p>
        </div>
      </div>
    </div>
  );
}
