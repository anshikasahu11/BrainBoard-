import Reveal from "@/components/Reveal";

// The eyebrow, title and optional description at the top of every workspace page.
export default function PageHeading({ eyebrow, title, description }) {
  return (
    <div>
      <Reveal level="balanced">
        <p className="eyebrow mb-4">
          <span className="size-1.5 rounded-full bg-ember-300" />
          {eyebrow}
        </p>
      </Reveal>

      <Reveal level="balanced" delay={0.1}>
        <h1 className="text-glow font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          {title}
        </h1>
      </Reveal>

      {description && (
        <Reveal level="balanced" delay={0.2}>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2">{description}</p>
        </Reveal>
      )}
    </div>
  );
}