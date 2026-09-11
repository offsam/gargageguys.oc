import type { Metadata, Viewport } from "next";
import { FieldPwaRegister } from "@/components/bos/FieldPwaRegister";

export const metadata: Metadata = {
  title: "Field · Garage Guys",
  applicationName: "Garage Guys Field",
  appleWebApp: {
    capable: true,
    title: "GG Field",
    statusBarStyle: "default",
  },
  manifest: "/field.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#eef4fb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FieldPwaRegister />
      {children}
    </>
  );
}
