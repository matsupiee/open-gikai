import SignInForm from "@/routes/(auth)/sign-in/_components/sign-in-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/sign-in/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <SignInForm />
    </div>
  );
}
