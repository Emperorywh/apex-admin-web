/**
 * 个人中心：当前身份快照展示。
 *
 * D07：模板的"资料编辑"（displayName/email，新协议 /users/me）不纳入本轮，
 * 旧协议身份也不含这些字段；本页只读展示唯一身份快照，
 * 本人改密入口由 T017 接入用户菜单，路由存留决策归 T007。
 */

import { Descriptions, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { deriveButtonCodes, deriveMenuCodes } from '@/services/auth/permission.model'
import styles from '@/pages/profile/Profile/Profile.module.css'

export default function Profile() {
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')
  const { identity, isRoot } = useAuth()

  if (identity === null) return null

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <div className={`${styles.cardTitle} ${styles.title}`}>{t('账户信息')}</div>
        <Descriptions column={1} size="small" labelStyle={{ width: 96, fontWeight: 700 }}>
          <Descriptions.Item label={t('用户名')}>{identity.username}</Descriptions.Item>
          <Descriptions.Item label={tCommon('账号类型')}>
            {isRoot ? <Tag color="gold">{tCommon('特权账号')}</Tag> : <Tag>{tCommon('普通账号')}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label={tCommon('软件授权')}>
            {identity.activated ? (
              <Tag color="green">{tCommon('已激活')}</Tag>
            ) : (
              <Tag color="red">{tCommon('未激活')}</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={tCommon('菜单权限数')}>
            {deriveMenuCodes(identity.permissionsTree).size}
          </Descriptions.Item>
          <Descriptions.Item label={tCommon('按钮权限数')}>
            {deriveButtonCodes(identity.flatPermissions).size}
          </Descriptions.Item>
        </Descriptions>
      </section>
    </div>
  )
}
