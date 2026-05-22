import { Button, Dialog, Spinner } from "@radix-ui/themes";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  approvePullRequest,
  createPullRequestComment,
  getCurrentGithubPermission,
  listOpenPullRequests,
  listPullRequestComments,
  listPullRequestFiles,
  type GithubIssueComment,
  type GithubPullFile,
  type GithubPullRequest,
} from "~/api/github/pr-review";
import { COMMUNITY_REPO_CONFIG } from "~/config/community";
import { useRepoEnv } from "~/config/repoEnv";
import {
  deriveReviewStatus,
  type ReviewState,
} from "~/logic/publish/review-status";
import { useAccountState } from "~/logic/account/store";
import { useProxiedMediaUrl } from "~/logic/media-proxy";

const STATE_LABELS: Record<ReviewState, string> = {
  waiting_review: "等待审核",
  changes_requested: "需要修改",
  fixed_waiting: "已修复待复核",
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

function isImagePath(path: string) {
  return IMAGE_EXT.test(path);
}

function isVideoPath(path: string) {
  return VIDEO_EXT.test(path);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function makeNeedFixId() {
  return Math.random().toString(36).slice(2, 8);
}

function formatTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function ResourceReviewPage() {
  const accountState = useAccountState();
  const env = useRepoEnv();
  const [permission, setPermission] = useState("");
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [permissionError, setPermissionError] = useState("");
  const [pulls, setPulls] = useState<GithubPullRequest[]>([]);
  const [commentsByPr, setCommentsByPr] = useState<Record<number, GithubIssueComment[]>>({});
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [files, setFiles] = useState<GithubPullFile[]>([]);
  const [loadingPulls, setLoadingPulls] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stateFilter, setStateFilter] = useState<ReviewState | "all">("all");
  const [needFixMessage, setNeedFixMessage] = useState("");
  const [generalComment, setGeneralComment] = useState("");

  const canReview = ["admin", "maintain", "write"].includes(permission);
  const openPull = pulls.find((pull) => pull.number === openNumber) || null;
  const openComments = openNumber ? commentsByPr[openNumber] ?? [] : [];
  const openStatus = deriveReviewStatus(openComments);

  const loadPermission = async () => {
    setCheckingPermission(true);
    setPermissionError("");
    try {
      const res = await getCurrentGithubPermission();
      setPermission(res.permission);
    } catch (err) {
      setPermission("");
      setPermissionError(getErrorMessage(err));
    } finally {
      setCheckingPermission(false);
    }
  };

  const loadPulls = async () => {
    setLoadingPulls(true);
    try {
      const list = await listOpenPullRequests();
      setPulls(list);
      const commentEntries = await Promise.all(
        list.map(async (pull) => {
          try {
            return [pull.number, await listPullRequestComments(pull.number)] as const;
          } catch {
            return [pull.number, []] as const;
          }
        }),
      );
      setCommentsByPr(Object.fromEntries(commentEntries));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingPulls(false);
    }
  };

  const loadDetail = async (number: number) => {
    setLoadingDetail(true);
    try {
      const [nextComments, nextFiles] = await Promise.all([
        listPullRequestComments(number),
        listPullRequestFiles(number),
      ]);
      setCommentsByPr((prev) => ({ ...prev, [number]: nextComments }));
      setFiles(nextFiles);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    void loadPermission();
  }, []);

  useEffect(() => {
    if (canReview) void loadPulls();
  }, [canReview]);

  useEffect(() => {
    if (openNumber) {
      void loadDetail(openNumber);
    } else {
      setFiles([]);
    }
  }, [openNumber]);

  const visiblePulls = useMemo(() => {
    if (stateFilter === "all") return pulls;
    return pulls.filter((pull) => {
      const status = deriveReviewStatus(commentsByPr[pull.number] ?? []);
      return status.state === stateFilter;
    });
  }, [commentsByPr, pulls, stateFilter]);

  const addNeedFix = async () => {
    if (!openNumber || !needFixMessage.trim()) return;
    try {
      const id = makeNeedFixId();
      await createPullRequestComment(
        openNumber,
        `[ABCC_NEEDFIX_${id}] ${needFixMessage.trim()}`,
      );
      setNeedFixMessage("");
      await loadDetail(openNumber);
      toast.success("Needfix 已发送");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const markFixed = async (id: string) => {
    if (!openNumber) return;
    try {
      await createPullRequestComment(openNumber, `[ABCC_FIXED_${id}] 已确认修复`);
      await loadDetail(openNumber);
      toast.success("已写入 fixed 标记");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const addGeneralComment = async () => {
    if (!openNumber || !generalComment.trim()) return;
    try {
      await createPullRequestComment(openNumber, generalComment.trim());
      setGeneralComment("");
      await loadDetail(openNumber);
      toast.success("评论已发送");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const approve = async () => {
    if (!openNumber) return;
    try {
      await approvePullRequest(openNumber);
      toast.success("已提交 GitHub approve");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (!accountState.github?.token) {
    return <StatePage title="PR审核" text="请先在侧边栏登录 GitHub 账号。" />;
  }

  if (checkingPermission) {
    return (
      <StatePage title="PR审核" text="正在检查 GitHub 仓库权限..." spinner />
    );
  }

  if (!canReview) {
    return (
      <StatePage
        title="PR审核"
        text={`当前 GitHub 账号没有 ${COMMUNITY_REPO_CONFIG.owner}/${COMMUNITY_REPO_CONFIG.name} 的 PR 管理权限。${permissionError ? ` ${permissionError}` : ""}`}
      />
    );
  }

  return (
    <div className="h-full overflow-hidden px-4 py-5 md:px-6">
      <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold text-white">PR审核</h1>
            <p className="text-sm text-white/60">
              {env.owner}/{env.repoName} · {permission}
            </p>
          </div>
          <Button onClick={loadPulls} disabled={loadingPulls}>
            刷新
          </Button>
        </div>

        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-nav-item">
          <div className="flex items-center gap-2 border-b border-white/10 p-3">
            <select
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value as ReviewState | "all")}
              className="min-h-10 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
            >
              <option value="all">全部状态</option>
              <option value="waiting_review">等待审核</option>
              <option value="changes_requested">需要修改</option>
              <option value="fixed_waiting">已修复待复核</option>
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loadingPulls && visiblePulls.length === 0 ? (
              <div className="grid h-60 place-items-center"><Spinner /></div>
            ) : visiblePulls.length === 0 ? (
              <div className="py-16 text-center text-sm text-white/45">暂无 open PR</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {visiblePulls.map((pull) => {
                  const status = deriveReviewStatus(commentsByPr[pull.number] ?? []);
                  return (
                    <button
                      key={pull.number}
                      type="button"
                      onClick={() => setOpenNumber(pull.number)}
                      className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/65">#{pull.number}</span>
                        <StatusBadge state={status.state} />
                      </div>
                      <h2 className="line-clamp-2 text-sm font-semibold text-white">{pull.title}</h2>
                      <p className="truncate text-xs text-white/45">
                        {pull.user?.login} · {pull.head.ref} · {formatTime(pull.updated_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog.Root
        open={openNumber !== null}
        onOpenChange={(open) => {
          if (!open) setOpenNumber(null);
        }}
      >
        <Dialog.Content
          maxWidth="100vw"
          className="!w-[min(96vw,1400px)] !max-w-none"
        >
          <Dialog.Title>
            {openPull
              ? `#${openPull.number} · ${openPull.title}`
              : "PR 详情"}
          </Dialog.Title>
          {openPull && (
            <Dialog.Description size="2" className="mb-2 text-white/55">
              {openPull.user?.login} ·{" "}
              {openPull.head.repo?.full_name ?? openPull.head.ref} ·{" "}
              {openPull.head.sha.slice(0, 7)}
            </Dialog.Description>
          )}

          {openPull && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge state={openStatus.state} />
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/65">
                  #{openPull.number}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button variant="soft" onClick={() => openUrl(openPull.html_url)}>
                    在 GitHub 打开
                  </Button>
                  <Button color="green" onClick={approve}>Approve</Button>
                </div>
              </div>

              <div className="grid max-h-[72vh] gap-4 overflow-y-auto lg:grid-cols-[1fr_340px]">
                <div className="flex flex-col gap-4">
                  <Panel title="改动文件">
                    {loadingDetail ? (
                      <div className="py-10 text-center text-white/45">加载中...</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {files.map((file) => (
                          <FileEntry key={file.filename} file={file} />
                        ))}
                        {files.length === 0 && (
                          <p className="text-sm text-white/45">暂无文件信息</p>
                        )}
                      </div>
                    )}
                  </Panel>
                  <Panel title="评论流">
                    <div className="flex flex-col gap-2">
                      {openComments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="mb-1 flex items-center gap-2 text-xs text-white/45">
                            <span>{comment.user?.login}</span>
                            <span>{formatTime(comment.created_at)}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-white/70">{comment.body}</p>
                        </div>
                      ))}
                      {openComments.length === 0 && <p className="text-sm text-white/45">暂无评论</p>}
                    </div>
                  </Panel>
                </div>

                <div className="flex flex-col gap-4">
                  <Panel title="ABCC 状态">
                    <div className="flex flex-col gap-2">
                      {openStatus.items.map((item) => (
                        <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-mono-sarasa text-xs text-white/45">{item.id}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${item.fixed ? "bg-emerald-500/15 text-emerald-100" : "bg-amber-500/15 text-amber-100"}`}>
                              {item.fixed ? "fixed" : "needfix"}
                            </span>
                          </div>
                          <p className="text-sm text-white/75">{item.message}</p>
                          {!item.fixed && (
                            <Button className="mt-2" size="1" variant="soft" onClick={() => markFixed(item.id)}>
                              标记 fixed
                            </Button>
                          )}
                        </div>
                      ))}
                      {openStatus.items.length === 0 && (
                        <p className="text-sm text-white/45">还没有 ABCC needfix。</p>
                      )}
                    </div>
                  </Panel>
                  <Panel title="添加 Needfix">
                    <textarea
                      value={needFixMessage}
                      onChange={(event) => setNeedFixMessage(event.target.value)}
                      className="min-h-28 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                    />
                    <Button className="mt-2 w-full" onClick={addNeedFix}>
                      发送 [ABCC_NEEDFIX]
                    </Button>
                  </Panel>
                  <Panel title="普通评论">
                    <textarea
                      value={generalComment}
                      onChange={(event) => setGeneralComment(event.target.value)}
                      className="min-h-28 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
                    />
                    <Button className="mt-2 w-full" variant="soft" onClick={addGeneralComment}>
                      发送评论
                    </Button>
                  </Panel>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Dialog.Close>
              <Button variant="soft">关闭</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}

function FileEntry({ file }: { file: GithubPullFile }) {
  const showImage = isImagePath(file.filename) && file.raw_url;
  const showVideo = isVideoPath(file.filename) && file.raw_url;

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono-sarasa text-white">{file.filename}</span>
        <span className="text-emerald-300">+{file.additions}</span>
        <span className="text-red-300">-{file.deletions}</span>
        {file.blob_url && (
          <button
            className="ml-auto text-xs text-blue-200 underline"
            onClick={() => openUrl(file.blob_url!)}
          >
            查看文件
          </button>
        )}
      </div>
      {showImage && <ProxiedImage rawUrl={file.raw_url!} filename={file.filename} />}
      {showVideo && <ProxiedVideo rawUrl={file.raw_url!} />}
      {!showImage && !showVideo && file.patch && (
        <pre className="mt-2 max-h-72 overflow-auto rounded bg-black/30 p-2 text-xs text-white/55">
          {file.patch}
        </pre>
      )}
    </div>
  );
}

function ProxiedImage({ rawUrl, filename }: { rawUrl: string; filename: string }) {
  const url = useProxiedMediaUrl(rawUrl);
  return (
    <img
      src={url}
      alt={filename}
      className="mt-2 max-h-80 max-w-full rounded border border-white/10 object-contain"
    />
  );
}

function ProxiedVideo({ rawUrl }: { rawUrl: string }) {
  const url = useProxiedMediaUrl(rawUrl);
  return (
    <video
      controls
      src={url}
      className="mt-2 max-h-80 max-w-full rounded border border-white/10"
    />
  );
}

function StatePage({
  title,
  text,
  spinner,
}: {
  title: string;
  text: string;
  spinner?: boolean;
}) {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-nav-item p-6 text-center">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/60">{text}</p>
        {spinner && <div className="mt-4"><Spinner /></div>}
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: ReviewState }) {
  const className =
    state === "changes_requested"
      ? "bg-amber-500/15 text-amber-100"
      : state === "fixed_waiting"
        ? "bg-blue-500/15 text-blue-100"
        : "bg-white/10 text-white/65";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>
      {STATE_LABELS[state]}
    </span>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}
