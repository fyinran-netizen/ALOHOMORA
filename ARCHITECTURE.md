# ALOHOMORA 架构说明

## 整体结构

项目是原生 HTML、CSS、ES Modules 和 WebGL 的轻量互动网页，没有运行时框架或构建系统。

```text
index.html
  └─ js/main.js                 稳定入口
      └─ js/app/main.js         应用生命周期、DOM 编排、现有动画流程
          ├─ core/audio.js      可复用的音效加载、播放、停止
          ├─ navigation/        场景注册与双向连接
          ├─ scenes/             各场景配置与专属热点
          └─ environment/        共享环境状态边界
```

## 主要目录

- `app/`：应用入口后的生命周期编排。`app/main.js` 负责加载资源、初始化 WebGL、响应用户操作和窗口尺寸变化。
- `core/`：确实跨场景共享的运行时能力。目前是 `audio.js`；大门 WebGL 渲染仍集中在应用中，因为它是当前唯一的专属镜头动画实现。
- `navigation/`：`sceneRegistry.js` 保存场景注册；`sceneGraph.js` 保存双向连接。连接两端可以由各自场景使用不同热点表现。
- `scenes/`：场景自己的 ID、资源、热点标签和环境配置。不要在这里实现全局转场或音效底层逻辑。
- `environment/`：共享的时间、天气、光照状态边界。当前只保存已有需求所需的最小状态，没有伪造未实现的天气渲染系统。
- `assets/scenes/`：按场景分类的运行时素材；`assets/source/`：原始母版素材。
- `assets/audio/`：音效；`css/`：全局布局和可访问性样式。
- `tools/asset_pipeline/`：未来离线图片检查、遮罩生成、对齐验证工具的位置，不参与网页运行时。

## 场景导航如何协作

场景配置描述“自己有什么热点”，场景图描述“哪些场景可以互通”，应用编排负责实际转场。当前大门与礼堂通过 `gate-to-great-hall` 连接，两个方向共用连接关系但使用不同的点击区域和动画表现。新增场景不需要修改旧场景的内部实现。

## 添加新场景

1. 在 `js/scenes/` 新建一个场景配置文件，声明 ID、素材、热点和环境类型。
2. 把场景加入 `js/navigation/sceneRegistry.js`。
3. 在 `js/navigation/sceneGraph.js` 增加连接；默认会生成反向连接。
4. 在 `assets/scenes/<scene_name>/` 放入 snake_case 素材，并在 HTML 或场景渲染适配层引用。
5. 只有该场景需要的交互才放进场景文件或对应适配代码；公共能力放到 `core/`。
6. 运行检查并在横屏、竖屏和减少动效设置下人工检查。

## 添加公共环境效果

先确认效果至少被两个场景使用。共享的状态或算法放在 `environment/`，场景专属的遮罩、积雪素材或参数仍留在场景配置中。不要给室内场景直接套用室外滤镜，也不要在没有实际实现时创建空天气模块。

## 修改功能时去哪里找

- 入口和场景切换流程：`js/app/main.js`
- 场景连接和注册：`js/navigation/`
- 单个场景的资源/热点/环境声明：`js/scenes/`
- 音效加载和播放：`js/core/audio.js`
- 全局环境状态：`js/environment/environmentState.js`
- 布局、热点可视区域和无障碍样式：`css/style.css` 与 `index.html`
- 场景图片：`assets/scenes/<scene_name>/`
