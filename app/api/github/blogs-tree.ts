import { loadRepoEnv } from "~/config/repoEnv";
import { loadAccountState } from "~/logic/account/store";
import { githubFetch } from "~/logic/publish/github-actions";

export const BLOGS_ROOT = "blogs";

export interface GitTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export interface BlogsTreeNode {
  name: string;
  path: string;
  type: "dir" | "file";
  sha?: string;
  size?: number;
  children: BlogsTreeNode[];
}

function authHeaders() {
  const token = loadAccountState().github?.token;
  if (!token) throw new Error("请先登录 GitHub 账号。");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function repoApi(path: string) {
  const env = loadRepoEnv();
  return `https://api.github.com/repos/${env.owner}/${env.repoName}${path}`;
}

export function getBlogsRawBase() {
  const env = loadRepoEnv();
  return `https://raw.githubusercontent.com/${env.owner}/${env.repoName}/refs/heads/${env.defaultBranch}/${BLOGS_ROOT}/`;
}

export async function fetchBlogsTree(): Promise<BlogsTreeNode> {
  const env = loadRepoEnv();
  const res = await githubFetch<{ tree: GitTreeEntry[]; truncated?: boolean }>(
    repoApi(`/git/trees/${env.defaultBranch}?recursive=1`),
    { headers: authHeaders() },
  );
  const entries = res.tree.filter(
    (entry) =>
      entry.path === BLOGS_ROOT || entry.path.startsWith(`${BLOGS_ROOT}/`),
  );
  return buildTree(entries);
}

function buildTree(entries: GitTreeEntry[]): BlogsTreeNode {
  const root: BlogsTreeNode = {
    name: BLOGS_ROOT,
    path: BLOGS_ROOT,
    type: "dir",
    children: [],
  };
  const dirs = new Map<string, BlogsTreeNode>();
  dirs.set(BLOGS_ROOT, root);

  const sortedEntries = [...entries].sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  for (const entry of sortedEntries) {
    if (entry.path === BLOGS_ROOT) continue;
    const segments = entry.path.split("/");
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join("/") || BLOGS_ROOT;
    const parent = ensureDir(parentPath, dirs);

    if (entry.type === "tree") {
      const existing = dirs.get(entry.path);
      if (existing) {
        existing.sha = entry.sha;
        continue;
      }
      const node: BlogsTreeNode = {
        name,
        path: entry.path,
        type: "dir",
        sha: entry.sha,
        children: [],
      };
      dirs.set(entry.path, node);
      parent.children.push(node);
    } else {
      parent.children.push({
        name,
        path: entry.path,
        type: "file",
        sha: entry.sha,
        size: entry.size,
        children: [],
      });
    }
  }

  sortTree(root);
  return root;
}

function ensureDir(path: string, dirs: Map<string, BlogsTreeNode>): BlogsTreeNode {
  const existing = dirs.get(path);
  if (existing) return existing;
  const segments = path.split("/");
  const name = segments[segments.length - 1];
  const parentPath = segments.slice(0, -1).join("/") || BLOGS_ROOT;
  const parent = ensureDir(parentPath, dirs);
  const node: BlogsTreeNode = {
    name,
    path,
    type: "dir",
    children: [],
  };
  dirs.set(path, node);
  parent.children.push(node);
  return node;
}

function sortTree(node: BlogsTreeNode) {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}

export async function getFileSha(path: string): Promise<string | undefined> {
  try {
    const res = await githubFetch<{ sha: string }>(
      repoApi(`/contents/${encodePath(path)}`),
      { headers: authHeaders() },
    );
    return res.sha;
  } catch {
    return undefined;
  }
}

export function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
