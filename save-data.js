function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function cleanEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim().replace(/^["']|["']$/g, "");
}

function requiredEnv(name) {
  const value = cleanEnv(name);
  if (!value) throw new Error(`${name} is missing in Vercel Environment Variables.`);
  return value;
}

function safeFilePath(path) {
  return String(path || "static-data.js")
    .split("/")
    .filter(Boolean)
    .map(part => encodeURIComponent(part))
    .join("/");
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;

  try {
    return JSON.parse(req.body);
  } catch {
    throw new Error("Request body was not valid JSON.");
  }
}

function makeStaticDataFile(data) {
  if (!data || typeof data !== "object") throw new Error("Missing data payload.");
  if (!data.league || !Array.isArray(data.teams) || !Array.isArray(data.games)) {
    throw new Error("The submitted data does not look like RUL static data.");
  }

  return "window.RUL_STATIC_DATA = " + JSON.stringify(data, null, 2) + ";\n";
}

async function githubRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
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
    const message = payload && typeof payload === "object"
      ? payload.message || JSON.stringify(payload)
      : String(payload || "");
    throw new Error(`GitHub API ${response.status}: ${message}`);
  }

  return payload;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, { ok: false, errors: ["Use POST only."] });
    }

    const body = parseBody(req);

    const adminCode = requiredEnv("RUL_ADMIN_CODE");
    if (String(body.adminCode || "").trim() !== adminCode) {
      return sendJson(res, 401, { ok: false, errors: ["Admin code is incorrect."] });
    }

    const owner = requiredEnv("GITHUB_OWNER");
    const repo = requiredEnv("GITHUB_REPO");
    const token = requiredEnv("GITHUB_TOKEN");
    const branch = cleanEnv("GITHUB_BRANCH", "main");
    const filePath = cleanEnv("RUL_DATA_FILE", "static-data.js");

    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    const encodedBranch = encodeURIComponent(branch);
    const encodedPath = safeFilePath(filePath);

    const apiUrl = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}`;

    const current = await githubRequest(`${apiUrl}?ref=${encodedBranch}`, token, {
      method: "GET"
    });

    if (!current || !current.sha) {
      throw new Error("Could not find current static-data.js on GitHub.");
    }

    const fileText = makeStaticDataFile(body.data);
    const base64Content = Buffer.from(fileText, "utf8").toString("base64");
    const label = body.data?.league?.updatedLabel || "RUL score update";

    const result = await githubRequest(apiUrl, token, {
      method: "PUT",
      body: JSON.stringify({
        message: `Update RUL scores: ${label}`,
        content: base64Content,
        sha: current.sha,
        branch
      })
    });

    return sendJson(res, 200, {
      ok: true,
      message: "Published to GitHub. Vercel should redeploy automatically.",
      commit: result?.commit?.html_url || "",
      file: result?.content?.html_url || ""
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      errors: [error.message || "Unknown server error."]
    });
  }
};
