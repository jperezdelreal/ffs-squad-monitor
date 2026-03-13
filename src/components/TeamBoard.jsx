import React, { useState, useEffect } from 'react';
import { fetchAllRepoIssues } from '../services/github';
import { AGENTS, getAgentWorkload } from '../services/mockData';

export function TeamBoard() {
  const [agents, setAgents] = useState(AGENTS);
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      const repoIssues = await fetchAllRepoIssues();
      const agentMap = new Map();

      repoIssues.forEach(({ repo, issues }) => {
        issues.forEach(issue => {
          if (issue.state === 'open') {
            issue.labels?.forEach(label => {
              const match = label.name.match(/^squad:(.+)$/);
              if (match) {
                const agentId = match[1].toLowerCase();
                if (!agentMap.has(agentId)) {
                  agentMap.set(agentId, []);
                }
                agentMap.get(agentId).push({
                  number: issue.number,
                  title: issue.title,
                  repo: repo.split('/')[1],
                  url: issue.html_url,
                });
              }
            });
          }
        });
      });

      const updatedAgents = AGENTS.map(agent => {
        const tasks = agentMap.get(agent.id) || [];
        return {
          ...agent,
          status: tasks.length > 0 ? 'active' : 'idle',
          currentTask: tasks.length > 0 ? tasks[0] : null,
          taskCount: tasks.length,
        };
      });

      setAgents(updatedAgents);

      const workloadData = updatedAgents.map(agent => ({
        agent: agent.id,
        count: agent.taskCount || 0,
        label: agent.name,
      }));
      setWorkload(workloadData);
    } catch (error) {
      console.error('Failed to load team data:', error);
      setWorkload(getAgentWorkload());
    } finally {
      setLoading(false);
    }
  };

  const maxWorkload = Math.max(...workload.map(w => w.count), 1);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="text-center text-gray-400">
          Loading team data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Team Board</h2>
          <button
            onClick={loadTeamData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map(agent => (
          <div
            key={agent.id}
            className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="text-4xl">{agent.emoji}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{agent.name}</h3>
                <p className="text-sm text-gray-400">{agent.role}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`} />
            </div>

            {agent.currentTask ? (
              <div className="mt-3 p-2 bg-gray-700 rounded border border-gray-600">
                <div className="text-xs text-gray-400 mb-1">Current Task:</div>
                {typeof agent.currentTask === 'string' ? (
                  <p className="text-sm text-white">{agent.currentTask}</p>
                ) : (
                  <a
                    href={agent.currentTask.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 block truncate"
                  >
                    #{agent.currentTask.number} {agent.currentTask.title}
                  </a>
                )}
                {agent.taskCount > 1 && (
                  <div className="text-xs text-gray-400 mt-1">
                    +{agent.taskCount - 1} more task{agent.taskCount > 2 ? 's' : ''}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 p-2 bg-gray-700 rounded border border-gray-600">
                <p className="text-sm text-gray-400 italic">No active tasks</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Workload Distribution (Last 7 Days)</h3>
        <div className="space-y-3">
          {workload.map(item => (
            <div key={item.agent} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-400 truncate">{item.label}</div>
              <div className="flex-1 bg-gray-700 rounded-full h-8 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-blue-600 transition-all duration-300"
                  style={{ width: `${(item.count / maxWorkload) * 100}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-medium text-white relative z-10">
                    {item.count} issue{item.count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
