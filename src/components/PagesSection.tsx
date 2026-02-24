'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PAGES = [
  { href: '/kotlin-rev/', label: '逆引きKotlin', desc: 'Kotlinリファレンス' },
  { href: '/docs/', label: 'MEMO', desc: '技術メモ' },
  { href: '/snippet/', label: 'Snippet', desc: 'コードスニペット' },
  { href: '/feeds/', label: 'Feeds', desc: 'ニュースフィード' },
  { href: '/random_pass/', label: 'Random Pass', desc: 'パスワード生成' },
];

export default function PagesSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-16">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 group cursor-pointer w-full text-left"
      >
        <span className="w-8 h-0.5 bg-accent-pink" />
        <h2 className="text-2xl font-bold text-white">Pages</h2>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="text-accent-pink text-lg ml-1"
        >
          ▼
        </motion.span>
        <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
          {open ? 'close' : 'open'}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
              {PAGES.map((page, i) => (
                <motion.a
                  key={page.href}
                  href={page.href}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.4,
                    delay: i * 0.07,
                    ease: [0.25, 0.8, 0.25, 1],
                  }}
                  whileHover={{
                    scale: 1.03,
                    borderColor: 'rgba(236, 72, 153, 0.5)',
                  }}
                  className="block p-4 bg-dark-800/50 border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors group"
                >
                  <span className="text-gray-200 font-medium group-hover:text-accent-pink transition-colors">
                    {page.label}
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">{page.desc}</span>
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
