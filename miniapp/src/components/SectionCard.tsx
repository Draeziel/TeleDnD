import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  children: ReactNode;
}

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
