import { Button } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminApi,
  type ActiveBan,
  type AdminUserDetail,
  type AdminUserSummary,
  type BanKind,
  type VipOrder,
  type VipTier,
} from "~/api/astrobox/admin";
import {
  AdminPage,
  Field,
  Panel,
  formatDateTime,
  inputClass,
  textareaClass,
} from "~/components/admin/AdminPage";
import { useAccountState } from "~/logic/account/store";

const VIP_TIERS: VipTier[] = ["None", "Pro", "CreatorPlus", "CreatorPro"];
const BAN_STATUS_OPTIONS = ["any", "none", "platform", "social"] as const;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseRoleList(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function BanPill({ ban }: { ban: ActiveBan }) {
  const label = ban.kind === "platform" ? "平台封" : "社交封";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs ${
        ban.kind === "platform"
          ? "bg-red-500/15 text-red-100"
          : "bg-amber-500/15 text-amber-100"
      }`}
    >
      {label}
    </span>
  );
}

export default function AdminAccountsPage() {
  const accountState = useAccountState();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [vip, setVip] = useState("");
  const [banStatus, setBanStatus] =
    useState<(typeof BAN_STATUS_OPTIONS)[number]>("any");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [orders, setOrders] = useState<VipOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = accountState.astrobox?.roles?.includes("admin") ?? false;

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await AdminApi.users.list({
        search,
        role,
        vip,
        banStatus,
        limit: 100,
      });
      setUsers(res.items);
      if (!selectedUserId && res.items[0]) {
        setSelectedUserId(res.items[0].userId);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (userId: string) => {
    if (!userId) return;
    setDetailLoading(true);
    try {
      const [nextDetail, nextOrders] = await Promise.all([
        AdminApi.users.detail(userId),
        AdminApi.users.orders(userId),
      ]);
      setDetail(nextDetail);
      setOrders(nextOrders);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDetail(null);
      setOrders([]);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    void loadDetail(selectedUserId);
  }, [selectedUserId]);

  const selectedSummary = useMemo(
    () => users.find((item) => item.userId === selectedUserId),
    [selectedUserId, users],
  );

  return (
    <AdminPage
      title="账号管理"
      description="搜索用户、处理封禁、调整会员档位、查看订单和维护角色。"
      loading={loading && users.length === 0}
      error={error}
      onRetry={loadUsers}
    >
      <div className="grid gap-4 2xl:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
        <Panel title="用户列表">
          <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
            <input
              className={inputClass}
              placeholder="搜索 userId / 名称 / 邮箱"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <input
              className={inputClass}
              placeholder="角色"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            />
            <select
              className={inputClass}
              value={vip}
              onChange={(event) => setVip(event.target.value)}
            >
              <option value="">全部会员</option>
              {VIP_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={banStatus}
              onChange={(event) => setBanStatus(event.target.value as typeof banStatus)}
            >
              {BAN_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button className="w-full" onClick={loadUsers}>查询</Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">
            {users.map((user) => (
              <button
                key={user.userId}
                type="button"
                className={`flex w-full items-center gap-3 border-b border-white/10 px-3 py-3 text-left transition last:border-b-0 ${
                  selectedUserId === user.userId
                    ? "bg-white/10"
                    : "bg-black/10 hover:bg-white/5"
                }`}
                onClick={() => setSelectedUserId(user.userId)}
              >
                <img
                  src={user.avatar}
                  className="h-10 w-10 rounded-full object-cover"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {user.displayName || user.username || user.userId}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                      {user.vip}
                    </span>
                  </div>
                  <p className="truncate font-mono-sarasa text-xs text-white/50">
                    {user.userId}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {user.activeBans.map((ban) => (
                    <BanPill key={ban.id} ban={ban} />
                  ))}
                </div>
              </button>
            ))}
            {users.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-white/50">
                没有匹配用户
              </div>
            )}
          </div>
        </Panel>

        <Panel title={selectedSummary?.displayName || selectedUserId || "用户详情"}>
          {detailLoading && (
            <div className="py-20 text-center text-sm text-white/60">加载中...</div>
          )}
          {!detailLoading && detail && (
            <div className="flex flex-col gap-4">
              <UserBasics detail={detail} />
              <BanManager detail={detail} onChanged={() => loadDetail(detail.userId)} />
              <VipManager
                detail={detail}
                orders={orders}
                onChanged={() => loadDetail(detail.userId)}
              />
              <RoleManager
                detail={detail}
                enabled={isAdmin}
                onChanged={() => loadDetail(detail.userId)}
              />
            </div>
          )}
          {!detailLoading && !detail && (
            <div className="py-20 text-center text-sm text-white/60">
              选择一个用户查看详情
            </div>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}

function UserBasics({ detail }: { detail: AdminUserDetail }) {
  return (
    <div className="grid gap-3 rounded-xl bg-black/20 p-3 text-sm text-white/70 md:grid-cols-2">
      <div>
        <span className="text-white/40">User ID</span>
        <p className="font-mono-sarasa text-white">{detail.userId}</p>
      </div>
      <div>
        <span className="text-white/40">Email</span>
        <p className="truncate text-white">{detail.email || "--"}</p>
      </div>
      <div>
        <span className="text-white/40">Roles</span>
        <p className="text-white">{detail.roles.join(", ") || "--"}</p>
      </div>
      <div>
        <span className="text-white/40">Created</span>
        <p className="text-white">{formatDateTime(detail.createdAt)}</p>
      </div>
    </div>
  );
}

function BanManager({
  detail,
  onChanged,
}: {
  detail: AdminUserDetail;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<BanKind>("social");
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notifyUser, setNotifyUser] = useState(true);

  const createBan = async () => {
    if (!reason.trim()) {
      toast.error("请填写封禁原因");
      return;
    }
    try {
      await AdminApi.users.createBan(detail.userId, {
        kind,
        reason: reason.trim(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        notifyUser,
      });
      toast.success("封禁已创建");
      setReason("");
      setDurationMinutes("");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const revokeBan = async (ban: ActiveBan) => {
    try {
      await AdminApi.users.revokeBan(detail.userId, ban.id, {
        reason: "管理员手动解除",
        notifyUser: true,
      });
      toast.success("封禁已撤销");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="rounded-xl bg-black/20 p-3">
      <h3 className="mb-3 text-sm font-semibold text-white">封禁</h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        <select
          className={inputClass}
          value={kind}
          onChange={(event) => setKind(event.target.value as BanKind)}
        >
          <option value="social">社交封</option>
          <option value="platform">平台封</option>
        </select>
        <input
          className={inputClass}
          placeholder="原因"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <input
          className={inputClass}
          placeholder="分钟，空=永久"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
        />
        <Button className="w-full" onClick={createBan}>创建封禁</Button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-white/60">
        <input
          type="checkbox"
          checked={notifyUser}
          onChange={(event) => setNotifyUser(event.target.checked)}
        />
        发送信箱通知
      </label>
      <div className="mt-3 flex flex-col gap-2">
        {detail.banHistory.map((ban) => (
          <div
            key={ban.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70"
          >
            <BanPill ban={ban} />
            <span className="min-w-0 flex-1">
              {ban.reason} · {formatDateTime(ban.createdAt)} - {formatDateTime(ban.expiresAt)}
              {ban.revokedAt ? ` · 已撤销 ${formatDateTime(ban.revokedAt)}` : ""}
            </span>
            {!ban.revokedAt && (
              <Button size="1" color="red" variant="soft" onClick={() => revokeBan(ban)}>
                撤销
              </Button>
            )}
          </div>
        ))}
        {detail.banHistory.length === 0 && (
          <p className="text-sm text-white/45">暂无封禁记录</p>
        )}
      </div>
    </div>
  );
}

function VipManager({
  detail,
  orders,
  onChanged,
}: {
  detail: AdminUserDetail;
  orders: VipOrder[];
  onChanged: () => void;
}) {
  const [op, setOp] = useState<"set-expire" | "grant-months" | "revoke-tier" | "set-current-tier">("grant-months");
  const [tier, setTier] = useState<VipTier>("Pro");
  const [months, setMonths] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [notifyUser, setNotifyUser] = useState(false);

  const submit = async () => {
    try {
      await AdminApi.users.adjustVip(detail.userId, {
        op,
        tier,
        months: months ? Number(months) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        reason,
        notifyUser,
      });
      toast.success("会员状态已更新");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="rounded-xl bg-black/20 p-3">
      <h3 className="mb-3 text-sm font-semibold text-white">会员</h3>
      <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
        <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
          <span className="text-white/40">当前档位</span>
          <p className="text-white">{detail.vip}</p>
        </div>
        {Object.entries(detail.vipExpireMap || {}).map(([key, value]) => (
          <div key={key} className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
            <span className="text-white/40">{key}</span>
            <p className="text-white">{formatDateTime(value)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        <select className={inputClass} value={op} onChange={(event) => setOp(event.target.value as typeof op)}>
          <option value="grant-months">补发月数</option>
          <option value="set-expire">设置过期</option>
          <option value="revoke-tier">中断档位</option>
          <option value="set-current-tier">改当前档位</option>
        </select>
        <select className={inputClass} value={tier} onChange={(event) => setTier(event.target.value as VipTier)}>
          {VIP_TIERS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input className={inputClass} value={months} onChange={(event) => setMonths(event.target.value)} placeholder="月数" />
        <input className={inputClass} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" />
        <Button className="w-full" onClick={submit}>应用</Button>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
        <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="备注" />
        <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white/60">
          <input type="checkbox" checked={notifyUser} onChange={(event) => setNotifyUser(event.target.checked)} />
          通知用户
        </label>
      </div>
      <h4 className="mb-2 mt-4 text-sm font-medium text-white/80">订单历史</h4>
      <div className="max-h-48 overflow-auto rounded-lg border border-white/10">
        {orders.map((order) => (
          <div key={order.id} className="grid min-w-[520px] grid-cols-[1fr_90px_70px_130px] gap-2 border-b border-white/10 px-3 py-2 text-xs text-white/65 last:border-b-0">
            <span className="truncate font-mono-sarasa">{order.orderId}</span>
            <span>{order.vipType}</span>
            <span>{order.month} 月</span>
            <span>{formatDateTime(order.createdAt)}</span>
          </div>
        ))}
        {orders.length === 0 && <div className="px-3 py-6 text-center text-sm text-white/45">暂无订单</div>}
      </div>
    </div>
  );
}

function RoleManager({
  detail,
  enabled,
  onChanged,
}: {
  detail: AdminUserDetail;
  enabled: boolean;
  onChanged: () => void;
}) {
  const [add, setAdd] = useState("");
  const [remove, setRemove] = useState("");

  const submit = async () => {
    try {
      await AdminApi.users.roles(detail.userId, {
        add: parseRoleList(add),
        remove: parseRoleList(remove),
      });
      toast.success("角色已更新");
      setAdd("");
      setRemove("");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="rounded-xl bg-black/20 p-3">
      <h3 className="mb-3 text-sm font-semibold text-white">角色</h3>
      <p className="mb-3 text-sm text-white/60">{detail.roles.join(", ") || "无角色"}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
        <Field label="添加">
          <input className={inputClass} disabled={!enabled} value={add} onChange={(event) => setAdd(event.target.value)} placeholder="admin moderator" />
        </Field>
        <Field label="移除">
          <input className={inputClass} disabled={!enabled} value={remove} onChange={(event) => setRemove(event.target.value)} placeholder="moderator" />
        </Field>
        <div className="flex items-end">
          <Button className="w-full" disabled={!enabled} onClick={submit}>更新</Button>
        </div>
      </div>
      {!enabled && <p className="mt-2 text-xs text-white/45">只有 admin 角色可以修改用户角色。</p>}
    </div>
  );
}
