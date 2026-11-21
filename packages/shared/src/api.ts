/**
 * API contracts (ARCHITECTURE §4). zod schemas + inferred types for every endpoint.
 * CONTRACT: frozen after hour 1. Update ARCHITECTURE.md in the same commit as any change.
 *
 * Naming: `<Name>Request` = body/query schema, `<Name>Response` = response schema,
 * `<Name>Params` = dynamic path segments.
 */
import { z } from 'zod';
import { CAR_ID_PATTERN, LINES, ROUTE_IDS } from './lines';

// ───────────────────────── Primitives ─────────────────────────

export const CLAIM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CLAIM_CODE_LENGTH = 6;
export const CLAIM_TTL_MS = 120_000;
/** QR payload prefix the kiosk accepts. */
export const CLAIM_QR_PREFIX = 'CB1:';
export const JOIN_TOKEN_WINDOW_MS = 30_000;

export const ApiError = z.object({ error: z.string(), code: z.string() });
export type ApiError = z.infer<typeof ApiError>;

export const CarId = z.string().regex(CAR_ID_PATTERN, 'car id must look like green-3812');
export const Uuid = z.uuid();
export const IsoDateTime = z.iso.datetime({ offset: true });
export const IsoDate = z.iso.date();
export const LineSchema = z.enum(LINES);
export const RouteIdSchema = z.enum(ROUTE_IDS);

/** E.164 phone number, e.g. +16175551234. */
export const Phone = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'phone must be E.164, e.g. +16175551234');
export const DisplayName = z.string().trim().min(2).max(16);
export const ClaimCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(CLAIM_CODE_LENGTH)
  .regex(new RegExp(`^[${CLAIM_CODE_ALPHABET}]+$`), 'invalid claim code');

// ───────────────────────── Shared types ─────────────────────────

export const Entry = z.object({
  rank: z.number().int().positive(),
  displayName: z.string(),
  score: z.number().int().nonnegative(),
});
export type Entry = z.infer<typeof Entry>;

export const TrainStatus = z.enum(['STOPPED_AT', 'INCOMING_AT', 'IN_TRANSIT_TO']);
export type TrainStatus = z.infer<typeof TrainStatus>;

export const TrainVehicle = z.object({
  id: z.string(),
  route: z.string(),
  directionId: z.union([z.literal(0), z.literal(1)]),
  label: z.string(),
  tripId: z.string().nullable(),
  status: TrainStatus,
  stationId: z.string(),
  prevStationId: z.string().nullable(),
  progress: z.number().min(0).max(1),
});
export type TrainVehicle = z.infer<typeof TrainVehicle>;

export const TrainSnapshot = z.object({
  fetchedAt: IsoDateTime,
  source: z.enum(['live', 'replay']),
  vehicles: z.array(TrainVehicle),
});
export type TrainSnapshot = z.infer<typeof TrainSnapshot>;

/** Format of files in apps/web/public/replay/*.json, written by scripts/record-mbta.ts. */
export const ReplayFile = z.object({
  version: z.literal(1),
  recordedAt: IsoDateTime,
  intervalMs: z.number().int().positive(),
  frames: z.array(TrainSnapshot),
});
export type ReplayFile = z.infer<typeof ReplayFile>;

export const RiderPublic = z.object({ id: Uuid, displayName: z.string() });
export type RiderPublic = z.infer<typeof RiderPublic>;

export const Ride = z.object({ id: Uuid, carId: CarId, line: LineSchema, startedAt: IsoDateTime });
export type Ride = z.infer<typeof Ride>;

export const Car = z.object({
  id: CarId,
  line: LineSchema,
  carNumber: z.string(),
  vehicleId: z.string().nullable(),
});
export type Car = z.infer<typeof Car>;

// ───────────────────────── Phone ─────────────────────────

/** POST /api/riders */
export const CreateRiderRequest = z.object({ phone: Phone, displayName: DisplayName });
export type CreateRiderRequest = z.infer<typeof CreateRiderRequest>;
export const CreateRiderResponse = z.object({ rider: RiderPublic });
export type CreateRiderResponse = z.infer<typeof CreateRiderResponse>;

/** GET /api/me */
export const MeResponse = z.object({ rider: RiderPublic.nullable(), activeRide: Ride.nullable() });
export type MeResponse = z.infer<typeof MeResponse>;

/** POST /api/rides */
export const CreateRideRequest = z.object({ carId: CarId, joinToken: z.string().min(1).max(256) });
export type CreateRideRequest = z.infer<typeof CreateRideRequest>;
export const CreateRideResponse = z.object({ ride: Ride });
export type CreateRideResponse = z.infer<typeof CreateRideResponse>;

/** POST /api/runs */
export const StartRunRequest = z.object({ rideId: Uuid });
export type StartRunRequest = z.infer<typeof StartRunRequest>;
export const StartRunResponse = z.object({
  runId: Uuid,
  seed: z.number().int(),
  startedAt: IsoDateTime,
});
export type StartRunResponse = z.infer<typeof StartRunResponse>;

