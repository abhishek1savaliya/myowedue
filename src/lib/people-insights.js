/**
 * Aggregate people-page balances for Pro insights panel.
 * @param {Array<{ id: string; name: string; given: number; received: number; due: number; direction: string }>} entries
 */
export function buildPeopleInsights(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let totalGiven = 0;
  let totalReceived = 0;
  let receivable = 0;
  let payable = 0;
  let settledCount = 0;

  const owedToYou = [];
  const youOwe = [];

  for (const row of list) {
    totalGiven += Number(row.given || 0);
    totalReceived += Number(row.received || 0);
    const due = Number(row.due || 0);

    if (row.direction === "person_owes_you") {
      receivable += due;
      owedToYou.push(row);
    } else if (row.direction === "you_owe_person") {
      payable += due;
      youOwe.push(row);
    } else {
      settledCount += 1;
    }
  }

  owedToYou.sort((a, b) => b.due - a.due);
  youOwe.sort((a, b) => b.due - a.due);

  const collectionEfficiency =
    totalGiven > 0 ? Math.min(100, Math.round((totalReceived / totalGiven) * 100)) : 0;
  const netExposure = receivable - payable;

  return {
    contactCount: list.length,
    totalGiven,
    totalReceived,
    receivable,
    payable,
    netExposure,
    collectionEfficiency,
    settledCount,
    topOwedToYou: owedToYou.slice(0, 3),
    topYouOwe: youOwe.slice(0, 3),
    activeWithDue: list.length - settledCount,
  };
}
