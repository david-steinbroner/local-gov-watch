/**
 * Legistar Web API client and record mappers.
 *
 * Replaces HTML scraping of Calendar.aspx / Legislation.aspx. The legislation page is
 * search-gated, so scraping it always came back empty; the API returns structured JSON
 * with no token for every North Bay client. Docs: https://webapi.legistar.com/Help
 *
 * Deliberately runtime-agnostic (no Deno globals, no URL imports) so the mapping logic
 * runs in both the Supabase edge runtime and vitest.
 */

const API_ROOT = 'https://webapi.legistar.com/v1';
const USER_AGENT = 'LocalGovWatch/1.0 (+https://localgovwatch.com)';

/** Legistar returns wall-clock local times with no offset; every North Bay client is Pacific. */
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A meeting still counts as "in progress" this long after its start time. */
const IN_PROGRESS_WINDOW_HOURS = 3;
/**
 * Brown Act: regular-meeting agendas are posted 72h ahead. Before that point a missing
 * agenda is "not published yet"; after it, the agenda is genuinely unavailable.
 */
const AGENDA_POSTING_HOURS = 72;
const MAX_TITLE_LENGTH = 300;

/** Agenda status Legistar uses for staff-only events that never appear on the public calendar. */
const HIDDEN_AGENDA_STATUS = 'hidden';
/** Clients mark cancellations inconsistently: a "Cancelled" agenda status, or "***CANCELLED***" in the comment. */
const CANCELLED_PATTERN = /cancel/i;
/**
 * Procedural or ceremonial matter types: minutes approvals, closed-session notices,
 * proclamations, commendations. They still show as agenda items on their meeting,
 * but aren't surfaced as legislation.
 */
const PROCEDURAL_MATTER_TYPE = /minutes|closed session|proclamation|gold resolution/i;
/** Some clients file minutes under a generic type like "Consent Calendar". */
const MINUTES_TITLE = /\bmeeting minutes\b|^(draft )?minutes\b/i;
/** Section markers Legistar embeds in plain-text staff reports ("..Title", "..Body"). */
const LEGISTAR_SECTION_MARKER = /^\.\.\w+[ \t]*$/gm;

// ---------------------------------------------------------------------------
// API record shapes: only the fields we read. Full schemas are in the API help pages.
// ---------------------------------------------------------------------------

export interface LegistarEvent {
  EventId: number;
  EventLastModifiedUtc: string;
  EventBodyName: string;
  /** Local calendar date at midnight, e.g. "2026-09-15T00:00:00". The time lives in EventTime. */
  EventDate: string;
  /** Local clock time, e.g. "4:00 PM". */
  EventTime: string | null;
  EventAgendaStatusName: string | null;
  EventMinutesStatusName: string | null;
  EventLocation: string | null;
  EventAgendaFile: string | null;
  EventMinutesFile: string | null;
  EventAgendaLastPublishedUTC: string | null;
  EventMinutesLastPublishedUTC: string | null;
  EventComment: string | null;
  EventVideoPath: string | null;
  EventInSiteURL: string | null;
}

export interface LegistarAttachment {
  MatterAttachmentName: string | null;
  MatterAttachmentHyperlink: string | null;
}

export interface LegistarEventItem {
  EventItemId: number;
  EventItemAgendaSequence: number | null;
  EventItemAgendaNumber: string | null;
  EventItemTitle: string | null;
  EventItemActionName: string | null;
  EventItemMatterId: number | null;
  EventItemMatterType: string | null;
  EventItemMatterAttachments?: LegistarAttachment[];
}

export interface LegistarMatter {
  MatterId: number;
  MatterLastModifiedUtc: string;
  MatterFile: string | null;
  MatterName: string | null;
  MatterTitle: string | null;
  MatterTypeName: string | null;
  MatterStatusName: string | null;
  MatterIntroDate: string | null;
  MatterPassedDate: string | null;
}

interface LegistarMatterVersion {
  Key: string;
  Value: string;
}

