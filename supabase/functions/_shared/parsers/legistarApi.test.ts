import { describe, expect, it } from 'vitest';
import eventFixture from '../fixtures/legistar/event.json';
import eventItemsFixture from '../fixtures/legistar/eventitems.json';
import mattersFixture from '../fixtures/legistar/matters.json';
import matterTextFixture from '../fixtures/legistar/matter-text.json';
import matterAttachmentsFixture from '../fixtures/legistar/matter-attachments.json';
import {
  buildApiUrl,
  chunk,
  cleanMatterText,
  FetchFn,
  formatLocation,
  isProceduralMatter,
  legislationStatus,
  LegistarClient,
  legistarClientFromUrl,
  LegistarEvent,
  LegistarEventItem,
  LegistarMatter,
  localToUtc,
  mapAgendaItems,
  mapEventToMeeting,
  mapMatterToLegislation,
  mapWithConcurrency,
  parseClockTime,
  parseLegistarUtc,
} from './legistarApi.ts';

// Fixtures are real API responses recorded 2026-09-14 (Santa Rosa event 5416, Napa city matters).
const event = eventFixture as LegistarEvent;
const eventItems = eventItemsFixture as LegistarEventItem[];
const matters = mattersFixture as LegistarMatter[];
const BEFORE_MEETING = new Date('2026-09-14T12:00:00Z');

describe('legistarClientFromUrl', () => {
  it('derives the API client from the public site URL', () => {
    expect(legistarClientFromUrl('https://santa-rosa.legistar.com')).toBe('santa-rosa');
    expect(legistarClientFromUrl('https://NapaCity.legistar.com/')).toBe('napacity');
  });

  it('rejects non-Legistar URLs', () => {
    expect(() => legistarClientFromUrl('https://example.com')).toThrow(/Not a Legistar site URL/);
  });
});

describe('buildApiUrl', () => {
  it('keeps OData keys literal and encodes spaces as %20', () => {
    expect(buildApiUrl('napa', '/events', { $filter: "EventDate ge datetime'2026-09-01'" })).toBe(
      "https://webapi.legistar.com/v1/napa/events?$filter=EventDate%20ge%20datetime'2026-09-01'",
    );
  });
});

describe('time handling', () => {
  it('parses Legistar clock times', () => {
    expect(parseClockTime('4:00 PM')).toEqual({ hours: 16, minutes: 0 });
    expect(parseClockTime('12:15 AM')).toEqual({ hours: 0, minutes: 15 });
    expect(parseClockTime('12:00 PM')).toEqual({ hours: 12, minutes: 0 });
    expect(parseClockTime('9:30 a.m.')).toEqual({ hours: 9, minutes: 30 });
    expect(parseClockTime('TBD')).toBeNull();
    expect(parseClockTime(null)).toBeNull();
  });

  it('converts Pacific wall-clock time to UTC across DST', () => {
    expect(localToUtc('2026-09-15T00:00:00', '4:00 PM')?.toISOString()).toBe('2026-09-15T23:00:00.000Z'); // PDT
    expect(localToUtc('2026-12-01T00:00:00', '6:00 PM')?.toISOString()).toBe('2026-12-02T02:00:00.000Z'); // PST
    expect(localToUtc('2026-03-08T00:00:00', '10:00 AM')?.toISOString()).toBe('2026-03-08T17:00:00.000Z'); // DST starts
    expect(localToUtc('2026-11-01T00:00:00', '6:00 PM')?.toISOString()).toBe('2026-11-02T02:00:00.000Z'); // DST ends
  });

  it('falls back to local midnight when the time is missing', () => {
    expect(localToUtc('2026-09-15T00:00:00', null)?.toISOString()).toBe('2026-09-15T07:00:00.000Z');
  });

  it('honors a non-Pacific zone', () => {
    expect(localToUtc('2026-09-24T00:00:00', '10:00 AM', 'America/Chicago')?.toISOString()).toBe('2026-09-24T15:00:00.000Z');
  });

  it('reads zone-less *Utc stamps as UTC', () => {
    expect(parseLegistarUtc('2026-09-11T15:46:32.993')).toBe('2026-09-11T15:46:32.993Z');
    expect(parseLegistarUtc(null)).toBeNull();
  });
});

describe('formatLocation', () => {
  it('joins multi-line addresses without doubled commas', () => {
    expect(formatLocation(event.EventLocation)).toBe('City Hall, Council Chamber, 100 Santa Rosa Avenue, Santa Rosa, CA 95404');
    expect(formatLocation(null)).toBeNull();
  });
});

