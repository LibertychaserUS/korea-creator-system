import { kcsConsoleCopy } from './kcs-console'
import type { Locale } from './types'

export const en: Locale = {
  common: {
    welcome: "Welcome to 听潮",
    siteName: "听潮",
    login: "Sign in",
    signup: "Sign Up",
    logout: "Logout",
    profile: "Profile",
    settings: "Settings",
    and: "and",
    loading: "Loading...",
    unexpectedError: "An unexpected error occurred",
    notAvailable: "N/A",
    viewPlans: "View Plans",
    yes: "Yes",
    no: "No",
    theme: {
      light: "Light Theme",
      dark: "Dark Theme",
      system: "System Theme",
      toggle: "Toggle Theme",
      appearance: "Appearance",
      colorScheme: "Color Scheme",
      themes: {
        default: "Default",
        claude: "Claude",
        "cosmic-night": "Cosmic Night",
        "modern-minimal": "Modern Minimal",
        "ocean-breeze": "Ocean Breeze"
      }
    }
  },
  navigation: {
    home: "Home",
    dashboard: "Dashboard",
    orders: "Orders",
    shipments: "Shipments",
    tracking: "Tracking",
    admin: {
      dashboard: "Dashboard",
      users: "Users",
      subscriptions: "Subscriptions",
      orders: "Orders",
      credits: "Credits",
      application: "Application",
      blog: "Blog"
    }
  },
  actions: {
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    tryAgain: "Try again",
    createAccount: "Create account",
    sendCode: "Send Code",
    verify: "Verify",
    backToList: "Back to Users",
    saveChanges: "Save Changes",
    createUser: "Create User",
    deleteUser: "Delete User",
    back: "Back",
    resendCode: "Resend Code",
    resendVerificationEmail: "Resend Verification Email",
    upload: "Upload",
    previous: "Previous",
    next: "Next",
    createPost: "New Post",
    deletePost: "Delete Post",
    backToBlog: "Back to Blog"
  },
  email: {
    verification: {
      subject: "Verify your TinyShip account",
      title: "Verify your email address",
      greeting: "Hello {{name}},",
      message: "Thank you for registering with TinyShip. To complete your registration, please click the button below to verify your email address.",
      button: "Verify Email Address",
      alternativeText: "Or, copy and paste the following link into your browser:",
      expiry: "This link will expire in {{expiry_hours}} hours.",
      disclaimer: "If you didn't request this verification, please ignore this email.",
      signature: "Happy Shipping, The TinyShip Team",
    copyright: "© {{year}} TinyShip. All rights reserved."
    },
    resetPassword: {
      subject: "Reset your TinyShip password",
      title: "Reset your password",
      greeting: "Hello {{name}},",
      message: "We received a request to reset your password. Please click the button below to create a new password. If you didn't make this request, you can safely ignore this email.",
      button: "Reset Password",
      alternativeText: "Or, copy and paste the following link into your browser:",
      expiry: "This link will expire in {{expiry_hours}} hours.",
      disclaimer: "If you didn't request a password reset, no action is required.",
      signature: "Happy Shipping, The TinyShip Team",
      copyright: "© {{year}} TinyShip. All rights reserved."
    }
  },
  auth: {
    metadata: {
      signin: {
        title: "TinyShip - Sign In",
        description: "Sign in to your TinyShip account to access your dashboard, manage subscriptions, and use premium features.",
        keywords: "sign in, login, authentication, account access, dashboard"
      },
      signup: {
        title: "TinyShip - Create Account",
        description: "Create your TinyShip account and start building amazing SaaS applications with our comprehensive starter kit.",
        keywords: "sign up, register, create account, new user, get started"
      },
      forgotPassword: {
        title: "TinyShip - Reset Password",
        description: "Reset your TinyShip account password securely. Enter your email to receive password reset instructions.",
        keywords: "forgot password, reset password, password recovery, account recovery"
      },
      resetPassword: {
        title: "TinyShip - Create New Password",
        description: "Create a new secure password for your TinyShip account. Choose a strong password to protect your account.",
        keywords: "new password, password reset, secure password, account security"
      },
      phone: {
        title: "TinyShip - Phone Login",
        description: "Sign in to TinyShip using your phone number. Quick and secure authentication with SMS verification.",
        keywords: "phone login, SMS verification, mobile authentication, phone number"
      },
      wechat: {
        title: "TinyShip - WeChat Login",
        description: "Sign in to TinyShip using your WeChat account. Convenient authentication for Chinese users.",
        keywords: "WeChat login, 微信登录, social login, Chinese authentication"
      }
    },
    signin: {
      title: "Sign in to your account",
      welcomeBack: "Welcome back",
      socialLogin: "Sign in with your favorite social account",
      continueWith: "Or continue with",
      email: "Email",
      emailPlaceholder: "Enter your email",
      password: "Password",
      forgotPassword: "Forgot password?",
      rememberMe: "Remember me",
      submit: "Sign in",
      submitting: "Signing in...",
      noAccount: "Don't have an account?",
      signupLink: "Sign up",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      socialProviders: {
        google: "Google",
        github: "GitHub",
        apple: "Apple",
        wechat: "WeChat",
        phone: "Phone"
      },
      errors: {
        invalidEmail: "Please enter a valid email",
        requiredEmail: "Email is required",
        requiredPassword: "Password is required",
        invalidCredentials: "Invalid email or password",
        captchaRequired: "Please complete the captcha verification",
        emailNotVerified: {
          title: "Email verification required",
          description: "Please check your email and click the verification link. If you haven't received the email, click the button below to resend.",
          resendSuccess: "Verification email has been resent, please check your inbox.",
          resendError: "Failed to resend verification email, please try again later.",
          dialogTitle: "Resend Verification Email",
          dialogDescription: "Please complete the captcha verification before resending the verification email",
          emailLabel: "Email Address",
          sendButton: "Send Verification Email",
          sendingButton: "Sending...",
          waitButton: "Wait {seconds}s"
        }
      }
    },
    signup: {
      title: "Sign up for TinyShip",
      createAccount: "Create an account",
      socialSignup: "Sign up with your favorite social account",
      continueWith: "Or continue with",
      name: "Name",
      namePlaceholder: "Enter your name",
      email: "Email",
      emailPlaceholder: "Enter your email",
      password: "Password",
      passwordPlaceholder: "Create a password",
      imageUrl: "Profile Image URL",
      imageUrlPlaceholder: "https://example.com/your-image.jpg",
      optional: "Optional",
      submit: "Create account",
      submitting: "Creating account...",
      haveAccount: "Already have an account?",
      signinLink: "Sign in",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      verification: {
        title: "Verification Required",
        sent: "We've sent a verification email to",
        checkSpam: "Can't find the email? Please check your spam folder.",
        spamInstruction: "If you still don't see it,"
      },
      errors: {
        invalidName: "Please enter a valid name",
        requiredName: "Name is required",
        invalidEmail: "Please enter a valid email",
        requiredEmail: "Email is required",
        invalidPassword: "Please enter a valid password",
        requiredPassword: "Password is required",
        invalidImage: "Please enter a valid image URL",
        captchaRequired: "Please complete the captcha verification",
        captchaError: "Captcha verification failed, please try again",
        captchaExpired: "Captcha verification expired, please try again"
      }
    },
    phone: {
      title: "Login with Phone",
      description: "Enter your phone number to receive a verification code",
      phoneNumber: "Phone Number",
      phoneNumberPlaceholder: "Enter your phone number",
      countryCode: "Country/Region",
      verificationCode: "Verification Code",
      enterCode: "Enter Verification Code",
      sendingCode: "Sending code...",
      verifying: "Verifying...",
      codeSentTo: "Verification code sent to",
      resendIn: "Resend in",
      seconds: "seconds",
      resendCode: "Resend Code",
      resendCountdown: "seconds remaining",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      errors: {
        invalidPhone: "Please enter a valid phone number",
        requiredPhone: "Phone number is required",
        requiredCountryCode: "Please select country/region",
        invalidCode: "Please enter a valid verification code",
        requiredCode: "Verification code is required",
        captchaRequired: "Please complete the captcha verification"
      }
    },
    forgetPassword: {
      title: "Forgot Password",
      description: "Reset your password and regain access to your account",
      email: "Email",
      emailPlaceholder: "Enter your email",
      submit: "Send reset link",
      submitting: "Sending...",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      verification: {
        title: "Check your email",
        sent: "We've sent a password reset link to",
        checkSpam: "Can't find the email? Please check your spam folder."
      },
      errors: {
        invalidEmail: "Please enter a valid email",
        requiredEmail: "Email is required",
        captchaRequired: "Please complete the captcha verification"
      }
    },
    resetPassword: {
      title: "Reset Password",
      description: "Create a new password for your account",
      password: "New Password",
      passwordPlaceholder: "Enter your new password",
      confirmPassword: "Confirm Password",
      confirmPasswordPlaceholder: "Confirm your new password",
      submit: "Reset Password",
      submitting: "Resetting...",
      success: {
        title: "Password Reset Successful",
        description: "Your password has been successfully reset.",
        backToSignin: "Back to Sign In",
        goToSignIn: "Back to Sign In"
      },
      errors: {
        invalidPassword: "Password must be at least 8 characters",
        requiredPassword: "Password is required",
        passwordsDontMatch: "Passwords don't match",
        invalidToken: "Invalid or expired reset link. Please try again."
      }
    },
    wechat: {
      title: "WeChat Login",
      description: "Scan with WeChat to log in",
      scanQRCode: "Please scan the QR code with WeChat",
      orUseOtherMethods: "Or use other login methods",
      loadingQRCode: "Loading QR code...",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      errors: {
        loadingFailed: "Failed to load WeChat QR code",
        networkError: "Network error, please try again"
      }
    },
    // Auth error codes mapping for Better Auth 1.4
    authErrors: {
      // User errors
      USER_NOT_FOUND: "No account found with this email",
      USER_ALREADY_EXISTS: "User with this email already exists",
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "User already exists. Please use another email",
      USER_EMAIL_NOT_FOUND: "User email not found",
      FAILED_TO_CREATE_USER: "Failed to create user",
      FAILED_TO_UPDATE_USER: "Failed to update user",
      
      // Authentication errors
      INVALID_EMAIL: "Invalid email address",
      INVALID_PASSWORD: "Invalid password",
      INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
      INVALID_CREDENTIALS: "Invalid credentials provided",
      INVALID_TOKEN: "Invalid or expired token",
      PASSWORD_TOO_SHORT: "Password is too short",
      PASSWORD_TOO_LONG: "Password is too long",
      
      // Email verification errors
      EMAIL_NOT_VERIFIED: "Please verify your email address",
      EMAIL_ALREADY_VERIFIED: "Email is already verified",
      EMAIL_MISMATCH: "Email mismatch",
      EMAIL_CAN_NOT_BE_UPDATED: "Email cannot be updated",
      VERIFICATION_EMAIL_NOT_ENABLED: "Verification email is not enabled",
      
      // Session errors
      SESSION_EXPIRED: "Your session has expired. Please sign in again",
      SESSION_NOT_FRESH: "Session is not fresh. Please re-authenticate",
      FAILED_TO_CREATE_SESSION: "Failed to create session",
      FAILED_TO_GET_SESSION: "Failed to get session",
      
      // Account errors
      ACCOUNT_NOT_FOUND: "Account not found",
      ACCOUNT_BLOCKED: "Your account has been temporarily blocked",
      CREDENTIAL_ACCOUNT_NOT_FOUND: "Credential account not found",
      SOCIAL_ACCOUNT_ALREADY_LINKED: "Social account is already linked",
      LINKED_ACCOUNT_ALREADY_EXISTS: "Linked account already exists",
      FAILED_TO_UNLINK_LAST_ACCOUNT: "Cannot unlink your last account",
      USER_ALREADY_HAS_PASSWORD: "User already has a password",
      
      // Phone number errors
      PHONE_NUMBER_ALREADY_EXISTS: "Phone number is already registered",
      INVALID_PHONE_NUMBER: "Invalid phone number format",
      OTP_EXPIRED: "Verification code has expired",
      INVALID_OTP: "Invalid verification code",
      OTP_TOO_MANY_ATTEMPTS: "Too many verification attempts. Please request a new code",
      
      // Provider errors
      PROVIDER_NOT_FOUND: "Provider not found",
      ID_TOKEN_NOT_SUPPORTED: "ID token not supported",
      FAILED_TO_GET_USER_INFO: "Failed to get user info",
      
      // Security errors
      CAPTCHA_REQUIRED: "Please complete the captcha verification",
      CAPTCHA_INVALID: "Captcha verification failed",
      TOO_MANY_REQUESTS: "Too many requests. Please try again later",
      CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: "Cross-site navigation login blocked",
      INVALID_ORIGIN: "Invalid origin",
      MISSING_OR_NULL_ORIGIN: "Missing or invalid origin",
      
      // Callback URL errors
      INVALID_CALLBACK_URL: "Invalid callback URL",
      INVALID_REDIRECT_URL: "Invalid redirect URL",
      INVALID_ERROR_CALLBACK_URL: "Invalid error callback URL",
      INVALID_NEW_USER_CALLBACK_URL: "Invalid new user callback URL",
      CALLBACK_URL_REQUIRED: "Callback URL is required",
      
      // Validation errors
      VALIDATION_ERROR: "Validation error",
      MISSING_FIELD: "Required field is missing",
      FIELD_NOT_ALLOWED: "Field is not allowed",
      ASYNC_VALIDATION_NOT_SUPPORTED: "Async validation is not supported",
      
      // System errors
      FAILED_TO_CREATE_VERIFICATION: "Failed to create verification",
      EMAIL_SEND_FAILED: "Failed to send email. Please try again later",
      SMS_SEND_FAILED: "Failed to send SMS. Please try again later",
      UNKNOWN_ERROR: "An unexpected error occurred"
    }
  },
  admin: {
    metadata: {
      title: "TinyShip - Admin Dashboard",
      description: "Comprehensive admin dashboard for managing users, subscriptions, orders, and system analytics in your SaaS application.",
      keywords: "admin, dashboard, management, SaaS, analytics, users, subscriptions, orders"
    },
    dashboard: {
      title: "Admin Dashboard",
      accessDenied: "Access Denied",
      noPermission: "You don't have permission to access the admin dashboard",
      lastUpdated: "Last updated",
      metrics: {
        totalRevenue: "Total Revenue",
        totalRevenueDesc: "All time revenue",
        newCustomers: "Monthly New Customers",
        newCustomersDesc: "New customers this month",
        newOrders: "Monthly New Orders",
        newOrdersDesc: "New orders this month",
        fromLastMonth: "from last month"
      },
      chart: {
        monthlyRevenueTrend: "Monthly Revenue Trend",
        revenue: "Revenue",
        orders: "Orders"
      },
      todayData: {
        title: "Today's Data",
        revenue: "Revenue",
        newUsers: "New Users",
        orders: "Orders"
      },
      monthData: {
        title: "This Month's Data",
        revenue: "Monthly Revenue",
        newUsers: "Monthly New Users",
        orders: "Monthly Orders"
      },
      recentOrders: {
        title: "Recent Orders",
        orderId: "Order ID",
        customer: "Customer",
        plan: "Plan",
        amount: "Amount",
        provider: "Payment Method",
        status: "Status",
        time: "Time",
        total: "Total"
      }
    },
    users: {
      title: "User Management",
      subtitle: "Manage users, roles, and permissions",
      actions: {
        addUser: "Add User",
        editUser: "Edit User",
        deleteUser: "Delete User",
        banUser: "Ban User",
        unbanUser: "Unban User"
      },
      table: {
        columns: {
          id: "ID",
          name: "Name",
          email: "Email",
          role: "Role",
          phoneNumber: "Phone Number",
          emailVerified: "Email Verified",
          banned: "Banned",
          createdAt: "Created At",
          updatedAt: "Updated At",
          actions: "Actions"
        },
        actions: {
          editUser: "Edit User",
          deleteUser: "Delete User",
          clickToCopy: "Click to copy"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        },
        noResults: "No users found",
        search: {
          searchBy: "Search by",
          searchPlaceholder: "Search {field}...",
          filterByRole: "Filter by role",
          allRoles: "All Roles",
          banStatus: "Ban status",
          allUsers: "All users",
          bannedUsers: "Banned",
          notBannedUsers: "Not banned",
          view: "View",
          toggleColumns: "Toggle columns"
        },
        pagination: {
          showing: "Showing {start} to {end} of {total} results",
          pageInfo: "Page {current} of {total}"
        },
        dialog: {
          banTitle: "Ban User",
          banDescription: "Are you sure you want to ban this user? They will not be able to access the application.",
          banSuccess: "User banned successfully",
          unbanSuccess: "User unbanned successfully",
          updateRoleSuccess: "User role updated successfully",
          updateRoleFailed: "Failed to update user role"
        }
      },
      banDialog: {
        title: "Ban User",
        description: "Are you sure you want to ban {userName}? They will not be able to access the application."
      },
      unbanDialog: {
        title: "Unban User",
        description: "Are you sure you want to unban {userName}? They will regain access to the application."
      },
      form: {
        title: "User Information",
        description: "Enter user details below",
        labels: {
          name: "Name",
          email: "Email",
          password: "Password",
          confirmPassword: "Confirm Password",
          role: "Role",
          image: "Profile Image",
          phoneNumber: "Phone Number",
          emailVerified: "Email Verified",
          phoneVerified: "Phone Verified",
          banned: "Banned",
          banReason: "Ban Reason"
        },
        placeholders: {
          name: "Enter user's name",
          email: "Enter user's email",
          password: "Enter password (min 8 characters)",
          confirmPassword: "Confirm password",
          selectRole: "Select role",
          image: "https://example.com/avatar.jpg",
          phoneNumber: "Enter phone number",
          banReason: "Reason for banning (optional)"
        },
        validation: {
          nameRequired: "Name is required",
          emailRequired: "Email is required",
          emailInvalid: "Please enter a valid email",
          passwordRequired: "Password is required",
          passwordMinLength: "Password must be at least 8 characters",
          passwordMismatch: "Passwords do not match",
          roleRequired: "Role is required"
        }
      },
      deleteDialog: {
        title: "Delete User",
        description: "Are you absolutely sure? This action cannot be undone. This will permanently delete the user account and remove all associated data."
      },
      messages: {
        createSuccess: "User created successfully",
        updateSuccess: "User updated successfully",
        deleteSuccess: "User deleted successfully",
        deleteError: "Failed to delete user",
        fetchError: "Failed to fetch user data",
        operationFailed: "Operation failed"
      }
    },
    orders: {
      title: "Orders",
      actions: {
        createOrder: "Create Order"
      },
      messages: {
        fetchError: "Failed to load orders. Please try again."
      },
      table: {
        noResults: "No orders found.",
        search: {
          searchBy: "Search by...",
          searchPlaceholder: "Search by {field}...",
          filterByStatus: "Filter by status",
          allStatus: "All Status",
          filterByProvider: "Payment provider",
          allProviders: "All Providers",
          stripe: "Stripe",
          wechat: "WeChat",
          creem: "Creem",
          alipay: "Alipay"
        },
        columns: {
          id: "Order ID",
          user: "User",
          amount: "Amount",
          plan: "Plan",
          status: "Status",
          provider: "Provider",
          providerOrderId: "Provider Order ID",
          createdAt: "Created At",
          actions: "Actions"
        },
        actions: {
          openMenu: "Open menu",
          actions: "Actions",
          viewOrder: "View order",
          refundOrder: "Refund order",
          clickToCopy: "Click to copy"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        }
      },
      status: {
        pending: "Pending",
        paid: "Paid",
        failed: "Failed",
        refunded: "Refunded",
        canceled: "Canceled"
      }
    },
    blog: {
      title: "Blog Management",
      subtitle: "Create and manage blog posts",
      createPost: "Create Post",
      editPost: "Edit Post",
      actions: {
        newPost: "New Post"
      },
      messages: {
        fetchError: "Failed to load blog posts. Please try again.",
        createSuccess: "Post created successfully",
        updateSuccess: "Post updated successfully",
        deleteSuccess: "Post deleted successfully",
        deleteError: "Failed to delete post",
        operationFailed: "Operation failed",
        uploadSuccess: "Upload successful",
        uploadError: "Upload failed"
      },
      table: {
        noResults: "No posts found.",
        search: {
          searchPlaceholder: "Search by title...",
          filterByStatus: "Filter by status",
          allStatus: "All Status",
          draft: "Draft",
          published: "Published"
        },
        columns: {
          title: "Title",
          status: "Status",
          author: "Author",
          publishedAt: "Published At",
          createdAt: "Created At",
          actions: "Actions"
        },
        actions: {
          edit: "Edit",
          delete: "Delete"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        }
      },
      form: {
        title: "Post Information",
        description: "Enter post details below",
        labels: {
          title: "Title",
          slug: "Slug",
          excerpt: "Excerpt",
          coverImage: "Cover Image",
          status: "Status",
          content: "Content"
        },
        placeholders: {
          title: "Enter post title",
          slug: "URL-friendly slug (auto-generated from title)",
          excerpt: "Brief summary of the post",
          coverImage: "Drag and drop or click to upload (max 2MB)",
          content: "Write your content in Markdown..."
        }
      },
      deleteDialog: {
        title: "Delete Post",
        description: "Are you absolutely sure? This action cannot be undone. This will permanently delete the post."
      }
    },
    credits: {
      title: "Credit Transactions",
      subtitle: "View all credit transactions across all users",
      messages: {
        fetchError: "Failed to load credit transactions. Please try again."
      },
      table: {
        noResults: "No credit transactions found.",
        search: {
          searchBy: "Search by...",
          searchPlaceholder: "Search by {field}...",
          filterByType: "Filter by type",
          allTypes: "All Types",
          purchase: "Purchase",
          consumption: "Consumption",
          refund: "Refund",
          bonus: "Bonus",
          adjustment: "Adjustment"
        },
        columns: {
          id: "Transaction ID",
          user: "User",
          type: "Type",
          amount: "Amount",
          balance: "Balance",
          description: "Description",
          createdAt: "Created At",
          metadata: "Metadata"
        },
        actions: {
          clickToCopy: "Click to copy",
          viewDetails: "View details"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        },
        pagination: {
          showing: "Showing {start} to {end} of {total} results",
          pageInfo: "Page {current} of {total}"
        }
      },
      type: {
        purchase: "Purchase",
        consumption: "Consumption",
        refund: "Refund",
        bonus: "Bonus",
        adjustment: "Adjustment"
      }
    },
    subscriptions: {
      title: "Subscriptions",
      description: "Manage user subscriptions and billing",
      actions: {
        createSubscription: "Create Subscription"
      },
      messages: {
        fetchError: "Failed to load subscriptions. Please try again."
      },
      table: {
        showing: "Showing {from} to {to} of {total} results",
        noResults: "No subscriptions found.",
        rowsPerPage: "Rows per page",
        page: "Page",
        of: "of",
        view: "View",
        toggleColumns: "Toggle columns",
        goToFirstPage: "Go to first page",
        goToPreviousPage: "Go to previous page", 
        goToNextPage: "Go to next page",
        goToLastPage: "Go to last page",
        search: {
          searchLabel: "Search subscriptions",
          searchField: "Search field",
          statusLabel: "Status",
          providerLabel: "Provider",
          search: "Search",
          clear: "Clear",
          allStatuses: "All statuses",
          allProviders: "All providers",
          stripe: "Stripe",
          creem: "Creem",
          wechat: "WeChat",
          alipay: "Alipay",
          userEmail: "User Email",
          subscriptionId: "Subscription ID",
          userId: "User ID",
          planId: "Plan ID",
          stripeSubscriptionId: "Stripe Subscription ID",
          creemSubscriptionId: "Creem Subscription ID",
          placeholders: {
            userEmail: "Enter user email...",
            subscriptionId: "Enter subscription ID...",
            userId: "Enter user ID...",
            planId: "Enter plan ID...",
            stripeSubscriptionId: "Enter Stripe subscription ID...",
            creemSubscriptionId: "Enter Creem subscription ID...",
            default: "Enter search term..."
          },
          searchBy: "Search by...",
          searchPlaceholder: "Search by {field}...",
          filterByStatus: "Filter by status",
          filterByProvider: "Filter by provider",
          allStatus: "All Status",
          filterByPaymentType: "Payment type",
          allPaymentTypes: "All Types",
          active: "Active",
          canceled: "Canceled",
          expired: "Expired",
          trialing: "Trialing",
          inactive: "Inactive",
          oneTime: "One Time",
          recurring: "Recurring"
        },
        columns: {
          id: "Subscription ID",
          user: "Customer",
          plan: "Plan",
          status: "Status",
          paymentType: "Payment Type",
          provider: "Provider",
          periodStart: "Period Start",
          periodEnd: "Period End",
          cancelAtPeriodEnd: "Will Cancel",
          createdAt: "Created",
          updatedAt: "Updated",
          metadata: "Metadata",
          period: "Period",
          actions: "Actions"
        },
        actions: {
          openMenu: "Open menu",
          actions: "Actions",
          viewSubscription: "View subscription",
          cancelSubscription: "Cancel subscription",
          clickToCopy: "Click to copy"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        }
      },
      status: {
        active: "Active",
        trialing: "Trialing",
        canceled: "Canceled",
        cancelled: "Canceled",
        expired: "Expired",
        inactive: "Inactive"
      },
      paymentType: {
        one_time: "One-time",
        recurring: "Recurring"
      }
    }
  },
  pricing: {
    metadata: {
      title: "TinyShip - Pricing Plans",
      description: "Choose the perfect plan for your needs. Flexible pricing options including monthly, yearly, and lifetime subscriptions with premium features.",
      keywords: "pricing, plans, subscription, monthly, yearly, lifetime, premium, features"
    },
    title: "Pricing",
    subtitle: "Choose the plan that's right for you",
    description: "We offer both traditional time-based subscriptions (monthly/yearly/lifetime) and the AI-era popular credit system. Subscribe for unlimited access, or purchase credits and pay only for what you use.",
    cta: "Get started",
    recommendedBadge: "Recommended",
    lifetimeBadge: "One-time purchase, lifetime access",
    creditsBadge: "Credits",
    creditsUnit: "credits",
    tabs: {
      subscription: "Subscription",
      credits: "Credits"
    },
    features: {
      securePayment: {
        title: "Multi-Provider Security",
        description: "Support WeChat Pay, Stripe, Creem with enterprise-grade security"
      },
      flexibleSubscription: {
        title: "Flexible Payment Models",
        description: "Time-based subscription or AI-era credit system — choose your style"
      },
      globalCoverage: {
        title: "Global Payment Coverage", 
        description: "Multi-currency and regional payment methods for worldwide access"
      }
    },
    plans: {
      monthly: {
        name: "Monthly Plan",
        description: "Perfect for short-term projects",
        duration: "month",
        features: {
          "所有高级功能": "All premium features",
          "优先支持": "Priority support"
        }
      },
      yearly: {
        name: "Annual Plan",
        description: "Best value for long-term use",
        duration: "year",
        features: {
          "所有高级功能": "All premium features",
          "优先支持": "Priority support",
          "两个月免费": "2 months free"
        }
      },
      lifetime: {
        name: "Lifetime",
        description: "One-time payment, lifetime access",
        duration: "lifetime",
        features: {
          "所有高级功能": "All premium features",
          "优先支持": "Priority support",
          "终身免费更新": "Free lifetime updates"
        }
      }
    }
  },
  payment: {
    metadata: {
      success: {
        title: "TinyShip - Payment Successful",
        description: "Your payment has been processed successfully. Thank you for your subscription and welcome to our premium features.",
        keywords: "payment, success, subscription, confirmation, premium"
      },
      cancel: {
        title: "TinyShip - Payment Cancelled",
        description: "Your payment was cancelled. You can retry the payment or contact our support team for assistance.",
        keywords: "payment, cancelled, retry, support, subscription"
      }
    },
    result: {
      success: {
        title: "Payment Successful",
        description: "Your payment has been processed successfully.",
        actions: {
          viewSubscription: "View Subscription",
          backToHome: "Back to Home"
        }
      },
      cancel: {
        title: "Payment Cancelled",
        description: "Your payment has been cancelled.",
        actions: {
          tryAgain: "Try Again",
          contactSupport: "Contact Support",
          backToHome: "Back to Home"
        }
      },
      failed: "Payment failed, please try again"
    },
    steps: {
      initiate: "Initialize",
      initiateDesc: "Prepare payment",
      scan: "Scan",
      scanDesc: "Scan QR code",
      pay: "Pay",
      payDesc: "Confirm payment"
    },
    scanQrCode: "Please scan the QR code with WeChat to complete the payment",
    confirmCancel: "Your payment is not complete. Are you sure you want to cancel?",
    orderCanceled: "Your order has been canceled"
  },
  subscription: {
    metadata: {
      title: "TinyShip - My Subscription",
      description: "Manage your subscription plan, view billing history, and update payment methods in your subscription dashboard.",
      keywords: "subscription, billing, payment, plan, management, dashboard"
    },
    title: "My Subscription",
    overview: {
      title: "Subscription Overview",
      planType: "Plan Type",
      status: "Status",
      active: "Active",
      startDate: "Start Date",
      endDate: "End Date",
      progress: "Subscription Progress"
    },
    management: {
      title: "Subscription Management",
      description: "Manage your subscription, view billing history, and update payment methods through the customer portal.",
      manageSubscription: "Manage Subscription",
      changePlan: "Change Plan",
      redirecting: "Redirecting..."
    },
    noSubscription: {
      title: "No Active Subscription Found",
      description: "You currently don't have an active subscription plan.",
      viewPlans: "View Plans"
    }
  },
  dashboard: {
    metadata: {
      title: "TinyShip - Dashboard",
      description: "Manage your account, subscriptions, and profile settings in your personalized dashboard.",
      keywords: "dashboard, account, profile, subscription, settings, management"
    },
    title: "Dashboard",
    description: "Manage your account and subscriptions",
    profile: {
      title: "Profile Information",
      noNameSet: "No name set",
      role: "Role:",
      emailVerified: "Email verified",
      editProfile: "Edit Profile",
      updateProfile: "Update Profile",
      cancel: "Cancel",
      form: {
        labels: {
          name: "Full Name",
          email: "Email Address",
          image: "Profile Image URL"
        },
        placeholders: {
          name: "Enter your full name",
          email: "Email address",
          image: "https://example.com/your-image.jpg"
        },
        emailReadonly: "Email address cannot be modified",
        imageDescription: "Optional: Enter a URL for your profile picture"
      },
      updateSuccess: "Profile updated successfully",
      updateError: "Failed to update profile. Please try again."
    },
    subscription: {
      title: "Subscription Status",
      status: {
        lifetime: "Lifetime",
        active: "Active",
        canceled: "Canceled",
        cancelAtPeriodEnd: "Canceling at Period End",
        pastDue: "Past Due",
        unknown: "Unknown",
        noSubscription: "No Subscription"
      },
      paymentType: {
        recurring: "Recurring",
        oneTime: "One-time"
      },
      lifetimeAccess: "You have lifetime access",
      expires: "Expires:",
      cancelingNote: "Your subscription will not renew and will end on:",
      noActiveSubscription: "You currently have no active subscription",
      manageSubscription: "Manage Subscription",
      viewPlans: "View Plans"
    },
    credits: {
      title: "Credit Balance",
      available: "Available Credits",
      totalPurchased: "Total Purchased",
      totalConsumed: "Total Used",
      recentTransactions: "Recent Transactions",
      buyMore: "Buy More Credits",
      types: {
        purchase: "Purchase",
        bonus: "Bonus",
        consumption: "Used",
        refund: "Refund",
        adjustment: "Adjustment"
      },
      descriptions: {
        ai_chat: "AI Chat",
        ai_image_generation: "AI Image Generation",
        ai_video_generation: "AI Video Generation",
        image_generation: "Image Generation",
        document_processing: "Document Processing",
        purchase: "Credit Purchase",
        bonus: "Bonus Credits",
        refund: "Credit Refund",
        adjustment: "Admin Adjustment"
      },
      table: {
        type: "Type",
        description: "Description",
        amount: "Amount",
        time: "Time"
      }
    },
    account: {
      title: "Account Details",
      memberSince: "Member since",
      phoneNumber: "Phone Number"
    },
    orders: {
      title: "Order History",
      status: {
        pending: "Pending",
        paid: "Paid",
        failed: "Failed",
        refunded: "Refunded",
        canceled: "Canceled"
      },
      provider: {
        stripe: "Stripe",
        wechat: "WeChat Pay",
        creem: "Creem",
        alipay: "Alipay"
      },
      noOrders: "No orders found",
      noOrdersDescription: "You haven't placed any orders yet",
      viewAllOrders: "View All Orders",
      orderDetails: {
        orderId: "Order ID",
        amount: "Amount",
        plan: "Plan",
        status: "Status",
        provider: "Payment Method",
        createdAt: "Created"
      },
      recent: {
        title: "Recent Orders",
        showingRecent: "Showing {count} most recent orders"
      },
      page: {
        title: "All Orders",
        description: "View and manage all your orders",
        backToDashboard: "Back to Dashboard",
        totalOrders: "Total {count} orders"
      }
    },
    linkedAccounts: {
      title: "Linked Accounts",
      connected: "Connected",
      connectedAt: "Connected:",
      noLinkedAccounts: "No linked accounts",
      providers: {
        credential: "Email & Password",
        google: "Google",
        github: "GitHub",
        facebook: "Facebook",
        apple: "Apple",
        discord: "Discord",
        wechat: "WeChat",
        "phone-number": "Phone Number"
      }
    },
    tabs: {
      profile: {
        title: "Profile",
        description: "Manage your personal information and avatar"
      },
      account: {
        title: "Account Management",
        description: "Password changes, linked accounts and security"
      },
      security: {
        title: "Security",
        description: "Password and security settings"
      },
      subscription: {
        description: "Manage your subscription plan and features"
      },
      credits: {
        title: "Credits",
        description: "View your credit balance and transactions"
      },
      orders: {
        description: "View your order history and transactions"
      },
      content: {
        profile: {
          title: "Profile",
          subtitle: "This is how others will see you on the site.",
          username: {
            label: "Username",
            value: "shadcn",
            description: "This is your public display name. It can be your real name or a pseudonym. You can only change this once every 30 days."
          },
          email: {
            label: "Email",
            placeholder: "Select a verified email to display",
            description: "You can manage verified email addresses in your email settings."
          }
        },
        account: {
          title: "Account Settings",
          subtitle: "Manage your account settings and preferences.",
          placeholder: "Account settings content..."
        },
        security: {
          title: "Security Settings",
          subtitle: "Manage your password and security settings.",
          placeholder: "Security settings content..."
        }
      }
    },
    quickActions: {
      title: "Quick Actions",
      editProfile: "Edit Profile",
      accountSettings: "Account Settings",
      subscriptionDetails: "Subscription Details",
      getSupport: "Get Support",
      viewDocumentation: "View Documentation"
    },
    accountManagement: {
      title: "Account Management",
      changePassword: {
        title: "Change Password",
        description: "Update your account password",
        oauthDescription: "Password management is not available for social login accounts",
        button: "Change Password",
        dialogDescription: "Please enter your current password and choose a new one",
        form: {
          currentPassword: "Current Password",
          currentPasswordPlaceholder: "Enter your current password",
          newPassword: "New Password",
          newPasswordPlaceholder: "Enter new password (minimum 8 characters)",
          confirmPassword: "Confirm New Password",
          confirmPasswordPlaceholder: "Confirm your new password",
          cancel: "Cancel",
          submit: "Update Password"
        },
        success: "Password updated successfully",
        errors: {
          required: "Please fill in all required fields",
          mismatch: "New passwords do not match",
          minLength: "Password must be at least 8 characters long",
          failed: "Failed to update password. Please try again."
        }
      },
      deleteAccount: {
        title: "Delete Account",
        description: "Permanently delete your account and all associated data",
        button: "Delete Account",
        confirmTitle: "Delete Account",
        confirmDescription: "Are you absolutely sure you want to delete your account?",
        warning: "⚠️ This action cannot be undone",
        consequences: {
          data: "All your personal data will be permanently deleted",
          subscriptions: "Active subscriptions will be cancelled",
          access: "You will lose access to all premium features"
        },
        form: {
          cancel: "Cancel",
          confirm: "Yes, Delete My Account"
        },
        success: "Account deleted successfully",
        errors: {
          failed: "Failed to delete account. Please try again."
        }
      }
    },
    roles: {
      admin: "Administrator",
      user: "User"
    }
  },
  home: {
    metadata: {
      title: "TinyShip - Modern Full-Stack SaaS Development Starter",
      description: "A modern, full-featured monorepo starter kit for building SaaS applications with support for both domestic (China) and international markets. Built with Next.js/Nuxt.js, TypeScript, and comprehensive authentication.",
      keywords: "SaaS, monorepo, starter kit, Next.js, Nuxt.js, TypeScript, authentication, i18n, China market, international"
    },
    hero: {
      title: "Though it's a small boat, it can take you far",
      titlePrefix: "Though it's a small ",
      titleHighlight: "boat",
      titleSuffix: ", it can take you far",
      subtitle: "Modern full-stack SaaS development platform with dual-market support for both domestic and international markets. One purchase, lifetime use, quickly build your business project.",
      buttons: {
        purchase: "Buy Now",
        demo: "View Demo"
      },
      features: {
        lifetime: "One purchase, lifetime use",
        earlyBird: "Early bird pricing - limited time"
      }
    },
    features: {
      title: "Full-Stack SaaS Development Platform",
      subtitle: "From triple-framework support to AI integration, from globalization to localization, TinyShip provides complete modern technology solutions for your business projects.",
      items: [
        {
          title: "Triple Framework Support",
          description: "Flexibly choose Next.js, Nuxt.js, or TanStack Start — React and Vue developers alike can find familiar tech stacks while enjoying the same powerful backend capabilities.",
          className: "col-span-1 row-span-1"
        },
        {
          title: "Comprehensive Authentication",
          description: "Enterprise-grade authentication system based on Better-Auth, supporting email/phone/OAuth login, 2FA multi-factor authentication, session management and complete authentication system.",
          className: "col-span-1 row-span-1"
        },
        {
          title: "Global + Localization",
          description: "Supports international markets with Stripe and OAuth login, also deeply adapts to China's domestic market with WeChat login and WeChat Pay, seamlessly covering dual markets.",
          className: "col-span-2 row-span-1"
        },
        {
          title: "Modern Technology Stack",
          description: "Uses latest technologies: TailwindCSS v4, shadcn/ui, Magic UI, TypeScript, Zod type-safe validation, excellent development experience.",
          className: "col-span-1 row-span-1"
        },
        {
          title: "No Vendor Lock-in Architecture",
          description: "Open Monorepo architecture with libs abstract interface design, freely choose any cloud service providers, databases, payment providers, avoid technology binding.",
          className: "col-span-2 row-span-1"
        },
        {
          title: "Communication Service Integration",
          description: "Multi-channel communication support: email services (Resend/SendGrid), SMS services (Alibaba Cloud/Twilio), global communication without barriers.",
          className: "col-span-1 row-span-1"
        },
        {
          title: "AI Development Ready",
          description: "Integrated Vercel AI SDK, supports multiple AI providers, built-in Cursor development rules, AI-assisted development, intelligent application building.",
          className: "col-span-1 row-span-1"
        },
        {
          title: "Theme System",
          description: "Modern theme system based on shadcn/ui with dark mode support, deep customization and branding, making applications have unique visual experience.",
          className: "col-span-1 row-span-1"
        }
      ],
      techStack: {
        title: "Built on Modern Technology Stack",
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
      title: "Core Application Features",
      subtitle: "From dual-system support for domestic and international markets to AI integration, TinyShip provides complete technical solutions for your business projects.",
      items: [
        {
          title: "Dual System Support",
          subtitle: "One codebase, dual market coverage",
          description: "Perfect adaptation to different market needs domestically and internationally. Domestic support for WeChat login, phone login, WeChat Pay, Alipay and other localized features; International support for mainstream OAuth login (Google, GitHub, Apple), Stripe, Creem and PayPal payment systems. One codebase, dual market coverage.",
          highlights: [
            "WeChat login, phone login",
            "OAuth login (Google, GitHub, Apple)",
            "Domestic payments: WeChat Pay, Alipay",
            "International payments: Stripe, Creem, PayPal"
          ],
          imageTitle: "Dual System Architecture"
        },
        {
          title: "Triple Framework Support",
          subtitle: "Next.js, Nuxt.js, and TanStack Start — choose your stack",
          description: "Industry's first SaaS boilerplate supporting three major frameworks simultaneously. React developers can choose Next.js or TanStack Start, Vue developers go with Nuxt.js — each framework implements its own backend routes, while sharing core logic (database, auth, payments, AI, etc.) through a monorepo libs layer. Switch frameworks without rewriting business code.",
          highlights: [
            "Next.js (React, App Router)",
            "Nuxt.js (Vue, Nitro)",
            "TanStack Start (React, Vite)",
            "Shared libs core logic layer"
          ],
          imageTitle: "Triple Framework Architecture"
        },
        {
          title: "Built-in Admin Panel",
          subtitle: "Enterprise-grade management backend, ready to use",
          description: "Ready-to-use management backend providing lightweight user management, subscription management, order management and other functions. Built on modern UI component library, supports role permission control, real-time data monitoring and other functions. Let you focus on business logic, not repetitive management interface development.",
          highlights: [
            "User management",
            "Subscription management",
            "Role permission control",
            "Order management"
          ],
          imageTitle: "Management Backend"
        },
        {
          title: "AI Ready Integration",
          subtitle: "Chat, image, video — full AI capability out of the box",
          description: "Complete AI solution built on Vercel AI SDK. Not just a simple chat demo — includes AI conversation, AI image generation, and AI video generation, all with multi-provider extensible architecture. Supports streaming responses, credits-based billing, and multiple model switching (OpenAI, Claude, Gemini, etc.), letting your application be AI-ready from day one.",
          highlights: [
            "AI Chat (multi-model streaming)",
            "AI Image Generation (multi-provider)",
            "AI Video Generation (multi-provider)",
            "Credits billing system"
          ],
          imageTitle: "AI Integration"
        }
      ]
    },
    stats: {
      title: "Trusted Choice",
      items: [
        {
          value: "10000",
          suffix: "+",
          label: "Users Choice"
        },
        {
          value: "3",
          suffix: "",
          label: "Frontend Framework Support"
        },
        {
          value: "50",
          suffix: "+",
          label: "Built-in Feature Modules"
        },
        {
          value: "99",
          suffix: "%",
          label: "User Satisfaction"
        }
      ]
    },
    testimonials: {
      title: "Real User Feedback",
      items: [
        {
          quote: "The early bird price was so worth it! Complete source code and lifetime updates helped me quickly build my own SaaS project, paid back in a month.",
          author: "Zhang Wei",
          role: "Independent Developer"
        },
        {
          quote: "Technical support is great, problems are solved quickly. Dual framework support allows the team to choose familiar tech stacks.",
          author: "Li Xiaoming",
          role: "Startup CTO"
        },
        {
          quote: "International features are particularly useful, internationalization and payments are all configured, saving us a lot of development time.",
          author: "Wang Fang",
          role: "Product Manager"
        }
      ]
    },
    finalCta: {
      title: "Ready to start your voyage?",
      subtitle: "Join thousands of users and use TinyShip to quickly build your next business project. Though it's a small boat, it's enough to take you to the shore of success. Early bird pricing only for first 100 users!",
      buttons: {
        purchase: "Buy Now ¥299",
        demo: "View Demo"
      }
    },
    footer: {
      copyright: "© {year} TinyShip. All rights reserved.",
      description: "TinyShip"
    },
    common: {
      demoInterface: "Feature Demo Interface",
      techArchitecture: "Enterprise-grade technical architecture, production-verified",
      learnMore: "Learn More"
    }
  },
  ai: {
    metadata: {
      title: "TinyShip - AI Assistant",
      description: "Interact with powerful AI models including GPT-4, Qwen, and DeepSeek. Get AI assistance for coding, writing, and problem-solving.",
      keywords: "AI, assistant, chatbot, GPT-4, artificial intelligence, machine learning, conversation"
    },
    chat: {
      title: "AI Assistant",
      description: "A simple implementation of large model conversation with extensible design, using the latest technologies ai-sdk / ai-elements / streamdown to achieve very smooth chat effects, can be extended to more complex functions as needed",
      placeholder: "What can I help you with?",
      sending: "Sending...",
      thinking: "AI is thinking...",
      noMessages: "Start a conversation with the AI assistant",
      welcomeMessage: "Hello! I'm your AI assistant. How can I help you today?",
      toolCall: "Tool Call",
      providers: {
        title: "AI Provider",
        openai: "OpenAI",
        qwen: "Qwen",
        deepseek: "DeepSeek"
      },
      models: {
        "gpt-5": "GPT-5",
        "gpt-5-codex": "GPT-5 Codex",
        "gpt-5-pro": "GPT-5 Pro",
        "qwen-max": "Qwen Max",
        "qwen-plus": "Qwen Plus", 
        "qwen-turbo": "Qwen Turbo",
        "deepseek-chat": "DeepSeek Chat",
        "deepseek-coder": "DeepSeek Coder"
      },
      actions: {
        send: "Send",
        copy: "Copy",
        copied: "Copied!",
        retry: "Retry",
        dismiss: "Dismiss",
        newChat: "New Chat",
        clearHistory: "Clear History"
      },
      errors: {
        failedToSend: "Failed to send message. Please try again.",
        networkError: "Network error. Please check your connection.",
        invalidResponse: "Invalid response from AI. Please try again.",
        rateLimited: "Too many requests. Please wait a moment.",
        subscriptionRequired: "AI features require an active subscription",
        subscriptionRequiredDescription: "Upgrade to a premium plan to access AI chat features",
        insufficientCredits: "Insufficient Credits",
        insufficientCreditsDescription: "You need credits or a subscription to use AI chat. Purchase credits to continue."
      },
      history: {
        title: "Chat History",
        empty: "No chat history",
        today: "Today",
        yesterday: "Yesterday",
        thisWeek: "This Week",
        older: "Older"
      }
    },
    image: {
      metadata: {
        title: "TinyShip - AI Image Generation",
        description: "Generate stunning images using AI. Powered by Qwen-Image, fal.ai Flux, OpenAI DALL-E, and Google Gemini.",
        keywords: "AI, image generation, DALL-E, Flux, Qwen, Gemini, text to image, art, creative"
      },
      title: "AI Image Generation",
      description: "Generate stunning images from text prompts using multiple AI providers",
      defaultPrompt: "A yellow Labrador wearing black and gold round sunglasses drinking tea with two yellow and white cats in a venue in Chengdu",
      prompt: "Prompt",
      promptPlaceholder: "Describe the image you want to generate...",
      negativePrompt: "Negative Prompt",
      negativePromptPlaceholder: "Describe what you don't want in the image...",
      negativePromptHint: "Describe elements to avoid in the generated image",
      generate: "Generate",
      generating: "Generating...",
      generatedSuccessfully: "Image generated successfully!",
      download: "Download",
      result: "Result",
      idle: "Idle",
      preview: "Preview",
      json: "JSON",
      whatNext: "What would you like to do next?",
      costInfo: "Your request will cost",
      perMegapixel: "per megapixel",
      credits: "credits",
      providers: {
        title: "Provider",
        qwen: "Aliyun BaiLian",
        fal: "fal.ai",
        openai: "OpenAI",
        gemini: "Google Gemini"
      },
      models: {
        "qwen-image-plus": "Qwen Image Plus",
        "qwen-image-max": "Qwen Image Max",
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
        title: "Additional Settings",
        showMore: "More",
        showLess: "Less",
        imageSize: "Image Size",
        imageSizeHint: "Select the aspect ratio and resolution",
        numInferenceSteps: "Num Inference Steps",
        numInferenceStepsHint: "More steps = higher quality but slower",
        guidanceScale: "Guidance Scale",
        guidanceScaleHint: "How closely to follow the prompt",
        seed: "Seed",
        seedHint: "Use the same seed to reproduce results",
        random: "random",
        randomize: "Randomize",
        promptExtend: "Prompt Extend",
        promptExtendHint: "AI will enhance and expand your prompt",
        watermark: "Watermark",
        watermarkHint: "Add Qwen-Image watermark to the generated image",
        syncMode: "Sync Mode",
        syncModeHint: "Return base64 data instead of URL"
      },
      errors: {
        generationFailed: "Image generation failed",
        invalidPrompt: "Please enter a valid prompt",
        insufficientCredits: "Insufficient Credits",
        insufficientCreditsDescription: "You need credits to generate images. Purchase credits to continue.",
        networkError: "Network error. Please check your connection.",
        unknownError: "An unknown error occurred"
      }
    },
    video: {
      metadata: {
        title: "TinyShip - AI Video Generation",
        description: "Generate stunning videos using AI. Powered by fal.ai, Volcengine Seedance, and Aliyun Wanxiang.",
        keywords: "AI, video generation, text to video, Seedance, Wanxiang, Luma, creative"
      },
      title: "AI Video Generation",
      description: "Generate stunning videos from text prompts using multiple AI providers",
      defaultPrompt: "A cat jumps directly from someone's lap onto the sofa",
      prompt: "Prompt",
      model: "Model",
      promptPlaceholder: "Describe the video you want to generate...",
      generate: "Generate Video",
      generating: "Generating video...",
      generatedSuccessfully: "Video generated successfully!",
      download: "Download Video",
      result: "Result",
      idle: "Enter a prompt to generate a video",
      whatNext: "What would you like to do next?",
      credits: "Credits",
      providers: {
        title: "Provider",
        fal: "fal.ai",
        volcengine: "Volcengine",
        aliyun: "Aliyun Wanxiang"
      },
      models: {
        "kling-video/v2.5-turbo/pro/text-to-video": "Kling 2.5 Turbo Pro (Text to Video)",
        "kling-video/v2.5-turbo/pro/image-to-video": "Kling 2.5 Turbo Pro (Image to Video)",
        "doubao-seedance-1-5-pro-251215": "Doubao Seedance 1.5 Pro",
        "doubao-seedance-1-0-pro-250528": "Doubao Seedance 1.0 Pro",
        "wan2.6-t2v": "Wanxiang 2.6 T2V",
        "wan2.5-t2v-turbo": "Wanxiang 2.5 T2V Turbo",
        "wan2.6-i2v-flash": "Wanxiang 2.6 I2V Flash"
      },
      inputMode: {
        label: "Generation Mode",
        text: "Text to Video",
        firstFrame: "First Frame",
        firstLastFrame: "First + Last Frame",
        firstLastFrameUnsupported: "Current provider supports first frame only"
      },
      frameInput: {
        title: "Frame Images",
        hint: "Use URL directly, or upload to Cloudflare R2.",
        firstFrameUrl: "First Frame URL",
        lastFrameUrl: "Last Frame URL",
        upload: "Upload",
        uploadedToR2: "Frame uploaded to R2",
        preview: "Image Preview",
        previewAlt: "First frame preview"
      },
      settings: {
        title: "Additional Settings",
        videoSize: "Video Size / Aspect Ratio",
        videoSizePlaceholder: "Select size",
        videoSizeHint: "Select the resolution or aspect ratio",
        duration: "Duration (seconds)",
        durationHint: "Length of the generated video",
        seed: "Seed",
        seedHint: "Use the same seed to reproduce results",
        random: "random",
        loop: "Loop",
        loopHint: "Whether the video should loop seamlessly",
        motionStrength: "Motion Strength",
        motionStrengthHint: "Controls how much motion appears in the video",
        promptExtend: "Prompt Extend",
        promptExtendHint: "AI will enhance and expand your prompt",
        watermark: "Watermark",
        watermarkHint: "Add watermark to the generated video"
      },
      errors: {
        generationFailed: "Video generation failed",
        invalidPrompt: "Please enter a valid prompt",
        firstFrameRequired: "Please provide a first frame URL",
        lastFrameRequired: "Please provide a last frame URL",
        unsupportedImageType: "Only JPEG/JPG/PNG/WEBP/BMP images are supported",
        imageTooLarge: "Image size must be less than or equal to 10MB",
        uploadFailed: "Upload failed",
        unsupportedModeForProvider: "Current provider does not support this generation mode",
        insufficientCredits: "Insufficient Credits",
        insufficientCreditsDescription: "You need credits to generate videos. Purchase credits to continue.",
        networkError: "Network error. Please check your connection.",
        unknownError: "An unknown error occurred",
        timeout: "Video generation timed out. Please try again."
      },
      resultPanel: {
        generatingHint: "Video generation may take 1-5 minutes...",
        videoTagUnsupported: "Your browser does not support the video tag."
      }
    }
  },
  premiumFeatures: {
    metadata: {
      title: "TinyShip - Premium Features",
      description: "Explore all the premium features available with your subscription. Access advanced tools, AI assistance, and enhanced functionality.",
      keywords: "premium, features, advanced, tools, subscription, benefits, enhanced"
    },
    title: "Premium Features",
    description: "Thank you for your subscription! Here are all the premium features you can now access.",
    loading: "Loading...",
    subscription: {
      title: "Your Subscription",
      description: "Current subscription status and details",
      status: "Subscription Status",
      type: "Subscription Type",
      expiresAt: "Expires At",
      active: "Active",
      inactive: "Inactive",
      lifetime: "Lifetime Member",
      recurring: "Recurring Subscription"
    },
    badges: {
      lifetime: "Lifetime Member"
    },
    demoNotice: {
      title: "🎯 SaaS Template Demo Page",
      description: "This is a demo page for testing route protection. Only paying users can access this page, demonstrating how to implement subscription-level access control in your SaaS application."
    },
    features: {
      userManagement: {
        title: "Advanced User Management",
        description: "Complete user profile management and custom settings"
      },
      aiAssistant: {
        title: "AI Smart Assistant",
        description: "Advanced artificial intelligence features to boost productivity"
      },
      documentProcessing: {
        title: "Unlimited Document Processing",
        description: "Process any number and size of document files"
      },
      dataAnalytics: {
        title: "Detailed Data Analytics",
        description: "In-depth data analysis and visualization reports"
      }
    },
    actions: {
      accessFeature: "Access Feature"
    }
  },
  validators: {
    user: {
      name: {
        minLength: "Name must be at least {min} characters",
        maxLength: "Name must be less than {max} characters"
      },
      email: {
        invalid: "Please enter a valid email address"
      },
      image: {
        invalidUrl: "Please enter a valid URL"
      },
      password: {
        minLength: "Password must be at least {min} characters",
        maxLength: "Password must be less than {max} characters",
        mismatch: "Passwords don't match"
      },
      countryCode: {
        required: "Please select country/region"
      },
      phoneNumber: {
        required: "Please enter phone number",
        invalid: "Invalid phone number format"
      },
      verificationCode: {
        invalidLength: "Verification code must be {length} characters"
      },
      id: {
        required: "User ID is required"
      },
      currentPassword: {
        required: "Current password is required"
      },
      confirmPassword: {
        required: "Please confirm your password"
      },
      deleteAccount: {
        confirmRequired: "You must confirm account deletion"
      }
    },
    blog: {
      title: {
        required: "Title is required",
        maxLength: "Title must be less than {max} characters",
      },
      slug: {
        maxLength: "Slug must be less than {max} characters",
        invalid: "Slug can only contain lowercase letters, numbers, and hyphens",
      },
      excerpt: {
        maxLength: "Excerpt must be less than {max} characters",
      },
      coverImage: {
        invalidUrl: "Please enter a valid URL for the cover image",
      },
      status: {
        invalid: "Status must be either draft or published",
      },
    },
  },
  countries: {
    china: "China",
    usa: "United States",
    uk: "United Kingdom",
    japan: "Japan",
    korea: "South Korea",
    singapore: "Singapore",
    hongkong: "Hong Kong",
    macau: "Macau",
    australia: "Australia",
    france: "France",
    germany: "Germany",
    india: "India",
    malaysia: "Malaysia",
    thailand: "Thailand"
  },
  header: {
    navigation: {
      ai: "AI Demo",
      premiumFeatures: "Premium Features",
      pricing: "Pricing",
      upload: "Upload",
      demos: "Demos",
      demosDescription: "Explore example features",
      blog: "Blog"
    },
    demos: {
      ai: {
        title: "AI Chat",
        description: "LLM chat with extensible design, multi-provider support. Login required."
      },
      aiImage: {
        title: "AI Image Generation",
        description: "AI image generation with extensible design, multi-provider support. Login required."
      },
      aiVideo: {
        title: "AI Video Generation",
        description: "AI video generation with extensible design, multi-provider support. Login required."
      },
      premium: {
        title: "Premium Features",
        description: "Route protection demo. Only paid users can access this page."
      },
      upload: {
        title: "File Upload",
        description: "File upload with extensible design, multi-provider support. Login required."
      }
    },
    auth: {
      signIn: "Sign In",
      getStarted: "Get Started",
      signOut: "Sign Out"
    },
    userMenu: {
      dashboard: "Dashboard",
      profile: "Profile",
      settings: "Settings",
      personalSettings: "Personal Settings",
      adminPanel: "Admin Panel"
    },
    language: {
      switchLanguage: "Switch Language",
      english: "English",
      chinese: "中文",
      korean: "한국어"
    },
    mobile: {
      themeSettings: "Theme Settings",
      languageSelection: "Language Selection"
    }
  },
  docs: {
    home: {
      title: "TinyShip Docs",
      subtitle: "Built with Fumadocs",
      description: "A static site project based on Fumadocs, perfect for documentation, blogs, and static pages.",
      cta: {
        docs: "Read Docs",
        blog: "Visit Blog"
      }
    },
    nav: {
      docs: "Docs",
      blog: "Blog"
    },
    blog: {
      title: "Blog",
      description: "Latest articles and updates from the TinyShip team",
      allPosts: "All Posts",
      previousPage: "← Previous",
      nextPage: "Next →",
      back: "← Back to Blog",
      noPosts: "No posts yet"
    }
  },
  upload: {
    title: "Upload Files",
    description: "Upload images to cloud storage",
    providerTitle: "Storage Provider",
    providerDescription: "Select your preferred cloud storage provider",
    providers: {
      oss: "Alibaba Cloud OSS",
      ossDescription: "China-optimized storage",
      s3: "Amazon S3",
      s3Description: "Global cloud storage",
      r2: "Cloudflare R2",
      r2Description: "Zero egress fees",
      cos: "Tencent Cloud COS",
      cosDescription: "China cloud storage"
    },
    uploadTitle: "Upload Image",
    uploadDescription: "Drag and drop image or click to browse. Max 1MB.",
    dragDrop: "Drag & drop file here",
    orClick: "Or click to browse (max 1MB)",
    browseFiles: "Browse files",
    clearAll: "Clear all",
    uploadedTitle: "Uploaded Files",
    uploadedDescription: "{count} file(s) uploaded successfully",
    uploading: "Uploading...",
    viewFile: "View",
    uploaded: "Uploaded",
    errors: {
      maxFiles: "You can only upload 1 file",
      imageOnly: "Only image files are allowed",
      fileTooLarge: "File size must be less than 1MB"
    }
  },
  blog: {
    metadata: {
      title: "TinyShip - Blog",
      description: "Read the latest articles and updates from the TinyShip team.",
      keywords: "blog, articles, updates, TinyShip, SaaS"
    },
    title: "Blog",
    subtitle: "Latest articles and updates",
    readMore: "Read More",
    publishedOn: "Published on",
    by: "by",
    noPosts: "No posts yet. Check back soon!",
    backToBlog: "Back to Blog"
  },
  kcs: {
    ...kcsConsoleCopy.en,
    metric: {
      followers: "Followers",
      followerGrowth: "Follower gain",
      followerGrowthRate: "Growth rate",
      readFanRatio: "Share of reads from fans",
      activeFanRatio: "Active fans",
      engagedFanRatio: "Engaged fans",
      fanInteractionRatio: "Interacting fan ratio",
      impressionMedian: "Median impressions",
      readMedian: "Median reads",
      interactionMedian: "Median interactions",
      likeMedian: "Median likes",
      collectMedian: "Median saves",
      commentMedian: "Median comments",
      coopReadMedian: "Sponsored median reads",
      coopInteractionMedian: "Sponsored median interactions",
      engagementRate: "Engagement rate",
      completionRate: "Video completion rate",
      read3sRate: "3s read rate",
      noteCount: "Posts",
      viralCount: "Viral posts",
      viralRate: "Viral rate",
      priceImage: "Image quote",
      priceVideo: "Video quote",
      cpr: "Cost per read",
      cpe: "CPE",
      cpeVideo: "Video CPE",
      cpm: "CPM (per 1,000 impressions)",
      cpmRead: "Cost per 1,000 reads",
      collectLikeRatio: "Saves / likes",
      purchaseIntentCommentRatio: "Purchase-intent comments",
      trafficSearchRatio: "Search traffic",
      trafficRecommendRatio: "Feed traffic",
      trafficFollowRatio: "Following traffic",
      readToFollowerRatio: "Reads as a share of followers",
      storeVisitUvMedian: "Median store visitors",
      storeVisitUnitPrice: "Cost per store visitor",
      authenticity: "Follower authenticity",
      coopNoteCount: "Sponsored posts (30 days)"
    },
    metricHelp: {
      followers: "Total followers shown on profile. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      followerGrowth: "Net new followers within the period. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      followerGrowthRate: "New followers ÷ start followers. Calculated by system; shown as — if unavailable.",
      readFanRatio: "Share of everyday reads that come from followers. Neither high nor low is simply better, so it is shown for reference and not ranked. Provided by Pugongying; shown as — if unavailable.",
      fanInteractionRatio: "Interacting fan ratio as given by Xinhong. Xinhong does not publish how it is calculated, so it is shown for reference and not ranked. Shown as — if unavailable.",
      activeFanRatio: "Followers active on Xiaohongshu in the past 28 days. Provided by Pugongying; shown as — if unavailable.",
      engagedFanRatio: "Followers who liked, saved or commented on a post in the past 28 days. Provided by Pugongying; shown as — if unavailable.",
      impressionMedian: "Median public feed impressions per post in the period. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      readMedian: "Median actual reads per post in the period. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      interactionMedian: "Median sum of likes, saves, and comments per post. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      likeMedian: "Median likes per post. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      collectMedian: "Median saves per post, reflecting buying interest. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      commentMedian: "Median comments per post. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      coopReadMedian: "Median reads on official sponsored posts. Provided by Pugongying; shown as — if unavailable.",
      coopInteractionMedian: "Median interactions on official sponsored posts. Provided by Pugongying; shown as — if unavailable.",
      engagementRate: "Likes, saves and comments per 100 reads, shares not included. Qiangua and Xinhong reads are estimates. Calculated by system or Pugongying; shown as — if unavailable.",
      completionRate: "Share of video views watched to the end. Provided by Pugongying or partner platforms; shown as — if unavailable.",
      read3sRate: "Share of image-post reads that last 3 seconds or more. Provided by Pugongying; shown as — if unavailable.",
      noteCount: "Total public posts published in the period. More is not simply better, so it is shown for reference and not ranked. Provided by Xiaohongshu or partner platforms; shown as — if unavailable.",
      viralCount: "Each platform defines a viral post differently: Pugongying counts posts with 1,000+ likes; Qiangua counts 1,000 likes within 12 hours or 5,000 in total; Xinhong publishes no definition. Do not compare across sources. Shown as — if unavailable.",
      viralRate: "Viral posts ÷ total posts. Unstable with fewer than 5 posts, and definitions differ by platform, so do not compare across sources. Calculated by system; shown as — if unavailable.",
      priceImage: "Official quote for a sponsored image post (CNY). Provided by Pugongying; shown as — if unavailable.",
      priceVideo: "Official quote for a sponsored video post (CNY). Provided by Pugongying; shown as — if unavailable.",
      cpr: "Quote ÷ sponsored median reads: roughly what one read costs. Uses everyday reads when there are no sponsored reads. Calculated by system; shown as — if unavailable.",
      cpeVideo: "Video quote ÷ sponsored median interactions, kept apart from the image CPE. Calculated by system; shown as — if unavailable.",
      cpe: "Estimated cost per interaction at the list price (quote ÷ sponsored median interactions), before booking. Platform service fees (10% standard, 20% performance mode) are not included, so the real cost is usually higher. Calculated by system or Pugongying; shown as — if unavailable.",
      cpm: "Roughly what 1,000 impressions cost: the figure Pugongying gives, or image quote ÷ median impressions × 1,000. Provided by Pugongying or calculated by system; shown as — if unavailable.",
      cpmRead: "Roughly what 1,000 reads cost (Qiangua and Xinhong call this CPM; it is not the impressions-based CPM). Provided by partner platforms or calculated by system; shown as — if unavailable.",
      collectLikeRatio: "Median saves ÷ median likes, compared only within similar content. Not the same as Qiangua's like-and-save ratio, which is (likes + saves) ÷ followers. Calculated by system; shown as — if unavailable.",
      purchaseIntentCommentRatio: "Share of comments asking where to buy, the price or the shade. No platform provides this yet, so it is hidden for now.",
      trafficSearchRatio: "Share of reads originating from search. It moves opposite to feed traffic, so it is shown for reference and not ranked. Provided by Pugongying; shown as — if unavailable.",
      trafficRecommendRatio: "Share of reads originating from Explore recommendation feed. It moves opposite to search traffic, so it is shown for reference and not ranked. Provided by Pugongying; shown as — if unavailable.",
      trafficFollowRatio: "Share of reads originating from following tab. Provided by Pugongying; shown as — if unavailable.",
      readToFollowerRatio: "Median everyday reads ÷ followers: a typical post's reads as a percentage of the follower count; above 100% means more people read it than follow the account. Higher means the platform is pushing it further. Calculated by system; shown as — if unavailable.",
      storeVisitUvMedian: "Visitors that sponsored posts brought to the store (median). Provided by Pugongying; shown as — if unavailable.",
      storeVisitUnitPrice: "Roughly what one store visitor from a sponsored post costs. Provided by Pugongying; shown as — if unavailable.",
      authenticity: "Estimated percentage of authentic followers sampled. Provided by partner data platforms; shown as — if unavailable.",
      coopNoteCount: "Sponsored posts filed through Pugongying in the past 30 days, not a lifetime total. Provided by Pugongying; shown as — if unavailable."
    },
    metricGroup: {
      scale: "Scale",
      reach: "Reach",
      cost: "Cost",
      conversion: "Conversion signals",
      potential: "Potential",
      trust: "Trust"
    },
    tier: {
      label: "Follower tier",
      head: "Head",
      mid: "Mid",
      junior: "Junior",
      amateur: "Amateur",
      unknown: "Unknown",
      hint: "Head ≥ 500K · Mid 50K – 500K · Junior 5K – 50K · Amateur 300 – 5K (Qiangua's standard tiers)"
    },
    health: {
      label: "Health grade",
      healthy: "Healthy",
      excellent: "Healthy",
      normal: "Healthy",
      abnormal: "Abnormal",
      unknown: "Unrated",
      lowActive: "Low activity",
      lowActiveHint: "Marked as low activity by Pugongying. This is separate from the health grade.",
      hint: "Rated by Xiaohongshu on the 1st of each month, healthy or abnormal only, based on violations, fake engagement, undisclosed ads and delivery. Abnormal creators cannot be booked. Low activity is flagged separately and is not part of the grade."
    },
    band: {
      legend: "Colour = position among similar creators already in our library (same source, period and content type, similar follower count), not a platform-wide ranking; under 30 creators is for reference only. Dot = highlight alert",
      cohort: "{source} · last {window} days, {n} creators of this kind in our library",
      cohortLibrary: "Our library: compared with {n} similar {source} creators ({min}–{max} followers)",
      cohortUnknown: "Our library: compared with {n} {source} creators whose follower count is unknown",
      stale: "Data is more than 60 days old, so it is not ranked",
      staleShort: "Old data",
      top10: "Top 10% of similar creators",
      top25: "Top 25% of similar creators",
      upper: "Upper half of similar creators (Top 25%–50%)",
      lower: "Lower half of similar creators (Bottom 25%–50%)",
      bottom: "Bottom quarter of similar creators",
      front: "Near the front among similar creators here (top third)",
      middle: "In the middle among similar creators here",
      back: "Near the back among similar creators here (bottom third)",
      library: "In our library",
      fewPeers: "Fewer than 30 similar creators: shown as front / middle / back only, for reference",
      platform: "Xiaohongshu officially shows this is ahead of {pct}% of similar creators",
      none: "Not enough creators to rank"
    },
    source: {
      label: "Data sources",
      pugongying: "Pugongying",
      qiangua: "Qiangua",
      xinhong: "Xinhong",
      official: "Official data",
      vendor: "Partner platforms",
      fixture: "Sample data",
      live: "Live data",
      configured: "Connected",
      notConfigured: "Not connected",
      configuredHint: "Connected. Results reflect real platform data.",
      notConfiguredHint: "Not connected yet. Showing sample data to preview layout; connection is set up by admins.",
      fetchedAt: "Fetched at",
      locked: "Recorded data at shortlist (kept as-is)"
    },
    query: {
      serviceFee: "Add platform fee",
      serviceFeeNone: "None",
      serviceFeeRate: "+{n}%",
      serviceFeeHint: "Pugongying charges a fee on top of the quote: 10% in standard mode, 20% in performance mode. When chosen, every cost figure includes the fee.",
      title: "Selection plans",
      lead: "A selection plan is a set of rules: follower tier, health threshold, performance conditions, and ranking order. Saved once, shared team-wide.",
      new: "New plan",
      unsaved: "Unsaved plan",
      name: "Plan name",
      namePlaceholder: "e.g. K-beauty cost efficiency",
      save: "Save plan",
      saveAs: "Save as",
      delete: "Delete plan",
      run: "Run plan",
      editor: "Edit plan",
      apply: "Apply",
      reset: "Reset",
      close: "Collapse",
      filters: "Selection conditions",
      addFilter: "Add condition",
      removeFilter: "Remove",
      noFilters: "No performance conditions set — viewing by tier and health grade only.",
      op: { gte: "≥", lte: "≤", between: "Between", percentileGte: "Ranking ≥", percentileLte: "Ranking ≤" },
      opLegend: { percentileGte: "ahead of {n}% of similar creators", percentileLte: "ahead of {n}% or fewer" },
      healthGate: "Health \"abnormal\" shows red and is never marked good",
      addHealthGate: "Add the health check",
      onlySources: "Only",
      allSources: "All data sources",
      reference: "Library reference · {source} {tier} ({n} creators)",
      referenceNone: "Fewer than 30 creators in this group, no reference yet",
      referenceHint: "Click to use",
      refP25: "25%",
      refP50: "Median",
      refP75: "75%",
      referenceDetail: "Library group: 25% {p25} · median {p50} · 75% {p75}",
      value: "Value",
      from: "From",
      to: "To",
      sort: "Sort",
      asc: "Ascending",
      desc: "Descending",
      columns: "Visible items",
      highlights: "Highlight alerts",
      tone: { good: "Good", warn: "Watch", bad: "Bad" },
      tiers: "Follower tiers",
      health: "Health grade",
      sources: "Data sources",
      anyTier: "All tiers",
      anyHealth: "Any",
      matched: "{n} matched",
      pageInfo: "Page {page} of {pages} · {total} creators",
      prev: "Previous",
      next: "Next",
      noResult: "No creators match this selection plan",
      version: "Edition {n}",
      saved: "Saved",
      deleted: "Deleted",
      confirmDelete: "Delete this plan? It leaves the list, but its history is kept and you can restore it at any time.",
      deletedUndo: "Undo",
      restored: "Restored",
      mine: "My plans",
      team: "Team plans",
      privateTag: "Only you can see this",
      byOwner: "Created by {name}",
      visibility: "Who can see it",
      visibilityPrivate: "Only me",
      visibilityTeam: "Whole team",
      visibilityOwnerOnly: "Only the person who created this plan can change who sees it",
      scope: "Which creators",
      categories: "Categories",
      anyCategory: "Any",
      collab: "Worked with us",
      collabAny: "Any",
      collabYes: "Yes",
      collabNo: "Not yet",
      collabCount: "Times worked together",
      collabCountMin: "At least",
      collabCountMax: "At most",
      savedSearch: "Search saved with the plan",
      savedSearchHint: "Matches name, creator ID or Xiaohongshu ID, and is applied every time this plan is opened",
      saveSearch: "Save in plan",
      clearSavedSearch: "Remove the saved search",
      savedSearchChip: "Plan search: {q}",
      filtersAll: "All of these must hold",
      groups: "Condition groups",
      groupAny: "Any of",
      groupExclude: "Leave out",
      groupAnyHint: "Keep creators who meet at least one of these",
      groupExcludeHint: "Leave out creators who meet all of these",
      addGroupAny: "Add an “any of” group",
      addGroupExclude: "Add a “leave out” group",
      removeGroup: "Remove this group",
      emptyGroup: "No conditions yet, so this group does nothing",
      revisions: "History",
      noRevisions: "No history yet",
      revisionAction: { create: "created", update: "edited", archive: "deleted", restore: "restored" },
      revisionLine: "Version {n} · {action} · {who} · {when}",
      someone: "unknown",
      useRevision: "Use this version",
      revisionLoaded: "Version {n} is in the editor. Save to make it the newest version.",
      conflict: "Someone else just changed this plan (now version {n}). The latest version is loaded; check it and save again.",
      errors: {
        "name.required": "Give the plan a name",
        "filters.between": "Range start cannot exceed the end",
        "filters.value": "Invalid condition value",
        "filters.percentile": "Ranking must be between 0 and 100",
        "filters.op": "Unknown comparison in a condition",
        "filters.key": "Unknown metric in a condition",
        "filters.tooMany": "Too many conditions (30 at most)",
        "groups.shape": "A condition group is not valid (10 groups at most, 20 conditions each)",
        "categories": "Unknown category",
        "hasCollaborated": "“Worked with us” is not valid",
        "collabCount": "Times worked together must be 0 or a whole number, and “at least” cannot exceed “at most”",
        "search": "The search can be 100 characters at most",
        "visibility": "“Who can see it” is not valid",
        "columns": "Select at least one item to show"
      }
    },
    ingest: {
      queued: "Collection started. The background will finish steadily within allowed limits and show in the records below.",
      progress: "Fetched {pages} batches · Used {calls} calls allowance",
      nextRun: "Today's allowance reached; automatically continues at {time}",
      reason: {
        SOURCE_UNAVAILABLE: "The platform did not respond; try again later",
        VENDOR_REJECTED: "The platform refused this request — usually wrong access details or conditions",
        CONFIG_MISSING: "Access details are incomplete; fill them in and try again",
        RECORD_INVALID: "This creator's information could not be read",
        RECORD_WRITE_FAILED: "This creator's information could not be saved",
        QUOTA_EXHAUSTED: "Today's allowance is used up; continues tomorrow",
        CANCELLED: "Stopped manually",
        UNKNOWN: "This run did not finish; you can retry",
      },
      retry: "Resume from where it paused",
      parked: {
        title: "Set aside",
        lead: "Runs that did not finish and creators that could not be read wait here until someone handles them.",
        empty: "Nothing set aside",
        count: "{n} set aside",
        kindJob: "Whole run",
        kindRecord: "Single creator",
        open: "Waiting",
        replayed: "Handled again",
        dismissed: "Left alone",
        replay: "Try again",
        dismiss: "Leave alone",
        exhausted: "Several tries failed; change the settings first",
        tried: "Tried {n} times",
      },
      cancel: "Stop collection",
      jobActions: "Actions",
      title: "Data sources",
      lead: "Collects creator information from platforms based on your settings, running steadily within allowed limits and organizing data into a uniform view.",
      adapters: "Channels",
      route: "Source channel",
      supports: "Supported conditions",
      provides: "Provided information",
      credentials: "Connection status",
      fetchTitle: "New collection run",
      fileImport: "Spreadsheet import",
      params: "Collection settings",
      source: "Data source",
      window: "Period",
      window30: "Last 30 days",
      window90: "Last 90 days",
      keyword: "Keyword",
      keywordPlaceholder: "K-beauty / skincare / outfit",
      category: "Category",
      region: "Region",
      followersRange: "Follower range",
      priceRange: "Quote range",
      health: "Health grade",
      limit: "Collection limit",
      byIds: "Specific {n} creators",
      run: "Start collection",
      running: "Collecting now…",
      done: "Collection finished: {written} recorded, {skipped} existing skipped, {failed} unsuccessful",
      fixtureNote: "Not connected to this platform yet. Showing sample data to help preview layout; connection is handled by admins.",
      jobs: "Collection records",
      jobSource: "Data source",
      jobMode: "Method",
      jobQuery: "Conditions",
      jobWritten: "Recorded",
      jobSkipped: "Existing",
      jobFailed: "Unsuccessful",
      jobTime: "Time",
      noJobs: "No collection records yet",
      rawTitle: "Platform original data",
      rawLead: "Original data from platforms is kept in full and can be reviewed anytime.",
      transform: "Standardized view",
      transformLead: "Data across platforms is organized into a uniform view; original data is preserved as-is for reference."
    },
    landing: {
      navWorkspaces: "Workspaces",
      navFlow: "Flow",
      navScoring: "Data",
      previewTitle: "Creator pool",
      previewMeta: "Published · CPE ascending",
      previewCols: { creator: "Creator", tier: "Follower tier", cpe: "CPE", fans: "Followers" },
      workspacesEyebrow: "Workspaces",
      workspacesTitle: "Four desks. One objective data line.",
      workspacesLead: "Ops intakes and manages creators, Select filters by plans, Dev tracks records. Distinct roles, unified underlying data.",
      flowEyebrow: "Workflow",
      flowTitle: "From an initial lead to a defensible campaign shortlist.",
      steps: [
        { title: "Intake", body: "Record display name, follower count, quote, and collaboration notes as drafts." },
        { title: "Collect", body: "Set conditions to retrieve creator data from Xiaohongshu or partner platforms into a uniform view." },
        { title: "Assign", body: "Selectors filter, sort, check, and assign creators to project shortlists with one click." },
        { title: "Track", body: "Collection progress, automatic continuation, and resume status at a glance." }
      ],
      dataEyebrow: "Data integrity",
      dataTitle: "Objective platform metrics. Zero weighted black box.",
      dataLead: "No arbitrary scoring formulas. All metrics connect directly to Pugongying official sources and partner data platforms, with calculated metrics based purely on straightforward ratios. Comparisons are only made among similar creators already in our library (same source, period and content type, similar follower count), not across the whole platform; missing values remain '—'.",
      sourcesTitle: "Two direct channels, one uniform view",
      sources: {
        pugongying: { label: "Xiaohongshu official data (Pugongying)", body: "Direct official connection: median impressions/reads/interactions, engagement rate, reads from fans, quotes, CPE, health grade, audience demographics, and brand history." },
        qiangua: { label: "Partner data platform (Qiangua)", body: "Platform connection: 90-day viral post performance, publishing frequency, follower growth consistency, and authenticity sampling." },
        xinhong: { label: "Partner data platform (Xinhong)", body: "Campaign analysis data: empirical image/video CPE, CPM, and search/recommendation traffic source breakdown." }
      },
      groupsTitle: "Six standardised metric groups",
      groups: {
        scale: "Followers, net follower growth, total posts",
        reach: "Median impressions / reads / interactions, engagement rate, 3s read / completion rate",
        cost: "Image / video quotes, cost per read (CPV), CPE, CPM",
        conversion: "Saves-to-likes ratio, purchase-intent comments, organic search traffic share",
        potential: "Reads-to-follower ratio, viral posts & rate, recommendation feed traffic share, growth rate",
        trust: "Health grade, follower authenticity, active and engaged fan ratios"
      },
      tierTitle: "Compared with similar creators",
      tierBody: "Head ≥ 500K, Mid 50K – 500K, Junior 5K – 50K, Amateur 300 – 5K. Positions are computed only among similar creators in our library, never across sources. Tiers follow Qiangua's standard.",
      gateTitle: "Health grade is a hard gate",
      gateBody: "Xiaohongshu rates health on the 1st of each month, healthy or abnormal only; abnormal creators are excluded. Low activity is flagged separately and is not abnormal.",
      transformTitle: "Standardized view & original data",
      transformLine: "Different platforms, one uniform view.",
      transformBody: "Original data provided by platforms is kept in full and can be reviewed anytime. View updates require no underlying changes.",
      values: [
        { title: "No synthetic composite scores", body: "Display objective platform metrics directly. Good or bad is determined solely by relative ranking among peers of the same platform and tier." },
        { title: "Locked data at shortlist", body: "Every collection run keeps historical records; publishing locks data permanently to keep shortlists reliable." },
        { title: "Role-based workspaces", body: "Unified team sign-in; platform admin, ops, devops, and selectors access dedicated desks." }
      ],
      ctaTitle: "Establish an objective creator selection pipeline.",
      ctaLead: "Sign in with your work email. The system routes you directly to your assigned workspace.",
      footerLinks: "Workspaces",
      footerNote: "Tide · Global Creator Intelligence"
    },
    brand: {
      title: "听潮 (Tide)",
      short: "Tide",
      name: "Tide",
      tagline: "Korean Brands × Xiaohongshu Creator Intelligence",
      story: "Collects creator information by settings, standardizes viewing criteria, and compares performance among similar creators in our library, connecting Xiaohongshu official and partner platforms.",
      eyebrow: "Cross-Border Creator Intelligence",
      pillars: "Data Sources · Selection Plans · Project Assignment · Monitoring",
      loginAside: "Single identity system. Access granted according to assigned organizational role.",
      storyExcerpt: "Return to objective platform metrics. Filter creators by structured plans and peer rankings.",
      runLabel: "Filter creators and assign to projects."
    },
    nav: {
      sources: "Data sources",
      queries: "Selection plans",
      overview: "Overview",
      creators: "Creators",
      reviews: "Risk review",
      workspaces: "Workspaces",
      ops: "Ops Desk",
      select: "Select Desk",
      monitor: "Dev Desk",
      ingest: "Collection tasks",
      accounts: "Accounts"
    },
    actions: {
      login: "Sign in",
      filter: "Filter",
      sort: "Sort",
      assign: "Assign",
      publish: "Publish",
      export: "Export"
    },
    categories: {
      collaborated: "Worked with",
      neverCollaborated: "Not yet"
    },
    states: {
      empty: "Nothing has washed up here yet.",
      emptyFilter: "No one comes ashore under these cuts.",
      error: "The signal dropped. Try again.",
      denied: "Closed",
      deniedBody: "This door stays shut, for now."
    },
    roles: {
      platform_admin: "Platform admin",
      ops: "Ops",
      devops: "DevOps",
      selector: "Selector",
      selector_viewer: "Selector (read-only)"
    },
    panel: {
      audience: "Audience demographics",
      female: "Female share",
      regions: "Geographic distribution",
      interests: "Interest tags",
      noAudience: "This platform does not provide audience demographics",
      collabBrands: "Collaborated brands",
      chooseImage: "Choose image",
      imageHint: "PNG / JPG / WebP / GIF, up to 5 MB, square recommended.",
      uploadTooLarge: "This image is over 5 MB. Please shrink it and try again.",
      uploadWrongType: "Only PNG, JPG, WebP or GIF images can be uploaded.",
      uploadFailed: "The photo did not upload. Please try again in a moment.",
      stepSaveHint: "Fill in the display name to save draft.",
      learnMore: "Explore workspaces",
      mobileHint: "Rotate screen or switch to desktop for full table view.",
      showAll: "Show all",
      clearFilters: "Clear filters",
      signOut: "Sign out",
      kpiHint: "Based on active pool",
      openRate: "Progress",
      today: "Today",
      overview: "Overview",
      quickActions: "Quick actions",
      recentActivity: "Recent activity",
      jobDistribution: "Collection status breakdown",
      untitled: "Untitled",
      preview: "Preview",
      formHint: "Saving generates a draft; publishing locks data into the creator pool.",
      publishHint: "Save as draft first, then publish to creator pool.",
      published: "Published to pool",
      stepSave: "Save draft",
      stepPublish: "Publish",
      required: "Required",
      optional: "Optional",
      xhsId: "Xiaohongshu account",
      collabQuestion: "Collaborated previously?",
      unknownFollowers: "Followers unknown",
      followersRange: "Follower range",
      priceRange: "Quote range",
      min: "Min",
      max: "Max",
      collabFilter: "Collaboration history",
      collabAny: "All",
      collabYes: "Collaborated",
      collabNo: "Never collaborated",
      sortRating: "Sort by core metric",
      sortHint: "Sort by {field}",
      members: "Creators",
      count: "Count",
      sources: "Data sources",
      batch: "Batch",
      poolLead: "Displays published active creators only; metrics and rankings are uniformly organized and stay unchanged across languages.",
      assignTo: "Assign to '{name}'",
      assignHint: "To assign creators to a project, click 'Pick from pool' on the project page.",
      picked: "{n} creators selected",
      back: "Back",
      noAssignments: "No creators assigned to this project yet. Pick candidates from the creator pool.",
      emptyProjects: "No projects created yet. Create one to begin shortlisting.",
      loading: "Loading data…",
      jobStatus: {
        ok: "Completed",
        running: "In progress",
        queued: "Waiting",
        failed: "Unsuccessful",
        partial: "Daily limit reached, continues tomorrow"
      },
      assignmentStatus: {
        assigned: "Assigned",
        removed: "Removed"
      },
      signIn: "Sign in",
      signInLead: "Sign in with your work email to access your assigned workspace.",
      email: "Email",
      password: "Password",
      enter: "Enter",
      loginError: "Invalid email or password. Please verify your credentials.",
      homeLead: "Ops intake, selection filtering, and background operations share one uniform view and set of records.",
      opsDesc: "Creator intake, data collection, and category management.",
      selectDesc: "Filter creators with selection plans, manage projects, and organize shortlists.",
      devDesc: "Check collection progress, resume pending runs, and monitor platform connections.",
      openOps: "Go to Ops Desk",
      openSelect: "Go to Select Desk",
      openDev: "Go to Dev Desk",
      denied: "Access denied",
      deniedBody: "Your account does not have access to this workspace. Contact administrator.",
      opsHome: "Ops Desk",
      createCreator: "Intake creator",
      newCreator: "Creator intake",
      displayName: "Display name",
      followers: "Followers",
      quote: "Quote",
      avatar: "Avatar",
      save: "Save",
      publish: "Publish",
      confirmPublish: "Confirm publish",
      collaborated: "Collaborated",
      neverCollaborated: "Never collaborated",
      scoreLocked: "Data locked upon publishing; not overwritten by subsequent collection.",
      draft: "Draft",
      review: "Pending review",
      ready: "Organized",
      released: "Published",
      status: "Status",
      recentBatches: "Recent batches",
      emptyBatches: "No records found.",
      projects: "Projects",
      createProject: "Create project",
      projectName: "Project name",
      note: "Notes",
      board: "Candidate shortlist",
      openLibrary: "Pick from creator pool",
      pool: "Creator pool",
      emptyPool: "No creators currently available in the pool. Run collection or add manually in Ops.",
      emptyFilter: "No creators matched current selection plan. Adjust conditions or reset filters.",
      filter: "Filter",
      sort: "Sort",
      export: "Export",
      error: "Network connection issue. Please try again later.",
      retry: "Retry",
      assign: "Assign",
      confirmAssign: "Confirm assignment",
      health: "System status",
      sqlOk: "Connected",
      storage: "Storage",
      jobs: "Collection records",
      detail: "Details",
      addToProject: "Add to project",
      chooseProject: "Select project",
      failures: "Unsuccessful records",
      pipeline: "Data flow",
      recommended: "Plan recommendations",
      library: "Creator pool",
      sampleData: "Sample data",
      rulePack: "Plan pack",
      visibleFields: "Visible items",
      weights: "Weights (deprecated)",
      defaultSort: "Default sort",
      advice: "Selection advice",
      contact: "Business contact",
      koreaRelation: "K-brand experience",
      risk: "Collaboration notes",
      conclusion: "Evaluation notes",
      org: "MCN / Agency",
      gallery: "Featured posts",
      readOnly: "Read-only"
    },
    prefs: {
      currency: "Currency",
      consentTitle: "Cookie preferences",
      consentBody: "Necessary cookies keep sign-in and security. Preference cookies remember language, currency, and appearance. You can sign in with necessary cookies only.",
      consentNecessary: "Necessary only",
      consentPreferences: "Allow preferences",
      demo: "Sample data"
    },
    toolbar: {
      language: "Language",
      theme: "Appearance",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "Follow system",
      ruleFirst: "Objective metrics. Clear plans. Human verification."
    },
    overview: {
      eyebrow: "Selection plan",
      title: "Filter creators by plan",
      lead: "Metrics and rankings come directly from platforms in a uniform view, free of weighted scores.",
      statCreators: "Creators",
      statTop50: "Candidate shortlist",
      statRecommend: "Recommended",
      statCautious: "Prudent review",
      statReject: "Not recommended",
      gradeMix: "Tier breakdown",
      nextAction: "View shortlist",
      emptyTitle: "No matching creators",
      emptyBody: "Creators will appear here after collection completes or plan conditions are adjusted."
    },
    creators: {
      trend: "Trend",
      trendLead: "One data record per day (the last collection that day); each source gets its own line, and change is compared only within a source.",
      trendHints: "Worth a look",
      trendHintsNote: "These notes are for reference only and do not affect ranking.",
      snapshots: "Show all {n} records",
      noHistory: "No records yet. Run collection once to view trends here.",
      sources: "Data sources",
      sourcesLead: "Records sharing the same Xiaohongshu account across platforms are merged into one creator.",
      lastSeen: "Updated {date}",
      eyebrow: "Creator pool",
      title: "Creators",
      lead: "Ranked according to the conditions defined in the selection plan. Nicknames and Xiaohongshu accounts remain unedited.",
      search: "Search by nickname or Xiaohongshu account",
      emptyTitle: "No matching creators found",
      emptyBody: "Reset conditions to view the full creator pool.",
      cols: {
        rank: "Rank",
        creator: "Creator",
        score: "Metric value",
        grade: "Tier",
        fans: "Followers",
        ai: "Evaluation notes",
        manual: "Manual tag"
      }
    },
    reviews: {
      eyebrow: "Evaluation",
      title: "Creator evaluation details",
      lead: "Grounding evaluation in objective platform data and peer rankings. Switching languages changes wording only, keeping records intact.",
      emptyTitle: "No evaluation records in this batch",
      emptyBody: "Evaluation summaries and contact notes will appear once candidates are shortlisted.",
      source: {
        success: "Standardized view",
        fallback: "Default template",
        pending: "Pending",
        failed: "Unsuccessful"
      },
      decision: {
        recommend: "Recommended",
        cautious: "Prudent review",
        reject: "Excluded"
      },
      alignment: {
        hard_conflict: "Hard gate exclusion (abnormal account)",
        soft_divergence: "Data alert",
        consistent: "Meets conditions",
        unknown: "Unknown"
      },
      fields: {
        reason: "Rationale",
        risk: "Collaboration notes",
        alignment: "Plan compliance"
      }
    },
    manual: {
      recommend: "Confirmed",
      reject: "Excluded",
      pending: "Pending inquiry",
      reviewed: "Reviewed",
      none: "Untagged"
    },
    opsCreators: {
      title: "Creators",
      lead: "Every creator you fetched or added by hand lands here. Approve one to publish it to the selection workspace; a withdrawn creator can be published again.",
      tabs: { review: "To review", released: "Published", withdrawn: "Withdrawn" },
      stage: { review: "To review", released: "Published", withdrawn: "Withdrawn" },
      search: "Search by nickname or Xiaohongshu account",
      sourceAll: "All sources",
      manual: "Added by hand",
      cols: { creator: "Creator", source: "Source", followers: "Followers", tier: "Tier", updated: "Updated", status: "Status" },
      needsReview: "New numbers",
      empty: {
        review: "Nothing waiting for review",
        released: "No published creators yet",
        withdrawn: "No withdrawn creators"
      },
      emptyHint: "Fetch a batch under Data sources, or add one by hand.",
      emptyFilter: "No creator matches. Try another keyword or source.",
      pageInfo: "Page {page} of {pages} · {total} creators",
      prev: "Previous",
      next: "Next",
      open: "View details"
    },
    opsCreator: {
      back: "Creators",
      approve: "Approve and publish",
      unpublish: "Withdraw",
      republish: "Publish again",
      raw: "Original platform data",
      publishedAt: "Published {date}",
      updatedAt: "Updated {date}",
      notFound: "This creator could not be found. It may have been deleted.",
      newNumbers: "New numbers came in. Compare them under “At publish vs latest”.",
      confirm: {
        approveTitle: "Approve and publish this creator?",
        approveBody: "The selection workspace will see this creator and filter and sort on today’s numbers. Numbers fetched later will not replace them automatically.",
        unpublishTitle: "Withdraw this creator?",
        unpublishBody: "The selection workspace will stop showing this creator, and project assignments will be marked as withdrawn. You can publish again at any time.",
        republishTitle: "Publish this creator again?",
        republishBody: "Publishing again switches the selection workspace to the most recently fetched numbers.",
        cancel: "Cancel",
        ok: "Confirm"
      },
      toast: {
        published: "Published to the selection workspace",
        republished: "Published again with the latest numbers",
        unchanged: "Already published. The numbers stay as they were.",
        unpublished: "Withdrawn from the selection workspace",
        saved: "Profile saved",
        incomplete: "Missing details: a nickname, a region or content focus, and a follower count (or tick “Followers unknown”)",
        failed: "That did not work. Please try again later.",
        created: "Draft saved. Publish it once it passes review."
      },
      edit: {
        title: "Profile",
        lead: "Edits change the latest profile. Published numbers only change when you publish again.",
        regions: "Regions",
        verticals: "Content focus",
        listHint: "Separate several with commas",
        categories: "Categories",
        note: "Note",
        readOnly: "Your account can view but not edit."
      },
      rawSheet: {
        lead: "Everything each platform sent back is kept, newest first.",
        empty: "This creator was added by hand, so there is no original platform data.",
        count: "{n} records",
        expand: "Show original content",
        fields: "Main fields"
      }
    },
    compare: {
      title: "At publish vs latest",
      lead: "The selection workspace filters and sorts on the numbers “At publish”. Each later fetch only updates “Latest”. To move the selection workspace onto the latest numbers, withdraw and publish again.",
      leadSelect: "The list filters and sorts on the numbers “At publish”. “Latest” shows what was fetched since, for comparison only.",
      notPublished: "Not published yet. Publishing freezes the “Latest” column as it is.",
      metric: "Metric",
      locked: "At publish",
      latest: "Latest",
      change: "Change",
      same: "No change"
    },
    projectBoard: {
      export: "Export sheet",
      exporting: "Exporting…",
      exported: "Your sheet is downloading",
      exportHint: "Numbers are the ones frozen when each creator was published, same as in the creator pool.",
      remove: "Remove from project",
      removeTitle: "Remove “{name}” from this project?",
      removeBody: "This only takes them off this project’s shortlist. The creator and other projects stay as they are, and you can add them back from the creator pool later.",
      removed: "Removed from the project",
      cancel: "Cancel",
      confirm: "Remove",
      failed: "That did not work. Please try again later.",
      actions: "Actions"
    },
    accounts: {
      title: "Accounts",
      lead: "Open accounts for teammates, give them a role, and switch off people who have left. Only platform admins see this page.",
      create: "New account",
      createTitle: "New account",
      createLead: "Share the starting password with them. After signing in they land on the desk for their role.",
      email: "Email",
      name: "Name",
      namePlaceholder: "Leave empty to use the part before {'@'}",
      password: "Starting password",
      passwordHint: "At least 8 characters",
      role: "Role",
      search: "Search email or name",
      cols: {
        account: "Account",
        role: "Role",
        lastLogin: "Last sign-in",
        status: "Status",
        actions: "Actions"
      },
      status: {
        active: "Active",
        disabled: "Disabled"
      },
      noRole: "No role yet",
      you: "You",
      never: "Never signed in",
      lastLoginHint: "Sign-ins they ended by signing out are not counted",
      delayNote: "Role changes and disabling take effect within 10 seconds; open pages show the new role after a refresh.",
      disable: "Disable",
      enable: "Restore",
      disableTitle: "Disable {name}?",
      disableBody: "They can no longer sign in, and any open page signs them out within 10 seconds. You can restore the account at any time.",
      enableTitle: "Restore {name}?",
      enableBody: "They can sign in again with their existing password.",
      cancel: "Cancel",
      submit: "Create",
      confirm: "Confirm",
      created: "Account {email} created",
      roleChanged: "{name} is now “{role}”, effective within 10 seconds",
      disabled: "{name} disabled",
      enabled: "{name} restored",
      empty: "No matching accounts",
      errors: {
        invalid_email: "That email doesn't look right",
        weak_password: "The starting password needs at least 8 characters",
        invalid_role: "Pick a role",
        email_taken: "This email already has an account",
        self: "You can't change your own role or disable yourself",
        not_found: "This account is gone — please refresh",
        failed: "Couldn't save. Please try again shortly"
      }
    },
    exempt: {
      note: "Nickname, Xiaohongshu account, raw keywords, and handwritten notes stay in the source language."
    }
  }
} as const; 