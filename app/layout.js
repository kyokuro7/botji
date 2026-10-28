import './globals.css';

export const metadata = {
  title: 'XAGENT AI Studio',
  description: 'Generate kode pakai AI, langsung lihat preview.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
