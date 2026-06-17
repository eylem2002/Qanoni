import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router/AppRouter";
import { AuthGate } from "@/app/auth/AuthGate";

export default function App() {
  return (
    <AppProviders>
      <AuthGate>
        <AppRouter />
      </AuthGate>
    </AppProviders>
  );
}
