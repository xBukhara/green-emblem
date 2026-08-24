import { redirect } from 'next/navigation'

// GreenFitness has been folded into the GreenTV tab — redirect anyone
// who had this bookmarked or linked instead of leaving a dead page.
export default function GreenFitnessRedirect() {
  redirect('/greentv')
}
