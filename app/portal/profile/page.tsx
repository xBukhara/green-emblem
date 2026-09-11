'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PortalShell from '@/components/portal/PortalShell'
import { usePortalSession, PortalLoading } from '@/components/portal/PortalGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const field = 'mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45'
const textarea =
  'w-full rounded-md border border-gold/20 bg-white/[0.04] px-3.5 py-3 font-cormorant text-[15px] text-white outline-none transition-colors placeholder:italic placeholder:text-white/30 focus:border-gold/50'

export default function MasjidProfile() {
  const { loading, membership } = usePortalSession()
  const supabase = createClient()
  const [form, setForm] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!membership) return
    ;(async () => {
      const { data } = await supabase
        .from('masjids')
        .select('name, description, address, city, state, zip, phone, website, contact_email, instagram_handle, facebook_page, jumuah_times, office_hours, donation_url')
        .eq('id', membership.masjidId).maybeSingle()
      setForm(data || {})
    })()
  }, [membership]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!membership) return
    setBusy(true); setMsg('')
    const { error } = await supabase.from('masjids').update({
      description: form.description || null,
      phone: form.phone || null,
      website: form.website || null,
      contact_email: form.contact_email || null,
      instagram_handle: form.instagram_handle || null,
      facebook_page: form.facebook_page || null,
      jumuah_times: form.jumuah_times || null,
      office_hours: form.office_hours || null,
      donation_url: form.donation_url || null,
    }).eq('id', membership.masjidId)
    setBusy(false)
    setMsg(error ? 'Could not save — try again.' : 'Saved.')
  }

  if (loading) return <PortalLoading />

  return (
    <PortalShell masjidName={membership?.masjidName}>
      <div className="mx-auto max-w-[720px]">
        <h1 className="mb-1 font-cinzel text-[24px] font-medium text-white">Masjid</h1>
        <p className="mb-7 font-cormorant text-[15px] italic text-white/45">
          What people see on your public page.
        </p>

        {!form ? (
          <div className="font-cinzel text-[11px] tracking-[0.2em] text-white/25">LOADING…</div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#0a1a0a] p-5 sm:p-6">
            <label className={field}>Name</label>
            <Input value={form.name || ''} disabled className="mb-1 opacity-60" />
            <p className="mb-5 font-cormorant text-[12.5px] italic text-white/30">
              Contact Green Emblem to change the name or address.
            </p>

            <label className={field}>About</label>
            <textarea
              value={form.description || ''} onChange={e => set('description', e.target.value)}
              rows={4} maxLength={1200} className={`${textarea} mb-5`}
              placeholder="A sentence or two about your masjid, its history, and who it serves."
            />

            <label className={field}>Jumu&apos;ah times</label>
            <Input
              value={form.jumuah_times || ''} onChange={e => set('jumuah_times', e.target.value)}
              placeholder="1st khutbah 1:15pm · 2nd khutbah 2:15pm" className="mb-5"
            />

            <label className={field}>Office hours</label>
            <Input
              value={form.office_hours || ''} onChange={e => set('office_hours', e.target.value)}
              placeholder="Mon–Fri, 10am – 6pm" className="mb-5"
            />

            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={field}>Phone</label>
                <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className={field}>Contact email</label>
                <Input type="email" value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} />
              </div>
            </div>

            <label className={field}>Website</label>
            <Input
              type="url" value={form.website || ''} onChange={e => set('website', e.target.value)}
              placeholder="https://…" className="mb-5"
            />

            <label className={field}>Donation page</label>
            <Input
              type="url" value={form.donation_url || ''} onChange={e => set('donation_url', e.target.value)}
              placeholder="https://launchgood.com/…" className="mb-1"
            />
            <p className="mb-5 font-cormorant text-[12.5px] italic text-white/30">
              Where your fundraiser buttons send people. Money goes directly to you.
            </p>

            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={field}>Instagram</label>
                <Input value={form.instagram_handle || ''} onChange={e => set('instagram_handle', e.target.value)} placeholder="@yourmasjid" />
              </div>
              <div>
                <label className={field}>Facebook</label>
                <Input value={form.facebook_page || ''} onChange={e => set('facebook_page', e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-white/8 pt-5">
              <Button variant="brand" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
              {msg && <span className="font-cormorant text-[13.5px] italic text-white/50">{msg}</span>}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  )
}
