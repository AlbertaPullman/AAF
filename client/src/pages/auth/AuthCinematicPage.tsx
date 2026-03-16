import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../../lib/http";
import { useAuthStore } from "../../store/authStore";
import authBackground from "../../assets/auth/loginbg.jpg";
import authLogoGif from "../../assets/auth/logoae.gif";
import authEnterImage from "../../assets/auth/login.png";

type AuthMode = "login" | "register";

type Props = {
  initialMode: AuthMode;
};

type Particle = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  size: string;
  opacity: number;
};

const BUTTON_DROP_MS = 5000;

function mapAuthErrorMessage(raw?: string): string {
  const message = (raw ?? "").trim();
  if (!message) {
    return "请求失败，请稍后重试";
  }

  const normalized = message.toLowerCase();
  if (normalized.includes("username already exists")) {
    return "用户名已存在，请更换后重试";
  }
  if (normalized.includes("username is required")) {
    return "请输入用户名";
  }
  if (normalized.includes("password must be at least 6")) {
    return "密码至少需要 6 位";
  }
  if (normalized.includes("invalid username or password")) {
    return "用户名或密码错误";
  }

  return message;
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }).map((_, index) => {
    const left = Math.random() * 100;
    const delay = -Math.random() * 10;
    const duration = 6 + Math.random() * 5;
    const size = 4 + Math.random() * 7;

    return {
      id: index,
      left: `${left.toFixed(2)}%`,
      delay: `${delay.toFixed(2)}s`,
      duration: `${duration.toFixed(2)}s`,
      size: `${size.toFixed(2)}px`,
      opacity: Number((0.55 + Math.random() * 0.4).toFixed(2))
    };
  });
}

export default function AuthCinematicPage({ initialMode }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showLogo, setShowLogo] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const [showAuthPanel, setShowAuthPanel] = useState(false);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const particles = useMemo(() => createParticles(56), []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const logoTimer = window.setTimeout(() => {
      setShowLogo(true);
    }, 900);

    const enterTimer = window.setTimeout(() => {
      setShowEnter(true);
    }, BUTTON_DROP_MS);

    const skipIntro = () => {
      setShowLogo(true);
      setShowEnter(true);
    };

    window.addEventListener("pointerdown", skipIntro, { once: true });

    return () => {
      window.clearTimeout(logoTimer);
      window.clearTimeout(enterTimer);
      window.removeEventListener("pointerdown", skipIntro);
    };
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const username = loginUsername.trim();
    if (!username) {
      setError("请输入用户名");
      return;
    }
    if (loginPassword.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }

    setIsLoading(true);

    try {
      const response = await http.post("/auth/login", {
        username,
        password: loginPassword
      });

      if (response.data.success) {
        const { token, userId, username } = response.data.data;
        setAuth(token, {
          id: userId,
          username,
          displayName: username,
          avatarUrl: null,
          platformRole: "PLAYER",
          createdAt: new Date().toISOString()
        });
        navigate("/lobby");
      }
    } catch (err: any) {
      setError(mapAuthErrorMessage(err.response?.data?.error?.message) || "登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (registerPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    const username = registerUsername.trim();
    if (!username) {
      setError("请输入用户名");
      return;
    }
    if (registerPassword.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }

    setIsLoading(true);

    try {
      const response = await http.post("/auth/register", {
        username,
        password: registerPassword
      });

      if (response.data.success) {
        const { token, userId, username } = response.data.data;
        setAuth(token, {
          id: userId,
          username,
          displayName: username,
          avatarUrl: null,
          platformRole: "PLAYER",
          createdAt: new Date().toISOString()
        });
        navigate("/lobby");
      }
    } catch (err: any) {
      setError(mapAuthErrorMessage(err.response?.data?.error?.message) || "注册失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-cinematic" style={{ backgroundImage: `url(${authBackground})` }}>
      <div className="auth-cinematic__veil" />

      <div className="auth-cinematic__particles" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="auth-cinematic__particle"
            style={{
              left: particle.left,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              opacity: particle.opacity
            }}
          />
        ))}
      </div>

      {showLogo ? (
        <div className="auth-cinematic__logo-wrap" aria-hidden="true">
          <img className="auth-cinematic__logo" src={authLogoGif} alt="AAF Logo Intro" />
        </div>
      ) : null}

      {!showAuthPanel ? (
        <button
          type="button"
          className={`auth-cinematic__enter ${showEnter ? "is-visible" : ""}`}
          onClick={() => {
            setShowAuthPanel(true);
            setShowEnter(true);
          }}
        >
          <span className="sr-only">进入登录与注册</span>
          <img src={authEnterImage} alt="登录或注册" />
          <span className="auth-cinematic__enter-label" aria-hidden="true">
            登录/注册
          </span>
        </button>
      ) : null}

      {showAuthPanel ? (
        <div className="auth-panel-backdrop">
          <section className="auth-panel" role="dialog" aria-modal="true" aria-label="登录或注册">
            <header className="auth-panel__tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setError("");
                  setMode("login");
                }}
              >
                登录
              </button>
              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setError("");
                  setMode("register");
                }}
              >
                注册
              </button>
            </header>

            {error ? <div className="auth-panel__error">{error}</div> : null}

            {mode === "login" ? (
              <form className="auth-panel__form" onSubmit={handleLogin}>
                <label>
                  用户名
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(event) => setLoginUsername(event.target.value)}
                    autoComplete="username"
                    disabled={isLoading}
                    required
                  />
                </label>

                <label>
                  密码
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    autoComplete="current-password"
                    minLength={6}
                    disabled={isLoading}
                    required
                  />
                </label>

                <button className="auth-panel__submit" type="submit" disabled={isLoading}>
                  {isLoading ? "登录中..." : "登录"}
                </button>
              </form>
            ) : (
              <form className="auth-panel__form" onSubmit={handleRegister}>
                <label>
                  用户名
                  <input
                    type="text"
                    value={registerUsername}
                    onChange={(event) => setRegisterUsername(event.target.value)}
                    autoComplete="username"
                    disabled={isLoading}
                    required
                  />
                </label>

                <label>
                  密码
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    disabled={isLoading}
                    required
                  />
                </label>

                <label>
                  确认密码
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    disabled={isLoading}
                    required
                  />
                </label>

                <button className="auth-panel__submit" type="submit" disabled={isLoading}>
                  {isLoading ? "注册中..." : "注册"}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
