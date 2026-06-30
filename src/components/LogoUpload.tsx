"use client";

import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { createClient } from '@/utils/supabase/client';
import { updateCompanyLogoAction } from '@/app/actions';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

interface LogoUploadProps {
  currentLogoUrl: string | null;
  companyId: string;
}

export default function LogoUpload({ currentLogoUrl, companyId }: LogoUploadProps) {
  const [upImg, setUpImg] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 100,
    height: 100,
    x: 0,
    y: 0
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setUpImg(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  };

  const handleUpload = async () => {
    if (!imgRef.current) {
      showMsg('error', 'Kein Bild vorhanden.');
      return;
    }

    const cropToUse = completedCrop?.width && completedCrop?.height ? completedCrop : {
      unit: 'px',
      width: imgRef.current.width,
      height: imgRef.current.height,
      x: 0,
      y: 0
    } as PixelCrop;

    setLoading(true);
    try {
      const blob = await getCroppedImg(imgRef.current, cropToUse);
      const supabase = createClient();
      
      const fileName = `${companyId}-${Date.now()}.png`;
      
      // Upload to supabase storage
      const { data, error } = await supabase.storage
        .from('logos')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Save to db
      const res = await updateCompanyLogoAction(publicUrl);
      if (res.success) {
        showMsg('success', 'Logo erfolgreich hochgeladen.');
        setUpImg(null); // Close cropper
      } else {
        throw new Error(res.message);
      }

    } catch (e: any) {
      showMsg('error', e.message || 'Fehler beim Upload');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const res = await updateCompanyLogoAction(null);
      if (res.success) {
        showMsg('success', 'Logo erfolgreich entfernt.');
      } else {
        throw new Error(res.message);
      }
    } catch (e: any) {
      showMsg('error', e.message || 'Fehler beim Entfernen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
      <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Firmenlogo</h4>
      
      {message && (
        <div style={{
          padding: '0.75rem',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem'
        }}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {!upImg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {currentLogoUrl ? (
            <div style={{ position: 'relative', height: '80px', minWidth: '80px', maxWidth: '240px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)' }}>
              <img src={currentLogoUrl} alt="Firmenlogo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ width: '80px', height: '80px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--glass-border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kein Logo</span>
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <Upload size={16} /> Logo ändern
              <input type="file" accept="image/*" onChange={onSelectFile} style={{ display: 'none' }} />
            </label>
            {currentLogoUrl && (
              <button onClick={handleRemove} className="btn btn-secondary glass" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} disabled={loading}>
                Logo löschen
              </button>
            )}
          </div>
        </div>
      )}

      {upImg && (
        <div className="glass" style={{ padding: '1rem', borderRadius: 'var(--border-radius-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Bereich zuschneiden</span>
            <button onClick={() => setUpImg(null)} className="btn btn-secondary glass" style={{ padding: '0.3rem', borderRadius: '50%' }}>
              <X size={16} />
            </button>
          </div>
          
          <div style={{ maxWidth: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', display: 'flex', justifyContent: 'center' }}>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
            >
              <img src={upImg} ref={imgRef} alt="Upload" style={{ maxHeight: '400px' }} />
            </ReactCrop>
          </div>
          
          <button onClick={handleUpload} disabled={loading} className="btn btn-primary" style={{ width: '100%', height: '40px' }}>
            {loading ? 'Wird hochgeladen...' : 'Zuschneiden & Hochladen'}
          </button>
        </div>
      )}
    </div>
  );
}
