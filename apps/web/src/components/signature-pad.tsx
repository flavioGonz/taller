'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { dataUrlToBlob, uploadFile } from '@/lib/upload';

/**
 * Firma del cliente con el dedo o el mouse. Al confirmar sube el PNG y
 * devuelve la URL para guardarla junto a la inspección o el acta de entrega.
 */
export function SignaturePad({
  label = 'Firma del cliente',
  value,
  onChange,
}: {
  label?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    dirty.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    onChange(null);
  };

  const confirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) {
      setError('Todavía no hay ninguna firma');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const blob = dataUrlToBlob(canvas.toDataURL('image/png'));
      const { url } = await uploadFile(blob, 'firma.png');
      onChange(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (value) {
    return (
      <div>
        <p className="ts-label">{label}</p>
        <div className="flex items-center gap-3 rounded-[var(--r)] border border-[var(--ok-bd)] bg-[var(--ok-bg)] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Firma registrada" className="h-16 rounded bg-white" />
          <div className="flex-1 text-[13px] text-[var(--ok)]">Firma registrada</div>
          <Button variant="ghost" size="sm" type="button" onClick={() => onChange(null)}>Rehacer</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="ts-label">{label}</p>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-36 w-full touch-none rounded-[var(--r)] border border-dashed border-[var(--border-strong)] bg-white"
        aria-label="Área de firma"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={clear}>
          <Eraser className="size-3.5" aria-hidden /> Borrar
        </Button>
        <Button type="button" size="sm" loading={saving} onClick={() => void confirm()}>
          <Check className="size-3.5" aria-hidden /> Confirmar firma
        </Button>
        {error && <span className="text-[12px] text-[var(--falla)]">{error}</span>}
      </div>
    </div>
  );
}
