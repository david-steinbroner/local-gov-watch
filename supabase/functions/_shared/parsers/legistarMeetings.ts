import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { politeFetch, IngestStats, addError } from '../helpers.ts';
import { determineMeetingType } from '../meetingTypeHelper.ts';
import {
  addDays,
  errorMessage,
  LegistarClient,
  legistarClientFromUrl,
  MappedMeeting,
  mapEventToMeeting,
  mapWithConcurrency,
  MeetingRecord,
} from './legistarApi.ts';
import { findExistingRows, notifyTrackedTerms } from './legistarStore.ts';

/** The recent past picks up minutes and video posted after a meeting; the lookahead covers noticed meetings. */
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 60;
const API_CONCURRENCY = 4;

function withMeetingType(record: MeetingRecord) {
  const { meetingType, isLegislative } = determineMeetingType(record.body_name);
  return { ...record, meeting_type: meetingType, is_legislative: isLegislative };
}

/**
 * Sync one Legistar client's meetings (and their agenda items) into `meeting`.
 * Existing rows are refreshed every run, because status moves with the clock
 * (upcoming, then in progress, then completed) even when Legistar data doesn't change.
 * @throws Error if the event list can't be fetched, so run-connector records the run as failed
 */
export async function parseLegistarMeetings(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string,
  jurisdictionId: string,
  baseUrl: string,
  stats: IngestStats,
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const client = legistarClientFromUrl(baseUrl);
  const api = new LegistarClient(client, politeFetch);
  const now = new Date();

  const events = await api.eventsBetween(addDays(now, -LOOKBACK_DAYS), addDays(now, LOOKAHEAD_DAYS));
  stats.fetched = events.length;

  const mapped = await mapWithConcurrency(events, API_CONCURRENCY, async (event) => {
    try {
      return mapEventToMeeting(client, event, await api.eventItems(event.EventId), now);
    } catch (error) {
      addError(stats, `Event ${event.EventId}: ${errorMessage(error)}`);
      return null;
    }
  });
  const meetings = mapped.filter((meeting): meeting is MappedMeeting => meeting !== null);
  stats.parsed = meetings.length;

  const existing = await findExistingRows(supabase, 'meeting', sourceId, meetings.map((m) => m.record.external_id));
  const toUpdate = meetings.filter((m) => existing.has(m.record.external_id));
  const toInsert = meetings.filter((m) => !existing.has(m.record.external_id) && !m.cancelled);
  // Hidden, unparseable, and newly seen cancelled meetings are all intentionally not written.
  stats.skippedCount += events.length - toUpdate.length - toInsert.length;

  for (const { record } of toUpdate) {
    const { error } = await supabase
      .from('meeting')
      .update({ ...withMeetingType(record), updated_at: now.toISOString() })
      .eq('id', existing.get(record.external_id)!.id);
    if (error) addError(stats, `Update ${record.external_id}: ${error.message}`);
    else stats.updatedCount++;
  }

  if (toInsert.length === 0) return;
  const { data: inserted, error } = await supabase
    .from('meeting')
    .insert(toInsert.map(({ record }) => ({ ...withMeetingType(record), source_id: sourceId, jurisdiction_id: jurisdictionId })))
    .select('id');
  if (error) {
    addError(stats, `Insert meetings: ${error.message}`);
    return;
  }
  stats.newCount += inserted.length;
  await notifyTrackedTerms(supabaseUrl, supabaseKey, 'meeting', inserted.map((row) => row.id));
}
