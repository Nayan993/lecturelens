import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, FilePenLine, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react';
import { formatDate } from '../../../lib/formatDate';
import { formatDuration } from '../../../lib/formatTime';
import { lectureHref } from '../../../lib/lectureLinks';
import { STAGE_NAMES, type Lecture, type StageName } from '../../../types';
import { Badge, Button, Dialog, IconButton, Input, Menu, Select, StatusPill, Table, Tbody, Td, Th, Thead, Tr, useToast } from '../../../components/ui';
import { useDeleteLecture, useReprocessLecture } from '../hooks';

const STAGE_LABEL: Record<StageName, string> = {
  extracting: 'Extract audio (start over)',
  transcribing: 'Transcribe',
  chunking: 'Split into passages',
  segmenting: 'Find topics',
  summarising: 'Write summaries',
  indexing: 'Index for search',
};

/** Deleting is irreversible, so the teacher must type the exact title first. */
export function DeleteLectureDialog({ lecture, open, onOpenChange }: { lecture: Lecture; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [typed, setTyped] = useState('');
  const remove = useDeleteLecture();
  const { toast } = useToast();
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  const matches = typed.trim() === lecture.title;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Delete this lecture?"
      description="This permanently removes the recording, transcript, topics, summaries, questions and every student attempt on it. It cannot be undone."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep lecture
          </Button>
          <Button
            variant="danger"
            leftIcon={<Trash2 />}
            disabled={!matches}
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(lecture.id, {
                onSuccess: () => {
                  onOpenChange(false);
                  toast({ variant: 'success', title: 'Lecture deleted', description: lecture.title });
                },
                onError: (err) => toast({ variant: 'error', title: 'Couldn’t delete the lecture', description: err.message }),
              })
            }
          >
            Delete permanently
          </Button>
        </>
      }
    >
      <Input
        label={
          <>
            Type <span className="font-semibold text-ink-1">{lecture.title}</span> to confirm
          </>
        }
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </Dialog>
  );
}

export function ReprocessDialog({ lecture, open, onOpenChange }: { lecture: Lecture; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [fromStage, setFromStage] = useState<StageName>(lecture.status === 'failed' ? (lecture.error?.stage ?? 'extracting') : 'chunking');
  const reprocess = useReprocessLecture();
  const navigate = useNavigate();
  const { toast } = useToast();
  const discardsCorrections = fromStage === 'extracting' || fromStage === 'transcribing';
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Reprocess this lecture?"
      description="Everything from the chosen step onward is rebuilt. Students lose access until it finishes."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            leftIcon={<RefreshCw />}
            loading={reprocess.isPending}
            onClick={() =>
              reprocess.mutate(
                { id: lecture.id, fromStage },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    navigate(lectureHref(lecture.id));
                  },
                  onError: (err) => toast({ variant: 'error', title: 'Couldn’t reprocess', description: err.message }),
                },
              )
            }
          >
            Reprocess
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select label="Start from" value={fromStage} onChange={(e) => setFromStage(e.target.value as StageName)}>
          {STAGE_NAMES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </Select>
        {discardsCorrections && (
          <p className="rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink-1">
            <span className="font-semibold">Warning:</span> starting here re-transcribes the audio, so your transcript corrections and approval are
            discarded.
          </p>
        )}
      </div>
    </Dialog>
  );
}

function RowActions({ lecture, onDelete, onReprocess }: { lecture: Lecture; onDelete: () => void; onReprocess: () => void }) {
  const navigate = useNavigate();
  const ready = lecture.status === 'ready';
  const canReprocess = ready || lecture.status === 'failed';
  return (
    <Menu
      align="end"
      label={`Actions for ${lecture.title}`}
      items={[
        { id: 'view', label: ready ? 'View' : 'View status', icon: <Eye />, onSelect: () => navigate(lectureHref(lecture.id)) },
        { id: 'review', label: 'Review transcript', icon: <FilePenLine />, disabled: !ready, onSelect: () => navigate(`/app/lectures/${lecture.id}/review`) },
        { id: 'reprocess', label: 'Reprocess…', icon: <RefreshCw />, disabled: !canReprocess, onSelect: onReprocess },
        { id: 'delete', label: 'Delete…', icon: <Trash2 />, tone: 'danger', onSelect: onDelete },
      ]}
      trigger={(props) => <IconButton {...props} aria-label={`Actions for ${lecture.title}`} icon={<MoreHorizontal />} size="sm" />}
    />
  );
}

/** The teacher's lecture list: one row per lecture with status, topics, pending reviews and actions. */
export function TeacherLecturesTable({ lectures, pendingCount }: { lectures: Lecture[]; pendingCount: Map<string, number> }) {
  const [deleting, setDeleting] = useState<Lecture | null>(null);
  const [reprocessing, setReprocessing] = useState<Lecture | null>(null);
  return (
    <>
      <Table>
        <Thead>
          <Tr>
            <Th>Title</Th>
            <Th>Status</Th>
            <Th className="text-right">Duration</Th>
            <Th>Uploaded</Th>
            <Th className="text-right">Topics</Th>
            <Th className="text-right">To review</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {lectures.map((l) => {
            const pending = pendingCount.get(l.id) ?? 0;
            return (
              <Tr key={l.id}>
                <Td className="max-w-[22rem]">
                  <Link to={lectureHref(l.id)} className="font-medium text-ink-1 hover:text-brand hover:underline">
                    {l.title}
                  </Link>
                  {l.status === 'ready' && !l.transcriptApproved && <p className="text-xs text-warning">Transcript not approved yet</p>}
                </Td>
                <Td>
                  <StatusPill status={l.status} />
                </Td>
                <Td className="text-right tabular-nums text-ink-2">{l.durationSec === null ? '—' : formatDuration(l.durationSec)}</Td>
                <Td className="whitespace-nowrap text-ink-2">{formatDate(l.createdAt)}</Td>
                <Td className="text-right tabular-nums text-ink-2">{l.topicCount ?? '—'}</Td>
                <Td className="text-right">
                  {pending > 0 ? (
                    <Link to="/app/review" aria-label={`${pending} items to review for ${l.title}`}>
                      <Badge variant="accent">{pending}</Badge>
                    </Link>
                  ) : (
                    <span className="text-ink-3">0</span>
                  )}
                </Td>
                <Td className="w-12 text-right">
                  <RowActions lecture={l} onDelete={() => setDeleting(l)} onReprocess={() => setReprocessing(l)} />
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      {deleting && <DeleteLectureDialog lecture={deleting} open onOpenChange={(o) => !o && setDeleting(null)} />}
      {reprocessing && <ReprocessDialog lecture={reprocessing} open onOpenChange={(o) => !o && setReprocessing(null)} />}
    </>
  );
}
