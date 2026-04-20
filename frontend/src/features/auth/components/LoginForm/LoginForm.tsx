import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Lock, Mail } from 'lucide-react'
import { loginSchema, type LoginFormValues } from '@/lib/validation/auth.schema'
import { useLogin } from '../../hooks/useLogin'
import { Button } from '@/components/ui/Button/Button'
import { cn } from '@/lib/utils/cn'

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  const login = useLogin()
  const apiError = (login.error as { message?: string } | null)?.message

  const onSubmit = handleSubmit(async (values) => {
    await login.mutateAsync({ email: values.email, password: values.password })
    onSuccess?.()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-secondary">
          Email
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={cn('input pl-9', errors.email && 'border-danger')}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p id="email-error" role="alert" className="mt-1 text-xs text-danger">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-secondary">
          Mot de passe
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className={cn('input pl-9', errors.password && 'border-danger')}
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p id="password-error" role="alert" className="mt-1 text-xs text-danger">
            {errors.password.message}
          </p>
        )}
      </div>

      {apiError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{apiError}</span>
        </div>
      )}

      <Button type="submit" variant="primary" className="w-full" loading={login.isPending}>
        Se connecter
      </Button>
    </form>
  )
}
