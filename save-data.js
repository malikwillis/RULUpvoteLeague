
function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in Vercel Environment Variables.`);
  return value;
}

function safeStaticData(data) {
  if (!data || typeof data !== 'object') throw new Error('Data payload is missing.');
  if (!data.league || !Array.isArray(data.teams) || !Array.isArray(data.games)) {
    throw new Error('Data payload does not look like valid RUL static data.');
  }

  return 'window.RUL_STATIC_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
}

async function githubRequest(path, options = {}) {
  const token = requiredEnv('GITHUB_TOKEN');
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object' ? payload.message : payload;
    throw new Error(message || `GitHub request failed with ${response.status}`);
  }

  return payload;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return send(res, 405, { ok: false, errors: ['Method not allowed.'] });
    }

    const adminCode = requiredEnv('RUL_ADMIN_CODE');
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (String(body.adminCode || '') !== adminCode) {
      return send(res, 401, { ok: false, errors: ['Admin code is incorrect.'] });
    }

    const owner = requiredEnv('GITHUB_OWNER');
    const repo = requiredEnv('GITHUB_REPO');
    const branch = process.env.GITHUB_BRANCH || 'main';
    const filePath = process.env.RUL_DATA_FILE || 'static-data.js';

    const content = safeStaticData(body.data);
    const encoded = Buffer.from(content, 'utf8').toString('base64');

    const getPath = `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`;
    const current = await githubRequest(getPath, { method: 'GET' });

    const messageWeek = body.data?.league?.updatedLabel || 'RUL score update';

    const updatePath = `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;

    const result = await githubRequest(updatePath, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Update RUL scores: ${messageWeek}`,
        content: encoded,
        sha: current.sha,
        branch
      })
    });

    return send(res, 200, {
      ok: true,
      message: 'static-data.js updated on GitHub. Vercel should redeploy from the new commit.',
      commit: result.commit?.html_url || null,
      contentUrl: result.content?.html_url || null
    });
  } catch (error) {
    return send(res, 500, { ok: false, errors: [error.message || 'Server error.'] });
  }
};
