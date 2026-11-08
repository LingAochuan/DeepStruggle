# DeepStruggle · Bilingual UI / 中英双语界面

[中文](#中文) · [English](#english)

## 中文

这是 [mihaild/DeepStruggle](https://github.com/mihaild/DeepStruggle) 的个人维护分支，基于原项目的《冷战热斗》（Twilight Struggle）游戏引擎与 AI，增加了简体中文支持，并重新设计了前端界面。

欢迎访问 [ts.soyoling.top](https://ts.soyoling.top) 在线体验。首次加载可能需要等待约 1 分钟。

前端的主要改动：

- 支持中英文切换，界面文字、游戏术语、地图和卡牌图片随语言切换；进入游戏时即可选择语言。
- 使用全屏桌游版图，支持鼠标拖动和滚轮缩放；国家影响力及各项游戏轨道的标记直接显示在版图上。
- 参考 Foundry Virtual Tabletop 的布局，将行动记录、模型分析、模型配置和设置收拢到半透明浮动面板中，面板可按需展开或收起。
- 用紧凑的文字列表浏览手牌、弃牌堆和移出游戏的卡牌，悬停即可查看牌面；行动记录、当前行动和相关效果标志也支持牌面预览。
- 重排行动记录，突出每次出牌及其结算结果，方便回看棋局。

本分支仍在开发中，改动位于 `personal` 分支。开发过程中大量使用 AI 辅助，代码尚未经完整的人工审查，功能与界面也可能继续调整。

感谢原作者 Mikhail Dektyarev 及上游贡献者。原项目的引擎、AI 与开发文档请参阅[上游仓库](https://github.com/mihaild/DeepStruggle)。

## English

This is a personal fork of [mihaild/DeepStruggle](https://github.com/mihaild/DeepStruggle), built on the original Twilight Struggle engine and AI. It adds Simplified Chinese support and a redesigned frontend.

Try it at [ts.soyoling.top](https://ts.soyoling.top). The first load may take about one minute.

The main frontend changes are:

- English and Simplified Chinese interfaces, with matching game terminology, maps, and card images. You can choose a language when entering the game.
- A fullscreen board with drag-to-pan and mouse-wheel zoom. Influence markers and game-track counters appear directly on the board.
- A layout inspired by Foundry Virtual Tabletop, with translucent, collapsible panels for the action log, model analysis, model configuration, and settings.
- Compact text lists for your hand, the discard pile, and cards removed from the game, with card images on hover. Card references in the action log, current action, and relevant effect icons also show image previews.
- A redesigned action log that emphasizes each card played and the resulting changes, making the game easier to review.

This fork is still in development on the `personal` branch. It was developed with extensive AI assistance, and the code has not undergone a complete human review. Features and presentation may continue to change.

Thanks to Mikhail Dektyarev and the upstream contributors. See the [upstream repository](https://github.com/mihaild/DeepStruggle) for the original engine, AI, and development documentation.

## 美术资源与致谢 / Artwork credits

本分支使用的美术资源主要来自以下 Tabletop Simulator 模组及 Steam 版《冷战热斗》。感谢模组作者的整理与制作，也感谢原游戏的美术创作者。

Artwork used in this fork comes mainly from the following Tabletop Simulator mods and the Steam edition of Twilight Struggle. Thanks to the mod creators for their work and to the original game's artists.

- [冷战热斗中文版 — Hanon](https://steamcommunity.com/sharedfiles/filedetails/?id=2793711137)，以及其注明的 [Twilight Struggle — Payne](https://steamcommunity.com/sharedfiles/filedetails/?id=2062069267) 原模组 / and the original Payne mod credited by Hanon.
- [Twilight Struggle Scripted (EN)](https://steamcommunity.com/sharedfiles/filedetails/?id=3311714280).
- Steam 版《冷战热斗》中的游戏美术资源 / Artwork from the Steam edition of Twilight Struggle.

代码沿用 [MIT 许可证](LICENSE)，并保留原作者的版权声明。地图、卡牌图片等第三方素材不包含在代码的 MIT 授权范围内，来源记录见[素材文档](docs/board-theme.md)。

The code retains the [MIT license](LICENSE) and the original copyright notices. Third-party artwork, including maps and card images, is not covered by the code's MIT license. Source records are available in the [artwork documentation](docs/board-theme.md).

《冷战热斗》由 Ananda Gupta 和 Jason Matthews 设计，相关商标属于 GMT Games。本分支与 GMT Games 无隶属关系，也未经其授权或认可。

Twilight Struggle was designed by Ananda Gupta and Jason Matthews. Related trademarks belong to GMT Games. This fork is not affiliated with, authorized by, or endorsed by GMT Games.
