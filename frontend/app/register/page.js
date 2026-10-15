import Link from "next/link";
import GuestRoute from "@/components/auth/GuestRoute";
import AuthShell from "@/components/auth/AuthShell";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = { title: "Create account · BrainBoard" };

export default function RegisterPage() {
  return (
    <GuestRoute>
      <AuthShell
        title="Create your account"
        subtitle="Start a shared workspace for your team."
        footer={
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-ember-300 hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <RegisterForm />
      </AuthShell>
    </GuestRoute>
  );
}