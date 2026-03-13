export function getAgentWorkload() {
  return [];
}

export function getCostHistory() {
  const days = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push({
      date: date.toISOString().split('T')[0],
      actual: 0,
      budget: 500 / 30,
    });
  }
  
  return days;
}

export function getCIMinutesUsage() {
  return {
    used: 420,
    total: 2000,
    percentage: 21,
  };
}
