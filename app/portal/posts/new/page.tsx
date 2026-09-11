'use client'
import PortalShell from '@/components/portal/PortalShell'
import PostForm from '@/components/portal/PostForm'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'

export default function NewPost() {
  const { loading, membership } = usePortalSession()
  if (loading) return <PortalLoading />
  return (
    <PortalShell masjidName={membership?.masjidName}>
      <PostForm />
    </PortalShell>
  )
}
