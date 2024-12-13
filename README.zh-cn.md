# 插件更新锁

[English](./README.md) | 中文

可以防止 Obsidian 中的指定插件更新，从而确保这些插件在特定版本下稳定运行，避免因更新引起的兼容性问题或功能变动。

## 使用方式



## 插件开发起因与该插件的作用

当前我希望询问ChatGPT等AI的问题和回复,能够保存整理成笔记,方便后续记录笔记、复盘.
最终选择使用插件[obsidian-smart-connections](https://github.com/brianpetro/obsidian-smart-connections).
但是将该插件的版本从`2.2.85`升级到`2.3.42`后,发现这两个版本有很大的变更.
我经常使用的"Custom API(OpenAI format)"配置给移除了,导致我使用的类似ChatGPT的API接口无法自定义配置.
所以才想到希望添加一个插件更新锁定的功能,避免出现这种突然的版本变更影响使用,等后续版本稳定后再移除锁定.

![sidebar-1](./resources/screenshots/img-AUISYD-982847289481232101.png)