interface LegistarMatterText {
  MatterTextPlain: string | null;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Minimal fetch signature, satisfied by both global fetch and helpers.ts politeFetch. */
export type FetchFn = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

/**
 * Derive the API client name from a connector's public site URL.
 * @example legistarClientFromUrl('https://santa-rosa.legistar.com') // 'santa-rosa'
 * @throws Error if the URL is not a *.legistar.com site
 */
export function legistarClientFromUrl(siteUrl: string): string {
  const match = new URL(siteUrl).hostname.match(/^([a-z0-9-]+)\.legistar\.com$/i);
  if (!match) throw new Error(`Not a Legistar site URL: ${siteUrl}`);
  return match[1].toLowerCase();
}

/** OData v3 date literal for $filter, e.g. datetime'2026-09-14'. */
export function odataDate(date: Date): string {
  return `datetime'${date.toISOString().slice(0, 10)}'`;
}

/**
 * Build an API URL by hand so OData keys keep their literal "$" and spaces encode as %20,
 * the form verified against the live API.
 */
export function buildApiUrl(client: string, path: string, query: Record<string, string> = {}): string {
  const params = Object.entries(query).map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return `${API_ROOT}/${client}${path}${params.length > 0 ? `?${params.join('&')}` : ''}`;
}

export class LegistarClient {
  private readonly client: string;
  private readonly fetchFn: FetchFn;

  constructor(client: string, fetchFn: FetchFn = fetch) {
    this.client = client;
    this.fetchFn = fetchFn;
  }

  private async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = buildApiUrl(this.client, path, query);
    const response = await this.fetchFn(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (!response.ok) throw new Error(`Legistar API ${response.status} for ${this.client}${path}`);
    return (await response.json()) as T;
  }

  /** Events whose local date falls within [from, to], oldest first. */
  eventsBetween(from: Date, to: Date): Promise<LegistarEvent[]> {
    return this.get('/events', {
      $filter: `EventDate ge ${odataDate(from)} and EventDate le ${odataDate(to)}`,
      $orderby: 'EventDate',
    });
  }

  /** Agenda items for one event, including each linked matter's attachments. */
  eventItems(eventId: number): Promise<LegistarEventItem[]> {
    return this.get(`/events/${eventId}/eventitems`, { Attachments: '1' });
  }

  /** Matters created or changed since `since` (new items and status changes), newest change first. */
  mattersModifiedSince(since: Date, limit: number): Promise<LegistarMatter[]> {
    return this.get('/matters', {
      $filter: `MatterLastModifiedUtc ge ${odataDate(since)}`,
      $orderby: 'MatterLastModifiedUtc desc',
      $top: String(limit),
    });
  }

  /** Plain text of a matter's latest version (usually the staff report), or null if there is none. */
  async matterText(matterId: number): Promise<string | null> {
    const versions = await this.get<LegistarMatterVersion[]>(`/matters/${matterId}/versions`);
    const latest = latestVersion(versions);
    if (!latest) return null;
    const text = await this.get<LegistarMatterText>(`/matters/${matterId}/texts/${latest.Key}`);
    return text.MatterTextPlain;
  }

