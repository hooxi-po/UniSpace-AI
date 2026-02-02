这份指南为你总结了在 **UniSpace-AI** 项目中推荐的完整 **GitHub Flow** 工作流。它兼顾了个人开发的效率与未来多人协作的规范性。

---

## 🚀 完整 Git 开发闭环流程

### 第一阶段：开发前准备（同步环境）

在开始任何新工作前，确保你的本地代码是服务器上的最新版本，避免后期冲突。

```bash
# 切换到开发主分支
git checkout develop

# 拉取远程最新代码
git pull origin develop

```

### 第二阶段：任务隔离（创建分支）

**永远不在 `develop` 或 `main` 上直接改代码。** 为每个功能开辟“独立战场”。

```bash
# 创建并切换到新分支（建议用英文命名，如功能、Bug修复）
git checkout -b feature/pipeline-visualization

```

### 第三阶段：迭代开发（提交代码）

高频提交，小步快跑。一个 Commit 只解决一个微小问题。

```bash
# 1. 查看改动状态
git status

# 2. 暂存改动
git add .

# 3. 规范化提交（建议前缀：feat, fix, docs, style）
git commit -m "feat: implement 3D pipeline layer rendering"

```

### 第四阶段：同步与推送（解决冲突）

在推送前，先尝试合并 `develop` 的更新，确保你的代码不会破坏主线。

```bash
# 重新拉取 develop 的更新到当前特性分支
git pull origin develop

# 如果有冲突，在此步手动解决并 commit
# 然后推送分支到远程（第一次推送需加 -u）
git push -u origin feature/pipeline-visualization

```

### 第五阶段：代码合并（Pull Request）

1. **发起 PR**：在 GitHub 网页端点击 **Compare & pull request**。
2. **代码评审 (Code Review)**：如果是多人团队，此时由队友查看代码并提出修改意见。
3. **合并 (Merge)**：评审通过后，点击 **Squash and merge**。

### 第六阶段：收尾清理（保持整洁）

合并完成后，旧的特性分支就变成了“电子垃圾”，应当清理。

```bash
# 1. 切换回主分支
git checkout develop

# 2. 拉取合并后的最新代码
git pull origin develop

# 3. 删除本地已过时的特性分支
git branch -d feature/pipeline-visualization

# 4. 清理本地对已删除远程分支的缓存记录
git fetch -p

```

---

## 🛠️ 核心避坑清单

| 操作 | 建议 | 备注 |
| --- | --- | --- |
| **分支命名** | 使用 `feature/` 或 `fix/` 前缀 | 避免使用纯中文，防止脚本处理报错 |
| **提交频率** | 每天至少 Push 一次 | 远程仓库是你的代码备份，防止电脑宕机 |
| **认证问题** | 使用 `gh auth login` 或 PAT | 解决 401 认证错误的终极方案 |
| **冲突处理** | “先拉后推” (Pull before Push) | 养成先同步再推送的习惯，冲突几率降低 80% |

---

## 📝 常用速查命令表

* `git status`: 看看我现在在哪，改了什么。
* `git log --oneline --graph`: 用漂亮的图形化查看提交历史。
* `git branch -a`: 查看本地和远程的所有分支。
* `git diff`: 查看具体的代码改动细节。

---

测试是否正确提交