import { useCallback, useEffect, useMemo, useState } from "react";
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

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export default function LobbyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const clearAuth = useAuthStore((state) => state.clearAuth);

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

  const displayName = useMemo(() => user?.displayName || user?.username || "未知用户", [user]);

  const loadWorlds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [publicResp, mineResp] = await Promise.all([
        http.get("/worlds"),
        http.get("/worlds", { params: { scope: "mine" } })
      ]);

      setPublicWorlds(publicResp.data.data ?? []);
      setMyWorlds(mineResp.data.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加载世界列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorlds();
  }, [loadWorlds]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setSocketStatus("connecting");

    void (async () => {
      try {
        const resp = await http.get("/chat/global/recent", { params: { limit: 30 } });
        setChatMessages(resp.data.data ?? []);
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
    };

    const onReconnectAttempt = () => {
      setSocketStatus("reconnecting");
    };

    const onReconnectFailed = () => {
      setSocketStatus("disconnected");
    };

    const onNewMessage = (message: ChatMessage) => {
      setChatMessages((prev) => {
        const next = [...prev, message];
        if (next.length > 100) {
          return next.slice(next.length - 100);
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
  }, [token]);

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
    if (!chatInput.trim()) {
      return;
    }

    setChatSending(true);
    const content = chatInput;
    setChatInput("");

    socket.emit(
      SOCKET_EVENTS.globalMessageSend,
      { content },
      (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setError(result.error || "发送消息失败");
          setChatInput(content);
        }
        setChatSending(false);
      }
    );
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">大厅</h1>
          <p className="text-gray-600">欢迎回来，{displayName}</p>
        </div>
        <button className="rounded bg-gray-800 px-4 py-2 text-white" onClick={onLogout} type="button">
          退出登录
        </button>
      </header>

      {error ? <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded border p-4">
          <h2 className="mb-3 text-lg font-semibold">创建世界</h2>
          <form className="space-y-3" onSubmit={onCreate}>
            <input
              className="w-full rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="世界名称"
              required
            />
            <textarea
              className="w-full rounded border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="世界描述（可选）"
              rows={3}
            />
            <select
              className="w-full rounded border px-3 py-2"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PASSWORD")}
            >
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

        <article className="rounded border p-4">
          <h2 className="mb-3 text-lg font-semibold">我加入的世界</h2>
          <ul className="space-y-3">
            {myWorlds.length === 0 ? <li className="text-gray-500">还没有加入任何世界</li> : null}
            {myWorlds.map((world) => (
              <li className="rounded border p-3" key={world.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{world.name}</p>
                    <p className="text-sm text-gray-600">成员 {world._count.members} / 场景 {world._count.scenes}</p>
                  </div>
                  <button className="rounded bg-green-600 px-3 py-1.5 text-sm text-white" onClick={() => navigate(`/world/${world.id}`)} type="button">
                    进入
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded border p-4">
        <h2 className="mb-3 text-lg font-semibold">公开世界列表</h2>
        {loading ? <p className="text-gray-500">加载中...</p> : null}
        <ul className="space-y-3">
          {!loading && publicWorlds.length === 0 ? <li className="text-gray-500">当前没有可见世界</li> : null}
          {publicWorlds.map((world) => {
            const joined = myWorlds.some((item) => item.id === world.id);
            return (
              <li className="rounded border p-3" key={world.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{world.name}</p>
                    <p className="text-sm text-gray-600">{world.description || "暂无描述"}</p>
                    <p className="text-xs text-gray-500">
                      {world.visibility} · 成员 {world._count.members} · 创建者 {world.owner.displayName || world.owner.username}
                    </p>
                  </div>
                  <button
                    className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:bg-gray-300"
                    disabled={joined}
                    onClick={() => onJoin(world)}
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

      <article className="rounded border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">全局聊天</h2>
          <span className={`text-xs ${socketStatus === "connected" ? "text-green-600" : socketStatus === "reconnecting" ? "text-amber-600" : "text-gray-500"}`}>
            {socketStatus === "connected" ? "实时连接中" : socketStatus === "reconnecting" ? "重连中..." : socketStatus === "connecting" ? "连接中..." : "已断开"}
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

        <div className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded border bg-gray-50 p-3">
          {chatMessages.length === 0 ? <p className="text-sm text-gray-500">暂无消息</p> : null}
          {chatMessages.map((message) => (
            <div className="rounded bg-white p-2 text-sm" key={message.id}>
              <p className="text-xs text-gray-500">
                {message.fromUser.displayName || message.fromUser.username} · {new Date(message.createdAt).toLocaleTimeString()}
              </p>
              <p className="text-gray-800">{message.content}</p>
            </div>
          ))}
        </div>

        <form className="flex gap-2" onSubmit={onSendChat}>
          <input
            className="flex-1 rounded border px-3 py-2"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="输入全局聊天消息"
            maxLength={1000}
          />
          <button
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
            type="submit"
            disabled={chatSending || socketStatus !== "connected"}
          >
            {chatSending ? "发送中..." : "发送"}
          </button>
        </form>
      </article>
    </section>
  );
}