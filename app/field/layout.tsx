import type { Metadata, Viewport } from "next";
import { FieldPwaRegister } from "@/components/bos/FieldPwaRegister";

export const metadata: Metadata = {
  title: "Field · Garage Guys",
  applicationName: "Garage Guys Field",
  appleWebApp: {
    capable: true,
    title: "GG Field",
    statusBarStyle: "black-translucent",
  },
  manifest: "/field.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#071018",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FieldPwaRegister />
      {children}
    </>
  );
}
