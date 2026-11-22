"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CreateRiderResponse, CreateRideResponse, MeResponse } from "@cb/shared";
import { ApiClientError, api, errorText, toE164 } from "@/lib/api-client";
import { MobileProfile } from "@/lib/awards-logic";
import { clearPass, isSignedOutHere, readPass, writePass } from "./pass-storage";

/** Session, remembered-rider sign-in, car join and profile loading for the /mobile pages. */
export function useMobilePass() {
  const params = useSearchParams();
  const router = useRouter();
  const car = params.get("car");
  const token = params.get("t");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState<string | null>(null);
  const [signedOutNote, setSignedOutNote] = useState(false);
  const joinKey = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await api("/api/mobile/profile", MobileProfile));
    } catch (err) {
      if (!(err instanceof ApiClientError && err.status === 401))
        setError(
          "Your history couldn’t load right now. Practice play still works.",
        );
    }
  }, []);

  const run = useCallback(async () => {
    setError(null);
    let current: MeResponse;
    try {
      current = await api("/api/me", MeResponse);
    } catch {
      setError(
        "Account sync is unavailable. You can still play practice runs on this phone.",
      );
      setLoading(false);
      return;
    }
    const outHere = isSignedOutHere();
    if (outHere) current = { rider: null, activeRide: null };
    if (!current.rider && !outHere) {
      const stored = readPass();
      if (stored) {
        try {
          await api("/api/riders", CreateRiderResponse, { body: stored });
          current = await api("/api/me", MeResponse);
          if (current.rider) setWelcomeBack(stored.displayName);
        } catch (err) {
          setError(errorText(err));
        }
      }
    }
    setMe(current);
    if (current.rider) {
      if (car && token) {
        const key = `${car}:${token}`;
        if (joinKey.current !== key) {
          joinKey.current = key;
          if (current.activeRide?.carId === car) {
            router.replace("/mobile/race");
            return;
          }
          try {
            await api("/api/rides", CreateRideResponse, {
              body: { carId: car, joinToken: token },
            });
            router.replace("/mobile/race");
            return;
          } catch (err) {
            if (err instanceof ApiClientError && err.code === "JOIN_EXPIRED")
              setExpired(true);
            else setError(errorText(err));
          }
        }
      }
      await loadProfile();
    } else setProfile(null);
    setLoading(false);
  }, [car, token, router, loadProfile]);

  useEffect(() => {
    const first = setTimeout(() => void run(), 0);
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      window.removeEventListener("focus", onFocus);
    };
  }, [run]);

  const signup = useCallback(
    async (name: string, phone: string) => {
      setBusy(true);
      setError(null);
      try {
        const displayName = name.trim();
        const e164 = toE164(phone);
        await api("/api/riders", CreateRiderResponse, {
          body: { displayName, phone: e164 },
        });
        writePass({ displayName, phone: e164 });
        setSignedOutNote(false);
        await run();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(false);
      }
    },
    [run],
  );

  /** Forget the details on this phone and clear the session cookies. */
  const signOutLocal = useCallback(() => {
    clearPass();
    void fetch('/api/riders/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    setMe({ rider: null, activeRide: null });
    setProfile(null);
    setWelcomeBack(null);
    setSignedOutNote(true);
  }, []);

  return {
    car,
    token,
    me,
    profile,
    loading,
    busy,
    error,
    expired,
    welcomeBack,
    signedOutNote,
    signup,
    signOutLocal,
    refresh: run,
  };
}
