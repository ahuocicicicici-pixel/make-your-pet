# 参考图索引（Reference Images）

这些是**同一只狗**的官方造型参考，全部出自原始卡通设定，风格统一。
生成任何素材时都要把对应参考图作为 **reference image / image-to-image 输入**传进去，
不要凭空生成。配合 [../ART-PRD.md](../ART-PRD.md) §2 角色设定圣经一起用。

> ⚠️ 这些参考图只有 192×208，**仅用于锁定"长相/配色/画风"**，不是最终素材。
> 最终素材按 ART-PRD §3 出 512×512 透明 PNG。

| 文件 | 姿态 | 作为这些动作的首选参考 |
|---|---|---|
| **`ref-00-master-sit.png`** ⭐ | 端坐正面、安静 | **主基准图**。所有"站/坐"类：`idle` `blink` `look-around` `greet` `hungry` `sick`(坐版) `think` `beg` `study` `sad` `dizzy` `scared` `peek` `sneeze` `surprised` |
| `ref-01-wave.png` | 坐着抬爪招手 | `greet` `shake-paw` `wink` `love` `celebrate` `coin-get` `work-guard`(敬礼) |
| `ref-02-play-sprawl.png` | 趴卧前扑、吐舌玩耍 | `happy` `excited` `play-ball` `play-frisbee` `belly-rub` `dance` `jump-rope` `run` |
| `ref-03-curl-hide.png` | 蜷缩低头藏脸 | `sleep` `sad` `cry` `shy` `sick`(趴版) `scared` `goodbye` |
| `ref-04-paw-to-mouth.png` | 坐着爪子到嘴边 | `lick` `eat` `eat-full` `drink` `yawn` `wait` |
| `ref-05-lying-focus.png` | 趴卧专注 | `work-construction` `work-cook` `work-art` `study` `drag` `bath`(坐姿底) |

> 想做成**你自己宠物**的样子？把你家宠物的真实照片放进本目录当图生图参考（用于毛色/花纹比对，画风仍以卡通图为准）。个人照片不要提交进公开仓。

## 用法（推荐顺序）

1. **先定基准**：用 `ref-00-master-sit.png` 刷出一张满意的 512×512 `idle` 第 1 帧 → 这张升级为新的"主基准图"。
2. **同组连贯**：生成某动作多帧时，用**该动作第 1 帧**做参考，保证组内一致。
3. 表里给的是"首选参考"，可叠加 `ref-00` 一起喂，强化"是同一只狗"。
