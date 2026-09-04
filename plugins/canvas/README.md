# Infinite Canvas 画布节点插件

给画布扩展自定义节点。每个插件是一个**独立目录**,用 **TypeScript** 编写,自带 `package.json` / `build.mjs` / `src/index.tsx` / `dist/`,互不耦合,可单独构建、发布、升级。

目标项目已经内置文本、图片、视频、音频、生成配置、全景图、导演台和组节点。插件用于补充 Markdown、SVG、HTML、便利贴等缺失能力，不重复替换更完整的内置节点。

作者只写节点 UI 与逻辑,**类型、JSX、宿主 React、构建全部由 [`@infinite-canvas/plugin-sdk`](./sdk/README.md) 提供**,写 TSX 全程有代码提示;产物仍是宿主加载器现有契约的 ESM(React external、宿主单例)。

## 目录约定

```
plugins/canvas/
  sdk/            # 插件 SDK(类型 + automatic JSX 运行时 + 构建助手)
  template/       # 起步模板:复制它开始写新插件
  markdown/       # 每个插件一个独立目录
    package.json
    build.mjs     # 一行 buildPlugin,产物名取目录名 → dist/markdown.js
    tsconfig.json
    src/index.tsx # 插件源码(默认导出 definePlugin(...))
    README.md
  svg/ html/ panorama/ sticky-note/ ...
```

## 快速开始

```bash
cp -r plugins/canvas/template plugins/canvas/my-plugin
cd plugins/canvas/my-plugin
# 改 package.json 的 name;改 src/index.tsx 里的 id / nodes[].type
npm install
npm run dev        # watch 构建,产物同步到 web/public/plugins/my-plugin.js
npm run typecheck  # tsc --noEmit,类型自检
```

产物名取**目录名**,复制后记得把目录改成插件名。

## 构建 / 发布 / 升级

```bash
cd plugins/canvas/<name>
npm install
npm run build   # → dist/<name>.js,并同步到 web/public/plugins/<name>.js
npm run dev     # watch,改动自动构建并同步
```

构建后的 `dist/<name>.js` 可通过画布插件管理器的文件选择器本地导入。官方插件由仓库发布工作流统一构建和更新。

## 官方插件注册表

本项目官方插件由 CI 集中构建后发布到 `guyu818/infinite-canvas` 的孤儿分支 `plugins-dist`(**构建产物不进 git**)。安装入口只接受该官方注册表或用户主动选择的本地 `.js/.mjs` 插件包，不提供任意远程 URL 执行入口。

## 本地开发

`npm run dev` 起 watch，产物会同步到 `web/public/plugins/<name>.js`。构建后在画布插件管理器中选择本地产物导入；重新构建后再次选择文件即可升级。

## 用 SDK 写插件

默认导出 `definePlugin({...})`(对象形式,**无需再 `const { React } = runtime`**):

```tsx
import { definePlugin, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

function Content({ ctx }: CanvasNodeContentProps) {
    const [n, setN] = useState(0);
    return (
        <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setN((v) => v + 1)} style={{ color: ctx.theme.node.text }}>
            {ctx.node.title}: {n}
        </button>
    );
}

export default definePlugin({
    id: "my-plugin",
    name: "我的插件",
    version: "1.0.0",
    css: "…",                 // 可选:插件样式,自动注入/清理
    nodes: [ /* CanvasNodeDefinition[] */ ],
    setup(app) { return () => {}; }, // 可选,返回清理函数;app 含 injectCSS/emit/on
});
```

SDK 导出的 hooks(`useState/useEffect/useMemo/useRef/...`)运行时转发宿主 React,类型来自 `@types/react`。SDK 与依赖接入见 [`sdk/README.md`](./sdk/README.md)。

### CanvasNodeDefinition

