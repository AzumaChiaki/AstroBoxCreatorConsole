import { COMMUNITY_REPO_CONFIG } from "~/config/community";
import { loadAccountState } from "~/logic/account/store";
import { ensureBase64, githubFetch } from "~/logic/publish/github-actions";

export interface ExplorePrResult {
  htmlUrl: string;
  branch: string;
}

export function buildExploreBranchName() {
  const account = getGithubAuth();
  return `explore/${Date.now()}-${account.username}`;
}

function getGithubAuth() {
  const account = loadAccountState().github;
  if (!account?.token || !account.username) {
    throw new Error("请先登录 GitHub 账号。");
  }
  return account;
}

function headers() {
  return {
    Authorization: `Bearer ${getGithubAuth().token}`,
    "Content-Type": "application/json",
  };
}

function repoApi(path: string) {
  return `https://api.github.com/repos/${COMMUNITY_REPO_CONFIG.owner}/${COMMUNITY_REPO_CONFIG.name}${path}`;
}

function encodeContentPath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function sha256Hex(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getMainRef() {
  return githubFetch<{ object: { sha: string } }>(
    repoApi(`/git/ref/heads/${COMMUNITY_REPO_CONFIG.defaultBranch}`),
    { headers: headers() },
  );
}

async function createBranch(branch: string, sha: string) {
  return githubFetch<unknown>(repoApi("/git/refs"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha,
    }),
  });
}

async function getContent(path: string, branch: string) {
  return githubFetch<{ sha: string; content: string; encoding: string }>(
    repoApi(`/contents/${encodeContentPath(path)}?ref=${encodeURIComponent(branch)}`),
    { headers: headers() },
  );
}

async function putContent(params: {
  path: string;
  branch: string;
  message: string;
  contentBase64: string;
  sha?: string;
}) {
  return githubFetch<unknown>(repoApi(`/contents/${encodeContentPath(params.path)}`), {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message: params.message,
      content: params.contentBase64,
      branch: params.branch,
      sha: params.sha,
    }),
  });
}

async function createPullRequest(branch: string) {
  return githubFetch<{ html_url: string }>(repoApi("/pulls"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      title: "[ABCC] Update explore page",
      body: "Update explore_v2.json from AstroBox Creator Console.",
      base: COMMUNITY_REPO_CONFIG.defaultBranch,
      head: branch,
    }),
  });
}

export async function fetchExploreJson() {
  const response = await fetch(
    `https://raw.githubusercontent.com/${COMMUNITY_REPO_CONFIG.owner}/${COMMUNITY_REPO_CONFIG.name}/refs/heads/${COMMUNITY_REPO_CONFIG.defaultBranch}/${COMMUNITY_REPO_CONFIG.exploreFilePath}`,
  );
  if (!response.ok) {
    throw new Error(`读取 explore_v2.json 失败：HTTP ${response.status}`);
  }
  return response.text();
}

export async function prepareExploreMedia(files: File[], branch: string) {
  const result: Array<{ file: File; path: string; rawUrl: string }> = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const hash = await sha256Hex(file);
    const path = `explore/media/${hash}.${ext}`;
    result.push({
      file,
      path,
      rawUrl: `https://raw.githubusercontent.com/${COMMUNITY_REPO_CONFIG.owner}/${COMMUNITY_REPO_CONFIG.name}/${branch}/${path}`,
    });
  }
  return result;
}

export async function submitExplorePr(params: {
  jsonText: string;
  mediaFiles: File[];
  branch?: string;
}) {
  const account = getGithubAuth();
  const branch = params.branch || `explore/${Date.now()}-${account.username}`;
  const mainRef = await getMainRef();
  await createBranch(branch, mainRef.object.sha);

  const current = await getContent(COMMUNITY_REPO_CONFIG.exploreFilePath, COMMUNITY_REPO_CONFIG.defaultBranch);
  await putContent({
    path: COMMUNITY_REPO_CONFIG.exploreFilePath,
    branch,
    message: "Update explore_v2.json",
    contentBase64: ensureBase64(params.jsonText),
    sha: current.sha,
  });

  const media = await prepareExploreMedia(params.mediaFiles, branch);
  for (const item of media) {
    await putContent({
      path: item.path,
      branch,
      message: `Add explore media ${item.path.split("/").pop()}`,
      contentBase64: ensureBase64(await item.file.arrayBuffer()),
    });
  }

  const pr = await createPullRequest(branch);
  return { htmlUrl: pr.html_url, branch } satisfies ExplorePrResult;
}
