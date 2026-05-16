/**
 * @param {Array<{ startTime: string; endTime?: string; location?: string; allDay?: boolean; title?: string; timezone?: string }>} events
 */
export function buildEventsInsights(events = []) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  let upcomingCount = 0;
  let pastCount = 0;
  let thisMonthCount = 0;
  let withLocationCount = 0;
  let allDayCount = 0;
  const upcomingList = [];

  for (const event of events) {
    const start = new Date(event.startTime);
    if (Number.isNaN(start.getTime())) continue;

    if (start >= now) {
      upcomingCount += 1;
      upcomingList.push(event);
    } else {
      pastCount += 1;
    }

    if (start >= monthStart && start <= monthEnd) {
      thisMonthCount += 1;
    }
    if (String(event.location || "").trim()) {
      withLocationCount += 1;
    }
    if (event.allDay) {
      allDayCount += 1;
    }
  }

  upcomingList.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const next = upcomingList[0];

  return {
    totalCount: events.length,
    upcomingCount,
    pastCount,
    thisMonthCount,
    withLocationCount,
    allDayCount,
    nextEvent: next
      ? {
          title: next.title || "Upcoming event",
          startTime: next.startTime,
          timezone: next.timezone,
          allDay: Boolean(next.allDay),
        }
      : null,
  };
}
