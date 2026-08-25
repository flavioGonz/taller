'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, ClipboardCheck, Fuel, Gauge } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Textarea, Skeleton, Badge } from '@/components/ui';
import { PhotoAnnotator, type DamageDraft, type Photo } from '@/components/photo-annotator';
import { Checklist, type ChecklistValue } from '@/components/checklist';
import { SignaturePad } from '@/components/signature-pad';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { uploadPhoto } from '@/lib/upload';
import { customerName } from '@/lib/utils';
import { INTAKE_CHECKLIST, type PhotoAngle } from '@taller/shared';

interface WorkOrder {
  id: string; number: string; status: string; mileageIn: number | null; fuelLevel: number | null;
  customer: { firstName?: string | null; lastName?: string | null; companyName?: string | null; isCompany: boolean; docNumber?: string | null };
  vehicle: { plate: string; brand: string; model: string; year: number | null; mileage: number | null };
}

interface Inspection {
  id: string;
  mileage: number | null;
  fuelLevel: number | null;
  checklist: ChecklistValue;
  observations: string | null;
  signatureUrl: string | null;
  signedName: string | null;
  signedDoc: string | null;
  photos: Photo[];
  damages: (DamageDraft & { id: string })[];
}

export default function RecepcionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const wo = useApi<WorkOrder>(`/work-orders/${id}`);
  const insp = useApi<Inspection | null>(`/inspections/${id}?kind=INGRESO`);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [damages, setDamages] = useState<DamageDraft[]>([]);
  const [checklist, setChecklist] = useState<ChecklistValue>({});
  const [mileage, setMileage] = useState('');
  const [fuel, setFuel] = useState(50);
  const [observations, setObservations] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [signedName, setSignedName] = useState('');
  const [signedDoc, setSignedDoc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (insp.data) {
      setPhotos(insp.data.photos ?? []);
      setDamages(insp.data.damages ?? []);
      setChecklist((insp.data.checklist as ChecklistValue) ?? {});
      setMileage(insp.data.mileage ? String(insp.data.mileage) : '');
      setFuel(insp.data.fuelLevel ?? 50);
      setObservations(insp.data.observations ?? '');
      setSignature(insp.data.signatureUrl ?? null);
      setSignedName(insp.data.signedName ?? '');
      setSignedDoc(insp.data.signedDoc ?? '');
    }
  }, [insp.data]);

  useEffect(() => {
    if (wo.data && !mileage) {
      setMileage(wo.data.mileageIn ? String(wo.data.mileageIn) : wo.data.vehicle.mileage ? String(wo.data.vehicle.mileage) : '');
      if (!signedName) setSignedName(customerName(wo.data.customer));
      if (!signedDoc && wo.data.customer.docNumber) setSignedDoc(wo.data.customer.docNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wo.data]);

  async function addPhoto(file: File, angle: PhotoAngle) {
    const up = await uploadPhoto(file);
    const photo = await api.post<Photo>(`/inspections/${id}/photos?kind=INGRESO`, {
      angle, url: up.url, width: up.width, height: up.height, position: photos.length,
    });
    setPhotos((prev) => [...prev, photo]);
  }

  async function removePhoto(photoId: string) {
    await api.del(`/inspections/photos/${photoId}`);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setDamages((prev) => prev.filter((d) => d.photoId !== photoId));
  }

  async function save(andContinue = false) {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/inspections/${id}`, {
        kind: 'INGRESO',
        mileage: mileage ? Number(mileage) : undefined,
        fuelLevel: fuel,
        checklist,
        observations: observations || undefined,
        signatureUrl: signature ?? undefined,
        signedName: signedName || undefined,
        signedDoc: signedDoc || undefined,
        damages: damages.map((d) => ({
          photoId: d.photoId, x: d.x, y: d.y, partCode: d.partCode,
          type: d.type, severity: d.severity, preexisting: d.preexisting, note: d.note || undefined,
        })),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (andContinue) {
        await api.post(`/work-orders/${id}/status`, { status: 'DIAGNOSTICO', note: 'Recepción completa' }).catch(() => undefined);
        router.push(`/ordenes/${id}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (wo.loading && !wo.data) {
    return (<><Topbar title="Recepción" /><div className="space-y-4 p-6"><Skeleton className="h-24" /><Skeleton className="h-96" /></div></>);
  }
  if (!wo.data) return null;

  const requiredOk = photos.length >= 3 && !!signature;

  return (
    <>
      <Topbar
        title={`Recepción · OT ${wo.data.number}`}
        actions={
          <>
            {saved && <Badge tone="success">Guardado</Badge>}
            <Button variant="secondary" size="sm" loading={saving} onClick={() => void save(false)}>
              <Save className="size-4" aria-hidden /> Guardar
            </Button>
            <Button size="sm" disabled={!requiredOk} loading={saving} onClick={() => void save(true)}>
              <ClipboardCheck className="size-4" aria-hidden /> Cerrar recepción
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-6">
        <Link href={`/ordenes/${id}`} className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          <ArrowLeft className="size-3.5" aria-hidden /> Volver a la OT
        </Link>

        {error && <p role="alert" className="rounded-[var(--r)] bg-[var(--falla-bg)] px-3 py-2 text-[13px] text-[var(--falla)]">{error}</p>}

        <Card>
          <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--subtle)]">Cliente</p>
              <p className="font-semibold">{customerName(wo.data.customer)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--subtle)]">Vehículo</p>
              <p className="font-semibold"><span className="mono">{wo.data.vehicle.plate}</span> · {wo.data.vehicle.brand} {wo.data.vehicle.model} {wo.data.vehicle.year ?? ''}</p>
            </div>
            <div className="w-40">
              <Input
                label="Kilometraje"
                type="number"
                min={0}
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="91000"
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <label htmlFor="fuel" className="ts-label flex items-center gap-1.5">
                <Fuel className="size-3.5" aria-hidden /> Combustible: {fuel}%
              </label>
              <input
                id="fuel"
                type="range"
                min={0}
                max={100}
                step={5}
                value={fuel}
                onChange={(e) => setFuel(Number(e.target.value))}
                className="w-full accent-[var(--brand-500)]"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fotos y daños</CardTitle>
            <span className="text-[12px] text-[var(--muted)]">{photos.length} fotos · {damages.length} daños</span>
          </CardHeader>
          <CardBody>
            <PhotoAnnotator
              photos={photos}
              damages={damages}
              onDamagesChange={setDamages}
              onPhotoAdded={addPhoto}
              onPhotoRemoved={(pid) => void removePhoto(pid)}
            />
          </CardBody>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gauge className="size-4" aria-hidden /> Inventario del vehículo</CardTitle>
            </CardHeader>
            <CardBody>
              <Checklist items={INTAKE_CHECKLIST} value={checklist} onChange={setChecklist} />
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Observaciones</CardTitle></CardHeader>
              <CardBody>
                <Textarea
                  rows={5}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Lo que el cliente aclara al dejar el vehículo, condiciones especiales, objetos que deja adentro…"
                  aria-label="Observaciones de la recepción"
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Conformidad del cliente</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Quién entrega" value={signedName} onChange={(e) => setSignedName(e.target.value)} />
                  <Input label="Documento" value={signedDoc} onChange={(e) => setSignedDoc(e.target.value)} />
                </div>
                <SignaturePad value={signature} onChange={setSignature} />
                <p className="text-[11.5px] text-[var(--muted)]">
                  Al firmar, el cliente acepta el estado del vehículo tal como quedó registrado en las fotos y los daños marcados.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>

        {!requiredOk && (
          <p className="rounded-[var(--r)] bg-[var(--warn-bg)] px-3 py-2 text-[12.5px] text-[var(--warn)]">
            Para cerrar la recepción hacen falta al menos 3 fotos y la firma del cliente.
          </p>
        )}
      </div>
    </>
  );
}