describe('mapAgendaItems', () => {
  const entries = mapAgendaItems(eventItems);

  it('drops unnumbered boilerplate and keeps real items in agenda order', () => {
    expect(entries.map((e) => e.title)).toEqual([
      '7.1 PROCLAMATION - NATIONAL TRANSIT MONTH',
      '7.2 PROCLAMATION - CREEK WEEK 2026',
      '8.1 COMMUNITY EMPOWERMENT PLAN UPDATE',
      '12.2 August 18, 2026, Regular Meeting Minutes.',
    ]);
  });

  it('splits headline from explanatory text and keeps type and document link', () => {
    expect(entries[2]).toEqual({
      title: '8.1 COMMUNITY EMPOWERMENT PLAN UPDATE',
      description:
        'This is a standing item on the agenda. Council will take no action except for possible direction to staff. This item has no impact on current fiscal year budget.',
      type: 'CC- Staff Briefing',
    });
    expect(entries[0].document_url).toBe('https://legistar.granicus.com/santarosa/attachments/b492d2c1-de5a-41bc-8776-3d0aec7f3b7b.pdf');
  });

  it('truncates very long titles and preserves the full text in the description', () => {
    const [entry] = mapAgendaItems([{ ...eventItems[3], EventItemTitle: 'X'.repeat(400) }]);
    expect(entry.title).toHaveLength(300);
    expect(entry.title.endsWith('…')).toBe(true);
    expect(entry.description).toBe('X'.repeat(400));
  });
});

describe('mapEventToMeeting', () => {
  it('maps the recorded Santa Rosa council meeting', () => {
    const mapped = mapEventToMeeting('santa-rosa', event, eventItems, BEFORE_MEETING);
    expect(mapped?.cancelled).toBe(false);
    expect(mapped?.record).toMatchObject({
      external_id: 'legistar-santa-rosa-event-5416',
      title: 'City Council',
      body_name: 'City Council',
      starts_at: '2026-09-15T23:00:00.000Z',
      status: 'upcoming',
      agenda_status: 'available',
      agenda_url: event.EventAgendaFile,
      agenda_available_at: '2026-09-11T15:46:32.993Z',
      minutes_status: 'not_published',
      minutes_url: null,
      source_detail_url: event.EventInSiteURL,
      content_hash: '2026-09-11T15:46:33.117',
    });
    expect(mapped?.record.attachments).toHaveLength(4);
  });

  it('moves status with the clock', () => {
    const status = (now: string) => mapEventToMeeting('santa-rosa', event, [], new Date(now))?.record.status;
    expect(status('2026-09-16T00:00:00Z')).toBe('in_progress'); // 1h after start
    expect(status('2026-09-16T03:00:00Z')).toBe('completed'); // 4h after start
  });

  it('flags cancellations from either the status or the comment', () => {
    const byStatus = mapEventToMeeting('santa-rosa', { ...event, EventAgendaStatusName: 'Cancelled' }, [], BEFORE_MEETING);
    const byComment = mapEventToMeeting('napa', { ...event, EventComment: '***CANCELLED***' }, [], BEFORE_MEETING);
    expect(byStatus?.cancelled).toBe(true);
    expect(byStatus?.record.title).toBe('City Council (Cancelled)');
    expect(byComment?.cancelled).toBe(true);
  });

  it('skips hidden staff-only events', () => {
    expect(mapEventToMeeting('napa', { ...event, EventAgendaStatusName: 'Hidden' }, [], BEFORE_MEETING)).toBeNull();
  });

  it('distinguishes a not-yet-posted agenda from a missing one', () => {
    const noAgenda = { ...event, EventAgendaFile: null };
    const agendaStatus = (now: string) => mapEventToMeeting('santa-rosa', noAgenda, [], new Date(now))?.record.agenda_status;
    expect(agendaStatus('2026-09-10T12:00:00Z')).toBe('not_published'); // 5 days out
    expect(agendaStatus('2026-09-15T12:00:00Z')).toBe('unavailable'); // same day
  });

  it('reads minutes status', () => {
    const withMinutes = (statusName: string) =>
      mapEventToMeeting('santa-rosa', { ...event, EventMinutesFile: 'https://x/m.pdf', EventMinutesStatusName: statusName }, [], BEFORE_MEETING)
        ?.record.minutes_status;
    expect(withMinutes('Final')).toBe('approved');
    expect(withMinutes('Draft')).toBe('draft');
  });
});

