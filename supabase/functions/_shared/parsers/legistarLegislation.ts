import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { politeFetch, IngestStats, addError, extractKeywordTags } from '../helpers.ts';
import {
  addDays,
  chunk,
  errorMessage,
  externalMatterId,
  isProceduralMatter,
  LegislationDetails,
  LegistarClient,
  legistarClientFromUrl,
  mapMatterToLegislation,
  mapWithConcurrency,
} from './legistarApi.ts';
import { findExistingRows, notifyTrackedTerms } from './legistarStore.ts';

/** Every run re-lists matters changed in this window, which catches new items and later status changes. */
const LOOKBACK_DAYS = 90;
/** Deliberately not the old LEGISLATION_PAGE_LIMIT: that secret meant "items to scrape" (default 10) and would starve this list. */
const LIST_LIMIT = parseInt(Deno.env.get('LEGISTAR_MATTER_LIST_LIMIT') || '500');
/**
 * Text plus attachments cost three API calls per matter. Capping them per run spreads a
 * first backfill (about 250 matters per client) across a few scheduled runs.
 */
const DETAIL_FETCH_LIMIT = parseInt(Deno.env.get('LEGISLATION_DETAIL_LIMIT') || '60');
const API_CONCURRENCY = 4;
/** One bad row fails its whole insert batch, so batches stay small. */
const INSERT_BATCH_SIZE = 50;

/**
 * Sync one Legistar client's matters (ordinances, resolutions, staff reports) into `legislation`.
 * Unchanged matters are skipped: content_hash stores the Legistar revision last fetched in full.
 * @throws Error if the matter list can't be fetched, so run-connector records the run as failed
 */
export async function parseLegistarLegislation(
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

  const listed = await api.mattersModifiedSince(addDays(new Date(), -LOOKBACK_DAYS), LIST_LIMIT);
  const matters = listed.filter((matter) => !isProceduralMatter(matter));
  stats.fetched = listed.length;
  stats.parsed = matters.length;
  stats.skippedCount += listed.length - matters.length;

  const existing = await findExistingRows(supabase, 'legislation', sourceId, matters.map((m) => externalMatterId(client, m.MatterId)));
  const changed = matters.filter((m) => existing.get(externalMatterId(client, m.MatterId))?.content_hash !== m.MatterLastModifiedUtc);
  stats.skippedCount += matters.length - changed.length;

  const details = new Map<number, LegislationDetails>();
  await mapWithConcurrency(changed.slice(0, DETAIL_FETCH_LIMIT), API_CONCURRENCY, async (matter) => {
    try {
      const [text, attachments] = await Promise.all([api.matterText(matter.MatterId), api.matterAttachments(matter.MatterId)]);
      details.set(matter.MatterId, { text, attachments });
    } catch (error) {
      addError(stats, `Matter ${matter.MatterId} details: ${errorMessage(error)}`);
    }
  });

  const now = new Date().toISOString();
  const toInsert: Record<string, unknown>[] = [];
  for (const matter of changed) {
    const record = mapMatterToLegislation(client, matter, details.get(matter.MatterId) ?? null);
    // Tags come from type and title only: substring keyword matching over full staff reports tags nearly everything.
    const values = { ...record, tags: extractKeywordTags(`${matter.MatterTypeName ?? ''} ${record.title}`), updated_at: now };
    const row = existing.get(record.external_id);
    if (!row) {
      toInsert.push({ ...values, source_id: sourceId, jurisdiction_id: jurisdictionId });
      continue;
    }
    const { error } = await supabase.from('legislation').update(values).eq('id', row.id);
    if (error) addError(stats, `Update ${record.external_id}: ${error.message}`);
    else stats.updatedCount++;
  }

  const insertedIds: string[] = [];
  for (const batch of chunk(toInsert, INSERT_BATCH_SIZE)) {
    const { data, error } = await supabase.from('legislation').insert(batch).select('id');
    if (error) {
      addError(stats, `Insert legislation batch: ${error.message}`);
      continue;
    }
    insertedIds.push(...data.map((row) => row.id));
  }
  stats.newCount += insertedIds.length;
  await notifyTrackedTerms(supabaseUrl, supabaseKey, 'legislation', insertedIds);
}
