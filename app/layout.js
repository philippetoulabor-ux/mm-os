import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "mm-os",
  description: "Desktop-style web shell built with Next.js and React",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