  matterAttachments(matterId: number): Promise<LegistarAttachment[]> {
    return this.get(`/matters/${matterId}/attachments`);
  }
}

function latestVersion(versions: LegistarMatterVersion[]): LegistarMatterVersion | null {
  if (versions.length === 0) return null;
  return versions.reduce((latest, version) => (Number(version.Value) > Number(latest.Value) ? version : latest));
}

// ---------------------------------------------------------------------------
// Text, date, and batching utilities
// ---------------------------------------------------------------------------

/** Collapse Legistar's \r\n-riddled text into single-spaced prose. */
export function collapseWhitespace(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Legistar packs "HEADLINE\r\n\r\nexplanatory text" into one title field; split on the first blank line. */
function splitHeadline(text: string): { headline: string; rest: string } {
  const [first = '', ...rest] = text.trim().split(/\r?\n[ \t]*\r?\n/);
  return { headline: collapseWhitespace(first), rest: collapseWhitespace(rest.join(' ')) };
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Join a multi-line address into one line, e.g. "City Hall,\r\n100 Main St" becomes "City Hall, 100 Main St". */
export function formatLocation(location: string | null): string | null {
  if (!location) return null;
  const joined = location
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, ''))
    .filter(Boolean)
    .join(', ');
  return collapseWhitespace(joined) || null;
}

/** Strip Legistar's "..Title"/"..Body" markers and tidy spacing in staff-report text. */
export function cleanMatterText(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(LEGISTAR_SECTION_MARKER, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || null;
}

/** Parse Legistar's "4:00 PM" into 24-hour parts; null when absent or unparseable (e.g. "TBD"). */
export function parseClockTime(time: string | null): { hours: number; minutes: number } | null {
  const match = time?.trim().match(/^(\d{1,2}):(\d{2})\s*([AP])\.?M\.?$/i);
  if (!match) return null;
  const hours = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'P' ? 12 : 0);
  return { hours, minutes: Number(match[2]) };
}

/** Offset of `timeZone` from UTC at `instant`, in ms (negative west of Greenwich, e.g. -7h for PDT). */
function timeZoneOffsetMs(instant: number, timeZone: string): number {
  const wholeSecond = Math.floor(instant / 1000) * 1000;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(wholeSecond));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return wallClockAsUtc - wholeSecond;
}

/**
 * Convert a Legistar local date and clock time to a UTC instant.
 * A missing or unparseable time falls back to local midnight, so the date is still right.
 */
export function localToUtc(localDate: string | null, time: string | null, timeZone = DEFAULT_TIMEZONE): Date | null {
  const match = localDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const clock = parseClockTime(time) ?? { hours: 0, minutes: 0 };
  const wallClockAsUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), clock.hours, clock.minutes);
  // Resolve twice: the first offset is sampled at the wrong instant and can be an hour off across a DST change.
  const firstGuess = wallClockAsUtc - timeZoneOffsetMs(wallClockAsUtc, timeZone);
  return new Date(wallClockAsUtc - timeZoneOffsetMs(firstGuess, timeZone));
}

