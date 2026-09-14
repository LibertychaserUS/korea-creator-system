import type { Locale } from './types'

export const zhCN: Locale = {
  common: {
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
  },
  navigation: {
    home: "首页",
    dashboard: "仪表盘",
    orders: "订单",
    shipments: "发货",
    tracking: "追踪",
    admin: {
      dashboard: "仪表盘",
      users: "用户管理",
      subscriptions: "订阅管理",
      orders: "订单管理",
      credits: "积分管理",
      application: "应用程序",
      blog: "博客管理"
    }
  },
  actions: {
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
  },
  email: {
    verification: {
      subject: "验证您的 TinyShip 账号",
      title: "请验证您的邮箱地址",
      greeting: "您好 {{name}}，",
      message: "感谢您注册 TinyShip。要完成注册，请点击下方按钮验证您的电子邮箱地址。",
      button: "验证邮箱地址",
      alternativeText: "或者，您可以复制并粘贴以下链接到浏览器中：",
      expiry: "此链接将在 {{expiry_hours}} 小时后过期。",
      disclaimer: "如果您没有请求此验证，请忽略此邮件。",
      signature: "祝您使用愉快，TinyShip 团队",
      copyright: "© {{year}} TinyShip. 保留所有权利。"
    },
    resetPassword: {
      subject: "重置您的 TinyShip 密码",
      title: "重置您的密码",
      greeting: "您好 {{name}}，",
      message: "我们收到了重置您密码的请求。请点击下方按钮创建新密码。如果您没有提出此请求，可以安全地忽略此邮件。",
      button: "重置密码",
      alternativeText: "或者，您可以复制并粘贴以下链接到浏览器中：",
      expiry: "此链接将在 {{expiry_hours}} 小时后过期。",
      disclaimer: "如果您没有请求重置密码，无需进行任何操作。",
      signature: "祝您使用愉快，TinyShip 团队",
      copyright: "© {{year}} TinyShip. 保留所有权利。"
    }
  },
  auth: {
    metadata: {
      signin: {
        title: "TinyShip - 登录",
        description: "登录您的 TinyShip 账户，访问仪表板、管理订阅并使用高级功能。",
        keywords: "登录, 账户登录, 身份验证, 访问账户, 仪表板"
      },
      signup: {
        title: "TinyShip - 创建账户",
        description: "创建您的 TinyShip 账户，开始使用我们全面的脚手架构建出色的 SaaS 应用程序。",
        keywords: "注册, 创建账户, 新用户, 开始使用, 账户注册"
      },
      forgotPassword: {
        title: "TinyShip - 重置密码",
        description: "安全地重置您的 TinyShip 账户密码。输入您的邮箱以接收密码重置说明。",
        keywords: "忘记密码, 重置密码, 密码恢复, 账户恢复"
      },
      resetPassword: {
        title: "TinyShip - 创建新密码",
        description: "为您的 TinyShip 账户创建新的安全密码。选择强密码来保护您的账户。",
        keywords: "新密码, 密码重置, 安全密码, 账户安全"
      },
      phone: {
        title: "TinyShip - 手机登录",
        description: "使用手机号登录 TinyShip。通过短信验证进行快速安全的身份验证。",
        keywords: "手机登录, 短信验证, 移动端认证, 手机号码"
      },
      wechat: {
        title: "TinyShip - 微信登录",
        description: "使用微信账户登录 TinyShip。为中国用户提供便捷的身份验证。",
        keywords: "微信登录, WeChat登录, 社交登录, 中国认证"
      }
    },
    signin: {
      title: "登录您的账户",
      welcomeBack: "欢迎回来",
      socialLogin: "使用您喜欢的社交账号登录",
      continueWith: "或继续使用",
      email: "邮箱",
      emailPlaceholder: "请输入邮箱地址",
      password: "密码",
      forgotPassword: "忘记密码？",
      rememberMe: "记住我",
      submit: "登录",
      submitting: "登录中...",
      noAccount: "还没有账户？",
      signupLink: "注册",
      termsNotice: "点击继续即表示您同意我们的",
      termsOfService: "服务条款",
      privacyPolicy: "隐私政策",
      socialProviders: {
        google: "Google",
        github: "GitHub",
        apple: "Apple",
        wechat: "微信",
        phone: "手机号码"
      },
      errors: {
        invalidEmail: "请输入有效的邮箱地址",
        requiredEmail: "请输入邮箱",
        requiredPassword: "请输入密码",
        invalidCredentials: "邮箱或密码错误",
        captchaRequired: "请完成验证码验证",
        emailNotVerified: {
          title: "需要邮箱验证",
          description: "请检查您的邮箱并点击验证链接。如果您没有收到邮件，可以点击下方按钮重新发送。",
          resendSuccess: "验证邮件已重新发送，请检查您的邮箱。",
          resendError: "重发验证邮件失败，请稍后重试。",
          dialogTitle: "重新发送验证邮件",
          dialogDescription: "请完成验证码验证后重新发送验证邮件",
          emailLabel: "邮箱地址",
          sendButton: "发送验证邮件",
          sendingButton: "发送中...",
          waitButton: "等待 {seconds}s"
        }
      }
    },
    signup: {
      title: "注册 TinyShip",
      createAccount: "创建账户",
      socialSignup: "使用您喜欢的社交账号注册",
      continueWith: "或继续使用",
      name: "姓名",
      namePlaceholder: "请输入您的姓名",
      email: "邮箱",
      emailPlaceholder: "请输入邮箱地址",
      password: "密码",
      passwordPlaceholder: "创建密码",
      imageUrl: "头像图片链接",
      imageUrlPlaceholder: "https://example.com/your-image.jpg",
      optional: "可选",
      submit: "创建账户",
      submitting: "创建账户中...",
      haveAccount: "已有账户？",
      signinLink: "登录",
      termsNotice: "点击继续即表示您同意我们的",
      termsOfService: "服务条款",
      privacyPolicy: "隐私政策",
      verification: {
        title: "需要验证",
        sent: "我们已经发送验证邮件到",
        checkSpam: "找不到邮件？请检查垃圾邮件文件夹。",
        spamInstruction: "如果仍然没有收到，"
      },
      errors: {
        invalidName: "请输入有效的姓名",
        requiredName: "请输入姓名",
        invalidEmail: "请输入有效的邮箱地址",
        requiredEmail: "请输入邮箱",
        invalidPassword: "请输入有效的密码",
        requiredPassword: "请输入密码",
        invalidImage: "请输入有效的图片链接",
        captchaRequired: "请完成验证码验证",
        captchaError: "验证码验证失败，请重试",
        captchaExpired: "验证码已过期，请重新验证"
      }
    },
    phone: {
      title: "手机号登录",
      description: "输入您的手机号以接收验证码",
      phoneNumber: "手机号",
      phoneNumberPlaceholder: "请输入您的手机号",
      countryCode: "国家/地区",
      verificationCode: "验证码",
      enterCode: "输入验证码",
      sendingCode: "发送验证码中...",
      verifying: "验证中...",
      codeSentTo: "已发送验证码到",
      resendIn: "重新发送",
      seconds: "秒",
      resendCode: "重新发送",
      resendCountdown: "秒后可重新发送",
      termsNotice: "点击继续即表示您同意我们的",
      termsOfService: "服务条款",
      privacyPolicy: "隐私政策",
      errors: {
        invalidPhone: "请输入有效的手机号",
        requiredPhone: "请输入手机号",
        requiredCountryCode: "请选择国家/地区",
        invalidCode: "请输入有效的验证码",
        requiredCode: "请输入验证码",
        captchaRequired: "请完成验证码验证"
      }
    },
    forgetPassword: {
      title: "忘记密码",
      description: "重置密码并重新获得账户访问权限",
      email: "邮箱",
      emailPlaceholder: "请输入邮箱地址",
      submit: "发送重置链接",
      submitting: "发送中...",
      termsNotice: "点击继续即表示您同意我们的",
      termsOfService: "服务条款",
      privacyPolicy: "隐私政策",
      verification: {
        title: "检查您的邮箱",
        sent: "我们已经发送重置密码链接到",
        checkSpam: "找不到邮件？请检查垃圾邮件文件夹。"
      },
      errors: {
        invalidEmail: "请输入有效的邮箱地址",
        requiredEmail: "请输入邮箱",
        captchaRequired: "请完成验证码验证"
      }
    },
    resetPassword: {
      title: "重置密码",
      description: "为您的账户创建新密码",
      password: "新密码",
      passwordPlaceholder: "请输入新密码",
      confirmPassword: "确认密码",
      confirmPasswordPlaceholder: "请再次输入新密码",
      submit: "重置密码",
      submitting: "重置中...",
      success: {
        title: "密码重置成功",
        description: "您的密码已经成功重置。",
        backToSignin: "返回登录",
        goToSignIn: "返回登录"
      },
      errors: {
        invalidPassword: "密码长度至少为8个字符",
        requiredPassword: "请输入密码",
        passwordsDontMatch: "两次输入的密码不一致",
        invalidToken: "重置链接无效或已过期，请重试。"
      }
    },
    wechat: {
      title: "微信登录",
      description: "使用微信扫码登录",
      scanQRCode: "请使用微信扫描二维码",
      orUseOtherMethods: "或使用其他登录方式",
      loadingQRCode: "加载二维码中...",
      termsNotice: "点击继续即表示您同意我们的",
      termsOfService: "服务条款",
      privacyPolicy: "隐私政策",
      errors: {
        loadingFailed: "微信二维码加载失败",
        networkError: "网络错误，请重试"
      }
    },
    // Better Auth 1.4 错误代码映射
    authErrors: {
      // 用户相关错误
      USER_NOT_FOUND: "未找到该邮箱对应的账户",
      USER_ALREADY_EXISTS: "该邮箱已被注册",
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "用户已存在，请使用其他邮箱",
      USER_EMAIL_NOT_FOUND: "未找到用户邮箱",
      FAILED_TO_CREATE_USER: "创建用户失败",
      FAILED_TO_UPDATE_USER: "更新用户失败",
      
      // 认证错误
      INVALID_EMAIL: "邮箱地址无效",
      INVALID_PASSWORD: "密码无效",
      INVALID_EMAIL_OR_PASSWORD: "邮箱或密码错误",
      INVALID_CREDENTIALS: "提供的凭据无效",
      INVALID_TOKEN: "无效或已过期的令牌",
      PASSWORD_TOO_SHORT: "密码过短",
      PASSWORD_TOO_LONG: "密码过长",
      
      // 邮箱验证错误
      EMAIL_NOT_VERIFIED: "请先验证您的邮箱地址",
      EMAIL_ALREADY_VERIFIED: "邮箱已验证",
      EMAIL_MISMATCH: "邮箱不匹配",
      EMAIL_CAN_NOT_BE_UPDATED: "邮箱无法更新",
      VERIFICATION_EMAIL_NOT_ENABLED: "验证邮件功能未启用",
      
      // 会话错误
      SESSION_EXPIRED: "您的会话已过期，请重新登录",
      SESSION_NOT_FRESH: "会话不是最新的，请重新认证",
      FAILED_TO_CREATE_SESSION: "创建会话失败",
      FAILED_TO_GET_SESSION: "获取会话失败",
      
      // 账户错误
      ACCOUNT_NOT_FOUND: "账户未找到",
      ACCOUNT_BLOCKED: "您的账户已被临时冻结",
      CREDENTIAL_ACCOUNT_NOT_FOUND: "凭证账户未找到",
      SOCIAL_ACCOUNT_ALREADY_LINKED: "社交账户已关联",
      LINKED_ACCOUNT_ALREADY_EXISTS: "关联账户已存在",
      FAILED_TO_UNLINK_LAST_ACCOUNT: "无法解除最后一个账户的关联",
      USER_ALREADY_HAS_PASSWORD: "用户已设置密码",
      
      // 手机号错误
      PHONE_NUMBER_ALREADY_EXISTS: "该手机号已被注册",
      INVALID_PHONE_NUMBER: "手机号格式无效",
      OTP_EXPIRED: "验证码已过期",
      INVALID_OTP: "验证码错误",
      OTP_TOO_MANY_ATTEMPTS: "验证尝试次数过多，请重新获取验证码",
      
      // 提供商错误
      PROVIDER_NOT_FOUND: "提供商未找到",
      ID_TOKEN_NOT_SUPPORTED: "不支持 ID Token",
      FAILED_TO_GET_USER_INFO: "获取用户信息失败",
      
      // 安全错误
      CAPTCHA_REQUIRED: "请完成验证码验证",
      CAPTCHA_INVALID: "验证码验证失败",
      TOO_MANY_REQUESTS: "请求过于频繁，请稍后重试",
      CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: "跨站导航登录被阻止",
      INVALID_ORIGIN: "无效的来源",
      MISSING_OR_NULL_ORIGIN: "来源缺失或无效",
      
      // 回调 URL 错误
      INVALID_CALLBACK_URL: "无效的回调 URL",
      INVALID_REDIRECT_URL: "无效的重定向 URL",
      INVALID_ERROR_CALLBACK_URL: "无效的错误回调 URL",
      INVALID_NEW_USER_CALLBACK_URL: "无效的新用户回调 URL",
      CALLBACK_URL_REQUIRED: "需要回调 URL",
      
      // 验证错误
      VALIDATION_ERROR: "验证错误",
      MISSING_FIELD: "缺少必填字段",
      FIELD_NOT_ALLOWED: "不允许的字段",
      ASYNC_VALIDATION_NOT_SUPPORTED: "不支持异步验证",
      
      // 系统错误
      FAILED_TO_CREATE_VERIFICATION: "创建验证失败",
      EMAIL_SEND_FAILED: "邮件发送失败，请稍后重试",
      SMS_SEND_FAILED: "短信发送失败，请稍后重试",
      UNKNOWN_ERROR: "发生未知错误"
    }
  },
  admin: {
    metadata: {
      title: "TinyShip - 管理后台",
      description: "全面的管理仪表板，用于管理用户、订阅、订单和系统分析，为您的SaaS应用提供强大的管理功能。",
      keywords: "管理后台, 仪表板, 管理, SaaS, 分析, 用户, 订阅, 订单"
    },
    dashboard: {
      title: "管理员仪表板",
      accessDenied: "访问被拒绝",
      noPermission: "您没有权限访问管理员仪表板",
      lastUpdated: "最后更新",
      metrics: {
        totalRevenue: "总收入",
        totalRevenueDesc: "历史总收入",
        newCustomers: "本月新客户",
        newCustomersDesc: "本月新增客户数",
        newOrders: "本月新订单",
        newOrdersDesc: "本月新增订单数",
        fromLastMonth: "较上月"
      },
      chart: {
        monthlyRevenueTrend: "月度收入趋势",
        revenue: "收入",
        orders: "订单数"
      },
      todayData: {
        title: "今日数据",
        revenue: "收入",
        newUsers: "新用户",
        orders: "订单数"
      },
      monthData: {
        title: "本月数据",
        revenue: "本月收入",
        newUsers: "本月新用户",
        orders: "本月订单数"
      },
      recentOrders: {
        title: "最近订单",
        orderId: "订单ID",
        customer: "客户",
        plan: "计划",
        amount: "金额",
        provider: "支付方式",
        status: "状态",
        time: "时间",
        total: "总计"
      }
    },
    users: {
      title: "用户管理",
      subtitle: "管理用户、角色和权限",
      createUser: "创建用户",
      editUser: "编辑用户",
      actions: {
        addUser: "添加用户",
        editUser: "编辑用户",
        deleteUser: "删除用户",
        banUser: "封禁用户",
        unbanUser: "解封用户"
      },
      table: {
        columns: {
          id: "ID",
          name: "姓名",
          email: "邮箱",
          role: "角色",
          phoneNumber: "手机号",
          emailVerified: "邮箱验证",
          banned: "封禁状态",
          createdAt: "创建时间",
          updatedAt: "更新时间",
          actions: "操作"
        },
        actions: {
          editUser: "编辑用户",
          deleteUser: "删除用户",
          clickToCopy: "点击复制"
        },
        sort: {
          ascending: "升序排列",
          descending: "降序排列",
          none: "取消排序"
        },
        noResults: "未找到用户",
        search: {
          searchBy: "搜索字段",
          searchPlaceholder: "搜索 {field}...",
          filterByRole: "按角色筛选",
          allRoles: "所有角色",
          banStatus: "封禁状态",
          allUsers: "所有用户",
          bannedUsers: "已封禁",
          notBannedUsers: "未封禁",
          view: "视图",
          toggleColumns: "切换列显示"
        },
        pagination: {
          showing: "显示第 {start} 到 {end} 条，共 {total} 条结果",
          pageInfo: "第 {current} 页，共 {total} 页"
        },
        dialog: {
          banTitle: "封禁用户",
          banDescription: "您确定要封禁此用户吗？他们将无法访问应用程序。",
          banSuccess: "用户封禁成功",
          unbanSuccess: "用户解封成功",
          updateRoleSuccess: "用户角色更新成功",
          updateRoleFailed: "用户角色更新失败"
        }
      },
      banDialog: {
        title: "封禁用户",
        description: "您确定要封禁 {userName} 吗？他们将无法访问应用程序。"
      },
      unbanDialog: {
        title: "解封用户",
        description: "您确定要解封 {userName} 吗？他们将重新获得访问权限。"
      },
      form: {
        title: "用户信息",
        description: "请在下方输入用户详细信息",
        labels: {
          name: "姓名",
          email: "邮箱",
          password: "密码",
          confirmPassword: "确认密码",
          role: "角色",
          image: "头像",
          phoneNumber: "手机号",
          emailVerified: "邮箱已验证",
          phoneVerified: "手机已验证",
          banned: "已封禁",
          banReason: "封禁原因"
        },
        placeholders: {
          name: "请输入用户姓名",
          email: "请输入用户邮箱",
          password: "请输入密码（至少8位）",
          confirmPassword: "请确认密码",
          selectRole: "请选择角色",
          image: "https://example.com/avatar.jpg",
          phoneNumber: "请输入手机号",
          banReason: "封禁原因（可选）"
        },
        validation: {
          nameRequired: "姓名不能为空",
          emailRequired: "邮箱不能为空",
          emailInvalid: "请输入有效的邮箱地址",
          passwordRequired: "密码不能为空",
          passwordMinLength: "密码至少需要8位字符",
          passwordMismatch: "两次输入的密码不一致",
          roleRequired: "请选择角色"
        }
      },
      deleteDialog: {
        title: "删除用户",
        description: "您确定要删除此用户吗？此操作无法撤销，将永久删除用户账户和所有相关数据。"
      },
      messages: {
        createSuccess: "用户创建成功",
        updateSuccess: "用户更新成功",
        deleteSuccess: "用户删除成功",
        fetchError: "获取用户信息失败",
        operationFailed: "操作失败",
        deleteError: "删除用户失败"
      }
    },
    orders: {
      title: "订单管理",
      actions: {
        createOrder: "创建订单"
      },
      messages: {
        fetchError: "加载订单失败，请重试。"
      },
      table: {
        noResults: "未找到订单。",
        search: {
          searchBy: "搜索条件...",
          searchPlaceholder: "按{field}搜索...",
          filterByStatus: "按状态筛选",
          allStatus: "所有状态",
          filterByProvider: "支付方式",
          allProviders: "所有支付方式",
          pending: "待支付",
          paid: "已支付",
          failed: "支付失败",
          refunded: "已退款",
          canceled: "已取消",
          stripe: "Stripe",
          wechat: "微信支付",
          creem: "Creem",
          alipay: "支付宝"
        },
        columns: {
          id: "订单ID",
          user: "用户",
          amount: "金额",
          plan: "计划",
          status: "状态",
          provider: "支付方式",
          providerOrderId: "支付平台订单ID",
          createdAt: "创建时间",
          actions: "操作"
        },
        actions: {
          viewOrder: "查看订单",
          refundOrder: "退款",
          openMenu: "打开菜单",
          actions: "操作",
          clickToCopy: "点击复制"
        },
        sort: {
          ascending: "升序排列",
          descending: "降序排列",
          none: "取消排序"
        }
      },
      status: {
        pending: "待支付",
        paid: "已支付",
        failed: "支付失败",
        refunded: "已退款",
        canceled: "已取消"
      }
    },
    blog: {
      title: "博客管理",
      subtitle: "创建和管理博客文章",
      createPost: "创建文章",
      editPost: "编辑文章",
      actions: {
        newPost: "新建文章"
      },
      messages: {
        fetchError: "加载博客文章失败，请重试。",
        createSuccess: "文章创建成功",
        updateSuccess: "文章更新成功",
        deleteSuccess: "文章删除成功",
        deleteError: "删除文章失败",
        operationFailed: "操作失败",
        uploadSuccess: "上传成功",
        uploadError: "上传失败"
      },
      table: {
        noResults: "未找到文章。",
        search: {
          searchPlaceholder: "按标题搜索...",
          filterByStatus: "按状态筛选",
          allStatus: "所有状态",
          draft: "草稿",
          published: "已发布"
        },
        columns: {
          title: "标题",
          status: "状态",
          author: "作者",
          publishedAt: "发布时间",
          createdAt: "创建时间",
          actions: "操作"
        },
        actions: {
          edit: "编辑",
          delete: "删除"
        },
        sort: {
          ascending: "升序排列",
          descending: "降序排列",
          none: "取消排序"
        }
      },
      form: {
        title: "文章信息",
        description: "请在下方输入文章详情",
        labels: {
          title: "标题",
          slug: "URL 别名",
          excerpt: "摘要",
          coverImage: "封面图",
          status: "状态",
          content: "内容"
        },
        placeholders: {
          title: "请输入文章标题",
          slug: "URL 友好别名（根据标题自动生成）",
          excerpt: "文章简要摘要",
          coverImage: "拖放或点击上传（最大 2MB）",
          content: "使用 Markdown 编写内容..."
        }
      },
      deleteDialog: {
        title: "删除文章",
        description: "您确定要删除此文章吗？此操作无法撤销，将永久删除该文章。"
      }
    },
    credits: {
      title: "积分交易记录",
      subtitle: "查看所有用户的积分收入和消耗记录",
      messages: {
        fetchError: "加载积分交易记录失败，请重试。"
      },
      table: {
        noResults: "未找到积分交易记录。",
        search: {
          searchBy: "搜索条件...",
          searchPlaceholder: "按{field}搜索...",
          filterByType: "按类型筛选",
          allTypes: "所有类型",
          purchase: "购买",
          consumption: "消耗",
          refund: "退款",
          bonus: "奖励",
          adjustment: "调整"
        },
        columns: {
          id: "交易ID",
          user: "用户",
          type: "类型",
          amount: "金额",
          balance: "余额",
          description: "描述",
          createdAt: "创建时间",
          metadata: "元数据"
        },
        actions: {
          clickToCopy: "点击复制",
          viewDetails: "查看详情"
        },
        sort: {
          ascending: "升序排列",
          descending: "降序排列",
          none: "取消排序"
        },
        pagination: {
          showing: "显示第 {start} 到 {end} 条，共 {total} 条结果",
          pageInfo: "第 {current} 页，共 {total} 页"
        }
      },
      type: {
        purchase: "购买",
        consumption: "消耗",
        refund: "退款",
        bonus: "奖励",
        adjustment: "调整"
      }
    },
    subscriptions: {
      title: "订阅管理",
      description: "管理用户订阅和账单",
      actions: {
        createSubscription: "创建订阅"
      },
      messages: {
        fetchError: "加载订阅失败，请重试。"
      },
      table: {
        showing: "显示第 {from} 到 {to} 项，共 {total} 项结果",
        noResults: "未找到订阅。",
        rowsPerPage: "每页行数",
        page: "第",
        of: "页，共",
        view: "查看",
        toggleColumns: "切换列",
        goToFirstPage: "转到第一页",
        goToPreviousPage: "转到上一页", 
        goToNextPage: "转到下一页",
        goToLastPage: "转到最后一页",
        search: {
          searchLabel: "搜索订阅",
          searchField: "搜索字段",
          statusLabel: "状态",
          providerLabel: "提供商",
          search: "搜索",
          clear: "清除",
          allStatuses: "所有状态",
          allProviders: "所有提供商",
          stripe: "Stripe",
          creem: "Creem",
          wechat: "微信支付",
          alipay: "支付宝",
          userEmail: "用户邮箱",
          subscriptionId: "订阅ID",
          userId: "用户ID",
          planId: "计划ID",
          stripeSubscriptionId: "Stripe订阅ID",
          creemSubscriptionId: "Creem订阅ID",
          placeholders: {
            userEmail: "输入用户邮箱...",
            subscriptionId: "输入订阅ID...",
            userId: "输入用户ID...",
            planId: "输入计划ID...",
            stripeSubscriptionId: "输入Stripe订阅ID...",
            creemSubscriptionId: "输入Creem订阅ID...",
            default: "输入搜索词..."
          },
          searchBy: "搜索条件...",
          searchPlaceholder: "按{field}搜索...",
          filterByStatus: "按状态筛选",
          filterByProvider: "按提供商筛选",
          allStatus: "所有状态",
          filterByPaymentType: "支付类型",
          allPaymentTypes: "所有类型",
          active: "活跃",
          canceled: "已取消",
          expired: "已过期",
          trialing: "试用中",
          inactive: "未激活",
          oneTime: "一次性",
          recurring: "循环订阅"
        },
        columns: {
          id: "订阅ID",
          user: "客户",
          plan: "计划",
          status: "状态",
          paymentType: "支付类型",
          provider: "提供商",
          periodStart: "开始时间",
          periodEnd: "结束时间",
          cancelAtPeriodEnd: "将取消",
          createdAt: "创建时间",
          updatedAt: "更新时间",
          metadata: "元数据",
          period: "周期",
          actions: "操作"
        },
        actions: {
          openMenu: "打开菜单",
          actions: "操作",
          viewSubscription: "查看订阅",
          cancelSubscription: "取消订阅",
          clickToCopy: "点击复制"
        },
        sort: {
          ascending: "升序排列",
          descending: "降序排列",
          none: "取消排序"
        }
      },
      status: {
        active: "活跃",
        trialing: "试用中",
        canceled: "已取消",
        cancelled: "已取消",
        expired: "已过期",
        inactive: "未激活"
      },
      paymentType: {
        one_time: "一次性",
        recurring: "循环订阅"
      }
    }
  },
  pricing: {
    metadata: {
      title: "TinyShip - 定价方案",
      description: "选择最适合您需求的完美方案。灵活的定价选项包括月度、年度和终身订阅，享受高级功能。",
              keywords: "定价, 方案, 订阅, 月度, 年度, 终身, 高级, 功能"
    },
    title: "定价",
    subtitle: "选择最适合您的方案",
    description: "支持传统按时间订阅（月付/年付/终身）与 AI 时代流行的积分模式。订阅无限畅享，或充值积分按需消费。",
    cta: "立即开始",
    recommendedBadge: "推荐选择",
    lifetimeBadge: "一次购买，终身使用",
    creditsBadge: "积分包",
    creditsUnit: "积分",
    tabs: {
      subscription: "订阅套餐",
      credits: "积分充值"
    },
    features: {
      securePayment: {
        title: "多渠道安全支付",
        description: "支持微信支付、Stripe、Creem 等多种企业级安全支付方式"
      },
      flexibleSubscription: {
        title: "灵活付费模式",
        description: "传统订阅或 AI 时代积分制，任你选择"
      },
      globalCoverage: {
        title: "全球支付覆盖",
        description: "多币种和地区支付方式，为全球用户提供便捷支付体验"
      }
    },
    plans: {
      monthly: {
        name: "月度订阅",
        description: "灵活管理，按月付费",
        duration: "月",
        features: {
          "所有高级功能": "所有高级功能",
          "优先支持": "优先支持"
        }
      },
      yearly: {
        name: "年度订阅",
        description: "年付更优惠",
        duration: "年",
        features: {
          "所有高级功能": "所有高级功能",
          "优先支持": "优先支持",
          "两个月免费": "两个月免费"
        }
      },
      lifetime: {
        name: "终身会员",
        description: "一次付费，永久使用",
        duration: "终身",
        features: {
          "所有高级功能": "所有高级功能",
          "优先支持": "优先支持",
          "终身免费更新": "终身免费更新"
        }
      }
    }
  },
  payment: {
    metadata: {
      success: {
        title: "TinyShip - 支付成功",
        description: "您的支付已成功处理。感谢您的订阅，欢迎使用我们的高级功能。",
        keywords: "支付, 成功, 订阅, 确认, 高级功能"
      },
      cancel: {
        title: "TinyShip - 支付已取消",
        description: "您的支付已被取消。您可以重新尝试支付或联系我们的客服团队获取帮助。",
        keywords: "支付, 取消, 重试, 客服, 订阅"
      }
    },
    result: {
      success: {
        title: "支付成功",
        description: "您的支付已成功处理。",
        actions: {
          viewSubscription: "查看订阅",
          backToHome: "返回首页"
        }
      },
      cancel: {
        title: "支付已取消",
        description: "您的支付已被取消。",
        actions: {
          tryAgain: "重试",
          contactSupport: "联系客服",
          backToHome: "返回首页"
        }
      },
      failed: "支付失败，请重试"
    },
    steps: {
      initiate: "初始化",
      initiateDesc: "准备支付",
      scan: "扫码",
      scanDesc: "请扫描二维码",
      pay: "支付",
      payDesc: "确认支付"
    },
    scanQrCode: "请使用微信扫描二维码完成支付",
    confirmCancel: "您的支付尚未完成，确定要取消吗？",
    orderCanceled: "您的订单已取消"
  },
  subscription: {
    metadata: {
      title: "TinyShip - 我的订阅",
      description: "在您的订阅仪表板中管理订阅计划、查看账单历史和更新付款方式。",
              keywords: "订阅, 账单, 支付, 计划, 管理, 仪表板"
    },
    title: "我的订阅",
    overview: {
      title: "订阅概览",
      planType: "计划类型",
      status: "状态",
      active: "已激活",
      startDate: "开始日期",
      endDate: "结束日期",
      progress: "订阅进度"
    },
    management: {
      title: "订阅管理",
      description: "通过客户门户管理您的订阅、查看账单历史和更新付款方式。",
      manageSubscription: "管理订阅",
      changePlan: "更改计划",
      redirecting: "正在跳转..."
    },
    noSubscription: {
      title: "未找到有效订阅",
      description: "您当前没有活跃的订阅计划。",
      viewPlans: "查看订阅计划"
    }
  },
  dashboard: {
    metadata: {
      title: "TinyShip - 仪表盘",
      description: "在您的个性化仪表盘中管理账户、订阅和个人资料设置。",
              keywords: "仪表盘, 账户, 个人资料, 订阅, 设置, 管理"
    },
    title: "仪表盘",
    description: "管理您的账户和订阅",
    profile: {
      title: "个人信息",
      noNameSet: "未设置姓名",
      role: "角色:",
      emailVerified: "邮箱已验证",
      editProfile: "编辑个人资料",
      updateProfile: "更新个人资料",
      cancel: "取消",
      form: {
        labels: {
          name: "姓名",
          email: "邮箱地址",
          image: "头像图片链接"
        },
        placeholders: {
          name: "请输入您的姓名",
          email: "邮箱地址",
          image: "https://example.com/your-image.jpg"
        },
        emailReadonly: "邮箱地址无法修改",
        imageDescription: "可选：输入您的头像图片链接"
      },
      updateSuccess: "个人资料更新成功",
      updateError: "更新个人资料失败，请重试"
    },
    subscription: {
      title: "订阅状态",
      status: {
        lifetime: "终身会员",
        active: "有效",
        canceled: "已取消",
        cancelAtPeriodEnd: "期末取消",
        pastDue: "逾期",
        unknown: "未知",
        noSubscription: "无订阅"
      },
      paymentType: {
        recurring: "循环订阅",
        oneTime: "一次性"
      },
      lifetimeAccess: "您拥有终身访问权限",
      expires: "到期时间:",
      cancelingNote: "您的订阅将不会续订，并将在以下时间结束:",
      noActiveSubscription: "您当前没有有效的订阅",
      manageSubscription: "管理订阅",
      viewPlans: "查看套餐"
    },
    credits: {
      title: "积分余额",
      available: "可用积分",
      totalPurchased: "累计获得",
      totalConsumed: "累计消耗",
      recentTransactions: "最近交易",
      buyMore: "购买更多积分",
      types: {
        purchase: "充值",
        bonus: "赠送",
        consumption: "消耗",
        refund: "退款",
        adjustment: "调整"
      },
      descriptions: {
        ai_chat: "AI 对话",
        ai_image_generation: "AI 图像生成",
        ai_video_generation: "AI 视频生成",
        image_generation: "图片生成",
        document_processing: "文档处理",
        purchase: "积分充值",
        bonus: "赠送积分",
        refund: "积分退款",
        adjustment: "管理员调整"
      },
      table: {
        type: "类型",
        description: "描述",
        amount: "数量",
        time: "时间"
      }
    },
    account: {
      title: "账户信息",
      memberSince: "注册时间",
      phoneNumber: "手机号码"
    },
    orders: {
      title: "订单历史",
      status: {
        pending: "待支付",
        paid: "已支付",
        failed: "支付失败",
        refunded: "已退款",
        canceled: "已取消"
      },
      provider: {
        stripe: "Stripe",
        wechat: "微信支付",
        creem: "Creem",
        alipay: "支付宝"
      },
      noOrders: "没有找到订单",
      noOrdersDescription: "您还没有下过任何订单",
      viewAllOrders: "查看所有订单",
      orderDetails: {
        orderId: "订单ID",
        amount: "金额",
        plan: "计划",
        status: "状态",
        provider: "支付方式",
        createdAt: "创建时间"
      },
      recent: {
        title: "最近订单",
        showingRecent: "显示最近 {count} 个订单"
      },
      page: {
        title: "所有订单",
        description: "查看和管理您的所有订单",
        backToDashboard: "返回仪表盘",
        totalOrders: "共 {count} 个订单"
      }
    },
    linkedAccounts: {
      title: "关联账户",
      connected: "已连接",
      connectedAt: "关联时间:",
      noLinkedAccounts: "暂无关联账户",
      providers: {
        credential: "邮箱密码",
        google: "Google",
        github: "GitHub",
        facebook: "Facebook",
        apple: "Apple",
        discord: "Discord",
        wechat: "微信",
        "phone-number": "手机号"
      }
    },
    tabs: {
      profile: {
        title: "个人资料",
        description: "管理您的个人信息和头像"
      },
      account: {
        title: "账户管理",
        description: "密码修改、关联账户和账户安全"
      },
      security: {
        title: "安全设置",
        description: "密码和安全设置"
      },
      subscription: {
        description: "管理您的订阅计划和付费功能"
      },
      credits: {
        title: "积分",
        description: "查看积分余额和交易记录"
      },
      orders: {
        description: "查看您的订单历史和交易记录"
      },
      content: {
        profile: {
          title: "个人资料",
          subtitle: "这是您在网站上向其他人展示的信息。",
          username: {
            label: "用户名",
            value: "shadcn",
            description: "这是您的公开显示名称。可以是您的真实姓名或昵称。您只能每30天更改一次。"
          },
          email: {
            label: "邮箱",
            placeholder: "选择要显示的已验证邮箱",
            description: "您可以在邮箱设置中管理已验证的邮箱地址。"
          }
        },
        account: {
          title: "账户设置",
          subtitle: "管理您的账户设置和偏好。",
          placeholder: "账户设置内容..."
        },
        security: {
          title: "安全设置",
          subtitle: "管理您的密码和安全设置。",
          placeholder: "安全设置内容..."
        }
      }
    },
    quickActions: {
      title: "快速操作",
      editProfile: "编辑资料",
      accountSettings: "账户设置",
      subscriptionDetails: "订阅详情",
      getSupport: "获取帮助",
      viewDocumentation: "查看文档"
    },
    accountManagement: {
      title: "账户管理",
      changePassword: {
        title: "更改密码",
        description: "更新您的账户密码",
        oauthDescription: "社交登录账户无法更改密码",
        button: "更改密码",
        dialogDescription: "请输入您当前的密码并选择新密码",
        form: {
          currentPassword: "当前密码",
          currentPasswordPlaceholder: "请输入当前密码",
          newPassword: "新密码",
          newPasswordPlaceholder: "请输入新密码（至少8个字符）",
          confirmPassword: "确认新密码",
          confirmPasswordPlaceholder: "请再次输入新密码",
          cancel: "取消",
          submit: "更新密码"
        },
        success: "密码更新成功",
        errors: {
          required: "请填写所有必填字段",
          mismatch: "两次输入的新密码不一致",
          minLength: "密码长度至少为8个字符",
          failed: "密码更新失败，请重试"
        }
      },
      deleteAccount: {
        title: "删除账户",
        description: "永久删除您的账户及所有相关数据",
        button: "删除账户",
        confirmTitle: "删除账户",
        confirmDescription: "您确定要删除您的账户吗？",
        warning: "⚠️ 此操作无法撤销",
        consequences: {
          data: "您的所有个人数据将被永久删除",
          subscriptions: "活跃订阅将被取消",
          access: "您将失去所有高级功能的访问权限"
        },
        form: {
          cancel: "取消",
          confirm: "是的，删除我的账户"
        },
        success: "账户删除成功",
        errors: {
          failed: "删除账户失败，请重试"
        }
      }
    },
    roles: {
      admin: "管理员",
      user: "普通用户"
    }
  },
  premiumFeatures: {
    metadata: {
      title: "TinyShip - 高级功能",
      description: "探索您的订阅包含的所有高级功能。访问高级工具、AI 助手和增强功能。",
      keywords: "高级功能, 功能, 高级, 工具, 订阅, 权益, 增强"
    },
    title: "高级功能",
    description: "感谢您的订阅！以下是您现在可以使用的所有高级功能。",
    loading: "加载中...",
    subscription: {
      title: "您的订阅",
      description: "当前订阅状态和详细信息",
      status: "订阅状态",
      type: "订阅类型",
      expiresAt: "到期时间",
      active: "已激活",
      inactive: "未激活",
      lifetime: "终身会员",
      recurring: "周期性订阅"
    },
    badges: {
      lifetime: "终身会员"
    },
    demoNotice: {
      title: "🎯 SaaS 模板演示页面",
      description: "这是一个用于测试路由保护的演示页面。只有付费用户才能访问此页面，展示了如何在您的 SaaS 应用中实现订阅级别的访问控制。"
    },
    features: {
      userManagement: {
        title: "高级用户管理",
        description: "完整的用户档案管理和自定义设置"
      },
      aiAssistant: {
        title: "AI 智能助手",
        description: "先进的人工智能功能，提升工作效率"
      },
      documentProcessing: {
        title: "无限文档处理",
        description: "处理任意数量和大小的文档文件"
      },
      dataAnalytics: {
        title: "详细数据分析",
        description: "深入的数据分析和可视化报表"
      }
    },
    actions: {
      accessFeature: "访问功能"
    }
  },
  ai: {
    metadata: {
      title: "TinyShip - AI 助手",
      description: "与强大的 AI 模型互动，包括 GPT-4、通义千问和 DeepSeek。获得编程、写作和问题解决的 AI 帮助。",
              keywords: "AI, 助手, 聊天机器人, GPT-4, 人工智能, 机器学习, 对话"
    },
    chat: {
      title: "AI 助手",
      description: "一个大模型对话简单实现，可扩展设计，使用了最新的技术 ai-sdk / ai-elements / streamdown 实现非常丝滑的聊天效果，可以按需求扩展为更复杂的功能",
      placeholder: "需要我帮什么忙？",
      sending: "发送中...",
      thinking: "AI 正在思考...",
      noMessages: "开始与 AI 助手对话",
      welcomeMessage: "你好！我是你的 AI 助手。今天我能为你做些什么？",
      toolCall: "工具调用",
      providers: {
        title: "AI 提供商",
        openai: "OpenAI",
        qwen: "通义千问",
        deepseek: "DeepSeek"
      },
      models: {
        "gpt-5": "GPT-5",
        "gpt-5-codex": "GPT-5 Codex",
        "gpt-5-pro": "GPT-5 Pro",
        "qwen-max": "通义千问-Max",
        "qwen-plus": "通义千问-Plus", 
        "qwen-turbo": "通义千问-Turbo",
        "deepseek-chat": "DeepSeek 对话",
        "deepseek-coder": "DeepSeek 编程"
      },
      actions: {
        send: "发送",
        copy: "复制",
        copied: "已复制！",
        retry: "重试",
        dismiss: "关闭",
        newChat: "新对话",
        clearHistory: "清空历史"
      },
      errors: {
        failedToSend: "发送消息失败，请重试。",
        networkError: "网络错误，请检查网络连接。",
        invalidResponse: "AI 响应无效，请重试。",
        rateLimited: "请求过于频繁，请稍后再试。",
        subscriptionRequired: "AI 功能需要有效订阅",
        subscriptionRequiredDescription: "升级到付费计划以使用 AI 聊天功能",
        insufficientCredits: "积分不足",
        insufficientCreditsDescription: "使用 AI 聊天需要积分或订阅，请购买积分以继续使用。"
      },
      history: {
        title: "聊天记录",
        empty: "暂无聊天记录",
        today: "今天",
        yesterday: "昨天",
        thisWeek: "本周",
        older: "更早"
      }
    },
    image: {
      metadata: {
        title: "TinyShip - AI 图像生成",
        description: "使用 AI 生成精美图像。支持通义千问图像、fal.ai Flux、OpenAI DALL-E 和 Google Gemini。",
        keywords: "AI, 图像生成, DALL-E, Flux, 通义千问, Gemini, 文生图, 艺术, 创意"
      },
      title: "AI 图像生成",
      description: "使用多种 AI 提供商从文本提示生成精美图像",
      defaultPrompt: "一只黄色拉布拉多带着黑色金色圆墨镜在成都的场馆和两只黄白猫喝茶",
      prompt: "提示词",
      promptPlaceholder: "描述您想要生成的图像...",
      negativePrompt: "负面提示词",
      negativePromptPlaceholder: "描述您不希望在图像中出现的内容...",
      negativePromptHint: "描述需要避免在生成图像中出现的元素",
      generate: "生成",
      generating: "生成中...",
      generatedSuccessfully: "图像生成成功！",
      download: "下载",
      result: "结果",
      idle: "空闲",
      preview: "预览",
      json: "JSON",
      whatNext: "接下来您想做什么？",
      costInfo: "本次请求将花费",
      perMegapixel: "每百万像素",
      credits: "积分",
      providers: {
        title: "提供商",
        qwen: "阿里云百炼",
        fal: "fal.ai",
        openai: "OpenAI",
        gemini: "Google Gemini"
      },
      models: {
        "qwen-image-plus": "通义千问图像 Plus",
        "qwen-image-max": "通义千问图像 Max",
        "fal-ai/qwen-image-2512/lora": "Qwen Image 2512 Lora",
        "fal-ai/nano-banana-pro": "Nano Banana Pro",
        "fal-ai/flux/dev": "Flux Dev",
        "fal-ai/recraft/v3/text-to-image": "Recraft V3 Text to Image",
        "fal-ai/flux-pro/kontext": "Flux Pro Kontext",
        "fal-ai/bytedance/seedream/v3/text-to-image": "Bytedance Seedream V3 Text to Image",
        "dall-e-3": "DALL-E 3",
        "dall-e-2": "DALL-E 2",
        "gemini-3.1-flash-image-preview": "Nano Banana 2",
        "gemini-3-pro-image-preview": "Nano Banana Pro",
        "gemini-2.5-flash-image": "Nano Banana"
      },
      settings: {
        title: "附加设置",
        showMore: "更多",
        showLess: "收起",
        imageSize: "图像尺寸",
        imageSizeHint: "选择宽高比和分辨率",
        numInferenceSteps: "推理步数",
        numInferenceStepsHint: "步数越多质量越高，但速度越慢",
        guidanceScale: "引导强度",
        guidanceScaleHint: "控制生成图像与提示词的匹配程度",
        seed: "种子",
        seedHint: "使用相同的种子可以复现结果",
        random: "随机",
        randomize: "随机生成",
        promptExtend: "提示词扩展",
        promptExtendHint: "AI 将增强和扩展您的提示词",
        watermark: "水印",
        watermarkHint: "在生成的图像上添加通义千问水印",
        syncMode: "同步模式",
        syncModeHint: "返回 base64 数据而非 URL"
      },
      errors: {
        generationFailed: "图像生成失败",
        invalidPrompt: "请输入有效的提示词",
        insufficientCredits: "积分不足",
        insufficientCreditsDescription: "生成图像需要积分，请购买积分以继续。",
        networkError: "网络错误，请检查您的连接。",
        unknownError: "发生未知错误"
      }
    },
    video: {
      metadata: {
        title: "TinyShip - AI 视频生成",
        description: "使用 AI 生成精彩视频。支持 fal.ai、火山引擎 Seedance 和阿里云万象。",
        keywords: "AI, 视频生成, 文生视频, Seedance, 万象, Luma, 创意"
      },
      title: "AI 视频生成",
      description: "使用多种 AI 提供商从文本提示生成精彩视频",
      defaultPrompt: "猫猫从腿上直接跳跃到沙发上",
      prompt: "提示词",
      model: "模型",
      promptPlaceholder: "描述您想要生成的视频...",
      generate: "生成视频",
      generating: "视频生成中...",
      generatedSuccessfully: "视频生成成功！",
      download: "下载视频",
      result: "结果",
      idle: "输入提示词以生成视频",
      whatNext: "接下来您想做什么？",
      credits: "积分",
      providers: {
        title: "提供商",
        fal: "fal.ai",
        volcengine: "火山引擎",
        aliyun: "阿里云万象"
      },
      models: {
        "kling-video/v2.5-turbo/pro/text-to-video": "Kling 2.5 Turbo Pro 文生视频",
        "kling-video/v2.5-turbo/pro/image-to-video": "Kling 2.5 Turbo Pro 图生视频",
        "doubao-seedance-1-5-pro-251215": "豆包 Seedance 1.5 Pro",
        "doubao-seedance-1-0-pro-250528": "豆包 Seedance 1.0 Pro",
        "wan2.6-t2v": "万象 2.6 文生视频",
        "wan2.5-t2v-turbo": "万象 2.5 文生视频 Turbo",
        "wan2.6-i2v-flash": "万象 2.6 图生视频 Flash"
      },
      inputMode: {
        label: "生成模式",
        text: "文生视频",
        firstFrame: "首帧",
        firstLastFrame: "首尾帧",
        firstLastFrameUnsupported: "当前提供商仅支持首帧"
      },
      frameInput: {
        title: "帧图输入",
        hint: "可直接填写 URL，或上传到 Cloudflare R2。",
        firstFrameUrl: "首帧 URL",
        lastFrameUrl: "尾帧 URL",
        upload: "上传",
        uploadedToR2: "帧图已上传到 R2",
        preview: "图片预览",
        previewAlt: "首帧预览"
      },
      settings: {
        title: "高级设置",
        videoSize: "视频尺寸 / 宽高比",
        videoSizePlaceholder: "选择尺寸",
        videoSizeHint: "选择分辨率或宽高比",
        duration: "时长（秒）",
        durationHint: "生成视频的长度",
        seed: "种子",
        seedHint: "使用相同种子可以复现结果",
        random: "随机",
        loop: "循环",
        loopHint: "视频是否无缝循环播放",
        motionStrength: "运动强度",
        motionStrengthHint: "控制视频中运动的幅度",
        promptExtend: "提示词扩展",
        promptExtendHint: "AI 将自动增强和扩展您的提示词",
        watermark: "水印",
        watermarkHint: "在生成的视频上添加水印"
      },
      errors: {
        generationFailed: "视频生成失败",
        invalidPrompt: "请输入有效的提示词",
        firstFrameRequired: "请先提供首帧 URL",
        lastFrameRequired: "请先提供尾帧 URL",
        unsupportedImageType: "仅支持 JPEG/JPG/PNG/WEBP/BMP 图像",
        imageTooLarge: "图像大小不能超过 10MB",
        uploadFailed: "上传失败",
        unsupportedModeForProvider: "当前提供商不支持此生成模式",
        insufficientCredits: "积分不足",
        insufficientCreditsDescription: "生成视频需要积分，请购买积分以继续。",
        networkError: "网络错误，请检查您的连接。",
        unknownError: "发生未知错误",
        timeout: "视频生成超时，请重试。"
      },
      resultPanel: {
        generatingHint: "视频生成通常需要 1-5 分钟...",
        videoTagUnsupported: "您的浏览器不支持 video 标签。"
      }
    }
  },
  home: {
    metadata: {
      title: "TinyShip - 现代化全栈 SaaS 开发启动器",
      description: "现代化、功能齐全的 monorepo 启动套件，用于构建支持国内外双市场的 SaaS 应用程序。基于 Next.js/Nuxt.js、TypeScript 和完整认证系统构建。",
      keywords: "SaaS, monorepo, 启动套件, Next.js, Nuxt.js, TypeScript, 认证, 国际化, 中国市场, 国际市场"
    },
    hero: {
      title: "虽然是小船，也能载你远航",
      titlePrefix: "虽然是",
      titleHighlight: "小船",
      titleSuffix: "，也能载你远航",
      subtitle: "现代化全栈 SaaS 开发平台，支持国内外双市场。一次购买，终身使用，快速构建你的商业项目。",
      buttons: {
        purchase: "立即购买",
        demo: "查看演示"
      },
      features: {
        lifetime: "一次购买终身使用",
        earlyBird: "早鸟价限时优惠"
      }
    },
    features: {
      title: "全栈 SaaS 开发平台",
      subtitle: "从三框架支持到 AI 集成，从全球化到本土化，TinyShip 为你的商业项目提供完整的现代化技术解决方案。",
      items: [
        {
          title: "三框架支持",
          description: "灵活选择 Next.js、Nuxt.js 或 TanStack Start，React 和 Vue 开发者都能找到熟悉的技术栈，同时享受相同的强大后端能力。",
          className: "col-span-1 row-span-1"
        },
        {
          title: "全面身份认证",
          description: "基于 Better-Auth 的企业级认证系统，支持邮箱/手机/OAuth 登录，2FA 多因子认证，会话管理等完整认证体系。",
          className: "col-span-1 row-span-1"
        },
        {
          title: "全球化 + 本土化",
          description: "既支持国际市场的 Stripe、OAuth 登录，也深度适配中国本土市场的微信登录、微信支付，双市场无缝覆盖。",
          className: "col-span-2 row-span-1"
        },
        {
          title: "现代化技术栈",
          description: "采用最新技术：TailwindCSS v4、shadcn/ui、Magic UI、TypeScript、Zod 类型安全验证，开发体验极佳。",
          className: "col-span-1 row-span-1"
        },
        {
          title: "无厂商锁定架构",
          description: "开放式 Monorepo 架构，libs 抽象接口设计，可自由选择任何云服务商、数据库、支付提供商，避免技术绑定。",
          className: "col-span-2 row-span-1"
        },
        {
          title: "通信服务集成",
          description: "多渠道通信支持：邮件服务（Resend/SendGrid）、短信服务（阿里云/Twilio），全球化通信无障碍。",
          className: "col-span-1 row-span-1"
        },
        {
          title: "AI 开发就绪",
          description: "集成 Vercel AI SDK，支持多 AI 提供商，内置 Cursor 开发规则，AI 辅助开发，智能化构建应用。",
          className: "col-span-1 row-span-1"
        },
        {
          title: "主题系统",
          description: "基于 shadcn/ui 的现代化主题系统，支持暗黑模式，深度定制和品牌化，让应用拥有独特视觉体验。",
          className: "col-span-1 row-span-1"
        }
      ],
      techStack: {
        title: "基于现代化技术栈构建",
        items: [
          "Next.js / Nuxt.js / TanStack Start",
          "TailwindCSS v4",
          "Better-Auth",
          "Vercel AI SDK",
          "TypeScript + Zod",
          "shadcn/ui + Magic UI",
          "Drizzle ORM + PostgreSQL"
        ]
      }
    },
    applicationFeatures: {
      title: "核心应用特性",
      subtitle: "从国内外双体系支持到 AI 集成，TinyShip 为你的商业项目提供完整的技术解决方案。",
      items: [
        {
          title: "国内外双体系支持",
          subtitle: "一套代码，双市场覆盖",
          description: "完美适配国内外不同市场需求。国内支持微信登录、手机号登录、微信支付、支付宝等本土化功能；国外支持主流 OAuth 登录（Google、GitHub、Apple）、Stripe、Creem 和 PayPal 支付体系。一套代码，双市场覆盖。",
          highlights: [
            "微信登录、手机号登录",
            "OAuth 登录（Google、GitHub、Apple）",
            "国内支付：微信支付、支付宝",
            "国际支付：Stripe、Creem、PayPal",
          ],
          imageTitle: "双体系架构"
        },
        {
          title: "三框架支持",
          subtitle: "Next.js、Nuxt.js 和 TanStack Start — 自由选择技术栈",
          description: "业界首个同时支持三大框架的 SaaS 模版。React 开发者可选择 Next.js 或 TanStack Start，Vue 开发者使用 Nuxt.js —— 各框架独立实现后端路由，通过 Monorepo 架构共享 libs 层（数据库、认证、支付、AI 等核心逻辑），切换框架无需重写业务代码。",
          highlights: [
            "Next.js（React, App Router）",
            "Nuxt.js（Vue, Nitro）",
            "TanStack Start（React, Vite）",
            "共享 libs 核心逻辑层"
          ],
          imageTitle: "三框架架构"
        },
        {
          title: "内置 Admin Panel",
          subtitle: "企业级管理后台，开箱即用",
          description: "开箱即用的管理后台，提供轻量级的用户管理、订阅管理、订单管理等功能。基于现代化 UI 组件库构建，支持角色权限控制、实时数据监控等功能。让你专注于业务逻辑，而非重复的管理界面开发。",
          highlights: [
            "用户管理",
            "订阅管理",
            "角色权限控制",
            "订单管理"
          ],
          imageTitle: "管理后台"
        },
        {
          title: "AI Ready 集成",
          subtitle: "对话、图像、视频 — 开箱即用的全栈 AI 能力",
          description: "基于 Vercel AI SDK 构建的完整 AI 解决方案。不只是简单的聊天 Demo —— 内置 AI 对话、AI 图像生成、AI 视频生成，均采用多 Provider 可扩展架构。支持流式响应、积分计费、多模型切换（OpenAI、Claude、Gemini 等），让你的应用从第一天起就具备完整的 AI 能力。",
          highlights: [
            "AI 对话（多模型流式响应）",
            "AI 图像生成（多 Provider）",
            "AI 视频生成（多 Provider）",
            "积分计费系统"
          ],
          imageTitle: "AI 集成"
        }
      ]
    },
    stats: {
      title: "值得信赖的选择",
      items: [
        {
          value: "10000",
          suffix: "+",
          label: "用户选择"
        },
        {
          value: "3",
          suffix: "",
          label: "前端框架支持"
        },
        {
          value: "50",
          suffix: "+",
          label: "内置功能模块"
        },
        {
          value: "99",
          suffix: "%",
          label: "用户满意度"
        }
      ]
    },
    testimonials: {
      title: "用户真实反馈",
      items: [
        {
          quote: "早鸟价太值了！完整的源码和终身更新，帮我快速搭建了自己的 SaaS 项目，一个月就回本了。",
          author: "张伟",
          role: "独立开发者"
        },
        {
          quote: "技术支持很给力，遇到问题都能快速解决。三框架支持让团队可以选择熟悉的技术栈。",
          author: "李小明",
          role: "创业公司 CTO"
        },
        {
          quote: "出海功能特别实用，国际化和支付都配置好了，省了我们大量的开发时间。",
          author: "王芳",
          role: "产品经理"
        }
      ]
    },
    finalCta: {
      title: "准备好开始你的远航了吗？",
      subtitle: "加入数千名用户的行列，用 TinyShip 快速构建你的下一个商业项目。虽然是小船，但足以载你驶向成功的彼岸。早鸟价仅限前 100 名用户！",
      buttons: {
        purchase: "立即抢购 ¥299",
        demo: "查看演示"
      }
    },
    footer: {
      copyright: "© {year} TinyShip. All rights reserved.",
      description: "TinyShip"
    },
    common: {
      demoInterface: "功能演示界面",
      techArchitecture: "企业级技术架构，生产环境验证",
      learnMore: "了解更多"
    }
  },
  validators: {
    user: {
      name: {
        minLength: "姓名至少需要{min}个字符",
        maxLength: "姓名不能超过{max}个字符"
      },
      email: {
        invalid: "请输入有效的邮箱地址"
      },
      image: {
        invalidUrl: "请输入有效的链接地址"
      },
      password: {
        minLength: "密码至少需要{min}个字符",
        maxLength: "密码不能超过{max}个字符",
        mismatch: "两次输入的密码不一致"
      },
      countryCode: {
        required: "请选择国家/地区"
      },
      phoneNumber: {
        required: "请输入手机号",
        invalid: "手机号格式不正确"
      },
      verificationCode: {
        invalidLength: "验证码必须是{length}位数字"
      },
      id: {
        required: "用户ID不能为空"
      },
      currentPassword: {
        required: "请输入当前密码"
      },
      confirmPassword: {
        required: "请确认密码"
      },
      deleteAccount: {
        confirmRequired: "您必须确认删除账户"
      }
    },
    blog: {
      title: {
        required: "标题不能为空",
        maxLength: "标题不能超过 {max} 个字符",
      },
      slug: {
        maxLength: "Slug 不能超过 {max} 个字符",
        invalid: "Slug 只能包含小写字母、数字和连字符",
      },
      excerpt: {
        maxLength: "摘要不能超过 {max} 个字符",
      },
      coverImage: {
        invalidUrl: "请输入有效的封面图片 URL",
      },
      status: {
        invalid: "状态必须是草稿或已发布",
      },
    },
  },
  countries: {
    china: "中国",
    usa: "美国", 
    uk: "英国",
    japan: "日本",
    korea: "韩国",
    singapore: "新加坡",
    hongkong: "香港",
    macau: "澳门",
    australia: "澳大利亚",
    france: "法国",
    germany: "德国",
    india: "印度",
    malaysia: "马来西亚",
    thailand: "泰国"
  },
  header: {
    navigation: {
      ai: "AI 功能演示",
      premiumFeatures: "高级会员功能",
      pricing: "定价",
      upload: "文件上传",
      demos: "功能演示",
      demosDescription: "探索示例功能",
      blog: "博客"
    },
    demos: {
      ai: {
        title: "AI 对话",
        description: "大模型对话实现，可扩展设计，支持多个 Provider，需要购买积分使用"
      },
      aiImage: {
        title: "AI 图像生成",
        description: "AI 图像生成实现，可扩展设计，支持多个 Provider，需要购买积分使用"
      },
      aiVideo: {
        title: "AI 视频生成",
        description: "AI 视频生成实现，可扩展设计，支持多个 Provider，需要购买积分使用"
      },
      premium: {
        title: "高级会员功能",
        description: "路由保护演示页面，只有订阅付费用户才能访问此页面"
      },
      upload: {
        title: "文件上传",
        description: "文件上传实现，可扩展设计，支持多个 Provider，需要登录访问"
      }
    },
    auth: {
      signIn: "登录",
      getStarted: "开始使用",
      signOut: "退出登录"
    },
    userMenu: {
      dashboard: "控制台",
      profile: "个人资料",
      settings: "设置",
      personalSettings: "个人设置",
      adminPanel: "管理后台"
    },
    language: {
      switchLanguage: "切换语言",
      english: "English",
      chinese: "中文",
      korean: "한국어"
    },
    mobile: {
      themeSettings: "主题设置",
      languageSelection: "语言选择"
    }
  },
  docs: {
    home: {
      title: "TinyShip Docs",
      subtitle: "基于 Fumadocs 构建",
      description: "基于 Fumadocs 的静态站点项目，适用于文档、博客和静态页面。",
      cta: {
        docs: "阅读文档",
        blog: "访问博客"
      }
    },
    nav: {
      sources: "数据源",
      queries: "筛选方案",
      docs: "文档",
      blog: "博客"
    },
    blog: {
      title: "博客",
      description: "来自 TinyShip 团队的最新文章和动态",
      allPosts: "所有文章",
      previousPage: "← 上一页",
      nextPage: "下一页 →",
      back: "← 返回博客",
      noPosts: "暂无文章"
    }
  },
  upload: {
    title: "上传文件",
    description: "上传图片到云存储",
    providerTitle: "存储服务商",
    providerDescription: "选择您偏好的云存储服务商",
    providers: {
      oss: "阿里云 OSS",
      ossDescription: "国内优化存储",
      s3: "Amazon S3",
      s3Description: "全球云存储",
      r2: "Cloudflare R2",
      r2Description: "零出口费用",
      cos: "腾讯云 COS",
      cosDescription: "国内云存储"
    },
    uploadTitle: "上传图片",
    uploadDescription: "拖拽图片或点击浏览。最大 1MB。",
    dragDrop: "拖拽文件到这里",
    orClick: "或点击浏览（最大 1MB）",
    browseFiles: "浏览文件",
    clearAll: "清除全部",
    uploadedTitle: "已上传文件",
    uploadedDescription: "成功上传 {count} 个文件",
    uploading: "上传中...",
    viewFile: "查看",
    uploaded: "已上传",
    errors: {
      maxFiles: "只能上传 1 个文件",
      imageOnly: "只允许上传图片文件",
      fileTooLarge: "文件大小必须小于 1MB"
    }
  },
  blog: {
    metadata: {
      title: "TinyShip - 博客",
      description: "阅读 TinyShip 团队的最新文章和动态。",
      keywords: "博客, 文章, 动态, TinyShip, SaaS"
    },
    title: "博客",
    subtitle: "最新文章和动态",
    readMore: "阅读更多",
    publishedOn: "发布于",
    by: "作者",
    noPosts: "暂无文章，请稍后再来！",
    backToBlog: "返回博客"
  },
  kcs: {
    metric: {
      followers: "粉丝数",
      followerGrowth: "近期涨粉",
      followerGrowthRate: "涨粉率",
      readFanRatio: "阅读粉丝占比",
      activeFanRatio: "活跃粉丝占比",
      engagedFanRatio: "互动粉丝占比",
      impressionMedian: "曝光中位数",
      readMedian: "阅读中位数",
      interactionMedian: "互动中位数",
      likeMedian: "点赞中位数",
      collectMedian: "收藏中位数",
      commentMedian: "评论中位数",
      coopReadMedian: "合作阅读中位数",
      coopInteractionMedian: "合作互动中位数",
      engagementRate: "互动率",
      retentionRate: "3S 阅读率",
      noteCount: "发文数",
      viralCount: "爆文数",
      viralRate: "爆文率",
      priceImage: "图文报价",
      priceVideo: "视频报价",
      cpv: "阅读成本",
      cpe: "CPE",
      cpm: "CPM",
      collectLikeRatio: "收藏 / 点赞",
      purchaseIntentCommentRatio: "求购评论占比",
      trafficSearchRatio: "搜索流量占比",
      trafficRecommendRatio: "推荐流量占比",
      trafficFollowRatio: "关注流量占比",
      readToFollowerRatio: "读粉比",
      authenticity: "粉丝真实度",
      coopNoteCount: "合作笔记数"
    },
    metricHelp: {
      followers: "平台展示的累计粉丝数。",
      followerGrowth: "统计窗口内新增粉丝数。",
      followerGrowthRate: "新增粉丝 / 期初粉丝。",
      readFanRatio: "笔记阅读中来自粉丝的比例，越低说明公域流量越强。",
      activeFanRatio: "近 30 日有活跃行为的粉丝比例。",
      engagedFanRatio: "近 30 日与博主笔记有赞藏评的粉丝比例。",
      impressionMedian: "窗口内笔记曝光量的中位数（自然流量）。",
      readMedian: "窗口内日常笔记阅读量的中位数（自然流量）。",
      interactionMedian: "窗口内笔记赞藏评之和的中位数。",
      likeMedian: "窗口内笔记点赞数的中位数。",
      collectMedian: "窗口内笔记收藏数的中位数。收藏代表更深的购买意向。",
      commentMedian: "窗口内笔记评论数的中位数。",
      coopReadMedian: "报备合作笔记的阅读中位数。",
      coopInteractionMedian: "报备合作笔记的互动中位数。",
      engagementRate: "互动中位数 / 阅读中位数。按阅读算，不按粉丝算。",
      retentionRate: "图文 3 秒阅读率或视频 5 秒播放率。",
      noteCount: "窗口内发布的笔记数。",
      viralCount: "窗口内爆文数（12 小时点赞 ≥ 1000 或累计 ≥ 5000）。",
      viralRate: "爆文数 / 发文数。",
      priceImage: "图文笔记报价（人民币）。",
      priceVideo: "视频笔记报价（人民币）。",
      cpv: "报价 / 合作阅读中位数，每个阅读花多少钱。",
      cpe: "报价 / 合作互动中位数，每个互动花多少钱。实操口径 ≤ 3 为可接受。",
      cpm: "报价 / 阅读中位数 × 1000，千次阅读成本。",
      collectLikeRatio: "收藏中位数 / 点赞中位数。收藏多于点赞，种草后劲足。",
      purchaseIntentCommentRatio: "评论中「求链接、怎么买、多少钱、已下单」的比例。",
      trafficSearchRatio: "阅读来自搜索的比例，越高越有长尾转化。",
      trafficRecommendRatio: "阅读来自推荐流的比例，越高爆发力越强。",
      trafficFollowRatio: "阅读来自关注页的比例。",
      readToFollowerRatio: "阅读中位数 / 粉丝数。低粉高读说明算法在推。",
      authenticity: "第三方抽样得出的真实粉丝比例。",
      coopNoteCount: "历史报备合作笔记数。"
    },
    metricGroup: {
      scale: "规模",
      reach: "传播",
      cost: "成本",
      conversion: "转化",
      potential: "潜力",
      trust: "真实性"
    },
    tier: {
      label: "量级",
      head: "头部",
      mid: "腰部",
      junior: "初级",
      amateur: "素人",
      unknown: "未知",
      hint: "头部 > 50 万 · 腰部 5 – 50 万 · 初级 5 千 – 5 万 · 素人 300 – 5 千"
    },
    health: {
      label: "健康等级",
      excellent: "优秀",
      normal: "普通",
      abnormal: "异常",
      unknown: "未评级",
      hint: "蒲公英每月 1 日更新。异常不可合作，普通不建议。"
    },
    band: {
      top10: "同量级前 10%",
      top25: "同量级前 25%",
      upper: "同量级中上",
      lower: "同量级中下",
      bottom: "同量级后 25%",
      none: "样本不足"
    },
    source: {
      label: "数据源",
      pugongying: "蒲公英",
      qiangua: "千瓜",
      xinhong: "新红",
      official: "官方",
      vendor: "第三方",
      fixture: "样例数据",
      live: "实时数据",
      configured: "已配置凭证",
      notConfigured: "未配置凭证",
      fetchedAt: "抓取时间",
      locked: "发布时快照"
    },
    query: {
      title: "筛选方案",
      lead: "方案就是一组条件：量级、健康等级、指标阈值和排序。保存后全队复用。",
      new: "新建方案",
      unsaved: "未保存方案",
      name: "方案名称",
      namePlaceholder: "例如：韩妆性价比",
      save: "保存方案",
      saveAs: "另存为",
      delete: "删除方案",
      run: "运行",
      editor: "方案编辑",
      apply: "应用",
      reset: "重置",
      close: "收起",
      filters: "指标条件",
      addFilter: "添加条件",
      removeFilter: "移除",
      noFilters: "还没有指标条件，只按量级与健康等级过滤。",
      op: { gte: "≥", lte: "≤", between: "区间", percentileGte: "同量级分位 ≥" },
      value: "数值",
      from: "从",
      to: "到",
      sort: "排序",
      asc: "升序",
      desc: "降序",
      columns: "显示列",
      highlights: "高亮阈值",
      tone: { good: "优", warn: "注意", bad: "差" },
      tiers: "量级",
      health: "健康等级",
      sources: "数据源",
      anyTier: "全部量级",
      anyHealth: "不限",
      matched: "命中 {n} 位",
      noResult: "没有达人满足当前方案",
      version: "v{n}",
      saved: "已保存",
      deleted: "已删除",
      confirmDelete: "确认删除该方案？",
      errors: {
        "name.required": "请填写方案名称",
        "filters.between": "区间下限不能大于上限",
        "filters.value": "条件数值无效",
        "filters.percentile": "分位数需在 0 – 100 之间",
        "columns": "至少显示一列"
      }
    },
    ingest: {
      title: "数据源",
      lead: "系统本质是一只有参数的爬虫：填好参数，从平台拉回 JSON，经转换层落成统一字段。",
      adapters: "适配器",
      route: "路线",
      supports: "支持参数",
      provides: "可提供字段",
      credentials: "凭证变量",
      fetchTitle: "新建抓取任务",
      params: "抓取参数",
      source: "数据源",
      window: "统计窗口",
      window30: "近 30 天",
      window90: "近 90 天",
      keyword: "关键词",
      keywordPlaceholder: "韩妆 / 护肤 / 穿搭",
      category: "类目",
      region: "地域",
      followersRange: "粉丝区间",
      priceRange: "报价区间",
      health: "健康等级",
      limit: "抓取数量",
      run: "开始抓取",
      running: "抓取中…",
      done: "抓取完成：写入 {written}，跳过 {skipped}，失败 {failed}",
      fixtureNote: "该数据源未配置凭证，任务将返回样例数据，用于验证字段映射。",
      jobs: "抓取记录",
      jobSource: "数据源",
      jobMode: "模式",
      jobQuery: "参数",
      jobWritten: "写入",
      jobSkipped: "跳过",
      jobFailed: "失败",
      jobTime: "时间",
      noJobs: "还没有抓取记录",
      rawTitle: "原始返回",
      rawLead: "平台返回的 JSON 原样保存，用于核对映射。",
      transform: "转换层",
      transformLead: "每个来源一张字段映射表，改映射不改代码。"
    },
    landing: {
      navWorkspaces: "工作台",
      navFlow: "流程",
      navScoring: "数据",
      previewTitle: "达人库",
      previewMeta: "已发布 · 按 CPE 升序",
      previewCols: { creator: "达人", tier: "量级", cpe: "CPE", fans: "粉丝" },
      workspacesEyebrow: "工作台",
      workspacesTitle: "三张工作台，同一条水线。",
      workspacesLead: "录入的人建档，选人的人挑库，运维的人盯着任务。各看各的，数据只有一份。",
      flowEyebrow: "流程",
      flowTitle: "从一条线索，到一份能交的名单。",
      steps: [
        { title: "建档", body: "录入显示名、粉丝、报价、合作记录，存成草稿。" },
        { title: "抓取", body: "填参数，从蒲公英 / 千瓜 / 新红拉回博主 JSON，转换层落成统一字段。" },
        { title: "分配", body: "选人在库里筛、排、勾，一键分到项目。" },
        { title: "监测", body: "拉数任务的排队、失败、重试，一眼看全。" }
      ],
      dataEyebrow: "数据",
      dataTitle: "平台给什么，我们就看什么。",
      dataLead: "不做加权公式。每个字段都能在蒲公英、千瓜、新红的后台找到出处，派生指标只是除法。好坏只在同一粉丝量级里比分位。",
      sourcesTitle: "三条数据源，一层转换",
      sources: {
        pugongying: { label: "蒲公英 · 官方", body: "阅读 / 互动 / 曝光中位数、互动率、阅读粉丝占比、报价、CPE、健康等级、粉丝画像、合作历史。" },
        qiangua: { label: "千瓜 · 第三方", body: "千瓜指数、近 90 天爆文、发文频率、涨粉、粉丝真实度、预估报价与 CPE / CPM。" },
        xinhong: { label: "新红 · 第三方", body: "投放分析中的图文 / 视频 CPE、CPM、新红指数与流量结构。" }
      },
      groupsTitle: "六组字段",
      groups: {
        scale: "粉丝数、涨粉、阅读粉丝占比",
        reach: "阅读 / 互动 / 曝光中位数、互动率、3S 阅读率",
        cost: "图文 / 视频报价、阅读成本、CPE、CPM",
        conversion: "收藏 / 点赞、求购评论占比、搜索流量占比",
        potential: "读粉比、爆文率、推荐流量占比、涨粉率",
        trust: "健康等级、粉丝真实度、活跃 / 互动粉丝占比"
      },
      tierTitle: "同量级比",
      tierBody: "头部 > 50 万，腰部 5 – 50 万，初级 5 千 – 5 万，素人 300 – 5 千。分位只在同一档里算。",
      gateTitle: "健康等级是门",
      gateBody: "蒲公英健康等级异常直接排除，普通不建议合作。不参与任何加权。",
      transformTitle: "转换层",
      transformBody: "每个来源一张字段映射表，原始 JSON 原样保存。改映射不改代码。",
      values: [
        { title: "不发明分数", body: "平台给什么指标就看什么指标，好坏只在同量级里比分位。" },
        { title: "只发布一次", body: "发布即锁定当时的指标快照，页面改不了，名单才站得住。" },
        { title: "按角色开门", body: "录入、选人、监测各自进各自的门，权限在服务端。" }
      ],
      ctaTitle: "潮水已经在动了。",
      ctaLead: "用工作邮箱登录，按角色进入对应工作台。",
      footerLinks: "工作台",
      footerNote: "听潮 · 全球达人情报系统"
    },
    brand: {
      title: "听潮",
      short: "听潮",
      name: "听潮",
      tagline: "听见影响力的下一次潮起。",
      story: "世界从不会先给出答案，它总是先泛起一点声音。一条短视频、一次评论、一个刚被看见的创作者，最初都像远海里的一点涟漪。听潮，不追逐喧哗；我们倾听正在发生的改变。",
      eyebrow: "全球达人情报系统",
      pillars: "录入 · 选人 · 监测",
      loginAside: "一个账号，按角色进入对应工作台。",
      storyExcerpt: "世界从不会先给出答案，它总是先泛起一点声音。",
      runLabel: "选人，分到项目。"
    },
    nav: {
      overview: "总览",
      creators: "达人",
      reviews: "风险复核",
      workspaces: "工作区",
      ops: "录入",
      select: "选人",
      monitor: "监测",
      ingest: "拉数"
    },
    actions: {
      login: "登录",
      filter: "筛选",
      sort: "排序",
      assign: "分配",
      publish: "发布",
      export: "导出"
    },
    categories: {
      collaborated: "合作过的",
      neverCollaborated: "没合作过的"
    },
    states: {
      empty: "潮水还没到这一岸。",
      emptyFilter: "这组条件里，没有人上岸。",
      error: "潮声断了一下。再试一次。",
      denied: "进不去",
      deniedBody: "这扇门，此刻不对你开。"
    },
    roles: {
      platform_admin: "平台管理员",
      ops: "运营录入",
      devops: "运维监测",
      selector: "选人",
      selector_viewer: "选人（只读）"
    },
    panel: {
      audience: "粉丝画像",
      female: "女性占比",
      regions: "地域分布",
      interests: "兴趣分布",
      noAudience: "该数据源未提供粉丝画像",
      collabBrands: "合作品牌",
      chooseImage: "选择图片",
      imageHint: "PNG / JPG，建议正方形。",
      stepSaveHint: "填好显示名就能保存草稿。",
      learnMore: "了解工作台",
      mobileHint: "横屏或换到桌面查看完整表格。",
      showAll: "查看全部",
      clearFilters: "清除筛选",
      signOut: "退出登录",
      kpiHint: "以当前库为准",
      openRate: "清洗率",
      today: "今天",
      overview: "总览",
      quickActions: "快捷入口",
      recentActivity: "最近动态",
      jobDistribution: "任务状态分布",
      untitled: "未命名",
      preview: "预览",
      formHint: "保存后生成达人 key 与草稿状态；发布前分数已锁定。",
      publishHint: "先保存草稿，再发布到达人库。",
      published: "已进入达人库",
      stepSave: "保存草稿",
      stepPublish: "发布",
      required: "必填",
      optional: "可选",
      xhsId: "小红书 ID",
      collabQuestion: "是否合作过",
      unknownFollowers: "粉丝未知",
      followersRange: "粉丝区间",
      priceRange: "报价区间",
      min: "最低",
      max: "最高",
      collabFilter: "合作记录",
      collabAny: "不限",
      collabYes: "合作过",
      collabNo: "没合作过",
      sortRating: "综合分",
      sortHint: "按{field}排序",
      members: "达人数",
      count: "数量",
      sources: "数据源",
      batch: "批次",
      poolLead: "只看已发布、未拉黑的达人；分数与等级来自规则包，换语言不重算。",
      assignTo: "分配到「{name}」",
      assignHint: "要把人分进项目，先从项目页点「从库里选」进来。",
      picked: "已选 {n} 人",
      back: "返回",
      noAssignments: "项目上还没有人。从库里选几位进来。",
      emptyProjects: "还没有项目。先建一个。",
      loading: "潮水在来的路上……",
      jobStatus: {
        ok: "完成",
        running: "进行中",
        queued: "排队中",
        failed: "失败",
        partial: "部分完成"
      },
      assignmentStatus: {
        assigned: "已分配",
        removed: "已移除"
      },
      signIn: "登录",
      signInLead: "用工作邮箱登录，按角色进入对应工作台。",
      email: "邮箱",
      password: "密码",
      enter: "进入",
      loginError: "邮箱或口令对不上。再试一次。",
      homeLead: "不必等浪潮抵岸。录入、选人、监测，都在同一片水声里。",
      opsDesc: "建档、分类，再放到达人库里。",
      selectDesc: "开项目、筛库、把人分过去。",
      devDesc: "看任务还活着没有。",
      openOps: "去录入",
      openSelect: "去选人",
      openDev: "去监测",
      denied: "进不去",
      deniedBody: "这扇门，此刻不对你开。",
      opsHome: "录入",
      createCreator: "录入达人",
      newCreator: "达人入档",
      displayName: "显示名",
      followers: "粉丝",
      quote: "报价",
      avatar: "头像",
      save: "保存",
      publish: "发布",
      confirmPublish: "确认发布",
      collaborated: "合作过的",
      neverCollaborated: "没合作过的",
      scoreLocked: "分数锁着。页面改不了。",
      draft: "草稿",
      review: "待复核",
      ready: "已清洗",
      released: "已发布",
      status: "状态",
      recentBatches: "最近批次",
      emptyBatches: "还没有一批进来。",
      projects: "项目",
      createProject: "新建项目",
      projectName: "项目名",
      note: "备注",
      board: "项目上的人",
      openLibrary: "从库里选",
      pool: "达人库",
      emptyPool: "潮水还没到这一岸。",
      emptyFilter: "这组条件里，没有人上岸。",
      filter: "筛选",
      sort: "排序",
      export: "导出",
      error: "潮声断了一下。再试一次。",
      retry: "再试一次",
      assign: "分配",
      confirmAssign: "确认分配",
      health: "监测",
      sqlOk: "库连得上",
      jobs: "任务",
      detail: "详情",
      addToProject: "加入项目",
      chooseProject: "选择项目",
      failures: "失败",
      pipeline: "管道",
      recommended: "推荐",
      library: "选人库",
      sampleData: "IMOK 样例",
      rulePack: "规则包",
      visibleFields: "可见字段",
      weights: "权重",
      defaultSort: "默认排序",
      advice: "建议",
      contact: "对接",
      koreaRelation: "韩国关系",
      risk: "风险",
      conclusion: "结论",
      org: "公司",
      gallery: "相册",
      readOnly: "只读"
    },
    prefs: {
      currency: "货币",
      consentTitle: "Cookie 偏好",
      consentBody: "必要 cookie 维持登录与安全；偏好 cookie 记住语言、货币与外观。拒绝偏好也能正常登录。",
      consentNecessary: "仅必要",
      consentPreferences: "允许偏好",
      demo: "演示数据"
    },
    toolbar: {
      language: "语言",
      theme: "外观",
      themeLight: "浅色",
      themeDark: "深色",
      themeSystem: "跟着系统",
      ruleFirst: "规则排潮序。AI 辨风险。人来确认。"
    },
    overview: {
      eyebrow: "筛选",
      title: "这一批，按规则排岸",
      lead: "分数、等级、排名只来自规则。AI 和人都不写回这三项。",
      statCreators: "达人",
      statTop50: "进入风险复核",
      statRecommend: "AI 推荐",
      statCautious: "AI 谨慎",
      statReject: "AI 不建议",
      gradeMix: "等级分布",
      nextAction: "打开名单",
      emptyTitle: "还没有潮序",
      emptyBody: "表进来以后，规则才会把人排上岸。"
    },
    creators: {
      eyebrow: "名单",
      title: "达人",
      lead: "排名是规则的顺序。昵称和小红书号保持原文。",
      search: "筛昵称或账号",
      emptyTitle: "没有对上的人",
      emptyBody: "放下筛选，完整排名就在。",
      cols: {
        rank: "排名",
        creator: "达人",
        score: "分数",
        grade: "等级",
        fans: "粉丝",
        ai: "风险复核",
        manual: "人工"
      }
    },
    reviews: {
      eyebrow: "风险",
      title: "风险复核",
      lead: "只解释前列。换语言只换文案，不重跑分数，也不再叫模型。",
      emptyTitle: "这一批还没有复核",
      emptyBody: "分数出来后，前列会出现说明。",
      source: {
        success: "模型",
        fallback: "模板兜底",
        pending: "待处理",
        failed: "失败"
      },
      decision: {
        recommend: "推荐",
        cautious: "谨慎",
        reject: "不建议"
      },
      alignment: {
        hard_conflict: "硬冲突",
        soft_divergence: "软偏离",
        consistent: "一致",
        unknown: "未知"
      },
      fields: {
        reason: "理由",
        risk: "风险说明",
        alignment: "和规则对照"
      }
    },
    manual: {
      recommend: "推荐",
      reject: "不推荐",
      pending: "先放一放",
      reviewed: "已看过",
      none: "未标注"
    },
    exempt: {
      note: "昵称、小红书号、原始关键词和手写备注保持原文，不做翻译。"
    }
  }
} as const; 