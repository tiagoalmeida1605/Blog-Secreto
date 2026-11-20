import { Suspense } from "react";
import { RouterProvider } from "react-router-dom";
import { LoadingScreen } from "../components/feedback/LoadingScreen";
import { router } from "./router";

export function App() {
  return <Suspense fallback={<LoadingScreen label="Carregando módulo" />}><RouterProvider router={router} /></Suspense>;
}
