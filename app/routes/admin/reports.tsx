import { Button } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminApi,
  type BanKind,
  type ReportItem,
  type ReportStatus,
  type ReportType,
} from "~/api/astrobox/admin";
import {
  AdminPage,
  Field,
  Panel,
  formatDateTime,
  inputClass,
  textareaClass,
} from "~/components/admin/AdminPage";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<ReportStatus | "">("pending");
  const [reportType, setReportType] = useState<ReportType | "">("");
  const [senderId, setSenderId] = useState("");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selected, setSelected] = useState<ReportItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await AdminApi.reports.list({
        status: status || undefined,
        reportType: reportType || undefined,
        senderId,
        limit: 100,
      });
      setReports(res.items);
      setSelected((current) => {
        if (current && res.items.some((item) => item.id === current.id)) return current;
        return res.items[0] ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  return (
    <AdminPage
      title="举报管理"
      description="查看用户举报、记录处理结论，并可联动封禁。"
      loading={loading && reports.length === 0}
      error={error}
      onRetry={loadReports}
    >
      <div className="grid gap-4 2xl:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
        <Panel title="举报列表">
          <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <select
              className={inputClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as ReportStatus | "")}
            >
              <option value="">全部状态</option>
              <option value="pending">pending</option>
              <option value="resolved">resolved</option>
              <option value="dismissed">dismissed</option>
            </select>
            <select
              className={inputClass}
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType | "")}
            >
              <option value="">全部类型</option>
              <option value="comment">comment</option>
              <option value="resource">resource</option>
            </select>
            <input
              className={inputClass}
              placeholder="举报人 userId"
              value={senderId}
              onChange={(event) => setSenderId(event.target.value)}
            />
            <Button className="w-full" onClick={loadReports}>查询</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelected(report)}
                className={`flex w-full flex-col gap-1 border-b border-white/10 px-3 py-3 text-left transition last:border-b-0 ${
                  selected?.id === report.id ? "bg-white/10" : "bg-black/10 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                    {report.status}
                  </span>
                  <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-100">
                    {report.reportType}
                  </span>
                  <span className="text-xs text-white/45">{formatDateTime(report.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-white">{report.reason}</p>
                <p className="truncate font-mono-sarasa text-xs text-white/45">
                  {report.commentId || report.resourceId || report.id}
                </p>
              </button>
            ))}
            {reports.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-white/50">
                没有匹配举报
              </div>
            )}
          </div>
        </Panel>

        <Panel title={selected ? `举报 ${selected.id}` : "举报详情"}>
          {selected ? (
            <ReportDetail report={selected} onChanged={loadReports} />
          ) : (
            <div className="py-20 text-center text-sm text-white/60">
              选择一条举报查看详情
            </div>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}

function ReportDetail({
  report,
  onChanged,
}: {
  report: ReportItem;
  onChanged: () => void;
}) {
  const [resolutionStatus, setResolutionStatus] = useState<"resolved" | "dismissed">("resolved");
  const [resolution, setResolution] = useState("");
  const [notifyReporter, setNotifyReporter] = useState(true);
  const [autoBanEnabled, setAutoBanEnabled] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [banKind, setBanKind] = useState<BanKind>("social");
  const [banReason, setBanReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  useEffect(() => {
    setResolution(report.resolution ?? "");
    setTargetUserId("");
    setBanReason("");
    setDurationMinutes("");
    setAutoBanEnabled(false);
  }, [report.id]);

  const submit = async () => {
    if (!resolution.trim()) {
      toast.error("请填写处理说明");
      return;
    }
    if (autoBanEnabled && (!targetUserId.trim() || !banReason.trim())) {
      toast.error("联动封禁需要填写目标用户和原因");
      return;
    }
    try {
      await AdminApi.reports.resolve(report.id, {
        status: resolutionStatus,
        resolution: resolution.trim(),
        notifyReporter,
        autoBan: autoBanEnabled
          ? {
              targetUserId: targetUserId.trim(),
              kind: banKind,
              reason: banReason.trim(),
              durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
            }
          : undefined,
      });
      toast.success("举报已处理");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 rounded-xl bg-black/20 p-3 text-sm">
        <Info label="状态" value={report.status} />
        <Info label="类型" value={report.reportType} />
        <Info label="举报人" value={report.senderId} mono />
        <Info label="分类" value={report.reasonCategory} />
        <Info label="评论" value={report.commentId ?? "--"} mono />
        <Info label="资源" value={report.resourceId ?? "--"} mono />
        <Info label="创建时间" value={formatDateTime(report.createdAt)} />
        <Info label="处理人" value={report.handledBy ?? "--"} mono />
      </div>

      <div className="rounded-xl bg-black/20 p-3">
        <h3 className="mb-2 text-sm font-semibold text-white">举报理由</h3>
        <p className="whitespace-pre-wrap text-sm leading-6 text-white/75">{report.reason}</p>
        {report.evidence.length > 0 && (
          <div className="mt-3 flex flex-col gap-1 text-sm text-white/60">
            {report.evidence.map((item) => (
              <a key={item} href={item} target="_blank" rel="noreferrer" className="truncate underline">
                {item}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-black/20 p-3">
        <h3 className="mb-3 text-sm font-semibold text-white">处理</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
          <Field label="处理状态">
            <select className={inputClass} value={resolutionStatus} onChange={(event) => setResolutionStatus(event.target.value as typeof resolutionStatus)}>
              <option value="resolved">resolved</option>
              <option value="dismissed">dismissed</option>
            </select>
          </Field>
          <Field label="处理说明">
            <textarea className={textareaClass} value={resolution} onChange={(event) => setResolution(event.target.value)} />
          </Field>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-white/60">
          <input type="checkbox" checked={notifyReporter} onChange={(event) => setNotifyReporter(event.target.checked)} />
          通知举报人
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm text-white/60">
          <input type="checkbox" checked={autoBanEnabled} onChange={(event) => setAutoBanEnabled(event.target.checked)} />
          同时创建封禁
        </label>
        {autoBanEnabled && (
          <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <input className={inputClass} placeholder="目标用户 userId" value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} />
            <select className={inputClass} value={banKind} onChange={(event) => setBanKind(event.target.value as BanKind)}>
              <option value="social">social</option>
              <option value="platform">platform</option>
            </select>
            <input className={inputClass} placeholder="封禁原因" value={banReason} onChange={(event) => setBanReason(event.target.value)} />
            <input className={inputClass} placeholder="分钟，空=永久" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button className="w-full sm:w-auto" onClick={submit} disabled={report.status !== "pending"}>
            提交处理
          </Button>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className="text-white/40">{label}</span>
      <p className={`truncate text-white ${mono ? "font-mono-sarasa" : ""}`}>{value}</p>
    </div>
  );
}
