import {
  CheckCircleOutlined,
  FireOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { LoadingState } from '@ai-app/components'

import { dashboardKeys } from '@/api/keys'
import { invalidateDashboardData } from '@/api/invalidation'
import { queryClient } from '@/api/queryClient'
import { useSearchParamAction } from '@/hooks/useSearchParamAction'

// 以下为 demo 数据：接入真实接口后请删除
interface DemoStat {
  key: 'apps' | 'tasks' | 'successRate' | 'calls'
  value: number
  precision?: number
  suffix?: string
  icon: ReactNode
}

const demoStats: DemoStat[] = [
  {
    key: 'apps',
    value: 12,
    icon: <RocketOutlined className="text-(--primary)" />,
  },
  {
    key: 'tasks',
    value: 128,
    icon: <ThunderboltOutlined className="text-(--orange)" />,
  },
  {
    key: 'successRate',
    value: 98.6,
    precision: 1,
    suffix: '%',
    icon: <CheckCircleOutlined className="text-(--green)" />,
  },
  {
    key: 'calls',
    value: 3421,
    icon: <FireOutlined className="text-(--blue)" />,
  },
]

// demo 数据：模拟一次接口往返，接入真实接口后替换为 request 调用
function fetchDemoStats(): Promise<DemoStat[]> {
  const { promise, resolve } = Promise.withResolvers<DemoStat[]>()
  setTimeout(() => resolve(demoStats), 300)
  return promise
}

interface DemoRecord {
  id: string
  owner: string
  status: 'running' | 'succeeded' | 'failed'
  updatedAt: string
}

const statusMeta = {
  running: { color: 'processing', labelKey: 'pages.dashboard.status.running' },
  succeeded: { color: 'success', labelKey: 'pages.dashboard.status.succeeded' },
  failed: { color: 'error', labelKey: 'pages.dashboard.status.failed' },
} as const

const demoRecords: DemoRecord[] = [
  {
    id: 'RUN-1001',
    owner: 'Alice',
    status: 'succeeded',
    updatedAt: '2026-08-14 10:32',
  },
  {
    id: 'RUN-1002',
    owner: 'Bob',
    status: 'running',
    updatedAt: '2026-08-14 10:18',
  },
  {
    id: 'RUN-1003',
    owner: 'Carol',
    status: 'failed',
    updatedAt: '2026-08-14 09:57',
  },
  {
    id: 'RUN-1004',
    owner: 'Alice',
    status: 'succeeded',
    updatedAt: '2026-08-14 09:41',
  },
  {
    id: 'RUN-1005',
    owner: 'Dave',
    status: 'running',
    updatedAt: '2026-08-14 09:26',
  },
]

export function DashboardPage() {
  const { t } = useTranslation()

  // 统计卡片走 TanStack Query：key 由工厂统一管理，初次加载呈现占位态
  const { data: stats, isPending } = useQuery({
    queryKey: dashboardKeys.stats('today'),
    queryFn: fetchDemoStats,
  })

  // 一次性 URL 指令示例：/dashboard?refresh=1 触发一次数据失效，随后参数被抹掉
  useSearchParamAction('refresh', '1', () => {
    void invalidateDashboardData(queryClient)
  })

  const columns: TableColumnsType<DemoRecord> = [
    {
      title: t('pages.dashboard.recent.columns.id'),
      dataIndex: 'id',
      key: 'id',
      width: 140,
    },
    {
      title: t('pages.dashboard.recent.columns.owner'),
      dataIndex: 'owner',
      key: 'owner',
    },
    {
      title: t('pages.dashboard.recent.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: DemoRecord['status']) => {
        const meta = statusMeta[status]

        return <Tag color={meta.color}>{t(meta.labelKey)}</Tag>
      },
    },
    {
      title: t('pages.dashboard.recent.columns.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <Typography.Title level={3} className="m-0! text-xl!">
          {t('routes.dashboard.title')}
        </Typography.Title>
        <Typography.Paragraph className="mb-0! mt-1! text-(--muted)">
          {t('pages.dashboard.description')}
        </Typography.Paragraph>
      </div>

      {isPending ? (
        <LoadingState />
      ) : (
        <Row gutter={[16, 16]}>
          {(stats ?? []).map((stat) => (
            <Col key={stat.key} xs={24} sm={12} xl={6}>
              <Card className="h-full!" variant="borderless">
                <Statistic
                  prefix={stat.icon}
                  precision={stat.precision}
                  suffix={stat.suffix}
                  title={t(`pages.dashboard.stats.${stat.key}`)}
                  value={stat.value}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Card title={t('pages.dashboard.recent.title')} variant="borderless">
        <Table<DemoRecord>
          columns={columns}
          dataSource={demoRecords}
          pagination={false}
          rowKey="id"
        />
      </Card>
    </div>
  )
}

export default DashboardPage
