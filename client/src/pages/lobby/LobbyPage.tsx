import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../../lib/http";
import { useAuthStore } from "../../store/authStore";

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

export default function LobbyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
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
    clearAuth();
    navigate("/login");
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
    </section>
  );
}