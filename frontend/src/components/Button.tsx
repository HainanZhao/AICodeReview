import type React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  as?: 'button' | 'a';
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  disabled?: boolean;
  [key: string]: any;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  leftIcon,
  rightIcon,
  className = '',
  as = 'button',
  href,
  onClick,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:shadow-sm';

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-[#1f75cb] to-[#1068bf] hover:from-[#1068bf] hover:to-[#0a569c] text-white shadow-[0_4px_14px_rgba(31,117,203,0.3)] hover:shadow-[0_6px_20px_rgba(16,104,191,0.4)] focus:ring-[#1f75cb]',
    secondary:
      'bg-gradient-to-r from-[#f0f0f0] to-[#e5e5e5] hover:from-[#e5e5e5] hover:to-[#dcdcdc] text-[#111111] dark:from-[#2e2e33] dark:to-[#333338] dark:hover:from-[#333338] dark:hover:to-[#38383d] dark:text-[#ececec] border border-[#dbdbdb] dark:border-[#404040] shadow-sm hover:shadow focus:ring-gray-400',
    danger:
      'bg-gradient-to-r from-[#db3b21] to-[#c42a12] hover:from-[#c42a12] hover:to-[#af2610] text-white shadow-[0_4px_14px_rgba(219,59,33,0.3)] hover:shadow-[0_6px_20px_rgba(196,42,18,0.4)] focus:ring-[#db3b21]',
    ghost:
      'text-[#444444] dark:text-[#a1a1aa] hover:bg-[#f0f0f0] dark:hover:bg-[#2e2e33] hover:text-[#111111] dark:hover:text-[#ececec] focus:ring-gray-400 border border-transparent hover:border-[#dbdbdb] dark:hover:border-[#404040] shadow-none hover:shadow-sm',
    success:
      'bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(5,150,105,0.4)] focus:ring-green-500',
  };

  const sizeStyles = {
    sm: 'text-[10px] font-bold py-0.5 px-2.5 gap-1.5 uppercase tracking-tight',
    md: 'text-[11px] font-semibold py-1.5 px-3.5 gap-2',
    lg: 'text-sm font-semibold py-2.5 px-5 gap-2.5',
  };

  const iconSizeStyles = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (as === 'a') {
    return (
      <a className={combinedClassName} href={href} onClick={onClick} {...props}>
        {leftIcon && <span className={iconSizeStyles[size]}>{leftIcon}</span>}
        {children}
        {rightIcon && <span className={iconSizeStyles[size]}>{rightIcon}</span>}
      </a>
    );
  }

  return (
    <button className={combinedClassName} onClick={onClick} disabled={disabled} {...props}>
      {leftIcon && <span className={iconSizeStyles[size]}>{leftIcon}</span>}
      {children}
      {rightIcon && <span className={iconSizeStyles[size]}>{rightIcon}</span>}
    </button>
  );
};
