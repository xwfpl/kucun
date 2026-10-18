# 进销存管家

一个零依赖、纯前端的**入库 / 出库 / 库存管理**小工具。适合小卖家、个体工商户离线记流水。

## ✨ 功能

- **📥 入库单**：一张单支持多种商品，自动核算加权平均成本
- **📤 出库单**：同一张单多种商品，实时显示库存和预估利润
- **📊 总览**：按月切换，看当月入库金额 / 返利 / 赠金 / 利润
- **📋 库存查询**：搜索、删除、显示最近供应商
- **📝 流水记录**：全部历史，可筛选 / 搜索
- **💾 数据持久化**：浏览器 localStorage，支持 JSON 导入 / 导出备份
- **📱 响应式**：桌面 / 手机自适应
- **🎨 深色主题**：深水蓝玻璃态

## 💰 成本 & 利润公式

```
净采购成本 = 单价 × 数量 − 返利 − 赠金
加权平均成本 = 净采购成本 ÷ 数量
利润 = (出库单价 − 加权平均成本) × 出库数量
```

## 🚀 使用

### 方式一：GitHub Pages（推荐）

1. 点右上角 **[Fork](https://github.com/new)**（或点这个：https://github.com/new 新建仓库，名字随便取）
2. 仓库里点 **Settings → Pages**
3. Source 选 `main` / `/root`，保存
4. 等 1-2 分钟，访问 `https://你的用户名.github.io/仓库名/`

### 方式二：本地直接打开

双击 `index.html` 即可（纯 HTML + CSS + JS，无后端）。

### 方式三：手机局域网访问

在目录里运行：

```bash
# Python 3
python -m http.server 8080

# 或 Node
npx serve .

# 或 Windows PowerShell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

然后手机连同一个 WiFi，浏览器输 `http://电脑IP:8080/index.html`

## 📁 文件结构

```
index.html    页面
style.css     样式（深色主题）
app.js        业务逻辑
```

## 📦 数据说明

- 所有数据存 **浏览器本地**（localStorage）
- 换浏览器 / 清缓存会丢数据，建议定期导出备份
- 导出的 JSON 可在另一台机器 / 另一个浏览器里导入恢复

## 🤝 贡献

欢迎提 issue / PR。

## 📄 License

MIT
