# 雾庭手记 · uni-app 三端基础版

这是从 `habit-miniapp` 迁移出来的 uni-app Vue 3 + TypeScript 基础版本，目标平台：

- 微信小程序
- Android App
- iOS App
- H5 预览

当前首版已经包含：

- 今天页：多做一点 / 少做一点目标卡片
- “先缓一下”“还是做了”“我做到了”记录入口
- 写下此刻想法并保存
- 回顾页：全部、今年、近 30 天筛选
- 按月份展开 / 收起时间轴
- 本地数据导出到剪贴板
- 跨端统一的目标和记录模型
- “雾明”测试应用图标：`src/static/wuming-icon.png`

## 开发

```powershell
cd 'D:\有趣的j项目\habit-uniapp'
npm install
npm run type-check
```

## 启动与构建

```powershell
# H5 浏览器预览
npm run dev:h5

# 微信小程序
npm run dev:weixin
npm run build:weixin

# Android / iOS 源码包
npm run build:android
npm run build:ios
```

构建结果位于 `dist/build/`：

- `dist/build/mp-weixin`：导入微信开发者工具
- `dist/build/app`：导入 HBuilderX 或后续 App 打包流程
- `dist/build/h5`：部署或本地预览

## 数据层

数据访问已经集中在 `src/domain/storage.ts`：

- 微信小程序、H5：使用 `uni.getStorageSync` / `uni.setStorageSync`
- Android、iOS App：启动时打开 SQLite，使用 `goals` 和 `habit_events` 表
- App 端 SQLite 不可用时，会回退到 uni-app 本地存储，不会让页面直接崩溃

页面和回顾逻辑不区分平台，后续只需要继续扩展这一层。

建议的 SQLite 表结构：

- `goals`
- `habit_events`
- `app_settings`

当前 App 端通过 uni-app App-Plus 的 SQLite 接口接入；如果后续要改成 Room 或 GRDB，也只需要替换这一层。

## 目录

```text
src/
├─ domain/
│  ├─ types.ts
│  └─ storage.ts
├─ pages/
│  └─ index.vue
├─ App.vue
└─ pages.json
```

这是一版跨端产品基础，不是最终上架版。正式发布前还需要补充 AppID、隐私说明、真机测试、通知/音频权限和 SQLite 迁移策略。