```ts
{
    type: string;                 // 建议 "<pluginId>:<name>",全局唯一
    title: string;                // 创建菜单/默认标题
    icon: ReactNode;              // emoji 字符串或任意 ReactNode
    description?: string;
    defaultSize: { width, height };
    defaultMetadata?: object;     // 新建节点初始 metadata(文本内容放 content)
    minimapColor?: string;
    showInCreateMenu?: boolean;   // 默认 true
    hasSourceHandle?: boolean;    // 右侧输出连接点,默认 true
    keepAspectRatio?: (node) => boolean;
    resource?: (node) => { kind: "text"|"image"|"video"|"audio"|"panorama"|"director", text?, url? } | null; // 作为上游输入被消费时输出什么
    Content: ({ ctx }) => ReactNode;         // 节点主体渲染
    Panel?: ({ ctx, onClose }) => ReactNode; // 可选:节点下方面板
    toolbar?: (ctx) => Array<{ id, title, label, icon, onClick, danger? }>; // 追加到 hover 工具栏
    onDoubleClick?: (ctx) => boolean;        // 返回 true 表示已处理双击
}
```

### ctx:节点与画布交互接口

`Content` / `Panel` / `toolbar` 都会拿到 `ctx`(类型 `CanvasNodeContext`):

| 能力 | 说明 |
| --- | --- |
| `ctx.node` | 当前节点数据(含 `metadata.content` 等) |
| `ctx.theme` / `ctx.scale` | 当前画布主题 token 与缩放,用来让 UI 跟随主题 |
| `ctx.updateMetadata(patch)` | 更新自身 metadata(如保存内容) |
| `ctx.updateNode(patch)` | 更新自身 title/width/height |
| `ctx.getNode(id)` / `ctx.getNodes()` / `ctx.getConnections()` | 读画布 |
| `ctx.getUpstream()` / `ctx.getDownstream()` | 取上/下游相连节点 |
| `ctx.applyOps(ops)` | 用画布指令集增删节点/连线、选择；收费生成仍需用户显式操作 |
| `ctx.ai` | 使用宿主注入的模型能力，插件只拿到调用函数，不能读取用户 API Key |
| `ctx.emit(event, payload)` / `ctx.on(event, handler)` | 节点/插件间事件通信 |
| `ctx.storage` | 插件私有持久化(按插件 id 命名空间) |

> `metadata` 的**内置字段**(content、status、model…)是强类型;插件写入的**自定义字段**读出为 `unknown`,按需 `as` 断言(参考 `sticky-note` 的 `pluginColor`)。

### 画布指令集(ctx.applyOps)

```ts
ctx.applyOps([
    { type: "add_node", id?, nodeType, title?, x?, y?, width?, height?, metadata? },
    { type: "update_node", id, patch?, metadata? },
    { type: "delete_node", id? | ids? },
    { type: "connect_nodes", fromNodeId, toNodeId },
    { type: "delete_connections", id? | ids? | all? },
    { type: "select_nodes", ids },
    { type: "set_viewport", viewport },
    // 收费生成不能通过 applyOps 自动触发；请在插件 UI 中由用户主动调用 ctx.ai。
]);
```

## 重依赖 / 资源

- **依赖**(three.js、marked 等):声明在插件自己的 `package.json` 中并构建进插件包，运行时不从第三方地址动态执行脚本。
- **CSS**:写独立 `.css`,`import css from "./styles.css"` 拿到字符串(esbuild `text` loader),放到 `css` 字段自动注入/清理;`src/env.d.ts` 声明 `*.css`。参考 `markdown/`。
- **HTML**:HTML 节点把 HTML 字符串塞进 sandbox iframe 的 `srcDoc`,自带 `<style>`,不需要插件级 CSS。参考 `html/`。

## 兼容说明

加载器仍接受**默认导出为工厂函数** `(runtime) => CanvasPlugin`(用 `runtime.React`)或**普通对象**;老的 JS 插件无需改动即可运行。SDK 的 automatic JSX 让新插件走对象形式,更简洁。

## 注意

- 插件代码会在画布页面内执行，只安装本 fork 官方插件或用户明确选择的本地包。模型能力由宿主函数注入，插件上下文不暴露 API Key。
- 交互控件记得 `onMouseDown={(e) => e.stopPropagation()}`(避免触发节点拖拽),滚动区域加 `onWheel={(e) => e.stopPropagation()}` 与容器 `data-canvas-no-zoom`(避免被画布缩放拦截)。