describe('legislation', () => {
  it('filters procedural matters: minutes and closed session', () => {
    expect(matters.map(isProceduralMatter)).toEqual([false, true, true, true]);
  });

  it('maps statuses into the app vocabulary', () => {
    const withStatus = (MatterStatusName: string, MatterPassedDate: string | null = null) =>
      legislationStatus({ ...matters[0], MatterStatusName, MatterPassedDate });
    expect(withStatus('Agenda Ready')).toBe('introduced');
    expect(withStatus('Passed')).toBe('passed');
    expect(withStatus('Agenda Ready', '2026-09-15T00:00:00')).toBe('passed');
    expect(withStatus('Withdrawn')).toBe('withdrawn');
    expect(withStatus('Failed')).toBe('failed');
    expect(withStatus('Received and Filed')).toBe('introduced');
  });

  it('maps a matter with fetched details', () => {
    const record = mapMatterToLegislation('napacity', matters[0], {
      text: matterTextFixture.MatterTextPlain,
      attachments: matterAttachmentsFixture,
    });
    expect(record).toMatchObject({
      external_id: 'legistar-napacity-matter-9996',
      source_url: 'https://napacity.legistar.com/gateway.aspx?M=L&ID=9996',
      title: 'League of California Cities (“Cal Cities”) 2026 Resolution Voting Authorization',
      status: 'introduced',
      introduced_at: '2026-09-10T07:00:00.000Z',
      passed_at: null,
      pdf_url: 'https://napacity.legistar1.com/napacity/attachments/d603ab18-eb66-48a1-84af-7d0311f03878.pdf',
      content_hash: '2026-09-10T22:17:00.103',
    });
    expect(record.full_text).toContain('RECOMMENDED ACTION:');
    expect(record.full_text).not.toContain('..Title');
  });

  it('omits detail fields when details were not fetched, so updates never blank them', () => {
    const record = mapMatterToLegislation('napacity', matters[0], null);
    expect(record).not.toHaveProperty('full_text');
    expect(record).not.toHaveProperty('pdf_url');
    expect(record).not.toHaveProperty('content_hash');
  });

  it('cleans staff-report text', () => {
    expect(cleanMatterText('TITLE:\n..Title\nBudget amendment\n\n\n\n..Body\nDetails')).toBe('TITLE:\n\nBudget amendment\n\nDetails');
    expect(cleanMatterText(null)).toBeNull();
  });
});

describe('LegistarClient', () => {
  const fakeFetch = (routes: Record<string, unknown>, calls: string[]): FetchFn => async (url) => {
    calls.push(url);
    const route = Object.keys(routes).find((path) => url.includes(path));
    return route ? new Response(JSON.stringify(routes[route])) : new Response('not found', { status: 404 });
  };

  it('reads the text of the latest matter version', async () => {
    const calls: string[] = [];
    const api = new LegistarClient('napacity', fakeFetch({
      '/matters/9996/versions': [{ Key: '100', Value: '1' }, { Key: '200', Value: '2' }],
      '/matters/9996/texts/200': { MatterTextPlain: 'staff report' },
    }, calls));
    expect(await api.matterText(9996)).toBe('staff report');
    expect(calls[1]).toBe('https://webapi.legistar.com/v1/napacity/matters/9996/texts/200');
  });

  it('builds the event window query', async () => {
    const calls: string[] = [];
    await new LegistarClient('napa', fakeFetch({ '/events': [] }, calls)).eventsBetween(
      new Date('2026-09-01T12:00:00Z'),
      new Date('2026-10-01T12:00:00Z'),
    );
    expect(calls[0]).toBe(
      "https://webapi.legistar.com/v1/napa/events?$filter=EventDate%20ge%20datetime'2026-09-01'%20and%20EventDate%20le%20datetime'2026-10-01'&$orderby=EventDate",
    );
  });

  it('throws on HTTP errors', async () => {
    const api = new LegistarClient('napa', fakeFetch({}, []));
    await expect(api.eventItems(1)).rejects.toThrow(/Legistar API 404/);
  });
});

describe('batching helpers', () => {
  it('chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('caps concurrency and preserves order', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, n));
      inFlight--;
      return n * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30]);
    expect(maxInFlight).toBe(2);
  });
});
