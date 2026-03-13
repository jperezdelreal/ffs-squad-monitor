import { REPOS, SQUAD_AGENTS } from '../config.js';

export default function configRoute(req, res) {
  const repos = REPOS.map(repo => {
    const [owner, name] = repo.github.split('/');
    return {
      id: repo.id,
      emoji: repo.emoji,
      label: repo.label,
      github: repo.github,
      owner,
      name,
      color: repo.color,
    };
  });

  res.json({ repos, agents: SQUAD_AGENTS });
}
