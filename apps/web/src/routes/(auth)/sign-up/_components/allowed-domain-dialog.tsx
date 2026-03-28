import { ALLOWED_EMAIL_DOMAINS } from "@open-gikai/auth/allowed-email-domains";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../shared/_components/ui/dialog";

interface AllowedDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AllowedDomainDialog({
  open,
  onOpenChange,
}: AllowedDomainDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>登録可能なメールドメイン</DialogTitle>
          <DialogDescription>
            以下のドメインのメールアドレスで登録できます。
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-64 overflow-y-auto columns-2 gap-x-4 text-sm">
          {ALLOWED_EMAIL_DOMAINS.map((domain) => (
            <li key={domain} className="py-0.5">
              @{domain.replace("*.", "")}
              {domain.startsWith("*.") && (
                <span className="text-muted-foreground">
                  {" "}
                  (サブドメイン可)
                </span>
              )}
            </li>
          ))}
        </ul>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
