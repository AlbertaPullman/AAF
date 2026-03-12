import axios from "axios";

const serverHost = process.env.VITE_SERVER_HOST ?? "localhost";
const serverPort = process.env.VITE_SERVER_PORT ?? "6666";

export const http = axios.create({
  baseURL: `http://${serverHost}:${serverPort}/api`,
  timeout: 10000
});

http.interceptors.request.use((config) => {
  const authRaw = localStorage.getItem("auth-storage");
  if (!authRaw) {
    return config;
  }

  try {
    const parsed = JSON.parse(authRaw) as { state?: { token?: string | null } };
    const token = parsed.state?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore broken local storage payload
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("auth-storage");
    }
    return Promise.reject(error);
  }
);