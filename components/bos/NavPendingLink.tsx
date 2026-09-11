"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

function LinkPendingBody({
  children,
  showMark,
}: {
  children: ReactNode;
  showMark: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className={pending ? "bos-nav-pending-wrap is-navigating" : "bos-nav-pending-wrap"}>
        {children}
      </span>
      {showMark && pending ? <span className="bos-nav-pending" aria-hidden /> : null}
    </>
  );
}

/** Link that shows pending state while the App Router navigation is in flight. */
export function NavPendingLink({
  href,
  className,
  children,
  tabIndex,
  showMark = true,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  tabIndex?: number;
  showMark?: boolean;
}) {
  return (
    <Link href={href} className={className} tabIndex={tabIndex} prefetch>
      <LinkPendingBody showMark={showMark}>{children}</LinkPendingBody>
    </Link>
  );
}
