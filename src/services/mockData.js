export const AGENTS = [
  {
    id: 'morpheus',
    name: 'Morpheus',
    emoji: '🕶️',
    role: 'Lead Architect',
    status: 'active',
    currentTask: 'Reviewing pipeline architecture',
  },
  {
    id: 'trinity',
    name: 'Trinity',
    emoji: '⚡',
    role: 'Full-Stack Developer',
    status: 'active',
    currentTask: 'Building Squad Monitor features',
  },
  {
    id: 'tank',
    name: 'Tank',
    emoji: '☁️',
    role: 'Cloud Engineer',
    status: 'idle',
    currentTask: null,
  },
  {
    id: 'switch',
    name: 'Switch',
    emoji: '🧪',
    role: 'QA Engineer',
    status: 'idle',
    currentTask: null,
  },
  {
    id: 'oracle',
    name: 'Oracle',
    emoji: '📚',
    role: 'Product Manager',
    status: 'active',
    currentTask: 'Documenting game catalog',
  },
  {
    id: 'copilot',
    name: '@copilot',
    emoji: '🤖',
    role: 'Coding Agent',
    status: 'active',
    currentTask: 'Code generation support',
  },
  {
    id: 'scribe',
    name: 'Scribe',
    emoji: '📝',
    role: 'Documentation',
    status: 'idle',
    currentTask: null,
  },
  {
    id: 'ralph',
    name: 'Ralph',
    emoji: '💚',
    role: 'Heartbeat Monitor',
    status: 'active',
    currentTask: 'System health tracking',
  },
];

export function getAgentWorkload() {
  return [
    { agent: 'morpheus', count: 5, label: 'Morpheus' },
    { agent: 'trinity', count: 8, label: 'Trinity' },
    { agent: 'tank', count: 2, label: 'Tank' },
    { agent: 'switch', count: 3, label: 'Switch' },
    { agent: 'oracle', count: 6, label: 'Oracle' },
    { agent: 'copilot', count: 12, label: '@copilot' },
    { agent: 'scribe', count: 1, label: 'Scribe' },
    { agent: 'ralph', count: 1, label: 'Ralph' },
  ];
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
