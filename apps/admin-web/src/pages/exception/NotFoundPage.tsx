import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <Result
      status="404"
      title={t('routes.notFound.title')}
      subTitle={t('pages.notFound.subtitle')}
      extra={
        <Button type="primary">
          <Link to="/">{t('pages.notFound.backHome')}</Link>
        </Button>
      }
    />
  )
}
