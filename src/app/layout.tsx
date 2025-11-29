import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Typing",
  description: "Typing for typers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <script
        defer
        data-website-id="dfid_zrMrf9T9nmZuiqBFW8t93"
        data-domain="typing.aryangarg.dev"
        data-allow-localhost="true"
        src="https://datafa.st/js/script.js">
      </script>
      <body
        className={`antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
