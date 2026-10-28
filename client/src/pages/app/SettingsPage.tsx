import { useEffect, useState, type FormEvent } from 'react';
import { LogOut, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getThemePreference, setThemePreference, type ThemePreference } from '../../lib/theme';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Radio, RadioGroup, useToast } from '../../components/ui';
import { useUpdateProfile } from '../../features/account/hooks';
import { PAGE_NARROW, PageHeader } from '../../components/layout/Page';

const THEMES: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: 'light', label: 'Light', description: 'Warm paper background.' },
  { value: 'dark', label: 'Dark', description: 'Easier on the eyes at night.' },
  { value: 'system', label: 'System', description: 'Follow your device setting.' },
];

/** /app/settings — profile, appearance and account. Deliberately small. */
export function SettingsPage() {
  useDocumentTitle('Settings');
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const update = useUpdateProfile();
  const [name, setName] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

  useEffect(() => setName(user?.name ?? ''), [user?.name]);

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) {
      setNameError('Use 1–100 characters.');
      return;
    }
    setNameError(null);
    update.mutate(
      { name: trimmed },
      {
        onSuccess: () => toast({ variant: 'success', title: 'Profile saved' }),
        onError: (err) => toast({ variant: 'error', title: 'Couldn’t save your profile', description: err.message }),
      },
    );
  };

  const chooseTheme = (pref: ThemePreference) => {
    setTheme(pref);
    setThemePreference(pref);
  };

  return (
    <div className={PAGE_NARROW}>
      <PageHeader title="Settings" description="Your profile, appearance and account." />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear to teachers and in the app.</CardDescription>
        </CardHeader>
        <form onSubmit={onSave} noValidate>
          <CardContent className="flex flex-col gap-4">
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={nameError ?? undefined} autoComplete="name" />
            <Input label="Email" value={user?.email ?? ''} readOnly hint="Your email can’t be changed here." className="bg-bg text-ink-2" />
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-ink-2">
                Role <Badge variant={user?.role === 'teacher' ? 'accent' : 'brand'} className="capitalize">{user?.role}</Badge>
              </p>
              <Button type="submit" size="sm" leftIcon={<Save />} loading={update.isPending} disabled={name.trim() === user?.name}>
                Save
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup legend="Theme">
            {THEMES.map((t) => (
              <Radio key={t.value} name="theme" value={t.value} label={t.label} description={t.description} checked={theme === t.value} onChange={() => chooseTheme(t.value)} />
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signing out ends your session on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" leftIcon={<LogOut />} onClick={logout}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
