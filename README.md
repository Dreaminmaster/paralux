# ✨ PARALUX

**3D Head-Tracked Parallax Web Experience**

多层 WebGL 视差场景，通过鼠标或摄像头头部追踪实现"透过屏幕看里面"的裸眼 3D 效果。

## 🎯 Features

- **5-layer depth system** — 背景、代码面板、主内容、浮动标签、光斑装饰
- **Smooth parallax** — 基于深度的差异化偏移，平滑插值无抖动
- **Mouse fallback** — 无需摄像头，鼠标/触摸即可体验
- **Camera tracking** — 可选 MediaPipe Face Landmarker 头部追踪
- **Particle system** — 200 个漂浮发光粒子

## 🚀 Live Demo

[**👉 在线体验**](https://dreaminmaster.github.io/paralux/)

## 🛠 Tech Stack

- Three.js — WebGL 3D rendering
- Canvas Texture — HTML Canvas → 3D plane texture
- MediaPipe Face Landmarker — real-time face/head tracking

## 📖 How It Works

1. 每层用 Canvas 2D 绘制内容（文字、卡片、光效）
2. Canvas 作为纹理贴到 Three.js 的 PlaneGeometry 上
3. 各层放置在不同的 Z 轴深度
4. 相机根据输入（鼠标/头部位置）做平滑偏移
5. 近处层偏移大、远处层偏移小 → 立体空间感

## 📝 License

MIT
