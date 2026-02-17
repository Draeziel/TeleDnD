interface StatusBoxProps {
  type: 'error' | 'info' | 'success';
  message: string;
}

export function StatusBox({ type, message }: StatusBoxProps) {
  return <div className={`status-box ${type}`}>{message}</div>;
}
