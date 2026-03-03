const { Redis } = require('@upstash/redis');

const PROJECTS_KEY = 'good-internet:projects';

module.exports = async function handler(req, res) {
  try {
    const redis = new Redis({
      url: (process.env.KV_REST_API_URL || '').trim(),
      token: (process.env.KV_REST_API_TOKEN || '').trim(),
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET') {
      const projects = await redis.lrange(PROJECTS_KEY, 0, -1);
      const parsed = projects.map(p => typeof p === 'string' ? JSON.parse(p) : p);
      return res.status(200).json({ projects: parsed });
    }

    if (req.method === 'POST') {
      const { name, url, github, description } = req.body;
      if (!name || !url) {
        return res.status(400).json({ error: 'Missing name or url' });
      }
      const project = {
        name: name.trim(),
        url: url.trim(),
        github: (github || '').trim(),
        description: (description || '').trim(),
        timestamp: Date.now(),
      };
      await redis.lpush(PROJECTS_KEY, JSON.stringify(project));
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PUT') {
      const { index, name, url, github, description } = req.body;
      if (typeof index !== 'number' || !name || !url) {
        return res.status(400).json({ error: 'Missing fields' });
      }
      const projects = await redis.lrange(PROJECTS_KEY, 0, -1);
      const existing = typeof projects[index] === 'string' ? JSON.parse(projects[index]) : projects[index];
      const updated = {
        ...existing,
        name: name.trim(),
        url: url.trim(),
        github: (github || '').trim(),
        description: (description || '').trim(),
      };
      await redis.lset(PROJECTS_KEY, index, JSON.stringify(updated));
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { index } = req.body;
      if (typeof index !== 'number') {
        return res.status(400).json({ error: 'Missing index' });
      }
      const TOMBSTONE = '__DELETED__';
      await redis.lset(PROJECTS_KEY, index, TOMBSTONE);
      await redis.lrem(PROJECTS_KEY, 1, TOMBSTONE);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Handler error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
};
