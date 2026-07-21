import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')

type LegalBlock = {
  heading?: string
  paragraphs?: string[]
  items?: string[]
  contactPrefix?: string
}

type LegalSection = {
  title: string
  blocks: LegalBlock[]
}

type LegalDocument = {
  title: string
  metadataDescription: string
  sections: LegalSection[]
}

type LegalResource = {
  common: {
    home: string
    terms: string
    privacy: string
    effectiveDate: string
    supportEmail: string
  }
  privacy: LegalDocument
  terms: LegalDocument
}

const en: LegalResource = {
  common: {
    home: 'Home',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    effectiveDate: 'Effective Date: February 20, 2026',
    supportEmail: 'support@pascal.app',
  },
  privacy: {
    title: 'Privacy Policy',
    metadataDescription: 'Privacy Policy for Pascal Editor and the Pascal platform.',
    sections: [
      {
        title: '1. Introduction',
        blocks: [
          {
            paragraphs: [
              'Pascal Group Inc. ("we," "us," or "our") operates the Pascal Editor and Platform at pascal.app. This Privacy Policy explains how we collect, use, and protect your information when you use our services.',
            ],
          },
        ],
      },
      {
        title: '2. Information We Collect',
        blocks: [
          {
            heading: 'Account Information',
            paragraphs: ['When you create an account, we collect:'],
            items: [
              'Email address',
              'Name',
              'Profile picture/avatar',
              'OAuth provider data (from Google when you sign in with Google)',
            ],
          },
          {
            heading: 'Project Data',
            paragraphs: [
              'When you use the Platform, we store your projects, including 3D building designs, floor plans, and associated metadata.',
            ],
          },
          {
            heading: 'Usage Analytics',
            paragraphs: [
              'We use Vercel Analytics and Speed Insights to collect anonymized usage data, including page views, performance metrics, and general usage patterns. This helps us improve the Platform.',
            ],
          },
        ],
      },
      {
        title: '3. How We Use Your Information',
        blocks: [
          {
            paragraphs: ['We use your information to:'],
            items: [
              'Provide and maintain your account',
              'Store and sync your projects across devices',
              'Improve our services based on usage patterns',
              'Send optional email notifications about new features and updates (you can opt out in settings)',
              'Respond to support requests',
              'Ensure platform security and prevent abuse',
            ],
          },
        ],
      },
      {
        title: '4. Data Storage',
        blocks: [
          {
            paragraphs: [
              'Your data is stored using Supabase (PostgreSQL database) on secure cloud infrastructure. We implement appropriate technical and organizational measures to protect your data.',
            ],
          },
        ],
      },
      {
        title: '5. Third-Party Services',
        blocks: [
          {
            paragraphs: ['We use the following third-party services to operate the Platform:'],
            items: [
              'Google - OAuth authentication for sign-in',
              'Vercel - Application hosting, analytics, and performance monitoring',
              'Supabase - Database hosting and authentication infrastructure',
            ],
          },
          {
            paragraphs: [
              'Each of these services has their own privacy policies governing their handling of your data.',
            ],
          },
        ],
      },
      {
        title: '6. Cookies',
        blocks: [
          {
            paragraphs: ['We use minimal cookies necessary for the Platform to function:'],
            items: [
              'Session cookies - Essential for authentication and keeping you signed in',
              'Analytics cookies - Used by Vercel Analytics to collect anonymized usage data',
            ],
          },
        ],
      },
      {
        title: '7. Your Rights',
        blocks: [
          {
            paragraphs: ['You have the right to:'],
            items: [
              'Access the personal data we hold about you',
              'Request correction of inaccurate data',
              'Request deletion of your data',
              'Export your project data',
              'Opt out of marketing communications',
            ],
            contactPrefix: 'To exercise any of these rights, please contact us at',
          },
        ],
      },
      {
        title: '8. Data Retention',
        blocks: [
          {
            paragraphs: [
              'We retain your data for as long as your account is active. If you delete your account, we will delete your personal data and project data within 30 days, except where we are required by law to retain certain information.',
            ],
          },
        ],
      },
      {
        title: "9. Children's Privacy",
        blocks: [
          {
            paragraphs: [
              'The Platform is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately.',
            ],
          },
        ],
      },
      {
        title: '10. Changes to This Policy',
        blocks: [
          {
            paragraphs: [
              'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Platform. Your continued use of the Platform after changes are posted constitutes your acceptance of the revised policy.',
            ],
          },
        ],
      },
      {
        title: '11. Contact Us',
        blocks: [
          {
            contactPrefix:
              'If you have questions about this Privacy Policy or how we handle your data, please contact us at',
          },
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    metadataDescription: 'Terms of Service for Pascal Editor and the Pascal platform.',
    sections: [
      {
        title: '1. Introduction',
        blocks: [
          {
            paragraphs: [
              'Welcome to Pascal Editor ("Editor") and the Pascal platform at pascal.app ("Platform"), operated by Pascal Group Inc. ("we," "us," or "our"). By accessing or using our services, you agree to these Terms of Service.',
            ],
          },
        ],
      },
      {
        title: '2. The Editor and Platform',
        blocks: [
          {
            paragraphs: [
              'The Pascal Editor is open-source software released under the MIT License. You may use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Editor software in accordance with the MIT License terms.',
              'The Pascal platform (pascal.app) and its associated services, including user accounts, cloud storage, and project hosting, are proprietary services owned and operated by Pascal Group Inc. These Terms govern your use of the Platform.',
            ],
          },
        ],
      },
      {
        title: '3. Accounts and Authentication',
        blocks: [
          {
            paragraphs: [
              'To use certain features of the Platform, you must create an account. We use Google OAuth and magic link email authentication through Supabase. You are responsible for maintaining the security of your account credentials and for all activities that occur under your account.',
            ],
          },
        ],
      },
      {
        title: '4. Acceptable Use',
        blocks: [
          {
            paragraphs: ['You agree not to:'],
            items: [
              'Use the Platform for any unlawful purpose or in violation of any applicable laws',
              'Upload, share, or distribute content that infringes intellectual property rights',
              'Attempt to gain unauthorized access to the Platform or its systems',
              "Interfere with or disrupt the Platform's infrastructure",
              'Upload malicious code, viruses, or harmful content',
              'Harass, abuse, or harm other users',
              'Use the Platform to send spam or unsolicited communications',
            ],
          },
        ],
      },
      {
        title: '5. Your Content and Intellectual Property',
        blocks: [
          {
            paragraphs: [
              'You retain full ownership of all content, projects, and data you create or upload to the Platform ("Your Content"). By using the Platform, you grant us a limited license to store, display, and transmit Your Content solely to provide our services to you.',
              'We do not claim any ownership rights over Your Content. You may export or delete Your Content at any time.',
            ],
          },
        ],
      },
      {
        title: '6. Platform Ownership',
        blocks: [
          {
            paragraphs: [
              'The Platform, including its design, features, and proprietary code, is owned by Pascal Group Inc. and protected by intellectual property laws. While the Editor source code is open-source under the MIT License, the Platform services, branding, and infrastructure remain our proprietary property.',
            ],
          },
        ],
      },
      {
        title: '7. Account Termination',
        blocks: [
          {
            contactPrefix:
              'We reserve the right to suspend or terminate your account if you violate these Terms or engage in conduct that we determine is harmful to the Platform or other users. You may also delete your account at any time by contacting us at',
          },
        ],
      },
      {
        title: '8. Disclaimer of Warranties',
        blocks: [
          {
            paragraphs: [
              'THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
              'We do not warrant that the Platform will be uninterrupted, error-free, or free of harmful components.',
            ],
          },
        ],
      },
      {
        title: '9. Limitation of Liability',
        blocks: [
          {
            paragraphs: [
              'TO THE MAXIMUM EXTENT PERMITTED BY LAW, PASCAL GROUP INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM YOUR USE OF THE PLATFORM.',
            ],
          },
        ],
      },
      {
        title: '10. Changes to Terms',
        blocks: [
          {
            paragraphs: [
              'We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on the Platform. Your continued use of the Platform after changes are posted constitutes your acceptance of the revised Terms.',
            ],
          },
        ],
      },
      {
        title: '11. Contact Us',
        blocks: [
          { contactPrefix: 'If you have questions about these Terms, please contact us at' },
        ],
      },
    ],
  },
}

const zh: LegalResource = {
  common: {
    home: '首页',
    terms: '服务条款',
    privacy: '隐私政策',
    effectiveDate: '生效日期：2026年2月20日',
    supportEmail: 'support@pascal.app',
  },
  privacy: {
    title: '隐私政策',
    metadataDescription: 'Pascal Editor 与 Pascal 平台隐私政策。',
    sections: [
      {
        title: '1. 简介',
        blocks: [
          {
            paragraphs: [
              'Pascal Group Inc.（以下简称“我们”）运营 pascal.app 上的 Pascal Editor 与 Pascal 平台。本隐私政策说明您使用我们的服务时，我们如何收集、使用和保护您的信息。',
            ],
          },
        ],
      },
      {
        title: '2. 我们收集的信息',
        blocks: [
          {
            heading: '账户信息',
            paragraphs: ['创建账户时，我们会收集：'],
            items: ['电子邮箱地址', '姓名', '头像', 'OAuth 提供方数据（使用 Google 登录时）'],
          },
          {
            heading: '项目数据',
            paragraphs: [
              '使用本平台时，我们会存储您的项目，包括三维建筑设计、平面图及相关元数据。',
            ],
          },
          {
            heading: '使用情况分析',
            paragraphs: [
              '我们使用 Vercel Analytics 和 Speed Insights 收集匿名使用数据，包括页面浏览量、性能指标和一般使用模式，以帮助我们改进平台。',
            ],
          },
        ],
      },
      {
        title: '3. 信息用途',
        blocks: [
          {
            paragraphs: ['我们使用您的信息来：'],
            items: [
              '提供并维护您的账户',
              '在不同设备间存储和同步项目',
              '根据使用模式改进服务',
              '发送可选的新功能和更新邮件通知（您可在设置中退订）',
              '回复支持请求',
              '保障平台安全并防止滥用',
            ],
          },
        ],
      },
      {
        title: '4. 数据存储',
        blocks: [
          {
            paragraphs: [
              '您的数据通过 Supabase（PostgreSQL 数据库）存储在安全的云基础设施中。我们采取适当的技术和组织措施保护您的数据。',
            ],
          },
        ],
      },
      {
        title: '5. 第三方服务',
        blocks: [
          {
            paragraphs: ['我们使用以下第三方服务来运营平台：'],
            items: [
              'Google - 用于登录的 OAuth 身份验证',
              'Vercel - 应用托管、分析和性能监控',
              'Supabase - 数据库托管和身份验证基础设施',
            ],
          },
          { paragraphs: ['这些服务各自依据其隐私政策处理您的数据。'] },
        ],
      },
      {
        title: '6. Cookie',
        blocks: [
          {
            paragraphs: ['我们仅使用平台运行所必需的少量 Cookie：'],
            items: [
              '会话 Cookie - 用于身份验证并保持登录状态',
              '分析 Cookie - 由 Vercel Analytics 用于收集匿名使用数据',
            ],
          },
        ],
      },
      {
        title: '7. 您的权利',
        blocks: [
          {
            paragraphs: ['您有权：'],
            items: [
              '访问我们持有的您的个人数据',
              '要求更正不准确的数据',
              '要求删除您的数据',
              '导出您的项目数据',
              '选择不接收营销信息',
            ],
            contactPrefix: '如需行使上述任何权利，请联系我们：',
          },
        ],
      },
      {
        title: '8. 数据保留',
        blocks: [
          {
            paragraphs: [
              '只要您的账户处于活跃状态，我们就会保留您的数据。若您删除账户，我们将在30天内删除个人数据和项目数据，但法律要求保留的某些信息除外。',
            ],
          },
        ],
      },
      {
        title: '9. 未成年人隐私',
        blocks: [
          {
            paragraphs: [
              '本平台不面向13岁以下儿童。我们不会故意收集13岁以下儿童的个人信息。如您认为我们收集了此类信息，请立即联系我们。',
            ],
          },
        ],
      },
      {
        title: '10. 政策变更',
        blocks: [
          {
            paragraphs: [
              '我们可能不时更新本隐私政策。如有重大变更，我们会在平台上发布更新后的政策进行通知。在变更发布后继续使用平台，即表示您接受修订后的政策。',
            ],
          },
        ],
      },
      {
        title: '11. 联系我们',
        blocks: [
          { contactPrefix: '如对本隐私政策或我们的数据处理方式有疑问，请联系我们：' },
        ],
      },
    ],
  },
  terms: {
    title: '服务条款',
    metadataDescription: 'Pascal Editor 与 Pascal 平台服务条款。',
    sections: [
      {
        title: '1. 简介',
        blocks: [
          {
            paragraphs: [
              '欢迎使用 Pascal Group Inc.（以下简称“我们”）运营的 Pascal Editor（以下简称“编辑器”）和 pascal.app 上的 Pascal 平台（以下简称“平台”）。访问或使用我们的服务，即表示您同意本服务条款。',
            ],
          },
        ],
      },
      {
        title: '2. 编辑器与平台',
        blocks: [
          {
            paragraphs: [
              'Pascal Editor 是依据 MIT 许可证发布的开源软件。您可以按照 MIT 许可证条款使用、复制、修改、合并、发布、分发、再许可和/或销售编辑器软件的副本。',
              'Pascal 平台（pascal.app）及其相关服务，包括用户账户、云存储和项目托管，是 Pascal Group Inc. 拥有并运营的专有服务。本条款适用于您对平台的使用。',
            ],
          },
        ],
      },
      {
        title: '3. 账户与身份验证',
        blocks: [
          {
            paragraphs: [
              '使用平台的某些功能需要创建账户。我们通过 Supabase 使用 Google OAuth 和邮箱魔法链接进行身份验证。您有责任保护账户凭据安全，并对账户下发生的所有活动负责。',
            ],
          },
        ],
      },
      {
        title: '4. 可接受的使用方式',
        blocks: [
          {
            paragraphs: ['您同意不会：'],
            items: [
              '将平台用于任何违法目的或违反适用法律',
              '上传、共享或分发侵犯知识产权的内容',
              '尝试未经授权访问平台或其系统',
              '干扰或破坏平台基础设施',
              '上传恶意代码、病毒或有害内容',
              '骚扰、辱骂或伤害其他用户',
              '使用平台发送垃圾信息或未经请求的通信',
            ],
          },
        ],
      },
      {
        title: '5. 您的内容与知识产权',
        blocks: [
          {
            paragraphs: [
              '您对在平台上创建或上传的所有内容、项目和数据（以下简称“您的内容”）保留完整所有权。使用平台即表示您授予我们有限许可，仅为向您提供服务而存储、展示和传输您的内容。',
              '我们不主张对您的内容拥有任何所有权。您可以随时导出或删除您的内容。',
            ],
          },
        ],
      },
      {
        title: '6. 平台所有权',
        blocks: [
          {
            paragraphs: [
              '平台的设计、功能和专有代码归 Pascal Group Inc. 所有，并受知识产权法律保护。编辑器源代码依据 MIT 许可证开源，但平台服务、品牌和基础设施仍属于我们的专有财产。',
            ],
          },
        ],
      },
      {
        title: '7. 账户终止',
        blocks: [
          {
            contactPrefix:
              '如果您违反本条款，或从事我们认定会损害平台或其他用户的行为，我们保留暂停或终止您账户的权利。您也可以随时联系我们删除账户：',
          },
        ],
      },
      {
        title: '8. 免责声明',
        blocks: [
          {
            paragraphs: [
              '平台按“现状”和“可用状态”提供，不附带任何明示或默示保证，包括但不限于适销性、特定用途适用性和不侵权的默示保证。',
              '我们不保证平台不会中断、不会出错或不含有害组件。',
            ],
          },
        ],
      },
      {
        title: '9. 责任限制',
        blocks: [
          {
            paragraphs: [
              '在法律允许的最大范围内，Pascal Group Inc. 不对因您使用平台而产生的任何间接、附带、特殊、后果性或惩罚性损害承担责任，包括数据、利润或商誉损失。',
            ],
          },
        ],
      },
      {
        title: '10. 条款变更',
        blocks: [
          {
            paragraphs: [
              '我们可能不时更新本条款。如有重大变更，我们会在平台上发布更新后的条款进行通知。在变更发布后继续使用平台，即表示您接受修订后的条款。',
            ],
          },
        ],
      },
      {
        title: '11. 联系我们',
        blocks: [{ contactPrefix: '如对本条款有疑问，请联系我们：' }],
      },
    ],
  },
}

for (const [locale, legal] of [
  ['en', en],
  ['zh-CN', zh],
] as const) {
  const file = resolve(root, `packages/i18n/src/locales/${locale}/editor.json`)
  const resource = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
  resource.legal = legal
  await writeFile(file, `${JSON.stringify(resource, null, 2)}\n`, 'utf8')
}

console.log('Synchronized legal pages for en and zh-CN.')
