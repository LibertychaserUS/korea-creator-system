# TinyShip 导入针

- 官方仓：`https://github.com/TinyshipCN/tinyship`
- 提交：`54ddc7a87801005b4b88486c11ed82b539954779`
- 标签：`v2.2.0`
- 对象来源：旁路 TinyShip/Ascendia checkout 的 **`upstream/main`**（remote URL 就是上面那个官方仓）。**不是** Ascendia HEAD（`0f9e7be`，产品名 ascendia）。
- 该提交 `package.json` 的 `name` 是 `tinyship`。对 `ascendia` 的检索为 0。
- 导入方式：`git archive` 该 SHA，rsync 排除 `docs/` `archive/` `.git/`。

运行中的 Nuxt 应用产品名是「听潮」。TinyShip 只当宿主框架。
