import './globals.css';
import { Navbar } from '@/components/Navbar';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'CodeOrigin AI — Educational Code Review & Evolution Platform',
  description: 'Static analysis, revision comparison, and code review platform for Python.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen flex flex-col text-slate-900">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
            <p>© 2026 CodeOrigin AI. Educational code evolution & static analysis platform.</p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
