import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "mm-os",
  description: "Desktop-style web shell built with Next.js and React",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de" style={{ height: "100%" }}>
      <body
        className={`${inter.className} antialiased`}
        style={{
          margin: 0,
          minHeight: "100%",
          backgroundColor: "var(--mm-desktop-bg)",
          color: "var(--mm-shell-text)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
