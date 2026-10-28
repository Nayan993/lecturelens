import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CircleAlert, KeyRound, LogIn, Mail } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { isApiError } from '../../lib/apiClient';
import { apiFieldErrors, firstErrorField, zodFieldErrors, type FieldErrors } from '../../lib/forms';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { DEMO_ACCOUNTS, showDemoAccounts } from '../../services';
import { getReturnPath } from '../../components/layout/RequireAuth';
import { H1 } from '../../components/layout/Page';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Checkbox,
  Input,
  Tooltip,
  useToast,
} from '../../components/ui';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address, like name@university.edu'),
  password: z.string().min(1, 'Enter your password').min(8, 'Passwords are at least 8 characters'),
});

type Field = keyof z.infer<typeof loginSchema>;
const FIELDS: readonly Field[] = ['email', 'password'];

/** Form-level error shown above the fields: icon + text, never colour alone. */
export function FormError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <div id={id} className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-ink-1">
      <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <p>
        <span className="font-semibold text-danger">Error: </span>
        {message}
      </p>
    </div>
  );
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { login, status } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getReturnPath(location.state);
  const cameFromProtectedPage = returnTo !== '/app';

  const [values, setValues] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const refs = { email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null) };

  if (status === 'authenticated' && !pending) return <Navigate to={returnTo} replace />;

  const validate = (next: typeof values) => {
    const parsed = loginSchema.safeParse(next);
    return parsed.success ? {} : zodFieldErrors<Field>(parsed.error);
  };

  const update = (field: Field, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // After the first submit, re-validate as the user types so errors clear as soon as they're fixed.
    if (attempted) setErrors(validate(next));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setFormError(null);
    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    const first = firstErrorField(fieldErrors, FIELDS);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    setPending(true);
    try {
      const user = await login(values.email.trim(), values.password, { remember });
      toast({ variant: 'success', title: `Signed in as ${user.name}` });
      navigate(returnTo, { replace: true });
    } catch (err) {
      const message = isApiError(err) ? err.message : 'Something went wrong. Please try again.';
      if (isApiError(err) && err.code === 'VALIDATION_FAILED') setErrors(apiFieldErrors(err.details, FIELDS));
      setFormError(message);
      toast({ variant: 'error', title: 'Sign-in failed', description: message });
      setPending(false);
    }
  };

  const fillDemo = (email: string, password: string) => {
    setValues({ email, password });
    setErrors({});
    setFormError(null);
    refs.password.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-4 sm:py-8">
      <Card>
        <CardHeader>
          <h1 className={H1}>Sign in</h1>
          <CardDescription>
            {cameFromProtectedPage ? 'Sign in to continue to the page you asked for.' : 'Welcome back to LectureLens.'}
          </CardDescription>
        </CardHeader>
        <form noValidate onSubmit={onSubmit} aria-describedby={formError ? 'login-form-error' : undefined}>
          <CardContent className="flex flex-col gap-4">
            <FormError id="login-form-error" message={formError} />
            <Input
              ref={refs.email}
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              leftIcon={<Mail />}
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              error={errors.email}
            />
            <Input
              ref={refs.password}
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              leftIcon={<KeyRound />}
              value={values.password}
              onChange={(e) => update('password', e.target.value)}
              error={errors.password}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Checkbox
                label="Remember me"
                description="Stay signed in on this device after closing the browser."
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <Tooltip content="Password reset is out of scope for this academic project.">
                <Button
                  variant="link"
                  size="sm"
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                  className="cursor-not-allowed text-ink-3 no-underline hover:no-underline"
                >
                  Forgot password?
                </Button>
              </Tooltip>
            </div>
            <Button type="submit" fullWidth loading={pending} leftIcon={<LogIn />}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="justify-center">
          <p className="text-sm text-ink-2">
            New to LectureLens?{' '}
            <Link to="/register" className="font-medium text-brand underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </CardFooter>
      </Card>

      {showDemoAccounts && (
        <section aria-labelledby="demo-accounts-title" className="rounded-card border border-dashed border-accent/50 bg-accent-soft p-4">
          <div className="flex items-center gap-2">
            <h2 id="demo-accounts-title" className="text-sm font-semibold text-ink-1">
              Demo accounts
            </h2>
            <Badge variant="accent">For the project demo</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-2">
            Seeded test accounts (password <code className="font-mono">{DEMO_ACCOUNTS[0].password}</code>). Choosing one fills
            the form above — then press Sign in.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="secondary"
                size="sm"
                className="h-auto flex-col items-start gap-0 py-2 text-left"
                onClick={() => fillDemo(account.email, account.password)}
              >
                <span>Use demo {account.role}</span>
                <span className="text-xs font-normal text-ink-2">{account.email}</span>
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
