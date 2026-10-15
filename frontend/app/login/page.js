import Link from "next/link";
import GuestRoute from "@/components/auth/GuestRoute";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in · BrainBoard" };

export default function LoginPage() {
  return (
    <GuestRoute>
      <AuthShell
        title="Welcome back"
        subtitle="Sign in to pick up where you left off."
        footer={
          <>
            New to BrainBoard?{" "}
            <Link href="/register" className="text-ember-300 hover:underline">
              Create an account
            </Link>
          </>
        }
      >
        <LoginForm />
      </AuthShell>
    </GuestRoute>
  );
}