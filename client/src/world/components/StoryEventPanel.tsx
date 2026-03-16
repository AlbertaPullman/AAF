type StoryOptionCheckMode = "SINGLE" | "PER_PLAYER" | "UNLIMITED";
type StoryNarrativeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type StoryEventOption = {
  id: string;
  label: string;
  check?: {
    skillKey: string;
    dc: number;
    checkMode: StoryOptionCheckMode;
  };
  closed: boolean;
  attempts: Array<{
    id: string;
    userId: string;
    finalTotal: number;
    success: boolean;
    createdAt: string;
  }>;
};

type StoryEventItem = {
  id: string;
  title: string;
  description: string;
  status: "DRAFT" | "OPEN" | "RESOLVED" | "CLOSED";
  options: StoryEventOption[];
  narrativeRequests: Array<{
    id: string;
    userId: string;
    cost: number;
    reason: string;
    status: StoryNarrativeRequestStatus;
    gmNote?: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

type StoryEventCardItem = {
  id: string;
  content: string;
  createdAt: string;
};

type StoryEventPanelProps = {
  myRole: "GM" | "PLAYER" | "OBSERVER" | "ASSISTANT" | null;
  loading: boolean;
  events: StoryEventItem[];
  cards: StoryEventCardItem[];
  onRefresh: () => void;
  onCreateEvent: (payload: { title: string; description: string }) => void;
  onAddOption: (eventId: string, payload: { label: string; skillKey: string; dc: number; checkMode: StoryOptionCheckMode }) => void;
  onSubmitCheck: (eventId: string, optionId: string, payload: { finalTotal: number; chatContent: string }) => void;
  onResolveEvent: (eventId: string, payload: { summary: string; finalOutcome: string }) => void;
  onCreateNarrativeRequest: (eventId: string, payload: { cost: number; reason: string }) => void;
  onDecideNarrativeRequest: (
    eventId: string,
    requestId: string,
    payload: { status: Exclude<StoryNarrativeRequestStatus, "PENDING">; gmNote: string }
  ) => void;
};

function isGm(role: StoryEventPanelProps["myRole"]) {
  return role === "GM";
}

export function StoryEventPanel({
  myRole,
  loading,
  events,
  cards,
  onRefresh,
  onCreateEvent,
  onAddOption,
  onSubmitCheck,
  onResolveEvent,
  onCreateNarrativeRequest,
  onDecideNarrativeRequest
}: StoryEventPanelProps) {
  const gm = isGm(myRole);

  return (
    <div className="world-card">
      <div className="mb-2 flex items-center justify-between">
        <strong>剧情事件</strong>
        <button className="rounded border px-2 py-1 text-xs" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {gm ? (
        <form
          className="mb-3 space-y-2 rounded border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const title = String(fd.get("eventTitle") ?? "").trim();
            const description = String(fd.get("eventDesc") ?? "").trim();
            if (!title) {
              return;
            }
            onCreateEvent({ title, description });
            form.reset();
          }}
        >
          <p className="text-xs font-semibold">创建即时事件（GM）</p>
          <input className="w-full rounded border px-2 py-1 text-xs" name="eventTitle" placeholder="事件标题，例如：卫兵巡检" />
          <textarea className="w-full rounded border px-2 py-1 text-xs" name="eventDesc" placeholder="事件描述（可留空）" rows={2} />
          <button className="rounded bg-slate-800 px-2 py-1 text-xs text-white" type="submit">
            创建事件
          </button>
        </form>
      ) : null}

      <div className="space-y-2">
        {events.length === 0 ? <p className="text-xs text-gray-500">暂无进行中的剧情事件</p> : null}
        {events.map((event) => (
          <div className="rounded border p-2" key={event.id}>
            <p className="text-sm font-semibold">{event.title}</p>
            <p className="text-xs text-gray-600">状态：{event.status}</p>
            {event.description ? <p className="text-xs text-gray-700">{event.description}</p> : null}

            <div className="mt-2 rounded bg-emerald-50 p-2">
              <p className="text-xs font-semibold text-emerald-900">物语点提案</p>
              {event.narrativeRequests.length === 0 ? <p className="text-xs text-emerald-700">暂无提案</p> : null}
              <div className="space-y-1">
                {event.narrativeRequests.map((request) => (
                  <div className="rounded border border-emerald-200 bg-white p-2" key={request.id}>
                    <p className="text-xs text-emerald-900">
                      提案人：{request.userId} · 消耗：{request.cost} · 状态：{request.status}
                    </p>
                    <p className="text-xs text-emerald-800">理由：{request.reason}</p>
                    {request.gmNote ? <p className="text-xs text-emerald-700">GM备注：{request.gmNote}</p> : null}
                    {gm && event.status === "OPEN" && request.status === "PENDING" ? (
                      <form
                        className="mt-1 flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const fd = new FormData(form);
                          const status = String(fd.get("decision") ?? "APPROVED") as "APPROVED" | "REJECTED";
                          const gmNote = String(fd.get("gmNote") ?? "").trim();
                          onDecideNarrativeRequest(event.id, request.id, { status, gmNote });
                          form.reset();
                        }}
                      >
                        <select className="rounded border px-2 py-1 text-xs" name="decision" defaultValue="APPROVED">
                          <option value="APPROVED">通过</option>
                          <option value="REJECTED">驳回</option>
                        </select>
                        <input className="flex-1 rounded border px-2 py-1 text-xs" name="gmNote" placeholder="GM备注（可选）" />
                        <button className="rounded border px-2 py-1 text-xs" type="submit">
                          提交裁决
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>

              {!gm && event.status === "OPEN" ? (
                <form
                  className="mt-2 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    const cost = Number(fd.get("storyPointCost") ?? NaN);
                    const reason = String(fd.get("storyPointReason") ?? "").trim();
                    if (!Number.isFinite(cost) || cost <= 0 || !reason) {
                      return;
                    }
                    onCreateNarrativeRequest(event.id, { cost, reason });
                    form.reset();
                  }}
                >
                  <input className="w-16 rounded border px-2 py-1 text-xs" name="storyPointCost" placeholder="点数" defaultValue="1" />
                  <input className="flex-1 rounded border px-2 py-1 text-xs" name="storyPointReason" placeholder="你希望改写剧情的方向" />
                  <button className="rounded border px-2 py-1 text-xs" type="submit">
                    提交提案
                  </button>
                </form>
              ) : null}
            </div>

            <div className="mt-2 space-y-2">
              {event.options.map((option) => (
                <div className="rounded bg-gray-50 p-2" key={option.id}>
                  <p className="text-xs font-semibold">{option.label}</p>
                  {option.check ? (
                    <p className="text-xs text-gray-600">
                      [{option.check.skillKey}] DC {option.check.dc} · {option.check.checkMode}
                    </p>
                  ) : null}
                  <p className="text-xs text-gray-600">尝试次数：{option.attempts.length}{option.closed ? "（已关闭）" : ""}</p>

                  {!gm && event.status === "OPEN" && !option.closed ? (
                    <form
                      className="mt-1 flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const fd = new FormData(form);
                        const finalTotal = Number(fd.get("finalTotal") ?? NaN);
                        const chatContent = String(fd.get("chatContent") ?? "").trim();
                        if (!Number.isFinite(finalTotal)) {
                          return;
                        }
                        onSubmitCheck(event.id, option.id, { finalTotal, chatContent });
                        form.reset();
                      }}
                    >
                      <input className="w-20 rounded border px-2 py-1 text-xs" name="finalTotal" placeholder="结果" />
                      <input className="flex-1 rounded border px-2 py-1 text-xs" name="chatContent" placeholder="可选：绑定到聊天的发言" />
                      <button className="rounded border px-2 py-1 text-xs" type="submit">
                        提交检定
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>

            {gm && event.status === "OPEN" ? (
              <>
                <form
                  className="mt-2 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    const label = String(fd.get("optionLabel") ?? "").trim();
                    const skillKey = String(fd.get("skillKey") ?? "").trim();
                    const dc = Number(fd.get("dc") ?? NaN);
                    const checkMode = String(fd.get("checkMode") ?? "SINGLE") as StoryOptionCheckMode;
                    if (!label || !skillKey || !Number.isFinite(dc)) {
                      return;
                    }
                    onAddOption(event.id, { label, skillKey, dc, checkMode });
                    form.reset();
                  }}
                >
                  <input className="rounded border px-2 py-1 text-xs" name="optionLabel" placeholder="选项文案" />
                  <input className="rounded border px-2 py-1 text-xs" name="skillKey" placeholder="skillKey" />
                  <input className="w-16 rounded border px-2 py-1 text-xs" name="dc" placeholder="DC" />
                  <select className="rounded border px-2 py-1 text-xs" name="checkMode" defaultValue="SINGLE">
                    <option value="SINGLE">SINGLE</option>
                    <option value="PER_PLAYER">PER_PLAYER</option>
                    <option value="UNLIMITED">UNLIMITED</option>
                  </select>
                  <button className="rounded border px-2 py-1 text-xs" type="submit">
                    添加选项
                  </button>
                </form>

                <form
                  className="mt-2 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    const summary = String(fd.get("summary") ?? "").trim();
                    const finalOutcome = String(fd.get("finalOutcome") ?? "").trim();
                    if (!summary) {
                      return;
                    }
                    onResolveEvent(event.id, { summary, finalOutcome });
                    form.reset();
                  }}
                >
                  <input className="flex-1 rounded border px-2 py-1 text-xs" name="summary" placeholder="结算简述" />
                  <input className="flex-1 rounded border px-2 py-1 text-xs" name="finalOutcome" placeholder="后果（可选）" />
                  <button className="rounded bg-amber-700 px-2 py-1 text-xs text-white" type="submit">
                    结算并发卡
                  </button>
                </form>
              </>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded border p-2">
        <p className="mb-1 text-xs font-semibold">事件结算卡片存档（最近）</p>
        {cards.length === 0 ? <p className="text-xs text-gray-500">暂无卡片</p> : null}
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {cards.map((card) => (
            <div className="rounded bg-amber-50 p-2 text-xs" key={card.id}>
              <p className="text-gray-700">{new Date(card.createdAt).toLocaleString()}</p>
              <p className="whitespace-pre-line text-amber-900">{card.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