/** Legistar's *Utc / *UTC fields are UTC but carry no "Z"; without one, Date() would read them as local time. */
export function parseLegistarUtc(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const hasZone = /(z|[+-]\d{2}:\d{2})$/i.test(timestamp);
  const date = new Date(hasZone ? timestamp : `${timestamp}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

/** Run `task` over `items` with at most `limit` calls in flight, so a first-run backfill doesn't hammer the API. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export type MeetingStatus = 'upcoming' | 'in_progress' | 'completed';
export type AgendaStatus = 'available' | 'not_published' | 'unavailable';
export type MinutesStatus = 'approved' | 'draft' | 'not_published';

/** One entry in meeting.attachments, as rendered by src/components/meeting/AgendaItems.tsx. */
export interface AgendaEntry {
  title: string;
  type?: string;
  description?: string;
  document_url?: string;
}

/** Columns of the `meeting` table this connector owns. It never writes ai_summary or extracted_text. */
export interface MeetingRecord {
  external_id: string;
  content_hash: string;
  title: string;
  body_name: string;
  starts_at: string;
  location: string | null;
  agenda_url: string | null;
  agenda_status: AgendaStatus;
  agenda_available_at: string | null;
  minutes_url: string | null;
  minutes_status: MinutesStatus;
  minutes_available_at: string | null;
  recording_url: string | null;
  source_detail_url: string | null;
  status: MeetingStatus;
  attachments: AgendaEntry[];
}

export interface MappedMeeting {
  record: MeetingRecord;
  /**
   * Cancelled meetings are written only if already stored. Anyone following one
   * sees the cancellation, but new ones don't clutter the calendar.
   */
  cancelled: boolean;
}

export function externalEventId(client: string, eventId: number): string {
  return `legistar-${client}-event-${eventId}`;
}

export function externalMatterId(client: string, matterId: number): string {
  return `legistar-${client}-matter-${matterId}`;
}

export function isHiddenEvent(event: LegistarEvent): boolean {
  return (event.EventAgendaStatusName ?? '').toLowerCase() === HIDDEN_AGENDA_STATUS;
}

export function isCancelledEvent(event: LegistarEvent): boolean {
  return CANCELLED_PATTERN.test(`${event.EventAgendaStatusName ?? ''} ${event.EventComment ?? ''}`);
}

export function meetingStatus(startsAt: Date, now: Date): MeetingStatus {
  if (startsAt > now) return 'upcoming';
  if (now.getTime() - startsAt.getTime() < IN_PROGRESS_WINDOW_HOURS * HOUR_MS) return 'in_progress';
  return 'completed';
}

function agendaStatus(event: LegistarEvent, startsAt: Date, now: Date): AgendaStatus {
  if (event.EventAgendaFile) return 'available';
  const postingDeadline = startsAt.getTime() - AGENDA_POSTING_HOURS * HOUR_MS;
  return now.getTime() < postingDeadline ? 'not_published' : 'unavailable';
}

function minutesStatus(event: LegistarEvent): MinutesStatus {
  if (!event.EventMinutesFile) return 'not_published';
  return /final|approved/i.test(event.EventMinutesStatusName ?? '') ? 'approved' : 'draft';
}

/**
 * Turn raw agenda rows into display entries. Legistar interleaves real items with
 * unnumbered boilerplate (Zoom instructions, public-comment rules). Only numbered items
 * and items tied to a matter are kept.
 */
export function mapAgendaItems(items: LegistarEventItem[]): AgendaEntry[] {
  return [...items]
    .sort((a, b) => (a.EventItemAgendaSequence ?? 0) - (b.EventItemAgendaSequence ?? 0))
    .filter((item) => item.EventItemAgendaNumber || item.EventItemMatterId)
    .map(toAgendaEntry)
    .filter((entry): entry is AgendaEntry => entry !== null);
}

function toAgendaEntry(item: LegistarEventItem): AgendaEntry | null {
  const { headline, rest } = splitHeadline(item.EventItemTitle ?? '');
  if (!headline) return null;

  const agendaNumber = item.EventItemAgendaNumber?.trim();
  const fullTitle = agendaNumber ? `${agendaNumber} ${headline}` : headline;
  const entry: AgendaEntry = { title: truncate(fullTitle, MAX_TITLE_LENGTH) };

  const description = [
    entry.title !== fullTitle ? headline : '',
    rest,
    item.EventItemActionName ? `Action: ${item.EventItemActionName}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  if (description) entry.description = description;
  if (item.EventItemMatterType) entry.type = item.EventItemMatterType;

  const documentUrl = item.EventItemMatterAttachments?.find((a) => a.MatterAttachmentHyperlink)?.MatterAttachmentHyperlink;
  if (documentUrl) entry.document_url = documentUrl;
  return entry;
}

/**
 * Map a Legistar event and its agenda items to a meeting row.
 * @returns null for hidden (staff-only) events and events with an unparseable date
 */
export function mapEventToMeeting(
  client: string,
  event: LegistarEvent,
  items: LegistarEventItem[],
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): MappedMeeting | null {
  if (isHiddenEvent(event)) return null;
  const startsAt = localToUtc(event.EventDate, event.EventTime, timeZone);
  if (!startsAt) return null;

  const cancelled = isCancelledEvent(event);
  const bodyName = collapseWhitespace(event.EventBodyName) || 'Public meeting';
  return {
    cancelled,
    record: {
      external_id: externalEventId(client, event.EventId),
      content_hash: event.EventLastModifiedUtc,
      title: cancelled ? `${bodyName} (Cancelled)` : bodyName,
      body_name: bodyName,
      starts_at: startsAt.toISOString(),
      location: formatLocation(event.EventLocation),
      agenda_url: event.EventAgendaFile,
      agenda_status: agendaStatus(event, startsAt, now),
      agenda_available_at: parseLegistarUtc(event.EventAgendaLastPublishedUTC),
      minutes_url: event.EventMinutesFile,
      minutes_status: minutesStatus(event),
      minutes_available_at: parseLegistarUtc(event.EventMinutesLastPublishedUTC),
      recording_url: event.EventVideoPath,
      source_detail_url: event.EventInSiteURL,
      status: meetingStatus(startsAt, now),
      attachments: mapAgendaItems(items),
    },
  };
}

// ---------------------------------------------------------------------------
// Legislation
// ---------------------------------------------------------------------------

/** Values the legislation filters understand, plus "withdrawn", which is not a vote outcome and shouldn't read as "failed". */
export type LegislationStatus = 'introduced' | 'passed' | 'failed' | 'withdrawn';

export interface LegislationDetails {
  text: string | null;
  attachments: LegistarAttachment[];
}

/** Columns of the `legislation` table this connector owns. It never writes summary or ai_summary. */
export interface LegislationRecord {
  external_id: string;
  title: string;
  status: LegislationStatus;
  introduced_at: string | null;
  passed_at: string | null;
  /**
   * Detail fields are present only when text and attachments were fetched this run, so a
   * metadata-only refresh never blanks them. content_hash records which Legistar revision
   * the details came from.
   */
  full_text?: string | null;
  pdf_url?: string | null;
  doc_url?: string | null;
  content_hash?: string;
  /** Official Legistar record page, always present. The UI shows it as the source link. */
  source_url: string;
}

/**
 * Public page for a matter. Detail URLs built from API ids fail ("Invalid parameters!")
 * because the site uses different ids, but the gateway redirects to the right page
 * (verified 2026-09-14 on napacity and santa-rosa).
 */
export function legistarRecordUrl(client: string, matterId: number): string {
  return `https://${client}.legistar.com/gateway.aspx?M=L&ID=${matterId}`;
}

/** Minutes, closed-session notices, and ceremonial items aren't policy, so they're skipped as legislation. */
export function isProceduralMatter(matter: LegistarMatter): boolean {
  if (PROCEDURAL_MATTER_TYPE.test(matter.MatterTypeName ?? '')) return true;
  return MINUTES_TITLE.test(collapseWhitespace(matter.MatterTitle ?? matter.MatterName));
}

/**
 * Collapse each client's own status names into the app's vocabulary. Report dispositions
 * such as "Received and Filed" and "Heard" have no bucket and stay "introduced".
 */
export function legislationStatus(matter: LegistarMatter): LegislationStatus {
  const status = (matter.MatterStatusName ?? '').toLowerCase();
  if (status.includes('withdrawn')) return 'withdrawn';
  if (/fail|denied|reject/.test(status)) return 'failed';
  if (matter.MatterPassedDate || /pass|adopt|approv|enact/.test(status)) return 'passed';
  return 'introduced';
}

/** Map a Legistar matter to a legislation row; pass `details` only when they were fetched this run. */
export function mapMatterToLegislation(
  client: string,
  matter: LegistarMatter,
  details: LegislationDetails | null,
  timeZone: string = DEFAULT_TIMEZONE,
): LegislationRecord {
  const rawTitle = matter.MatterTitle || matter.MatterName || `File ${matter.MatterFile ?? matter.MatterId}`;
  const record: LegislationRecord = {
    external_id: externalMatterId(client, matter.MatterId),
    source_url: legistarRecordUrl(client, matter.MatterId),
    title: truncate(splitHeadline(rawTitle).headline, MAX_TITLE_LENGTH),
    status: legislationStatus(matter),
    introduced_at: localToUtc(matter.MatterIntroDate, null, timeZone)?.toISOString() ?? null,
    passed_at: localToUtc(matter.MatterPassedDate, null, timeZone)?.toISOString() ?? null,
  };
  if (!details) return record;

  const documentUrl = details.attachments.find((a) => a.MatterAttachmentHyperlink)?.MatterAttachmentHyperlink ?? null;
  return {
    ...record,
    full_text: cleanMatterText(details.text) ?? (collapseWhitespace(matter.MatterTitle) || null),
    pdf_url: documentUrl,
    doc_url: documentUrl,
    content_hash: matter.MatterLastModifiedUtc,
  };
}
