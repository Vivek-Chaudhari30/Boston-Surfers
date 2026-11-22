import { redirect } from 'next/navigation';

/** Alias: /kiosk/<carId>?key=… → /kiosk?car=<carId>&key=… (other query params preserved). */
export default async function KioskCarAlias({ params, searchParams }: PageProps<'/kiosk/[carId]'>) {
  const { carId } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  q.set('car', carId);
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'car' || v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) q.append(k, item);
  }
  redirect(`/kiosk?${q.toString()}`);
}
