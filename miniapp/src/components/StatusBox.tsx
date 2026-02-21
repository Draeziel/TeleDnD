interface StatusBoxProps {
  type: 'error' | 'info' | 'success';
  message: string;
}

export function StatusBox({ type, message }: StatusBoxProps) {
  const role = type === 'error' ? 'alert' : 'status';
  const ariaLive = type === 'error' ? 'assertive' : 'polite';

  return (
    <div className={`status-box ${type}`} role={role} aria-live={ariaLive}>
      {message}
    </div>
  );
}
