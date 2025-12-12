import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 focus:ring-cyan-500',
        secondary: 'bg-slate-700 hover:bg-slate-600 text-white focus:ring-slate-500',
        outline: 'border border-slate-600 hover:bg-slate-800 text-slate-300 focus:ring-slate-500',
        ghost: 'hover:bg-slate-800 text-slate-300 focus:ring-slate-500',
        danger: 'bg-red-500 hover:bg-red-400 text-white focus:ring-red-500',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);

Button.displayName = 'Button';

