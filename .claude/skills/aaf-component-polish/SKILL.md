---
name: aaf-component-polish
description: Run a polish pass on a single React component to bring it up to AAF JRPG production quality. Trigger when user says "美化这个组件"/"打磨"/"polish"/"过一遍"/"做精"/"补完状态" on a specific .tsx file under client/src/. Checks states, a11y, responsiveness, animation, empty/error/loading paths. Use after aaf-jrpg-ui has set the palette context.
---

# AAF Component Polish Skill

Apply this checklist to ONE component at a time. Do not fan out.

## Pre-flight

1. Confirm the target file path with the user if ambiguous.
2. Read the file in full once.
3. Identify: 舞台 or 工具面板? (load `aaf-jrpg-ui` if unclear)
4. Identify: leaf component or container? Containers get extra checks on empty/error states.

## Polish Checklist (work top to bottom, mark ✓/✗ in your reply)

### A. Visual states (every interactive element)

- [ ] hover — 视觉变化清晰
- [ ] active / pressed
- [ ] focus-visible — 键盘 tab 可见
- [ ] disabled — 不变灰泥色，保持品牌色 + 透明度
- [ ] loading — 局部 spinner/shimmer，不替换整块
- [ ] selected (if applicable) — 用 `--jrpg-warn` 橙系强调

### B. Data states (containers only)

- [ ] empty state — 有插画或文案，不是空白
- [ ] error state — 文案 + 重试按钮
- [ ] loading state — skeleton 优先于 spinner
- [ ] partial/stale state — 如有缓存，标注"数据可能延迟"

### C. Responsive / overflow

- [ ] 长中文标签不撑破布局（测 20+ 汉字）
- [ ] 数字超长不挤压（测 9999/100%/-9999）
- [ ] 滚动条已样式化，匹配浅蓝
- [ ] 移动/窄屏断点（如适用）

### D. Accessibility

- [ ] 所有 `<button>` 用 `<button>` 而非 `<div onClick>`
- [ ] 图标按钮有 `aria-label` 或 `title`
- [ ] 键盘可达：Tab 顺序合理，Esc 关弹窗，Enter 提交
- [ ] 颜色对比 ≥ 4.5:1（主文字对卡背）
- [ ] `prefers-reduced-motion` 降级动画

### E. Animation polish

- [ ] 出现/消失有过渡（150–250ms）
- [ ] hover 不是瞬间跳变
- [ ] 列表项 stagger（如适用）
- [ ] 关键反馈（命中/扣血/获得）有飘字或抖动

### F. Code health

- [ ] 无 inline 巨型 style 对象（迁到 CSS 或 styled）
- [ ] 无 magic number 颜色（用 `--jrpg-*` token）
- [ ] 无未使用的 props/state
- [ ] memo/useMemo 用在真正昂贵的渲染上

## Output format

报告时以表格形式：

| 项 | 状态 | 修改 |
|---|---|---|
| hover 状态 | ✗ → ✓ | 加 `:hover { transform: translateY(-1px); ... }` |

不要在一次 polish 里改超过 200 行。如果组件需要更大重构，停下来告诉用户。
