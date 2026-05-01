
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function cleanEnv(name, fallback = '') {
  const raw = process.env[name] ?? fallback;
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

function requireEnv(name) {
  const value = cleanEnv(name);
  if (!value) {
    throw new Error(`${name} is missing in Vercel Environment Variables.`);
  }
  return value;
}

function encodePath(filePath) {
  return String(filePath || 'static-data.js')
    .split('/')
    .filter(Boolean)
    .map(part => encodeURIComponent(part))
    .join('/');
}

function makeStaticDataFile(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Missing data payload.');
  }

  if (!data.league || !Array.isArray(data.teams) || !Array.isArray(data.games)) {
    throw new Error('Data payload is not valid RUL static data.');
  }

  return 'window.RUL_STATIC_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

async function githubFetch(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const rawText = await response.text();
  let payload = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object'
      ? payload.message || payload.documentation_url || JSON.stringify(payload)
      : String(payload || '');

    throw new Error(`GitHub API ${response.status}: ${message}`);
  }

  return payload;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { ok: false, errors: ['Use POST only.'] });
    }

    const body = parseBody(req);

    const expectedAdminCode = requireEnv('RUL_ADMIN_CODE');
    const enteredAdminCode = String(body.adminCode || '').trim();

    if (enteredAdminCode !== expectedAdminCode) {
      return sendJson(res, 401, { ok: false, errors: ['Admin code is incorrect.'] });
    }

    const owner = requireEnv('GITHUB_OWNER');
    const repo = requireEnv('GITHUB_REPO');
    const token = requireEnv('GITHUB_TOKEN');
    const branch = cleanEnv('GITHUB_BRANCH', 'main');
    const filePath = cleanEnv('RUL_DATA_FILE', 'static-data.js');

    const contentText = makeStaticDataFile(body.data);
    const base64Content = Buffer.from(contentText, 'utf8').toString('base64');

    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    const encodedBranch = encodeURIComponent(branch);
    const encodedFilePath = encodePath(filePath);

    const apiBase = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/contents/${encodedFilePath}`;

    const currentFile = await githubFetch(`${apiBase}?ref=${encodedBranch}`, token, {
      method: 'GET'
    });

    if (!currentFile || !currentFile.sha) {
      throw new Error('Could not find the current static-data.js SHA on GitHub.');
    }

    const updateLabel = body.data?.league?.updatedLabel || 'RUL score update';

    const result = await githubFetch(apiBase, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Update RUL scores: ${updateLabel}`,
        content: base64Content,
        sha: currentFile.sha,
        branch
      })
    });

    return sendJson(res, 200, {
      ok: true,
      message: 'Published to GitHub. Vercel should redeploy automatically.',
      commit: result?.commit?.html_url || '',
      file: result?.content?.html_url || ''
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      errors: [error.message || 'Unknown server error.']
    });
  }
};
