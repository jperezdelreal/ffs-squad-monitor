import { REPOS, SQUAD_AGENTS } from '../config.js';

/**
 * @openapi
 * /api/config:
 *   get:
 *     summary: Get dashboard configuration
 *     description: Returns monitored repos and squad agent roster. Repos include owner/name split from the github slug. Agent config includes emoji, role, color, and assigned repo.
 *     tags: [Config]
 *     responses:
 *       200:
 *         description: Dashboard configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 repos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ConfigRepo'
 *                 agents:
 *                   type: object
 *                   description: Agent roster keyed by agent ID
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/ConfigAgent'
 */
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
