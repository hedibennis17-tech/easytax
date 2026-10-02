import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <span className="text-3xl font-bold text-red-600">Easy</span>
          <span className="text-3xl font-bold text-gray-900">Tax</span>
          <span className="ml-2 text-xs bg-red-50 text-red-600 border border-red-200 rounded px-2 py-0.5 font-medium">
            CANADA
          </span>
        </Link>
        <p className="text-gray-500 text-sm mt-2">
          Connectez-vous à votre dossier fiscal
        </p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "shadow-sm border border-gray-100 rounded-2xl",
            headerTitle: "text-gray-900 font-bold",
            formButtonPrimary:
              "bg-red-600 hover:bg-red-700 text-white rounded-lg",
            footerActionLink: "text-red-600 hover:text-red-700",
          },
        }}
      />
    </main>
  );
}
