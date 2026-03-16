import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../../lib/http";
import { useAuthStore } from "../../store/authStore";
import { connectSocket, disconnectSocket, reconnectSocket, socket, SOCKET_EVENTS } from "../../lib/socket";

type WorldItem = {
  id: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PASSWORD" | "FRIENDS" | "PRIVATE";
  owner: {
    id: string;
    username: string;
    displayName: string | null;
  };
  _count: {
    members: number;
    scenes: number;
  };
  myRole?: string;
};

type LobbyChannelKey = "LOBBY" | "SYSTEM" | "PRIVATE" | string;

type ChatMessage = {
  id: string;
  channelKey?: string;
  content: string;
  createdAt: string;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

type FriendUser = {
  id: string;
  username: string;
  displayName: string | null;
};

type FriendItem = {
  id: string;
  status: "ACCEPTED";
  updatedAt: string;
  user: FriendUser;
};

type FriendRequestItem = {
  id: string;
  status: "PENDING";
  createdAt: string;
  fromUser: FriendUser;
};

const BASE_CHANNELS: LobbyChannelKey[] = ["LOBBY", "SYSTEM"];

function normalizeLobbyChannel(channelKey?: string): LobbyChannelKey {
  const normalized = (channelKey ?? "LOBBY").toUpperCase().trim();
  return normalized || "LOBBY";
}

function getLobbyChannelLabel(channelKey: LobbyChannelKey): string {
  const normalized = normalizeLobbyChannel(channelKey);
  if (normalized === "LOBBY") {
    return "聊天大厅";
  }
  if (normalized === "SYSTEM") {
    return "系统频道";
  }
  if (normalized === "PRIVATE") {
    return "私密频道";
  }
  return normalized;
}

function isSystemChannel(channelKey: LobbyChannelKey): boolean {
  return normalizeLobbyChannel(channelKey) === "SYSTEM";
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [publicWorlds, setPublicWorlds] = useState<WorldItem[]>([]);
  const [myWorlds, setMyWorlds] = useState<WorldItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PASSWORD">("PUBLIC");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">("disconnected");
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [hasChatAlert, setHasChatAlert] = useState(false);
  const [currentLobbyChannel, setCurrentLobbyChannel] = useState<LobbyChannelKey>("LOBBY");

  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [socialTab, setSocialTab] = useState<"friends" | "requests">("friends");
  const [nicknameInput, setNicknameInput] = useState(user?.displayName || user?.username || "");
  const [savingNickname, setSavingNickname] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [friendActionId, setFriendActionId] = useState<string | null>(null);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);

  const chatDrawerOpenRef = useRef(false);
  const currentUserIdRef = useRef<string | undefined>(user?.id);
  const currentChannelRef = useRef<LobbyChannelKey>("LOBBY");

  const displayName = useMemo(() => user?.displayName || user?.username || "未知用户", [user]);

  const currentChannelName = useMemo(() => getLobbyChannelLabel(currentLobbyChannel), [currentLobbyChannel]);

  const availableChannels = useMemo(() => {
    const dynamic = new Set<LobbyChannelKey>();
    for (const message of chatMessages) {
      dynamic.add(normalizeLobbyChannel(message.channelKey));
    }

    const merged = [...BASE_CHANNELS];
    for (const channel of dynamic) {
      if (!merged.includes(channel)) {
        merged.push(channel);
      }
    }
    return merged;
  }, [chatMessages]);

  const filteredChatMessages = useMemo(
    () => chatMessages.filter((message) => normalizeLobbyChannel(message.channelKey) === normalizeLobbyChannel(currentLobbyChannel)),
    [chatMessages, currentLobbyChannel]
  );

  const chatInputDisabled = useMemo(() => isSystemChannel(currentLobbyChannel) || socketStatus !== "connected", [currentLobbyChannel, socketStatus]);

  const onlineFriends = useMemo(() => friends.filter((item) => Date.now() - new Date(item.updatedAt).getTime() <= 1000 * 60 * 10), [friends]);
  const offlineFriends = useMemo(() => friends.filter((item) => Date.now() - new Date(item.updatedAt).getTime() > 1000 * 60 * 10), [friends]);

  const refreshRecentLobbyMessages = useCallback(async () => {
    const resp = await http.get("/chat/global/recent", { params: { limit: 100 } });
    const list = (resp.data.data ?? []) as ChatMessage[];
    setChatMessages(list.map((item) => ({ ...item, channelKey: normalizeLobbyChannel(item.channelKey) })));
  }, []);

  const loadWorlds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [publicResp, mineResp] = await Promise.all([http.get("/worlds"), http.get("/worlds", { params: { scope: "mine" } })]);

      setPublicWorlds(publicResp.data.data ?? []);
      setMyWorlds(mineResp.data.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加载世界列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSocialData = useCallback(async () => {
    if (!token) {
      return;
    }

    setSocialLoading(true);
    setSocialError(null);
    try {
      const [friendsResp, requestsResp] = await Promise.all([http.get("/social/friends"), http.get("/social/requests/incoming")]);
      setFriends((friendsResp.data?.data ?? []) as FriendItem[]);
      setIncomingRequests((requestsResp.data?.data ?? []) as FriendRequestItem[]);
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "加载社交数据失败");
    } finally {
      setSocialLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadWorlds();
  }, [loadWorlds]);

  useEffect(() => {
    void loadSocialData();
  }, [loadSocialData]);

  useEffect(() => {
    chatDrawerOpenRef.current = isChatDrawerOpen;
    if (isChatDrawerOpen) {
      setHasChatAlert(false);
    }
  }, [isChatDrawerOpen]);

  useEffect(() => {
    currentUserIdRef.current = user?.id;
    setNicknameInput(user?.displayName || user?.username || "");
  }, [user?.id, user?.displayName, user?.username]);

  useEffect(() => {
    currentChannelRef.current = currentLobbyChannel;
  }, [currentLobbyChannel]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setSocketStatus("connecting");

    void (async () => {
      try {
        await refreshRecentLobbyMessages();
      } catch {
        // keep empty state when history loading fails
      }
    })();

    connectSocket(token);

    const onAck = () => {
      setSocketStatus("connected");
    };

    const onConnect = () => {
      setSocketStatus("connected");
    };

    const onDisconnect = () => {
      setSocketStatus("disconnected");
    };

    const onConnectError = () => {
      setSocketStatus("reconnecting");
      setError((prev) => prev ?? "实时连接异常，正在自动重连");
    };

    const onReconnectAttempt = () => {
      setSocketStatus("reconnecting");
    };

    const onReconnectFailed = () => {
      setSocketStatus("disconnected");
    };

    const onNewMessage = (message: ChatMessage) => {
      const normalizedChannel = normalizeLobbyChannel(message.channelKey);
      const isFromSelf = message.fromUser?.id === currentUserIdRef.current;
      const isCurrentChannel = normalizeLobbyChannel(currentChannelRef.current) === normalizedChannel;
      if (!isFromSelf && (!chatDrawerOpenRef.current || !isCurrentChannel)) {
        setHasChatAlert(true);
      }

      setChatMessages((prev) => {
        const next = [...prev, { ...message, channelKey: normalizedChannel }];
        if (next.length > 200) {
          return next.slice(next.length - 200);
        }
        return next;
      });
    };

    socket.on(SOCKET_EVENTS.connectionAck, onAck);
    socket.on(SOCKET_EVENTS.globalMessageNew, onNewMessage);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);

    return () => {
      socket.off(SOCKET_EVENTS.connectionAck, onAck);
      socket.off(SOCKET_EVENTS.globalMessageNew, onNewMessage);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
      setSocketStatus("disconnected");
      disconnectSocket();
    };
  }, [token, refreshRecentLobbyMessages]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshRecentLobbyMessages();
    }, 12000);

    return () => {
      window.clearInterval(timer);
    };
  }, [token, refreshRecentLobbyMessages]);

  const onToggleChatDrawer = () => {
    setIsChatDrawerOpen((prev) => {
      const next = !prev;
      if (next) {
        setHasChatAlert(false);
      }
      return next;
    });
  };

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("世界名称不能为空");
      return;
    }
    if (visibility === "PASSWORD" && password.trim().length < 4) {
      setError("密码世界口令至少 4 位");
      return;
    }

    setCreating(true);
    try {
      await http.post("/worlds", {
        name,
        description,
        visibility,
        password: visibility === "PASSWORD" ? password : undefined
      });

      setName("");
      setDescription("");
      setVisibility("PUBLIC");
      setPassword("");
      await loadWorlds();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "创建世界失败");
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async (world: WorldItem) => {
    try {
      const joinPayload: { password?: string } = {};
      if (world.visibility === "PASSWORD") {
        const input = window.prompt(`请输入世界 [${world.name}] 的密码`);
        if (!input) {
          return;
        }
        joinPayload.password = input;
      }

      await http.post(`/worlds/${world.id}/join`, joinPayload);
      await loadWorlds();
      navigate(`/world/${world.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加入世界失败");
    }
  };

  const onLogout = () => {
    disconnectSocket();
    clearAuth();
    navigate("/login");
  };

  const onSendChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatInput.trim() || chatInputDisabled) {
      return;
    }

    setChatSending(true);
    const content = chatInput;
    setChatInput("");

    const ackTimeout = window.setTimeout(() => {
      setChatSending(false);
      setError((prev) => prev ?? "发送超时，请稍后重试");
      setChatInput((current) => current || content);
    }, 8000);

    socket.emit(
      SOCKET_EVENTS.globalMessageSend,
      { content, channelKey: normalizeLobbyChannel(currentLobbyChannel) },
      (result?: { ok?: boolean; error?: string }) => {
        window.clearTimeout(ackTimeout);
        if (!result?.ok) {
          setError(result?.error || "发送消息失败");
          setChatInput(content);
        }
        setChatSending(false);
      }
    );
  };

  const onSaveNickname = async () => {
    if (!nicknameInput.trim()) {
      setSocialError("昵称不能为空");
      return;
    }

    setSavingNickname(true);
    setSocialError(null);
    try {
      const resp = await http.patch("/auth/me", { displayName: nicknameInput.trim() });
      const updated = resp.data?.data;
      updateUser({ displayName: updated?.displayName ?? nicknameInput.trim() });
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "保存昵称失败");
    } finally {
      setSavingNickname(false);
    }
  };

  const onSendFriendRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!friendQuery.trim()) {
      setSocialError("请输入好友昵称或账号");
      return;
    }

    setSendingFriendRequest(true);
    setSocialError(null);
    try {
      await http.post("/social/requests", { query: friendQuery.trim() });
      setShowAddFriendModal(false);
      setFriendQuery("");
      await loadSocialData();
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "发送好友申请失败");
    } finally {
      setSendingFriendRequest(false);
    }
  };

  const onHandleFriendRequest = async (requestId: string, action: "accept" | "reject") => {
    setFriendActionId(requestId);
    setSocialError(null);
    try {
      await http.patch(`/social/requests/${requestId}`, { action });
      await loadSocialData();
      if (action === "reject") {
        await refreshRecentLobbyMessages();
      }
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "处理好友申请失败");
    } finally {
      setFriendActionId(null);
    }
  };

  return (
    <section className="lobby-page space-y-6">
      <aside className={`lobby-chat-drawer ${isChatDrawerOpen ? "is-open" : ""}`}>
        <button
          className="lobby-chat-drawer__toggle"
          onClick={onToggleChatDrawer}
          type="button"
          aria-expanded={isChatDrawerOpen}
          aria-label={isChatDrawerOpen ? "收起聊天大厅" : "展开聊天大厅"}
        >
          <span>{isChatDrawerOpen ? "收起" : "聊天大厅"}</span>
          {hasChatAlert ? <span className="lobby-chat-drawer__alert">!</span> : null}
        </button>

        {isChatDrawerOpen && availableChannels.length > 0 ? (
          <div className="lobby-chat-drawer__channel-stack">
            {availableChannels.map((channel) => {
              const active = normalizeLobbyChannel(channel) === normalizeLobbyChannel(currentLobbyChannel);
              return (
                <button
                  key={channel}
                  className={`lobby-chat-drawer__channel-toggle ${active ? "is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setCurrentLobbyChannel(channel);
                    setHasChatAlert(false);
                  }}
                >
                  {getLobbyChannelLabel(channel)}
                </button>
              );
            })}
          </div>
        ) : null}

        <article className="rounded border p-4 lobby-panel lobby-panel--chat lobby-chat-drawer__panel">
          <div className="mb-3 flex items-center justify-between lobby-chat-drawer__header">
            <h2 className="text-lg font-semibold lobby-chat-drawer__title">{currentChannelName}</h2>
            <span
              className={`text-xs lobby-chat__status ${
                socketStatus === "connected" ? "text-green-600" : socketStatus === "reconnecting" ? "text-amber-600" : "text-gray-500"
              }`}
            >
              {socketStatus === "connected"
                ? "实时连接中"
                : socketStatus === "reconnecting"
                  ? "重连中..."
                  : socketStatus === "connecting"
                    ? "连接中..."
                    : "已断开"}
            </span>
          </div>

          {socketStatus !== "connected" ? (
            <div className="mb-3 flex items-center justify-between rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
              <span>{socketStatus === "reconnecting" ? "实时连接异常，正在自动重连" : "实时连接已断开"}</span>
              <button className="rounded border border-amber-300 px-2 py-1" type="button" onClick={reconnectSocket}>
                立即重连
              </button>
            </div>
          ) : null}

          <div className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded border bg-gray-50 p-3 lobby-chat-feed">
            {filteredChatMessages.length === 0 ? <p className="text-sm text-gray-500">当前频道暂无消息</p> : null}
            {filteredChatMessages.map((message) => (
              <div className="rounded bg-white p-2 text-sm lobby-chat-message" key={message.id}>
                <p className="text-xs text-gray-500 lobby-chat-message__meta">
                  <span className="lobby-badge">{getLobbyChannelLabel(normalizeLobbyChannel(message.channelKey))}</span>
                  {message.fromUser.displayName || message.fromUser.username} · {new Date(message.createdAt).toLocaleTimeString()}
                </p>
                <p className="text-gray-800">{message.content}</p>
              </div>
            ))}
          </div>

          <form className="flex gap-2 lobby-chat-form" onSubmit={onSendChat}>
            <input
              className="flex-1 rounded border px-3 py-2"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isSystemChannel(currentLobbyChannel) ? "系统频道为只读通知频道" : "输入大厅消息"}
              maxLength={1000}
              disabled={chatInputDisabled}
            />
            <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={chatSending || chatInputDisabled}>
              {chatSending ? "发送中..." : "发送"}
            </button>
          </form>
        </article>
      </aside>

      <div className={`lobby-social ${isSocialOpen ? "is-open" : ""}`}>
        <button
          className="lobby-social__fab"
          type="button"
          aria-label={isSocialOpen ? "收起社交面板" : "展开社交面板"}
          onClick={() => {
            setIsSocialOpen((prev) => !prev);
            if (!isSocialOpen) {
              setSocialTab("friends");
              setSocialError(null);
            }
          }}
        >
          人
        </button>

        {isSocialOpen ? (
          <section className="lobby-social__panel">
            <div className="lobby-social__header">
              <p className="lobby-social__title">社交中心</p>
              <div className="lobby-social__nickname-row">
                <input value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} placeholder="显示昵称" maxLength={40} />
                <button type="button" onClick={() => void onSaveNickname()} disabled={savingNickname}>
                  {savingNickname ? "保存中..." : "保存昵称"}
                </button>
              </div>
            </div>

            <div className="lobby-social__tabs">
              <button type="button" className={socialTab === "friends" ? "is-active" : ""} onClick={() => setSocialTab("friends")}>
                好友
              </button>
              <button type="button" className={socialTab === "requests" ? "is-active" : ""} onClick={() => setSocialTab("requests")}>
                好友申请
              </button>
            </div>

            <div className="lobby-social__body">
              {socialLoading ? <p className="text-sm text-gray-500">社交数据加载中...</p> : null}
              {!socialLoading && socialTab === "friends" ? (
                <div className="space-y-3">
                  <div>
                    <p className="lobby-social__section-title">在线好友</p>
                    {onlineFriends.length === 0 ? <p className="text-sm text-gray-500">暂无在线好友</p> : null}
                    {onlineFriends.map((item) => (
                      <div className="lobby-social__friend-item" key={`online-${item.id}`}>
                        <span>{item.user.displayName || item.user.username}</span>
                        <span className="lobby-social__friend-status is-online">在线</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="lobby-social__section-title">离线好友</p>
                    {offlineFriends.length === 0 ? <p className="text-sm text-gray-500">暂无离线好友</p> : null}
                    {offlineFriends.map((item) => (
                      <div className="lobby-social__friend-item" key={`offline-${item.id}`}>
                        <span>{item.user.displayName || item.user.username}</span>
                        <span className="lobby-social__friend-status">离线</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!socialLoading && socialTab === "requests" ? (
                <div className="space-y-2">
                  {incomingRequests.length === 0 ? <p className="text-sm text-gray-500">暂无待处理好友申请</p> : null}
                  {incomingRequests.map((item) => (
                    <div className="lobby-social__request-item" key={item.id}>
                      <div>
                        <p className="lobby-social__request-name">{item.fromUser.displayName || item.fromUser.username}</p>
                        <p className="text-xs text-gray-500">账号：{item.fromUser.username}</p>
                      </div>
                      <div className="lobby-social__request-actions">
                        <button
                          type="button"
                          className="lobby-social__accept"
                          onClick={() => {
                            void onHandleFriendRequest(item.id, "accept");
                          }}
                          disabled={friendActionId === item.id}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="lobby-social__reject"
                          onClick={() => {
                            void onHandleFriendRequest(item.id, "reject");
                          }}
                          disabled={friendActionId === item.id}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {socialError ? <div className="lobby-social__error">{socialError}</div> : null}

            <div className="lobby-social__footer">
              <button
                type="button"
                onClick={() => {
                  setShowAddFriendModal(true);
                  setSocialError(null);
                }}
              >
                添加好友
              </button>
              <button type="button" className="lobby-social__logout" onClick={onLogout}>
                退出登录
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {showAddFriendModal ? (
        <div className="lobby-social-modal">
          <div className="lobby-social-modal__panel">
            <h3>添加好友</h3>
            <p className="text-sm text-gray-600">输入对方昵称或账号名，发送好友申请。</p>
            <form className="space-y-3" onSubmit={onSendFriendRequest}>
              <input
                className="w-full rounded border px-3 py-2"
                value={friendQuery}
                onChange={(e) => setFriendQuery(e.target.value)}
                placeholder="昵称或账号名"
                maxLength={40}
              />
              <div className="lobby-social-modal__actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFriendModal(false);
                    setFriendQuery("");
                  }}
                >
                  取消
                </button>
                <button type="submit" disabled={sendingFriendRequest}>
                  {sendingFriendRequest ? "发送中..." : "发送申请"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <header className="lobby-hero flex items-center justify-between">
        <div className="lobby-hero__copy">
          <h1 className="text-2xl font-bold">大厅</h1>
          <p className="text-gray-600">欢迎回来，{displayName}。选择世界、集结队友，然后踏上新的冒险。</p>
        </div>
        <button className="lobby-hero__logout rounded bg-gray-800 px-4 py-2 text-white" onClick={onLogout} type="button">
          退出登录
        </button>
      </header>

      {error ? <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-2 lobby-grid">
        <article className="rounded border p-4 lobby-panel lobby-panel--create">
          <h2 className="mb-3 text-lg font-semibold">创建世界</h2>
          <form className="space-y-3 lobby-form" onSubmit={onCreate}>
            <input className="w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="世界名称" required />
            <textarea
              className="w-full rounded border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="世界描述（可选）"
              rows={3}
            />
            <select className="w-full rounded border px-3 py-2" value={visibility} onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PASSWORD")}>
              <option value="PUBLIC">公开世界（PUBLIC）</option>
              <option value="PASSWORD">密码世界（PASSWORD）</option>
            </select>
            {visibility === "PASSWORD" ? (
              <input
                className="w-full rounded border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入进入口令（至少4位）"
                type="password"
              />
            ) : null}

            <button className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60" disabled={creating} type="submit">
              {creating ? "创建中..." : "创建世界"}
            </button>
          </form>
        </article>

        <article className="rounded border p-4 lobby-panel lobby-panel--joined">
          <h2 className="mb-3 text-lg font-semibold">我加入的世界</h2>
          <ul className="space-y-3 lobby-world-list">
            {myWorlds.length === 0 ? <li className="text-gray-500">还没有加入任何世界</li> : null}
            {myWorlds.map((world) => (
              <li className="rounded border p-3 lobby-world-card lobby-world-card--joined" key={world.id}>
                <div className="flex items-center justify-between lobby-world-card__row">
                  <div>
                    <p className="font-medium lobby-world-card__title">{world.name}</p>
                    <p className="text-sm text-gray-600">成员 {world._count.members} / 场景 {world._count.scenes}</p>
                  </div>
                  <button className="rounded bg-green-600 px-3 py-1.5 text-sm text-white lobby-world-card__action" onClick={() => navigate(`/world/${world.id}`)} type="button">
                    进入
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded border p-4 lobby-panel lobby-panel--public">
        <h2 className="mb-3 text-lg font-semibold">公开世界列表</h2>
        {loading ? <p className="text-gray-500">加载中...</p> : null}
        <ul className="space-y-3 lobby-world-list">
          {!loading && publicWorlds.length === 0 ? <li className="text-gray-500">当前没有可见世界</li> : null}
          {publicWorlds.map((world) => {
            const joined = myWorlds.some((item) => item.id === world.id);
            return (
              <li className="rounded border p-3 lobby-world-card" key={world.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 lobby-world-card__row">
                  <div>
                    <p className="font-medium lobby-world-card__title">{world.name}</p>
                    <p className="text-sm text-gray-600">{world.description || "暂无描述"}</p>
                    <div className="lobby-world-card__meta text-xs text-gray-500">
                      <span className="lobby-badge">{world.visibility}</span>
                      <span>成员 {world._count.members}</span>
                      <span>创建者 {world.owner.displayName || world.owner.username}</span>
                    </div>
                  </div>
                  <button
                    className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:bg-gray-300 lobby-world-card__action"
                    disabled={joined}
                    onClick={() => {
                      void onJoin(world);
                    }}
                    type="button"
                  >
                    {joined ? "已加入" : "加入"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
