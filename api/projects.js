const { Redis } = require('@upstash/redis');

const PROJECTS_KEY = 'good-internet:projects';
const VALID_TAGS = ['WHIMSY', 'BEAUTY', 'PRODUCTIVITY', 'PROFIT', 'VIBES'];

module.exports = async function handler(req, res) {
  try {
    const redis = new Redis({
      url: (process.env.KV_REST_API_URL || '').trim(),
      token: (process.env.KV_REST_API_TOKEN || '').trim(),
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      const { name, url, submittedBy, tags } = req.body;

      if (!name || !url || !submittedBy || !tags || !Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (name.length > 100 || url.length > 500 || submittedBy.length > 100) {
        return res.status(400).json({ error: 'Field too long' });
      }

      const filteredTags = tags.filter(t => VALID_TAGS.includes(t));
      if (filteredTags.length === 0) {
        return res.status(400).json({ error: 'Invalid tags' });
      }

      const project = {
        name: name.trim(),
        url: url.trim(),
        submittedBy: submittedBy.trim(),
        tags: filteredTags,
        timestamp: Date.now(),
      };

      await redis.lpush(PROJECTS_KEY, JSON.stringify(project));
      return res.status(200).json({ success: true, project });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Handler error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
};
