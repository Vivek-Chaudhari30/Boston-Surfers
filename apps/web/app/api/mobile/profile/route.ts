import { db } from '@/lib/db';
import { ensureDailyChampions } from '@/lib/awards';
import { AWARD_TYPES, MobileProfile, maskPhone, type AwardTypeId } from '@/lib/awards-logic';
import { errorResponse, handle } from '@/lib/http';
import { getRiderSession } from '@/lib/session';
import { bostonDate } from '@/lib/time';

/**
 * GET /api/mobile/profile → MobileProfile: the signed-in rider's name, masked phone, every play
 * (date, time, score), stats, awards and award types with counts. Identity comes only from the cookie.
 */
export const GET = handle(async () => {
  const session = await getRiderSession();
  if (!session) return errorResponse(401, 'Sign in to see your profile.', 'NO_SESSION');
  await ensureDailyChampions();

  const [rider, runs, awards, types] = await Promise.all([
    db().from('riders').select('id,display_name,phone,created_at').eq('id', session.riderId).maybeSingle(),
    db()
      .from('runs')
      .select('id,score,coins,duration_ms,car_id,status,started_at,finished_at')
      .eq('rider_id', session.riderId)
      .in('status', ['finished', 'rejected'])
      .order('finished_at', { ascending: false })
      .limit(200),
    db()
      .from('awards')
      .select('id,type_id,title,rank,score,car_id,day,won_at,meta,claims(code,expires_at,redeemed_at,dispense_status)')
      .eq('rider_id', session.riderId)
      .order('won_at', { ascending: false })
      .limit(200),
    db().from('award_types').select('id,name,description,icon,sort').order('sort'),
  ]);
  for (const r of [rider, runs, awards, types]) if (r.error) throw r.error;
  if (!rider.data) return errorResponse(401, 'Sign in again.', 'NO_RIDER');

  const finished = (runs.data ?? []).filter((r) => r.status === 'finished');
  const days = new Set(finished.map((r) => bostonDate(new Date(r.finished_at ?? r.started_at))));
  const awardRows = awards.data ?? [];
  const counts = new Map<string, number>();
  for (const a of awardRows) counts.set(a.type_id, (counts.get(a.type_id) ?? 0) + 1);

  const body = MobileProfile.parse({
    rider: {
      id: rider.data.id,
      displayName: rider.data.display_name,
      phoneMasked: maskPhone(rider.data.phone),
      memberSince: new Date(rider.data.created_at).toISOString(),
    },
    stats: {
      plays: finished.length,
      bestScore: Math.max(0, ...finished.map((r) => r.score ?? 0)),
      totalCoins: finished.reduce((n, r) => n + (r.coins ?? 0), 0),
      daysPlayed: days.size,
      wins: awardRows.filter((a) => a.type_id !== 'score_milestone').length,
    },
    awardTypes: (types.data ?? [])
      .filter((t) => (AWARD_TYPES as readonly string[]).includes(t.id))
      .map((t) => ({ id: t.id as AwardTypeId, name: t.name, description: t.description, icon: t.icon, count: counts.get(t.id) ?? 0 })),
    awards: awardRows.map((a) => {
      const c = (Array.isArray(a.claims) ? a.claims[0] : a.claims) as
        | { code: string; expires_at: string; redeemed_at: string | null; dispense_status: string | null }
        | null
        | undefined;
      const meta = (a.meta ?? {}) as { offers?: unknown };
      return {
        id: a.id,
        typeId: a.type_id,
        title: a.title,
        rank: a.rank,
        score: a.score,
        carId: a.car_id,
        day: a.day,
        wonAt: new Date(a.won_at).toISOString(),
        claim: c
          ? {
              code: c.code,
              expiresAt: new Date(c.expires_at).toISOString(),
              redeemedAt: c.redeemed_at ? new Date(c.redeemed_at).toISOString() : null,
              dispenseStatus: c.dispense_status,
            }
          : null,
        offers: Array.isArray(meta.offers) ? meta.offers.filter((o): o is string => typeof o === 'string') : [],
      };
    }),
    plays: (runs.data ?? []).map((r) => ({
      id: r.id,
      score: r.score,
      coins: r.coins,
      durationMs: r.duration_ms,
      carId: r.car_id,
      status: r.status,
      playedAt: new Date(r.finished_at ?? r.started_at).toISOString(),
    })),
  });
  return Response.json(body, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
});
