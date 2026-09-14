/**
 * Database helpers shared by the Legistar meeting and legislation connectors.
 * Mapping lives in legistarApi.ts; this file is the only Legistar code that talks to Postgres.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { chunk, mapWithConcurrency } from './legistarApi.ts';

/** PostgREST puts .in() filters in the URL, so chunking keeps requests under proxy URL-length limits. */
const IN_FILTER_CHUNK_SIZE = 100;
const NOTIFY_CONCURRENCY = 4;

export interface ExistingRow {
  id: string;
  content_hash: string | null;
}

/**
 * Look up rows this source already stored, keyed by external_id, in a few batched
 * queries rather than one per item.
 * @throws Error if a lookup query fails, since writing blind would create duplicates
 */
export async function findExistingRows(
  supabase: SupabaseClient,
  table: 'meeting' | 'legislation',
  sourceId: string,
  externalIds: string[],
): Promise<Map<string, ExistingRow>> {
  const existing = new Map<string, ExistingRow>();
  for (const ids of chunk(externalIds, IN_FILTER_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from(table)
      .select('id, external_id, content_hash')
      .eq('source_id', sourceId)
      .in('external_id', ids);
    if (error) throw new Error(`Lookup in ${table} failed: ${error.message}`);
    for (const row of data ?? []) existing.set(row.external_id, { id: row.id, content_hash: row.content_hash });
  }
  return existing;
}

/** Run the tracked-terms matcher on newly inserted items so alert emails go out. Failures are logged, never fatal. */
export async function notifyTrackedTerms(
  supabaseUrl: string,
  serviceKey: string,
  itemType: 'meeting' | 'legislation',
  itemIds: string[],
): Promise<void> {
  await mapWithConcurrency(itemIds, NOTIFY_CONCURRENCY, async (itemId) => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/check-tracked-terms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ itemType, itemId }),
      });
    } catch (error) {
      console.error(`check-tracked-terms failed for ${itemType} ${itemId}:`, error);
    }
  });
}
