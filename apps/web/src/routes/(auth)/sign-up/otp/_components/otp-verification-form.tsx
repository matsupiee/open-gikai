import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/better-auth/auth-client";

import { Button } from "../../../../../shared/_components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../../../shared/_components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../../../../../shared/_components/ui/input-otp";

interface OtpVerificationFormProps {
  email: string;
}

export default function OtpVerificationForm({
  email,
}: OtpVerificationFormProps) {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setIsVerifying(true);
    try {
      const { error } = await authClient.emailOtp.verifyEmail({
        email,
        otp,
      });
      if (error) {
        toast.error(error.message || "確認コードが正しくありません");
        setOtp("");
      } else {
        navigate({ to: "/" });
        toast.success("アカウント登録に成功しました");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (error) {
        toast.error(error.message || "再送信に失敗しました");
      } else {
        toast.success("確認コードを再送信しました");
        setOtp("");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">確認コードを入力</CardTitle>
        <CardDescription>
          {email} に6桁の確認コードを送信しました。
          <br />
          メールに記載されたコードを入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={setOtp}
          onComplete={handleVerify}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <Button
          className="w-full"
          onClick={handleVerify}
          disabled={otp.length !== 6 || isVerifying}
        >
          {isVerifying ? "確認中..." : "確認する"}
        </Button>
      </CardContent>
      <CardFooter className="justify-center">
        <Button
          variant="link"
          onClick={handleResend}
          disabled={isResending}
        >
          {isResending ? "送信中..." : "確認コードを再送信する"}
        </Button>
      </CardFooter>
    </Card>
  );
}
