import "./globals.css";
export const metadata = { title: "拼豆消消乐 · 无限时", description: "轻松无计时的像素拼豆颜色分类拼图" };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="zh-CN"><body>{children}</body></html>);
}
