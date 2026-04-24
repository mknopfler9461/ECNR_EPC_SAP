export const metadata = {
  title: 'BESS Industry Infographic',
  description: 'Interactive BESS industry insight infographic for EPC and SAP transformation.',
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
