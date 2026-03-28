import { createFileRoute, Navigate } from "@tanstack/react-router";
import z from "zod";

import OtpVerificationForm from "@/routes/(auth)/sign-up/otp/_components/otp-verification-form";

const searchSchema = z.object({
  email: z.email(),
});

export const Route = createFileRoute("/(auth)/sign-up/otp/")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { email } = Route.useSearch();

  if (!email) {
    return <Navigate to="/sign-up" />;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <OtpVerificationForm email={email} />
    </div>
  );
}
