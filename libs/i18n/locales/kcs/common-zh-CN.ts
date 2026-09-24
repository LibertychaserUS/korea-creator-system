/** Chinese `common` / `actions`: the few shared words the 听潮 panel shows (the TinyShip locale ../zh-CN.ts reuses them). */
export const zhCNCommon = {
  welcome: "欢迎使用听潮",
  siteName: "听潮",
  login: "登录",
  signup: "注册",
  logout: "退出登录",
  profile: "个人资料",
  settings: "设置",
  and: "和",
  loading: "加载中...",
  unexpectedError: "发生了意外错误",
  notAvailable: "不可用",
  viewPlans: "查看计划",
  yes: "是",
  no: "否",
  theme: {
    light: "浅色主题",
    dark: "深色主题",
    system: "系统主题",
    toggle: "切换主题",
    appearance: "外观设置",
    colorScheme: "配色方案",
    themes: {
      default: "默认主题",
      claude: "Claude主题",
      "cosmic-night": "宇宙之夜",
      "modern-minimal": "现代简约",
      "ocean-breeze": "海洋微风"
    }
  }
} as const

export const zhCNActions = {
  save: "保存",
  cancel: "取消",
  confirm: "确认",
  delete: "删除",
  edit: "编辑",
  tryAgain: "重试",
  createAccount: "创建账户",
  sendCode: "发送验证码",
  verify: "验证",
  backToList: "返回用户列表",
  saveChanges: "保存更改",
  createUser: "创建用户",
  deleteUser: "删除用户",
  back: "返回",
  resendCode: "重新发送",
  resendVerificationEmail: "重新发送验证邮件",
  upload: "上传",
  previous: "上一页",
  next: "下一页",
  createPost: "新建文章",
  deletePost: "删除文章",
  backToBlog: "返回博客"
} as const
