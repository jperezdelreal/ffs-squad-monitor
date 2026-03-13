import React, { useState, useEffect } from 'react';
import { fetchAllRepoIssues, REPOS } from '../services/github';

const STAGES = [
  { id: 'proposal', name: 'Proposal', emoji: '💡' },
  { id: 'gdd', name: 'GDD', emoji: '📋' },
  { id: 'issues', name: 'Issues', emoji: '🎯' },
  { id: 'code', name: 'Code', emoji: '💻' },
  { id: 'build', name: 'Build', emoji: '🔨' },
  { id: 'deploy', name: 'Deploy', emoji: '🚀' },
];

export function PipelineVisualizer() {
  const [pipelineData, setPipelineData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    loadPipelineData();
  }, []);

  const loadPipelineData = async () => {
    setLoading(true);
    try {
      const repoIssues = await fetchAllRepoIssues();
      const data = {};

      repoIssues.forEach(({ repo, issues }) => {
        const repoName = repo.split('/')[1];
        data[repoName] = {
          proposal: analyzeStage(issues, 'pipeline:proposal'),
          gdd: analyzeStage(issues, 'pipeline:gdd'),
          issues: analyzeStage(issues, 'pipeline:issues'),
          code: analyzeStage(issues, 'pipeline:code'),
          build: analyzeStage(issues, 'pipeline:build'),
          deploy: analyzeStage(issues, 'pipeline:deploy'),
        };
      });

      setPipelineData(data);
    } catch (error) {
      console.error('Failed to load pipeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeStage = (issues, label) => {
    const stageIssues = issues.filter(issue => 
      issue.labels?.some(l => l.name === label)
    );

    if (stageIssues.length === 0) {
      return { status: 'pending', count: 0, issues: [] };
    }

    const open = stageIssues.filter(i => i.state === 'open');
    const closed = stageIssues.filter(i => i.state === 'closed');

    let status = 'pending';
    if (open.length > 0) {
      status = 'in-progress';
    } else if (closed.length > 0) {
      status = 'complete';
    }

    const hasBlockedLabel = stageIssues.some(i => 
      i.labels?.some(l => l.name.includes('blocked'))
    );
    if (hasBlockedLabel) {
      status = 'blocked';
    }

    return {
      status,
      count: stageIssues.length,
      issues: stageIssues.slice(0, 5).map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        url: i.html_url,
      })),
    };
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-600',
      'in-progress': 'bg-yellow-600',
      complete: 'bg-green-600',
      blocked: 'bg-red-600',
    };
    return colors[status] || colors.pending;
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏳',
      'in-progress': '🔄',
      complete: '✅',
      blocked: '⛔',
    };
    return icons[status] || icons.pending;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="text-center text-gray-400">
          Loading pipeline data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Pipeline Status</h2>
          <button
            onClick={loadPipelineData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm"
          >
            Refresh
          </button>
        </div>
        <div className="mt-2 flex gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-600 rounded"></span>
            <span className="text-gray-400">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-yellow-600 rounded"></span>
            <span className="text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-600 rounded"></span>
            <span className="text-gray-400">Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-600 rounded"></span>
            <span className="text-gray-400">Blocked</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left p-3 text-sm font-medium text-gray-400 sticky left-0 bg-gray-800">
                Repository
              </th>
              {STAGES.map(stage => (
                <th key={stage.id} className="text-center p-3 text-sm font-medium text-gray-400 min-w-[120px]">
                  <div>{stage.emoji}</div>
                  <div>{stage.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(pipelineData).map(([repo, stages]) => (
              <tr key={repo} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="p-3 text-sm font-medium text-white sticky left-0 bg-gray-800">
                  {repo}
                </td>
                {STAGES.map(stage => {
                  const stageData = stages[stage.id];
                  return (
                    <td
                      key={stage.id}
                      className="p-2 cursor-pointer"
                      onClick={() => setSelectedCell({ repo, stage: stage.name, data: stageData })}
                    >
                      <div
                        className={`${getStatusColor(stageData.status)} rounded p-2 text-center transition-all hover:opacity-80`}
                      >
                        <div className="text-lg">{getStatusIcon(stageData.status)}</div>
                        {stageData.count > 0 && (
                          <div className="text-xs text-white mt-1">
                            {stageData.count} issue{stageData.count !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="bg-gray-800 rounded-lg border border-gray-700 max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                {selectedCell.repo} - {selectedCell.stage}
              </h3>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <div className={`inline-flex items-center gap-2 ${getStatusColor(selectedCell.data.status)} text-white px-3 py-1 rounded`}>
                <span>{getStatusIcon(selectedCell.data.status)}</span>
                <span className="capitalize">{selectedCell.data.status.replace('-', ' ')}</span>
              </div>
            </div>

            {selectedCell.data.issues.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Issues:</h4>
                {selectedCell.data.issues.map(issue => (
                  <a
                    key={issue.number}
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-blue-400">#{issue.number}</span>
                      <span className="text-sm text-white flex-1">{issue.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${issue.state === 'open' ? 'bg-green-600' : 'bg-purple-600'}`}>
                        {issue.state}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No issues found for this stage</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
