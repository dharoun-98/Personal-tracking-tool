"use client";

import { createContext, useContext } from "react";
import type { AccessState } from "@/lib/billing/access";

export interface ViewerAccount {
  signedIn: boolean;
  email: string | null;
  access: AccessState | null;
  accountError: string | null;
  hasStripeCustomer: boolean;
  cloudEnabled: boolean;
}

const AccountContext = createContext<ViewerAccount | null>(null);

export function AccountProvider({
  value,
  children,
}: {
  value: ViewerAccount;
  children: React.ReactNode;
}) {
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Server-authenticated identity and billing state for every in-app screen. */
export function useViewerAccount(): ViewerAccount {
  const account = useContext(AccountContext);
  if (!account) {
    throw new Error("useViewerAccount must be used inside AccountProvider");
  }
  return account;
}