/** POST /api/runs/:runId/finish */
export const RunIdParams = z.object({ runId: Uuid });
export const FinishRunRequest = z.object({
  score: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type FinishRunRequest = z.infer<typeof FinishRunRequest>;
export const RunRejectReason = z.enum([
  'not_started',
  'not_owner',
  'ride_inactive',
  'too_short',
  'duration_mismatch',
  'score_too_high',
  'coins_mismatch',
  'too_old',
  'already_finished',
]);
export type RunRejectReason = z.infer<typeof RunRejectReason>;
export const FinishRunResponse = z.object({
  accepted: z.boolean(),
  reason: RunRejectReason.optional(),
  bestThisRide: z.number().int().nonnegative(),
  carRank: z.number().int().positive().nullable(),
  carLeaderboard: z.array(Entry),
});
export type FinishRunResponse = z.infer<typeof FinishRunResponse>;

/** POST /api/rides/:rideId/end */
export const RideIdParams = z.object({ rideId: Uuid });
export const EndRideResponse = z.discriminatedUnion('result', [
  z.object({ result: z.literal('won'), claim: z.object({ code: ClaimCode, expiresAt: IsoDateTime }) }),
  z.object({
    result: z.literal('not_leader'),
    rank: z.number().int().positive(),
    leader: z.object({ displayName: z.string(), score: z.number().int().nonnegative() }),
  }),
  z.object({ result: z.literal('no_score') }),
  z.object({ result: z.literal('already_claimed_today') }),
]);
export type EndRideResponse = z.infer<typeof EndRideResponse>;

/** GET /api/claims/:code */
export const ClaimCodeParams = z.object({ code: ClaimCode });
export const ClaimStatusResponse = z.object({ status: z.enum(['pending', 'redeemed', 'expired']) });
export type ClaimStatusResponse = z.infer<typeof ClaimStatusResponse>;

// ───────────────────────── Kiosk (x-kiosk-key) ─────────────────────────

export const KIOSK_KEY_HEADER = 'x-kiosk-key';
export const CarIdParams = z.object({ carId: CarId });

/** GET /api/cars/:carId/join-token */
export const JoinTokenResponse = z.object({ token: z.string(), url: z.url(), expiresAt: IsoDateTime });
export type JoinTokenResponse = z.infer<typeof JoinTokenResponse>;

/** GET /api/cars/:carId/state */
export const CarStateResponse = z.object({
  car: Car,
  leaderboard: z.array(Entry),
  activeRiders: z.number().int().nonnegative(),
  pendingClaim: z
    .object({ displayName: z.string(), score: z.number().int().nonnegative(), expiresAt: IsoDateTime })
    .nullable(),
});
export type CarStateResponse = z.infer<typeof CarStateResponse>;

/** POST /api/cars/:carId/vehicle */
export const PinVehicleRequest = z.object({ vehicleId: z.string().min(1).max(64) });
export type PinVehicleRequest = z.infer<typeof PinVehicleRequest>;
export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;

/** POST /api/claims/redeem */
export const RedeemClaimRequest = z.object({ code: ClaimCode, carId: CarId });
export type RedeemClaimRequest = z.infer<typeof RedeemClaimRequest>;
export const RedeemClaimResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), displayName: z.string(), dispenseId: z.string().regex(/^[0-9a-f]{8}$/) }),
  z.object({ ok: z.literal(false), reason: z.enum(['invalid', 'expired', 'wrong_car', 'used']) }),
]);
export type RedeemClaimResponse = z.infer<typeof RedeemClaimResponse>;

/** POST /api/claims/:code/dispensed */
export const DispensedRequest = z.object({
  status: z.enum(['done', 'error']),
  detail: z.string().max(200).optional(),
});
export type DispensedRequest = z.infer<typeof DispensedRequest>;

// ───────────────────────── Public ─────────────────────────

/** GET /api/trains → TrainSnapshot */
export const TrainsResponse = TrainSnapshot;
export type TrainsResponse = TrainSnapshot;

/** GET /api/transfers?vehicleId= */
export const TransfersQuery = z.object({ vehicleId: z.string().min(1).max(64) });
export type TransfersQuery = z.infer<typeof TransfersQuery>;
export const TransfersResponse = z.object({
  nextStops: z.array(z.object({ stationId: z.string(), name: z.string(), etaMin: z.number() })),
  suggestions: z.array(
    z.object({
      atStationId: z.string(),
      atStationName: z.string(),
      toRoute: z.string(),
      departsInMin: z.number(),
      ourEtaMin: z.number(),
    }),
  ),
});
export type TransfersResponse = z.infer<typeof TransfersResponse>;

/** GET /api/leaderboard/daily?date=YYYY-MM-DD (date optional → today in Boston) */
export const DailyLeaderboardQuery = z.object({ date: IsoDate.optional() });
export type DailyLeaderboardQuery = z.infer<typeof DailyLeaderboardQuery>;
export const DailyLeaderboardResponse = z.object({
  date: IsoDate,
  entries: z.array(Entry.extend({ line: LineSchema })),
});
export type DailyLeaderboardResponse = z.infer<typeof DailyLeaderboardResponse>;

// ───────────────────────── Realtime ─────────────────────────

export const carChannel = (carId: string) => `car:${carId}` as const;
export const DAILY_CHANNEL = 'mbta:daily';
export const REALTIME_EVENT = 'changed';
export const ChangedPayload = z.object({
  kind: z.enum(['leaderboard', 'rider_joined', 'claim_pending', 'claim_redeemed', 'daily']),
});
export type ChangedPayload = z.infer<typeof ChangedPayload>;
