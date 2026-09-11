'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, HeartHandshake, Repeat, Sparkles, Send, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type PostType = 'event' | 'fundraiser' | 'program' | 'youth'

const TYPES: { id: PostType; label: string; hint: string; Icon: any }[] = [
  { id: 'event',      label: 'Event',      hint: 'A one-off gathering with a date and time',       Icon: CalendarDays },
  { id: 'youth',      label: 'Youth',      hint: 'For the youth — same as an event, filtered apart', Icon: Sparkles },
  { id: 'program',    label: 'Program',    hint: 'Something recurring, like a weekly halaqa',       Icon: Repeat },
  { id: 'fundraiser', label: 'Fundraiser', hint: 'A goal, and a link to your own donation page',    Icon: HeartHandshake },
]

const field = 'mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-white/45'
const textarea =
  'w-full rounded-md border border-gold/20 bg-white/[0.04] px-3.5 py-3 font-cormorant text-[15px] text-white outline-none transition-colors placeholder:italic placeholder:text-white/30 focus:border-gold/50'

// Datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time. Slicing an ISO
// string would silently shift everything by the UTC offset.
function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PostForm({ existing }: { existing?: any }) {
  const router = useRouter()
  const supabase = createClient()
  const editing = !!existing

  const [type, setType] = useState<PostType>(existing?.type || 'event')
  const [title, setTitle] = useState<string>(existing?.title || '')
  const [body, setBody] = useState<string>(existing?.body || '')
  const [startsAt, setStartsAt] = useState(toLocalInput(existing?.starts_at))
  const [endsAt, setEndsAt] = useState(toLocalInput(existing?.ends_at))
  const [location, setLocation] = useState<string>(existing?.location || '')
  const [rsvpEnabled, setRsvpEnabled] = useState<boolean>(existing?.rsvp_enabled ?? true)
  const [scheduleText, setScheduleText] = useState<string>(existing?.schedule_text || '')
  const [goal, setGoal] = useState<string | number>(existing?.goal_amount ?? '')
  const [raised, setRaised] = useState<string | number>(existing?.raised_amount ?? '')
  const [donateUrl, setDonateUrl] = useState<string>(existing?.donate_url || '')
  const [deadline, setDeadline] = useState<string>(existing?.deadline || '')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isDated = type === 'event' || type === 'youth'

  const save = async (status: 'published' | 'draft') => {
    setError('')
    if (!title.trim()) { setError('Give the post a title.'); return }
    if (isDated && !startsAt) { setError('Events need a start date and time.'); return }
    if (type === 'fundraiser' && donateUrl && !/^https?:\/\//i.test(donateUrl)) {
      setError('The donation link needs to start with http:// or https://'); return
    }
    setBusy(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Your session expired — sign in again.'); setBusy(false); return }

    const payload: Record<string, any> = {
      type, title, body: body || null, status,
      starts_at: isDated && startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: isDated && endsAt ? new Date(endsAt).toISOString() : null,
      location: isDated ? location || null : null,
      rsvp_enabled: isDated ? rsvpEnabled : false,
      schedule_text: type === 'program' ? scheduleText || null : null,
      goal_amount: type === 'fundraiser' && goal !== '' ? Number(goal) : null,
      raised_amount: type === 'fundraiser' && raised !== '' ? Number(raised) : 0,
      donate_url: type === 'fundraiser' ? donateUrl || null : null,
      deadline: type === 'fundraiser' && deadline ? deadline : null,
    }

    const res = await fetch(
      editing ? `/api/portal/posts/${existing.id}` : '/api/portal/posts',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      }
    )
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error || 'Could not save.'); return }
    router.push('/portal/posts')
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="mb-1 font-cinzel text-[24px] font-medium text-white">
        {editing ? 'Edit post' : 'New post'}
      </h1>
      <p className="mb-7 font-cormorant text-[15px] italic text-white/45">
        {editing
          ? 'Changes go live as soon as you save.'
          : 'Publishing notifies everyone following your masjid.'}
      </p>

      {/* Type picker — locked once created, since the shape changes */}
      {!editing && (
        <div className="mb-7">
          <label className={field}>What is it?</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPES.map(({ id, label, hint, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-left transition-colors',
                  type === id
                    ? 'border-gold/50 bg-gold/[0.08]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                )}
              >
                <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', type === id ? 'text-gold' : 'text-white/40')} strokeWidth={1.7} />
                <span className="min-w-0">
                  <span className={cn('block font-cinzel text-[13px]', type === id ? 'text-white' : 'text-white/70')}>{label}</span>
                  <span className="block font-cormorant text-[12.5px] italic leading-snug text-white/35">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0a1a0a] p-5 sm:p-6">
        <label className={field}>Title</label>
        <Input
          value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
          placeholder={type === 'fundraiser' ? 'Masjid expansion fund' : 'Friday night halaqa'}
          className="mb-5"
        />

        <label className={field}>Details</label>
        <textarea
          value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={5000}
          placeholder="What should people know? Who is it for, what to bring, anything else."
          className={cn(textarea, 'mb-5')}
        />

        {isDated && (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={field}>Starts</label>
                <Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
              </div>
              <div>
                <label className={field}>Ends <span className="normal-case text-white/25">(optional)</span></label>
                <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
              </div>
            </div>

            <label className={field}>Location <span className="normal-case text-white/25">(optional)</span></label>
            <Input
              value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Main prayer hall · or an address if it's elsewhere"
              className="mb-5"
            />

            <button
              type="button"
              onClick={() => setRsvpEnabled(v => !v)}
              className="mb-1 flex w-full cursor-pointer items-start gap-3 rounded-lg border-none bg-transparent px-0 py-2 text-left"
            >
              <span className={cn(
                'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                rsvpEnabled ? 'bg-gold' : 'bg-white/15'
              )}>
                <span className={cn('h-4 w-4 rounded-full bg-[#0a1a0a] transition-transform', rsvpEnabled && 'translate-x-4')} />
              </span>
              <span>
                <span className="block text-[13px] text-white">Let people RSVP</span>
                <span className="block font-cormorant text-[12.5px] italic leading-snug text-white/35">
                  They tap “Going” and you see the headcount. There is no “not going” — we don’t ask people to announce that.
                </span>
              </span>
            </button>
          </>
        )}

        {type === 'program' && (
          <>
            <label className={field}>When does it run?</label>
            <Input
              value={scheduleText} onChange={e => setScheduleText(e.target.value)}
              placeholder="Every Saturday, 11am – 1pm"
              className="mb-1"
            />
            <p className="mb-5 font-cormorant text-[12.5px] italic text-white/30">
              Written in plain words — it shows exactly as you type it.
            </p>
          </>
        )}

        {type === 'fundraiser' && (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={field}>Goal ($)</label>
                <Input type="number" min="0" step="1" value={goal} onChange={e => setGoal(e.target.value)} placeholder="50000" />
              </div>
              <div>
                <label className={field}>Raised so far ($)</label>
                <Input type="number" min="0" step="1" value={raised} onChange={e => setRaised(e.target.value)} placeholder="12400" />
              </div>
            </div>

            <label className={field}>Donation link</label>
            <Input
              type="url" value={donateUrl} onChange={e => setDonateUrl(e.target.value)}
              placeholder="https://launchgood.com/your-campaign"
              className="mb-1"
            />
            <p className="mb-5 font-cormorant text-[12.5px] italic leading-relaxed text-white/30">
              Donations go straight to your own page — Green Emblem never handles the money,
              and takes nothing. Update the raised amount here whenever you like.
            </p>

            <label className={field}>Deadline <span className="normal-case text-white/25">(optional)</span></label>
            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="mb-5" />
          </>
        )}

        {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}

        <div className="flex flex-col gap-2 border-t border-white/8 pt-5 sm:flex-row">
          <Button variant="brand" onClick={() => save('published')} disabled={busy} className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish'}
          </Button>
          {!editing && (
            <Button variant="outline" onClick={() => save('draft')} disabled={busy} className="w-full sm:w-auto">
              <Save className="h-4 w-4" />
              Save as draft
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.back()} disabled={busy} className="w-full text-white/50 sm:ml-auto sm:w-auto">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
