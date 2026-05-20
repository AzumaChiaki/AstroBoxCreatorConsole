import { Button } from "@radix-ui/themes";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildExploreBranchName,
  fetchExploreJson,
  prepareExploreMedia,
  submitExplorePr,
} from "~/api/github/explore-pr";
import ExploreExtendedFeedPreview, {
  type FeaturedAuthorConfig,
} from "~/components/explore-preview/ExploreExtendedFeedPreview";
import ExploreMasonry from "~/components/explore-preview/copied/ExploreMasonry";
import type { MasonryCard } from "~/components/explore-preview/copied/explore-types";
import { useAccountState } from "~/logic/account/store";

const DRAFT_KEY = "ABCC_EXPLORE_PAGE_DRAFT_V1";

interface ExplorePayload {
  masonryCards?: MasonryCard[];
  featuredResourceIds?: string[];
  featuredAuthors?: FeaturedAuthorConfig[];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function prettyJson(input: string) {
  return JSON.stringify(JSON.parse(input), null, 2);
}

function parsePayload(jsonText: string): ExplorePayload | null {
  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default function ExplorePageManager() {
  const accountState = useAccountState();
  const [jsonText, setJsonText] = useState("");
  const [branch, setBranch] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [appearance, setAppearance] = useState<"dark" | "light">("dark");
  const [previewWidth, setPreviewWidth] = useState(1280);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mediaItems, setMediaItems] = useState<Array<{ path: string; rawUrl: string }>>([]);

  const payload = useMemo(() => parsePayload(jsonText), [jsonText]);
  const jsonValid = Boolean(payload);

  const loadRemote = async () => {
    setLoading(true);
    try {
      const text = await fetchExploreJson();
      const formatted = prettyJson(text);
      setJsonText(formatted);
      localStorage.setItem(DRAFT_KEY, formatted);
      toast.success("已加载 main 分支 explore_v2.json");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      setJsonText(draft);
    } else {
      void loadRemote();
    }
    try {
      setBranch(buildExploreBranchName());
    } catch {
      setBranch(`explore/${Date.now()}-local`);
    }
  }, []);

  useEffect(() => {
    if (jsonText) localStorage.setItem(DRAFT_KEY, jsonText);
  }, [jsonText]);

  useEffect(() => {
    let cancelled = false;
    if (!branch || mediaFiles.length === 0) {
      setMediaItems([]);
      return;
    }
    prepareExploreMedia(mediaFiles, branch)
      .then((items) => {
        if (!cancelled) setMediaItems(items.map(({ path, rawUrl }) => ({ path, rawUrl })));
      })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [branch, mediaFiles]);

  const formatCurrentJson = () => {
    try {
      setJsonText(prettyJson(jsonText));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const resetDraft = async () => {
    localStorage.removeItem(DRAFT_KEY);
    await loadRemote();
  };

  const submit = async () => {
    if (!accountState.github?.token) {
      toast.error("请先登录 GitHub 账号");
      return;
    }
    if (!jsonValid) {
      toast.error("JSON 格式不正确");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitExplorePr({
        jsonText: prettyJson(jsonText),
        mediaFiles,
        branch,
      });
      toast.success("探索页 PR 已创建");
      openUrl(result.htmlUrl);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-hidden px-4 py-5 md:px-6">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold text-white">探索页管理</h1>
            <p className="text-sm text-white/60">编辑 explore_v2.json，使用复制的客户端 Masonry 渲染器实时预览，并提交到 AstroBox-Repo PR。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" onClick={loadRemote} disabled={loading}>从 main 载入</Button>
            <Button variant="soft" onClick={resetDraft}>重置草稿</Button>
            <Button variant="soft" onClick={formatCurrentJson}>格式化</Button>
            <Button onClick={submit} disabled={submitting || !jsonValid}>
              {submitting ? "提交中" : "提交 PR"}
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[520px_1fr]">
          <section className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-nav-item p-4">
            <div className="mb-3 grid gap-2 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm text-white/70">
                <span>PR 分支</span>
                <input
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  className="min-h-10 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-white/70">
                <span>媒体文件</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(event) => setMediaFiles(Array.from(event.target.files ?? []))}
                  className="min-h-10 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
            {mediaItems.length > 0 && (
              <div className="mb-3 max-h-32 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
                {mediaItems.map((item) => (
                  <div key={item.path} className="mb-2 last:mb-0">
                    <p className="font-mono-sarasa text-xs text-white/55">{item.path}</p>
                    <button
                      type="button"
                      className="truncate text-left font-mono-sarasa text-xs text-blue-200 underline"
                      onClick={() => navigator.clipboard?.writeText(item.rawUrl)}
                    >
                      {item.rawUrl}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              spellCheck={false}
              className={`min-h-0 flex-1 resize-none rounded-xl border bg-black/35 p-3 font-mono-sarasa text-xs leading-5 outline-none ${
                jsonValid ? "border-white/10 text-white" : "border-red-400/40 text-red-100"
              }`}
            />
          </section>

          <section className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-nav-item">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
              <div className="flex gap-2">
                {[1440, 1280, 1024, 768].map((width) => (
                  <Button
                    key={width}
                    size="1"
                    variant={previewWidth === width ? "solid" : "soft"}
                    onClick={() => setPreviewWidth(width)}
                  >
                    {width}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="1" variant={appearance === "dark" ? "solid" : "soft"} onClick={() => setAppearance("dark")}>
                  Dark
                </Button>
                <Button size="1" variant={appearance === "light" ? "solid" : "soft"} onClick={() => setAppearance("light")}>
                  Light
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[#101012] p-4">
              <div
                className={`${appearance} mx-auto min-h-full overflow-hidden rounded-2xl bg-[#191919] text-white`}
                style={{ width: previewWidth, maxWidth: "100%" }}
              >
                {payload ? (
                  <>
                    <ExploreMasonry
                      content={Array.isArray(payload.masonryCards) ? payload.masonryCards : []}
                      appearance={appearance}
                    />
                    <ExploreExtendedFeedPreview
                      featuredResourceIds={
                        Array.isArray(payload.featuredResourceIds)
                          ? payload.featuredResourceIds
                          : []
                      }
                      featuredAuthors={
                        Array.isArray(payload.featuredAuthors)
                          ? payload.featuredAuthors
                          : []
                      }
                    />
                  </>
                ) : (
                  <div className="grid min-h-[420px] place-items-center text-sm text-red-100">
                    JSON 无法解析
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
