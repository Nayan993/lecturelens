import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, KeyRound, Mail, Presentation, User as UserIcon, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { isApiError } from '../../lib/apiClient';
import { cn } from '../../lib/cn';
import { apiFieldErrors, firstErrorField, zodFieldErrors, type FieldErrors } from '../../lib/forms';
import { passwordStrength } from '../../lib/passwordStrength';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { ROLES, type Role } from '../../types';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, Input, Progress, useToast } from '../../components/ui';
import { FieldError } from '../../components/ui/Field';
import { FormError } from './LoginPage';
import { H1 } from '../../components/layout/Page';

const identitySchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'Use at most 100 characters'),
  email: z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address, like name@university.edu'),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Choose Student or Teacher' }) }),
});

// A separate object so the match refinement runs even while name/email are still invalid.
const passwordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters'),
    confirmPassword: z.string().min(1, 'Re-enter your password'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords don’t match' });

export const registerSchema = identitySchema.and(passwordSchema);

type Values = { name: string; email: string; password: string; confirmPassword: string; role: Role };
type Field = keyof Values;
const FIELDS: readonly Field[] = ['name', 'email', 'password', 'confirmPassword', 'role'];

const ROLE_OPTIONS: Array<{ value: Role; title: string; description: string; icon: ReactNode }> = [
  { value: 'student', title: 'Student', description: 'Watch lectures, search and ask questions, take quizzes and get a revision plan.', icon: <BookOpen /> },
  { value: 'teacher', title: 'Teacher', description: 'Upload lectures, correct transcripts and approve what your students see.', icon: <Presentation /> },
];

const STRENGTH_TONE = ['danger', 'danger', 'brand', 'brand', 'success'] as const;

function RoleCards({ value, onChange, error, firstInputRef }: { value: Role; onChange: (role: Role) => void; error?: string; firstInputRef: RefObject<HTMLInputElement> }) {
  const name = useId();
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-ink-1">
        I am a
        <span aria-hidden className="ml-0.5 text-danger">
          *
        </span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option, i) => (
          <label
            key={option.value}
            className={cn(
              'relative flex cursor-pointer flex-col gap-1.5 rounded-card border bg-surface p-3.5 transition-colors',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
              value === option.value ? 'border-brand bg-brand-soft' : 'border-border hover:border-ink-3',
            )}
          >
            <input
              ref={i === 0 ? firstInputRef : undefined}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
              required
            />
            <span className="flex items-center gap-2 text-sm font-semibold text-ink-1">
              <span aria-hidden className="text-brand [&>svg]:h-4 [&>svg]:w-4">
                {option.icon}
              </span>
              {option.title}
              {value === option.value && <span className="ml-auto text-xs font-medium text-brand">Selected</span>}
            </span>
            <span className="text-xs leading-relaxed text-ink-2">{option.description}</span>
          </label>
        ))}
      </div>
      <div className="mt-1.5">
        <FieldError id={errorId}>{error}</FieldError>
      </div>
    </fieldset>
  );
}

function StrengthMeter({ id, password }: { id: string; password: string }) {
  const { score, label } = passwordStrength(password);
  return (
    <div id={id} className="flex flex-col gap-1">
      <Progress label={`Password strength: ${label}`} value={score} max={4} tone={STRENGTH_TONE[score]} className="[&>div]:h-1.5" />
      <p className="text-xs text-ink-2">
        Strength: <span className="font-medium text-ink-1">{password ? label : '—'}</span>
        {score < 4 && ' · Longer passwords that mix letters, numbers and symbols are stronger.'}
      </p>
    </div>
  );
}

export function RegisterPage() {
  useDocumentTitle('Create an account');
  const { register, status } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const strengthId = useId();

  const [values, setValues] = useState<Values>({ name: '', email: '', password: '', confirmPassword: '', role: 'student' });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
    role: useRef<HTMLInputElement>(null),
  };

  if (status === 'authenticated' && !pending) return <Navigate to="/app" replace />;

  const validate = (next: Values) => {
    const parsed = registerSchema.safeParse(next);
    return parsed.success ? {} : zodFieldErrors<Field>(parsed.error);
  };

  const update = <K extends Field>(field: K, value: Values[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
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
      const user = await register({ name: values.name.trim(), email: values.email.trim(), password: values.password, role: values.role });
      toast({ variant: 'success', title: 'Account created', description: `Welcome to LectureLens, ${user.name}.` });
      navigate('/app', { replace: true });
    } catch (err) {
      const message = isApiError(err) ? err.message : 'Something went wrong. Please try again.';
      if (isApiError(err) && err.code === 'VALIDATION_FAILED') setErrors(apiFieldErrors(err.details, FIELDS));
      if (isApiError(err) && err.code === 'CONFLICT') setErrors({ email: 'An account with this email already exists. Try signing in.' });
      setFormError(message);
      toast({ variant: 'error', title: 'Couldn’t create your account', description: message });
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col py-4 sm:py-8">
      <Card>
        <CardHeader>
          <h1 className={H1}>Create an account</h1>
          <CardDescription>It takes a minute. You can change your name later in Settings.</CardDescription>
        </CardHeader>
        <form noValidate onSubmit={onSubmit} aria-describedby={formError ? 'register-form-error' : undefined}>
          <CardContent className="flex flex-col gap-4">
            <FormError id="register-form-error" message={formError} />
            <Input
              ref={refs.name}
              label="Full name"
              autoComplete="name"
              required
              leftIcon={<UserIcon />}
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              error={errors.name}
            />
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
            <div className="flex flex-col gap-2">
              <Input
                ref={refs.password}
                label="Password"
                type="password"
                autoComplete="new-password"
                required
                leftIcon={<KeyRound />}
                hint="At least 8 characters."
                aria-describedby={strengthId}
                value={values.password}
                onChange={(e) => update('password', e.target.value)}
                error={errors.password}
              />
              <StrengthMeter id={strengthId} password={values.password} />
            </div>
            <Input
              ref={refs.confirmPassword}
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              leftIcon={<KeyRound />}
              value={values.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
            />
            <RoleCards value={values.role} onChange={(role) => update('role', role)} error={errors.role} firstInputRef={refs.role} />
            <Button type="submit" fullWidth loading={pending} leftIcon={<UserPlus />}>
              {pending ? 'Creating account…' : 'Create account'}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="justify-center">
          <p className="text-sm text-ink-2">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
