import { describe, expect, it } from 'vitest';
import {
  addDays,
  isProceduralMatter,
  LegistarClient,
  MappedMeeting,
  mapEventToMeeting,
  mapMatterToLegislation,
} from './legistarApi.ts';

// Hits the real Legistar API for every North Bay client. Skipped in the normal suite;
// run with `npm run test:live` to confirm the API and our mapping still agree.
const NORTH_BAY_CLIENTS = ['sonoma-county', 'napa', 'santa-rosa', 'napacity'];
const LIVE_TIMEOUT_MS = 60_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!process.env.LEGISTAR_LIVE)('Legistar API (live)', () => {
  it.each(NORTH_BAY_CLIENTS)(
    '%s: meetings map to valid rows',
    async (client) => {
      const api = new LegistarClient(client);
      const now = new Date();
      const events = await api.eventsBetween(addDays(now, -30), addDays(now, 60));
      expect(events.length).toBeGreaterThan(0);

      const mapped = await Promise.all(
        events.slice(0, 3).map(async (event) => mapEventToMeeting(client, event, await api.eventItems(event.EventId), now)),
      );
      const meetings = mapped.filter((m): m is MappedMeeting => m !== null);
      expect(meetings.length).toBeGreaterThan(0);
      for (const { record } of meetings) {
        expect(Number.isNaN(Date.parse(record.starts_at))).toBe(false);
        expect(record.body_name.length).toBeGreaterThan(0);
      }
    },
    LIVE_TIMEOUT_MS,
  );

  it.each(NORTH_BAY_CLIENTS)(
    '%s: recent legislation lists, filters, and fetches details',
    async (client) => {
      const api = new LegistarClient(client);
      const since = addDays(new Date(), -90);
      const matters = await api.mattersModifiedSince(since, 50);
      expect(matters.length).toBeGreaterThan(0);
      // A silently ignored $filter would return all history, so check the window held.
      for (const matter of matters) {
        expect(Date.parse(`${matter.MatterLastModifiedUtc}Z`)).toBeGreaterThanOrEqual(since.getTime() - ONE_DAY_MS);
      }

      const policyMatter = matters.find((m) => !isProceduralMatter(m));
      expect(policyMatter).toBeDefined();
      const [text, attachments] = await Promise.all([
        api.matterText(policyMatter!.MatterId),
        api.matterAttachments(policyMatter!.MatterId),
      ]);
      const record = mapMatterToLegislation(client, policyMatter!, { text, attachments });
      expect(record.title.length).toBeGreaterThan(0);
      expect(record.content_hash).toBe(policyMatter!.MatterLastModifiedUtc);
    },
    LIVE_TIMEOUT_MS,
  );
});
