/** A dated report supplied by an agent from the logistics company's message. */
export type LogisticsTrackingKind = 'purchase' | 'shipment';
export interface LogisticsTrackingEvent {
  id: number;
  source: 'agent_update';
  tracking_number: string | null;
  status: string;
  location: string | null;
  description: string | null;
  reported_at: string | null;
  recorded_at: string;
  recorded_by: string;
  source_text: string;
}
export interface LogisticsTrackingUpdate extends LogisticsTrackingEvent {
  history: LogisticsTrackingEvent[];
}
export interface RecordLogisticsTrackingInput {
  kind: LogisticsTrackingKind;
  entity_id: string;
  /** Must match the record being updated; null explicitly means no number saved. */
  tracking_number: string | null;
  status: string;
  location?: string | null;
  description?: string | null;
  /** Time stated in the message, with a timezone; null when the message is undated. */
  reported_at: string | null;
  source_text: string;
  idempotency_key: string;
}
/** Current report and its dated message history for the compact tracking view. */
export type LogisticsTrackingSnapshot = LogisticsTrackingUpdate;
