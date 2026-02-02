---

# Git 团队协作开发流程规范

## 一、 分支管理策略

我们采用类 **GitHub Flow** 的分支模型：

* **`main` 分支**：主分支，代码必须是生产就绪的稳定版本。禁止直接在此分支提交代码。
* **`develop` 分支**：开发主分支，存放最新的开发进展。
* **`feature/*` 分支**：特性分支，用于新功能开发。
* **`hotfix/*` 分支**：紧急修复分支，用于修复生产环境的 Bug。

---

## 二、 日常开发周期

### 1. 同步远程状态

在开始新任务前，务必更新本地主分支，避免后续产生大量冲突。

```bash
git checkout develop
git pull origin develop

```

### 2. 创建特性分支

从最新的 `develop` 分支切出，命名规范为 `feature/功能描述`。

```bash
git checkout -b feature/login-module

```

### 3. 本地开发与提交

* **原子化提交**：每个 Commit 只完成一个微小的逻辑点。
* **规范提交信息**：建议参考 [Angular 规范](https://www.google.com/search?q=https://github.com/angular/angular.js/blob/master/DEVELOPERS.md%23-git-commit-guidelines)。
* `feat: 增加用户登录接口`
* `fix: 修复头像无法上传的 Bug`
* `docs: 更新 README 文档`



```bash
git add .
git commit -m "feat: 实现 UniSpace-AI 校园管网数据展示"

```

### 4. 解决冲突并推送

在推送前，先尝试合并 `develop` 分支的代码以处理可能的冲突。

```bash
# 如果有冲突，手动解决后
git add .
git commit -m "chore: 解决合并冲突"
git push origin feature/login-module
git push -u origin "feature/git_workflow设置"
```

---

## 三、 代码审查与合并 (Pull Request)

1. **发起 PR**：在 GitHub 上将 `feature/login-module` 合并到 `develop`。
2. **Code Review**：团队成员检查代码逻辑、命名规范及性能。
3. **迭代修改**：根据反馈在本地继续提交并 Push，PR 会自动更新。
4. **合并**：审核通过后，由负责人执行 **Squash and Merge**（将多个小提交合并为一个），保持主线简洁。
5. **清理分支**：合并后删除远程和本地的特性分支。

---

## 四、 常见问题配置技巧

### 1. 解决中文路径乱码

在 Mac 或 Windows 下，Git 默认会对中文路径进行转码。建议运行：

```bash
git config --global core.quotepath false

```

### 2. 身份认证失败 (401 Error)

如果遇到 `Authentication failed`，请使用 **Personal Access Token (PAT)** 或官方工具 `gh`：

```bash
gh auth login

```

### 3. 撤销错误操作

* **撤销暂存区文件**：`git reset HEAD <file>`
* **修改最后一次提交信息**：`git commit --amend -m "新的描述"`
* **强行回滚到某个版本**（慎用）：`git reset --hard <commit_id>`

---

## 五、 团队守则

* **禁忌**：严禁在未沟通的情况下使用 `git push -f` 强推公共分支。
* **原则**：代码上线前必须经过 PR 审核。
* **备份**：下班前习惯性将当天代码推送到远程分支，防止数据丢失。

---