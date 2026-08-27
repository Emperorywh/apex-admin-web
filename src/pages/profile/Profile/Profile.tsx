/**
 * 个人中心：账户信息 + 资料编辑。
 */

import { Card, Descriptions, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { ProfileForm } from '@/features/profile/components/ProfileForm/ProfileForm'
import styles from '@/pages/profile/Profile/Profile.module.css'

export default function Profile() {
  const { t } = useTranslation('profile')
  const { user, permissions } = useAuth()

  if (user === null) return null

  return (
    <div className={styles.wrap}>
      <Card
        title={t('账户信息')}
        className={styles.card}
        styles={{ header: { borderBottom: '1px solid rgba(108,138,184,.18)' } }}
      >
        <Descriptions column={1} size="small" labelStyle={{ width: 96, fontWeight: 700 }}>
          <Descriptions.Item label={t('用户名')}>{user.username}</Descriptions.Item>
          <Descriptions.Item label={t('显示名')}>{user.displayName}</Descriptions.Item>
          <Descriptions.Item label={t('邮箱')}>{user.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('角色')}>
            {user.roleNames.length > 0 ? user.roleNames.map((name) => <Tag key={name}>{name}</Tag>) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('权限码')}>
            {permissions.length > 0 ? (
              <span className={styles.perms}>
                {permissions.map((code) => (
                  <Tag key={code} color={code === '*' ? 'geekblue' : undefined}>
                    {code}
                  </Tag>
                ))}
              </span>
            ) : (
              '—'
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title={t('编辑资料')} className={styles.card}>
        <ProfileForm user={user} />
      </Card>
    </div>
  )
}
