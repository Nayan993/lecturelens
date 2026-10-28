/**
 * TEMPORARY dev-only kitchen sink at /_kitchen: every UI primitive in every variant and state.
 * Registered in App.tsx only when import.meta.env.DEV, so it never ships in production builds.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  Copy,
  Download,
  FileText,
  Mail,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatDuration, formatTimestamp } from '../lib/formatTime';
import { LECTURE_STATUSES, type LectureStatus } from '../types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Progress,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  Spinner,
  StatusPill,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Tabs,
  Textarea,
  Toast,
  Tooltip,
  useToast,
  type BadgeVariant,
  type ButtonSize,
  type ButtonVariant,
} from '../components/ui';

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger', 'link'];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const BADGE_VARIANTS: BadgeVariant[] = ['neutral', 'brand', 'accent', 'success', 'warning', 'danger'];
const TOKENS = [
  'ink-1', 'ink-2', 'ink-3', 'surface', 'bg', 'border', 'brand', 'brand-hover', 'brand-soft',
  'accent', 'accent-soft', 'success', 'warning', 'danger', 'info',
] as const;

// Static sample rows for visual checks only. Components never import /mocks — real data comes from hooks.
const lectures: Array<{ id: string; title: string; status: LectureStatus; durationSec: number | null; courseCode: string }> = [
  { id: 'k5', title: 'Lecture 10 — Convolutional Neural Networks', status: 'uploaded', durationSec: null, courseCode: 'CS 3410' },
  { id: 'k4', title: 'Lecture 9 — Regularisation: Weight Decay and Dropout', status: 'transcribing', durationSec: 2954.88, courseCode: 'CS 3410' },
  { id: 'k6', title: 'Tutorial 4 — Worked Examples on Backpropagation', status: 'failed', durationSec: 1830.4, courseCode: 'CS 3410' },
  { id: 'k3', title: 'Lecture 8 — Optimisers: Momentum, RMSProp and Adam', status: 'ready', durationSec: 2871.104, courseCode: 'CS 3410' },
  { id: 'k1', title: 'Lecture 7 — Gradient Descent and Backpropagation', status: 'ready', durationSec: 1199.398, courseCode: 'CS 3410' },
  { id: 'k2', title: 'Lecture 6 — Linear Regression and Loss Functions', status: 'ready', durationSec: 3012.736, courseCode: 'CS 3410' },
];
const segment = {
  startSec: 357.43,
  text: 'And with eta equal to one point one, the multiplier is negative one point two. The magnitude grows every step. We overshoot further and further and the loss blows up to infinity. If you ever see your loss turn into NaN in the first few iterations, a learning rate that is too large is the first suspect.',
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6">
      <h2 id={`${id}-h`} className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">
        {title}
      </h2>
      <Card>
        <CardContent className="flex flex-col gap-5 py-5">{children}</CardContent>
      </Card>
    </section>
  );
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-xs font-medium text-ink-2">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Toggles `.dark` on <html>. `/_kitchen?theme=dark` starts in dark mode (handy for screenshots). */
function ThemeToggle() {
  const [dark, setDark] = useState(
    () =>
      new URLSearchParams(window.location.search).get('theme') === 'dark' ||
      document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return (
    <Button variant="secondary" size="sm" leftIcon={dark ? <Sun /> : <Moon />} onClick={() => setDark((d) => !d)} aria-pressed={dark}>
      {dark ? 'Light mode' : 'Dark mode'}
    </Button>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  return (
    <Row>
      <Button onClick={() => setOpen(true)} leftIcon={<Pencil />}>
        Open form dialog
      </Button>
      <Button variant="danger" onClick={() => setConfirmOpen(true)} leftIcon={<Trash2 />}>
        Open destructive dialog
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Rename lecture"
        description="The new title is shown to students in the lecture list."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                toast({ variant: 'success', title: 'Lecture renamed' });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Title" defaultValue="Lecture 7 — Gradient Descent and Backpropagation" required />
          <Select label="Course" defaultValue="CS 3410">
            <option>CS 3410</option>
            <option>CS 4780</option>
          </Select>
        </div>
      </Dialog>
      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        size="sm"
        title="Delete lecture?"
        description="This permanently removes the recording, transcript, topics, summaries and questions."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Keep lecture
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(false)}>
              Delete
            </Button>
          </>
        }
      />
    </Row>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <>
      <Row label="Live (bottom-right, auto-dismiss 4 s, pauses on hover/focus)">
        <Button variant="secondary" onClick={() => toast({ variant: 'success', title: 'Transcript approved', description: 'Students can now read it.' })}>
          Success toast
        </Button>
        <Button variant="secondary" onClick={() => toast({ variant: 'error', title: 'Upload failed', description: 'The file has no audio track.' })}>
          Error toast
        </Button>
        <Button variant="secondary" onClick={() => toast({ variant: 'info', title: 'Processing started', description: 'We’ll keep this page updated.' })}>
          Info toast
        </Button>
      </Row>
      <Row label="Static previews">
        <div className="grid w-full gap-2 sm:grid-cols-3">
          <Toast variant="success" title="Saved" description="Your changes are live." onDismiss={() => undefined} />
          <Toast variant="error" title="Couldn’t save" description="Try again in a moment." onDismiss={() => undefined} />
          <Toast variant="info" title="Heads up" description="Reprocessing takes a few minutes." />
        </div>
      </Row>
    </>
  );
}

