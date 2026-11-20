import { LoaderCircle } from "lucide-react";

export function LoadingScreen({ label = "Carregando" }: { label?: string }) {
  return <main className="loading-screen" role="status"><LoaderCircle className="spin" size={22} />{label}</main>;
}
