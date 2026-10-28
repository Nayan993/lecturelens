import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CircleHelp, FileText, GraduationCap, Play, ShieldCheck, Target, Upload, Quote } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatTimestamp } from '../../lib/formatTime';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { buttonClasses, Card, CardContent, CardDescription, CardTitle, StatusPill } from '../../components/ui';

/** Static sample content for the product preview — illustrative markup, not live data. */
const PREVIEW_SEGMENTS = [
  { startSec: 300.94, text: 'With eta equal to point one, each step multiplies w by point eight, so we shrink smoothly toward zero.' },
  { startSec: 357.43, text: 'And with eta equal to one point one, the multiplier is negative one point two. We overshoot further and further and the loss blows up to infinity.', active: true },
  { startSec: 386.948, text: 'Too small is also a problem, just a quieter one — on a plateau the gradient is nearly zero.' },
];

const STEPS: Array<{ icon: ReactNode; title: string; body: string }> = [
  { icon: <Upload />, title: 'Upload a lecture', body: 'Add a recording with the lecturer’s consent. Processing runs on its own.' },
  { icon: <FileText />, title: 'Get a timestamped transcript', body: 'Every sentence is tied to the moment it was said, and split into topics.' },
  { icon: <CircleHelp />, title: 'Ask questions and get cited answers', body: 'Answers quote the lecture and link to the exact second they come from.' },
  { icon: <GraduationCap />, title: 'Revise what you got wrong', body: 'Short quizzes find your weak topics and send you back to the right part.' },
];

const CAPABILITIES: Array<{ icon: ReactNode; title: string; body: string }> = [
  {
    icon: <Quote />,
    title: 'Grounded answers',
    body: 'Every answer opens the exact moment in the recording it came from. If the lecture doesn’t cover it, LectureLens says so instead of guessing.',
  },
  {
    icon: <ShieldCheck />,
    title: 'Teacher-reviewed',
    body: 'Topics, summaries and quiz questions are drafts until a teacher approves them. Nothing reaches students unapproved.',
  },
  {
    icon: <Target />,
    title: 'Personalised revision',
    body: 'Revision is prioritised by your own quiz performance — the topics you missed most come first, with the reason spelled out.',
  },
];

function ProductPreview() {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Preview of the lecture view: a timestamped transcript on the left, and on the right a question answered from the
        lecture with a citation that links to 5:57 in the recording.
      </figcaption>
      <Card aria-hidden className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-1">Lecture 7 — Gradient Descent and Backpropagation</p>
            <p className="text-xs text-ink-3">CS 3410 · Gradient descent and the learning rate</p>
          </div>
          <StatusPill status="ready" />
        </div>
        <div className="grid md:grid-cols-preview">
          <div className="flex flex-col gap-1 p-4 md:border-r md:border-border">
            <p className="mb-1 text-eyebrow font-semibold uppercase tracking-wider text-ink-3">Transcript</p>
            {PREVIEW_SEGMENTS.map((s) => (
              <div
                key={s.startSec}
                className={
                  s.active
                    ? 'flex gap-3 rounded-r-control border-l-2 border-accent bg-accent-soft px-3 py-2'
                    : 'flex gap-3 border-l-2 border-transparent px-3 py-2'
                }
              >
                <span className="w-10 shrink-0 pt-0.5 font-sans text-xs font-semibold tabular-nums text-accent-strong">{formatTimestamp(s.startSec)}</span>
                <p className="font-serif text-md leading-relaxed text-ink-1">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-border bg-bg/60 p-4 md:border-t-0">
            <p className="text-eyebrow font-semibold uppercase tracking-wider text-ink-3">Ask</p>
            <p className="self-end rounded-card rounded-br-sm bg-brand-soft px-3 py-2 text-sm text-ink-1">
              Why does a learning rate that’s too large make the loss blow up?
            </p>
            <p className="font-serif text-md leading-relaxed text-ink-1">
              Each step multiplies the weight by (1 − 2η). At η = 1.1 that factor is −1.2, so every step overshoots by
              more than the last and the loss diverges <span className="font-sans text-xs font-semibold text-brand">[1]</span>.
            </p>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/40 bg-surface px-2.5 py-1 text-xs font-medium text-ink-1">
              <Play className="h-3 w-3 fill-accent text-accent-strong" />
              <span className="tabular-nums text-accent-strong">{formatTimestamp(357.43)}</span>
              <span className="text-ink-2">Lecture 7 · “the loss blows up to infinity”</span>
            </span>
          </div>
        </div>
      </Card>
    </figure>
  );
}

export function LandingPage() {
  useDocumentTitle('');
  const { status } = useAuth();
  const signedIn = status === 'authenticated';

  return (
    <div className="flex flex-col gap-20 pb-6 sm:gap-24">
      <section aria-labelledby="hero-title" className="max-w-3xl pt-8 sm:pt-14">
        <p className="mb-4 text-sm font-semibold tracking-tight text-brand">LectureLens</p>
        <h1 id="hero-title" className="text-3xl font-semibold leading-tight tracking-tight text-ink-1 sm:text-5xl">
          Turn recorded lectures into something you can search, question and revise
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
          LectureLens transcribes a lecture, splits it into topics and answers questions using only what was said — with a
          link to the exact second. Teachers approve everything students see, and quizzes show each student what to
          revisit.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {signedIn ? (
            <Link to="/app" className={buttonClasses({ size: 'lg' })}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/register" className={buttonClasses({ size: 'lg' })}>
                Get started
              </Link>
              <Link to="/login" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      <ProductPreview />

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="text-xl font-semibold tracking-tight text-ink-1">
          How it works
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full shadow-none">
                <CardContent className="flex flex-col gap-3 py-5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-accent-strong">{String(i + 1).padStart(2, '0')}</span>
                    <span aria-hidden className="text-brand [&>svg]:h-5 [&>svg]:w-5">
                      {step.icon}
                    </span>
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.body}</CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="capabilities-title">
        <h2 id="capabilities-title" className="text-xl font-semibold tracking-tight text-ink-1">
          What makes it trustworthy
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <Card key={c.title} className="shadow-none">
              <CardContent className="flex flex-col gap-3 py-5">
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft text-brand [&>svg]:h-5 [&>svg]:w-5"
                >
                  {c.icon}
                </span>
                <CardTitle>{c.title}</CardTitle>
                <CardDescription className="leading-relaxed">{c.body}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
