import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export function QueryState({
  loading,
  error,
  children,
  onRetry,
}: {
  loading: boolean;
  error: Error | null;
  children: ReactNode;
  onRetry?: () => void;
}) {
  if (loading) return <div className="state-box" role="status"><span className="spinner" />Consultando fonte...</div>;
  if (error) return (
    <div className="state-box state-error" role="alert">
      <AlertTriangle size={18} /><span>{error.message}</span>
      {onRetry && <button className="button button-quiet button-small" onClick={onRetry} type="button"><RefreshCw size={14} /> Tentar novamente</button>}
    </div>
  );
  return children;
}
