import type { Metadata } from "next";
import "@/styles/bos.css";

export const metadata: Metadata = {
  title: "Garage Guys BOS",
  description: "Garage Guys CRM, Search, Dispatch, Finance, and Field",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
