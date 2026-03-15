"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const messages: Record<string, string> = {
  AccessDenied: "Your Google account is not authorised. Ask an admin to add your Google email to the users table.",
  Configuration: "Server configuration error. Check NEXTAUTH_SECRET and provider credentials.",
  Verification: "The sign-in link is no longer valid.",
  Default: "An unexpected error occurred during sign in.",
};

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error") ?? "Default";
  const message = messages[error] ?? messages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in failed</h1>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <a
          href="/login"
          className="inline-block bg-blue-600 text-white px-5 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Back to login
        </a>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return <Suspense><ErrorContent /></Suspense>;
}
