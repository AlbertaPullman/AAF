import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { http } from "../../lib/http";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("密码不一致");
      return;
    }

    setIsLoading(true);

    try {
      const response = await http.post("/auth/register", { username, password });
      if (response.data.success) {
        const { token, userId, username: returnedUsername } = response.data.data;
        setAuth(token, {
          id: userId,
          username: returnedUsername,
          displayName: returnedUsername,
          avatarUrl: null,
          platformRole: "PLAYER",
          createdAt: new Date().toISOString()
        });
        navigate("/lobby");
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">注册</h1>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={isLoading}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={isLoading}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={isLoading}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? "注册中..." : "注册"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          已有账号？<a href="/login" className="text-blue-600 hover:underline">登录</a>
        </p>
      </div>
    </section>
  );
}