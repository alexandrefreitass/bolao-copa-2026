import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Minus, Plus } from 'lucide-react';

const ScoreControl = ({ label, abbreviation, score, onChange, disabled, team }) => {
  const numericScore = score === '' ? 0 : Number(score);
  const isBrazil = team === 'brazil';

  const setScore = (next) => {
    onChange(String(Math.min(20, Math.max(0, next))));
  };

  const handleInput = (event) => {
    const digits = event.target.value.replace(/\D/g, '');

    if (digits === '') {
      onChange('');
      return;
    }

    onChange(String(Math.min(20, Number(digits))));
  };

  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="mb-5 flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-extrabold tracking-wide ${
          isBrazil ? 'bg-primary text-white' : 'bg-destructive text-white'
        }`}>
          {abbreviation}
        </span>
        <span className={`font-[Manrope] text-lg font-extrabold ${isBrazil ? 'text-primary' : 'text-destructive'}`}>
          {label}
        </span>
      </div>

      <div className="grid grid-cols-[44px_76px_44px] items-center gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || numericScore <= 0}
          onClick={() => setScore(numericScore - 1)}
          aria-label={`Diminuir placar do ${label}`}
          className="h-11 w-11 rounded-full border-border bg-white shadow-none"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={score}
          onChange={handleInput}
          disabled={disabled}
          aria-label={`Placar do ${label}`}
          className="h-[76px] w-[76px] rounded-2xl border-2 border-primary/15 bg-white text-center font-[Manrope] text-3xl font-extrabold text-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.08)] outline-none transition-all focus:border-primary/45 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="0"
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || numericScore >= 20}
          onClick={() => setScore(numericScore + 1)}
          aria-label={`Aumentar placar do ${label}`}
          className="h-11 w-11 rounded-full border-border bg-white shadow-none"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const ScoreSelectorComponent = ({ brasilScore, marrocosScore, onBrasilChange, onMarrocosChange, onSubmit, disabled }) => {
  const isSubmitDisabled = disabled || brasilScore === '' || marrocosScore === '';

  return (
    <div className="rounded-[1.25rem] border border-primary/10 bg-gradient-to-b from-white to-primary/[0.025] px-4 py-7 sm:px-8 sm:py-9">
      <div className="mx-auto grid max-w-2xl grid-cols-1 items-center gap-7 sm:grid-cols-[1fr_56px_1fr] sm:gap-5">
        <ScoreControl
          label="Brasil"
          abbreviation="BR"
          team="brazil"
          score={brasilScore}
          onChange={onBrasilChange}
          disabled={disabled}
        />

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-foreground font-[Manrope] text-xs font-extrabold uppercase tracking-wider text-white shadow-[0_8px_20px_hsl(var(--foreground)/0.18)] sm:h-14 sm:w-14">
          VS
        </div>

        <ScoreControl
          label="Marrocos"
          abbreviation="MA"
          team="morocco"
          score={marrocosScore}
          onChange={onMarrocosChange}
          disabled={disabled}
        />
      </div>

      {onSubmit && (
        <div className="mt-8 flex justify-center border-t border-border/70 pt-6">
          <Button onClick={onSubmit} disabled={isSubmitDisabled} size="lg" className="w-full sm:w-64">
            <Check className="h-4 w-4" />
            {disabled ? 'Processando...' : 'Confirmar placar'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScoreSelectorComponent;
