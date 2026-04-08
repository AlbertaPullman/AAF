import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../../lib/http";
import { connectSocket, disconnectSocket, reconnectSocket, socket, SOCKET_EVENTS } from "../../lib/socket";
import { useAuthStore } from "../../store/authStore";

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

type ChatMessage = {
  id: string;
  worldId?: string;
  channelKey?: string;
  content: string;
  createdAt: string;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

type WorldChannelItem = {
  key: string;
  name: string;
  access: "ALL" | "MEMBERS";
  isDefault: boolean;
  memberUserIds: string[];
};

type WorldChannelMember = {
  userId: string;
  username: string;
  displayName: string | null;
  worldRole: string;
};

type ChannelOption = {
  id: string;
  scope: "GLOBAL" | "WORLD";
  key: string;
  label: string;
};

const GLOBAL_CHANNELS: ChannelOption[] = [
  { id: "GLOBAL:LOBBY", scope: "GLOBAL", key: "LOBBY", label: "大厅主频道" }
];

function displayNameOf(user: { displayName: string | null; username: string }) {
  return user.displayName || user.username;
}

function formatTimeOnly(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isSameDate(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function formatCrossDayDivider(date: Date, now: Date): string {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((todayStart - targetStart) / oneDayMs);
  if (dayDiff === 1) {
    return `昨天 ${formatTimeOnly(date)}`;
  }
  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${formatTimeOnly(date)}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTimeOnly(date)}`;
}

export default function WorldPage() {
  const navigate = useNavigate();
  const { worldId = "" } = useParams();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const updateUser = useAuthStore((state) => state.updateUser);

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

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">("disconnected");
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("WORLD:CHAT");
  const [unreadChannelMap, setUnreadChannelMap] = useState<Record<string, number>>({});
  const [chatError, setChatError] = useState<string | null>(null);

  const [worldChannels, setWorldChannels] = useState<WorldChannelItem[]>([]);
  const [worldMembers, setWorldMembers] = useState<WorldChannelMember[]>([]);
  const [canManageChannels, setCanManageChannels] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUserId, setInviteUserId] = useState("");
  const [invitingUser, setInvitingUser] = useState(false);

  const socialDropdownRef = useRef<HTMLElement | null>(null);
  const socialTriggerRef = useRef<HTMLButtonElement | null>(null);
  const channelDropdownRef = useRef<HTMLDivElement | null>(null);
  const channelTriggerRef = useRef<HTMLButtonElement | null>(null);

  const displayName = useMemo(() => user?.displayName || user?.username || "未知用户", [user]);
  const userButtonLabel = useMemo(() => {
    const firstChar = Array.from(displayName.trim())[0] ?? "";
    if (!firstChar || /^[0-9]$/.test(firstChar)) {
      return "我";
    }
    return firstChar.toUpperCase();
  }, [displayName]);

  const onlineFriends = useMemo(
    () => friends.filter((item) => Date.now() - new Date(item.updatedAt).getTime() <= 1000 * 60 * 10),
    [friends]
  );
  const offlineFriends = useMemo(
    () => friends.filter((item) => Date.now() - new Date(item.updatedAt).getTime() > 1000 * 60 * 10),
    [friends]
  );

  const channelOptions = useMemo(() => {
    const worldOptions: ChannelOption[] = worldChannels.map((item) => ({
      id: `WORLD:${item.key}`,
      scope: "WORLD",
      key: item.key,
      label: item.name
    }));
    return { global: GLOBAL_CHANNELS, world: worldOptions };
  }, [worldChannels]);

  const selectedChannel = useMemo(() => {
    const all = [...channelOptions.global, ...channelOptions.world];
    return all.find((item) => item.id === selectedChannelId) || channelOptions.world[0] || channelOptions.global[0] || null;
  }, [channelOptions, selectedChannelId]);

  const currentWorldChannel = useMemo(() => {
    if (!selectedChannel || selectedChannel.scope !== "WORLD") {
      return null;
    }
    return worldChannels.find((item) => item.key === selectedChannel.key) || null;
  }, [selectedChannel, worldChannels]);

  const inviteCandidates = useMemo(() => {
    if (!currentWorldChannel || currentWorldChannel.access === "ALL") {
      return [] as WorldChannelMember[];
    }

    const joined = new Set(currentWorldChannel.memberUserIds);
    return worldMembers.filter((member) => !joined.has(member.userId));
  }, [currentWorldChannel, worldMembers]);

  const selectedChannelName = selectedChannel
    ? `${selectedChannel.scope === "WORLD" ? "世界" : "全局"} · ${selectedChannel.label}`
    : "频道";

  const canSendCurrentChannel = useMemo(() => {
    if (!selectedChannel) {
      return false;
    }
    if (selectedChannel.scope === "GLOBAL") {
      return selectedChannel.key === "LOBBY";
    }
    return true;
  }, [selectedChannel]);

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

  const loadWorldChannels = useCallback(async () => {
    if (!worldId) {
      return;
    }

    try {
      const resp = await http.get(`/worlds/${worldId}/chat-channels`);
      const data = resp.data?.data;
      const channels = (data?.channels ?? []) as WorldChannelItem[];
      setWorldChannels(channels);
      setWorldMembers((data?.members ?? []) as WorldChannelMember[]);
      setCanManageChannels(!!data?.canManageChannels);

      setSelectedChannelId((prev) => {
        if (!prev.startsWith("WORLD:")) {
          return prev;
        }
        const key = prev.slice("WORLD:".length);
        const exists = channels.some((item) => item.key === key);
        return exists ? prev : "WORLD:CHAT";
      });
    } catch (err: any) {
      setChatError(err.response?.data?.error?.message || "加载世界频道失败");
    }
  }, [worldId]);

  const loadCurrentChannelMessages = useCallback(async () => {
    if (!selectedChannel || !worldId) {
      return;
    }

    setChatError(null);
    try {
      if (selectedChannel.scope === "GLOBAL") {
        const resp = await http.get("/chat/global/recent", { params: { limit: 100 } });
        const list = (resp.data?.data ?? []) as ChatMessage[];
        setChatMessages(list.filter((item) => (item.channelKey ?? "LOBBY") === selectedChannel.key));
      } else {
        const resp = await http.get(`/chat/worlds/${worldId}/recent`, { params: { limit: 100, channelKey: selectedChannel.key } });
        setChatMessages((resp.data?.data ?? []) as ChatMessage[]);
      }

      setUnreadChannelMap((prev) => ({ ...prev, [selectedChannel.id]: 0 }));
    } catch (err: any) {
      setChatError(err.response?.data?.error?.message || "加载频道消息失败");
    }
  }, [selectedChannel, worldId]);

  useEffect(() => {
    void loadSocialData();
  }, [loadSocialData]);

  useEffect(() => {
    void loadWorldChannels();
  }, [loadWorldChannels]);

  useEffect(() => {
    void loadCurrentChannelMessages();
  }, [loadCurrentChannelMessages]);

  useEffect(() => {
    setNicknameInput(user?.displayName || user?.username || "");
  }, [user?.id, user?.displayName, user?.username]);

  useEffect(() => {
    if (!isSocialOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (socialDropdownRef.current?.contains(target)) {
        return;
      }
      if (socialTriggerRef.current?.contains(target)) {
        return;
      }
      setIsSocialOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSocialOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [isSocialOpen]);

  useEffect(() => {
    if (!showChannelModal) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (channelDropdownRef.current?.contains(target)) {
        return;
      }
      if (channelTriggerRef.current?.contains(target)) {
        return;
      }
      setShowChannelModal(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [showChannelModal]);

  useEffect(() => {
    if (!token || !worldId) {
      return;
    }

    connectSocket(token);
    setSocketStatus("connecting");

    const onAck = () => {
      setSocketStatus("connected");
      socket.emit(SOCKET_EVENTS.worldJoin, { worldId });
    };

    const onConnect = () => {
      setSocketStatus("connected");
      socket.emit(SOCKET_EVENTS.worldJoin, { worldId });
    };

    const onDisconnect = () => {
      setSocketStatus("disconnected");
    };

    const onReconnectAttempt = () => {
      setSocketStatus("reconnecting");
    };

    const onGlobalMessageNew = (message: ChatMessage) => {
      const channel = (message.channelKey ?? "LOBBY").toUpperCase();
      const channelId = `GLOBAL:${channel}`;
      if (selectedChannelId !== channelId) {
        setUnreadChannelMap((prev) => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }));
        return;
      }
      setChatMessages((prev) => [...prev, message].slice(-100));
    };

    const onWorldMessageNew = (message: ChatMessage) => {
      if (message.worldId !== worldId) {
        return;
      }

      const channel = (message.channelKey ?? "CHAT").toUpperCase();
      const channelId = `WORLD:${channel}`;
      if (selectedChannelId !== channelId) {
        setUnreadChannelMap((prev) => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }));
        return;
      }
      setChatMessages((prev) => [...prev, message].slice(-100));
    };

    socket.on(SOCKET_EVENTS.connectionAck, onAck);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("reconnect_attempt", onReconnectAttempt);
    socket.on(SOCKET_EVENTS.globalMessageNew, onGlobalMessageNew);
    socket.on(SOCKET_EVENTS.worldMessageNew, onWorldMessageNew);

    return () => {
      socket.emit(SOCKET_EVENTS.worldLeave, { worldId });
      socket.off(SOCKET_EVENTS.connectionAck, onAck);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("reconnect_attempt", onReconnectAttempt);
      socket.off(SOCKET_EVENTS.globalMessageNew, onGlobalMessageNew);
      socket.off(SOCKET_EVENTS.worldMessageNew, onWorldMessageNew);
      disconnectSocket();
    };
  }, [token, worldId, selectedChannelId]);

  const onLogout = () => {
    disconnectSocket();
    clearAuth();
    navigate("/login");
  };

  const onSaveNickname = async () => {
    const nextName = nicknameInput.trim();
    if (!nextName) {
      setSocialError("昵称不能为空");
      return;
    }

    setSavingNickname(true);
    setSocialError(null);
    try {
      const resp = await http.patch("/auth/profile", { displayName: nextName });
      const profile = resp.data?.data;
      updateUser({
        displayName: profile?.displayName || nextName,
        username: profile?.username || user?.username || ""
      });
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
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "处理好友申请失败");
    } finally {
      setFriendActionId(null);
    }
  };

  const onCreateWorldChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!worldId || !newChannelName.trim()) {
      return;
    }

    setCreatingChannel(true);
    setChatError(null);
    try {
      await http.post(`/worlds/${worldId}/chat-channels`, { name: newChannelName.trim() });
      setShowCreateChannelModal(false);
      setNewChannelName("");
      await loadWorldChannels();
    } catch (err: any) {
      setChatError(err.response?.data?.error?.message || "创建频道失败");
    } finally {
      setCreatingChannel(false);
    }
  };

  const onInviteToCurrentChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!worldId || !currentWorldChannel || !inviteUserId) {
      return;
    }

    setInvitingUser(true);
    setChatError(null);
    try {
      await http.post(`/worlds/${worldId}/chat-channels/${currentWorldChannel.key}/invite`, { userId: inviteUserId });
      setShowInviteModal(false);
      setInviteUserId("");
      await loadWorldChannels();
    } catch (err: any) {
      setChatError(err.response?.data?.error?.message || "邀请玩家失败");
    } finally {
      setInvitingUser(false);
    }
  };

  const onSendChat = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedChannel || !chatInput.trim()) {
      return;
    }

    setChatSending(true);
    setChatError(null);
    const content = chatInput;
    setChatInput("");

    if (selectedChannel.scope === "GLOBAL") {
      socket.emit(SOCKET_EVENTS.globalMessageSend, { content, channelKey: selectedChannel.key }, (result?: { ok?: boolean; error?: string }) => {
        if (!result?.ok) {
          setChatError(result?.error || "发送消息失败");
          setChatInput(content);
        }
        setChatSending(false);
      });
      return;
    }

    socket.emit(SOCKET_EVENTS.worldMessageSend, { worldId, content, channelKey: selectedChannel.key }, (result?: { ok?: boolean; error?: string }) => {
      if (!result?.ok) {
        setChatError(result?.error || "发送消息失败");
        setChatInput(content);
      }
      setChatSending(false);
    });
  };

  return (
    <section className="world-refactor-page">
      <button
        type="button"
        className="world-refactor-top-back"
        onClick={() => {
          navigate("/lobby");
        }}
      >
        返回大厅
      </button>

      <button
        className="lobby-user-fab"
        type="button"
        ref={socialTriggerRef}
        title="社交中心"
        onClick={() => {
          setIsSocialOpen((prev) => !prev);
          setSocialTab("friends");
          setSocialError(null);
        }}
        aria-label="打开社交中心"
      >
        {userButtonLabel}
      </button>

      <section className="world-refactor-scene-banner" aria-label="场景切换横幅占位">
        <strong>场景切换横幅占位</strong>
        <span>世界 ID：{worldId || "未选择"}，后续在这里接入场景列表、切换、排序等能力</span>
      </section>

      <div className="world-refactor-layout">
        <aside className="world-refactor-col world-refactor-col--left">
          <section className="lobby-chat-sidebar world-chat-sidebar">
            <div className="lobby-chat-sidebar__header">
              <div className="lobby-chat-sidebar__header-main world-chat-sidebar__header-main">
                <h2>{selectedChannelName}</h2>
                <button
                  className="lobby-chat-sidebar__channel-btn"
                  type="button"
                  ref={channelTriggerRef}
                  onClick={() => setShowChannelModal((prev) => !prev)}
                >
                  频道列表
                </button>

                {canManageChannels && selectedChannel?.scope === "WORLD" ? (
                  <>
                    <button className="lobby-chat-sidebar__channel-btn" type="button" onClick={() => setShowCreateChannelModal(true)}>建立频道</button>
                    <button className="lobby-chat-sidebar__channel-btn" type="button" onClick={() => setShowInviteModal(true)}>邀请玩家</button>
                  </>
                ) : null}

                {showChannelModal ? (
                  <div className="lobby-channel-select world-channel-select" ref={channelDropdownRef}>
                    <p className="world-channel-select__group">全局频道</p>
                    {channelOptions.global.map((channel) => {
                      const active = channel.id === selectedChannelId;
                      const unread = unreadChannelMap[channel.id] ?? 0;
                      return (
                        <button
                          key={channel.id}
                          className={`lobby-channel-select__item ${active ? "is-active" : ""}`}
                          type="button"
                          onClick={() => {
                            setSelectedChannelId(channel.id);
                            setShowChannelModal(false);
                          }}
                        >
                          <span>{channel.label}</span>
                          <span className="lobby-channel-select__meta">{unread > 0 ? <strong>{unread}</strong> : null}</span>
                        </button>
                      );
                    })}

                    <p className="world-channel-select__group">世界频道</p>
                    {channelOptions.world.length === 0 ? <p className="text-sm text-gray-500">暂无可用世界频道</p> : null}
                    {channelOptions.world.map((channel) => {
                      const active = channel.id === selectedChannelId;
                      const unread = unreadChannelMap[channel.id] ?? 0;
                      return (
                        <button
                          key={channel.id}
                          className={`lobby-channel-select__item ${active ? "is-active" : ""}`}
                          type="button"
                          onClick={() => {
                            setSelectedChannelId(channel.id);
                            setShowChannelModal(false);
                          }}
                        >
                          <span>{channel.label}</span>
                          <span className="lobby-channel-select__meta">{unread > 0 ? <strong>{unread}</strong> : null}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <span
                className={`lobby-chat__status ${
                  socketStatus === "connected" ? "is-connected" : socketStatus === "reconnecting" ? "is-reconnecting" : "is-disconnected"
                }`}
                title={socketStatus === "connected" ? "实时连接中" : "连接异常"}
              >
                •
              </span>
            </div>

            {socketStatus !== "connected" ? (
              <div className="lobby-chat-sidebar__alert">
                <span>{socketStatus === "reconnecting" ? "实时连接异常，正在自动重连" : "实时连接已断开"}</span>
                <button type="button" onClick={reconnectSocket}>重连</button>
              </div>
            ) : null}

            {chatError ? <div className="lobby-main-content__error world-chat-sidebar__error">{chatError}</div> : null}

            <div className="lobby-chat-sidebar__messages">
              {chatMessages.length === 0 ? <p className="lobby-chat-sidebar__empty">当前频道暂无消息</p> : null}
              {chatMessages.map((message, index) => {
                const now = new Date();
                const currentDate = new Date(message.createdAt);
                const prevDate = index > 0 ? new Date(chatMessages[index - 1].createdAt) : null;
                const showDayDivider = prevDate ? !isSameDate(currentDate, prevDate) : !isSameDate(currentDate, now);

                return (
                  <Fragment key={message.id}>
                    {showDayDivider ? <p className="lobby-chat-sidebar__day-divider">{formatCrossDayDivider(currentDate, now)}</p> : null}
                    <div className="lobby-chat-sidebar__message">
                      <p className="lobby-chat-sidebar__message-meta">
                        <span className="lobby-badge">{message.channelKey || "LOBBY"}</span>
                        <span>{displayNameOf(message.fromUser)}</span>
                        <span>{formatTimeOnly(currentDate)}</span>
                      </p>
                      <p className="lobby-chat-sidebar__message-content">{message.content}</p>
                    </div>
                  </Fragment>
                );
              })}
            </div>

            <form className="lobby-chat-sidebar__form" onSubmit={onSendChat}>
              <textarea
                className="lobby-chat-sidebar__input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={canSendCurrentChannel ? "输入频道消息" : "当前频道暂不支持发送"}
                maxLength={1000}
                disabled={!canSendCurrentChannel || socketStatus !== "connected"}
                rows={3}
              />
              <button className="lobby-chat-sidebar__send" type="submit" disabled={chatSending || !canSendCurrentChannel || socketStatus !== "connected"}>
                {chatSending ? "发送中..." : "发送"}
              </button>
            </form>
          </section>
        </aside>

        <main className="world-refactor-col world-refactor-col--center">
          <div className="world-refactor-placeholder">
            <h3>中央容器</h3>
            <p>宽度占比 60%</p>
            <p>当前仅占位，不放业务内容</p>
          </div>
        </main>

        <aside className="world-refactor-col world-refactor-col--right">
          <div className="world-refactor-placeholder">
            <h3>右侧容器</h3>
            <p>宽度占比 19%</p>
            <p>当前仅占位，不放业务内容</p>
          </div>
        </aside>
      </div>

      {showCreateChannelModal ? (
        <div className="lobby-social-modal-bg" onClick={() => setShowCreateChannelModal(false)}>
          <div className="lobby-social-modal-inner" onClick={(e) => e.stopPropagation()}>
            <h3>创建新频道</h3>
            <form className="space-y-3" onSubmit={onCreateWorldChannel}>
              <input
                className="w-full rounded border px-3 py-2"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="请输入频道名字"
                maxLength={40}
              />
              <div className="lobby-social-modal__actions">
                <button type="button" onClick={() => setShowCreateChannelModal(false)}>取消</button>
                <button type="submit" disabled={creatingChannel}>{creatingChannel ? "创建中..." : "创建"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showInviteModal ? (
        <div className="lobby-social-modal-bg" onClick={() => setShowInviteModal(false)}>
          <div className="lobby-social-modal-inner" onClick={(e) => e.stopPropagation()}>
            <h3>邀请玩家到当前频道</h3>
            {currentWorldChannel?.access === "ALL" ? (
              <p className="text-sm text-gray-500">当前频道为公开频道，无需单独邀请。</p>
            ) : (
              <form className="space-y-3" onSubmit={onInviteToCurrentChannel}>
                <select className="w-full rounded border px-3 py-2" value={inviteUserId} onChange={(e) => setInviteUserId(e.target.value)}>
                  <option value="">请选择玩家</option>
                  {inviteCandidates.map((member) => (
                    <option key={member.userId} value={member.userId}>{displayNameOf(member)}（{member.worldRole}）</option>
                  ))}
                </select>
                <div className="lobby-social-modal__actions">
                  <button type="button" onClick={() => setShowInviteModal(false)}>取消</button>
                  <button type="submit" disabled={!inviteUserId || invitingUser}>{invitingUser ? "邀请中..." : "发送邀请"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {isSocialOpen ? (
        <section className="lobby-social-modal lobby-social-modal--dropdown" ref={socialDropdownRef}>
          <div className="lobby-social__header">
            <p className="lobby-social__title">社交中心</p>
            <div className="lobby-social__nickname-row">
              <input value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} placeholder="显示昵称" maxLength={40} />
              <button type="button" onClick={() => void onSaveNickname()} disabled={savingNickname}>{savingNickname ? "保存中..." : "保存"}</button>
            </div>
          </div>

          <div className="lobby-social__tabs">
            <button type="button" className={socialTab === "friends" ? "is-active" : ""} onClick={() => setSocialTab("friends")}>好友</button>
            <button type="button" className={socialTab === "requests" ? "is-active" : ""} onClick={() => setSocialTab("requests")}>好友申请</button>
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
                      <span>{displayNameOf(item.user)}</span>
                      <span className="lobby-social__friend-status is-online">在线</span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="lobby-social__section-title">离线好友</p>
                  {offlineFriends.length === 0 ? <p className="text-sm text-gray-500">暂无离线好友</p> : null}
                  {offlineFriends.map((item) => (
                    <div className="lobby-social__friend-item" key={`offline-${item.id}`}>
                      <span>{displayNameOf(item.user)}</span>
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
                      <p className="lobby-social__request-name">{displayNameOf(item.fromUser)}</p>
                      <p className="text-xs text-gray-500">账号：{item.fromUser.username}</p>
                    </div>
                    <div className="lobby-social__request-actions">
                      <button type="button" className="lobby-social__accept" onClick={() => { void onHandleFriendRequest(item.id, "accept"); }} disabled={friendActionId === item.id}>✓</button>
                      <button type="button" className="lobby-social__reject" onClick={() => { void onHandleFriendRequest(item.id, "reject"); }} disabled={friendActionId === item.id}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {socialError ? <div className="lobby-social__error">{socialError}</div> : null}

          <div className="lobby-social__footer">
            <button type="button" onClick={() => { setShowAddFriendModal(true); setSocialError(null); }}>添加好友</button>
            <button type="button" className="lobby-social__logout" onClick={onLogout}>退出登录</button>
          </div>
        </section>
      ) : null}

      {showAddFriendModal ? (
        <div className="lobby-social-modal-bg" onClick={() => setShowAddFriendModal(false)}>
          <div className="lobby-social-modal-inner" onClick={(e) => e.stopPropagation()}>
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
                <button type="button" onClick={() => { setShowAddFriendModal(false); setFriendQuery(""); }}>取消</button>
                <button type="submit" disabled={sendingFriendRequest}>{sendingFriendRequest ? "发送中..." : "发送申请"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
