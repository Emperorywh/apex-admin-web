/**
 * 个人中心：账户信息（来自真实登录会话）+ 资料编辑说明。
 *
 * 调度后端未提供资料修改接口（缺口 G12）：编辑区明确呈现不可用，
 * 不调用虚构接口、不伪造可编辑表单；完整收口归 P43。
 */

import { Descriptions, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAuth } from '@/hooks/useAuth'
import { ProfileForm } from '@/features/profile/components/ProfileForm/ProfileForm'
import styles from '@/pages/profile/Profile/Profile.module.css'

export default function Profile() {
  const { t } = useTranslation('profile')
  const { user } = useAuth()
  const roles = useAppSelector((state) => state.auth.roles)

  if (user === null) return null

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <div className={`${styles.cardTitle} ${styles.title}`}>{t('账户信息')}</div>
        <Descriptions column={1} size="small" labelStyle={{ width: 96, fontWeight: 700 }}>
          <Descriptions.Item label={t('用户名')}>{user.username}</Descriptions.Item>
          <Descriptions.Item label={t('状态')}>
            {user.state === 'ENABLED' ? t('启用') : t('停用')}
          </Descriptions.Item>
          <Descriptions.Item label={t('等级')}>{user.level}</Descriptions.Item>
          <Descriptions.Item label={t('角色')}>
            {roles.length > 0 ? roles.map((code) => <Tag key={code}>{code}</Tag>) : '—'}
          </Descriptions.Item>
        </Descriptions>
      </section>
      <section className={styles.card}>
        <div className={`${styles.cardTitle} ${styles.title}`}>{t('编辑资料')}</div>
        <ProfileForm user={user} />
      </section>
    </div>
  )
}
