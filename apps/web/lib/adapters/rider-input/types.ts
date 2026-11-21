export interface RiderInput {
  readonly kind: 'webcam-qr' | 'keyboard' | 'nfc'; // 'nfc' = future CharlieCard/RFID tap
  start(onCode: (code: string) => void): Promise<void>;
  stop(): void;
}
