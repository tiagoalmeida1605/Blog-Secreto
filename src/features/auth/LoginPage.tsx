import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ArrowRight, LockKeyhole, Network } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { LoadingScreen } from "../../components/feedback/LoadingScreen";

function loginMessage(code: string) {
  const messages: Record<string, string> = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/network-request-failed": "Falha de conexão com o Firebase Authentication.",
    "auth/user-disabled": "Esta conta está desativada.",
  };
  return messages[code] || "Não foi possível iniciar a sessão. Verifique os dados e tente novamente.";
}

export function LoginPage() {
  const { user, ready, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!ready) return <LoadingScreen label="Carregando autenticação" />;
  if (user) {
    const destination = (location.state as { from?: string } | null)?.from || "/";
    return <Navigate to={destination} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (reason) {
      setError(loginMessage((reason as { code?: string })?.code || ""));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-brand">
        <div className="brand-lockup"><span className="brand-mark">NX</span><span>NEXUS <b>DEV HUB</b></span></div>
        <div className="login-copy">
          <p className="eyebrow">PERSONAL DEVELOPMENT OPERATIONS</p>
          <h1>Seu ecossistema.<br /><span>Em um só lugar.</span></h1>
          <p>Centro privado para projetos, integrações e atividade técnica. Acesso restrito à conta proprietária.</p>
          <div className="login-signal"><Network size={16} /><span>PRIVATE WORKSPACE / OWNER ACCESS</span></div>
        </div>
      </section>
      <section className="login-card" aria-labelledby="login-heading">
        <div className="login-card-icon"><LockKeyhole size={20} /></div>
        <p className="eyebrow">AUTH / FIREBASE</p>
        <h2 id="login-heading">Acessar workspace</h2>
        <p className="muted">Entre com a conta proprietária configurada no Firebase.</p>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label htmlFor="login-email">E-mail</label>
          <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="login-password">Senha</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="button button-primary button-wide" type="submit" disabled={submitting}>
            {submitting ? "Verificando..." : "Entrar"} <ArrowRight size={16} />
          </button>
        </form>
        <p className="login-footnote">Não há cadastro público. O acesso é validado novamente pela API privada.</p>
      </section>
    </main>
  );
}
