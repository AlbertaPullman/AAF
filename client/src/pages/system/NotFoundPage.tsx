import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section>
      <h1>404</h1>
      <p>页面不存在。</p>
      <Link to="/lobby">返回大厅</Link>
    </section>
  );
}