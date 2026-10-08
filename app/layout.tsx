import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Vortyx Control Room",
  description:
    "Local system interface for the Vortyx artificial brain.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}