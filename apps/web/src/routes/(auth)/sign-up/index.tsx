import SignUpForm from "@/routes/(auth)/sign-up/_components/sign-up-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/sign-up/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <SignUpForm />
    </div>
  );
}
