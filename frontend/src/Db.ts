export type Person = {
  id: number;
  phone: string;
  name: string;
  address: string;
};

export type PhoneCall = {
  id: number;
  personId: number;
  phone: string;
  name: string;
  address: string;
  /** ISO 8601 timestamp of when the call happened */
  calledAt: string;
  comment: string;
  /** Price in cents to avoid floating point rounding issues; null when not set */
  priceCents: number | null;
  /** Details that usually come from the phone's call log */
  callType: string | null;
  durationSeconds: number | null;
  location: string;
  numberLabel: string;
  countryIso: string;
  isVideo: boolean;
  /** Whether a voice message is stored; the audio itself is loaded with getVoiceMessage */
  hasVoice: boolean;
  voiceDurationMs: number | null;
  /** Text recognized from the voice message, editable by the user */
  transcript: string;
  /** The export this call was included in; null until it has been exported */
  exportId: number | null;
};

export type VoiceMessage = {
  /** Encoded audio exactly as recorded (m4a on phones, usually webm in browsers) */
  data: Uint8Array;
  mimeType: string;
  durationMs: number | null;
};

export type NewPhoneCall = Omit<
  PhoneCall,
  'id' | 'personId' | 'hasVoice' | 'voiceDurationMs' | 'exportId'
> & {
  voice?: VoiceMessage | null;
};

/** All calls from one person rolled up */
export type PersonSummary = Person & {
  callCount: number;
  /** Sum of all call prices in cents; 0 when no call has a price */
  totalCents: number;
  /** Sum of all known call durations; 0 when none is known */
  totalDurationSeconds: number;
  lastCalledAt: string;
};

type PhoneCallRow = {
  id: number;
  person_id: number;
  phone: string;
  name: string;
  address: string;
  called_at: string;
  comment: string | null;
  price_cents: number | null;
  call_type: string | null;
  duration_seconds: number | null;
  location: string;
  number_label: string;
  country_iso: string;
  is_video: number;
  has_voice: number;
  voice_duration_ms: number | null;
  transcript: string;
  export_id: number | null;
};

type PersonSummaryRow = Person & {
  call_count: number;
  total_cents: number;
  total_duration_seconds: number;
  last_called_at: string;
};