export default function Kitchen() {
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [retries, setRetries] = useState(0);
  const [tab, setTab] = useState('transcript');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Dev only</p>
          <h1 className="text-2xl font-semibold tracking-tight">LectureLens UI kit</h1>
          <p className="text-sm text-ink-2">Every primitive in every variant and state. Not shipped to production.</p>
        </div>
        <ThemeToggle />
      </header>

      <Section id="tokens" title="1 · Tokens & typography">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {TOKENS.map((t) => (
            <div key={t} className="flex flex-col gap-1">
              <div className="h-10 rounded-control border border-border" style={{ background: `var(--${t})` }} />
              <code className="text-xs text-ink-2">--{t}</code>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold">Inter — interface text 600</p>
          <p className="text-base text-ink-2">Inter 400 secondary text · ink-2</p>
          <p className="text-sm text-ink-3">Inter 400 tertiary text · ink-3</p>
        </div>
        <p className="prose-lecture">
          <span className="mr-2 font-sans text-xs font-medium text-brand">{formatTimestamp(segment.startSec)}</span>
          {segment.text}
        </p>
      </Section>

      <Section id="button" title="2 · Button">
        {BUTTON_VARIANTS.map((variant) => (
          <Row key={variant} label={variant}>
            {SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {size.toUpperCase()} button
              </Button>
            ))}
            <Button variant={variant} disabled>
              Disabled
            </Button>
            <Button variant={variant} loading>
              Loading
            </Button>
          </Row>
        ))}
        <Row label="icons · interactive loading">
          <Button leftIcon={<Upload />}>Upload lecture</Button>
          <Button variant="secondary" rightIcon={<ArrowRight />}>
            Continue
          </Button>
          <Button variant="ghost" leftIcon={<Download />} rightIcon={<FileText />}>
            Export
          </Button>
          <Button
            loading={loadingDemo}
            onClick={() => {
              setLoadingDemo(true);
              setTimeout(() => setLoadingDemo(false), 1500);
            }}
          >
            {loadingDemo ? 'Saving…' : 'Click to load 1.5 s'}
          </Button>
        </Row>
        <Row label="fullWidth">
          <Button fullWidth leftIcon={<Plus />}>
            Full-width primary
          </Button>
        </Row>
      </Section>

      <Section id="icon-button" title="3 · IconButton">
        {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
          <Row key={variant} label={variant}>
            {SIZES.map((size) => (
              <IconButton key={size} variant={variant} size={size} aria-label={`Settings (${size})`} icon={<Settings />} />
            ))}
            <IconButton variant={variant} aria-label="Copy (disabled)" icon={<Copy />} disabled />
            <IconButton variant={variant} aria-label="Saving" icon={<Copy />} loading />
          </Row>
        ))}
      </Section>

      <Section id="badge" title="4 · Badge">
        <Row label="variants">
          {BADGE_VARIANTS.map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </Row>
        <Row label="with icon">
          <Badge variant="brand" icon={<FileText />}>
            Transcript
          </Badge>
          <Badge variant="accent" icon={<Bell />}>
            2 to review
          </Badge>
          <Badge variant="success">approved</Badge>
          <Badge variant="warning">pending_review</Badge>
          <Badge variant="danger">rejected</Badge>
        </Row>
      </Section>

      <Section id="status-pill" title="5 · StatusPill (every lecture status)">
        <Row>
          {LECTURE_STATUSES.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </Row>
      </Section>

      <Section id="card" title="6 · Card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Lecture 7 — Gradient Descent and Backpropagation</CardTitle>
              <CardDescription>CS 3410 · {formatDuration(1199.398)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <StatusPill status="ready" />
              <Badge variant="brand">5 topics</Badge>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" size="sm">
                Details
              </Button>
              <Button size="sm" rightIcon={<ArrowRight />}>
                Open
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Card without footer</CardTitle>
              <CardDescription>Header + content only.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="prose-lecture">Gradient descent repeatedly steps against the gradient.</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="forms" title="7 · Input · Textarea · Select · Checkbox · Radio">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Default" placeholder="Lecture title" />
          <Input label="With hint" hint="Shown to students in the lecture list." placeholder="Lecture title" />
          <Input label="Required" required placeholder="you@university.edu" type="email" leftIcon={<Mail />} />
          <Input
            label="With error"
            defaultValue="not-an-email"
            error="Enter a valid email address."
            hint="We never share your email."
            leftIcon={<Mail />}
          />
          <Input label="Search (leftIcon)" leftIcon={<Search />} placeholder="Search transcripts…" />
          <Input label="Disabled" disabled defaultValue="Read only value" />
          <Textarea label="Textarea" hint="Markdown is not supported." placeholder="Correct the transcript text…" />
          <Textarea label="Textarea with error" required defaultValue="?" error="Text must be at least 3 characters." />
          <Select label="Select" hint="Retriever used for search." defaultValue="hybrid">
            <option value="hybrid">hybrid</option>
            <option value="keyword">keyword</option>
            <option value="vector">vector</option>
          </Select>
          <Select label="Select with error" required error="Choose a rejection reason." defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            <option value="FACTUALLY_WRONG">FACTUALLY_WRONG</option>
            <option value="AMBIGUOUS">AMBIGUOUS</option>
          </Select>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Checkbox label="Unchecked" />
            <Checkbox label="Checked" defaultChecked />
            <Checkbox
              label="I have the lecturer’s consent"
              description="Required before the recording is sent to AssemblyAI for transcription."
            />
            <Checkbox label="Disabled" disabled />
            <Checkbox label="With error" error="Consent is required to upload." />
          </div>
          <RadioGroup legend="Difficulty" hint="Applies to newly generated questions." required>
            <Radio name="difficulty" value="easy" label="Easy" />
            <Radio name="difficulty" value="medium" label="Medium" defaultChecked description="Recommended" />
            <Radio name="difficulty" value="hard" label="Hard" />
            <Radio name="difficulty" value="expert" label="Expert (disabled)" disabled />
          </RadioGroup>
        </div>
      </Section>

      <Section id="dialog" title="8 · Dialog">
        <DialogDemo />
      </Section>

      <Section id="tabs" title="9 · Tabs">
        <Tabs
          label="Lecture views"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'transcript', label: 'Transcript', content: <p className="prose-lecture">{segment.text}</p> },
            { value: 'topics', label: 'Topics', content: <p className="text-sm text-ink-2">5 topic sections.</p> },
            { value: 'quiz', label: 'Quiz', content: <p className="text-sm text-ink-2">5 approved questions.</p> },
            { value: 'admin', label: 'Admin (disabled)', content: null, disabled: true },
          ]}
        />
        <p className="text-xs text-ink-3">Selected: {tab}. Focus a tab, then use ← → Home End.</p>
      </Section>

      <Section id="table" title="10 · Table (sample rows, sticky header, zebra)">
        <Table stickyHeader containerClassName="max-h-64">
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Course</Th>
              <Th>Status</Th>
              <Th className="text-right">Duration</Th>
            </Tr>
          </Thead>
          <Tbody>
            {[...lectures, ...lectures].map((l, i) => (
              <Tr key={`${l.id}-${i}`}>
                <Td className="font-medium">{l.title}</Td>
                <Td className="text-ink-2">{l.courseCode}</Td>
                <Td>
                  <StatusPill status={l.status} />
                </Td>
                <Td className="text-right tabular-nums text-ink-2">
                  {l.durationSec === null ? '—' : formatDuration(l.durationSec)}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <Table zebra={false}>
          <Thead>
            <Tr>
              <Th>zebra=false</Th>
              <Th>Value</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>Row one</Td>
              <Td>1</Td>
            </Tr>
            <Tr>
              <Td>Row two</Td>
              <Td>2</Td>
            </Tr>
          </Tbody>
        </Table>
      </Section>

      <Section id="tooltip" title="11 · Tooltip (300 ms, hover + focus, Esc hides)">
        <Row>
          <Tooltip content="Copy deep link">
            <IconButton aria-label="Copy link" icon={<Copy />} variant="secondary" />
          </Tooltip>
          <Tooltip content="Re-runs the pipeline from chunking">
            <Button variant="secondary">Reprocess</Button>
          </Tooltip>
          <Tooltip content="Shown below" side="bottom">
            <Button variant="ghost">Bottom tooltip</Button>
          </Tooltip>
        </Row>
      </Section>

      <Section id="spinner" title="12 · Spinner">
        <Row>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" className="text-brand" />
          <span className="inline-flex items-center gap-2 text-sm text-ink-2">
            <Spinner size="sm" label="Loading transcript" /> Loading transcript…
          </span>
        </Row>
      </Section>

      <Section id="skeleton" title="13 · Skeleton">
        <div className="flex items-start gap-4" aria-busy="true" aria-label="Loading example">
          <Skeleton width={48} height={48} className="rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton width="60%" height={16} />
            <Skeleton width="90%" />
            <Skeleton width="75%" />
          </div>
        </div>
        <Skeleton height={96} className="rounded-card" />
      </Section>

      <Section id="progress" title="14 · Progress">
        <Progress label="Not started" value={0} showLabel />
        <Progress label="Transcribing" value={35} showLabel />
        <Progress label="Complete" value={100} showLabel tone="success" />
        <Progress label="Indexing" indeterminate showLabel />
        <Progress label="Without visible label" value={62} />
      </Section>

      <Section id="empty-state" title="15 · EmptyState">
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState
            icon={<Upload />}
            title="No lectures yet"
            description="Upload a recording and LectureLens will build the transcript, topics and summaries."
            action={{ label: 'Upload lecture', onClick: () => undefined, icon: <Plus /> }}
          />
          <EmptyState title="No questions to review" description="Generated questions will appear here." />
        </div>
      </Section>

      <Section id="error-state" title="16 · ErrorState">
        <div className="grid gap-4 sm:grid-cols-2">
          <ErrorState
            message={`Couldn’t load the transcript (request req_8fK2a). Retried ${retries}×.`}
            onRetry={() => setRetries((n) => n + 1)}
          />
          <ErrorState variant="notImplemented" />
        </div>
        <ErrorState variant="error" title="Error without retry" message="onRetry not provided, so no button." />
      </Section>

      <Section id="toast" title="17 · Toast">
        <ToastDemo />
      </Section>
    </div>
  );
}
