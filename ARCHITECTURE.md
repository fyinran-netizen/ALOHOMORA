# ALOHOMORA 架构

项目使用原生 HTML、CSS 和 JavaScript ES Modules，无框架、依赖安装或构建步骤。本文只说明当前目录职责和模块间的基本接口。

## 文件结构

```text
ALOHOMORA/
├── index.html                      页面结构及 Canvas、环境控制面板
├── css/
│   └── style.css                   页面布局、场景样式和响应式规则
├── js/
│   ├── main.js                     浏览器模块入口
│   ├── app/
│   │   └── main.js                 应用启动、场景挂载和整体生命周期
│   ├── scenes/                     场景配置及场景专属渲染逻辑
│   ├── navigation/                 场景注册与场景连接关系
│   ├── environment/                环境状态、计算和环境效果渲染
│   └── debug/                      环境控制面板及面板交互
├── assets/
│   ├── source/                     原始素材，按场景分类
│   │   ├── hogwarts_castle_master.png  当前入口使用的建筑母版（固定路径）
│   │   └── gate/                   大门场景的其他原始素材
│   ├── scenes/                     按场景存放的图片素材
│   └── audio/                      音频素材
├── tests/                          Node.js 内置测试
└── tools/                          本地预览服务器及离线素材工具
```

## 统一接口

- **场景**：在 `js/scenes/` 导出场景配置，包含 `id`、`assets`、`environment` 等信息。入口场景还提供 `mountFraming(frame, image)`，返回带 `dispose()` 的清理对象。场景由 `sceneRegistry.js` 注册，其他模块通过 `getScene(id)` 查询。
- **环境状态**：`createEnvironment()` 创建共享状态对象。模块通过 `subscribe(listener)` 获取当前状态和后续更新，使用 `update(patch)` 修改状态，以 `start()` / `stop()` 管理自动时钟。
- **环境效果**：天气、阳光、天空等渲染器接收对应 Canvas 和共享环境对象，提供 `start()`、`stop()`、`dispose()` 生命周期方法。环境效果不依赖具体场景。
- **调试面板**：`mountEnvironmentPanel(panel, environment, sunSchedule)` 将控件连接到环境状态，返回卸载函数。面板通过环境接口协作，不直接修改渲染器。
- **场景连接**：`sceneGraph.js` 提供 `getConnection()`、`canNavigate()` 和 `listConnections()` 查询接口；目前没有配置场景连接，页面也未启用场景跳转。

应用装配和浏览器页面生命周期集中在 `js/app/main.js`；`js/main.js` 作为稳定入口加载应用。新增逻辑优先放到所属目录，只有确实被多个场景或效果共享时才放进公共模块。

## 本地预览

需要 Node.js。在项目根目录运行 `node tools/preview.mjs`，然后打开 <http://127.0.0.1:5173/>。停止时在终端按 `Ctrl+C`。项目没有 `npm start` 或构建命令。
