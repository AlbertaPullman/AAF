import { WorldCanvas } from "../../world/components/WorldCanvas";
import { MeasurePanel } from "../../world/components/MeasurePanel";
import { DrawPanel } from "../../world/components/DrawPanel";
import { TokenPanel } from "../../world/components/TokenPanel";

export default function WorldPage() {
  return (
    <section>
      <h1>世界</h1>
      <p>阶段 1 占位页面：世界内能力按独立组件模块化组织。</p>
      <div className="world-grid">
        <WorldCanvas />
        <MeasurePanel />
        <DrawPanel />
        <TokenPanel />
      </div>
    </section>
  );
}