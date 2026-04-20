import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, id, className, ...props },
  ref,
) {
  const autoId = id || props.name
  return (
    <div>
      {label && (
        <label htmlFor={autoId} className="mb-1 block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={autoId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${autoId}-error` : hint ? `${autoId}-hint` : undefined}
          className={cn(
            'input',
            leftIcon && 'pl-9',
            error && 'border-danger focus:border-danger',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${autoId}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${autoId}-hint`} className="mt-1 text-xs text-text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
