# 飞书对接说明

本插件把「飞书能力」交给已安装的 `dsh-feishu` 插件，自己不保存飞书凭证、不直接调用飞书 API。这样做的好处是：

- 飞书授权、token 刷新、身份切换、错误提示都由 `dsh-feishu` 统一处理；
- 用户在飞书里看到的内容归属自己的账号；
- 没装飞书插件时，本插件仍完整可用（只写本机）。

## 探测方式

`career_status` 与 `/api/career-kb/state` 会通过 `tools.get(name)` 探测以下工具是否注册：

`feishu_doc`、`feishu_wiki`、`feishu_drive`、`feishu_sheet`、`feishu_bitable`、`feishu_query`、`feishu_message`。

面板显示「飞书已连接 / 未连接」；技能提示词里也会写明当前是否可用。

## 各技能如何用飞书

| 技能 | 飞书工具 | 用途 |
| --- | --- | --- |
| capture | `feishu_wiki` / `feishu_doc` | 把知识卡写成飞书知识库页面或文档；回填 `feishu_url` |
| capture | `feishu_drive` | 上传截图、附件 |
| resume | `feishu_doc` / `feishu_drive` | 简历文档、PDF 上传 |
| interview-prep | `feishu_doc` | 面试准备长文档（可拆「主文档 + 题库」） |
| interview-review | `feishu_doc` | 复盘文档，链接回投递台账 |
| jd-decode | `feishu_bitable` / `feishu_sheet` | 岗位库、投递台账 |
| weekly-review | `feishu_sheet` / `feishu_bitable` | 投递进度看板 |

## 原则

1. **不假装已同步**：没有 `feishu_*` 工具或调用失败时，明确报告「仅保存到本机」并保留本地草稿。
2. **先本机后飞书**：所有技能先保证本机知识库写入并读回，再尝试飞书同步；飞书失败不影响本地记录。
3. **链接回填**：同步成功后把飞书链接写进 frontmatter（`feishu_url`）或记录正文，方便双向追溯。
4. **权限边界**：向招聘方发送、正式投递、公开发布、改变分享权限都需要用户额外明确授权，不因「同步飞书」自动获得。
