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
      followers: "平台展示的累计粉丝总数。由小红书或合作平台提供；平台没给时显示 —。",
      followerGrowth: "统计周期内净新增粉丝数。由小红书或合作平台提供；平台没给时显示 —。",
      followerGrowthRate: "新增粉丝 ÷ 统计周期开始时的粉丝数。由系统换算；平台没给时显示 —。",
      readFanRatio: "日常笔记阅读中来自已关注粉丝的比例；越低说明公域流量越强。由蒲公英提供；平台没给时显示 —。",
      activeFanRatio: "近 30 天内在小红书有打开、浏览等活跃行为的粉丝比例。由蒲公英提供；平台没给时显示 —。",
      engagedFanRatio: "近 30 天内与博主笔记有赞藏评等真实互动的粉丝比例。由蒲公英提供；平台没给时显示 —。",
      impressionMedian: "统计周期内日常笔记曝光量的中位数（自然公域流量）。由小红书或合作平台提供；平台没给时显示 —。",
      readMedian: "统计周期内日常笔记真实阅读次数的中位数。由小红书或合作平台提供；平台没给时显示 —。",
      interactionMedian: "统计周期内日常笔记（点赞 + 收藏 + 评论）总和的中位数。由小红书或合作平台提供；平台没给时显示 —。",
      likeMedian: "统计周期内日常笔记单篇点赞数的中位数。由小红书或合作平台提供；平台没给时显示 —。",
      collectMedian: "统计周期内日常笔记单篇收藏数的中位数。收藏代表深度种草与购买意向。由小红书或合作平台提供；平台没给时显示 —。",
      commentMedian: "统计周期内日常笔记单篇评论数的中位数。由小红书或合作平台提供；平台没给时显示 —。",
      coopReadMedian: "经蒲公英报备商业合作笔记的阅读量中位数。由蒲公英提供；平台没给时显示 —。",
      coopInteractionMedian: "经蒲公英报备商业合作笔记的点赞、收藏与评论中位数。由蒲公英提供；平台没给时显示 —。",
      engagementRate: "互动中位数 ÷ 阅读中位数（按真实阅读计算，不用粉丝数虚标）。由系统换算或蒲公英提供；平台没给时显示 —。",
      retentionRate: "图文笔记 3 秒阅读率或视频笔记 5 秒完播率。由蒲公英或合作平台提供；平台没给时显示 —。",
      noteCount: "统计周期内在小红书公开发布的笔记总数。由小红书或合作平台提供；平台没给时显示 —。",
      viralCount: "统计周期内达到千赞或五千赞以上的爆文篇数。由合作数据平台提供；平台没给时显示 —。",
      viralRate: "爆文数 ÷ 发文数。体现内容表现稳定性。由系统换算；平台没给时显示 —。",
      priceImage: "蒲公英报备官方图文合作单篇标准报价（人民币）。由蒲公英提供；平台没给时显示 —。",
      priceVideo: "蒲公英报备官方视频合作单篇标准报价（人民币）。由蒲公英提供；平台没给时显示 —。",
      cpv: "报价 ÷ 合作阅读中位数，单次真实阅读成本。由系统换算；平台没给时显示 —。",
      cpe: "报价 ÷ 合作互动中位数，单次真实互动成本（美妆实操通常 ≤ 3 为优选）。由系统换算或蒲公英提供；平台没给时显示 —。",
      cpm: "报价 ÷ 合作阅读中位数 × 1000，千次真实阅读成本。由系统换算；平台没给时显示 —。",
      collectLikeRatio: "收藏中位数 ÷ 点赞中位数。比值越高说明高价值干货与实用属性越强。由系统换算；平台没给时显示 —。",
      purchaseIntentCommentRatio: "评论中含「求链接、怎么买、多少钱、色号、已下单」等购买意向词的占比。由蒲公英提供；平台没给时显示 —。",
      trafficSearchRatio: "阅读流量中来自主动搜索的比例；越高代表长尾自然流量与心智沉淀越久。由蒲公英提供；平台没给时显示 —。",
      trafficRecommendRatio: "阅读流量中来自发现页/信息流推荐的比例；越高代表爆发推流潜力越大。由蒲公英提供；平台没给时显示 —。",
      trafficFollowRatio: "阅读流量中来自博主关注页的比例。由蒲公英提供；平台没给时显示 —。",
      readToFollowerRatio: "日常阅读中位数 ÷ 粉丝数。高读粉比代表平台正在推荐，内容穿透力强。由系统换算；平台没给时显示 —。",
      authenticity: "合作机构根据互动行为抽样估算的真实粉丝比例。由合作数据平台提供；平台没给时显示 —。",
      coopNoteCount: "博主在小红书平台累计完成的官方报备商业合作笔记总数。由蒲公英提供；平台没给时显示 —。"
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
      label: "粉丝量级",
      head: "头部",
      mid: "腰部",
      junior: "初级",
      amateur: "素人",
      unknown: "未知",
      hint: "头部 ≥ 50 万 · 腰部 5 – 50 万 · 初级 5 千 – 5 万 · 素人 300 – 5 千"
    },
    health: {
      label: "健康等级",
      excellent: "优秀",
      normal: "正常",
      abnormal: "异常",
      unknown: "未评级",
      hint: "蒲公英每月 1 日更新。异常（低活博主）为硬门槛不可合作，正常审慎评估。"
    },
    band: {
      legend: "数字颜色 = 同平台同量级里的排位；圆点 = 方案高亮提醒",
      cohort: "在 {source} 的 {tier} 博主里，共 {n} 人比较",
      top10: "同平台同量级前 10%",
      top25: "同平台同量级前 25%",
      upper: "同平台同量级中上 (前 25%–50%)",
      lower: "同平台同量级中下 (后 25%–50%)",
      bottom: "同平台同量级末段 (后 25%)",
      none: "人数较少暂不排位"
    },
    source: {
      label: "数据源",
      pugongying: "蒲公英",
      qiangua: "千瓜",
      xinhong: "新红",
      official: "官方数据",
      vendor: "合作平台",
      fixture: "演示数据",
      live: "真实数据",
      configured: "已接入",
      notConfigured: "尚未接入",
      configuredHint: "已接入，抓取结果是真实数据。",
      notConfiguredHint: "尚未接入，先用演示数据；接入由管理员完成。",
      fetchedAt: "抓取时间",
      locked: "选入名单时的数据记录（原样保留）"
    },
    query: {
      title: "筛选方案",
      lead: "筛选方案是一组选人规则：粉丝量级、健康门槛、表现条件与排位高低。保存后全队统一复用。",
      new: "新建方案",
      unsaved: "未保存方案",
      name: "方案名称",
      namePlaceholder: "例如：韩妆高性价比",
      save: "保存方案",
      saveAs: "另存为",
      delete: "删除方案",
      run: "运行",
      editor: "方案编辑",
      apply: "应用",
      reset: "重置",
      close: "收起",
      filters: "选人条件",
      addFilter: "添加条件",
      removeFilter: "移除",
      noFilters: "还没有设置表现条件，只按量级与健康等级看。",
      op: { gte: "≥", lte: "≤", between: "区间", percentileGte: "同量级排位 ≥" },
      value: "数值",
      from: "从",
      to: "到",
      sort: "排序",
      asc: "升序",
      desc: "降序",
      columns: "显示内容",
      highlights: "高亮提醒",
      tone: { good: "优", warn: "注意", bad: "差" },
      tiers: "量级",
      health: "健康等级",
      sources: "数据源",
      anyTier: "全部量级",
      anyHealth: "不限",
      matched: "符合条件 {n} 位",
      noResult: "没有博主满足当前这套选人方案",
      version: "第 {n} 版",
      saved: "已保存",
      deleted: "已删除",
      confirmDelete: "确认删除该方案？",
      errors: {
        "name.required": "请填写方案名称",
        "filters.between": "区间下限不能大于上限",
        "filters.value": "条件数值无效",
        "filters.percentile": "排位需在 0 – 100 之间",
        "columns": "至少勾选一项显示内容"
      }
    },
    ingest: {
      queued: "已开始抓取，后台会按平台允许的额度慢慢跑完，结束后出现在下方记录里。",
      progress: "已抓 {pages} 批 · 用了 {calls} 次额度",
      nextRun: "今天的额度用完了，{time} 自动继续",
      reason: {
        SOURCE_UNAVAILABLE: "平台暂时没有响应，可以稍后重试",
        VENDOR_REJECTED: "平台不接受这次请求，通常是接入信息或条件写错了",
        CONFIG_MISSING: "接入信息不全，先补好再试",
        RECORD_INVALID: "这条博主信息读不出来",
        RECORD_WRITE_FAILED: "这条博主信息没能存下来",
        QUOTA_EXHAUSTED: "今天的额度用完了，明天会自动继续",
        CANCELLED: "已手动停止",
        UNKNOWN: "这次没有抓完，可以重试",
      },
      retry: "从上次停下的地方继续",
      parked: {
        title: "搁置记录",
        lead: "没收完的抓取和读不出来的博主都留在这里，处理过才会消失。",
        empty: "没有搁置记录",
        count: "搁置 {n} 条",
        kindJob: "整次抓取",
        kindRecord: "单个博主",
        open: "待处理",
        replayed: "已重新处理",
        dismissed: "不再处理",
        replay: "再试一次",
        dismiss: "不再处理",
        exhausted: "试了几次都没成功，先改设置再来",
        tried: "试过 {n} 次",
      },
      cancel: "停止抓取",
      jobActions: "操作",
      title: "数据源",
      lead: "由后台按你设定的条件从各平台收集博主信息，按允许的额度稳妥抓取，并将各项表现整理成统一口径查看。",
      adapters: "接入渠道",
      route: "来源渠道",
      supports: "支持的筛选条件",
      provides: "可提供的信息",
      credentials: "接入状态",
      fetchTitle: "新建抓取任务",
      fileImport: "表格导入",
      params: "抓取设置",
      source: "数据源",
      window: "统计周期",
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
      byIds: "指定 {n} 位博主",
      run: "开始抓取",
      running: "正在抓取中…",
      done: "抓取完成：录入 {written} 位，跳过 {skipped} 位已存在的博主，未成功 {failed} 位",
      fixtureNote: "还没接入这个平台，先用演示数据帮你看清页面和内容；接入由管理员完成。",
      jobs: "抓取记录",
      jobSource: "数据源",
      jobMode: "方式",
      jobQuery: "条件",
      jobWritten: "已录入",
      jobSkipped: "已存在",
      jobFailed: "未成功",
      jobTime: "时间",
      noJobs: "还没有抓取记录",
      rawTitle: "平台原始信息",
      rawLead: "平台给的原始数据都留着，随时可查。",
      transform: "统一口径",
      transformLead: "各平台数据整理成统一口径，原始数据原样保留，随时对照。"
    },
    landing: {
      navWorkspaces: "工作台",
      navFlow: "流程",
      navScoring: "数据",
      previewTitle: "博主池",
      previewMeta: "已发布 · 按 CPE 升序",
      previewCols: { creator: "博主", tier: "粉丝量级", cpe: "CPE", fans: "粉丝" },
      workspacesEyebrow: "工作台",
      workspacesTitle: "四大工作端，同一条客观数据线。",
      workspacesLead: "运营端录入建档，选人端按方案挑库，运维端盯运行记录。各司其职，底层数据与历史记录完全一致。",
      flowEyebrow: "业务流程",
      flowTitle: "从一条线索，到一份经得起检验的候选名单。",
      steps: [
        { title: "建档", body: "录入显示名、粉丝、报价与合作记录，存成草稿。" },
        { title: "抓取", body: "填好条件，从小红书官方或合作平台取回博主信息，整理成统一口径查看。" },
        { title: "分派", body: "选人端按方案筛、排、勾，直接分派到项目候选名单。" },
        { title: "监控", body: "抓取进度、额度用完自动续跑与继续状态，运维端一目了然。" }
      ],
      dataEyebrow: "数据源头",
      dataTitle: "平台客观数据，零加权黑盒。",
      dataLead: "绝无主观打分。所有指标直连蒲公英官方与合作数据平台，计算指标仅为基础算术比率。优劣仅在同平台、同粉丝量级的博主里对比排位，平台没给的数据保持原样“—”。",
      sourcesTitle: "两条渠道直连，一套统一口径",
      sources: {
        pugongying: { label: "小红书官方数据（蒲公英）", body: "经官方直连，返回真实表现：曝光/阅读/互动中位数、互动率、阅读粉丝占比、图文视频一口价、CPE、健康等级、粉丝画像及合作品牌。" },
        qiangua: { label: "合作数据平台（千瓜）", body: "平台直连：近 90 天爆文表现、发文频率、涨粉稳定性、粉丝真实度与预估报价。" },
        xinhong: { label: "合作数据平台（新红）", body: "投放分析数据：图文 / 视频真实 CPE、CPM 与搜索/推荐流量来源分布。" }
      },
      groupsTitle: "六大规范指标组",
      groups: {
        scale: "粉丝数、近期净涨粉、发文数",
        reach: "曝光/阅读/互动中位数、互动率、3S阅读率/完播率",
        cost: "图文/视频一口价、单次阅读成本(CPV)、CPE、CPM",
        conversion: "收藏点赞比、求购意向评论占比、搜索流量占比",
        potential: "读粉比、爆文数与爆文率、推荐流量占比、涨粉率",
        trust: "健康等级、粉丝真实度、活跃粉丝与互动粉丝占比"
      },
      tierTitle: "同量级比排位",
      tierBody: "头部 ≥ 50 万，腰部 5 – 50 万，初级 5 千 – 5 万，素人 300 – 5 千。排位只在同一量级、同一平台群体里计算，不跨平台横向比较。",
      gateTitle: "健康等级是一票否决门槛",
      gateBody: "小红书官方健康等级每月 1 日更新。「异常（低活博主）」直接硬门槛排除，不参与任何妥协。",
      transformTitle: "统一口径与原始数据",
      transformLine: "不同平台的数据，一套口径看。",
      transformBody: "平台给的原始数据都留着，随时可查。口径有调整随时更新，不需要改系统底层。",
      values: [
        { title: "不发明综合分数", body: "平台给什么客观指标就呈现什么，好坏只在同平台同量级里对比相对排位。" },
        { title: "抓取与发布锁定数据", body: "每次抓取留存历史记录，发布后数据固化只读不可篡改，交付名单站得住。" },
        { title: "统一账号按角色开门", body: "团队统一登录，平台管理/运营/运维/选人各进专属工作台。" }
      ],
      ctaTitle: "开启客观透明的博主选人水线。",
      ctaLead: "使用工作邮箱登录，系统将根据账号权限直接进入对应工作台。",
      footerLinks: "工作台",
      footerNote: "听潮 · 品牌出海选人系统"
    },
    brand: {
      title: "听潮",
      short: "听潮",
      name: "听潮",
      tagline: "韩国品牌 × 小红书博主数据系统",
      story: "按条件自动收集博主信息，统一看数口径，在同平台同量级里对比表现，直连小红书官方与合作数据平台，为品牌出海提供客观、透明的选人依据。",
      eyebrow: "品牌出海选人系统",
      pillars: "数据源 · 筛选方案 · 项目分派 · 监测",
      loginAside: "团队统一登录，按分工直接进入对应工作台。",
      storyExcerpt: "回归客观平台数据，用清晰的方案与同量级排位挑选真正有转化力的博主。",
      runLabel: "筛选博主并分派至项目。"
    },
    nav: {
      sources: "数据源",
      queries: "筛选方案",
      overview: "总览",
      creators: "博主",
      reviews: "风险复核",
      workspaces: "工作台",
      ops: "运营端",
      select: "选人端",
      monitor: "运维端",
      ingest: "抓取任务"
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
      noAudience: "该平台未提供粉丝画像",
      collabBrands: "合作品牌",
      chooseImage: "选择图片",
      imageHint: "PNG / JPG / WebP / GIF，不超过 5 MB，建议正方形。",
      uploadTooLarge: "图片超过 5 MB，请压缩后再传。",
      uploadWrongType: "只能上传 PNG、JPG、WebP 或 GIF 图片。",
      uploadFailed: "头像没传上去，请稍后再试。",
      stepSaveHint: "填好显示名就能保存草稿。",
      learnMore: "了解工作台",
      mobileHint: "横屏或换到电脑查看完整表格。",
      showAll: "查看全部",
      clearFilters: "清除筛选",
      signOut: "退出登录",
      kpiHint: "以当前库为准",
      openRate: "整理进度",
      today: "今天",
      overview: "总览",
      quickActions: "快捷入口",
      recentActivity: "最近动态",
      jobDistribution: "抓取状态分布",
      untitled: "未命名",
      preview: "预览",
      formHint: "保存后生成草稿；发布后进入博主库锁定数据。",
      publishHint: "先保存草稿，再发布到博主库。",
      published: "已进入博主库",
      stepSave: "保存草稿",
      stepPublish: "发布",
      required: "必填",
      optional: "可选",
      xhsId: "小红书号",
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
      sortRating: "核心指标排序",
      sortHint: "按{field}排序",
      members: "博主数",
      count: "数量",
      sources: "数据源",
      batch: "批次",
      poolLead: "仅展示已发布、表现健康的博主；指标与排位按统一口径整理，切换语言不重新计算。",
      assignTo: "分派到「{name}」",
      assignHint: "要把博主分进项目，先从项目页点「从库里选」进入博主库勾选。",
      picked: "已选 {n} 位博主",
      back: "返回",
      noAssignments: "项目上还没有博主。从博主库选几位进来。",
      emptyProjects: "还没有项目。先建一个。",
      loading: "数据加载中……",
      jobStatus: {
        ok: "完成",
        running: "进行中",
        queued: "排队中",
        failed: "未成功",
        partial: "额度用完，明天继续"
      },
      assignmentStatus: {
        assigned: "已分派",
        removed: "已移除"
      },
      signIn: "登录",
      signInLead: "用工作邮箱登录，按分工进入对应工作台。",
      email: "邮箱",
      password: "密码",
      enter: "进入",
      loginError: "邮箱或密码错误，请核对后重试。",
      homeLead: "运营录入、选人挑选与后台运行，底层基于同一套统一口径与数据记录。",
      opsDesc: "博主建档入库、数据抓取与分类整理。",
      selectDesc: "按筛选方案挑博主、建投放项目并整理候选名单。",
      devDesc: "查看抓取进度、继续未完成的抓取、检查平台连接与运行状态。",
      openOps: "去运营端",
      openSelect: "去选人端",
      openDev: "去运维端",
      denied: "无权访问",
      deniedBody: "当前账号无权访问该工作台，请联系管理员开通。",
      opsHome: "运营工作台",
      createCreator: "录入博主",
      newCreator: "博主建档",
      displayName: "显示名",
      followers: "粉丝",
      quote: "报价",
      avatar: "头像",
      save: "保存",
      publish: "发布",
      confirmPublish: "确认发布",
      collaborated: "合作过的",
      neverCollaborated: "没合作过的",
      scoreLocked: "发布后数据已锁定，界面和后续抓取不会随意覆盖。",
      draft: "草稿",
      review: "待复核",
      ready: "已整理",
      released: "已发布",
      status: "状态",
      recentBatches: "最近批次",
      emptyBatches: "暂无记录。",
      projects: "项目",
      createProject: "新建项目",
      projectName: "项目名",
      note: "备注",
      board: "候选名单",
      openLibrary: "从博主库挑选",
      pool: "博主库",
      emptyPool: "博主库暂无博主。请在运营端发起抓取或手动建档。",
      emptyFilter: "当前筛选方案下没有找到博主。请调整条件或清空筛选。",
      filter: "筛选",
      sort: "排序",
      export: "导出",
      error: "网络连接有点问题，请稍后重试。",
      retry: "重试",
      assign: "分派",
      confirmAssign: "确认分派",
      health: "系统状态",
      sqlOk: "连接正常",
      storage: "系统存储",
      jobs: "抓取记录",
      detail: "详情",
      addToProject: "加入项目",
      chooseProject: "选择项目",
      failures: "未成功记录",
      pipeline: "数据流",
      recommended: "方案推荐",
      library: "博主库",
      sampleData: "演示数据",
      rulePack: "方案包",
      visibleFields: "显示内容",
      weights: "权重 (已不用)",
      defaultSort: "默认排序",
      advice: "选人建议",
      contact: "商务对接",
      koreaRelation: "韩国品牌合作经验",
      risk: "合作提醒",
      conclusion: "评估意见",
      org: "机构/MCN",
      gallery: "代表笔记",
      readOnly: "只读模式"
    },
    prefs: {
      currency: "货币",
      consentTitle: "Cookie 偏好",
      consentBody: "必要设置维持登录与安全；偏好设置记住语言、货币与外观。拒绝偏好也能正常登录。",
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
      ruleFirst: "客观指标，清晰方案，人工确认。"
    },
    overview: {
      eyebrow: "筛选方案",
      title: "按筛选方案挑博主",
      lead: "各项指标与排位直接由平台提供并统一整理，绝不用主观加权分。",
      statCreators: "博主",
      statTop50: "候选名单",
      statRecommend: "建议候选",
      statCautious: "审慎考虑",
      statReject: "暂不考虑",
      gradeMix: "量级分布",
      nextAction: "查看候选名单",
      emptyTitle: "暂无符合条件的博主",
      emptyBody: "抓取完成后或调整选人方案后，博主会显示在这里。"
    },
    creators: {
      trend: "趋势",
      trendLead: "每次抓取留一条数据记录；变化是第一次和最近一次记录的相对差。",
      snapshots: "查看全部 {n} 条记录",
      noHistory: "还没有历史记录，抓取一次后这里会显示趋势。",
      sources: "数据来源",
      sourcesLead: "同一小红书号在多个平台出现时，会自动归并到同一位博主。",
      lastSeen: "{date} 更新",
      eyebrow: "博主库",
      title: "博主",
      lead: "列表按筛选方案指定的排序排好。昵称与小红书号保持原样。",
      search: "按昵称或小红书号搜索",
      emptyTitle: "没有找到符合条件的博主",
      emptyBody: "重置条件后即可查看全部博主。",
      cols: {
        rank: "排序",
        creator: "博主",
        score: "指标值",
        grade: "量级",
        fans: "粉丝",
        ai: "评估意见",
        manual: "人工标记"
      }
    },
    reviews: {
      eyebrow: "合作评估",
      title: "博主评估详情",
      lead: "基于客观平台数据和同量级排位提供参考，切换语言只变文字，不改动已有数据记录。",
      emptyTitle: "这批博主暂无评估记录",
      emptyBody: "选入项目的博主会在这里整理出评估参考与对接信息。",
      source: {
        success: "统一口径整理",
        fallback: "默认参考",
        pending: "待处理",
        failed: "未成功"
      },
      decision: {
        recommend: "建议合作",
        cautious: "审慎考虑",
        reject: "不予考虑"
      },
      alignment: {
        hard_conflict: "硬门槛排除 (异常账号)",
        soft_divergence: "数据偏离提醒",
        consistent: "符合选人条件",
        unknown: "未知"
      },
      fields: {
        reason: "入选理由",
        risk: "合作提醒",
        alignment: "方案符合度"
      }
    },
    manual: {
      recommend: "已确认合作",
      reject: "已排除",
      pending: "待定/调研中",
      reviewed: "已复核",
      none: "未标记"
    },
    opsCreators: {
      title: "博主",
      lead: "抓取来的和手动录入的博主都在这里。审核通过后发布到选人端；下架后可以再次发布。",
      tabs: { review: "待审核", released: "已发布", withdrawn: "已下架" },
      stage: { review: "待审核", released: "已发布", withdrawn: "已下架" },
      search: "按昵称或小红书号搜索",
      sourceAll: "全部来源",
      manual: "手动录入",
      cols: { creator: "博主", source: "来源", followers: "粉丝", tier: "量级", updated: "更新时间", status: "状态" },
      needsReview: "有新数据",
      empty: {
        review: "没有待审核的博主",
        released: "还没有已发布的博主",
        withdrawn: "没有已下架的博主"
      },
      emptyHint: "去「数据源」抓一批，或者手动录入一位。",
      emptyFilter: "没有符合条件的博主，换个关键词或来源试试。",
      pageInfo: "第 {page} / {pages} 页 · 共 {total} 位",
      prev: "上一页",
      next: "下一页",
      open: "查看详情"
    },
    opsCreator: {
      back: "博主列表",
      approve: "通过并发布",
      unpublish: "下架",
      republish: "重新发布",
      raw: "平台原始信息",
      publishedAt: "发布于 {date}",
      updatedAt: "{date} 更新",
      notFound: "找不到这位博主，可能已被删除。",
      newNumbers: "抓到了新数字，对照下方「发布时与最新」看看差多少。",
      confirm: {
        approveTitle: "通过并发布这位博主？",
        approveBody: "发布后选人端就能看到 TA，并按现在这组数字筛选和排序；之后抓到的新数字不会自动替换。",
        unpublishTitle: "下架这位博主？",
        unpublishBody: "下架后选人端不再显示 TA，已经分派进项目的记录会标成已下架。之后随时可以重新发布。",
        republishTitle: "重新发布这位博主？",
        republishBody: "重新发布会把选人端的数字换成最新一次抓取的结果。",
        cancel: "取消",
        ok: "确认"
      },
      toast: {
        published: "已发布到选人端",
        republished: "已重新发布，选人端换成了最新数字",
        unchanged: "已经在选人端了，数字保持不变",
        unpublished: "已下架，选人端不再显示",
        saved: "资料已保存",
        incomplete: "还差信息：需要昵称、地域或内容方向，以及粉丝数（或勾选粉丝未知）",
        failed: "没有成功，请稍后再试",
        created: "已保存草稿，审核通过后就能发布"
      },
      edit: {
        title: "资料",
        lead: "这里改的是最新资料；已发布的数字要重新发布才会更新。",
        regions: "地域",
        verticals: "内容方向",
        listHint: "多个用逗号分开",
        categories: "分类",
        note: "备注",
        readOnly: "你的账号只能查看，不能修改。"
      },
      rawSheet: {
        lead: "每次从平台取回的原始内容都留着，按时间倒序排列。",
        empty: "这位博主是手动录入的，没有平台原始信息。",
        count: "共 {n} 条",
        expand: "展开原始内容",
        fields: "主要字段"
      }
    },
    compare: {
      title: "发布时与最新",
      lead: "选人端按「发布时」的数字筛选和排序；之后每次抓取只更新「最新」。想让选人端用上最新数字，先下架再重新发布。",
      leadSelect: "名单按「发布时」的数字筛选和排序；「最新」是之后抓到的数字，仅供对照。",
      notPublished: "还没发布过；发布时会把「最新」这一列原样定下来。",
      metric: "指标",
      locked: "发布时",
      latest: "最新",
      change: "变化",
      same: "持平"
    },
    exempt: {
      note: "昵称、小红书号、原始关键词和手写备注保持原文，不做翻译。"
    }
  }
} as const; 