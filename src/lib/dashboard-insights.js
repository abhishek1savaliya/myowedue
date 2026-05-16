/**
 * Derive Pro-only advanced dashboard metrics from dashboard API payload.
 * @param {object} data
 */
export function buildAdvancedDashboardInsights(data) {
  const currency = data?.currency || "USD";
  const totalGiven = Number(data?.totals?.totalGiven || 0);
  const totalReceived = Number(data?.totals?.totalReceivedBack || 0);
  const pendingNet = Number(data?.pendingNet || 0);
  const peopleCount = Number(data?.peopleCount || 0);
  const pendingCount = Number(data?.notificationCount || 0);

  const collectionEfficiency =
    totalGiven > 0 ? Math.min(100, Math.round((totalReceived / totalGiven) * 100)) : 0;
  const openExposure = Math.abs(pendingNet);
  const netPosition = totalReceived - totalGiven;
  const avgPendingPerPerson = peopleCount > 0 ? openExposure / peopleCount : 0;

  const personRows = (data?.personInsights || []).map((row) => {
    const given = Number(row.credit || 0);
    const received = Number(row.debit || 0);
    const total = given + received;
    const net = received - given;
    return {
      name: row.person || "Unknown",
      given,
      received,
      total,
      net,
    };
  });

  personRows.sort((a, b) => b.total - a.total);
  const topPeople = personRows.slice(0, 5);
  const topPerson = topPeople[0] || null;

  const monthRows = (data?.monthlyInsights || []).map((row) => {
    const given = Number(row.credit || 0);
    const received = Number(row.debit || 0);
    return {
      month: row.month,
      given,
      received,
      total: given + received,
    };
  });
  monthRows.sort((a, b) => b.total - a.total);
  const topMonth = monthRows[0] || null;

  const totalPersonVolume = personRows.reduce((sum, row) => sum + row.total, 0);
  const concentrationPct =
    topPerson && totalPersonVolume > 0 ? Math.round((topPerson.total / totalPersonVolume) * 100) : 0;

  return {
    currency,
    collectionEfficiency,
    openExposure,
    netPosition,
    avgPendingPerPerson,
    pendingCount,
    peopleCount,
    topPerson,
    topMonth,
    topPeople,
    concentrationPct,
    totalGiven,
    totalReceived,
  };
}
