import SignUpForm from "@/routes/(auth)/sign-up/_components/sign-up-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/sign-in/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <SignUpForm />;
}
