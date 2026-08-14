import {
  GlobalOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Dropdown,
  Tooltip,
  Typography,
  type MenuProps,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useLocale } from '@/i18n/useLocale'
import { useAppStore } from '@/store/useApp'
import { useAuthStore } from '@/store/useAuth'

interface HeaderProps {
  onOpenMenu: () => void
}

export function Header({ onOpenMenu }: HeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { locale, localeOptions, setLocale } = useLocale()
  const themeMode = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const displayName = user?.full_name ?? user?.email ?? ''

  const isDarkMode = themeMode === 'dark'
  const themeToggleLabel = isDarkMode
    ? t('layout.header.themeLight')
    : t('layout.header.themeDark')

  const localeItems: MenuProps['items'] = localeOptions.map((option) => ({
    key: option.code,
    label: option.label,
  }))
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('common.user.logout'),
    },
  ]
  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key !== 'logout') {
      return
    }

    clearAuth()
    void navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full w-full items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <div className="max-lg:flex lg:hidden">
          <Button
            aria-label={t('layout.header.menu')}
            type="text"
            icon={<MenuOutlined />}
            onClick={onOpenMenu}
          />
        </div>
        <Typography.Text strong className="ml-1 truncate text-base">
          {t('common.appTitle')}
        </Typography.Text>
      </div>

      <div className="flex flex-none items-center gap-1">
        <Tooltip title={themeToggleLabel}>
          <Button
            aria-label={themeToggleLabel}
            type="text"
            icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
          />
        </Tooltip>

        <Dropdown
          menu={{
            items: localeItems,
            selectedKeys: [locale],
            onClick: ({ key }) => {
              void setLocale(key as typeof locale)
            },
          }}
        >
          <Button
            aria-label={t('layout.header.language')}
            type="text"
            icon={<GlobalOutlined />}
          />
        </Dropdown>

        <Dropdown
          trigger={['hover']}
          placement="bottomRight"
          menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
        >
          <div className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-(--ant-color-fill-secondary)">
            <Avatar size={32}>{displayName.slice(0, 1).toUpperCase()}</Avatar>
            <span className="max-sm:hidden max-w-28 truncate text-sm">
              {displayName}
            </span>
          </div>
        </Dropdown>
      </div>
    </div>
  )
}
