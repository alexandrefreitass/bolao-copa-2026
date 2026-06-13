import React from 'react';
import { Trophy } from 'lucide-react';

const Footer = () => (
  <footer className="mt-20 border-t border-white/10 bg-[hsl(var(--brasil-green))] text-white">
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-10 sm:px-6 md:flex-row lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <span className="block font-[Manrope] font-extrabold">Bolão do Brasil</span>
          <span className="text-xs text-white/55">Palpite, torcida e emoção.</span>
        </div>
      </div>
      <p className="text-center text-xs font-medium text-white/55">© 2026 Bolão do Brasil. Todos os direitos reservados.</p>
    </div>
  </footer>
);

export default Footer;
