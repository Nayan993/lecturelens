import { ClipboardCheck, Upload, Users } from 'lucide-react';
import { StubPage } from '../StubPage';

export function UploadPage() {
  return <StubPage title="Upload lecture" comingIn="P1.6" icon={<Upload />} />;
}

export function ReviewPage() {
  return <StubPage title="Review Queue" comingIn="P1.6" icon={<ClipboardCheck />} />;
}

export function StudentsPage() {
  return <StubPage title="Students" comingIn="P1.6" icon={<Users />} />;
}
