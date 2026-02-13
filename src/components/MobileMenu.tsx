import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
}

interface Props {
  navItems: NavItem[];
}

export default function MobileMenu({ navItems }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-300 hover:text-accent-cyan transition-colors"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-16 left-0 right-0 bg-dark-800 border-b border-dark-600 shadow-lg">
          <nav className="container mx-auto px-4 py-4">
            {navItems.map(item => (
              <a
                key={item.href}
                href={item.href}
                className="block py-3 text-gray-300 hover:text-accent-cyan transition-colors border-b border-dark-600 last:border-b-0"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
