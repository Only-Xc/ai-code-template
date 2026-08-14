import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Button, ConfigProvider, Form, Input, Typography, theme } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'

import { mockAccessToken, mockCredentials } from '@/mock/auth'
import { useAuthStore } from '@/store/useAuth'

import { globalMessage } from '@/utils/message'

interface LoginFormValues {
  username: string
  password: string
}

// demo 预填账号：接入真实接口后请删除
const initialValues: LoginFormValues = {
  username: mockCredentials.username,
  password: mockCredentials.password,
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form] = Form.useForm<LoginFormValues>()

  const [submitting, setSubmitting] = useState(false)
  const setToken = useAuthStore((state) => state.setToken)
  const initialAccessToken = useAuthStore.getState().accessToken

  const handleSubmit = async (values: LoginFormValues) => {
    setSubmitting(true)

    try {
      // demo 登录：仅校验 mock 账号，接入真实接口后请删除
      const isValid =
        values.username === mockCredentials.username &&
        values.password === mockCredentials.password

      if (!isValid) {
        void globalMessage.error(t('pages.login.validation.credentialsInvalid'))
        return
      }

      setToken(mockAccessToken)
      void globalMessage.success(t('pages.login.success'))
      void navigate('/', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  if (initialAccessToken) {
    return <Navigate replace to="/" />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4 py-6">
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1677ff',
          },
        }}
      >
        <div className="w-full max-w-95 rounded-lg bg-white p-8 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
          <Typography.Title level={3} className="mb-6! text-center!">
            {t('common.appTitle')}
          </Typography.Title>

          <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            requiredMark={false}
            disabled={submitting}
            onFinish={(values) => void handleSubmit(values)}
          >
            <Form.Item
              label={t('pages.login.fields.email')}
              name="username"
              rules={[
                {
                  required: true,
                  message: t('pages.login.validation.emailRequired'),
                },
                {
                  type: 'email',
                  message: t('pages.login.validation.emailInvalid'),
                },
              ]}
            >
              <Input
                autoComplete="username"
                prefix={<UserOutlined />}
                placeholder="admin@example.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label={t('pages.login.fields.password')}
              name="password"
              rules={[
                {
                  required: true,
                  message: t('pages.login.validation.passwordRequired'),
                },
              ]}
            >
              <Input.Password
                autoComplete="current-password"
                prefix={<LockOutlined />}
                placeholder={t('pages.login.placeholders.password')}
                size="large"
              />
            </Form.Item>

            <Form.Item className="mb-0! pt-2">
              <Button
                block
                htmlType="submit"
                loading={submitting}
                size="large"
                type="primary"
              >
                {t('pages.login.submit')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </ConfigProvider>
    </main>
  )
}

export default LoginPage
