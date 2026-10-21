# 茶语 H5 分享版

这是一个独立的手机网页版本，可用静态网站托管服务部署，然后把 HTTPS 链接发给好友。它不依赖微信小程序 AppID。

## 本地预览

可以直接双击 `index.html` 在浏览器中预览，也可以用本地静态文件服务打开 `h5` 目录。

## 发布分享

此目录已配置 GitHub Pages 自动发布工作流。将 `h5` 目录内容放进 GitHub 仓库的根目录，仓库设置中把 Pages 发布来源设为 **GitHub Actions**，推送到 `main` 分支后会自动发布。仓库首次启用 Pages 时，可能需要先在 **Settings → Pages** 选择 GitHub Actions。

GitHub Pages 会生成 HTTPS 网址；将该网址发给好友即可打开。网页访问公开，因此不要在静态文件中放私密信息。若要绑定自己的域名，再按域名服务商要求配置 DNS。

## 当前范围

- 菜单搜索、分类、商品详情和规格选择。
- 购物车、取餐人信息和演示订单。
- 订单、购物车和称呼信息保存在当前设备的浏览器 `localStorage`。
- 当前没有真实支付、云端同步、店员收单和跨设备共享；网页订单只用于演示。
- 菜单快照来自小程序的 `utils/menu.js`。修改小程序菜单后，需要同步更新 `menu-data.js`。

## 在线体验

GitHub Pages 发布完成后，可通过 https://lwhshexi.github.io/tea-order-h5/ 访问。
