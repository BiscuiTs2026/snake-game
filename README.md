# 贪吃蛇

一款可以在电脑和手机浏览器里直接打开的经典贪吃蛇小游戏，也可以安装 Android 安装包（APK）。撞到墙壁或自己的身体就会结束，没有穿墙。

## 玩法

控制小蛇吃掉红色果实。每吃一个，分数加 1，速度也会逐渐加快。撞到四周的墙壁，或咬到自己，游戏结束。最高分会保存在本地，下次打开仍然有效。

## 操作

- 电脑：方向键或 `W` `A` `S` `D` 移动，空格键开始 / 暂停 / 继续
- 手机：屏幕下方的方向键，或在棋盘上滑动
- 也可以点击「开始」「暂停」「重新开始」按钮

## 如何本地打开

这是一个纯静态页面，不需要安装依赖，也不需要打包。用浏览器直接打开 `www/index.html` 即可。

## Android 安装包

可以用 Android Studio 或本仓库中的 Gradle 工程打包调试版 APK。在已安装 JDK 21 和 Android SDK 的环境中，于项目根目录执行：

```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
```

生成的 APK 在 `android/app/build/outputs/apk/debug/`。首次在手机上安装时，需要允许「未知来源」或「安装未知应用」。
