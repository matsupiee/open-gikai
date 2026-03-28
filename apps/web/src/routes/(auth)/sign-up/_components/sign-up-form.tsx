import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { isAllowedEmailDomain } from "@open-gikai/auth/allowed-email-domains";
import { authClient } from "@/lib/better-auth/auth-client";

import AllowedDomainDialog from "./allowed-domain-dialog";
import Loader from "../../../../shared/_components/loader";
import { Button } from "../../../../shared/_components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../../shared/_components/ui/card";
import { Input } from "../../../../shared/_components/ui/input";
import { Label } from "../../../../shared/_components/ui/label";

export default function SignUpForm() {
  const navigate = useNavigate();
  const { isPending } = authClient.useSession();
  const [showDomainDialog, setShowDomainDialog] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.email,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/sign-up/otp",
              search: { email: value.email },
            });
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        email: z
          .email("メールアドレスが不正です")
          .refine(isAllowedEmailDomain, "このメールドメインでは登録できません"),
        password: z.string().min(8, "パスワードは8文字以上で入力してください"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">新規登録</CardTitle>
          <CardDescription>
            メールアドレスとパスワードで新規登録
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <div>
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>メールアドレス</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p
                        key={error?.message}
                        className="text-sm text-destructive"
                      >
                        {error?.message}
                        {error?.message ===
                          "このメールドメインでは登録できません" && (
                          <>
                            {" "}
                            <button
                              type="button"
                              className="underline hover:no-underline"
                              onClick={() => setShowDomainDialog(true)}
                            >
                              許可されているドメイン一覧
                            </button>
                          </>
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="password">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>パスワード</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p
                        key={error?.message}
                        className="text-sm text-destructive"
                      >
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <form.Subscribe>
              {(state) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!state.canSubmit || state.isSubmitting}
                >
                  {state.isSubmitting ? "登録中..." : "新規登録"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Button
            variant="link"
            onClick={() => navigate({ to: "/sign-in" })}
          >
            アカウントをお持ちの方はこちら
          </Button>
        </CardFooter>
      </Card>

      <AllowedDomainDialog
        open={showDomainDialog}
        onOpenChange={setShowDomainDialog}
      />
    </>
  );
}
