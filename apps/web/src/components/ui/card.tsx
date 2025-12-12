import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700/50',
        className
      )}
      {...props}
    />
  );
});

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn('p-6 pb-4', className)} {...props} />;
});

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return <h3 ref={ref} className={cn('text-xl font-semibold text-white', className)} {...props} />;
  }
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    return <p ref={ref} className={cn('text-sm text-slate-400 mt-1', className)} {...props} />;
  }
);

CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />;
});

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn('p-6 pt-0 flex items-center', className)} {...props} />;
});

CardFooter.displayName = 'CardFooter';

