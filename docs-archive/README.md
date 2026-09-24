# 文档加密包

仓库只保留必要文档（`AGENTS.md`、`README.md`、`deploy/README.md`、`CHANGELOG.md`、`inbox/`、`suites/`）。其余项目文档不再以明文进仓库，而是打成一个加密包随仓库保存：`kcs-docs-20260924.7z`。

- 生成时间：2026-09-24（UTC）
- 来源：main `6ba4232` 上的文档；移出提交 `42b8f49`（`git rm --cached` + `.gitignore`，历史未改写）
- 格式：7z，AES-256，文件名也加密（打开包需要口令，不输入口令连文件名都看不到）
- 大小：9,939,841 字节
- sha256：`1506573d701d8d85962ba1f1bb113062a57acafae1a214608e327db10f681382`

## 内容概览

共 117 个文件，另附 `MANIFEST.txt`（每个文件的路径、字节数、sha256），全部按原路径存放。文件名在包内已加密，这里只列目录级汇总。

| 目录 | 文件数 | 内容 |
|---|---|---|
| `docs/`（根下） | 13 | 00–11 产品与工程文档（总览、开发日志、数据字典、指标口径、抓取流水线、接口、页面、测试验收、已知问题、Agent 接力、演示流程、文案清单）与交接手册 |
| `docs/archive/` | 92 | 旧架构资料：产品与 PM 文档、开发记录、演示材料、调研、可行性报告，以及样图（62 张 png）和样例报告 |
| `tests/blackbox/`、`e2e/`、`tests/e2e/` | 6 | 黑盒与 E2E 测试说明（规格映射、旅程契约、测试目录等） |
| `tests/payment/`、`libs/`、`apps/tanstack-app/` | 6 | TinyShip 模板自带文档（支付测试说明、组件库与校验库说明、部署笔记） |

## 恢复

工作区里没有这些文档时（例如新 clone，或拉取移出提交后 git 删掉了本地文件），在仓库根目录运行：

```bash
scripts/docs/restore-local-docs.sh                                   # 从 git 历史（6ba4232）恢复，不覆盖已有文件
scripts/docs/restore-local-docs.sh --from-archive docs-archive/kcs-docs-20260924.7z   # 从本加密包恢复（交互输入口令）
```

## 手动解密

- macOS：`brew install sevenzip` 后 `7zz x kcs-docs-20260924.7z`；或用 Keka / The Unarchiver 打开
- Linux：`7z x kcs-docs-20260924.7z`（`p7zip-full` 或 `7zip` 包）
- Windows：用 7-Zip 打开

按提示输入口令。解出后把目录按原路径放回仓库根目录即可：这些文件已被 `.gitignore` 忽略，不会被再次提交。可用 `MANIFEST.txt` 里的 sha256 核对。

## 口令

口令不在仓库里，由仓库负责人保管。

## 更新

文档有变更时，在仓库根目录运行：

```bash
scripts/docs/pack-local-docs.sh --update-readme      # 交互输入口令两次；或 --password-file <只有自己可读的文件>
```

脚本只打包被 `.gitignore` 忽略的文档（不含代码、依赖和构建输出），生成 `MANIFEST.txt`，打出新包并改写本说明里的包名、生成时间、文件数、大小和 sha256。然后 `git rm` 旧包，`git add` 新包与本说明并提交；目录汇总表请人工核对。口令不要写在命令行上。
