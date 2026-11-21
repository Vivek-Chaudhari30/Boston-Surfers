'use client';

import { ClaimStatusResponse } from '@cb/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { claimStore, type StoredClaim } from './storage';
import { Card, GhostButton } from './ui';

/** Winner's one-time claim QR (`CB1:<code>`). Polls status every 2 s until redeemed or expired. */
export function ClaimView({ claim, onDone }: { claim: StoredClaim; onDone: () => void }) {
  const [status, setStatus] = useState<ClaimStatusResponse['status']>('pending');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'pending') return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    const poll = setInterval(async () => {
      try {
        const r = await api(`/api/claims/${claim.code}`, ClaimStatusResponse);
        setStatus(r.status);
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [claim.code, status]);

  const leftS = Math.max(0, Math.ceil((Date.parse(claim.expiresAt) - now) / 1000));
  const shownStatus = status === 'pending' && leftS === 0 ? 'expired' : status;

  useEffect(() => {
    if (shownStatus !== 'pending') claimStore.set(null);
  }, [shownStatus]);

  if (shownStatus === 'redeemed') {
    return (
      <Card>
        <h2 className="mt-3 text-2xl font-semibold">Claim confirmed! 🎉 Grab your sticker at the kiosk.</h2>
        <p className="mt-2 text-hud-dim">Thanks for riding. See you on the daily board.</p>
        <GhostButton className="mt-5" onClick={onDone}>
          Done
        </GhostButton>
      </Card>
    );
  }
  if (shownStatus === 'expired') {
    return (
      <Card>
        <h2 className="text-xl font-semibold">That code expired</h2>
        <p className="mt-2 text-hud-dim">Claim codes last 2 minutes. Ask the crew at the kiosk if you still want your sticker.</p>
        <GhostButton className="mt-5" onClick={onDone}>
          OK
        </GhostButton>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-2xl font-semibold">You won this car! 🏆</h2>
      <p className="text-hud-dim">Turn your brightness up and hold this to the kiosk camera.</p>
      <div className="rounded-2xl bg-white p-5">
        <QRCodeSVG value={`CB1:${claim.code}`} size={260} level="M" marginSize={0} />
      </div>
      <p className="font-mono text-4xl tracking-[0.3em]">{claim.code}</p>
      <p className="text-sm text-hud-dim">Or type the code on the kiosk keyboard · expires in {leftS}s</p>
    </div>
  );
}
