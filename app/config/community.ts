import { loadRepoEnv } from "./repoEnv";

interface CommunityRepoConfig {
  owner: string;
  name: string;
  defaultBranch: string;
  exploreFilePath: string;
}

export const COMMUNITY_REPO_CONFIG: CommunityRepoConfig = new Proxy(
  {} as CommunityRepoConfig,
  {
    get(_target, prop: keyof CommunityRepoConfig) {
      const env = loadRepoEnv();
      switch (prop) {
        case "owner":
          return env.owner;
        case "name":
          return env.repoName;
        case "defaultBranch":
          return env.defaultBranch;
        case "exploreFilePath":
          return env.exploreFilePath;
        default:
          return undefined;
      }
    },
    ownKeys() {
      return ["owner", "name", "defaultBranch", "exploreFilePath"];
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  },
);
