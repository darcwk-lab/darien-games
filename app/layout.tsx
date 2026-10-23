import "./globals.css";
export const metadata = { title: "Darien Games", description: "Darien Games 休闲小游戏合集" };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="zh-CN"><body>{children}</body></html>);
}
